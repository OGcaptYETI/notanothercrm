import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Helper function to create error response
function createErrorResponse(message: string, status: number, details?: unknown) {
  const errorResponse: { error: string; details?: unknown } = { error: message };
  if (details) {
    errorResponse.details = details;
  }
  return NextResponse.json(errorResponse, {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(request: NextRequest) {
  console.log('=== Fetch Stores Request Received ===');
  
  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return createErrorResponse('Unauthorized - Missing or invalid token', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.error('Empty token provided');
      return createErrorResponse('Unauthorized - Invalid token format', 401);
    }

    // 2. Token Verification
    console.log('Verifying ID token...');
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
      console.log(`Token verified for user: ${decodedToken.email}`);
    } catch (error) {
      console.error('Token verification failed:', error);
      return createErrorResponse('Unauthorized - Invalid or expired token', 401);
    }

    // 3. Authorization - Check allowed domains
    const allowedDomains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || 'kanvabotanicals.com,cwlbrands.com')
      .split(',')
      .map(d => d.trim().toLowerCase());
    
    const userDomain = decodedToken.email?.split('@')[1]?.toLowerCase();
    if (!userDomain || !allowedDomains.includes(userDomain)) {
      console.error(`Forbidden domain: ${userDomain}`);
      return createErrorResponse('Forbidden - Unauthorized domain', 403, {
        domain: userDomain,
        allowedDomains
      });
    }

    // Query copper_companies collection for Active Customers OR On Store Locator
    console.log('Querying copper_companies collection...');
    
    try {
      const companiesRef = adminDb.collection('copper_companies');
      
      // First, let's get a sample document to see the actual field structure
      console.log('Getting sample document to check field names...');
      const sampleSnapshot = await companiesRef.limit(1).get();
      if (!sampleSnapshot.empty) {
        const sampleDoc = sampleSnapshot.docs[0].data();
        console.log('Sample document keys:', Object.keys(sampleDoc));
        console.log('Active Customer field value:', sampleDoc['Active Customer cf_712751']);
        console.log('On Store Locator field value:', sampleDoc['On Store Locator cf_715755']);
      }
      
      // Query for Active Customers
      console.log('Fetching active customers...');
      const activeCustomersSnapshot = await companiesRef
        .where('Active Customer cf_712751', '==', 'checked')
        .limit(2000) // Safety limit
        .get();
      
      console.log(`Found ${activeCustomersSnapshot.size} active customers`);
      
      // Query for On Store Locator
      console.log('Fetching stores on locator...');
      const onLocatorSnapshot = await companiesRef
        .where('On Store Locator cf_715755', '==', 'checked')
        .limit(2000) // Safety limit
        .get();
      
      console.log(`Found ${onLocatorSnapshot.size} stores on locator`);
      
      // Combine results and deduplicate by doc ID
      const storesMap = new Map();
      
      // Process active customers
      activeCustomersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        storesMap.set(doc.id, {
          id: doc.id,
          name: data.name || data.Name || '',
          address_line_1: data.street || data.Street || '',
          city: data.city || data.City || '',
          state: data.state || data.State || '',
          postal_code: data.zip || data['Postal Code'] || '',
          phone: data.phone || '',
          website: '',
          email: data.email || '',
          fishbowl_id: data['Account Order ID cf_698467'] || data['`Account Order ID cf_698467`'] || '',
          copper_id: data['Account ID cf_713477'] || data['`Account ID cf_713477`'] || '',
          onStoreLocator: data['On Store Locator cf_715755'] === 'checked' || data['`On Store Locator cf_715755`'] === 'checked' || data['on_store_locator'] === true,
          activeCustomer: true,
          copper_company_id: data.id || data['Copper ID'] || null
        });
      });
      
      // Process stores on locator (may overlap with active customers)
      onLocatorSnapshot.docs.forEach(doc => {
        if (!storesMap.has(doc.id)) {
          const data = doc.data();
          
          storesMap.set(doc.id, {
            id: doc.id,
            name: data.name || data.Name || '',
            address_line_1: data.street || data.Street || '',
            city: data.city || data.City || '',
            state: data.state || data.State || data['`state`'] || '',
            postal_code: data.zip || data['Postal Code'] || data['`Postal Code`'] || '',
            phone: data.phone || '',
            website: '',
            email: data.email || '',
            fishbowl_id: data['Account Order ID cf_698467'] || data['`Account Order ID cf_698467`'] || '',
            copper_id: data['Account ID cf_713477'] || data['`Account ID cf_713477`'] || '',
            onStoreLocator: true, // This store came from the onLocator query, so it's definitely on the locator
            activeCustomer: data['Active Customer cf_712751'] === 'checked' || data['`Active Customer cf_712751`'] === 'checked',
            copper_company_id: data.id || data['Copper ID'] || data['`Copper ID`'] || null
          });
        } else {
          // Update existing entry to mark as on locator
          const existing = storesMap.get(doc.id);
          existing.onStoreLocator = true; // This store was already in the map, but we've now confirmed it's on the locator
        }
      });
      
      const stores = Array.from(storesMap.values());
      console.log(`Total unique stores: ${stores.length}`);
      
      return NextResponse.json({
        success: true,
        data: stores
      });
    } catch (error) {
      console.error('Error querying copper_companies:', error);
      return createErrorResponse('Failed to fetch stores from Firestore', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error: any) {
    console.error('Fetch stores error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}
