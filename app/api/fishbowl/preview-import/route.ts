import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DataQualityIssue {
  type: 'comma_in_id' | 'missing_field' | 'invalid_date' | 'customer_not_found' | 'customer_mismatch' | 'duplicate_id';
  severity: 'error' | 'warning' | 'info';
  field: string;
  value: any;
  suggestion?: string;
}

interface PreviewOrder {
  rowIndex: number;
  soNumber: string;
  salesOrderId: string;
  accountId: string;
  customerName: string;
  salesPerson: string;
  issuedDate: string;
  lineItemCount: number;
  totalRevenue: number;
  issues: DataQualityIssue[];
  sanitizedData: {
    accountId: string;
    salesOrderId: string;
    lineItemIds: string[];
  };
}

// Sanitization functions
function sanitizeId(id: string | number): string {
  return String(id).replace(/[,\s]/g, '').trim();
}

function normalizeDate(dateStr: string): { valid: boolean; date: Date | null; formatted: string } {
  try {
    const parts = dateStr.split(/[-\/]/);
    if (parts.length === 3) {
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020) {
        const date = new Date(year, month - 1, day);
        return {
          valid: true,
          date,
          formatted: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        };
      }
    }
  } catch (e) {
    // Invalid date
  }
  
  return { valid: false, date: null, formatted: '' };
}

function normalizeSalesRep(rep: string): string {
  const repMap: Record<string, string> = {
    'Jared Leuzinger': 'Jared',
    'Derek Whitworth': 'DerekW',
    'Ben Wallner': 'BenW',
    'Brandon Good': 'BrandonG',
    'Shane Hymas': 'Shane-Inactive',
    'Joe Simmons': 'Commerce'
  };
  
  return repMap[rep] || rep;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Step 1: Normalize CSV to match our hardcoded field expectations
    console.log('🔄 Step 1: Normalizing CSV headers...');
    const normalizeFormData = new FormData();
    normalizeFormData.append('file', file);
    
    const normalizeResponse = await fetch(new URL('/api/fishbowl/normalize-csv', request.url).toString(), {
      method: 'POST',
      body: normalizeFormData
    });
    
    if (!normalizeResponse.ok) {
      const errorData = await normalizeResponse.json();
      return NextResponse.json({ 
        error: 'CSV normalization failed',
        details: errorData 
      }, { status: 400 });
    }
    
    const normalizationResult = await normalizeResponse.json();
    
    if (!normalizationResult.success) {
      return NextResponse.json({ 
        error: 'CSV normalization failed',
        details: normalizationResult 
      }, { status: 400 });
    }
    
    console.log(`✅ Normalization complete: ${normalizationResult.mappings.length} fields mapped`);
    
    // Check if user provided custom field mappings
    const customMappingsRaw = formData.get('fieldMappings');
    let customMappings: Record<string, string> | null = null;
    if (customMappingsRaw) {
      try {
        customMappings = JSON.parse(customMappingsRaw as string);
        console.log('🔧 Using custom field mappings from user');
      } catch (e) {
        console.warn('Failed to parse custom field mappings, using auto-detected');
      }
    }
    
    // Step 2: Use normalized data OR apply custom mappings
    let rows = normalizationResult.normalizedData;
    
    // If custom mappings provided, re-map the data
    if (customMappings) {
      const Papa = (await import('papaparse')).default;
      const csvText = await file.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const originalRows = parsed.data as any[];
      
      rows = originalRows.map((row: any) => {
        const remappedRow: any = {};
        // Apply custom mappings: systemField -> csvColumn
        for (const [systemField, csvColumn] of Object.entries(customMappings!)) {
          if (csvColumn && row[csvColumn] !== undefined) {
            remappedRow[systemField] = row[csvColumn];
          }
        }
        return remappedRow;
      });
      
      console.log(`✅ Re-mapped data with ${Object.keys(customMappings).length} custom field mappings`);
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 IMPORT PREVIEW - Analyzing ${rows.length} rows`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Load existing customers for validation
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    const existingCustomers = new Map<string, any>();
    
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      // Support both naming conventions during transition
      const accountId = data.accountNumber || data.customerId || data.id || doc.id;
      existingCustomers.set(accountId, {
        name: data.name,
        accountType: data.accountType,
        copperAccountOrderId: data.copperAccountOrderId
      });
    });
    
    console.log(`✅ Loaded ${existingCustomers.size} existing customers`);
    
    // Group rows by order for analysis
    const orderGroups = new Map<string, any[]>();
    rows.forEach((row, index) => {
      const soNum = String(row['Sales order Number'] || row['SO Number'] || '').trim();
      if (soNum) {
        if (!orderGroups.has(soNum)) {
          orderGroups.set(soNum, []);
        }
        orderGroups.get(soNum)!.push({ ...row, rowIndex: index });
      }
    });
    
    console.log(`📦 Found ${orderGroups.size} unique orders`);
    
    // Analyze first 10 orders for preview
    const previewOrders: PreviewOrder[] = [];
    const orderNumbers = Array.from(orderGroups.keys()).slice(0, 10);
    
    const globalIssues = {
      commaInIds: 0,
      customerNotFound: 0,
      customerMismatch: 0,
      missingFields: 0,
      invalidDates: 0
    };
    
    for (const soNumber of orderNumbers) {
      const orderRows = orderGroups.get(soNumber)!;
      const firstRow = orderRows[0];
      
      // Extract and sanitize key fields
      const rawAccountId = String(firstRow['Account id'] || '').trim();
      const rawSalesOrderId = String(firstRow['SO ID'] || '').trim();
      const rawSalesPerson = String(firstRow['Sales Rep'] || '').trim();
      const customerName = String(firstRow['Customer'] || firstRow['Billing Name'] || '').trim();
      const issuedDate = String(firstRow['Issued Date'] || firstRow['Issued date'] || '').trim();
      
      const sanitizedAccountId = sanitizeId(rawAccountId);
      const sanitizedSalesOrderId = sanitizeId(rawSalesOrderId);
      const normalizedSalesRep = normalizeSalesRep(rawSalesPerson);
      
      const issues: DataQualityIssue[] = [];
      
      // Check for comma in IDs
      if (rawAccountId !== sanitizedAccountId) {
        issues.push({
          type: 'comma_in_id',
          severity: 'warning',
          field: 'Account ID',
          value: rawAccountId,
          suggestion: sanitizedAccountId
        });
        globalIssues.commaInIds++;
      }
      
      // Validate customer exists
      if (!existingCustomers.has(sanitizedAccountId)) {
        issues.push({
          type: 'customer_not_found',
          severity: 'warning',
          field: 'Account ID',
          value: sanitizedAccountId,
          suggestion: 'New customer will be created'
        });
        globalIssues.customerNotFound++;
      } else {
        // Check if customer name matches
        const existingCustomer = existingCustomers.get(sanitizedAccountId);
        if (existingCustomer.name && existingCustomer.name !== customerName) {
          issues.push({
            type: 'customer_mismatch',
            severity: 'info',
            field: 'Customer Name',
            value: customerName,
            suggestion: `Database has: ${existingCustomer.name}`
          });
          globalIssues.customerMismatch++;
        }
      }
      
      // Validate date
      const dateValidation = normalizeDate(issuedDate);
      if (!dateValidation.valid) {
        issues.push({
          type: 'invalid_date',
          severity: 'error',
          field: 'Issued Date',
          value: issuedDate,
          suggestion: 'Unable to parse date'
        });
        globalIssues.invalidDates++;
      }
      
      // Check for missing required fields
      if (!rawSalesPerson) {
        issues.push({
          type: 'missing_field',
          severity: 'error',
          field: 'Sales Rep',
          value: '',
          suggestion: 'Required field is empty'
        });
        globalIssues.missingFields++;
      }
      
      // Calculate order revenue and sanitize line item IDs
      let totalRevenue = 0;
      const sanitizedLineItemIds: string[] = [];
      
      orderRows.forEach(row => {
        const rawSoItemId = String(row['SO Item ID'] || '').trim();
        const sanitizedSoItemId = sanitizeId(rawSoItemId);
        sanitizedLineItemIds.push(sanitizedSoItemId);
        
        if (rawSoItemId !== sanitizedSoItemId) {
          globalIssues.commaInIds++;
        }
        
        const totalPrice = parseFloat(String(row['Total Price'] || '0').replace(/[$,]/g, ''));
        if (!isNaN(totalPrice)) {
          totalRevenue += totalPrice;
        }
      });
      
      previewOrders.push({
        rowIndex: firstRow.rowIndex,
        soNumber,
        salesOrderId: sanitizedSalesOrderId,
        accountId: sanitizedAccountId,
        customerName,
        salesPerson: normalizedSalesRep,
        issuedDate: dateValidation.formatted || issuedDate,
        lineItemCount: orderRows.length,
        totalRevenue,
        issues,
        sanitizedData: {
          accountId: sanitizedAccountId,
          salesOrderId: sanitizedSalesOrderId,
          lineItemIds: sanitizedLineItemIds
        }
      });
    }
    
    // Calculate summary statistics
    const repRevenue = new Map<string, number>();
    const repOrderCount = new Map<string, number>();
    
    orderGroups.forEach((orderRows, soNumber) => {
      const rep = normalizeSalesRep(String(orderRows[0]['Sales Rep'] || 'Unknown').trim());
      let orderRevenue = 0;
      
      orderRows.forEach(row => {
        const totalPrice = parseFloat(String(row['Total Price'] || '0').replace(/[$,]/g, ''));
        if (!isNaN(totalPrice)) {
          orderRevenue += totalPrice;
        }
      });
      
      repRevenue.set(rep, (repRevenue.get(rep) || 0) + orderRevenue);
      repOrderCount.set(rep, (repOrderCount.get(rep) || 0) + 1);
    });
    
    const summaryByRep = Array.from(repRevenue.entries()).map(([rep, revenue]) => ({
      rep,
      orders: repOrderCount.get(rep) || 0,
      revenue,
      formatted: `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    })).sort((a, b) => b.revenue - a.revenue);
    
    return NextResponse.json({
      success: true,
      preview: {
        totalRows: rows.length,
        totalOrders: orderGroups.size,
        previewOrders,
        summaryByRep,
        globalIssues,
        readyToImport: globalIssues.invalidDates === 0 && globalIssues.missingFields === 0
      }
    });
    
  } catch (error: any) {
    console.error('Preview error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
