import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

interface CopperPerson {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  assignee_id?: number;
  company_id?: number;
  company_name?: string;
  contact_type_id?: number;
  title?: string;
  emails?: Array<{ email: string; category: string }>;
  phone_numbers?: Array<{ number: string; category: string }>;
  websites?: Array<{ url: string; category: string }>;
  socials?: Array<{ url: string; category: string }>;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  interaction_count?: number;
  date_created?: number;
  date_modified?: number;
  custom_fields?: Array<{
    custom_field_definition_id: number;
    value: any;
  }>;
}

interface SyncStats {
  totalFetched: number;
  updated: number;
  created: number;
  errors: number;
  errorDetails: Array<{ id: number; name: string; error: string }>;
}

/**
 * Direct Copper API → copper_people Firestore sync
 * Pulls ALL people (contacts) directly from Copper API
 */
export async function POST(request: NextRequest) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔥 DIRECT COPPER API SYNC → copper_people');
    console.log('='.repeat(80) + '\n');

    const stats: SyncStats = {
      totalFetched: 0,
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

    console.log('📡 Fetching people from Copper API...');
    console.log(`   Using email: ${copperEmail}\n`);

    // Copper API: Search for people
    const searchBody = {
      page_size: 200,
      sort_by: 'name',
    };

    let allPeople: CopperPerson[] = [];
    let currentPage = 1;
    let hasMore = true;

    // Fetch all pages
    while (hasMore) {
      console.log(`   Fetching page ${currentPage}...`);

      const response = await fetch('https://api.copper.com/developer_api/v1/people/search', {
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
        throw new Error(`Copper API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const people: CopperPerson[] = await response.json();
      console.log(`   ✓ Fetched ${people.length} people from page ${currentPage}`);

      if (people.length === 0) {
        hasMore = false;
      } else {
        allPeople = allPeople.concat(people);
        currentPage++;
      }

      // Safety limit (400 pages × 200 = 80,000 contacts max)
      if (currentPage > 400) {
        console.warn('⚠️  Reached page limit of 400, stopping pagination');
        hasMore = false;
      }
    }

    stats.totalFetched = allPeople.length;
    console.log(`\n📊 Total people fetched: ${stats.totalFetched}`);

    // Process each person
    console.log('\n💾 Saving to Firestore...\n');

    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const person of allPeople) {
      try {
        const docRef = adminDb.collection('copper_people').doc(String(person.id));

        // Check if exists
        const existingDoc = await docRef.get();
        const isNew = !existingDoc.exists;

        // Map custom fields
        const customFieldsMap: Record<string, any> = {};
        if (person.custom_fields) {
          person.custom_fields.forEach((cf) => {
            customFieldsMap[`cf_${cf.custom_field_definition_id}`] = cf.value;
          });
        }

        // Extract primary email and phone
        const primaryEmail = person.emails?.find(e => e.category === 'work')?.email || 
                           person.emails?.[0]?.email || '';
        const primaryPhone = person.phone_numbers?.find(p => p.category === 'work')?.number || 
                           person.phone_numbers?.[0]?.number || '';
        const primaryWebsite = person.websites?.find(w => w.category === 'work')?.url || 
                             person.websites?.[0]?.url || '';

        // Build person document
        const personData = {
          id: person.id,
          name: person.name || '',
          firstName: person.first_name || '',
          lastName: person.last_name || '',
          
          // Company relationship (Account)
          companyId: person.company_id || null,
          companyName: person.company_name || '',
          
          // Contact info
          contactTypeId: person.contact_type_id || null,
          title: person.title || '',
          email: primaryEmail,
          phone: primaryPhone,
          website: primaryWebsite,
          emails: person.emails || [],
          phoneNumbers: person.phone_numbers || [],
          websites: person.websites || [],
          socials: person.socials || [],
          
          // Address
          address: person.address || null,
          street: person.address?.street || '',
          city: person.address?.city || '',
          state: person.address?.state || '',
          postalCode: person.address?.postal_code || '',
          country: person.address?.country || '',
          
          // Assignment (Owner)
          assigneeId: person.assignee_id || null,
          
          // Interaction tracking
          interactionCount: person.interaction_count || 0,
          
          // Dates
          dateCreated: person.date_created ? Timestamp.fromMillis(person.date_created * 1000) : null,
          dateModified: person.date_modified ? Timestamp.fromMillis(person.date_modified * 1000) : null,
          
          // Custom fields (Region, State, Sales Org, Visibility, Primary Contact, Total Spent, Account ID, etc.)
          ...customFieldsMap,
          
          // Metadata
          syncedFromCopperApiAt: Timestamp.now(),
          source: 'copper_api_direct',
          importedAt: isNew ? Timestamp.now() : existingDoc.data()?.importedAt,
          updatedAt: Timestamp.now(),
        };

        // Add to batch
        batch.set(docRef, personData, { merge: true });
        batchCount++;

        if (isNew) {
          stats.created++;
        } else {
          stats.updated++;
        }

        // Commit batch if needed
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`   ✓ Committed batch of ${batchCount} people`);
          batch = adminDb.batch(); // Create new batch
          batchCount = 0;
        }

      } catch (error: any) {
        stats.errors++;
        stats.errorDetails.push({
          id: person.id,
          name: person.name,
          error: error.message,
        });
        console.error(`   ❌ Error processing person ${person.id} (${person.name}):`, error.message);
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✓ Committed final batch of ${batchCount} people`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log(`📊 Stats:`);
    console.log(`   Total Fetched: ${stats.totalFetched}`);
    console.log(`   Created: ${stats.created}`);
    console.log(`   Updated: ${stats.updated}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      stats,
      message: `Synced ${stats.totalFetched} people from Copper API to copper_people collection`,
    });

  } catch (error: any) {
    console.error('❌ Sync failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to sync Copper people',
      },
      { status: 500 }
    );
  }
}
