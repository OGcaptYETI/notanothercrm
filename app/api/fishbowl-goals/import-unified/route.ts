import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Unified Fishbowl Import from Conversight Report
 * 
 * This single import creates:
 * 1. fishbowl_customers (deduplicated by Customer id)
 * 2. fishbowl_sales_orders (deduplicated by Sales order Number)
 * 3. fishbowl_soitems (one per row - line items)
 * 
 * All properly linked together!
 */

interface ImportStats {
  processed: number;
  customersCreated: number;
  customersUpdated: number;
  ordersCreated: number;
  ordersUpdated: number;
  itemsCreated: number;
  skipped: number;
}

async function importUnifiedReport(buffer: Buffer, filename: string): Promise<ImportStats> {
  console.log('📥 Importing Unified Fishbowl Report from Conversight...');
  
  let data: Record<string, any>[];
  
  // Parse file - use XLSX for both CSV and Excel for consistent parsing
  console.log('📄 Parsing file...');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} rows to process`);
  
  // Log the first row's columns to help debug
  if (data.length > 0) {
    console.log('📋 Column headers found:', Object.keys(data[0]));
  }
  
  // Lightweight data mapper helper for tolerant header handling
  const getField = (row: Record<string, any>, variants: string[]): any => {
    for (const key of variants) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return undefined;
  };
  
  // Preflight header check: ensure required logical fields are present in *some* form
  if (data.length === 0) {
    throw new Error('Unified import aborted: file contains no data rows.');
  }
  
  const headerKeys = new Set(Object.keys(data[0]));
  
  const requiredFieldGroups: { label: string; variants: string[] }[] = [
    {
      label: 'Customer ID (Account ID)',
      variants: ['Account ID', 'Account id', 'Account Id']
    },
    {
      label: 'Sales Order Number',
      variants: ['Sales order Number', 'Sales Order Number', 'SO Number', 'Sales order']
    },
    {
      label: 'Sales Order ID',
      variants: ['Sales Order ID', 'SO ID']
    },
    {
      label: 'SO Item ID (line item id)',
      variants: ['SO Item ID', 'SO Item Id']
    },
  ];
  
  const missingLogicalFields: string[] = [];
  for (const group of requiredFieldGroups) {
    const hasAny = group.variants.some((v) => headerKeys.has(v));
    if (!hasAny) {
      missingLogicalFields.push(`${group.label} [one of: ${group.variants.join(', ')}]`);
    }
  }
  
  if (missingLogicalFields.length > 0) {
    console.error('❌ Unified import aborted. Missing required logical fields:', missingLogicalFields);
    throw new Error(
      'Unified import aborted because the CSV headers are missing required columns. ' +
      'Missing: ' + missingLogicalFields.join('; ') +
      '. Please check your export format and try again.'
    );
  }
  
  const stats: ImportStats = {
    processed: 0,
    customersCreated: 0,
    customersUpdated: 0,
    ordersCreated: 0,
    ordersUpdated: 0,
    itemsCreated: 0,
    skipped: 0
  };
  
  // Track what we've already processed (to avoid duplicates within the same import)
  const processedCustomers = new Set<string>();
  const processedOrders = new Set<string>();
  
  console.log('🚀 Starting import with merge mode (no pre-fetching needed)...');
  
  let batch = adminDb.batch();
  let batchCount = 0;
  
  let rowIndex = 0;
  const totalRows = data.length;
  for (const row of data) {
    rowIndex++;
    stats.processed++;
    
    // Log progress every 1000 rows
    if (stats.processed % 1000 === 0) {
      console.log(`📊 Progress: ${stats.processed} of ${totalRows} (${((stats.processed/totalRows)*100).toFixed(1)}%)`);
      console.log(`   Customers: ${stats.customersCreated} created, ${stats.customersUpdated} updated`);
      console.log(`   Orders: ${stats.ordersCreated} created, ${stats.ordersUpdated} updated`);
      console.log(`   Items: ${stats.itemsCreated} created, Skipped: ${stats.skipped}`);
    }
    
    
    try {
      // Extract key fields - using actual Fishbowl CSV column names
      const customerId = getField(row, ['Account ID', 'Account id', 'Account Id']);  // Fishbowl customer id
      const salesOrderNum = getField(row, ['Sales order Number', 'Sales Order Number', 'SO Number', 'Sales order']);  // Sales order number
      const salesOrderId = getField(row, ['Sales Order ID', 'SO ID']);  // Sales Order ID (not item ID)
      
      // Skip if missing critical data
      if (!customerId || !salesOrderNum) {
        stats.skipped++;
        continue;
      }
      
      // === 1. CREATE/UPDATE CUSTOMER ===
      if (!processedCustomers.has(String(customerId))) {
        // Sanitize customer ID - remove slashes and invalid Firestore path characters
        const customerDocId = String(customerId)
          .replace(/\//g, '_')  // Replace / with _
          .replace(/\\/g, '_')  // Replace \ with _
          .trim();
        
        const customerRef = adminDb.collection('fishbowl_customers').doc(customerDocId);
        
        const customerData: any = {
          id: customerDocId,  // Fishbowl Customer ID (matches Copper Account Order ID)
          name: getField(row, ['Customer Name', 'Customer']) || '',  // Customer Name
          accountNumber: row['Account Number'] || '',  // Customer Account Number in Fishbowl
          accountType: row['Account type'] || '',  // Changed from 'Account Type'
          companyId: row['Company ID'] || '',  // Changed from 'Company id'
          companyName: row['Company name'] || '',
          parentCompanyId: row['Parent Company ID'] || '',
          parentCustomerName: row['Parent Customer Name'] || '',
          shippingCity: row['Billing City'] || '',  // Changed from 'Shipping City'
          shippingAddress: row['Billing Address'] || '',  // Changed from 'Shipping Address'
          shippingCountry: row['Billing Country'] || '',  // Changed from 'Shipping Country'
          customerContact: getField(row, ['Customer Name', 'Customer']) || '',  // Changed from 'Customer contact'
          salesRep: row['Sales Rep'] || '',  // Sales Rep from CSV
          salesPerson: getField(row, ['Sales person', 'Sales man', 'Salesman']) || '',  // Sales person from CSV
          updatedAt: Timestamp.now(),
          source: 'fishbowl_unified',
        };
        
        // Use merge: true to create or update in one operation (no need to check existence!)
        batch.set(customerRef, customerData, { merge: true });
        stats.customersCreated++; // Note: We count all as "created" but merge handles updates
        
        processedCustomers.add(String(customerId));
        batchCount++;
      }
      
      // === 2. CREATE/UPDATE SALES ORDER ===
      if (!processedOrders.has(String(salesOrderNum))) {
        const orderDocId = `fb_so_${salesOrderNum}`;
        const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderDocId);
        
        // Sanitize customer ID for consistency
        const sanitizedCustomerId = String(customerId)
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .trim();
        
        // Parse sales order date for commission tracking
        const postingDateRaw = row['Sales Order Date'];
        let postingDate = null;
        let postingDateStr = '';
        let commissionMonth = '';
        let commissionYear = 0;
        
        if (postingDateRaw) {
          try {
            let serialNumber = postingDateRaw;
            
            // Check if it's a numeric string (Excel serial number as string)
            if (typeof postingDateRaw === 'string' && !isNaN(Number(postingDateRaw)) && Number(postingDateRaw) > 1000) {
              serialNumber = Number(postingDateRaw);
            }
            
            // Check if it's an Excel serial number (numeric)
            if (typeof serialNumber === 'number') {
              // Convert Excel serial date to JavaScript Date
              // Excel dates are days since 1/1/1900
              const excelEpoch = new Date(1899, 11, 30); // Excel epoch (Dec 30, 1899)
              postingDate = new Date(excelEpoch.getTime() + serialNumber * 86400000);
              
              const month = postingDate.getMonth() + 1;
              const day = postingDate.getDate();
              const year = postingDate.getFullYear();
              
              postingDateStr = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
              commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
              commissionYear = year;
            } else {
              // String format: MM-DD-YYYY or MM/DD/YYYY
              const dateStr = String(postingDateRaw);
              postingDateStr = dateStr;
              
              // Try splitting by dash first, then slash
              let dateParts = dateStr.split('-');
              if (dateParts.length !== 3) {
                dateParts = dateStr.split('/');
              }
              
              if (dateParts.length === 3) {
                const month = parseInt(dateParts[0]);
                const day = parseInt(dateParts[1]);
                const year = parseInt(dateParts[2]);
                postingDate = new Date(year, month - 1, day);
                commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
                commissionYear = year;
              }
            }
          } catch (e) {
            console.error(`⚠️ Failed to parse date: "${postingDateRaw}"`, e);
          }
        }
        
        const orderData: any = {
          id: orderDocId,  // fb_so_{Sales order Number}
          num: String(salesOrderNum),  // Sales Order Number (external customer-facing)
          fishbowlNum: String(salesOrderNum),
          salesOrderId: String(salesOrderId), // Sales Order ID (Fishbowl assigned ID)
          customerId: sanitizedCustomerId, // Customer ID (Fishbowl) = Copper Account Order ID
          customerName: getField(row, ['Customer Name', 'Customer']) || '',  // Customer Name
          salesPerson: getField(row, ['Sales person', 'Sales man', 'Salesman']) || '',  // Sales Person (long name)
          salesRep: row['Sales Rep'] || '',  // Sales Rep (short name)
          soStatus: getField(row, ['SO Status', 'So status', 'SO status']) || '',
          
          // Commission tracking fields
          postingDate: postingDate ? Timestamp.fromDate(postingDate) : null,
          postingDateStr: postingDateStr,
          commissionDate: postingDate ? Timestamp.fromDate(postingDate) : null, // COMMISSION DATE = POSTING DATE
          commissionMonth: commissionMonth, // For grouping: "2025-10"
          commissionYear: commissionYear, // For filtering: 2025
          
          // Financial totals
          revenue: parseFloat(row['Total price'] || row['Total Price'] || 0),  // Total amount of Sales Order
          orderValue: parseFloat(row['Total price'] || row['Total Price'] || 0),  // Total amount of Sales Order
          
          updatedAt: Timestamp.now(),
          source: 'fishbowl_unified',
          syncStatus: 'pending',
        };
        
        // Use merge: true to create or update in one operation (no need to check existence!)
        batch.set(orderRef, orderData, { merge: true });
        stats.ordersCreated++; // Note: We count all as "created" but merge handles updates
        
        processedOrders.add(String(salesOrderNum));
        batchCount++;
      }
      
      // === 3. CREATE SOITEM (LINE ITEM) ===
      // Each row is a unique line item
      // SO Item ID is the unique line item ID from Fishbowl
      const productLineId = row['SO Item ID'];
      if (!productLineId) {
        stats.skipped++;
        continue;
      }
      
      const itemDocId = `soitem_${productLineId}`;
      const itemRef = adminDb.collection('fishbowl_soitems').doc(itemDocId);
      
      // Sanitize customer ID for consistency
      const sanitizedCustomerId = String(customerId)
        .replace(/\//g, '_')
        .replace(/\\/g, '_')
        .trim();
      
      // Parse sales order date for commission tracking (denormalized for fast queries)
      const postingDateRaw2 = row['Sales Order Date'];
      let postingDate2 = null;
      let postingDateStr2 = '';
      let commissionMonth2 = '';
      let commissionYear2 = 0;
      
      if (postingDateRaw2) {
        try {
          let serialNumber2 = postingDateRaw2;
          
          // Check if it's a numeric string (Excel serial number as string)
          if (typeof postingDateRaw2 === 'string' && !isNaN(Number(postingDateRaw2)) && Number(postingDateRaw2) > 1000) {
            serialNumber2 = Number(postingDateRaw2);
          }
          
          // Check if it's an Excel serial number (numeric)
          if (typeof serialNumber2 === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            postingDate2 = new Date(excelEpoch.getTime() + serialNumber2 * 86400000);
            
            const month = postingDate2.getMonth() + 1;
            const day = postingDate2.getDate();
            const year = postingDate2.getFullYear();
            
            postingDateStr2 = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
            commissionMonth2 = `${year}-${String(month).padStart(2, '0')}`;
            commissionYear2 = year;
          } else {
            // String format: MM-DD-YYYY or MM/DD/YYYY
            const dateStr = String(postingDateRaw2);
            postingDateStr2 = dateStr;
            
            // Try splitting by dash first, then slash
            let dateParts = dateStr.split('-');
            if (dateParts.length !== 3) {
              dateParts = dateStr.split('/');
            }
            
            if (dateParts.length === 3) {
              const month = parseInt(dateParts[0]);
              const day = parseInt(dateParts[1]);
              const year = parseInt(dateParts[2]);
              postingDate2 = new Date(year, month - 1, day);
              commissionMonth2 = `${year}-${String(month).padStart(2, '0')}`;
              commissionYear2 = year;
            }
          }
        } catch (e) {
          console.error(`⚠️ Failed to parse line item date: "${postingDateRaw2}"`, e);
        }
      }
      
      const itemData: any = {
        id: itemDocId,  // soitem_{Sales Order Product ID}
        
        // Sales Order Links
        salesOrderId: String(salesOrderId), // Sales Order ID (Fishbowl assigned ID)
        salesOrderNum: String(salesOrderNum), // Sales Order Number (customer-facing)
        soId: `fb_so_${salesOrderNum}`, // Link to fishbowl_sales_orders collection
        
        // Customer Info (denormalized for fast queries)
        customerId: sanitizedCustomerId, // Customer ID (Fishbowl) = Copper Account Order ID
        customerName: getField(row, ['Customer Name', 'Customer']) || '',  // Customer Name
        accountNumber: row['Account Number'] || '',  // Customer Account Number
        
        // Sales Person
        salesPerson: getField(row, ['Sales person', 'Sales man', 'Salesman']) || '',  // Sales Person (long name)
        salesRep: row['Sales Rep'] || '',  // Sales Rep (short name)
        
        // Commission Tracking (denormalized for fast queries)
        postingDate: postingDate2 ? Timestamp.fromDate(postingDate2) : null,
        postingDateStr: postingDateStr2,
        commissionDate: postingDate2 ? Timestamp.fromDate(postingDate2) : null, // COMMISSION DATE = POSTING DATE
        commissionMonth: commissionMonth2, // For grouping: "2025-10"
        commissionYear: commissionYear2, // For filtering: 2025
        
        // Line Item Identification
        lineItemId: String(productLineId), // Sales Order Product ID (unique line item ID)
        
        // Product Info
        partNumber: row['Part Number'] || '',  // Name of the SKU in Fishbowl
        partId: row['Part ID'] || '',  // ID associated to the part number
        product: row['Product'] || '',
        productC1: row['Product c1'] || '',  // Product category 1
        productC2: row['Product c2'] || '',  // Product category 2
        productC3: row['Product c3'] || '',  // Product category 3
        productC4: row['Product c4'] || '',  // Product category 4
        productC5: row['Product c5'] || '',  // Product category 5
        productDesc: row['Product Description'] || '',
        description: row['Part Description'] || '',
        itemType: row['SO Item Type'] || '',
        
        // Financial Data (LINE ITEM LEVEL)
        revenue: parseFloat(row['Total price'] || row['Total Price'] || 0),  // Line item revenue
        unitPrice: parseFloat(row['Unit price'] || 0),  // Price customer pays per unit
        invoicedCost: parseFloat(row['Last Unit Price'] || 0),  // Cost of the product/line item
        margin: parseFloat(row['Total price'] || row['Total Price'] || 0) - parseFloat(row['Last Unit Price'] || 0) * parseFloat(row['Fulfilled Quantity'] || row['Qty fulfilled'] || 0),  // Calculate margin
        quantity: parseFloat(row['Fulfilled Quantity'] || row['Qty fulfilled'] || 0),  // Unit quantity of line item
        totalPrice: parseFloat(row['Total price'] || row['Total Price'] || 0),
        qtyOrdered: parseFloat(row['Qty ordered'] || 0),
        qtyFulfilled: parseFloat(row['Fulfilled Quantity'] || row['Qty fulfilled'] || 0),
        
        // Metadata
        shippingItemId: row['Shipping Item ID'] || '',
        
        // Import metadata
        importedAt: Timestamp.now(),
        source: 'fishbowl_unified',
      };
      
      batch.set(itemRef, itemData);
      stats.itemsCreated++;
      batchCount++;
      
      // Commit in batches of 500
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`💾 Committed batch: ${stats.customersCreated + stats.customersUpdated} customers, ${stats.ordersCreated + stats.ordersUpdated} orders, ${stats.itemsCreated} items`);
        batch = adminDb.batch();
        batchCount = 0;
      }
      
    } catch (error: any) {
      console.error(`❌ Error processing row ${stats.processed}:`, error.message);
      stats.skipped++;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n✅ UNIFIED IMPORT COMPLETE!`);
  console.log(`   Rows processed: ${stats.processed}`);
  console.log(`   Customers: ${stats.customersCreated} created, ${stats.customersUpdated} updated`);
  console.log(`   Orders: ${stats.ordersCreated} created, ${stats.ordersUpdated} updated`);
  console.log(`   Line Items: ${stats.itemsCreated} created`);
  console.log(`   Skipped: ${stats.skipped}\n`);
  
  return stats;
}


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log(`📁 File received: ${file.name}`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const stats = await importUnifiedReport(buffer, file.name);
    
    // Add warning if everything was skipped
    const response: any = {
      success: true,
      stats,
      message: `Successfully imported ${stats.itemsCreated} line items, ${stats.customersCreated + stats.customersUpdated} customers, ${stats.ordersCreated + stats.ordersUpdated} orders`
    };
    
    if (stats.skipped === stats.processed && stats.processed > 0) {
      response.warning = `All ${stats.skipped} rows were skipped. Check that your CSV has the required columns: Account ID, Sales order Number, Sales Order ID`;
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
