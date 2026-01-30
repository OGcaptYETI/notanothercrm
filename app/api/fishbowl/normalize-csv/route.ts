import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CSV Field Normalization Service
 * 
 * Purpose: Transform ANY Fishbowl CSV format to match our hardcoded import expectations
 * This keeps validation and commission calculations stable while supporting flexible CSV formats
 */

interface FieldMapping {
  csvHeader: string;
  normalizedHeader: string;
  confidence: 'exact' | 'alias' | 'fuzzy';
  transform?: (value: string) => string;
}

interface NormalizationResult {
  success: boolean;
  originalHeaders: string[];
  normalizedHeaders: string[];
  mappings: FieldMapping[];
  normalizedData: any[];
  warnings: string[];
  stats: {
    totalRows: number;
    totalOrders: number;
    unmappedHeaders: string[];
    missingRequiredFields: string[];
  };
}

// Define the exact headers our import expects (hardcoded in import-unified)
const REQUIRED_FIELDS = {
  // Order fields
  'Sales order Number': { aliases: ['SO Number', 'Order Number', 'Order #'], required: true },
  'Sales Order ID': { aliases: ['SO ID', 'SalesOrderID'], required: true },
  'Account ID': { aliases: ['Customer id', 'Account id', 'CustomerId', 'accountNumber'], required: true },
  'Customer Name': { aliases: ['Customer', 'Billing Name', 'Bill to name'], required: true },
  'Sales Rep': { aliases: ['Sales person', 'Salesperson', 'SalesRep', 'Rep'], required: true },
  'Issued date': { aliases: ['Posting Date', 'Issue Date', 'Order Date', 'Date'], required: true },
  
  // Line item fields
  'SO Item ID': { aliases: ['Sales Order Product ID', 'Line Item ID', 'SOItemID', 'ItemID'], required: true },
  'SO Item Product Number': { aliases: ['Product', 'Product ID', 'SKU', 'Part Number'], required: true },
  'Qty fulfilled': { aliases: ['Quantity', 'Qty', 'Quantity Fulfilled', 'Fulfilled Quantity'], required: false },
  'Unit price': { aliases: ['Unit Price', 'UnitPrice', 'Price'], required: false },
  'Total Price': { aliases: ['Revenue', 'Order value', 'Total', 'Line Total', 'Amount'], required: true },
  'Total cost': { aliases: ['Invoiced cost', 'Cost', 'Total Cost', 'COGS'], required: false },
  
  // Optional fields
  'Product Description': { aliases: ['Product desc', 'Description', 'Item Description', 'Sales Order Item Description'], required: false },
  'Billing Address': { aliases: ['Bill to address', 'Address', 'Street'], required: false },
  'Billing City': { aliases: ['Bill to city', 'City'], required: false },
  'Billing State': { aliases: ['Bill to State', 'State'], required: false },
  'Billing Zip': { aliases: ['Bill to Zip', 'Zip', 'Postal Code'], required: false },
};

function normalizeFieldName(header: string): string {
  // Remove special characters, convert to lowercase for comparison
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function findBestMapping(csvHeader: string): FieldMapping | null {
  const normalizedCsv = normalizeFieldName(csvHeader);
  
  // Check each expected field and its aliases
  for (const [expectedHeader, config] of Object.entries(REQUIRED_FIELDS)) {
    const normalizedExpected = normalizeFieldName(expectedHeader);
    
    // Exact match
    if (normalizedCsv === normalizedExpected) {
      return {
        csvHeader,
        normalizedHeader: expectedHeader,
        confidence: 'exact'
      };
    }
    
    // Alias match
    for (const alias of config.aliases) {
      const normalizedAlias = normalizeFieldName(alias);
      if (normalizedCsv === normalizedAlias) {
        return {
          csvHeader,
          normalizedHeader: expectedHeader,
          confidence: 'alias'
        };
      }
    }
  }
  
  // No match found
  return null;
}

function transformValue(value: any, targetField: string): string {
  if (value === null || value === undefined) return '';
  
  const strValue = String(value).trim();
  
  // Field-specific transformations
  switch (targetField) {
    case 'Account ID':
    case 'Sales Order ID':
    case 'SO Item ID':
      // Remove commas from IDs
      return strValue.replace(/,/g, '');
    
    case 'Total Price':
    case 'Unit price':
    case 'Total cost':
      // Ensure currency values are clean
      return strValue.replace(/[$,]/g, '');
    
    default:
      return strValue;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const csvText = await file.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0) {
      return NextResponse.json({ 
        error: 'CSV parsing failed',
        details: parsed.errors 
      }, { status: 400 });
    }
    
    const originalRows = parsed.data as any[];
    const originalHeaders = parsed.meta.fields || [];
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 CSV NORMALIZATION - Analyzing ${originalHeaders.length} columns`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Build mapping for each CSV header
    const mappings: FieldMapping[] = [];
    const warnings: string[] = [];
    const unmappedHeaders: string[] = [];
    
    for (const csvHeader of originalHeaders) {
      const mapping = findBestMapping(csvHeader);
      
      if (mapping) {
        mappings.push(mapping);
        console.log(`✅ "${csvHeader}" → "${mapping.normalizedHeader}" (${mapping.confidence})`);
      } else {
        unmappedHeaders.push(csvHeader);
        console.log(`⚠️  "${csvHeader}" → No mapping found (will be ignored)`);
      }
    }
    
    // Check for missing required fields
    const missingRequiredFields: string[] = [];
    for (const [expectedHeader, config] of Object.entries(REQUIRED_FIELDS)) {
      if (!config.required) continue;
      
      const isMapped = mappings.some(m => m.normalizedHeader === expectedHeader);
      if (!isMapped) {
        missingRequiredFields.push(expectedHeader);
        warnings.push(`Missing required field: ${expectedHeader}`);
      }
    }
    
    if (missingRequiredFields.length > 0) {
      console.error('\n❌ CRITICAL: Missing required fields:', missingRequiredFields);
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        missingFields: missingRequiredFields,
        warnings
      }, { status: 400 });
    }
    
    // Transform data to use normalized headers
    const normalizedData = originalRows.map(row => {
      const normalizedRow: any = {};
      
      for (const mapping of mappings) {
        const originalValue = row[mapping.csvHeader];
        const transformedValue = transformValue(originalValue, mapping.normalizedHeader);
        normalizedRow[mapping.normalizedHeader] = transformedValue;
      }
      
      return normalizedRow;
    });
    
    // Calculate statistics
    const orderNumbers = new Set(normalizedData.map(row => row['Sales order Number']).filter(Boolean));
    
    console.log(`\n✅ Normalization complete:`);
    console.log(`   Mapped: ${mappings.length} fields`);
    console.log(`   Unmapped: ${unmappedHeaders.length} fields`);
    console.log(`   Rows: ${normalizedData.length}`);
    console.log(`   Unique Orders: ${orderNumbers.size}`);
    
    const result: NormalizationResult = {
      success: true,
      originalHeaders,
      normalizedHeaders: mappings.map(m => m.normalizedHeader),
      mappings,
      normalizedData,
      warnings,
      stats: {
        totalRows: normalizedData.length,
        totalOrders: orderNumbers.size,
        unmappedHeaders,
        missingRequiredFields
      }
    };
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Normalization error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
