/**
 * CRM Data Migration Script: Firebase → Supabase
 * Migrates people, tasks, opportunities, and leads
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Firebase config (use your actual config)
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Verify environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Make sure .env.local contains:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Missing Firebase environment variables!');
  console.error('Make sure .env.local contains:');
  console.error('  NEXT_PUBLIC_FIREBASE_API_KEY=...');
  console.error('  NEXT_PUBLIC_FIREBASE_PROJECT_ID=...');
  process.exit(1);
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPANY_ID = 'kanva-botanicals'; // Your company ID
const BATCH_SIZE = 100; // Insert in batches

// ============================================
// PEOPLE MIGRATION
// ============================================
async function migratePeople() {
  console.log('🔄 Starting people migration...');
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_people'));
    const total = snapshot.size;
    console.log(`📊 Found ${total} people to migrate`);

    let migrated = 0;
    let batch: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      const person = {
        id: doc.id,
        company_id: COMPANY_ID,
        source: data.source || 'copper',
        
        // Core identity
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        name: data.name,
        title: data.title || null,
        email: data.email || null,
        phone: data.phone || null,
        
        // Company association
        company_name: data.companyName || null,
        account_id: data.companyId || null,
        
        // Address
        street: data.street || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postalCode || null,
        country: data.country || null,
        
        // Contact details (JSONB)
        phone_numbers: data.phoneNumbers || [],
        emails: data.emails || [],
        websites: data.websites || [],
        socials: data.socials || [],
        
        // Copper metadata
        copper_id: data.id || data.copper_id || null,
        contact_type_id: data.contactTypeId || null,
        assignee_id: data.assigneeId || null,
        owner_id: data.ownerId || null,
        interaction_count: data.interactionCount || 0,
        
        // Custom fields
        region: data.cf_680701 || null,
        segment: data.cf_698149 || null,
        account_type: data.cf_675914 || null,
        customer_priority: data.cf_698121 || null,
        organization_level: data.cf_698362 || null,
        account_number: data.cf_713477 || null,
        account_order_id: data.cf_698467 || null,
        
        // Tracking
        date_created: data.dateCreated?.toDate?.() || null,
        date_modified: data.dateModified?.toDate?.() || null,
        imported_at: data.importedAt?.toDate?.() || new Date(),
        synced_from_copper_api_at: data.syncedFromCopperApiAt?.toDate?.() || null,
      };

      batch.push(person);

      // Insert in batches
      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from('people').insert(batch);
        if (error) {
          console.error('Error inserting people batch:', error);
        } else {
          migrated += batch.length;
          console.log(`✅ Migrated ${migrated}/${total} people`);
        }
        batch = [];
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      const { error } = await supabase.from('people').insert(batch);
      if (error) {
        console.error('Error inserting final people batch:', error);
      } else {
        migrated += batch.length;
      }
    }

    console.log(`✅ People migration complete: ${migrated}/${total}`);
  } catch (error) {
    console.error('❌ People migration failed:', error);
    throw error;
  }
}

// ============================================
// TASKS MIGRATION
// ============================================
async function migrateTasks() {
  console.log('🔄 Starting tasks migration...');
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_tasks'));
    const total = snapshot.size;
    console.log(`📊 Found ${total} tasks to migrate`);

    let migrated = 0;
    let batch: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      const task = {
        id: doc.id,
        company_id: COMPANY_ID,
        source: data.source || 'copper',
        
        // Core fields
        name: data.Name || data.name,
        details: data.Details || data.details || null,
        status: data.Status || data.status || null,
        priority: data.Priority || data.priority || null,
        
        // Relationships
        related_to_type: null, // Set if you have this data
        related_to_id: null,
        account_id: null,
        person_id: null,
        opportunity_id: null,
        
        // Ownership
        owner: data.Owner || null,
        owner_id: data['Owner Id'] || data.ownerId || null,
        assignee_id: data.assigneeId || null,
        
        // Dates
        due_date: data.dueDate ? new Date(data.dueDate) : null,
        completed_at: data['Completed At'] ? new Date(data['Completed At']) : null,
        reminder_date: null,
        
        // Copper metadata
        copper_id: data['Copper ID'] || data.id || null,
        tags: data.Tags || null,
        
        // Custom fields
        account_number: data['Account Number cf_698260'] || null,
        account_order_id: data['Account Order ID cf_698467'] || null,
        
        // Tracking
        imported_at: new Date(),
      };

      batch.push(task);

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from('tasks').insert(batch);
        if (error) {
          console.error('Error inserting tasks batch:', error);
        } else {
          migrated += batch.length;
          console.log(`✅ Migrated ${migrated}/${total} tasks`);
        }
        batch = [];
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from('tasks').insert(batch);
      if (error) {
        console.error('Error inserting final tasks batch:', error);
      } else {
        migrated += batch.length;
      }
    }

    console.log(`✅ Tasks migration complete: ${migrated}/${total}`);
  } catch (error) {
    console.error('❌ Tasks migration failed:', error);
    throw error;
  }
}

// ============================================
// OPPORTUNITIES MIGRATION
// ============================================
async function migrateOpportunities() {
  console.log('🔄 Starting opportunities migration...');
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_opportunities'));
    const total = snapshot.size;
    console.log(`📊 Found ${total} opportunities to migrate`);

    let migrated = 0;
    let batch: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      const opportunity = {
        id: doc.id,
        company_id: COMPANY_ID,
        source: data.source || 'copper',
        
        // Core fields
        name: data.Name || data.name,
        details: data.Details || null,
        value: data.Value || data.value || null,
        
        // Pipeline & Status
        pipeline: data.Pipeline || data.pipeline || null,
        stage: data.Stage || data.stage || null,
        status: data.Status || data.status || null,
        win_probability: data['Win Probability'] ? parseInt(data['Win Probability'].replace('%', '')) : null,
        priority: data.Priority || null,
        loss_reason: data['Loss Reason'] || null,
        
        // Relationships
        account_id: data.companyId || data['Company Id'] || null,
        company_name: data.Company || data.company || null,
        primary_contact: data['Primary Person Contact'] || data.primaryContact || null,
        primary_contact_id: null,
        
        // Ownership
        owner: data.Owner || null,
        owner_id: data['Owner Id'] || null,
        assignee_id: null,
        
        // Dates
        close_date: data['Close Date'] ? new Date(data['Close Date']) : null,
        completed_date: data['Completed Date'] ? new Date(data['Completed Date']) : null,
        lead_created_at: data['Lead Created At'] ? new Date(data['Lead Created At']) : null,
        last_stage_at: data['Last Stage At'] ? new Date(data['Last Stage At']) : null,
        days_in_stage: data['Days in Stage'] || null,
        inactive_days: data['Inactive Days'] || null,
        
        // Financial details
        converted_value: data['Converted Value'] || null,
        currency: data.Currency || null,
        exchange_rate: data['Exchange Rate'] || null,
        
        // Order details
        so_number: data['SO Number cf_698395'] || null,
        account_order_id: data['Account Order ID cf_698467'] || null,
        customer_po: data['Customer PO cf_712764'] || null,
        
        // Shipping
        shipping_amount: data['Shipping Amount cf_698427'] || null,
        shipping_status: data['Shipping Status cf_706518'] || null,
        shipping_method: data['Shipping Method cf_698435'] || null,
        ship_date: data['Ship Date cf_698436'] ? new Date(data['Ship Date cf_698436']) : null,
        delivery_date: data['Delivery Date cf_706517'] ? new Date(data['Delivery Date cf_706517']) : null,
        tracking_number: data['Tracking Number cf_698433'] || null,
        carrier: data['Carrier cf_706513'] || null,
        
        // Financial breakdown
        subtotal: data['Subtotal cf_698438'] || null,
        tax_amount: data['Tax Amount cf_698439'] || null,
        discount_amount: data['Discount Amount cf_698440'] || null,
        order_total: data['Order Total cf_698441'] || null,
        
        // Payment
        payment_terms: data['Payment Terms cf_698434'] || null,
        payment_status: data['Payment Status cf_698399'] || null,
        
        // Products
        products_involved: data['Products Involved cf_705070'] || null,
        
        // Copper metadata
        copper_id: data['Copper ID'] || data.id || null,
        copper_url: data.copperUrl || null,
        tags: data.Tags || null,
        interaction_count: data['Interaction Count'] || 0,
        last_contacted: data['Last Contacted'] ? new Date(data['Last Contacted']) : null,
        
        // Custom fields
        region: data['Region cf_680701'] || null,
        segment: data['Segment cf_698149'] || null,
        account_type: data['Account Type cf_675914'] || null,
        customer_priority: data['Customer Priority cf_698121'] || null,
        business_model: data['Business Model cf_698356'] || null,
        account_number: data['Account Number cf_698260'] || null,
        sale_type: data['Sale Type cf_710692'] || null,
        
        // Sync tracking
        sync_status: data['Sync Status cf_698445'] || null,
        fishbowl_status: data['Fishbowl Status cf_698443'] || null,
        
        // Tracking
        imported_at: new Date(),
      };

      batch.push(opportunity);

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from('opportunities').insert(batch);
        if (error) {
          console.error('Error inserting opportunities batch:', error);
        } else {
          migrated += batch.length;
          console.log(`✅ Migrated ${migrated}/${total} opportunities`);
        }
        batch = [];
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from('opportunities').insert(batch);
      if (error) {
        console.error('Error inserting final opportunities batch:', error);
      } else {
        migrated += batch.length;
      }
    }

    console.log(`✅ Opportunities migration complete: ${migrated}/${total}`);
  } catch (error) {
    console.error('❌ Opportunities migration failed:', error);
    throw error;
  }
}

// ============================================
// LEADS MIGRATION
// ============================================
async function migrateLeads() {
  console.log('🔄 Starting leads migration...');
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_leads'));
    const total = snapshot.size;
    console.log(`📊 Found ${total} leads to migrate`);

    let migrated = 0;
    let batch: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      const lead = {
        id: doc.id,
        company_id: COMPANY_ID,
        source: data.source || 'copper',
        
        // Core identity
        first_name: data['First Name'] || data.firstName || null,
        last_name: data['Last Name'] || data.lastName || null,
        name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        email: data.Email || data.email || null,
        phone: data['Phone Number'] || data.phone || null,
        title: data.Title || null,
        
        // Company/Account
        account: data.Account || null,
        company: data.company || null,
        account_number: data['Account Number cf_698260'] || null,
        
        // Address
        street: data.Street || null,
        city: data.City || null,
        state: data.State || data['State cf_698130'] || null,
        postal_code: data['Postal Code'] || null,
        country: data.Country || null,
        
        // Lead details
        status: data.Status || data.status || null,
        lead_temperature: data['Lead Temperature cf_698148'] || null,
        value: data.Value || null,
        
        // Conversion tracking
        converted_at: data['Converted At'] ? new Date(data['Converted At']) : null,
        converted_contact_id: data['Converted Contact Id'] || null,
        converted_opportunity_id: data['Converted Opportunity Id'] || null,
        converted_value: data['Converted Value'] || null,
        
        // Ownership
        owned_by: data['Owned By'] || null,
        owner_id: data['Owner Id'] || null,
        
        // Activity
        last_status_at: data['Last Status At'] ? new Date(data['Last Status At']) : null,
        last_contacted: data['Last Contacted'] ? new Date(data['Last Contacted']) : null,
        follow_up_date: data['Follow-Up Date cf_683961'] ? new Date(data['Follow-Up Date cf_683961']) : null,
        inactive_days: data['Inactive Days'] || 0,
        interaction_count: data['Interaction Count'] || 0,
        
        // Classification
        region: data['Region cf_680701'] || null,
        segment: data['Segment cf_698149'] || null,
        customer_priority: data['Customer Priority cf_698121'] || null,
        business_model: data['Business Model cf_698356'] || null,
        account_type: data['Account Type cf_675914'] || null,
        
        // Details
        details: data.Details || null,
        prospect_notes: data['Prospect Notes cf_698137'] || null,
        
        // Copper metadata
        copper_id: data['Copper ID'] || data.id || null,
        copper_url: data.copperUrl || null,
        tags: data.Tags || null,
        
        // Contact details
        work_email: data['Work Email cf_698503'] || null,
        website: data.Website || null,
        
        // Tracking
        imported_at: new Date(),
      };

      batch.push(lead);

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from('leads').insert(batch);
        if (error) {
          console.error('Error inserting leads batch:', error);
        } else {
          migrated += batch.length;
          console.log(`✅ Migrated ${migrated}/${total} leads`);
        }
        batch = [];
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from('leads').insert(batch);
      if (error) {
        console.error('Error inserting final leads batch:', error);
      } else {
        migrated += batch.length;
      }
    }

    console.log(`✅ Leads migration complete: ${migrated}/${total}`);
  } catch (error) {
    console.error('❌ Leads migration failed:', error);
    throw error;
  }
}

// ============================================
// MAIN MIGRATION
// ============================================
async function main() {
  console.log('🚀 Starting CRM data migration...\n');
  
  try {
    await migratePeople();
    console.log('\n');
    
    await migrateTasks();
    console.log('\n');
    
    await migrateOpportunities();
    console.log('\n');
    
    await migrateLeads();
    console.log('\n');
    
    console.log('✅ All migrations complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
main();
