import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Import Fishbowl SOItem (Sales Order Line Items) into Firestore
 * Links line items to sales orders for product mix analysis
 */
async function importSOItems(buffer: Buffer, filename: string): Promise<number> {
  console.log('📥 Importing Fishbowl SOItems (Sales Order Line Items)...');
  
  let data: Record<string, any>[];
  
  // Check if CSV or Excel
  if (filename.toLowerCase().endsWith('.csv')) {
    console.log('📄 Parsing CSV file...');
    const text = buffer.toString('utf-8');
    data = parseCSV(text);
    console.log(`✅ CSV parsed: ${data.length} rows`);
  } else {
    console.log('📊 Parsing Excel file...');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
    console.log(`✅ Excel parsed: ${data.length} rows`);
  }
  
  console.log(`✅ Found ${data.length} line items to import`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  let totalImported = 0;
  let skipped = 0;
  let processed = 0;
  const totalRows = data.length;
  
  for (const row of data) {
    processed++;
    
    // Log progress every 1000 rows
    if (processed % 1000 === 0) {
      console.log(`📊 Progress: ${processed} of ${totalRows} (${((processed/totalRows)*100).toFixed(1)}%) - Imported: ${totalImported}, Skipped: ${skipped}`);
    }
    
    // Get SOItem ID and Sales Order info from Conversite CSV
    const soItemId = row['SO Item ID'] || row['id'];
    const soNumber = row['Sales order Number'] || row['soLineItem'];
    const salesOrderId = row['Sales Order ID'];
    const salesPerson = row['Sales person'];
    const customerId = row['Customer ID'];
    const customerName = row['Customer Name'];
    
    // Skip if no valid ID or SO number
    if (!soItemId || !soNumber) {
      skipped++;
      if (skipped <= 3) {
        console.log(`⚠️  Skipping row - missing SO Item ID or Sales order Number. Row:`, row);
      }
      continue;
    }
    
    // Create composite document ID: salesOrderId_soItemId to ensure uniqueness
    const docId = `${salesOrderId}_${soItemId}`;
    const docRef = adminDb.collection('fishbowl_soitems').doc(docId);
    
    // Parse commission month from Issued date (MM-DD-YYYY format or Excel serial)
    let commissionMonth = '';
    const issuedDate = row['Issued date'];
    if (issuedDate) {
      // Try to parse as Excel serial number first
      if (!isNaN(Number(issuedDate))) {
        const excelDate = new Date((Number(issuedDate) - 25569) * 86400 * 1000);
        commissionMonth = `${excelDate.getFullYear()}-${String(excelDate.getMonth() + 1).padStart(2, '0')}`;
      } else if (typeof issuedDate === 'string') {
        // Parse MM-DD-YYYY format
        const match = issuedDate.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (match) {
          const [, month, , year] = match;
          commissionMonth = `${year}-${month.padStart(2, '0')}`;
        }
      }
    }
    
    // Create document starting with metadata
    const soItemData: any = {
      id: soItemId,
      soNumber: String(soNumber),
      salesOrderId: salesOrderId,
      salesPerson: salesPerson || '',
      customerId: customerId || '',
      customerName: customerName || '',
      commissionMonth: commissionMonth,
      
      // Import metadata
      importedAt: Timestamp.now(),
      source: 'conversite',
    };
    
    // Add ALL CSV columns as fields (preserving exact field names) - FIRST
    for (const [key, value] of Object.entries(row)) {
      if (key) {
        soItemData[key] = value || '';
      }
    }
    
    // Add computed/cleaned fields for easier querying - THESE WILL OVERWRITE THE STRINGS
    soItemData.productId = row['Product ID'] || row['productId'] || '';
    soItemData.productNum = row['SO Item Product Number'] || row['productNum'] || '';
    soItemData.description = row['Product description'] || row['description'] || '';
    soItemData.product = row['Product'] || '';
    soItemData.quantity = parseFloat(row['Fulfilled Quantity'] || row['qtyToFullfill'] || row['qtyFullfilled'] || '0');
    soItemData.unitPrice = parseFloat(row['Unit price'] || row['unitPrice'] || '0');
    soItemData.totalPrice = parseFloat(row['Total price'] || row['totalPrice'] || '0');
    soItemData.totalCost = parseFloat(row['Total cost'] || row['totalCost'] || '0');
    
    // Debug log for first few items
    if (totalImported < 5) {
      console.log(`📊 Line item ${soItemId}: Product="${soItemData.product}", Qty=${soItemData.quantity}, UnitPrice=${soItemData.unitPrice}, TotalPrice=${soItemData.totalPrice}`);
    }
    
    // Calculate total if not provided
    if (!soItemData.totalPrice && soItemData.quantity && soItemData.unitPrice) {
      soItemData.totalPrice = soItemData.quantity * soItemData.unitPrice;
      console.log(`   Calculated totalPrice: ${soItemData.totalPrice}`);
    }
    
    batch.set(docRef, soItemData, { merge: true });
    batchCount++;
    
    // Commit in batches of 500
    if (batchCount >= 500) {
      await batch.commit();
      totalImported += batchCount;
      console.log(`💾 Committed batch of ${batchCount} line items (total: ${totalImported})`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    totalImported += batchCount;
    console.log(`💾 Committed final batch of ${batchCount} line items`);
  }
  
  console.log(`\n✅ IMPORT COMPLETE!`);
  console.log(`   Total imported: ${totalImported}`);
  console.log(`   Skipped (duplicate/invalid): ${skipped}`);
  console.log(`   Success rate: ${((totalImported / data.length) * 100).toFixed(1)}%\n`);
  
  return totalImported;
}

/**
 * Parse CSV data - handles quoted fields with commas
 */
function parseCSV(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  // Parse CSV line respecting quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = parseLine(lines[0]);
  const data: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, any> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    
    data.push(row);
  }
  
  return data;
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
    const count = await importSOItems(buffer, file.name);
    
    return NextResponse.json({
      success: true,
      count,
      message: `Successfully imported ${count} SOItems`
    });
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
