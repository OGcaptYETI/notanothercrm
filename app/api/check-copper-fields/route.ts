import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Checking Copper company fields...');
    
    const companiesSnap = await adminDb.collection('copper_companies').limit(10).get();
    
    const samples = companiesSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        'Account ID cf_713477': data['Account ID cf_713477'],
        'Account Order ID cf_698467': data['Account Order ID cf_698467'],
        'Active Customer cf_712751': data['Active Customer cf_712751'],
        'Account Type cf_675914': data['Account Type cf_675914'],
        allFields: Object.keys(data).filter(k => k.includes('cf_'))
      };
    });
    
    console.log('Sample companies:', JSON.stringify(samples, null, 2));
    
    return NextResponse.json({
      success: true,
      totalCompanies: companiesSnap.size,
      samples
    });
    
  } catch (error: any) {
    console.error('Error checking Copper fields:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
