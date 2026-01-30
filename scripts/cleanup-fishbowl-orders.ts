import { adminDb } from '@/lib/firebase/admin';

interface CleanupStats {
  totalOrders: number;
  ordersWithCommas: number;
  ordersSanitized: number;
  errors: number;
}

async function cleanupFishbowlOrders() {
  console.log('\n🧹 FISHBOWL SALES ORDERS CLEANUP SCRIPT');
  console.log('═'.repeat(80) + '\n');
  
  const stats: CleanupStats = {
    totalOrders: 0,
    ordersWithCommas: 0,
    ordersSanitized: 0,
    errors: 0
  };

  try {
    console.log('📊 Phase 1: Scanning fishbowl_sales_orders collection...\n');

    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders').get();
    stats.totalOrders = ordersSnapshot.size;
    
    console.log(`✅ Loaded ${stats.totalOrders} order records\n`);
    console.log('🔍 Analyzing customer IDs for commas...\n');

    const ordersToUpdate: Array<{ docId: string; oldId: string; newId: string }> = [];

    for (const doc of ordersSnapshot.docs) {
      const data = doc.data();
      const customerId = data.customerId || '';
      
      // Check if customer ID contains comma
      if (customerId.includes(',')) {
        stats.ordersWithCommas++;
        const sanitized = customerId.replace(/,/g, '').trim();
        
        if (sanitized && sanitized !== '') {
          ordersToUpdate.push({
            docId: doc.id,
            oldId: customerId,
            newId: sanitized
          });
          
          // Show first 10 examples
          if (ordersToUpdate.length <= 10) {
            console.log(`🔧 Order ${doc.id}: "${customerId}" → "${sanitized}"`);
          }
        }
      }
    }

    console.log('\n📋 CLEANUP SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Total Orders: ${stats.totalOrders}`);
    console.log(`Orders with Comma IDs: ${stats.ordersWithCommas}`);
    console.log(`Orders to Sanitize: ${ordersToUpdate.length}`);
    console.log('═'.repeat(80));

    if (ordersToUpdate.length === 0) {
      console.log('\n✅ No orders need sanitization. Database is clean!\n');
      return;
    }

    console.log(`\n⚠️  WARNING: About to update ${ordersToUpdate.length} order records!`);
    console.log('   This will remove commas from customerId fields.\n');
    
    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Type "UPDATE" to confirm: ', resolve);
    });
    rl.close();

    if (answer.trim() !== 'UPDATE') {
      console.log('\n❌ Update cancelled.\n');
      return;
    }

    console.log('\n🔧 Phase 2: Sanitizing customer IDs in orders...\n');

    // Update in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < ordersToUpdate.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchOrders = ordersToUpdate.slice(i, i + batchSize);
      
      for (const order of batchOrders) {
        const docRef = adminDb.collection('fishbowl_sales_orders').doc(order.docId);
        batch.update(docRef, { customerId: order.newId });
      }

      await batch.commit();
      stats.ordersSanitized += batchOrders.length;
      console.log(`✅ Sanitized ${stats.ordersSanitized}/${ordersToUpdate.length} orders...`);
    }

    console.log('\n✅ CLEANUP COMPLETE!');
    console.log('═'.repeat(80));
    console.log(`Sanitized: ${stats.ordersSanitized} orders`);
    console.log(`Commas removed from customerId fields`);
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR during cleanup:', error);
    stats.errors++;
  }

  console.log('');
}

// Run the cleanup
cleanupFishbowlOrders()
  .then(() => {
    console.log('🎯 Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
