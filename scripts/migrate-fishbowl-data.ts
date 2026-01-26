/**
 * Fishbowl Data Migration Script
 * Migrates fishbowl_customers, fishbowl_sales_orders, and fishbowl_soitems from Firebase to Supabase
 * Updates accounts.fishbowl_id and creates orders and order_items
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const COMPANY_ID = 'kanva-botanicals';
const BATCH_SIZE = 100;

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp);

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase credentials not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Track account name to ID mapping
const accountNameToId = new Map<string, string>();
// Track order number to document ID mapping
const orderNumberToId = new Map<string, string>();

/**
 * Step 1: Load existing accounts and create name mapping
 */
async function loadAccountMapping() {
  console.log('📋 Loading account mapping...');
  
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, name, fishbowl_id')
    .eq('company_id', COMPANY_ID);

  if (error) {
    console.error('❌ Error loading accounts:', error);
    throw error;
  }

  accounts?.forEach((account) => {
    // Map by name (case-insensitive, normalized)
    const normalizedName = account.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    accountNameToId.set(normalizedName, account.id);
  });

  console.log(`✅ Loaded ${accountNameToId.size} account mappings`);
}

/**
 * Step 2: Migrate fishbowl_customers and update accounts.fishbowl_id
 */
async function migrateFishbowlCustomers() {
  console.log('\n📦 Migrating fishbowl_customers...');
  
  const customersRef = collection(firestoreDb, 'fishbowl_customers');
  const snapshot = await getDocs(customersRef);
  
  console.log(`Found ${snapshot.size} fishbowl customers`);
  
  let updated = 0;
  let notFound = 0;
  const notFoundList: string[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Use actual Firebase schema field names
    const customerName = data.name;
    const fishbowlId = data.accountNumber || doc.id;
    
    if (!customerName) {
      console.log(`⚠️  Skipping customer ${doc.id} - no name`);
      continue;
    }
    
    // Find matching account - use same normalization as loading
    const normalizedName = customerName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const accountId = accountNameToId.get(normalizedName);
    
    if (accountId) {
      // Update account with fishbowl_id
      const { error } = await supabase
        .from('accounts')
        .update({ fishbowl_id: fishbowlId })
        .eq('id', accountId);
      
      if (error) {
        console.error(`❌ Error updating account ${customerName}:`, error);
      } else {
        updated++;
      }
    } else {
      notFound++;
      if (notFoundList.length < 20) {
        notFoundList.push(customerName);
      }
    }
  }
  
  console.log(`✅ Updated ${updated} accounts with fishbowl_id`);
  console.log(`⚠️  ${notFound} customers not found in accounts`);
  
  if (notFoundList.length > 0) {
    console.log('Sample not found customers:', notFoundList);
  }
}

/**
 * Step 3: Migrate fishbowl_sales_orders to orders table
 */
async function migrateFishbowlSalesOrders() {
  console.log('\n📦 Migrating fishbowl_sales_orders...');
  
  const ordersRef = collection(firestoreDb, 'fishbowl_sales_orders');
  const snapshot = await getDocs(ordersRef);
  
  console.log(`Found ${snapshot.size} fishbowl sales orders`);
  
  const ordersToInsert = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Find matching account by customer name (using Firebase schema field names)
    const customerName = data.customerName;
    const normalizedName = customerName ? customerName.toLowerCase().trim().replace(/[^a-z0-9]/g, '') : null;
    const accountId = normalizedName ? accountNameToId.get(normalizedName) : null;
    
    // salesOrderId is the internal Fishbowl ID, soNumber is the actual SO number
    const salesOrderId = data.salesOrderId;
    const soNumber = data.soNumber;
    
    const order = {
      id: doc.id,
      company_id: COMPANY_ID,
      source: 'fishbowl',
      fishbowl_order_number: soNumber || salesOrderId || doc.id,
      account_id: accountId || null,
      customer_name: customerName || null,
      customer_id: data.customerId || null,
      order_date: data.commissionDate || data.postingDate || null,
      ship_date: null, // Not in Firebase schema
      status: null, // Not in Firebase schema
      total_amount: 0, // Will be calculated from items
      total_tax: 0,
      shipping_cost: 0,
      sales_person: data.salesPerson || null,
      shipping_street: null,
      shipping_city: null,
      shipping_state: null,
      shipping_zip: null,
      carrier: null,
      tracking_number: null,
      notes: null,
      created_at: data.postingDate || new Date().toISOString(),
      updated_at: data.updatedAt || new Date().toISOString(),
    };
    
    // Track mapping of salesOrderId (internal ID) to document ID for order items
    if (salesOrderId) {
      orderNumberToId.set(String(salesOrderId), doc.id);
    }
    
    ordersToInsert.push(order);
    
    // Insert in batches
    if (ordersToInsert.length >= BATCH_SIZE) {
      const { error } = await supabase.from('orders').upsert(ordersToInsert);
      if (error) {
        console.error('❌ Error inserting orders batch:', error);
      } else {
        console.log(`✅ Inserted ${ordersToInsert.length} orders`);
      }
      ordersToInsert.length = 0;
    }
  }
  
  // Insert remaining orders
  if (ordersToInsert.length > 0) {
    const { error } = await supabase.from('orders').upsert(ordersToInsert);
    if (error) {
      console.error('❌ Error inserting final orders batch:', error);
    } else {
      console.log(`✅ Inserted ${ordersToInsert.length} orders`);
    }
  }
  
  console.log(`✅ Migrated ${snapshot.size} sales orders`);
}

/**
 * Step 4: Migrate fishbowl_soitems to order_items table
 */
async function migrateFishbowlSOItems() {
  console.log('\n📦 Migrating fishbowl_soitems...');
  
  const itemsRef = collection(firestoreDb, 'fishbowl_soitems');
  const snapshot = await getDocs(itemsRef);
  
  console.log(`Found ${snapshot.size} fishbowl SO items`);
  
  const itemsToInsert = [];
  let skipped = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Get salesOrderId from item (this links to fishbowl_sales_orders.salesOrderId)
    const salesOrderId = data.salesOrderId;
    
    if (!salesOrderId) {
      skipped++;
      continue;
    }
    
    // Map salesOrderId to the actual order document ID
    const actualOrderId = orderNumberToId.get(String(salesOrderId));
    
    if (!actualOrderId) {
      // Order doesn't exist in our orders table, skip this item
      skipped++;
      continue;
    }
    
    const item = {
      id: doc.id,
      company_id: COMPANY_ID,
      order_id: actualOrderId,  // Use the mapped document ID
      product_id: null, // Not in Firebase schema
      product_name: data.product || null,
      product_number: data.partNumber || null,
      quantity: Math.round(parseFloat(data.quantity || 0)),
      unit_price: parseFloat(data.unitPrice || 0),
      line_total: parseFloat(data.totalPrice || 0),
      created_at: data.postingDate || new Date().toISOString(),
    };
    
    itemsToInsert.push(item);
    
    // Insert in batches
    if (itemsToInsert.length >= BATCH_SIZE) {
      const { error } = await supabase.from('order_items').upsert(itemsToInsert);
      if (error) {
        console.error('❌ Error inserting order items batch:', error);
      } else {
        console.log(`✅ Inserted ${itemsToInsert.length} order items`);
      }
      itemsToInsert.length = 0;
    }
  }
  
  // Insert remaining items
  if (itemsToInsert.length > 0) {
    const { error } = await supabase.from('order_items').upsert(itemsToInsert);
    if (error) {
      console.error('❌ Error inserting final order items batch:', error);
    } else {
      console.log(`✅ Inserted ${itemsToInsert.length} order items`);
    }
  }
  
  console.log(`✅ Migrated ${snapshot.size - skipped} SO items`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} items (no order ID)`);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Fishbowl Data Migration\n');
  console.log(`Company ID: ${COMPANY_ID}`);
  console.log(`Firebase Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
  console.log(`Supabase URL: ${supabaseUrl}\n`);
  
  try {
    // Step 1: Load account mapping
    await loadAccountMapping();
    
    // Step 2: Migrate fishbowl_customers and update accounts
    await migrateFishbowlCustomers();
    
    // Step 3: Migrate sales orders
    await migrateFishbowlSalesOrders();
    
    // Step 4: Migrate SO items
    await migrateFishbowlSOItems();
    
    console.log('\n✅ Fishbowl migration complete!');
    console.log('\n📊 Next steps:');
    console.log('1. Run fix-active-customers.sql to update is_active_customer based on fishbowl_id');
    console.log('2. Verify data in Supabase dashboard');
    console.log('3. Test order display in the portal');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
