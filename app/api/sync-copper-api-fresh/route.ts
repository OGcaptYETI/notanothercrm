import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

// Global progress tracker for this sync operation
let syncProgress = {
  inProgress: false,
  currentPage: 0,
  totalFetched: 0,
  totalProcessed: 0,
  totalToProcess: 0,
  status: 'idle' as 'idle' | 'fetching' | 'processing' | 'complete' | 'error',
  message: '',
};

interface CopperCompany {
  id: number;
  name: string;
  assignee_id?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  phone_numbers?: Array<{ number: string; category: string }>;
  email_domain?: string;
  websites?: Array<{ url: string; category: string }>;
  socials?: Array<{ url: string; category: string }>;
  details?: string;
  tags?: string[];
  date_created?: number;
  date_modified?: number;
  interaction_count?: number;
  custom_fields?: Array<{
    custom_field_definition_id: number;
    value: any;
  }>;
  // Store ALL fields from Copper
  [key: string]: any;
}

interface SyncStats {
  totalFetched: number;
  activeFetched: number;
  updated: number;
  created: number;
  errors: number;
  errorDetails: Array<{ id: number; name: string; error: string }>;
}

/**
 * Direct Copper API → copper_companies Firestore sync
 * Pulls ACTIVE companies with ALL fields directly from Copper API
 */
export async function POST(request: NextRequest) {
  try {
    // Reset progress
    syncProgress = {
      inProgress: true,
      currentPage: 0,
      totalFetched: 0,
      totalProcessed: 0,
      totalToProcess: 0,
      status: 'fetching',
      message: 'Starting Copper API sync...',
    };

    console.log('\n' + '='.repeat(80));
    console.log('🔥 DIRECT COPPER API SYNC → copper_companies');
    console.log('='.repeat(80) + '\n');

    const stats: SyncStats = {
      totalFetched: 0,
      activeFetched: 0,
      updated: 0,
      created: 0,
      errors: 0,
      errorDetails: [],
    };

    // Get Copper API credentials
    const copperApiKey = process.env.COPPER_API_KEY;
    const copperEmail = process.env.COPPER_USER_EMAIL;

    if (!copperApiKey || !copperEmail) {
      throw new Error('Copper API credentials not configured (COPPER_API_KEY, COPPER_USER_EMAIL)');
    }

    console.log('📡 Fetching ACTIVE companies from Copper API...');
    console.log(`   Using email: ${copperEmail}`);
    console.log(`   Filtering for: Active Customer cf_712751 = true\n`);

    // Copper API: Search for companies
    // Filter for ACTIVE companies using custom field
    // For checkbox fields, use boolean true (not string "checked")
    const searchBody = {
      page_size: 200,
      sort_by: 'name',
      custom_fields: [
        {
          custom_field_definition_id: 712751, // Active Customer cf_712751
          value: true, // Boolean true for checked checkbox
        },
      ],
    };

    let allCompanies: CopperCompany[] = [];
    let currentPage = 1;
    let hasMore = true;

    // Fetch first page to get total count
    const firstPageResponse = await fetch(
      `https://api.copper.com/developer_api/v1/companies/search?page_number=1&page_size=200`,
      {
        method: 'POST',
        headers: {
          'X-PW-AccessToken': copperApiKey,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': copperEmail,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
      }
    );

    if (!firstPageResponse.ok) {
      throw new Error(`Copper API error: ${firstPageResponse.status}`);
    }

    const firstPageData = await firstPageResponse.json();
    allCompanies.push(...firstPageData);
    
    console.log(`   ✅ Fetched ${firstPageData.length} companies from page 1`);
    
    // Set estimated total for progress tracking (will be updated as we fetch)
    if (firstPageData.length === 200) {
      // Estimate ~8 pages (1600 companies) - will update as we go
      syncProgress.totalToProcess = 200 * 8;
      syncProgress.message = 'Fetching companies from Copper API...';
    }
    
    // Continue fetching remaining pages if needed
    currentPage = 2;
    hasMore = firstPageData.length === 200;

    // Fetch all pages
    while (hasMore) {
      syncProgress.currentPage = currentPage;
      syncProgress.message = `Fetching page ${currentPage} from Copper API...`;
      console.log(`   Fetching page ${currentPage}...`);

      const response = await fetch('https://api.copper.com/developer_api/v1/companies/search', {
        method: 'POST',
        headers: {
          'X-PW-AccessToken': copperApiKey,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': copperEmail,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...searchBody,
          page_number: currentPage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Copper API error: ${response.status} - ${errorText}`);
      }

      const companies: CopperCompany[] = await response.json();
      console.log(`   ✅ Fetched ${companies.length} companies from page ${currentPage}`);

      if (companies.length === 0) {
        hasMore = false;
      } else {
        allCompanies = allCompanies.concat(companies);
        currentPage++;
        
        // Copper API rate limit: max 10 requests/second
        // Add small delay between pages
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    }

    stats.totalFetched = allCompanies.length;
    stats.activeFetched = allCompanies.length; // All fetched are active (filtered by API)
    syncProgress.totalFetched = stats.activeFetched;
    syncProgress.totalToProcess = stats.activeFetched;
    syncProgress.status = 'processing';
    syncProgress.message = `Processing ${stats.activeFetched} companies...`;
    console.log(`\n✅ Total ACTIVE companies fetched: ${stats.activeFetched}\n`);

    // Process each company and update Firestore
    console.log('💾 Updating copper_companies collection...\n');

    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 450;

    for (const company of allCompanies) {
      try {
        // Extract custom fields - store ALL fields with their IDs
        const customFieldsMap: Record<string, any> = {};
        const customFieldsRaw: Array<{ id: number; value: any }> = [];
        
        if (company.custom_fields) {
          company.custom_fields.forEach(cf => {
            const fieldId = cf.custom_field_definition_id;
            
            // Store with cf_ prefix for easy identification
            customFieldsMap[`cf_${fieldId}`] = cf.value;
            
            // Also store raw for metadata review
            customFieldsRaw.push({
              id: fieldId,
              value: cf.value
            });
          });
        }

        // Build Firestore document - store EVERYTHING from Copper
        const firestoreDoc: any = {
          // Core Copper fields
          id: company.id,
          name: company.name || '',
          assignee_id: company.assignee_id || null,
          
          // Standard address fields
          address: company.address || {},
          Street: company.address?.street || '',
          city: company.address?.city || '',
          State: company.address?.state || '',
          'Postal Code': company.address?.postal_code || '',
          country: company.address?.country || '',
          
          // Contact info
          phone_numbers: company.phone_numbers || [],
          phone: company.phone_numbers?.[0]?.number || '',
          email_domain: company.email_domain || '',
          websites: company.websites || [],
          socials: company.socials || [],
          
          // Additional Copper fields
          details: company.details || '',
          tags: company.tags || [],
          date_created: company.date_created || null,
          date_modified: company.date_modified || null,
          interaction_count: company.interaction_count || 0,
          
          // Custom fields (flattened)
          ...customFieldsMap,
          
          // Raw custom fields for metadata review
          custom_fields_raw: customFieldsRaw,
          
          // Store complete raw Copper data for reference
          copper_raw_data: company,
          
          // Metadata
          syncedFromCopperApiAt: Timestamp.now(),
          source: 'copper_api_direct',
        };

        // Use Copper ID as Firestore document ID
        const docRef = adminDb.collection('copper_companies').doc(String(company.id));
        
        // Check if exists
        const existingDoc = await docRef.get();
        
        if (existingDoc.exists) {
          batch.update(docRef, firestoreDoc);
          stats.updated++;
        } else {
          batch.set(docRef, {
            ...firestoreDoc,
            createdAt: Timestamp.now(),
          });
          stats.created++;
        }
        
        batchCount++;

        // Commit batch if needed
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} updates`);
          batch = adminDb.batch();
          batchCount = 0;
        }

        // Update progress
        syncProgress.totalProcessed = stats.updated + stats.created;
        syncProgress.message = `Processing: ${syncProgress.totalProcessed} / ${syncProgress.totalToProcess}`;
        
        // Log progress every 50 companies
        if ((stats.updated + stats.created) % 50 === 0) {
          console.log(`   Progress: ${stats.updated + stats.created} / ${stats.totalFetched}`);
        }

      } catch (error: any) {
        stats.errors++;
        stats.errorDetails.push({
          id: company.id,
          name: company.name || 'Unknown',
          error: error.message,
        });
        console.error(`   ❌ Error processing ${company.name}:`, error.message);
      }
    }

    // Commit final batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Committed final batch of ${batchCount} updates`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COPPER API SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Active Companies: ${stats.activeFetched}`);
    console.log(`Created:                ${stats.created}`);
    console.log(`Updated:                ${stats.updated}`);
    console.log(`Errors:                 ${stats.errors}`);
    console.log('='.repeat(80) + '\n');

    // Mark as complete
    syncProgress.status = 'complete';
    syncProgress.inProgress = false;
    syncProgress.message = `Sync complete: ${stats.activeFetched} companies processed`;

    if (stats.errorDetails.length > 0) {
      console.log('❌ Errors:');
      stats.errorDetails.forEach(err => {
        console.log(`   ${err.name} (ID: ${err.id}): ${err.error}`);
      });
    }

    return NextResponse.json({
      success: true,
      stats,
      message: `Synced ${stats.activeFetched} active companies from Copper API to copper_companies collection`,
    });

  } catch (error: any) {
    console.error('❌ Copper API sync error:', error);
    syncProgress.status = 'error';
    syncProgress.inProgress = false;
    syncProgress.message = `Error: ${error.message}`;
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync progress
export async function GET(request: NextRequest) {
  return NextResponse.json(syncProgress);
}
