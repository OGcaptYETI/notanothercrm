import { adminDb } from '@/lib/firebase/admin';

async function checkCommissionRates() {
  console.log('\n🔍 CHECKING COMMISSION RATE CONFIGURATION');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all settings documents
    const settingsSnapshot = await adminDb.collection('settings').get();
    
    console.log(`📊 Total documents in settings collection: ${settingsSnapshot.size}\n`);
    
    // Find commission rate documents
    const rateDocuments: Array<{ id: string; title: string; ratesCount: number }> = [];
    
    settingsSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (doc.id.startsWith('commission_rates_')) {
        const titleKey = doc.id.replace('commission_rates_', '').replace(/_/g, ' ');
        const ratesCount = data.rates?.length || 0;
        
        rateDocuments.push({
          id: doc.id,
          title: titleKey,
          ratesCount
        });
        
        console.log(`✅ Document: ${doc.id}`);
        console.log(`   Title: "${titleKey}"`);
        console.log(`   Rates configured: ${ratesCount}`);
        
        if (data.rates && Array.isArray(data.rates)) {
          console.log(`   Rate details:`);
          data.rates.forEach((rate: any) => {
            console.log(`      - ${rate.title || '?'} | ${rate.segmentId || '?'} | ${rate.status || '?'} = ${rate.percentage || 0}%`);
          });
        }
        console.log('');
      }
    });
    
    console.log('═'.repeat(80));
    console.log(`📋 SUMMARY:`);
    console.log(`   Commission rate documents found: ${rateDocuments.length}`);
    
    if (rateDocuments.length === 0) {
      console.log('\n❌ NO COMMISSION RATES CONFIGURED!');
      console.log('   This is why commissions are $0.');
      console.log('   You need to configure rates in: Settings → Commission Rules\n');
    } else {
      console.log('\n✅ Commission rates are configured:');
      rateDocuments.forEach(doc => {
        console.log(`   - ${doc.title}: ${doc.ratesCount} rates`);
      });
      console.log('');
    }
    
    // List all settings documents for reference
    console.log('\n📄 All settings documents:');
    settingsSnapshot.forEach(doc => {
      console.log(`   - ${doc.id}`);
    });
    
  } catch (error) {
    console.error('\n❌ ERROR checking commission rates:', error);
  }
  
  console.log('\n🎯 Script finished\n');
}

// Run the check
checkCommissionRates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
