import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import Papa from 'papaparse';
import { createHeaderMap, normalizeRow } from '../normalize-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ImportSummaryRow {
  rowNumber: number;
  salesOrderNumber: string;
  salesPerson: string;
  issuedDate: string;
  yearMonth: string;
  totalPrice: number;
  status: 'success' | 'error' | 'skipped';
  commissionMonth: string;
  commissionYear: number | null;
  usedYearMonthFallback: boolean;
  dateParsingMethod: 'issued_date' | 'year_month_fallback' | 'failed';
  errorMessage: string;
  warnings: string[];
}

// Same parseDate function from process-import
function parseDate(val: any): Date | null {
  if (!val) return null;
  
  const str = String(val).trim();
  if (!str) return null;

  // Try parsing MM-DD-YYYY HH:MM:SS format (Conversite format)
  const match1 = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (match1) {
    const month = parseInt(match1[1]);
    const day = parseInt(match1[2]);
    const year = parseInt(match1[3]);
    const hour = parseInt(match1[4]);
    const minute = parseInt(match1[5]);
    const second = match1[6] ? parseInt(match1[6]) : 0;
    
    const date = new Date(year, month - 1, day, hour, minute, second);
    
    if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= new Date().getFullYear() + 1) {
      return date;
    }
  }

  // Try parsing MM/DD/YYYY HH:MM format
  const match2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/);
  if (match2) {
    const month = parseInt(match2[1]);
    const day = parseInt(match2[2]);
    const year = parseInt(match2[3]);
    const hour = parseInt(match2[4]);
    const minute = parseInt(match2[5]);
    
    const date = new Date(year, month - 1, day, hour, minute, 0);
    
    if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= new Date().getFullYear() + 1) {
      return date;
    }
  }

  console.warn(`Failed to parse date: ${str}`);
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📊 Generating import summary report for: ${file.name}`);
    
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0) {
      console.error('CSV parsing errors:', parsed.errors);
    }

    const rows = parsed.data as any[];
    
    // Create header mapping
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const headerMap = createHeaderMap(headers);
    
    // Normalize all rows
    const normalizedRows = rows.map(row => normalizeRow(row, headerMap));
    
    console.log(`📄 Analyzing ${normalizedRows.length} rows...`);
    
    const summary: ImportSummaryRow[] = [];
    const monthMap: Record<string, number> = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4,
      'May': 5, 'June': 6, 'July': 7, 'August': 8,
      'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const rowNum = i + 1;
      
      const summaryRow: ImportSummaryRow = {
        rowNumber: rowNum,
        salesOrderNumber: String(row['Sales order Number'] || ''),
        salesPerson: String(row['Sales person'] || '').trim(),
        issuedDate: String(row['Issued date'] || ''),
        yearMonth: String(row['Year-month'] || ''),
        totalPrice: parseFloat(String(row['Total Price'] || '0').replace(/[$,]/g, '')) || 0,
        status: 'success',
        commissionMonth: '',
        commissionYear: null,
        usedYearMonthFallback: false,
        dateParsingMethod: 'issued_date',
        errorMessage: '',
        warnings: []
      };
      
      try {
        // Try parsing Issued date
        let issuedDate = parseDate(row['Issued date']);
        
        if (issuedDate && issuedDate.getFullYear() >= 2020) {
          // Issued date is valid
          summaryRow.commissionMonth = `${issuedDate.getFullYear()}-${String(issuedDate.getMonth() + 1).padStart(2, '0')}`;
          summaryRow.commissionYear = issuedDate.getFullYear();
          summaryRow.dateParsingMethod = 'issued_date';
          summaryRow.usedYearMonthFallback = false;
        } else {
          // Use Year-month fallback
          const yearMonth = String(row['Year-month'] || '').trim();
          if (yearMonth) {
            const match = yearMonth.match(/(\w+)\s+(\d{4})/);
            if (match) {
              const monthName = match[1];
              const year = parseInt(match[2]);
              const month = monthMap[monthName];
              
              if (month && year) {
                summaryRow.commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
                summaryRow.commissionYear = year;
                summaryRow.dateParsingMethod = 'year_month_fallback';
                summaryRow.usedYearMonthFallback = true;
                summaryRow.warnings.push(`Used Year-month fallback: ${yearMonth} -> ${summaryRow.commissionMonth}`);
                
                if (issuedDate) {
                  summaryRow.warnings.push(`Issued date parsed as ${issuedDate.toISOString()} but year ${issuedDate.getFullYear()} is before 2020`);
                } else {
                  summaryRow.warnings.push(`Issued date "${row['Issued date']}" failed to parse`);
                }
              } else {
                summaryRow.status = 'error';
                summaryRow.dateParsingMethod = 'failed';
                summaryRow.errorMessage = `Failed to parse Year-month: ${yearMonth}`;
              }
            } else {
              summaryRow.status = 'error';
              summaryRow.dateParsingMethod = 'failed';
              summaryRow.errorMessage = `Year-month format not recognized: ${yearMonth}`;
            }
          } else {
            summaryRow.status = 'error';
            summaryRow.dateParsingMethod = 'failed';
            summaryRow.errorMessage = 'No Issued date or Year-month field available';
          }
        }
        
        // Check for admin orders
        if (summaryRow.salesPerson === 'admin' || summaryRow.salesPerson === 'Admin') {
          summaryRow.status = 'skipped';
          summaryRow.warnings.push('Admin order - will be skipped in commission calculation');
        }
        
        // Check for missing sales person
        if (!summaryRow.salesPerson) {
          summaryRow.warnings.push('Missing sales person');
        }
        
      } catch (error: any) {
        summaryRow.status = 'error';
        summaryRow.errorMessage = error.message;
      }
      
      summary.push(summaryRow);
    }
    
    // Generate statistics
    const stats = {
      totalRows: summary.length,
      successRows: summary.filter(r => r.status === 'success').length,
      errorRows: summary.filter(r => r.status === 'error').length,
      skippedRows: summary.filter(r => r.status === 'skipped').length,
      yearMonthFallbackUsed: summary.filter(r => r.usedYearMonthFallback).length,
      byCommissionMonth: {} as Record<string, number>,
      bySalesPerson: {} as Record<string, number>,
      byDateParsingMethod: {
        issued_date: summary.filter(r => r.dateParsingMethod === 'issued_date').length,
        year_month_fallback: summary.filter(r => r.dateParsingMethod === 'year_month_fallback').length,
        failed: summary.filter(r => r.dateParsingMethod === 'failed').length
      }
    };
    
    summary.forEach(row => {
      if (row.commissionMonth) {
        stats.byCommissionMonth[row.commissionMonth] = (stats.byCommissionMonth[row.commissionMonth] || 0) + 1;
      }
      if (row.salesPerson) {
        stats.bySalesPerson[row.salesPerson] = (stats.bySalesPerson[row.salesPerson] || 0) + 1;
      }
    });
    
    // Save to Firestore
    const reportId = `import_summary_${Date.now()}`;
    await adminDb.collection('import_summary_reports').doc(reportId).set({
      reportId,
      fileName: file.name,
      createdAt: Timestamp.now(),
      stats,
      summary: summary.slice(0, 1000) // Store first 1000 rows in Firestore
    });
    
    console.log(`✅ Import summary report generated: ${reportId}`);
    console.log(`📊 Stats:`, stats);
    
    // Generate CSV for download
    const csvHeaders = [
      'Row #',
      'Order #',
      'Sales Person',
      'Issued Date',
      'Year-Month',
      'Total Price',
      'Status',
      'Commission Month',
      'Commission Year',
      'Date Parsing Method',
      'Used Fallback',
      'Warnings',
      'Errors'
    ];
    
    const csvRows = summary.map(row => [
      row.rowNumber,
      row.salesOrderNumber,
      row.salesPerson,
      row.issuedDate,
      row.yearMonth,
      row.totalPrice,
      row.status,
      row.commissionMonth,
      row.commissionYear || '',
      row.dateParsingMethod,
      row.usedYearMonthFallback ? 'YES' : 'NO',
      row.warnings.join(' | '),
      row.errorMessage
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    return NextResponse.json({
      success: true,
      reportId,
      stats,
      csvContent,
      fileName: `import_summary_${file.name.replace('.csv', '')}_${Date.now()}.csv`
    });
    
  } catch (error: any) {
    console.error('❌ Import summary report error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
