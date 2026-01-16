import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking failed sync customers...\n');

    // Get a few customers that are failing
    const failedCustomers = [
      'Prolific Distro',
      'Amsterdam Smoke and Vape',
      'Holy Smokes',
      'skyhigh distribution',
      'Dejavu Wholesale inc'
    ];

    const results: any[] = [];

    for (const customerName of failedCustomers) {
      // Find in fishbowl_customers
      const fishbowlSnapshot = await adminDb
        .collection('fishbowl_customers')
        .where('name', '==', customerName)
        .limit(1)
        .get();

      if (!fishbowlSnapshot.empty) {
        const fbData = fishbowlSnapshot.docs[0].data();
        
        // Check if this ID exists in copper_companies
        const copperId = fbData.copperId || fbData.copperCompanyId;
        let copperExists = false;
        let copperData = null;

        if (copperId) {
          const copperDoc = await adminDb
            .collection('copper_companies')
            .doc(String(copperId))
            .get();
          
          copperExists = copperDoc.exists;
          if (copperExists) {
            copperData = copperDoc.data();
          }
        }

        results.push({
          customerName,
          fishbowlData: {
            id: fishbowlSnapshot.docs[0].id,
            copperId: fbData.copperId,
            copperCompanyId: fbData.copperCompanyId,
            accountId: fbData.accountId,
            name: fbData.name,
          },
          copperExists,
          copperData: copperData ? {
            id: copperData.id,
            name: copperData.name,
            accountId: copperData['Account ID cf_713477'],
          } : null,
          issue: !copperExists ? 'Copper company not found with this ID' : 'ID exists in Firestore'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: 'Check if copperId from fishbowl_customers matches actual Copper company IDs'
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
