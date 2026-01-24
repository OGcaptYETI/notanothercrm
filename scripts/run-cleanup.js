// Run cleanup scripts
async function runCleanup() {
  console.log('Starting cleanup...\n');
  
  try {
    // Step 1: Fix commas
    console.log('📝 Step 1: Running fix-customer-commas...');
    const response1 = await fetch('http://localhost:3000/api/admin/fix-customer-commas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result1 = await response1.json();
    console.log('✅ Comma cleanup result:', result1);
    console.log('\n');
    
    // Step 2: Recalculate lifetime values
    console.log('📝 Step 2: Running recalculate-lifetime-values...');
    const response2 = await fetch('http://localhost:3000/api/admin/recalculate-lifetime-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result2 = await response2.json();
    console.log('✅ Lifetime value recalculation result:', result2);
    
    console.log('\n🎉 All cleanup scripts completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runCleanup();
