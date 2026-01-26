/**
 * Migration Script: Firestore → Supabase
 * Migrates all CRM data from Firestore to Supabase PostgreSQL
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import {
  decodeRegion,
  decodeSegment,
  decodeCustomerPriority,
  decodePaymentTerms,
  decodeShippingTerms,
  decodeCarrier,
  decodeBusinessModel,
  decodeOrganizationLevel,
} from '../lib/crm/customFields';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const firestoreDb = getFirestore();

// Initialize Supabase client with service role key (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase credentials not set in .env.local');
  console.error('   Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Parse account type from Copper data
 */
function parseAccountType(value: any): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return null;
}

/**
 * Migrate accounts from copper_companies to Supabase
 */
async function migrateAccounts() {
  console.log('\n🔄 Starting accounts migration...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const accountsRef = firestoreDb.collection('copper_companies');
  const snapshot = await accountsRef.get();
  
  console.log(`📊 Found ${snapshot.size} accounts in Firestore\n`);
  
  let migrated = 0;
  let errors = 0;
  const startTime = Date.now();
  const batchSize = 100; // Supabase handles batches well
  let batch: any[] = [];
  
  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      
      // Parse address
      const address = data.address || {};
      const street = address.street || data.street || data.Street || null;
      const city = address.city || data.city || data.City || null;
      const state = address.state || data.state || data.State || null;
      const zip = address.postal_code || data.zip || data['Postal Code'] || null;
      
      const account = {
        id: doc.id,
        source: 'copper',
        copper_id: data.id || null,
        name: data.name || 'Unknown',
        account_number: data.cf_713477 || null,
        website: data.websites?.[0] || null,
        phone: data.phone_numbers?.[0]?.number || null,
        email: data.email || null,
        shipping_street: street,
        shipping_city: city,
        shipping_state: state,
        shipping_zip: zip,
        account_type: parseAccountType(data.cf_675914 || data['Account Type cf_675914']),
        region: decodeRegion(data.cf_680701 || data['Region cf_680701']) || null,
        segment: decodeSegment(data.cf_698149 || data['Segment cf_698149']) || null,
        customer_priority: decodeCustomerPriority(data.cf_698121 || data['Customer Priority cf_698121']) || null,
        organization_level: decodeOrganizationLevel(data.cf_698362 || data['Organization Level cf_698362']) || null,
        business_model: decodeBusinessModel(data.cf_698356 || data['Business Model cf_698356']) || null,
        payment_terms: decodePaymentTerms(data.cf_698434 || data['Payment Terms cf_698434']) || null,
        shipping_terms: decodeShippingTerms(data.cf_698462 || data['Shipping Terms cf_698462']) || null,
        carrier_name: decodeCarrier(data.cf_698464 || data['Carrier cf_698464']) || null,
        sales_person: data['Owned By'] || null,
        total_orders: data.cf_698403 || null,
        total_spent: data.cf_698404 || null,
        last_order_date: data.cf_698406 ? new Date(data.cf_698406).toISOString() : null,
        first_order_date: data.cf_698405 ? new Date(data.cf_698405).toISOString() : null,
        primary_contact_id: data['Primary Contact ID']?.toString() || null,
        primary_contact_name: data['Primary Contact'] || null,
        account_order_id: data.cf_698467 || data['Account Order ID cf_698467'] || null,
        copper_url: data.copperUrl || null,
        contact_type: data['Contact Type'] || data.contact_type_id || null,
        inactive_days: data['Inactive Days'] || null,
        interaction_count: data['Interaction Count'] || data.interaction_count || null,
        last_contacted: data['Last Contacted'] ? new Date(data['Last Contacted'] * 1000).toISOString() : null,
        owned_by: data['Owned By'] || null,
        owner_id: data['Owner Id'] || data.assignee_id || null,
        status: data.cf_712751 || data['Active Customer cf_712751'] ? 'active' : 'prospect',
        is_active_customer: data.cf_712751 || data['Active Customer cf_712751'] || false,
        created_at: data['Created At'] ? new Date(data['Created At'] * 1000).toISOString() : new Date().toISOString(),
        updated_at: data['Updated At'] ? new Date(data['Updated At'] * 1000).toISOString() : new Date().toISOString(),
        notes: data.details || data.notes || null
      };
      
      batch.push(account);
      
      // Insert batch when it reaches batchSize
      if (batch.length >= batchSize) {
        const { error } = await supabase
          .from('accounts')
          .upsert(batch, { onConflict: 'id' });
        
        if (error) {
          console.error(`❌ Batch insert error:`, error);
          errors += batch.length;
        } else {
          migrated += batch.length;
        }
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (migrated / (Date.now() - startTime) * 1000).toFixed(1);
        console.log(`✅ Migrated ${migrated}/${snapshot.size} accounts (${rate} accounts/sec, ${elapsed}s elapsed)`);
        
        batch = [];
      }
    } catch (error) {
      console.error(`❌ Error migrating account ${doc.id}:`, error);
      errors++;
    }
  }
  
  // Insert remaining batch
  if (batch.length > 0) {
    const { error } = await supabase
      .from('accounts')
      .upsert(batch, { onConflict: 'id' });
    
    if (error) {
      console.error(`❌ Final batch insert error:`, error);
      errors += batch.length;
    } else {
      migrated += batch.length;
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgRate = (migrated / (Date.now() - startTime) * 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Accounts migration complete!');
  console.log(`   Total: ${snapshot.size}`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Time: ${totalTime}s`);
  console.log(`   Rate: ${avgRate} accounts/sec`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Verify migration
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');
  
  const { count: total } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true });
  
  const { count: active } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('is_active_customer', true);
  
  const { count: withRegion } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .not('region', 'is', null);
  
  const { count: withSegment } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .not('segment', 'is', null);
  
  console.log('📊 Supabase Database Stats:');
  console.log(`   Total accounts: ${total}`);
  console.log(`   Active customers: ${active}`);
  console.log(`   With region: ${withRegion}`);
  console.log(`   With segment: ${withSegment}`);
  console.log('');
}

/**
 * Main migration function
 */
async function main() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Firestore → Supabase Migration       ║');
    console.log('║  KanvaPortal CRM Database             ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    await migrateAccounts();
    await verifyMigration();
    
    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration
main();
