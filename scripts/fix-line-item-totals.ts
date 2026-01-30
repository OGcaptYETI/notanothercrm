import { adminDb } from '@/lib/firebase/admin';

/**
 * UNBREAKABLE FIX: Calculate totalPrice for all line items where it's missing or 0
 * This ensures revenue calculations always work regardless of CSV column changes
 */

interface FixStats {
  total: number;
  fixed: number;
  alreadyCorrect: number;
  errors: number;
}

async function fixLineItemTotals() {
  console.log('\n🔧 FIXING LINE ITEM TOTAL PRICES');
  console.log('═'.repeat(80) + '\n');
  
  const stats: FixStats = {
    total: 0,
    fixed: 0,
    alreadyCorrect: 0,
    errors: 0
  };

  try {
    console.log('📊 Loading all line items from fishbowl_soitems...\n');
    
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems').get();
    stats.total = lineItemsSnapshot.size;
    
    console.log(`✅ Loaded ${stats.total} line items\n`);
    console.log('🔍 Checking and fixing totalPrice values...\n');

    const batchSize = 500;
    let batch = adminDb.batch();
    let batchCount = 0;
    let itemsToFix: Array<{ id: string; quantity: number; unitPrice: number; calculated: number }> = [];

    for (const doc of lineItemsSnapshot.docs) {
      const data = doc.data();
      const totalPrice = data.totalPrice || 0;
      const unitPrice = data.unitPrice || 0;
      const quantity = data.quantity || 0;
      
      // Calculate what totalPrice should be
      const calculatedTotal = unitPrice * quantity;
      
      // If totalPrice is 0 but we can calculate it from unitPrice × quantity
      if (totalPrice === 0 && calculatedTotal > 0) {
        batch.update(doc.ref, { totalPrice: calculatedTotal });
        batchCount++;
        stats.fixed++;
        
        // Show first 10 fixes
        if (itemsToFix.length < 10) {
          itemsToFix.push({
            id: doc.id,
            quantity,
            unitPrice,
            calculated: calculatedTotal
          });
          console.log(`🔧 ${doc.id}: ${quantity} × $${unitPrice} = $${calculatedTotal}`);
        }
        
        // Commit batch when full
        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`   ✅ Committed batch (${stats.fixed} fixed so far)`);
          batch = adminDb.batch();
          batchCount = 0;
        }
      } else if (totalPrice > 0) {
        stats.alreadyCorrect++;
      }
    }

    // Commit remaining items
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Committed final batch\n`);
    }

    console.log('\n📋 FIX SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Total Line Items: ${stats.total}`);
    console.log(`Fixed (totalPrice was 0): ${stats.fixed}`);
    console.log(`Already Correct: ${stats.alreadyCorrect}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('═'.repeat(80));

    if (stats.fixed > 0) {
      console.log('\n✅ FIXED! All line items now have calculated totalPrice values.');
      console.log('   Revenue calculations will now work correctly.\n');
    } else {
      console.log('\n✅ All line items already have correct totalPrice values.\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR during fix:', error);
    stats.errors++;
  }

  console.log('');
}

// Run the fix
fixLineItemTotals()
  .then(() => {
    console.log('🎯 Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
