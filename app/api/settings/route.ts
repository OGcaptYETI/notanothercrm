import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const type = searchParams.get('type'); // 'rates' or 'rules'

    if (type === 'rates' && title) {
      // Load commission rates for specific title
      const ratesDoc = await adminDb.collection('settings').doc(`commission_rates_${title}`).get();
      
      if (ratesDoc.exists) {
        return NextResponse.json({
          success: true,
          data: ratesDoc.data()
        });
      } else {
        return NextResponse.json({
          success: true,
          data: null
        });
      }
    } else if (type === 'rules') {
      // Load commission rules
      const rulesDoc = await adminDb.collection('settings').doc('commission_rules').get();
      
      return NextResponse.json({
        success: true,
        data: rulesDoc.exists ? rulesDoc.data() : null
      });
    } else {
      // Load all settings
      const settingsSnapshot = await adminDb.collection('settings').get();
      const settings: Record<string, any> = {};
      
      settingsSnapshot.forEach(doc => {
        settings[doc.id] = doc.data();
      });

      return NextResponse.json({
        success: true,
        data: settings
      });
    }
  } catch (error: any) {
    console.error('Error loading settings:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { docId, data } = body;

    if (!docId || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing docId or data' },
        { status: 400 }
      );
    }

    await adminDb.collection('settings').doc(docId).set(data, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
