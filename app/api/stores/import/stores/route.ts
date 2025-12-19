import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, verifyIdToken, adminDb } from '../../../../lib/firebase/admin';
import {
  getStoreLocatorFieldId,
  getAllActiveCustomers,
  searchCompaniesByNameInList,
  updateCompanyCustomField,
} from '@/lib/integrations/copper';

interface CSVStore {
  stockist_id: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string; // Made optional since many rows don't have it
  phone?: string;
  website?: string;
  email?: string;
  logo_url?: string;
  notes?: string;
  priority?: string;
  visible?: string;
}

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large imports

// Helper function to create error response
function createErrorResponse(message: string, status: number, details?: unknown) {
  const errorResponse: { error: string; details?: unknown } = { error: message };
  if (details) {
    errorResponse.details = details;
  }
  return NextResponse.json(errorResponse, {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(request: NextRequest) {
  console.log('=== Store Import Request Received ===');
  
  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return createErrorResponse('Unauthorized - Missing or invalid token', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.error('Empty token provided');
      return createErrorResponse('Unauthorized - Invalid token format', 401);
    }

    // 2. Token Verification
    console.log('Verifying ID token...');
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
      console.log(`Token verified for user: ${decodedToken.email}`);
    } catch (error) {
      console.error('Token verification failed:', error);
      return createErrorResponse('Unauthorized - Invalid or expired token', 401);
    }

    // 3. Authorization - Check allowed domains
    const allowedDomains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || 'kanvabotanicals.com,cwlbrands.com')
      .split(',')
      .map(d => d.trim().toLowerCase());
    
    const userDomain = decodedToken.email?.split('@')[1]?.toLowerCase();
    if (!userDomain || !allowedDomains.includes(userDomain)) {
      console.error(`Forbidden domain: ${userDomain}`);
      return createErrorResponse('Forbidden - Unauthorized domain', 403, {
        domain: userDomain,
        allowedDomains
      });
    }

    // 4. Request Validation
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return createErrorResponse('Invalid request body', 400);
    }

    const { csvText } = requestBody;
    if (!csvText) {
      return createErrorResponse('Missing required field: csvText', 400);
    }

    // Parse CSV
    let stores: CSVStore[] = [];
    try {
      stores = parseCSV(csvText);
      if (stores.length === 0) {
        return createErrorResponse('No valid stores found in CSV', 400);
      }
      console.log(`Found ${stores.length} stores to process`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return createErrorResponse('Failed to parse CSV data', 400, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Get the "On Store Locator" field ID
    let fieldId: number | null;
    try {
      fieldId = await getStoreLocatorFieldId();
      if (fieldId === null) {
        return createErrorResponse(
          'Custom field "On Store Locator" not found in Copper. Please create it first.',
          400
        );
      }
      console.log('Found Copper field ID:', fieldId);
    } catch (error) {
      console.error('Error getting Copper field ID:', error);
      return createErrorResponse('Failed to get Copper field ID', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Fetch all active customers from Copper (one-time fetch)
    let activeCustomers;
    try {
      console.log('📥 Fetching all active customers from Copper...');
      activeCustomers = await getAllActiveCustomers();
      console.log(`✅ Loaded ${activeCustomers.length} active customers into memory`);
    } catch (error) {
      console.error('Error fetching active customers:', error);
      return createErrorResponse('Failed to fetch active customers from Copper', 500, {
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Process stores in batches to avoid timeouts
    const BATCH_SIZE = 20; // Process 20 stores at a time
    const results = {
      total: stores.length,
      processed: 0,
      updated: 0,
      created: 0,
      skipped: 0,
      errors: [] as Array<{row: number, error: string, storeName?: string}>
    };

    // Process stores in batches with error handling
    console.log(`Starting import of ${stores.length} stores in batches of ${BATCH_SIZE}`);
    for (let i = 0; i < stores.length; i += BATCH_SIZE) {
      const batch = stores.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stores.length / BATCH_SIZE)} (rows ${i + 2}-${Math.min(i + BATCH_SIZE + 1, stores.length + 1)})`);
      const batchPromises = batch.map(async (store, batchIndex) => {
        const rowNumber = i + batchIndex + 2; // +2 for header row and 1-based index
        
        try {
          // Search for matching company in active customers (in-memory search)
          const companies = searchCompaniesByNameInList(store.name, activeCustomers);
          
          if (companies.length === 0) {
            return {
              success: false,
              row: rowNumber,
              storeName: store.name,
              error: 'No matching active customer found in Copper'
            };
          }

          // Find best match by address
          let bestMatch = companies[0];
          if (companies.length > 1 && store.city && store.state) {
            const cityStateMatch = companies.find((company) => {
              const addr = company.address;
              return (
                addr?.city?.toLowerCase() === store.city.toLowerCase() &&
                addr?.state?.toLowerCase() === store.state.toLowerCase()
              );
            });
            if (cityStateMatch) {
              bestMatch = cityStateMatch;
            }
          }
          
          const company = bestMatch;
          if (!company || !company.id) {
            throw new Error('Invalid company data received from Copper');
          }
          
          console.log(`Updating company ${company.id} with field ${fieldId}`);
          const companyId = Number(company.id);
          if (isNaN(companyId)) {
            throw new Error(`Invalid company ID: ${company.id}`);
          }
          
          // Update the custom field in Copper
          const success = await updateCompanyCustomField(companyId, Number(fieldId), true);
          if (!success) {
            throw new Error('Failed to update company in Copper');
          }
          
          // ALSO update Firestore to sync the data
          try {
            const firestoreRef = adminDb.collection('copper_companies').doc(String(company.id));
            await firestoreRef.set({
              id: company.id,
              name: company.name || store.name,
              street: company.address?.street || store.address_line_1,
              city: company.address?.city || store.city,
              state: company.address?.state || store.state,
              zip: company.address?.postal_code || store.postal_code,
              phone: company.phone_numbers?.[0]?.number || store.phone || '',
              email: company.email?.email || store.email || '',
              'On Store Locator cf_715755': 'checked',
              'on_store_locator': true,
              updatedAt: new Date(),
            }, { merge: true });
            console.log(`✅ Synced company ${company.id} to Firestore`);
          } catch (firestoreError) {
            console.error(`⚠️ Failed to sync to Firestore:`, firestoreError);
            // Don't fail the whole import if Firestore sync fails
          }
          
          return {
            success: true,
            row: rowNumber,
            storeName: store.name,
            companyId: company.id,
            companyName: company.name,
            action: 'updated'
          };
          
        } catch (error) {
          return {
            success: false,
            row: rowNumber,
            storeName: store.name,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });
      
      try {
        // Wait for all promises in the batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        batchResults.forEach(result => {
          if (result.success) {
            results.processed++;
            if (result.action === 'updated') results.updated++;
            if (result.action === 'created') results.created++;
            console.log(`Successfully processed ${result.storeName}`);
          } else {
            results.skipped++;
            results.errors.push({
              row: result.row,
              storeName: result.storeName,
              error: result.error || 'Unknown error'
            });
            console.error(`Error processing row ${result.row} (${result.storeName}):`, result.error);
          }
        });
        
        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < stores.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (batchError) {
        console.error(`Error processing batch starting at row ${i + 2}:`, batchError);
        results.skipped += batch.length;
        results.errors.push({
          row: i + 2,
          error: `Batch processing error: ${batchError instanceof Error ? batchError.message : String(batchError)}`
        });
      }
    }

    // Prepare response
    const response = {
      success: results.processed > 0,
      message: results.processed > 0 
        ? `Processed ${results.processed} stores (${results.updated} updated, ${results.skipped} skipped)`
        : 'No stores were processed due to errors',
      details: {
        total: results.total,
        processed: results.processed,
        updated: results.updated,
        created: results.created,
        skipped: results.skipped,
        errorCount: results.errors.length,
        sampleErrors: results.errors.slice(0, 10), // Only return first 10 errors to avoid huge responses
        hasMoreErrors: results.errors.length > 10 ? results.errors.length - 10 : 0
      }
    };

    // Return appropriate status code based on results
    const statusCode = results.processed > 0 
      ? results.errors.length > 0 ? 207 : 200  // 207 for partial success
      : 400;  // 400 if nothing was processed due to errors

    return NextResponse.json(response, { status: statusCode });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV file into array of store objects
 */
function parseCSV(text: string): CSVStore[] {
  console.log('=== Starting CSV Parsing ===');
  console.log('Raw input length:', text.length, 'characters');
  
  // Log first 500 characters to help with debugging
  console.log('First 500 chars of input:', text.substring(0, 500));
  
  // Normalize line endings and remove empty lines
  const lines = text
    .replace(/\r\n/g, '\n')  // Convert Windows line endings to Unix
    .replace(/\r/g, '\n')     // Handle old Mac line endings
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  console.log(`Found ${lines.length} non-empty lines in CSV`);
  
  if (lines.length < 2) {
    const errorMsg = 'CSV must have at least 2 lines (header + data)';
    console.error('CSV Error:', errorMsg);
    throw new Error(errorMsg);
  }

  // Parse headers and normalize them (trim and lowercase)
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  console.log('CSV Headers:', headers);
  
  // Map of possible header variations to their canonical names
  const headerMappings: Record<string, string> = {
    // Exact matches first
    'stockist_id': 'stockist_id',
    'name': 'name',
    'address_line_1': 'address_line_1',
    'address_line_2': 'address_line_2',
    'city': 'city',
    'state': 'state',
    'postal_code': 'postal_code',
    'country': 'country',
    'phone': 'phone',
    'website': 'website',
    'email': 'email',
    'logo_url': 'logo_url',
    'notes': 'notes',
    'priority': 'priority',
    'visible': 'visible',
    
    // Common variations (including actual CSV headers)
    'stockist': 'stockist_id',
    'stockist ': 'stockist_id',  // CSV has trailing space
    'stockist id': 'stockist_id',
    'store name': 'name',
    'address': 'address_line_1',
    'address line 1': 'address_line_1',
    'address1': 'address_line_1',
    'address line 2': 'address_line_2',
    'address2': 'address_line_2',
    'state/province': 'state',  // CSV uses this format
    'postal code': 'postal_code',
    'zip': 'postal_code',
    'zip code': 'postal_code',
    'phone number': 'phone',
    'email address': 'email',
    'website url': 'website',
    'logo': 'logo_url',
    'logo url': 'logo_url',
    'logo_uri': 'logo_url',
    'logo uri': 'logo_url',
    'is_visible': 'visible',
    'is visible': 'visible',
    'show': 'visible',
    'active': 'visible'
  };

  // Normalize headers using the mappings
  const normalizedHeaders = headers.map(header => {
    const normalized = headerMappings[header] || header;
    console.log(`Mapped header: "${header}" -> "${normalized}"`);
    return normalized;
  });
  
  const requiredFields = ['stockist_id', 'name', 'address_line_1', 'city', 'state', 'postal_code'];
  
  // Validate that all required fields are present in the normalized headers
  const missingFields = requiredFields.filter(field => !normalizedHeaders.includes(field));
  if (missingFields.length > 0) {
    const errorMsg = `Missing required CSV columns: ${missingFields.join(', ')}. Found: ${normalizedHeaders.join(', ')}`;
    console.error('CSV Header Error:', errorMsg);
    throw new Error(errorMsg);
  }

  const stores: CSVStore[] = [];
  const errors: string[] = [];

  // Process each data row with detailed error reporting
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    console.log(`\nProcessing line ${i + 1}:`, line);
    
    if (!line) {
      console.log('Skipping empty line');
      continue;
    }

    try {
      // Parse CSV line considering quoted values with commas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          // Toggle inQuotes when we hit a quote
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // Split on comma only when not in quotes
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      // Add the last value
      values.push(current.trim());
      
      console.log(`Line ${i + 1} parsed values:`, values);
      
      if (values.length !== normalizedHeaders.length) {
        throw new Error(`Expected ${normalizedHeaders.length} columns, found ${values.length}`);
      }

      // Build store object with type safety using normalized headers
      const store: Partial<CSVStore> = {};
      normalizedHeaders.forEach((header, index) => {
        if (values[index] !== undefined) {
          const value = values[index].trim();
          if (value) {  // Only set non-empty values
            (store as any)[header] = value;
          }
        }
      });
      
      console.log('Parsed store object:', JSON.stringify(store, null, 2));

      // Validate required fields with detailed error
      const missingValues = requiredFields.filter(field => {
        const value = store[field as keyof CSVStore];
        return value === undefined || value === '' || value === null;
      });
      
      if (missingValues.length > 0) {
        throw new Error(`Missing required values for: ${missingValues.join(', ')}`);
      }

      // Create validated store object
      const validStore: CSVStore = {
        stockist_id: store.stockist_id!,
        name: store.name!,
        address_line_1: store.address_line_1!,
        address_line_2: store.address_line_2,
        city: store.city!,
        state: store.state!,
        postal_code: store.postal_code!,
        country: store.country!,
        phone: store.phone,
        website: store.website,
        email: store.email
      };

      stores.push(validStore);
      console.log(`Successfully parsed store: ${validStore.name}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = `Row ${i + 1} error: ${errorMessage} (Line: "${line}")`;
      console.error(errorDetails);
      errors.push(errorDetails);
    }
  }

  // Final validation and reporting
  console.log('\n=== CSV Parsing Summary ===');
  console.log(`Total rows processed: ${lines.length - 1}`);
  console.log(`Successfully parsed: ${stores.length} stores`);
  console.log(`Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.warn('Encountered errors during parsing:', errors);
    if (stores.length === 0) {
      const errorMsg = `Failed to parse any valid rows. First error: ${errors[0]}`;
      console.error('Fatal error:', errorMsg);
      throw new Error(errorMsg);
    }
    console.warn(`Proceeding with ${stores.length} valid records despite ${errors.length} errors`);
  }

  return stores;
}
