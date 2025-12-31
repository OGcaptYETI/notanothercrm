import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

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
  
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  
  const dateStr = String(val).trim();
  
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
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
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
    console.log('\n🚀 IMPORT-UNIFIED: Direct single-request import');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log(`📦 Processing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });
    
    console.log(`📊 Parsed ${data.length} rows from CSV`);
    
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
      
      // Upsert customer
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
      
      // Process order (once per order)
      if (!processedOrders.has(soNum)) {
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
        
        const orderRef = adminDb.collection('fishbowl_sales_orders').doc(soNum);
        const orderData = {
          soNumber: soNum,
          salesOrderId: String(salesOrderId),
          customerId: customerId,
          customerName: customerName,
          salesPerson: String(row['Sales person'] || '').trim(),
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
