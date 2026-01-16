import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking Copper ID formats...\n');

    // Get active Copper companies
    const copperSnapshot = await adminDb
      .collection('copper_companies')
      .where('Active Customer cf_712751', '==', 'checked')
      .limit(5)
      .get();

    console.log(`Found ${copperSnapshot.size} active Copper companies (showing first 5):\n`);

    const copperIds: any[] = [];
    copperSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const company = {
        docId: doc.id,
        name: data.name || data.Name,
        accountId: data['Account ID cf_713477'],
        accountOrderId: data['Account Order ID cf_698467'],
      };
      copperIds.push(company);
      console.log(`Copper Company: ${company.name}`);
      console.log(`  - doc.id: ${company.docId}`);
      console.log(`  - Account ID cf_713477: ${company.accountId}`);
      console.log(`  - Account Order ID cf_698467: ${company.accountOrderId}\n`);
    });

    // Get fishbowl_customers with copperIds
    const fishbowlSnapshot = await adminDb
      .collection('fishbowl_customers')
      .where('copperId', '!=', null)
      .limit(10)
      .get();

    console.log(`\nFound ${fishbowlSnapshot.size} fishbowl_customers with copperId (showing first 10):\n`);

    const fishbowlCustomers: any[] = [];
    fishbowlSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const customer = {
        docId: doc.id,
        name: data.name,
        copperId: data.copperId,
        copperCompanyId: data.copperCompanyId,
        accountId: data.accountId,
        accountNumber: data.accountNumber,
      };
      fishbowlCustomers.push(customer);
      console.log(`Fishbowl Customer: ${customer.name}`);
      console.log(`  - doc.id: ${customer.docId}`);
      console.log(`  - copperId: ${customer.copperId}`);
      console.log(`  - copperCompanyId: ${customer.copperCompanyId}`);
      console.log(`  - accountId: ${customer.accountId}`);
      console.log(`  - accountNumber: ${customer.accountNumber}\n`);
    });

    return NextResponse.json({
      success: true,
      copperCompanies: copperIds,
      fishbowlCustomers: fishbowlCustomers,
      summary: {
        activeCopper: copperSnapshot.size,
        fishbowlWithCopperId: fishbowlSnapshot.size,
      }
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
