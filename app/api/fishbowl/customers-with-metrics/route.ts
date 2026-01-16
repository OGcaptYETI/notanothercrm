import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Loading customers with metrics...');

    // CRITICAL: Get only ACTIVE customers from copper_companies collection
    // Active Customer cf_712751 is a BOOLEAN field (true/false), not a string
    const copperCompaniesSnapshot = await adminDb
      .collection('copper_companies')
      .where('Active Customer cf_712751', '==', true)
      .get();

    console.log(`📊 Found ${copperCompaniesSnapshot.size} ACTIVE Copper companies`);

    // Build a Map of active Copper companies by Account ID cf_713477
    // fishbowl_customers.accountId matches copper_companies 'Account ID cf_713477'
    const activeCopperByAccountId = new Map<string, any>();
    copperCompaniesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const accountId = data['Account ID cf_713477'] || doc.id;
      
      if (accountId) {
        activeCopperByAccountId.set(String(accountId), {
          docId: doc.id,
          name: data.name || data.Name,
          accountId: String(accountId),
        });
      }
    });

    console.log(`✅ Built lookup map with ${activeCopperByAccountId.size} active Copper companies by Account ID`);

    // Get fishbowl_customers that match active Copper IDs
    const customersSnapshot = await adminDb
      .collection('fishbowl_customers')
      .where('copperId', '!=', null)
      .get();

    console.log(`Found ${customersSnapshot.size} fishbowl customers with Copper IDs`);

    const customers = customersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const accountId = String(data.accountId || '');
        
        // Match by accountId (fishbowl_customers) to Account ID cf_713477 (copper_companies)
        const copperCompany = activeCopperByAccountId.get(accountId);
        
        if (!copperCompany) {
          return null;
        }
        
        return {
          id: doc.id,
          name: data.name || '',
          copperCompanyId: copperCompany.docId,
          copperCompanyName: copperCompany.name,
          accountId: accountId,
          metrics: data.metrics || null,
          metricsCalculatedAt: data.metricsCalculatedAt || null,
          syncedToCopperAt: data.syncedToCopperAt || null,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Sort by name
    customers.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`✅ Returning ${customers.length} customers`);

    return NextResponse.json({
      success: true,
      customers,
    });

  } catch (error: any) {
    console.error('❌ Error loading customers:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
