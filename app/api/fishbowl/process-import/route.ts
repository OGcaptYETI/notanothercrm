import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import { createHeaderMap, normalizeRow, validateRequiredHeaders } from '../normalize-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

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

// Safe number parsing
function safeParseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

// Parse dates from various formats
function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  
  // Handle Excel serial date numbers
  // Excel stores dates as days since Jan 1, 1900
  // Unix epoch is Jan 1, 1970 = Excel serial 25569
  if (typeof val === 'number' && val > 0 && val < 100000) {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= new Date().getUTCFullYear() + 1) {
      return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
  }
  
  // Convert to string for parsing
  const dateStr = String(val).trim();
  
  // Handle Conversite format: MM-DD-YYYY HH:MM:SS or MM/DD/YYYY HH:MM
  // Examples: "12-29-2025 20:37:35" or "12/29/2025 20:37"
  const conversiteMatch = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (conversiteMatch) {
    const [, month, day, year, hour, minute, second] = conversiteMatch;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      second ? parseInt(second) : 0
    );
    
    // Validate the date is reasonable (not in the future, not before 2000)
    const now = new Date();
    if (date.getFullYear() >= 2000 && date <= now) {
      return date;
    }
  }
  
  // Fallback to standard Date parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    // Validate the date is reasonable
    const now = new Date();
    if (parsed.getFullYear() >= 2000 && parsed <= now) {
      return parsed;
    }
  }
  
  console.warn(`⚠️ Failed to parse date: "${val}"`);
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { importId } = await req.json();
    
    if (!importId) {
      return NextResponse.json({ error: 'importId is required' }, { status: 400 });
    }
    
    console.log(`📥 Starting processing for import: ${importId}`);
    
    // Get the pending import
    const pendingDoc = await adminDb.collection('import_pending').doc(importId).get();
    
    if (!pendingDoc.exists) {
      return NextResponse.json({ error: 'Import not found or already processed' }, { status: 404 });
    }
    
    const pendingData = pendingDoc.data();
    if (!pendingData?.fileId) {
      return NextResponse.json({ error: 'No file reference found' }, { status: 400 });
    }
    
    const fileId = pendingData.fileId;
    const totalChunks = pendingData.totalChunks || 0;
    const filename = pendingData.filename || 'unknown.csv';
    
    console.log(`📦 Loading ${totalChunks} chunks for fileId: ${fileId}`);
    
    // Load all chunks from Firestore
    const chunksSnap = await adminDb.collection('import_chunks')
      .where('fileId', '==', fileId)
      .get();
    
    if (chunksSnap.empty) {
      return NextResponse.json({ error: 'No chunks found' }, { status: 404 });
    }
    
    // Reassemble buffer from chunks
    const chunkData: string[] = new Array(totalChunks);
    chunksSnap.forEach(doc => {
      const data = doc.data();
      chunkData[data.chunkIndex] = data.data;
    });
    
    const buffers = chunkData.map(b64 => Buffer.from(b64, 'base64'));
    const buffer = Buffer.concat(buffers);
    
    console.log(`📄 Reassembled file: ${buffer.length} bytes from ${chunksSnap.size} chunks`);
    
    // Clean up chunks
    const cleanupBatch = adminDb.batch();
    chunksSnap.forEach(doc => cleanupBatch.delete(doc.ref));
    await cleanupBatch.commit();
    console.log('🗑️ Cleaned up chunks');
    
    console.log(`📄 Processing file: ${filename} (${buffer.length} bytes)`);
    
    // Parse file first to get row count
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
    
    console.log(`✅ Found ${rawData.length} rows to process`);
    
    // Update status to processing with total rows
    const progressRef = adminDb.collection('import_progress').doc(importId);
    
    // Create header mapping from CSV headers
    const csvHeaders = rawData.length > 0 ? Object.keys(rawData[0]) : [];
    const headerMap = createHeaderMap(csvHeaders);
    
    // Validate required headers are present
    const validation = validateRequiredHeaders(headerMap);
    if (!validation.valid) {
      console.error('❌ Missing required headers:', validation.missing);
      await progressRef.update({
        status: 'error',
        error: `Missing required headers: ${validation.missing.join(', ')}`,
        updatedAt: Timestamp.now()
      });
      return NextResponse.json({
        error: `Missing required headers: ${validation.missing.join(', ')}`,
        missing: validation.missing
      }, { status: 400 });
    }
    
    // Normalize all rows using the header map
    const data = rawData.map(row => normalizeRow(row, headerMap));
    await progressRef.update({
      status: 'processing',
      totalRows: data.length,
      updatedAt: Timestamp.now()
    });
    
    // Return immediately - client will poll for progress
    // Processing continues in background (best effort on serverless)
    const responsePromise = NextResponse.json({
      success: true,
      importId: importId,
      message: 'Processing started - poll /api/fishbowl/import-progress for status',
      totalRows: data.length,
      polling: true
    });
    
    // Start processing in parallel (fire and forget)
    processDataInBackground(data, importId, pendingDoc.ref, progressRef).catch(err => {
      console.error('Background processing error:', err);
      progressRef.update({
        status: 'error',
        error: err.message || 'Processing failed',
        updatedAt: Timestamp.now()
      }).catch(() => {});
    });
    
    return responsePromise;
    
  } catch (error: any) {
    console.error('❌ Processing error:', error);
    return NextResponse.json({ 
      error: error.message || 'Processing failed' 
    }, { status: 500 });
  }
}

// Background processing function
async function processDataInBackground(
  data: Record<string, any>[],
  importId: string,
  pendingDocRef: FirebaseFirestore.DocumentReference,
  progressRef: FirebaseFirestore.DocumentReference
) {
  console.log(`📦 Starting background processing of ${data.length} rows...`);
  
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
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    stats.processed++;
    
    // Extract fields - using Conversite export column names
    const soNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    const salesOrderId = row['Sales Order ID'] || row['SO ID'];
    const lineItemId = row['SO Item ID'] || row['SO item ID'];
    const customerId = String(row['Account ID'] || row['Account id'] || row['Customer id'] || '').trim();
    const customerName = String(row['Customer Name'] || row['Customer'] || '').trim();
    
    if (!soNum || !customerId || !salesOrderId || !lineItemId) {
      stats.skipped++;
      continue;
    }
    
    // Upsert customer (once per customer in this batch)
    if (!processedCustomers.has(customerId)) {
      const customerRef = adminDb.collection('fishbowl_customers').doc(customerId);
      batch.set(customerRef, {
        id: customerId,
        name: customerName,
        updatedAt: Timestamp.now()
      }, { merge: true });
      batchCount++;
      stats.customersCreated++;
      processedCustomers.add(customerId);
    }
    
    // Upsert order (once per SO)
    if (!processedOrders.has(soNum)) {
      const orderRef = adminDb.collection('fishbowl_sales_orders').doc(soNum);
      
      // Parse 'Issued date' (MM-DD-YYYY HH:MM:SS format from Conversite)
      let issuedDate = parseDate(row['Issued date']);
      
      // CRITICAL: Use Year-month field as fallback for commission month
      // Some orders have corrupted Issued date (e.g., "01-01-2012" instead of December 2025)
      // Year-month field is more reliable (e.g., "December 2025")
      let commissionMonth: string | undefined;
      let commissionYear: number | undefined;
      
      if (issuedDate && issuedDate.getFullYear() >= 2020) {
        // Issued date is valid and reasonable
        commissionMonth = `${issuedDate.getFullYear()}-${String(issuedDate.getMonth() + 1).padStart(2, '0')}`;
        commissionYear = issuedDate.getFullYear();
      } else {
        // Issued date is invalid or unreasonable - use Year-month field
        const yearMonth = String(row['Year-month'] || '').trim();
        if (yearMonth) {
          // Parse "December 2025" format
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
              // Create a reasonable date (1st of the month) for postingDate
              issuedDate = new Date(year, month - 1, 1);
              console.log(`⚠️ Using Year-month fallback for order ${soNum}: ${yearMonth} -> ${commissionMonth}`);
            }
          }
        }
      }
      
      // Skip orders with no valid date
      if (!commissionMonth || !commissionYear) {
        console.warn(`⚠️ Skipping order ${soNum} - no valid date (Issued: ${row['Issued date']}, Year-month: ${row['Year-month']})`);
        stats.skipped++;
        continue;
      }
      
      const postingDate = issuedDate ? Timestamp.fromDate(issuedDate) : null;
      
      // CRITICAL: commission-calculator.ts queries by commissionDate field
      // We need BOTH commissionMonth (string) and commissionDate (Timestamp) fields
      const commissionDate = issuedDate ? Timestamp.fromDate(issuedDate) : null;
      
      const orderData = {
        soNumber: soNum,
        salesOrderId: String(salesOrderId),
        customerId: customerId,
        customerName: customerName,
        postingDate: postingDate,
        commissionMonth: commissionMonth,
        commissionYear: commissionYear,
        commissionDate: commissionDate,
        // CRITICAL: salesPerson (Column T) is the ONLY field used for commission calculation
        salesPerson: String(row['Sales person'] || '').trim(),
        // salesRep is stored for reporting only - NOT used in commission calculation
        salesRep: String(row['Sales Rep'] || '').trim(),
        updatedAt: Timestamp.now()
      };
      
      // Write to main collection
      batch.set(orderRef, orderData, { merge: true });
      batchCount++;
      stats.ordersCreated++;
      
      // Write to customer's order history subcollection
      // Use sales order number as document ID for readability
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
        
        // Update customer summary fields (last order date/info)
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
    
    // Process line item
    // CRITICAL: Use composite key to avoid duplicates
    // CSV has duplicate SO Item IDs (656 duplicates), so we need unique doc IDs
    const itemId = `${salesOrderId}_${lineItemId}`;
    const itemRef = adminDb.collection('fishbowl_soitems').doc(itemId);
    
    // Parse 'Issued date' for line items - use same logic as orders
    let itemIssuedDate = parseDate(row['Issued date']);
    let itemCommissionMonth: string | undefined;
    let itemCommissionYear: number | undefined;
    
    if (itemIssuedDate && itemIssuedDate.getFullYear() >= 2020) {
      // Issued date is valid
      itemCommissionMonth = `${itemIssuedDate.getFullYear()}-${String(itemIssuedDate.getMonth() + 1).padStart(2, '0')}`;
      itemCommissionYear = itemIssuedDate.getFullYear();
    } else {
      // Use Year-month fallback for line items too
      const yearMonth = String(row['Year-month'] || '').trim();
      if (yearMonth) {
        // Try abbreviated format first: Jan-24, Dec-25, etc.
        const abbrevMatch = yearMonth.match(/^(\w{3})-(\d{2})$/);
        if (abbrevMatch) {
          const monthAbbrev = abbrevMatch[1];
          const yearShort = parseInt(abbrevMatch[2]);
          const year = yearShort >= 0 && yearShort <= 50 ? 2000 + yearShort : 1900 + yearShort;
          const monthMap: Record<string, number> = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
          };
          const month = monthMap[monthAbbrev];
          if (month && year) {
            itemCommissionMonth = `${year}-${String(month).padStart(2, '0')}`;
            itemCommissionYear = year;
            itemIssuedDate = new Date(year, month - 1, 1);
          }
        } else {
          // Fallback to full month name format: December 2025, April 2023, etc.
          const fullMatch = yearMonth.match(/(\w+)\s+(\d{4})/);
          if (fullMatch) {
            const monthName = fullMatch[1];
            const year = parseInt(fullMatch[2]);
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
    }
    
    // Skip line items with no valid date
    if (!itemCommissionMonth || !itemCommissionYear) {
      console.warn(`⚠️ Skipping line item ${lineItemId} for order ${soNum} - no valid date`);
      stats.skipped++;
      continue;
    }
    
    // CRITICAL: commission-calculator.ts queries by commissionDate field
    const itemCommissionDate = itemIssuedDate ? Timestamp.fromDate(itemIssuedDate) : null;
    
    batch.set(itemRef, {
      soNumber: soNum,
      salesOrderId: String(salesOrderId),
      soItemId: lineItemId,
      customerId: customerId,
      customerName: customerName,
      product: String(row['SO Item Product Number'] || row['Part Description'] || row['Product'] || '').trim(),
      quantity: safeParseNumber(row['Qty fulfilled'] || row['Qty'] || row['Quantity']),
      unitPrice: safeParseNumber(row['Total Price'] || row['Total']),
      totalPrice: safeParseNumber(row['Total Price'] || row['Total']),
      postingDate: itemIssuedDate ? Timestamp.fromDate(itemIssuedDate) : null,
      commissionMonth: itemCommissionMonth,
      commissionYear: itemCommissionYear,
      commissionDate: itemCommissionDate,
      salesPerson: String(row['Sales person'] || '').trim(),
      updatedAt: Timestamp.now()
    }); // CRITICAL: No merge - each composite key is unique, don't overwrite
    batchCount++;
    stats.itemsCreated++;
    
    // Commit batch periodically
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
      
      // Update progress
      const pct = Math.round((i / data.length) * 100);
      await progressRef.update({
        currentRow: i,
        percentage: pct,
        stats: stats,
        updatedAt: Timestamp.now()
      });
      console.log(`📊 Progress: ${i}/${data.length} (${pct}%)`);
    }
  }
  
  // Commit final batch
  if (batchCount > 0) {
    await batch.commit();
  }
  
  // Mark complete
  await progressRef.update({
    status: 'complete',
    currentRow: data.length,
    percentage: 100,
    stats: stats,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  // Clean up pending import
  await pendingDocRef.delete();
  
  console.log('✅ Background import complete:', stats);
  
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
}
