import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyIdToken } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(idToken);
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const companiesRef = adminDb.collection('copper_companies');
    
    // Get total stores on locator - try both field name formats
    let onLocatorSnapshot;
    try {
      onLocatorSnapshot = await companiesRef
        .where('On Store Locator cf_715755', '==', 'checked')
        .get();
    } catch (error) {
      // Fallback to backtick format
      onLocatorSnapshot = await companiesRef
        .where('`On Store Locator cf_715755`', '==', 'checked')
        .get();
    }
    
    const totalOnLocator = onLocatorSnapshot.size;
    
    // Calculate month-over-month growth
    // Get stores added in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);
    
    // Get stores added in the previous 30 days (30-60 days ago)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoTimestamp = Math.floor(sixtyDaysAgo.getTime() / 1000);
    
    let recentStores = 0;
    let previousStores = 0;
    
    // Count stores by checking their updatedAt timestamp
    onLocatorSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const updatedAt = data.updatedAt?._seconds || data['Updated At'] || 0;
      
      if (updatedAt >= thirtyDaysAgoTimestamp) {
        recentStores++;
      } else if (updatedAt >= sixtyDaysAgoTimestamp) {
        previousStores++;
      }
    });
    
    // Calculate percentage change
    const percentageChange = previousStores > 0 
      ? ((recentStores - previousStores) / previousStores) * 100 
      : recentStores > 0 ? 100 : 0;
    
    return NextResponse.json({
      success: true,
      data: {
        totalOnLocator,
        recentStores,
        previousStores,
        percentageChange: Math.round(percentageChange * 10) / 10, // Round to 1 decimal
      }
    });
  } catch (error) {
    console.error('Error fetching store stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch store stats' },
      { status: 500 }
    );
  }
}
