import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const text = await file.text();
    
    // Simple CSV parsing (same as import code uses)
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have header and at least one data row' }, { status: 400 });
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const firstDataLine = lines[1].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    
    const firstRow: any = {};
    headers.forEach((header, idx) => {
      firstRow[header] = firstDataLine[idx] || '';
    });
    
    const columns = Object.keys(firstRow);
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 CSV COLUMN ANALYSIS');
    console.log('='.repeat(80));
    console.log(`\nTotal columns: ${columns.length}`);
    console.log('\nAll column names:');
    columns.forEach((col, idx) => {
      console.log(`  ${idx + 1}. "${col}" (length: ${col.length})`);
    });
    
    console.log('\n🔍 Date-related columns:');
    const dateColumns = columns.filter(c => c.toLowerCase().includes('date'));
    dateColumns.forEach(col => {
      console.log(`  - "${col}"`);
      console.log(`    Value: "${firstRow[col]}"`);
      console.log(`    Type: ${typeof firstRow[col]}`);
    });
    
    console.log('\n👤 Sales-related columns:');
    const salesColumns = columns.filter(c => c.toLowerCase().includes('sales') || c.toLowerCase().includes('rep'));
    salesColumns.forEach(col => {
      console.log(`  - "${col}"`);
      console.log(`    Value: "${firstRow[col]}"`);
    });
    
    console.log('\n🆔 Customer-related columns:');
    const customerColumns = columns.filter(c => c.toLowerCase().includes('customer') || c.toLowerCase().includes('account'));
    customerColumns.forEach(col => {
      console.log(`  - "${col}"`);
      console.log(`    Value: "${firstRow[col]}"`);
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    return NextResponse.json({
      success: true,
      totalColumns: columns.length,
      columns,
      dateColumns,
      salesColumns,
      customerColumns,
      sampleRow: firstRow
    });
    
  } catch (error: any) {
    console.error('Error analyzing CSV:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
