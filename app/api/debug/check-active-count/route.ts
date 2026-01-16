import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking active customer counts...\n');

    // Check total copper_companies
    const totalSnapshot = await adminDb
      .collection('copper_companies')
      .limit(1)
      .get();

    console.log(`Total copper_companies collection exists: ${!totalSnapshot.empty}`);

    // Check with 'checked' value
    const checkedSnapshot = await adminDb
      .collection('copper_companies')
      .where('Active Customer cf_712751', '==', 'checked')
      .limit(5)
      .get();

    console.log(`\nActive with 'checked': ${checkedSnapshot.size}`);
    if (!checkedSnapshot.empty) {
      const sample = checkedSnapshot.docs[0].data();
      console.log(`Sample: ${sample.name} - Active field: ${sample['Active Customer cf_712751']}`);
    }

    // Check with true value
    const trueSnapshot = await adminDb
      .collection('copper_companies')
      .where('Active Customer cf_712751', '==', true)
      .limit(5)
      .get();

    console.log(`\nActive with true: ${trueSnapshot.size}`);

    // Check with 'Checked' (capital C)
    const capitalSnapshot = await adminDb
      .collection('copper_companies')
      .where('Active Customer cf_712751', '==', 'Checked')
      .limit(5)
      .get();

    console.log(`Active with 'Checked': ${capitalSnapshot.size}`);

    // Get a sample of companies to see what values exist
    const sampleSnapshot = await adminDb
      .collection('copper_companies')
      .limit(10)
      .get();

    const activeFieldValues = new Set<any>();
    sampleSnapshot.docs.forEach(doc => {
      const value = doc.data()['Active Customer cf_712751'];
      activeFieldValues.add(JSON.stringify(value));
    });

    console.log(`\nSample of Active Customer field values found:`);
    activeFieldValues.forEach(v => console.log(`  - ${v}`));

    return NextResponse.json({
      success: true,
      counts: {
        withChecked: checkedSnapshot.size,
        withTrue: trueSnapshot.size,
        withCapitalChecked: capitalSnapshot.size,
      },
      sampleActiveValues: Array.from(activeFieldValues),
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
