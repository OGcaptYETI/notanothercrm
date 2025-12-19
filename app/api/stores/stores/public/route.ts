import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const companiesRef = adminDb.collection('copper_companies');
    
    // Query for stores on locator (public access, no auth required)
    const onLocatorSnapshot = await companiesRef
      .where('`On Store Locator cf_715755`', '==', 'checked')
      .limit(2000)
      .get();
    
    const stores = onLocatorSnapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        name: data.name || data.Name || '',
        address_line_1: data.street || data.Street || '',
        city: data.city || data.City || '',
        state: data.state || data.State || '',
        postal_code: data.zip || data['Postal Code'] || '',
        phone: data.phone || '',
        copper_company_id: data.id || data['Copper ID'] || null
      };
    });
    
    return NextResponse.json({
      success: true,
      data: stores
    });
  } catch (error) {
    console.error('Error fetching public stores:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}
