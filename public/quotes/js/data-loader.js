// Kanva Data Loader Utility - Firebase Migration (CDN Version)
// Updated to use Firebase Firestore with fallback to local files

const DataLoader = {
  // Loads a JSON file - Firebase only (no fallbacks for debugging)
  load: async function(filename) {
    console.log(`🔥 Loading ${filename} via Firebase only...`);
    const cleanFilename = filename.replace('.json', '');
    const result = await window.firebaseDataService.loadData(cleanFilename);
    console.log(`✅ Loaded ${filename} from Firebase:`, result ? 'SUCCESS' : 'NO DATA');
    return result;
  },

  // Loads all config data in parallel - Firebase only (no fallbacks for debugging)
  loadAll: async function() {
    console.log('🔥 Loading all data via Firebase only...');
    
    const [products, tiers, shipping, payment, adminEmails] = await Promise.all([
      window.firebaseDataService.loadData('products'),
      window.firebaseDataService.loadData('tiers'),
      window.firebaseDataService.loadData('shipping'),
      window.firebaseDataService.loadData('payment'),
      window.firebaseDataService.loadData('admin-emails')
    ]);
    
    console.log('✅ All data loaded from Firebase:', {
      products: products ? 'SUCCESS' : 'NO DATA',
      tiers: tiers ? 'SUCCESS' : 'NO DATA',
      shipping: shipping ? 'SUCCESS' : 'NO DATA',
      payment: payment ? 'SUCCESS' : 'NO DATA',
      adminEmails: adminEmails ? 'SUCCESS' : 'NO DATA'
    });
    
    return { products, tiers, shipping, payment, adminEmails };
  },

  // Saves data - now uses Firebase
  save: async function(filename, data) {
    try {
      const cleanFilename = filename.replace('.json', '');
      return await window.firebaseDataService.saveData(cleanFilename, data);
    } catch (error) {
      console.error(`❌ Failed to save ${filename} to Firebase:`, error);
      return false;
    }
  },

  // Setup real-time listener for admin operations
  setupRealtimeListener: function(filename, callback) {
    const cleanFilename = filename.replace('.json', '');
    return window.firebaseDataService.setupRealtimeListener(cleanFilename, callback);
  },

  // Remove real-time listener
  removeRealtimeListener: function(filename) {
    const cleanFilename = filename.replace('.json', '');
    return window.firebaseDataService.removeRealtimeListener(cleanFilename);
  },

  // Clear cache
  clearCache: function() {
    if (window.firebaseDataService) {
      window.firebaseDataService.clearCache();
    }
  },

  // Get cache status for debugging
  getCacheStatus: function() {
    return window.firebaseDataService.getCacheStatus();
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.DataLoader = DataLoader;
  console.log('📁 DataLoader exposed globally (Firebase-enabled)');
}

console.log('✅ DataLoader loaded successfully');
