// update-ringcentral-config.js
// This script updates your Firebase Firestore with RingCentral credentials

const admin = require('firebase-admin');

// You'll need to download your service account key from Firebase Console
// Go to Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateRingCentralConfig() {
  try {
    console.log('🔧 Updating RingCentral configuration...');
    
    const docRef = db.collection('integrations').doc('connections');
    
    // Get current document data
    const doc = await docRef.get();
    const currentData = doc.exists ? doc.data() : {};
    
    // IMPORTANT: Replace these with your actual RingCentral app credentials
    // Get these from: https://developers.ringcentral.com/my-account.html
    const ringcentralConfig = {
      // Your RingCentral App Client ID (from RingCentral Developer Console)
      clientId: '2nFqvUT38Sjctdhqtrhnbn',
      
      // Your RingCentral App Client Secret 
      clientSecret: '7tkgvamc8FFcXpQCWctmSY4ER16crpIqYeC4PK5CwdaY',
      
      // Use 'sandbox' for testing or 'production' for live
      environment: 'production',
      
      // Your app's redirect URI (must match what's in RingCentral app settings)
      redirectUri: 'https://kanvaportal.web.app/rc/auth/callback',
      
      // Set to true once configured
      configured: true
    };
    
    // Update the document
    const updatedData = {
      ...currentData,
      ringcentral: ringcentralConfig
    };
    
    await docRef.set(updatedData, { merge: true });
    console.log('✅ Successfully updated RingCentral configuration');
    
    // Verify the update
    const updatedDoc = await docRef.get();
    const rcConfig = updatedDoc.data()?.ringcentral;
    
    if (rcConfig?.clientId && rcConfig?.clientSecret) {
      console.log('✅ Configuration verified - credentials are set');
      console.log('Environment:', rcConfig.environment);
      console.log('Redirect URI:', rcConfig.redirectUri);
    } else {
      console.log('⚠️ Warning: Credentials may not be properly set');
    }
    
  } catch (error) {
    console.error('❌ Error updating configuration:', error);
  } finally {
    process.exit();
  }
}

// Run the update
updateRingCentralConfig();