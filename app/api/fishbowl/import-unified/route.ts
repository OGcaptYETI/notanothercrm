import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Unified Fishbowl Import from Conversight Report - PRODUCTION READY
 * 
 * CUSTOMER CREATION STRATEGY:
 * - Creates NEW customers from Fishbowl if they don't exist (accountType='Retail' by default)
 * - Copper sync (Step 0) will enrich with correct accountType later
 * - Admin can manually fix accountType in Customers UI
 * - accountTypeSource='fishbowl' marks customers needing review
 * 
 * SMART SKIP OPTIMIZATION:
 * - Compares existing orders/items with new data before writing
 * - Skips Firestore writes if data is unchanged (saves 80-90% on re-imports)
 * - Perfect for weekly uploads of current month or historical re-imports
 * - Real-time progress feedback every 500 rows or 3 seconds
 * - Tracks: created, updated, unchanged (skipped)
 * 
 * RELIABILITY & ACCURACY IMPROVEMENTS:
 * - CustomerTypeCache uses existing customer accountType from Copper sync
 * - Robust date parsing (Excel serials, ISO, MM/DD/YYYY, MM-DD-YYYY)
 * - Safe number parsing (handles $, commas)
 * - Correct shipping/CC exclusion using SO Item Product Number
 * - Immutable ID deduplication (Sales Order ID, SO Item ID)
 * - Accurate created vs updated vs unchanged counts
 * - Shopify/Commerce flags for easy filtering
 * - Shipping/CC item flags for debug
 * - Header fallbacks for Conversight export variations
 * - Normalized Sales order Number handling
 */

// Helper: Safe number parser (handles $, commas, tolerant)
function toNumberSafe(v: any): number {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).replace(/[\$,]/g, '').trim();
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// Helper: Parse Excel serial dates, ISO dates, and common US formats
function parseExcelOrTextDate(raw: any): { date?: Date; monthKey?: string; y?: number } {
  if (!raw && raw !== 0) return {};
  try {
    if (typeof raw === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + raw * 86400000);
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
    const s = String(raw).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { // ISO YYYY-MM-DD
      const [Y, M, D] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) { // MM/DD/YYYY or M/D/YY
      const [M, D, Yraw] = s.split('/').map((t) => t.trim());
      const Y = Number(Yraw.length === 2 ? (Number(Yraw) + 2000) : Yraw);
      const d = new Date(Y, Number(M) - 1, Number(D));
      return { date: d, monthKey: `${Y}-${String(Number(M)).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) { // MM-DD-YYYY
      const [M, D, Y] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
  } catch {}
  return {};
}

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

// Helper: Compare two objects to see if key fields changed (skip updatedAt, importedAt)
function hasSignificantChanges(existing: any, newData: any): boolean {
  if (!existing) return true; // New record
  
  // List of fields to compare (ignore timestamps and metadata)
  const fieldsToCompare = Object.keys(newData).filter(
    key => !['updatedAt', 'importedAt', 'id'].includes(key)
  );
  
  for (const key of fieldsToCompare) {
    const existingVal = existing[key];
    const newVal = newData[key];
    
    // Handle null/undefined/empty string as equivalent
    const existingNormalized = (existingVal == null || existingVal === '') ? null : existingVal;
    const newNormalized = (newVal == null || newVal === '') ? null : newVal;
    
    // For Timestamps, compare seconds
    if (existingVal?._seconds !== undefined && newVal?._seconds !== undefined) {
      if (existingVal._seconds !== newVal._seconds) return true;
      continue;
    }
    
    // For numbers, compare with small tolerance for floating point
    if (typeof existingVal === 'number' && typeof newVal === 'number') {
      if (Math.abs(existingVal - newVal) > 0.01) return true;
      continue;
    }
    
    // Standard comparison
    if (existingNormalized !== newNormalized) {
      return true;
    }
  }
  
  return false; // No significant changes
}

// Load only active Copper companies for accountType enrichment
// Maps by Account Order ID (Fishbowl's accountNumber)
async function loadActiveCopperCompanies() {
  const fieldActive = 'Active Customer cf_712751';
  const fieldType   = 'Account Type cf_675914';
  const fieldAccountOrderId = 'Account Order ID cf_698467'; // This matches Fishbowl accountNumber

  // We can't OR across different value types in a single Firestore query,
  // so run a few highly selective queries in parallel and merge.
  const queries = [
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', 'checked')
      .select(fieldAccountOrderId, fieldType, fieldActive),
    // Optional fallbacks if some records were stored as booleans/strings:
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', true)
      .select(fieldAccountOrderId, fieldType, fieldActive),
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', 'true')
      .select(fieldAccountOrderId, fieldType, fieldActive),
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', 'Checked')
      .select(fieldAccountOrderId, fieldType, fieldActive),
  ];

  const results = await Promise.allSettled(queries.map(q => q.get()));

  const copperByAccountNumber = new Map<string, { accountType?: string }>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    r.value.forEach(doc => {
      const d = doc.data() || {};
      const accountOrderId = d[fieldAccountOrderId];
      if (accountOrderId == null) return;

      const accountNumberKey = String(accountOrderId);
      const accountType = (d[fieldType] ?? '') as string | undefined;

      // Last write wins; they should all agree anyway.
      copperByAccountNumber.set(accountNumberKey, { accountType });
    });
  }

  console.log(`🔗 Loaded ${copperByAccountNumber.size} ACTIVE Copper companies (by Account Order ID)`);
  return copperByAccountNumber;
}

async function importUnifiedReport(buffer: Buffer, filename: string): Promise<ImportStats> {
  console.log('📥 Importing Unified Fishbowl Report from Conversight...');
  
  // Parse file
  console.log('📄 Parsing file...');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} rows to process`);
  
  if (data.length === 0) {
    throw new Error('No data found in file');
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
  
  // Track customers that don't exist in our system (need to be added to Copper first)
  const missingCustomers = new Set<string>();
  
  // Preload ACTIVE Copper companies (keyed by Account Order ID == accountNumber in Fishbowl)
  console.log('🔗 Loading ACTIVE Copper companies for accountType enrichment...');
  const copperByAccountNumber = await loadActiveCopperCompanies();
  
  // Track processed entities (in-import dedupe)
  const processedCustomers = new Set<string>();
  const processedOrders = new Set<string>();
  
  // Cache final customer accountType for consistent order/item writes
  const customerTypeCache = new Map<string, { type: string; source: 'override'|'existing'|'copper'|'fishbowl' }>();
  
  // PRE-FETCH all existing customers, orders, and line items in bulk to avoid timeout
  console.log('📦 Pre-fetching existing customers, orders, and line items...');
  const [existingCustomersSnap, existingOrdersSnap, existingItemsSnap] = await Promise.all([
    adminDb.collection('fishbowl_customers').get(),
    adminDb.collection('fishbowl_sales_orders').get(),
    adminDb.collection('fishbowl_soitems').get()
  ]);
  
  const existingCustomersMap = new Map<string, any>();
  existingCustomersSnap.forEach(doc => {
    existingCustomersMap.set(doc.id, doc.data());
  });
  
  const existingOrdersMap = new Map<string, any>();
  existingOrdersSnap.forEach(doc => {
    existingOrdersMap.set(doc.id, doc.data());
  });
  
  const existingItemsMap = new Map<string, any>();
  existingItemsSnap.forEach(doc => {
    existingItemsMap.set(doc.id, doc.data());
  });
  
  console.log(`✅ Found ${existingCustomersMap.size} existing customers, ${existingOrdersMap.size} existing orders, ${existingItemsMap.size} existing line items`);
  
  // FIRST PASS: Aggregate order totals from line items
  console.log('🔄 First pass: Aggregating order totals with precise decimal math...');
  const orderTotals = new Map<string, { revenue: Decimal; orderValue: Decimal; lineCount: number }>();
  
  for (const row of data) {
    // Normalize Sales order Number
    const salesOrderNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    if (!salesOrderNum) continue;

    // Exclude shipping and CC processing using correct columns
    const labelLower = String(
      row['SO Item Product Number'] ?? row['Part Description'] ?? ''
    ).toLowerCase();

    const isShipping = labelLower.includes('shipping');
    const isCC = labelLower.includes('cc processing') || labelLower.includes('credit card processing');
    
    if (isShipping || isCC) continue;

    // Add header fallbacks
    const revenue = new Decimal(toNumberSafe(row['Total Price'] ?? row['Total price'] ?? row['Revenue'] ?? row['Fulfilled revenue']));
    const orderValue = new Decimal(toNumberSafe(row['Total Price'] ?? row['Total price'] ?? row['Order value'] ?? row['Fulfilled revenue']));

    if (!orderTotals.has(salesOrderNum)) {
      orderTotals.set(salesOrderNum, { revenue: new Decimal(0), orderValue: new Decimal(0), lineCount: 0 });
    }
    const t = orderTotals.get(salesOrderNum)!;
    t.revenue = t.revenue.plus(revenue);
    t.orderValue = t.orderValue.plus(orderValue);
    t.lineCount++;
  }
  
  console.log(`✅ Aggregated ${orderTotals.size} unique orders from ${data.length} line items`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 400;
  
  // SECOND PASS: Process each row (customer, order, line item)
  console.log(`\n🔄 Processing ${data.length} rows...\n`);
  let lastLogTime = Date.now();
  
  for (const row of data) {
    stats.processed++;
    
    // Real-time progress feedback every 500 rows OR every 3 seconds
    const now = Date.now();
    if (stats.processed % 500 === 0 || (now - lastLogTime) > 3000) {
      const pct = ((stats.processed / data.length) * 100).toFixed(1);
      console.log(`📊 Progress: ${stats.processed}/${data.length} (${pct}%) | Orders: ${stats.ordersCreated}C/${stats.ordersUpdated}U/${stats.ordersUnchanged}S | Items: ${stats.itemsCreated}C/${stats.itemsUpdated}U/${stats.itemsUnchanged}S`);
      lastLogTime = now;
    }
    
    const customerId = row['Customer id'] || row['Account ID'];
    const salesOrderNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    const salesOrderId = row['Sales Order ID'] || row['BOL'] || row['SO ID'];
    const lineItemId = row['SO Item ID'] || row['SO item ID'] || row['SO Item Id'] || row['SO item id'];
    
    // Skip if missing critical data
    if (!customerId || !salesOrderNum || !salesOrderId || !lineItemId) {
      stats.skipped++;
      continue;
    }
    
    // === 1. CREATE/UPDATE CUSTOMER ===
    // Strategy: Create if missing, preserve accountType if from Copper
    if (!processedCustomers.has(String(customerId))) {
      const customerDocId = String(customerId).replace(/[/\\]/g, '_').trim();
      const customerRef = adminDb.collection('fishbowl_customers').doc(customerDocId);
      const existingData = existingCustomersMap.get(customerDocId) || null;

      if (!existingData) {
        // CREATE NEW CUSTOMER from Fishbowl data
        const customerName = row['Customer Name'] || row['Customer'] || 'Unknown';
        // FIXED: Use "Sales Rep" (current account owner), NOT "Sales person" (originator)
        const currentAccountOwner = row['Sales Rep'] || row['Default Sales Rep'] || '';
        const accountNumber = row['Account Order ID'] || row['Account order ID'] || '';
        const accountId = row['Account ID'] || '';
        
        console.log(`🆕 Creating NEW customer: ${customerName} (ID: ${customerDocId}) - Owner: ${currentAccountOwner}`);
        
        const newCustomerData = {
          id: customerDocId,
          customerId: String(customerId),
          name: customerName,
          customerName: customerName,
          accountNumber: accountNumber,
          accountId: accountId,
          accountType: 'Retail', // Default - will be corrected by Copper sync or admin
          accountTypeSource: 'fishbowl',
          // CUSTOMER OWNERSHIP - Use current account owner (Sales Rep), not originator
          currentOwner: currentAccountOwner,           // NEW: Current account owner
          salesRep: currentAccountOwner,               // Current account owner (legacy)
          salesPerson: currentAccountOwner,            // Display field (legacy compatibility)
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          source: 'fishbowl_import',
          needsReview: true, // Flag for admin review
        };
        
        batch.set(customerRef, newCustomerData);
        batchCount++;
        stats.customersCreated = (stats.customersCreated || 0) + 1;
        
        // Cache for this import
        customerTypeCache.set(String(customerId), { type: 'Retail', source: 'fishbowl' });
      } else {
        // Customer exists - cache their account type (preserve Copper data)
        const finalAccountType = existingData.accountType || 'Retail';
        const accountTypeSource = existingData.accountTypeSource || 'existing';
        
        customerTypeCache.set(String(customerId), { 
          type: finalAccountType, 
          source: accountTypeSource as 'override'|'existing'|'copper'|'fishbowl'
        });
        
        // DO NOT update existing customers - preserve Copper sync data
      }
      
      processedCustomers.add(String(customerId));
    }
    
    // === 2. CREATE/UPDATE SALES ORDER ===
    // Dedupe by immutable Fishbowl Sales Order ID
    if (!processedOrders.has(String(salesOrderId))) {
      const orderDocId = String(salesOrderId).replace(/[\/\\]/g, '_');
      const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderDocId);

      const sanitizedCustomerId = String(customerId).replace(/[\/\\]/g, '_').trim();

      // Use ONLY 'Issued date' field - this is when the order was issued/closed in Fishbowl
      // and sent to QuickBooks. This is the authoritative date for commission calculations.
      const rawDate = row['Issued date'];
      
      // Debug: Log the raw date value and available columns
      if (!rawDate) {
        console.warn(`⚠️  Order ${row['Sales order Number']} missing 'Issued date'`);
        console.warn(`   Available columns:`, Object.keys(row).filter(k => k.toLowerCase().includes('date')));
        console.warn(`   Skipping order...`);
        continue;
      }
      
      console.log(`📅 Processing order ${row['Sales order Number']}: rawDate="${rawDate}" (type: ${typeof rawDate})`);

      const { date: postDate, monthKey, y } = parseExcelOrTextDate(rawDate);
      
      if (!postDate) {
        console.error(`❌ Failed to parse date for order ${row['Sales order Number']}: rawDate="${rawDate}"`);
        continue;
      }
      
      console.log(`   ✅ Parsed: ${postDate.toISOString().split('T')[0]} → ${monthKey}`);
      const postingDate = postDate ? Timestamp.fromDate(postDate) : null;
      const postingDateStr = postDate
        ? `${String(postDate.getMonth() + 1).padStart(2, '0')}/${String(postDate.getDate()).padStart(2, '0')}/${postDate.getFullYear()}` 
        : '';
      const commissionMonth = monthKey ?? '';
      const commissionYear = y ?? 0;

      const soNumStr = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
      const totals = orderTotals.get(soNumStr);
      const revenue = totals ? totals.revenue.toNumber() : 0;
      const orderValue = totals ? totals.orderValue.toNumber() : 0;
      const lineCount = totals ? totals.lineCount : 0;

      // Shopify/Commerce detection
      const sp = String(row['Sales person'] || '').toLowerCase();
      const isShopify = soNumStr.startsWith('Sh') || sp === 'commerce' || sp === 'shopify';
      const shopPlatform = isShopify ? (sp.includes('commerce') ? 'commerce' : 'shopify') : '';

      // Get accountType from cache (consistent with customer)
      const cachedType = customerTypeCache.get(String(customerId));
      const accountNum2 = row['Account ID'];
      const orderAccountType = cachedType?.type ?? (copperByAccountNumber.get(String(accountNum2))?.accountType?.trim() || row['Account type'] || '');
      const orderAccountTypeSource = cachedType?.source ?? (copperByAccountNumber.get(String(accountNum2))?.accountType ? 'copper' : 'fishbowl');

      const orderData: any = {
        id: orderDocId,
        num: soNumStr,
        fishbowlNum: soNumStr,
        salesOrderId: String(salesOrderId),
        customerId: sanitizedCustomerId,
        customerName: row['Customer Name'] || row['Customer'] || '',

        salesPerson: row['Sales person'] || '',
        salesRep: row['Sales Rep'] || '',
        salesRepInitials: row['Sales Rep Initials'] || '',

        postingDate,
        postingDateStr,
        commissionDate: postingDate,
        commissionMonth,
        commissionYear,

        revenue,
        orderValue,
        lineItemCount: lineCount,

        isShopify,
        shopPlatform,
        accountType: orderAccountType,
        accountTypeSource: orderAccountTypeSource,

        updatedAt: Timestamp.now(),
        source: 'fishbowl_unified',
      };
      
      const existingOrder = existingOrdersMap.get(orderDocId);
      let orderWasWritten = false;
      if (existingOrder) {
        // Check if data actually changed
        if (hasSignificantChanges(existingOrder, orderData)) {
          batch.update(orderRef, orderData);
          stats.ordersUpdated++;
          batchCount++;
          orderWasWritten = true;
        } else {
          stats.ordersUnchanged++;
          // Skip write - no changes detected
        }
      } else {
        batch.set(orderRef, orderData);
        stats.ordersCreated++;
        batchCount++;
        orderWasWritten = true;
      }
      
      // ALWAYS write to customer's order history subcollection
      // (even if flat collection is unchanged - allows subcollection structure updates)
      // Use sales order number (5799, 9082, etc.) as document ID for readability
      if (sanitizedCustomerId && soNumStr) {
        const orderHistoryRef = adminDb
          .collection('fishbowl_customers')
          .doc(sanitizedCustomerId)
          .collection('sales_order_history')
          .doc(soNumStr);
        
        batch.set(orderHistoryRef, {
          ...orderData,
          writtenAt: Timestamp.now()
        }, { merge: true });
        batchCount++;
        
        // Update customer summary fields (first/last order date)
        const customerSummaryRef = adminDb.collection('fishbowl_customers').doc(sanitizedCustomerId);
        batch.set(customerSummaryRef, {
          lastOrderDate: postingDate,
          lastOrderNum: soNumStr,
          lastSalesPerson: row['Sales person'] || '',
          updatedAt: Timestamp.now()
        }, { merge: true });
        batchCount++;
      }

      processedOrders.add(String(salesOrderId));
    }
    
    // === 3. CREATE LINE ITEM ===
    // Note: We use set() which will overwrite if exists - this is correct for imports
    const itemDocId = `soitem_${String(lineItemId).replace(/[\/\\]/g,'_')}`;
    const itemRef = adminDb.collection('fishbowl_soitems').doc(itemDocId);

    const sanitizedCustomerId2 = String(customerId).replace(/[\/\\]/g, '_').trim();

    // Use ONLY 'Issued date' field for line items (same as orders)
    const rawDate2 = row['Issued date'];
    
    if (!rawDate2) {
      console.warn(`⚠️  Line item ${lineItemId} missing 'Issued date' - skipping`);
      continue;
    }

    const { date: postDate2, monthKey: monthKey2, y: y2 } = parseExcelOrTextDate(rawDate2);
    
    if (!postDate2) {
      console.error(`❌ Failed to parse date for line item ${lineItemId}: rawDate="${rawDate2}"`);
      continue;
    }
    const postingDate2 = postDate2 ? Timestamp.fromDate(postDate2) : null;
    const postingDateStr2 = postDate2
      ? `${String(postDate2.getMonth() + 1).padStart(2, '0')}/${String(postDate2.getDate()).padStart(2, '0')}/${postDate2.getFullYear()}` 
      : '';
    const commissionMonth2 = monthKey2 ?? '';
    const commissionYear2 = y2 ?? 0;

    const soNumStr2 = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    const sp2 = String(row['Sales person'] || '').toLowerCase();
    const isShopify2 = soNumStr2.startsWith('Sh') || sp2 === 'commerce' || sp2 === 'shopify';
    const shopPlatform2 = isShopify2 ? (sp2.includes('commerce') ? 'commerce' : 'shopify') : '';

    // Get accountType from cache (consistent with customer)
    const cachedType2 = customerTypeCache.get(String(customerId));
    const itemAccountType = cachedType2?.type ?? (copperByAccountNumber.get(String(customerId))?.accountType?.trim() || (row['Account Type'] ?? row['Account type'] ?? ''));
    const itemAccountTypeSource = cachedType2?.source ?? (copperByAccountNumber.get(String(customerId))?.accountType ? 'copper' : 'fishbowl');

    // Mark shipping/CC items
    const labelLower2 = String(row['SO Item Product Number'] ?? row['Part Description'] ?? row['Sales Order Item Description'] ?? '').toLowerCase();
    const isShippingItem = labelLower2.includes('shipping');
    const isCCItem = labelLower2.includes('cc processing') || labelLower2.includes('credit card processing');

    const itemData: any = {
      id: itemDocId,
      salesOrderId: String(salesOrderId),
      salesOrderNum: soNumStr2,
      soId: String(salesOrderId).replace(/[\/\\]/g, '_'),

      customerId: sanitizedCustomerId2,
      customerName: row['Customer Name'] || row['Customer'] || '',
      accountNumber: '', // Will be filled by Copper sync (Conversight doesn't export Account Order ID)
      accountId: row['Account ID'] || '',
      accountType: itemAccountType,
      accountTypeSource: itemAccountTypeSource,

      salesPerson: row['Sales person'] || row['Sales Rep'] || row['Default Sales Rep'] || row['Sales man initials'] || '',
      salesRep: row['Sales Rep'] || row['Default Sales Rep'] || '',
      salesRepInitials: row['Sales Rep Initials'] || '',

      postingDate: postingDate2,
      postingDateStr: postingDateStr2,
      commissionDate: postingDate2,
      commissionMonth: commissionMonth2,
      commissionYear: commissionYear2,

      lineItemId: String(lineItemId),

      partNumber: row['SO Item Product Number'] || row['Part Number'] || '',
      partId: row['Part id'] || '',
      partDescription: row['Part Description'] || '',
      product: row['Product'] || '',
      productId: row['Product ID'] || '',
      productNum: row['SO Item Product Number'] || row['Part Number'] || '',
      productShortNumber: row['Product Short Number'] || '',
      productDescription: row['Part Description'] || row['Product description'] || '',
      description: row['Sales Order Item Description'] || '',
      itemType: row['Sales Order Item Type'] || '',

      uomCode: row['UOM Code'] || '',
      uomName: row['UOM Name'] || '',

      shippingCity: row['Shipping City'] || row['Billing City'] || '',
      shippingState: row['Shipping State'] || row['Billing State'] || '',

      // Billing fields from Conversight (for RepRally customer extraction)
      billingName: row['Billing Name'] || '',
      billingAddress: row['Billing Address'] || '',
      billingCity: row['Billing City'] || '',
      billingState: row['Billing State'] || '',
      billingZip: row['Billing Zip'] || '',

      revenue: toNumberSafe(row['Total Price'] ?? row['Total price'] ?? row['Revenue']),
      totalPrice: toNumberSafe(row['Total Price'] ?? row['Total price']),
      unitPrice: toNumberSafe(row['UNIT PRICE'] ?? row['Unit price'] ?? row['Unit Price']),
      totalCost: toNumberSafe(row['Total cost']),
      quantity: toNumberSafe(row['Qty fulfilled'] ?? row['Shipped Quantity']),
      qtyFulfilled: toNumberSafe(row['Qty fulfilled']),

      isShopify: isShopify2,
      shopPlatform: shopPlatform2,
      isShippingItem,
      isCCProcessingItem: isCCItem,

      importedAt: Timestamp.now(),
      source: 'fishbowl_unified',
    };

    // Smart comparison - only write if changed
    const existingItem = existingItemsMap.get(itemDocId);
    if (existingItem) {
      // Check if data actually changed
      if (hasSignificantChanges(existingItem, itemData)) {
        batch.update(itemRef, itemData);
        stats.itemsUpdated++;
        batchCount++;
      } else {
        stats.itemsUnchanged++;
        // Skip write - no changes detected
      }
    } else {
      batch.set(itemRef, itemData);
      stats.itemsCreated++;
      batchCount++;
    }

    // Commit chunk
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit().catch(e => console.error('❌ Batch commit failed:', e?.message || e));
      console.log(`✅ Committed batch of ${batchCount} operations`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Final commit
  if (batchCount > 0) {
    await batch.commit().catch(e => console.error('❌ Final batch commit failed:', e?.message || e));
    console.log(`✅ Committed final batch of ${batchCount} operations`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ IMPORT COMPLETE!');
  console.log('='.repeat(80));
  console.log(`   Rows Processed:        ${stats.processed.toLocaleString()}`);
  console.log(`   Rows Skipped:          ${stats.skipped.toLocaleString()}`);
  console.log(`   Customers Not Found:   ${stats.customersNotFound.toLocaleString()} ${stats.customersNotFound > 0 ? '⚠️  (add to Copper first)' : ''}`);
  console.log('');
  console.log('   📦 SALES ORDERS:');
  console.log(`      Created:    ${stats.ordersCreated.toLocaleString()}`);
  console.log(`      Updated:    ${stats.ordersUpdated.toLocaleString()}`);
  console.log(`      Unchanged:  ${stats.ordersUnchanged.toLocaleString()} ⚡ (skipped)`);
  console.log('');
  console.log('   📋 LINE ITEMS:');
  console.log(`      Created:    ${stats.itemsCreated.toLocaleString()}`);
  console.log(`      Updated:    ${stats.itemsUpdated.toLocaleString()}`);
  console.log(`      Unchanged:  ${stats.itemsUnchanged.toLocaleString()} ⚡ (skipped)`);
  console.log('');
  const totalWrites = stats.ordersCreated + stats.ordersUpdated + stats.itemsCreated + stats.itemsUpdated;
  const totalSkipped = stats.ordersUnchanged + stats.itemsUnchanged;
  const skipPercentage = totalWrites + totalSkipped > 0 ? ((totalSkipped / (totalWrites + totalSkipped)) * 100).toFixed(1) : '0.0';
  console.log(`   💾 Firestore Writes:   ${totalWrites.toLocaleString()} (saved ${totalSkipped.toLocaleString()} writes - ${skipPercentage}% reduction)`);
  console.log('='.repeat(80));
  
  return stats;
}

/**
 * POST /api/fishbowl/import-unified
 * Upload and import unified Fishbowl report
 */
export async function POST(request: NextRequest) {
  const startTime = new Date();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const fileSizeMB = file.size / 1024 / 1024;
    console.log(`\n📦 Starting import: ${file.name} (${fileSizeMB.toFixed(2)} MB)`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const stats = await importUnifiedReport(buffer, file.name);
    
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    
    // Calculate date range from imported orders
    console.log('\n📅 Calculating date range from imported orders...');
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .orderBy('postingDate', 'asc')
      .limit(1)
      .get();
    const latestOrdersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .orderBy('postingDate', 'desc')
      .limit(1)
      .get();
    
    let dateRange = null;
    if (!ordersSnapshot.empty && !latestOrdersSnapshot.empty) {
      const earliestOrder = ordersSnapshot.docs[0].data();
      const latestOrder = latestOrdersSnapshot.docs[0].data();
      dateRange = {
        earliest: earliestOrder.postingDateStr || 'Unknown',
        latest: latestOrder.postingDateStr || 'Unknown',
        earliestTimestamp: earliestOrder.postingDate,
        latestTimestamp: latestOrder.postingDate,
      };
      console.log(`   Date range: ${dateRange.earliest} → ${dateRange.latest}`);
    }
    
    // Save import log
    console.log('\n💾 Saving import log...');
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fishbowl/save-import-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stats,
        filename: file.name,
        fileSizeMB,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        dateRange,
      }),
    }).catch(err => console.error('Failed to save import log:', err));
    
    console.log(`\n⏱️  Import completed in ${duration.toFixed(1)}s (${Math.floor(stats.processed / duration)} rows/sec)\n`);
    
    // Trigger customer sales summary update in background
    console.log('🔄 Triggering customer sales summary update...');
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/migrate-customer-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(async (res) => {
      const result = await res.json();
      if (result.success) {
        console.log(`✅ Customer summary updated: ${result.summariesCreated} summaries`);
      } else {
        console.error('⚠️ Customer summary update failed:', result.error);
      }
    }).catch(err => {
      console.error('⚠️ Failed to trigger customer summary update:', err);
    });
    
    return NextResponse.json({
      success: true,
      complete: true,
      message: 'Unified import completed successfully',
      stats,
      dateRange,
      performance: {
        duration,
        rowsPerSecond: Math.floor(stats.processed / duration),
      },
    });
    
  } catch (error: any) {
    console.error('Error importing unified report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import unified report' },
      { status: 500 }
    );
  }
}
