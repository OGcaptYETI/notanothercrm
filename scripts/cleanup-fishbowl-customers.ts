#!/usr/bin/env tsx

import { adminDb } from '../lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

interface CleanupStats {
  total: number;
  commaIds: number;
  emptyIds: number;
  invalidAccountTypes: number;
  missingNames: number;
  duplicateIds: number;
  deleted: number;
  errors: number;
}

async function cleanupFishbowlCustomers() {
  console.log('\n🧹 FISHBOWL CUSTOMERS CLEANUP SCRIPT');
  console.log('━'.repeat(80));
  
  const stats: CleanupStats = {
    total: 0,
    commaIds: 0,
    emptyIds: 0,
    invalidAccountTypes: 0,
    missingNames: 0,
    duplicateIds: 0,
    deleted: 0,
    errors: 0
  };

  const validAccountTypes = ['Wholesale', 'Retail', 'Distributor'];
  const customersToDelete: string[] = [];
  const seenIds = new Map<string, string[]>(); // ID -> doc IDs with that customer ID
  const emptyIdSamples: any[] = [];
  const commaIdSamples: any[] = [];

  try {
    console.log('\n📊 Phase 1: Scanning fishbowl_customers collection...\n');

    const snapshot = await adminDb.collection('fishbowl_customers').get();
    stats.total = snapshot.size;

    console.log(`✅ Loaded ${stats.total} customer records\n`);
    console.log('🔍 Analyzing data quality...\n');

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      const customerId = data.id || '';
      const accountType = data.accountType || '';
      const name = data.name || '';

      // Track for duplicate detection
      if (customerId) {
        if (!seenIds.has(customerId)) {
          seenIds.set(customerId, []);
        }
        seenIds.get(customerId)!.push(docId);
      }

      // Check 1a: Document ID contains comma (Firestore path)
      if (docId.includes(',')) {
        stats.commaIds++;
        customersToDelete.push(docId);
        
        // Capture first 5 samples
        if (commaIdSamples.length < 5) {
          commaIdSamples.push({
            docId,
            id: customerId,
            name,
            accountType,
            issue: 'Document ID has comma',
            ...data
          });
        }
        continue;
      }
      
      // Check 1b: Customer ID field contains comma
      if (customerId.includes(',')) {
        stats.commaIds++;
        customersToDelete.push(docId);
        
        // Capture first 5 samples
        if (commaIdSamples.length < 5) {
          commaIdSamples.push({
            docId,
            id: customerId,
            name,
            accountType,
            issue: 'ID field has comma',
            ...data
          });
        }
        continue;
      }

      // Check 2: Empty customer ID
      if (!customerId || customerId.trim() === '') {
        stats.emptyIds++;
        customersToDelete.push(docId);
        
        // Capture first 10 samples
        if (emptyIdSamples.length < 10) {
          emptyIdSamples.push({
            docId,
            name,
            accountType,
            email: data.email || 'N/A',
            phone: data.phone || 'N/A',
            city: data.city || 'N/A',
            state: data.state || 'N/A',
            accountNumber: data.accountNumber || 'N/A',
            syncedFrom: data.syncedFrom || 'N/A',
            lastOrderNum: data.lastOrderNum || 'N/A',
            lastOrderDate: data.lastOrderDate ? data.lastOrderDate.toDate().toISOString().split('T')[0] : 'N/A'
          });
        }
        continue;
      }

      // Check 3: Invalid account type
      if (accountType && !validAccountTypes.includes(accountType)) {
        stats.invalidAccountTypes++;
        console.log(`⚠️  INVALID ACCOUNT TYPE: "${accountType}" (ID: ${customerId})`);
        console.log(`   Name: ${name}`);
        console.log(`   Valid types: ${validAccountTypes.join(', ')}\n`);
      }

      // Check 4: Missing name
      if (!name || name.trim() === '') {
        stats.missingNames++;
        console.log(`⚠️  MISSING NAME (ID: ${customerId}, Doc: ${docId})\n`);
      }
    }

    // Check for duplicates
    console.log('\n🔍 Checking for duplicate customer IDs...\n');
    for (const [customerId, docIds] of seenIds.entries()) {
      if (docIds.length > 1) {
        stats.duplicateIds++;
        console.log(`⚠️  DUPLICATE CUSTOMER ID: "${customerId}"`);
        console.log(`   Found in ${docIds.length} documents:`);
        docIds.forEach(docId => console.log(`   - ${docId}`));
        console.log('');
      }
    }

    // Display samples of empty ID customers
    if (emptyIdSamples.length > 0) {
      console.log('\n🔍 SAMPLE EMPTY ID CUSTOMERS (First 10):');
      console.log('━'.repeat(80));
      emptyIdSamples.forEach((sample, index) => {
        console.log(`\n#${index + 1} Doc ID: ${sample.docId}`);
        console.log(`   Name: ${sample.name}`);
        console.log(`   Account Type: ${sample.accountType}`);
        console.log(`   Email: ${sample.email}`);
        console.log(`   Phone: ${sample.phone}`);
        console.log(`   City: ${sample.city}, State: ${sample.state}`);
        console.log(`   Account Number: ${sample.accountNumber}`);
        console.log(`   Synced From: ${sample.syncedFrom}`);
        console.log(`   Last Order: ${sample.lastOrderNum} (${sample.lastOrderDate})`);
      });
      console.log('\n' + '━'.repeat(80));
    }

    // Display samples of comma ID customers
    if (commaIdSamples.length > 0) {
      console.log('\n🔍 SAMPLE COMMA ID CUSTOMERS (First 5):');
      console.log('━'.repeat(80));
      commaIdSamples.forEach((sample, index) => {
        console.log(`\n#${index + 1} ID: "${sample.id}" (Doc: ${sample.docId})`);
        console.log(`   Name: ${sample.name}`);
        console.log(`   Account Type: ${sample.accountType}`);
        console.log(`   Email: ${sample.email || 'N/A'}`);
        console.log(`   City: ${sample.city || 'N/A'}, State: ${sample.state || 'N/A'}`);
        console.log(`   Synced From: ${sample.syncedFrom || 'N/A'}`);
      });
      console.log('\n' + '━'.repeat(80));
    }

    console.log('\n📋 CLEANUP SUMMARY');
    console.log('━'.repeat(80));
    console.log(`Total Customers: ${stats.total}`);
    console.log(`\n❌ CRITICAL ISSUES (Will Delete):`);
    console.log(`   - Comma in ID: ${stats.commaIds}`);
    console.log(`   - Empty ID: ${stats.emptyIds}`);
    console.log(`   - TOTAL TO DELETE: ${customersToDelete.length}`);
    console.log(`\n⚠️  WARNINGS (Manual Review Needed):`);
    console.log(`   - Invalid Account Types: ${stats.invalidAccountTypes}`);
    console.log(`   - Missing Names: ${stats.missingNames}`);
    console.log(`   - Duplicate IDs: ${stats.duplicateIds}`);
    console.log('━'.repeat(80));

    if (customersToDelete.length === 0) {
      console.log('\n✅ No customers need to be deleted. Database is clean!\n');
      return;
    }

    console.log(`\n⚠️  WARNING: About to delete ${customersToDelete.length} customer records!`);
    console.log('   This action cannot be undone.\n');
    
    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Type "DELETE" to confirm deletion: ', resolve);
    });
    rl.close();

    if (answer.trim() !== 'DELETE') {
      console.log('\n❌ Deletion cancelled.\n');
      return;
    }

    console.log('\n🗑️  Phase 2: Deleting invalid customer records...\n');

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < customersToDelete.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchIds = customersToDelete.slice(i, i + batchSize);
      
      for (const docId of batchIds) {
        const docRef = adminDb.collection('fishbowl_customers').doc(docId);
        batch.delete(docRef);
      }

      await batch.commit();
      stats.deleted += batchIds.length;
      console.log(`✅ Deleted ${stats.deleted}/${customersToDelete.length} customers...`);
    }

    console.log('\n✅ CLEANUP COMPLETE!');
    console.log('━'.repeat(80));
    console.log(`Deleted: ${stats.deleted} customers`);
    console.log(`Remaining: ${stats.total - stats.deleted} customers`);
    console.log('━'.repeat(80));

    if (stats.invalidAccountTypes > 0 || stats.missingNames > 0 || stats.duplicateIds > 0) {
      console.log('\n⚠️  WARNINGS STILL PRESENT:');
      if (stats.invalidAccountTypes > 0) {
        console.log(`   - ${stats.invalidAccountTypes} customers have invalid account types`);
      }
      if (stats.missingNames > 0) {
        console.log(`   - ${stats.missingNames} customers have missing names`);
      }
      if (stats.duplicateIds > 0) {
        console.log(`   - ${stats.duplicateIds} duplicate customer IDs detected`);
      }
      console.log('   These require manual review and correction.\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR during cleanup:', error);
    stats.errors++;
  }

  console.log('');
}

// Run the cleanup
cleanupFishbowlCustomers()
  .then(() => {
    console.log('🎯 Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
