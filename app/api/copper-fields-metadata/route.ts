import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

interface CopperCustomFieldDefinition {
  id: number;
  name: string;
  data_type: string;
  available_on?: string[];
  options?: Array<{ id: number; name: string }>;
}

/**
 * Fetch metadata about all Copper fields from a sample of companies
 * This helps us understand what fields are available for mapping
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Analyzing Copper fields metadata...');

    // Fetch custom field definitions from Copper API
    const copperApiKey = process.env.COPPER_API_KEY;
    const copperEmail = process.env.COPPER_USER_EMAIL;

    if (!copperApiKey || !copperEmail) {
      return NextResponse.json(
        { error: 'Copper API credentials not configured' },
        { status: 500 }
      );
    }

    console.log('📡 Fetching custom field definitions from Copper API...');
    const fieldDefsResponse = await fetch('https://api.copper.com/developer_api/v1/custom_field_definitions', {
      method: 'GET',
      headers: {
        'X-PW-AccessToken': copperApiKey,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': copperEmail,
        'Content-Type': 'application/json',
      },
    });

    if (!fieldDefsResponse.ok) {
      console.error('Failed to fetch custom field definitions from Copper');
    }

    const allFieldDefs: CopperCustomFieldDefinition[] = fieldDefsResponse.ok ? await fieldDefsResponse.json() : [];
    
    // Filter for company fields only
    const companyFieldDefs = allFieldDefs.filter(def => 
      def.available_on?.includes('company') || !def.available_on
    );

    // Create a map of field ID to field definition
    const fieldDefMap = new Map<number, CopperCustomFieldDefinition>();
    companyFieldDefs.forEach(def => fieldDefMap.set(def.id, def));

    console.log(`✅ Fetched ${companyFieldDefs.length} custom field definitions for companies`);

    // Fetch sample companies from copper_companies collection
    const companiesSnapshot = await adminDb
      .collection('copper_companies')
      .limit(100)
      .get();

    if (companiesSnapshot.empty) {
      return NextResponse.json({
        error: 'No companies found in copper_companies collection. Please run the API sync first.',
      }, { status: 404 });
    }

    // Analyze all fields across companies
    const fieldStats: Record<string, {
      count: number;
      sampleValues: any[];
      type: string;
      isCustomField: boolean;
      fieldId?: number;
      displayName: string;
      dataType?: string;
      options?: Array<{ id: number; name: string }>;
    }> = {};

    companiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Analyze all fields
      Object.keys(data).forEach(fieldName => {
        const value = data[fieldName];
        
        if (!fieldStats[fieldName]) {
          const isCustomField = fieldName.startsWith('cf_');
          const fieldId = isCustomField ? parseInt(fieldName.replace('cf_', '')) : undefined;
          const fieldDef = fieldId ? fieldDefMap.get(fieldId) : undefined;
          
          fieldStats[fieldName] = {
            count: 0,
            sampleValues: [],
            type: typeof value,
            isCustomField,
            fieldId,
            displayName: fieldDef?.name || fieldName,
            dataType: fieldDef?.data_type,
            options: fieldDef?.options,
          };
        }
        
        fieldStats[fieldName].count++;
        
        // Store up to 5 sample values
        if (fieldStats[fieldName].sampleValues.length < 5 && value !== null && value !== '') {
          // Decode custom field values if we have options
          const isCustom = fieldName.startsWith('cf_');
          const fId = isCustom ? parseInt(fieldName.replace('cf_', '')) : undefined;
          const fieldDef = fId ? fieldDefMap.get(fId) : undefined;
          let decodedValue = value;
          
          if (fieldDef?.options && Array.isArray(value)) {
            // MultiSelect: decode array of IDs to names
            decodedValue = value.map(id => {
              const option = fieldDef.options?.find(opt => opt.id === id);
              return option ? `${option.name} (${id})` : String(id);
            });
          } else if (fieldDef?.options && typeof value === 'number') {
            // Dropdown: decode single ID to name
            const option = fieldDef.options.find(opt => opt.id === value);
            decodedValue = option ? `${option.name} (${value})` : value;
          } else if (typeof value === 'object' && JSON.stringify(value).length > 200) {
            decodedValue = '[Complex Object]';
          }
          
          fieldStats[fieldName].sampleValues.push(decodedValue);
        }
      });
    });

    // Get custom field definitions from a sample company
    const sampleCompany = companiesSnapshot.docs[0].data();
    const customFieldsRaw = sampleCompany.custom_fields_raw || [];

    // Sort fields by frequency (most common first)
    const sortedFields = Object.entries(fieldStats)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([fieldName, stats]) => ({
        fieldName,
        ...stats,
        frequency: `${stats.count}/${companiesSnapshot.size}`,
      }));

    // Categorize fields
    const standardFields = sortedFields.filter(f => !f.isCustomField && !['copper_raw_data', 'custom_fields_raw'].includes(f.fieldName));
    const customFields = sortedFields.filter(f => f.isCustomField);
    const metadataFields = sortedFields.filter(f => ['copper_raw_data', 'custom_fields_raw', 'syncedFromCopperApiAt', 'source', 'createdAt'].includes(f.fieldName));

    console.log(`✅ Analyzed ${companiesSnapshot.size} companies`);
    console.log(`   Standard fields: ${standardFields.length}`);
    console.log(`   Custom fields: ${customFields.length}`);

    return NextResponse.json({
      success: true,
      totalCompaniesAnalyzed: companiesSnapshot.size,
      summary: {
        standardFieldsCount: standardFields.length,
        customFieldsCount: customFields.length,
        metadataFieldsCount: metadataFields.length,
      },
      fields: {
        standard: standardFields,
        custom: customFields,
        metadata: metadataFields,
      },
      customFieldDefinitions: companyFieldDefs,
      customFieldsRaw,
    });

  } catch (error: any) {
    console.error('❌ Error fetching Copper fields metadata:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
