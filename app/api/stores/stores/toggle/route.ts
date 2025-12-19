import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { updateCompanyCustomField } from '@/lib/integrations/copper';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await verifyIdToken(token);

    // Authorization - Check allowed domains
    const allowedDomains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || 'kanvabotanicals.com,cwlbrands.com')
      .split(',')
      .map(d => d.trim().toLowerCase());
    
    const userDomain = decodedToken.email?.split('@')[1]?.toLowerCase();
    if (!userDomain || !allowedDomains.includes(userDomain)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get request body
    const { copper_company_id, value } = await request.json();

    if (!copper_company_id || typeof value !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Update the "On Store Locator" field (cf_715755)
    const fieldId = 715755;
    const success = await updateCompanyCustomField(copper_company_id, fieldId, value);

    if (!success) {
      return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle store locator error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle store locator' },
      { status: 500 }
    );
  }
}
