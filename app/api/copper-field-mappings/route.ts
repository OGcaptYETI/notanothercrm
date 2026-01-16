import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

interface FieldMapping {
  copperField: string;
  ourField: string;
  transform?: string; // Optional transformation function name
  enabled: boolean;
}

/**
 * GET: Fetch current field mappings
 * POST: Save field mappings
 */

export async function GET(request: NextRequest) {
  try {
    const doc = await adminDb
      .collection('system_config')
      .doc('copper_field_mappings')
      .get();

    if (!doc.exists) {
      // Return default mappings
      return NextResponse.json({
        success: true,
        mappings: getDefaultMappings(),
        isDefault: true,
      });
    }

    return NextResponse.json({
      success: true,
      mappings: doc.data()?.mappings || [],
      isDefault: false,
      lastUpdated: doc.data()?.updatedAt,
    });

  } catch (error: any) {
    console.error('❌ Error fetching field mappings:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'Mappings must be an array' },
        { status: 400 }
      );
    }

    // Validate mappings
    for (const mapping of mappings) {
      if (!mapping.copperField || !mapping.ourField) {
        return NextResponse.json(
          { error: 'Each mapping must have copperField and ourField' },
          { status: 400 }
        );
      }
    }

    // Save to Firestore
    await adminDb
      .collection('system_config')
      .doc('copper_field_mappings')
      .set({
        mappings,
        updatedAt: Timestamp.now(),
      });

    console.log(`✅ Saved ${mappings.length} field mappings`);

    return NextResponse.json({
      success: true,
      message: `Saved ${mappings.length} field mappings`,
      mappings,
    });

  } catch (error: any) {
    console.error('❌ Error saving field mappings:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function getDefaultMappings(): FieldMapping[] {
  return [
    // Core fields
    { copperField: 'id', ourField: 'copperId', enabled: true },
    { copperField: 'name', ourField: 'customerName', enabled: true },
    { copperField: 'assignee_id', ourField: 'salesRepId', enabled: true },
    
    // Address fields
    { copperField: 'address.street', ourField: 'Street', enabled: true },
    { copperField: 'address.city', ourField: 'City', enabled: true },
    { copperField: 'address.state', ourField: 'State', enabled: true },
    { copperField: 'address.postal_code', ourField: 'Postal Code', enabled: true },
    
    // Contact fields
    { copperField: 'phone_numbers[0].number', ourField: 'Phone', enabled: true },
    { copperField: 'email_domain', ourField: 'Email', enabled: true },
    
    // Custom fields (known)
    { copperField: 'cf_675914', ourField: 'accountType', enabled: true },
    { copperField: 'cf_698467', ourField: 'fishbowlCustomerId', enabled: true },
    { copperField: 'cf_713477', ourField: 'accountId', enabled: true },
    { copperField: 'cf_680701', ourField: 'region', enabled: true },
    { copperField: 'cf_708027', ourField: 'salesPerson', enabled: true },
  ];
}
