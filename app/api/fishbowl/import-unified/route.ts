import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { parse } from 'csv-parse/sync';

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
    
    // Read as text to preserve exact CSV values (no Excel date conversion)
    const text = await file.text();
    const data = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    console.log(`📊 Parsed ${data.length} rows from CSV`);
    
    // Debug: Show first row's column names and price values
    if (data.length > 0) {
      const firstRow = data[0] as Record<string, any>;
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
      if (data.id) {
        fishbowlCustomersMap.set(data.id, data);
      }
    });
    console.log(`✅ Loaded ${fishbowlCustomersMap.size} existing Fishbowl customers (from Copper Sync)`);
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, any>;
      stats.processed++;
      
      const soNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
      const salesOrderId = row['Sales Order ID'] || row['SO ID'];
      const lineItemId = row['SO Item ID'] || row['SO item ID'];
      const customerId = String(row['Account ID'] || row['Account id'] || row['Customer id'] || '').trim();
      const customerName = String(row['Customer Name'] || row['Customer'] || '').trim();
      
      if (!soNum || !customerId || !salesOrderId || !lineItemId) {
        stats.skipped++;
        continue;
      }
      
      // Get account type from existing Fishbowl customer (set by Copper Sync)
      // If customer doesn't exist yet, default to 'Retail' (will be updated by next Copper Sync)
      const existingCustomer = fishbowlCustomersMap.get(customerId);
      const accountType = existingCustomer?.accountType || 'Retail';
      
      // Upsert customer with account type
      if (!processedCustomers.has(customerId)) {
        const customerRef = adminDb.collection('fishbowl_customers').doc(customerId);
        batch.set(customerRef, {
          id: customerId,
          name: customerName,
          accountType: accountType, // Defaults to 'Retail' if not found
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
        
        if (existingOrderDoc.exists) {
          const existingData = existingOrderDoc.data();
          if (existingData?.manuallyLinked === true) {
            console.log(`🔒 Skipping order ${soNum} - manually corrected via validation (preserving correction)`);
            stats.ordersUnchanged++;
            processedOrders.add(soNum);
            continue; // Don't overwrite manual corrections
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
        
        const salesPersonValue = String(row['Sales Rep'] || '').trim();
        
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
          customerId: customerId,
          customerName: customerName,
          accountType: accountType, // ✅ NOW INCLUDES ACCOUNT TYPE FROM COPPER
          salesPerson: salesPersonValue,
          salesRep: String(row['Sales Rep'] || '').trim(),
          postingDate: postingDate,
          commissionMonth: commissionMonth,
          commissionYear: commissionYear,
          commissionDate: commissionDate,
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
      
      const unitPrice = safeParseNumber(row['Unit price']);
      const totalPrice = safeParseNumber(row['Total price']);
      
      // Debug first 3 items to verify parsing
      if (stats.itemsCreated < 3) {
        console.log(`📊 Line Item ${stats.itemsCreated + 1}:`, {
          soNumber: soNum,
          product: String(row['SO Item Product Number'] || '').trim(),
          quantity: safeParseNumber(row['Fulfilled Quantity']),
          unitPriceRaw: row['Unit price'],
          unitPriceParsed: unitPrice,
          totalPriceRaw: row['Total price'],
          totalPriceParsed: totalPrice
        });
      }
      
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
        quantity: safeParseNumber(row['Fulfilled Quantity']),
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        postingDate: itemIssuedDate ? Timestamp.fromDate(itemIssuedDate) : null,
        commissionMonth: itemCommissionMonth,
        commissionYear: itemCommissionYear,
        commissionDate: itemCommissionDate,
        salesPerson: String(row['Sales Rep'] || row['Default Sales Rep'] || '').trim(),
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
    
    return NextResponse.json({
      success: true,
      stats
    });
    
  } catch (error: any) {
    console.error('❌ Import-unified error:', error);
    return NextResponse.json({ 
      error: error.message || 'Import failed' 
    }, { status: 500 });
  }
}
