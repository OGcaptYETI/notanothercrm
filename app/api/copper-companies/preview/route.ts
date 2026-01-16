import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Get preview of copper_companies for staging table
 * Returns first 50 companies for UI preview
 */
export async function GET() {
  try {
    console.log('📊 Fetching copper_companies preview...');

    const companiesSnapshot = await adminDb
      .collection('copper_companies')
      .limit(50)
      .get();

    const companies = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ Fetched ${companies.length} companies for preview`);

    return NextResponse.json({
      companies,
      total: companies.length,
    });

  } catch (error: any) {
    console.error('❌ Error fetching preview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch preview' },
      { status: 500 }
    );
  }
}
