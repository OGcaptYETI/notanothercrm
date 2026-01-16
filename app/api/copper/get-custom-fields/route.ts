import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const copperApiKey = process.env.COPPER_API_KEY;
    const copperEmail = process.env.COPPER_USER_EMAIL;

    if (!copperApiKey || !copperEmail) {
      throw new Error('Copper API credentials not configured');
    }

    // Get all custom field definitions for Companies
    const response = await fetch('https://api.copper.com/developer_api/v1/custom_field_definitions', {
      method: 'GET',
      headers: {
        'X-PW-AccessToken': copperApiKey,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': copperEmail,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Copper API error: ${response.status} - ${errorText}`);
    }

    const allFields = await response.json();
    
    // Filter for Company fields only
    const companyFields = allFields.filter((field: any) => 
      field.available_on && field.available_on.includes('company')
    );

    // Sort by name for easier reading
    companyFields.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      totalFields: companyFields.length,
      fields: companyFields.map((field: any) => ({
        id: field.id,
        name: field.name,
        data_type: field.data_type,
        available_on: field.available_on,
      })),
      fullFields: companyFields, // Complete field data for metadata file
    });

  } catch (error: any) {
    console.error('❌ Error fetching Copper custom fields:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
