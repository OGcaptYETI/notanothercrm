import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import Papa from 'papaparse';
import { syncCustomersToSupabase } from '@/lib/services/firebase-to-supabase-sync';
import { Timestamp } from 'firebase-admin/firestore';
import { parse } from 'csv-parse/sync';
import { createHeaderMap, normalizeRow, validateRequiredHeaders } from '../normalize-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ImportStats {
  processed: number;
  customersNotFound: number;
  customersCreated: number;
  ordersCreated: number;
  ordersUpdated: number;
  ordersUnchanged: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  skipped: number;
}

function safeParseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

function sanitizeCustomerId(rawId: any): string | null {
  if (!rawId) return null;
  const sanitized = String(rawId)
    .replace(/,/g, '')  // Remove all commas
    .trim();
  if (!sanitized || sanitized === '') {
    return null;
  }
  return sanitized;
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  
  // Check if it's an Excel serial number (numeric or numeric string)
  let serialNumber = val;
  if (typeof val === 'string' && !isNaN(Number(val)) && Number(val) > 1000) {
    serialNumber = Number(val);
  }
  
  if (typeof serialNumber === 'number' && serialNumber > 1000) {
    // Convert Excel serial date to JavaScript Date
    // Excel dates are days since 1/1/1900
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch (Dec 30, 1899)
    const date = new Date(excelEpoch.getTime() + serialNumber * 86400000);
    
    // Validate it's a reasonable date
    if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
      return date;
    }
  }
  
  const dateStr = String(val).trim();
  
  // Handle Conversite format: MM-DD-YYYY HH:MM:SS or MM/DD/YYYY HH:MM
  const conversiteMatch = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (conversiteMatch) {
    const [, month, day, year, hour, minute, second] = conversiteMatch;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      second ? parseInt(second) : 0
    );
    
    const now = new Date();
    if (date.getFullYear() >= 2000 && date <= now) {
      return date;
    }
  }
  
  // Handle simple date format: MM-DD-YYYY or MM/DD/YYYY
  const simpleDateMatch = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (simpleDateMatch) {
    const [, month, day, year] = simpleDateMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const now = new Date();
    if (date.getFullYear() >= 2000 && date <= now) {
      return date;
    }
  }
  
  console.warn(`⚠️ Failed to parse date: "${val}"`);
  return null;
}

export async function POST(req: NextRequest) {
  try {
    console.log('\n🚀 IMPORT-UNIFIED: Direct single-request import');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log(`📦 Processing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Step 1: Normalize CSV to match hardcoded field expectations
    console.log('🔄 Step 1: Normalizing CSV headers...');
    const normalizeFormData = new FormData();
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
    const normalizeFile = new File([fileBlob], file.name, { type: file.type });
    normalizeFormData.append('file', normalizeFile);
    
    const normalizeUrl = new URL('/api/fishbowl/normalize-csv', req.url);
    const normalizeResponse = await fetch(normalizeUrl.toString(), {
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
    console.log(`📊 Parsed ${normalizationResult.normalizedData.length} rows from CSV\n`);

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
    let data = normalizationResult.normalizedData;
    
    // If custom mappings provided, re-map the data
    if (customMappings) {
      const csvText = await file.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const originalRows = parsed.data as any[];
      
      data = originalRows.map((row: any) => {
        const remappedRow: any = {};
        // Apply custom mappings: systemField -> csvColumn
        for (const [systemField, csvColumn] of Object.entries(customMappings!)) {
          if (csvColumn && row[csvColumn] !== undefined) {
            remappedRow[systemField] = row[csvColumn];
          }
        }
        return remappedRow;
      });
      
      console.log(`✅ Re-mapped ${data.length} rows with ${Object.keys(customMappings).length} custom field mappings`);
    }
    
    // Normalize headers to handle varying CSV formats
    const headers = data.length > 0 ? Object.keys(data[0] as Record<string, any>) : [];
    const headerMap = createHeaderMap(headers);

    // HARD FAIL: Validate the file matches our canonical schema
    const headerValidation = validateRequiredHeaders(headerMap);
    if (!headerValidation.valid) {
      const normalizedHeadersPresent = Array.from(new Set(headerMap.values())).sort();
      return NextResponse.json({
        error: `Missing required headers: ${headerValidation.missing.join(', ')}`,
        missing: headerValidation.missing,
        normalizedHeadersPresent,
        originalHeadersPresent: headers
      }, { status: 400 });
    }

    const normalizedData = data.map(row => normalizeRow(row, headerMap));
    
    // Debug: Show first row's column names and price values
    if (normalizedData.length > 0) {
      const firstRow = normalizedData[0] as Record<string, any>;
      console.log('\n🔍 DEBUG: First row column names containing "price":');
      Object.keys(firstRow).forEach(key => {
        if (key.toLowerCase().includes('price')) {
          console.log(`  "${key}": "${firstRow[key]}"`);
        }
      });
    }
    
    const stats: ImportStats = {
      processed: 0,
      customersNotFound: 0,
      customersCreated: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      ordersUnchanged: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsUnchanged: 0,
      skipped: 0
    };
    
    const BATCH_SIZE = 450;
    let batch = adminDb.batch();
    let batchCount = 0;
    const processedOrders = new Set<string>();
    const processedCustomers = new Set<string>();
    
    // Load existing Fishbowl customers (already populated by Copper Sync with account types)
    console.log('📋 Loading existing Fishbowl customers...');
    const fishbowlCustomersSnapshot = await adminDb.collection('fishbowl_customers').get();
    const fishbowlCustomersMap = new Map<string, any>();
    fishbowlCustomersSnapshot.forEach(doc => {
      const data = doc.data();
      // IMPORTANT: The authoritative customer ID is the Firestore document ID (sanitized)
      fishbowlCustomersMap.set(doc.id, data);
      // Also index by data.id if present (backward compatibility)
      if (data.id) {
        fishbowlCustomersMap.set(String(data.id), data);
      }
    });
    console.log(`✅ Loaded ${fishbowlCustomersMap.size} existing Fishbowl customers (from Copper Sync)`);
    
    // DEBUG: Log first 3 rows to verify normalization
    if (normalizedData.length > 0) {
      console.log('\n🔍 DEBUG: First normalized row keys:', Object.keys(normalizedData[0]));
      console.log('🔍 DEBUG: Sample values from first row:');
      const firstRow = normalizedData[0];
      console.log(`  Sales order Number: "${firstRow['Sales order Number']}"`);
      console.log(`  Sales Order ID: "${firstRow['Sales Order ID']}"`);
      console.log(`  SO Item ID: "${firstRow['SO Item ID']}"`);
      console.log(`  Account ID: "${firstRow['Account ID']}"`);
      console.log(`  Sales Rep: "${firstRow['Sales Rep']}"`);
    }
    
    for (let i = 0; i < normalizedData.length; i++) {
      const row = normalizedData[i] as Record<string, any>;
      stats.processed++;
      
      const soNum = String(row['Sales order Number'] ?? '').trim();
      const salesOrderId = row['Sales Order ID'];
      const lineItemId = row['SO Item ID'];
      const rawCustomerId = String(row['Account ID'] || '').trim();
      const customerId = sanitizeCustomerId(rawCustomerId);
      const customerName = String(row['Customer Name'] || row['Customer'] || '').trim();
      
      // CRITICAL: Skip rows with missing required fields
      if (!soNum || !salesOrderId || !lineItemId) {
        if (stats.skipped < 5) { // Log first 5 skipped rows
          console.warn(`⚠️ Skipping row ${i + 1} - missing fields:`);
          console.warn(`  soNum: "${soNum}" | salesOrderId: "${salesOrderId}" | lineItemId: "${lineItemId}"`);
          console.warn(`  Available keys:`, Object.keys(row).slice(0, 10));
        }
        stats.skipped++;
        continue;
      }
      
      // CRITICAL: Skip rows with empty customer IDs after sanitization
      if (!customerId) {
        console.warn(`⚠️ Skipping order ${soNum} - invalid customer ID: "${rawCustomerId}"`);
        stats.skipped++;
        continue;
      }
      
      // Get account type from existing Fishbowl customer (set by Copper Sync)
      const existingCustomer = fishbowlCustomersMap.get(customerId);
      const existingAccountType = existingCustomer?.accountType;
      // For downstream order/commission logic we still need an account type.
      // Default to Wholesale (most customers are wholesale) if missing.
      const accountType = existingAccountType || 'Wholesale';
      
      // CRITICAL: Parse salesPerson early so it's available for both orders AND line items
      const salesPersonValue = String(row['Sales Rep'] || '').trim();
      
      // Upsert customer with account type
      if (!processedCustomers.has(customerId)) {
        const customerRef = adminDb.collection('fishbowl_customers').doc(customerId);
        batch.set(customerRef, {
          id: customerId,
          name: customerName,
          accountType: accountType, // Always write accountType (defaults to Wholesale if not from Copper)
          updatedAt: Timestamp.now()
        }, { merge: true });
        batchCount++;
        stats.customersCreated++;
        processedCustomers.add(customerId);
      }
      
      // Process order (once per order)
      if (!processedOrders.has(soNum)) {
        // CRITICAL: Check if order has been manually corrected via validation
        const orderRef = adminDb.collection('fishbowl_sales_orders').doc(soNum);
        const existingOrderDoc = await orderRef.get();
        
        let preservedCustomerId = customerId;
        let preservedAccountType = accountType;
        let isManuallyLinked = false;
        
        if (existingOrderDoc.exists) {
          const existingData = existingOrderDoc.data();
          if (existingData?.manuallyLinked === true) {
            // Preserve only the customer linkage, but update everything else
            preservedCustomerId = existingData.customerId;
            preservedAccountType = existingData.accountType;
            isManuallyLinked = true;
            console.log(`🔒 Order ${soNum} - preserving manual customer linkage (${preservedCustomerId}), updating all other data`);
          }
        }
        
        let issuedDate = parseDate(row['Issued date']);
        let commissionMonth: string | undefined;
        let commissionYear: number | undefined;
        
        if (issuedDate && issuedDate.getFullYear() >= 2020) {
          commissionMonth = `${issuedDate.getFullYear()}-${String(issuedDate.getMonth() + 1).padStart(2, '0')}`;
          commissionYear = issuedDate.getFullYear();
        } else {
          const yearMonth = String(row['Year-month'] || '').trim();
          if (yearMonth) {
            const match = yearMonth.match(/(\w+)\s+(\d{4})/);
            if (match) {
              const monthName = match[1];
              const year = parseInt(match[2]);
              const monthMap: Record<string, number> = {
                'January': 1, 'February': 2, 'March': 3, 'April': 4,
                'May': 5, 'June': 6, 'July': 7, 'August': 8,
                'September': 9, 'October': 10, 'November': 11, 'December': 12
              };
              const month = monthMap[monthName];
              if (month && year) {
                commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
                commissionYear = year;
                issuedDate = new Date(year, month - 1, 1);
                console.log(`⚠️ Using Year-month fallback for order ${soNum}: ${yearMonth} -> ${commissionMonth}`);
              }
            }
          }
        }
        
        if (!commissionMonth || !commissionYear) {
          console.warn(`⚠️ Skipping order ${soNum} - no valid date (Issued: ${row['Issued date']}, Year-month: ${row['Year-month']})`);
          stats.skipped++;
          continue;
        }
        
        const postingDate = issuedDate ? Timestamp.fromDate(issuedDate) : null;
        const commissionDate = issuedDate ? Timestamp.fromDate(issuedDate) : null;
        
        // Debug first order to verify salesPerson is being read
        if (stats.ordersCreated === 0) {
          console.log('\n🔍 DEBUG: First order salesPerson:');
          console.log(`  CSV "Sales Rep": "${row['Sales Rep']}"`);
          console.log(`  Parsed salesPerson: "${salesPersonValue}"`);
          console.log(`  Order Number: ${soNum}`);
        }
        
        const orderData = {
          soNumber: soNum,
          salesOrderId: String(salesOrderId),
          customerId: preservedCustomerId, // Use preserved customer linkage if manually corrected
          customerName: customerName,
          accountType: preservedAccountType, // Use preserved account type if manually corrected
          salesPerson: salesPersonValue,
          salesRep: String(row['Sales Rep Initials'] || row['Sales man initials'] || '').trim(),
          postingDate: postingDate,
          commissionMonth: commissionMonth,
          commissionYear: commissionYear,
          commissionDate: commissionDate,
          manuallyLinked: isManuallyLinked, // Preserve the flag if it was set
          updatedAt: Timestamp.now()
        };
        
        batch.set(orderRef, orderData, { merge: true });
        batchCount++;
        stats.ordersCreated++;
        
        if (customerId && soNum) {
          const orderHistoryRef = adminDb
            .collection('fishbowl_customers')
            .doc(customerId)
            .collection('sales_order_history')
            .doc(soNum);
          
          batch.set(orderHistoryRef, {
            ...orderData,
            writtenAt: Timestamp.now()
          }, { merge: true });
          batchCount++;
          
          const customerSummaryRef = adminDb.collection('fishbowl_customers').doc(customerId);
          batch.set(customerSummaryRef, {
            lastOrderDate: postingDate,
            lastOrderNum: soNum,
            lastSalesPerson: String(row['Sales person'] || '').trim(),
            updatedAt: Timestamp.now()
          }, { merge: true });
          batchCount++;
        }
        
        processedOrders.add(soNum);
      }
      
      // Process line item with COMPOSITE KEY to avoid duplicates
      const itemId = `${salesOrderId}_${lineItemId}`;
      const itemRef = adminDb.collection('fishbowl_soitems').doc(itemId);
      
      let itemIssuedDate = parseDate(row['Issued date']);
      let itemCommissionMonth: string | undefined;
      let itemCommissionYear: number | undefined;
      
      if (itemIssuedDate && itemIssuedDate.getFullYear() >= 2020) {
        itemCommissionMonth = `${itemIssuedDate.getFullYear()}-${String(itemIssuedDate.getMonth() + 1).padStart(2, '0')}`;
        itemCommissionYear = itemIssuedDate.getFullYear();
      } else {
        const yearMonth = String(row['Year-month'] || '').trim();
        if (yearMonth) {
          const match = yearMonth.match(/(\w+)\s+(\d{4})/);
          if (match) {
            const monthName = match[1];
            const year = parseInt(match[2]);
            const monthMap: Record<string, number> = {
              'January': 1, 'February': 2, 'March': 3, 'April': 4,
              'May': 5, 'June': 6, 'July': 7, 'August': 8,
              'September': 9, 'October': 10, 'November': 11, 'December': 12
            };
            const month = monthMap[monthName];
            if (month && year) {
              itemCommissionMonth = `${year}-${String(month).padStart(2, '0')}`;
              itemCommissionYear = year;
              itemIssuedDate = new Date(year, month - 1, 1);
            }
          }
        }
      }
      
      if (!itemCommissionMonth || !itemCommissionYear) {
        console.warn(`⚠️ Skipping line item ${lineItemId} for order ${soNum} - no valid date`);
        stats.skipped++;
        continue;
      }
      
      const itemCommissionDate = itemIssuedDate ? Timestamp.fromDate(itemIssuedDate) : null;
      
      // CRITICAL: Default quantity to 1 if missing (v2 CSV has no qty column)
      // Commission calculation skips ALL orders with qty=0, so we must default
      let quantity = safeParseNumber(row['Qty fulfilled']);
      if (quantity === 0 && !row['Qty fulfilled']) {
        // Only default if field is truly missing (not explicitly 0)
        quantity = 1;
      }
      
      const unitPrice = safeParseNumber(row['Unit price']);
      let totalPrice = safeParseNumber(row['Total Price']);
      const totalCost = safeParseNumber(row['Total cost']);
      
      // CRITICAL: Always calculate totalPrice if it's 0 or missing
      // This ensures revenue calculations work even if CSV column names change
      if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
        totalPrice = unitPrice * quantity;
        if (stats.itemsCreated < 3) {
          console.log(`🔧 Calculated totalPrice: ${quantity} × $${unitPrice} = $${totalPrice}`);
        }
      }
      
      // Debug first 3 items to verify parsing
      if (stats.itemsCreated < 3) {
        console.log(`📊 Line Item ${stats.itemsCreated + 1}:`, {
          soNumber: soNum,
          product: String(row['SO Item Product Number'] || '').trim(),
          quantity: quantity,
          unitPriceRaw: row['Unit price'],
          unitPriceParsed: unitPrice,
          totalPriceRaw: row['Total Price'],
          totalPriceParsed: totalPrice,
          calculated: totalPrice === unitPrice * quantity
        });
      }
      
      // Line items should inherit salesPerson from their parent order
      // CSV rows often have empty Sales Rep on line items, but the order has it
      const lineItemSalesPerson = String(row['Sales Rep'] || row['Default Sales Rep'] || '').trim() || salesPersonValue;
      
      batch.set(itemRef, {
        soNumber: soNum,
        salesOrderId: String(salesOrderId),
        soItemId: lineItemId,
        customerId: customerId,
        customerName: customerName,
        product: String(row['SO Item Product Number'] || row['Sku'] || row['Product'] || '').trim(),
        productNum: String(row['SO Item Product Number'] || row['Sku'] || row['Product ID'] || '').trim(),
        partNumber: String(row['SO Item Product Number'] || row['Sku'] || row['Product ID'] || '').trim(),
        productName: String(row['Product Description'] || row['SO Item Description'] || row['Description'] || '').trim(),
        description: String(row['Product Description'] || row['SO Item Description'] || row['Description'] || '').trim(),
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        totalCost: totalCost,
        postingDate: itemIssuedDate ? Timestamp.fromDate(itemIssuedDate) : null,
        commissionMonth: itemCommissionMonth,
        commissionYear: itemCommissionYear,
        commissionDate: itemCommissionDate,
        salesPerson: lineItemSalesPerson, // Inherit from order if CSV row is empty
        updatedAt: Timestamp.now()
      }, { merge: true });
      batchCount++;
      stats.itemsCreated++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
        console.log(`✅ Committed batch (${stats.processed}/${data.length} rows processed)`);
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log('✅ Import-unified complete:', stats);
    
    // 🔄 AUTOMATIC SYNC: Sync customers to Supabase CRM
    console.log('🔄 Starting automatic Firebase → Supabase sync...');
    try {
      const syncResult = await syncCustomersToSupabase('kanva-botanicals');
      console.log(`✅ Sync complete: ${syncResult.summary}`);
      
      return NextResponse.json({
        success: true,
        stats,
        sync: {
          synced: syncResult.synced,
          failed: syncResult.failed,
          summary: syncResult.summary
        }
      });
    } catch (syncError: any) {
      console.error('⚠️ Sync failed but import succeeded:', syncError);
      
      // Import succeeded, but sync failed - still return success
      return NextResponse.json({
        success: true,
        stats,
        sync: {
          error: syncError.message,
          warning: 'Import succeeded but sync to Supabase failed. Run manual sync.'
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ Import-unified error:', error);
    return NextResponse.json({ 
      error: error.message || 'Import failed' 
    }, { status: 500 });
  }
}
