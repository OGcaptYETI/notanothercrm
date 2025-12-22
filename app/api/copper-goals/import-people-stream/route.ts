import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

interface ImportStats {
  totalPeople: number;
  created: number;
  updated: number;
  errors: Array<{ person: string; error: string }>;
}

/**
 * Send progress update to client
 */
function sendProgress(encoder: TextEncoder, controller: ReadableStreamDefaultController, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(message));
}

/**
 * Import Copper People from Excel/CSV file
 */
async function importPeople(
  buffer: Buffer, 
  stats: ImportStats,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController
): Promise<void> {
  sendProgress(encoder, controller, { type: 'status', message: 'Reading Excel file...' });
  
  // Read Excel file from buffer
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  stats.totalPeople = data.length;
  sendProgress(encoder, controller, { 
    type: 'total', 
    total: stats.totalPeople,
    message: `Found ${stats.totalPeople.toLocaleString()} people to import`
  });

  console.log(`\n📊 Starting import of ${stats.totalPeople} people from Copper...`);

  // Process in batches
  const BATCH_SIZE = 500;
  let processed = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length));
    const writeBatch = adminDb.batch();
    let batchWrites = 0;

    for (const row of batch) {
      try {
        const copperPersonId = row['Copper ID'];
        
        if (!copperPersonId) {
          stats.errors.push({
            person: row['Name'] || 'Unknown',
            error: 'Missing Copper ID'
          });
          processed++;
          continue;
        }

        // Use Copper ID as document ID
        const docId = String(copperPersonId).trim();
        const docRef = adminDb.collection('copper_people').doc(docId);
        
        // Check if exists
        const existingDoc = await docRef.get();
        const isNew = !existingDoc.exists;

        // Build person document with ALL fields from Excel
        // Map according to Copper metadata structure
        const personData: Record<string, any> = {
          id: copperPersonId,
          
          // Core fields
          name: row['Name'] || '',
          firstName: row['First Name'] || '',
          lastName: row['Last Name'] || '',
          
          // Company relationship
          companyId: row['Company Id'] || null,
          companyName: row['Company Name'] || '',
          
          // Contact info
          title: row['Title'] || '',
          email: row['Email'] || row['Email Address'] || '',
          phone: row['Phone'] || row['Phone Number'] || '',
          
          // Address
          street: row['Street Address'] || '',
          city: row['City'] || '',
          state: row['State'] || '',
          postalCode: row['Postal Code'] || '',
          country: row['Country'] || '',
          
          // Assignment
          assigneeId: row['Assignee Id'] || row['assignee_id'] || null,
          ownerId: row['Owner Id'] || null,
          ownedBy: row['Owned By'] || '',
          
          // Dates
          createdAt: row['Created At'] ? parseExcelDate(row['Created At']) : null,
          updatedAt: row['Updated At'] ? parseExcelDate(row['Updated At']) : null,
          
          // Custom Fields (from metadata)
          // cf_675906: PM Name
          'PM Name cf_675906': row['PM Name cf_675906'] || null,
          
          // cf_675909: PM Hours
          'PM Hours cf_675909': row['PM Hours cf_675909'] || null,
          
          // cf_675910: Notes
          'Notes cf_675910': row['Notes cf_675910'] || null,
          
          // cf_675913: Date
          'Date cf_675913': row['Date cf_675913'] ? parseExcelDate(row['Date cf_675913']) : null,
          
          // cf_675914: Account Type (MultiSelect)
          'Account Type cf_675914': row['Account Type cf_675914'] || null,
          
          // cf_680701: Region (Dropdown)
          'Region cf_680701': row['Region cf_680701'] || null,
          
          // cf_697979: County
          'County cf_697979': row['County cf_697979'] || null,
          
          // cf_698130: State (Dropdown)
          'State cf_698130': row['State cf_698130'] || null,
          
          // cf_698137: Prospect Notes
          'Prospect Notes cf_698137': row['Prospect Notes cf_698137'] || null,
          
          // cf_698148: Lead Temperature
          'Lead Temperature cf_698148': row['Lead Temperature cf_698148'] || null,
          
          // cf_698149: Segment
          'Segment cf_698149': row['Segment cf_698149'] || null,
          
          // cf_698219: Account Notes
          'Account Notes cf_698219': row['Account Notes cf_698219'] || null,
          
          // cf_698256: Start Time
          'Start Time cf_698256': row['Start Time cf_698256'] || null,
          
          // cf_698257: End Time
          'End Time cf_698257': row['End Time cf_698257'] || null,
          
          // cf_698259: Account Opportunity
          'Account Opportunity cf_698259': row['Account Opportunity cf_698259'] || null,
          
          // cf_698362: Organization Level
          'Organization Level cf_698362': row['Organization Level cf_698362'] || null,
          
          // cf_698367: Parent Account Number
          'Parent Account Number cf_698367': row['Parent Account Number cf_698367'] || null,
          
          // Metadata
          source: 'copper_import_csv',
          importedAt: isNew ? Timestamp.now() : existingDoc.data()?.importedAt,
          lastImportedAt: Timestamp.now(),
        };

        // Add all other columns dynamically
        for (const [key, value] of Object.entries(row)) {
          if (!personData.hasOwnProperty(key) && value !== null && value !== undefined && value !== '') {
            personData[key] = value;
          }
        }

        writeBatch.set(docRef, personData, { merge: true });
        batchWrites++;

        if (isNew) {
          stats.created++;
        } else {
          stats.updated++;
        }

      } catch (error: any) {
        stats.errors.push({
          person: row['Name'] || 'Unknown',
          error: error.message
        });
      }

      processed++;

      // Send progress every 100 records
      if (processed % 100 === 0) {
        const percent = ((processed / stats.totalPeople) * 100).toFixed(1);
        sendProgress(encoder, controller, {
          type: 'progress',
          processed,
          total: stats.totalPeople,
          created: stats.created,
          updated: stats.updated,
          percent
        });
      }
    }

    // Commit batch
    if (batchWrites > 0) {
      await writeBatch.commit();
      console.log(`✅ Committed batch of ${batchWrites} people`);
    }
  }

  // Final progress
  sendProgress(encoder, controller, {
    type: 'progress',
    processed: stats.totalPeople,
    total: stats.totalPeople,
    created: stats.created,
    updated: stats.updated,
    percent: '100.0'
  });

  console.log(`\n✅ Import complete!`);
  console.log(`   Created: ${stats.created}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Errors: ${stats.errors.length}`);
}

/**
 * Parse Excel date (serial number) to Firestore Timestamp
 */
function parseExcelDate(value: any): Timestamp | null {
  if (!value) return null;
  
  try {
    // If it's already a date string
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return Timestamp.fromDate(date);
      }
    }
    
    // If it's an Excel serial number
    if (typeof value === 'number') {
      // Excel epoch starts at 1900-01-01
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      return Timestamp.fromDate(date);
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * POST endpoint - Stream import progress
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  const stats: ImportStats = {
    totalPeople: 0,
    created: 0,
    updated: 0,
    errors: []
  };

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      try {
        // Get file from form data
        const formData = await request.formData();
        const file = formData.get('peopleFile') as File;
        
        if (!file) {
          sendProgress(encoder, controller, {
            type: 'error',
            message: 'No file provided'
          });
          controller.close();
          return;
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Import people
        await importPeople(buffer, stats, encoder, controller);

        // Send completion
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        sendProgress(encoder, controller, {
          type: 'complete',
          duration: `${duration}s`,
          stats: {
            totalPeople: stats.totalPeople,
            created: stats.created,
            updated: stats.updated,
            errors: stats.errors.length,
            errorSamples: stats.errors.slice(0, 5)
          }
        });

        controller.close();
      } catch (error: any) {
        console.error('Import error:', error);
        sendProgress(encoder, controller, {
          type: 'error',
          message: error.message || 'Import failed'
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
