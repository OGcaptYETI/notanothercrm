/**
 * Firebase Data Service - Fixed Version
 * Handles all Firestore operations for Kanva Quotes
 */

class FirebaseDataService {
  constructor() {

    this.db = null;
    this.auth = null;
    this.initialized = false;
    this.cache = new Map();
    this.initPromise = null; // Prevent multiple initialization attempts
    console.log('🔥 Firebase Data Service initializing...');
  }

  /**
   * Recursively sanitize data to be Firestore-safe (no functions/undefined)
   */
  sanitizeData(input) {
    if (input === null) return null;
    const t = typeof input;
    if (t === 'function' || t === 'undefined' || t === 'symbol') {
      return undefined; // drop invalid fields
    }
    if (Array.isArray(input)) {
      const arr = input.map(v => this.sanitizeData(v)).filter(v => v !== undefined);
      return arr;
    }
    if (t === 'object') {
      // Remove known Response-like method props if present (defensive)
      const { json: _jsonFn, text: _textFn, arrayBuffer: _abFn, blob: _blobFn, formData: _fdFn, ...rest } = input;
      const out = {};
      for (const [k, v] of Object.entries(rest)) {
        // Drop any function-valued properties outright
        if (typeof v === 'function') continue;
        const sv = this.sanitizeData(v);
        if (sv !== undefined) out[k] = sv;
      }
      return out;
    }
    return input;
  }

  /**
   * Initialize the data service
   */
  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      // Wait for Firebase config to be loaded with timeout
      let attempts = 0;
      while ((!window.firebase || !window.firebase.db) && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window.firebase || !window.firebase.db) {
        throw new Error('Firebase configuration not available after 5 seconds');
      }
      
      // Use the pre-initialized Firebase services from config
      this.db = window.firebase.db;
      this.auth = window.firebase.auth;
      
      // Initialize auth if needed
      if (window.firebase.initializeAuth) {
        await window.firebase.initializeAuth();
      }
      
      this.initialized = true;
      console.log('📁 Firebase Data Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Data Service:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Map legacy file names to Firebase paths
   */
  mapLegacyPath(filename) {
    // Remove .json extension if present
    const cleanFilename = filename.replace('.json', '').replace('data/', '');
    
    const pathMappings = {
      'products': { path: 'products', isCollection: true },
      'tiers': { path: 'pricing', docId: 'tiers', isCollection: false },
      'shipping': { path: 'shipping', docId: 'config', isCollection: false },
      'payment': { path: 'payment', docId: 'config', isCollection: false },
      'admin-emails': { path: 'admin', docId: 'emails', isCollection: false },
      'email-templates': { path: 'templates', docId: 'email-config', isCollection: false },
      'connections': { path: 'integrations', docId: 'connections', isCollection: false }
    };
    
    return pathMappings[cleanFilename] || { path: cleanFilename, isCollection: false };
  }

  /**
   * Load data from a Firestore document or collection
   */
  async loadData(filename) {
    await this.initialize();

    try {
      // Map legacy filename to Firebase path
      const pathConfig = this.mapLegacyPath(filename);
      let cacheKey;
      
      console.log(`📖 Loading data from Firestore: ${filename} -> ${JSON.stringify(pathConfig)}`);
      
      if (pathConfig.isCollection) {
        cacheKey = pathConfig.path;
        // Check cache first
        if (this.cache.has(cacheKey)) {
          console.log(`📋 Using cached data for: ${filename}`);
          return this.cache.get(cacheKey);
        }
        
        return await this.getCollection(pathConfig.path);
      } else {
        const fullPath = pathConfig.docId ? `${pathConfig.path}/${pathConfig.docId}` : pathConfig.path;
        cacheKey = fullPath;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
          console.log(`📋 Using cached data for: ${filename}`);
          return this.cache.get(cacheKey);
        }
        
        return await this.getDocument(pathConfig.path, pathConfig.docId);
      }
      
    } catch (error) {
      console.error(`❌ Failed to load data for ${filename}:`, error);
      return {};
    }
  }

  /**
   * Get a single document from Firestore
   */
  async getDocument(collection, docId = null) {
    await this.initialize();

    try {
      let docRef;
      let cacheKey;
      
      if (docId) {
        docRef = this.db.collection(collection).doc(docId);
        cacheKey = `${collection}/${docId}`;
        console.log(`📄 Getting document: ${collection}/${docId}`);
      } else {
        docRef = this.db.doc(collection);
        cacheKey = collection;
        console.log(`📄 Getting document: ${collection}`);
      }
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        console.log(`📋 Using cached document for: ${cacheKey}`);
        return this.cache.get(cacheKey);
      }
      
      const docSnapshot = await docRef.get();
      
      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        
        // Cache the result
        this.cache.set(cacheKey, data);
        console.log(`✅ Document loaded: ${cacheKey}`);
        return data;
      }
      
      console.log(`ℹ️ Document not found: ${cacheKey}`);
      return {};
      
    } catch (error) {
      console.error(`❌ Failed to get document:`, error);
      return {};
    }
  }

  /**
   * Get a collection from Firestore
   */
  async getCollection(path) {
    await this.initialize();

    try {
      console.log(`📚 Getting collection from Firestore: ${path}`);
      
      // Check cache first
      if (this.cache.has(path)) {
        console.log(`📋 Using cached collection for: ${path}`);
        return this.cache.get(path);
      }
      
      const collectionRef = this.db.collection(path);
      const collectionSnapshot = await collectionRef.get();
      
      const data = {};
      collectionSnapshot.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() };
      });
      
      // Cache the result
      this.cache.set(path, data);
      console.log(`✅ Collection loaded: ${path} (${Object.keys(data).length} documents)`);
      return data;
      
    } catch (error) {
      console.error(`❌ Failed to get collection ${path}:`, error);
      return {};
    }
  }

  /**
   * Save data to Firestore
   */
  async saveData(path, data) {
    await this.initialize();

    try {
      console.log(`💾 Saving data to Firestore: ${path}`);
      
      const pathConfig = this.mapLegacyPath(path);
      
      if (pathConfig.isCollection) {
        // Save as collection (batch write)
        const batch = this.db.batch();
        
        for (const [key, value] of Object.entries(data)) {
          const docRef = this.db.collection(pathConfig.path).doc(key);
          const payload = this.sanitizeData({
            ...value,
            updatedAt: new Date()
          });
          batch.set(docRef, payload, { merge: true });
        }
        
        await batch.commit();
        
        // Update cache
        this.cache.set(pathConfig.path, data);
        
        console.log(`✅ Collection saved successfully: ${pathConfig.path}`);
      } else {
        // Save as document
        let docRef;
        let cacheKey;
        
        if (pathConfig.docId) {
          docRef = this.db.collection(pathConfig.path).doc(pathConfig.docId);
          cacheKey = `${pathConfig.path}/${pathConfig.docId}`;
        } else {
          docRef = this.db.doc(pathConfig.path);
          cacheKey = pathConfig.path;
        }
        
        const payload = this.sanitizeData({
          ...data,
          updatedAt: new Date()
        });
        await docRef.set(payload, { merge: true });
        
        // Update cache
        this.cache.set(cacheKey, data);
        
        console.log(`✅ Document saved successfully: ${cacheKey}`);
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to save data to ${path}:`, error);
      return false;
    }
  }

  /**
   * Delete a document from Firestore
   */
  async deleteDocument(path, docId = null) {
    await this.initialize();
    
    try {
      let docRef;
      let cacheKey;
      
      if (docId) {
        docRef = this.db.collection(path).doc(docId);
        cacheKey = `${path}/${docId}`;
        console.log(`🗑️ Deleting document: ${path}/${docId}`);
      } else {
        docRef = this.db.doc(path);
        cacheKey = path;
        console.log(`🗑️ Deleting document: ${path}`);
      }
      
      await docRef.delete();
      
      // Remove from cache
      this.cache.delete(cacheKey);
      
      // Also update collection cache if needed
      if (docId) {
        const collectionData = this.cache.get(path);
        if (collectionData && collectionData[docId]) {
          delete collectionData[docId];
          this.cache.set(path, collectionData);
        }
      }
      
      console.log(`✅ Document deleted successfully: ${cacheKey}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to delete document:`, error);
      return false;
    }
  }

  /**
   * Set up real-time listener for a document
   */
  onDocumentChange(collection, document, callback) {
    if (!this.initialized) {
      console.error('❌ Firebase Data Service not initialized');
      return () => {};
    }

    console.log(`👂 Setting up real-time listener: ${collection}/${document}`);
    
    const unsubscribe = this.db.collection(collection).doc(document)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          console.log(`🔄 Real-time update received: ${collection}/${document}`);
          
          // Update cache
          const path = `${collection}/${document}`;
          this.cache.set(path, data);
          
          // Call callback with updated data
          callback(data, doc.id);
        } else {
          console.log(`📭 Document deleted: ${collection}/${document}`);
          callback(null, doc.id);
        }
      }, (error) => {
        console.error(`❌ Real-time listener error for ${collection}/${document}:`, error);
      });

    return unsubscribe;
  }

  /**
   * Set up real-time listener for a collection
   */
  onCollectionChange(collection, callback) {
    if (!this.initialized) {
      console.error('❌ Firebase Data Service not initialized');
      return () => {};
    }

    console.log(`👂 Setting up real-time collection listener: ${collection}`);
    
    const unsubscribe = this.db.collection(collection)
      .onSnapshot((snapshot) => {
        const data = {};
        snapshot.forEach((doc) => {
          data[doc.id] = doc.data();
        });
        
        console.log(`🔄 Real-time collection update received: ${collection}`);
        
        // Update cache
        this.cache.set(collection, data);
        
        // Call callback with updated data
        callback(data);
      }, (error) => {
        console.error(`❌ Real-time collection listener error for ${collection}:`, error);
      });

    return unsubscribe;
  }

  /**
   * Clear cache for a specific path or all cache
   */
  clearCache(path = null) {
    if (path) {
      this.cache.delete(path);
      console.log(`🧹 Cache cleared for: ${path}`);
    } else {
      this.cache.clear();
      console.log(`🧹 All cache cleared`);
    }
  }

  /**
   * Legacy compatibility method for fetch-like API
   */
  async fetchData(url) {
    // Extract filename from URL
    const filename = url.replace('/data/', '').replace('data/', '').replace('.json', '');
    
    console.log(`🔄 Intercepting fetch request: ${url} -> Firebase`);
    
    const data = await this.loadData(filename);
    
    // Return a mock Response object that matches fetch() API
    return {
      ok: true,
      status: 200,
      json: async () => data,
      text: async () => JSON.stringify(data)
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStatus() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      initialized: this.initialized
    };
  }
}

// Create singleton instance
const firebaseDataService = new FirebaseDataService();

// Expose globally for legacy scripts
if (typeof window !== 'undefined') {
    window.firebaseDataService = firebaseDataService;
    console.log('🌐 FirebaseDataService exposed globally');
}

console.log('🔥 Firebase Data Service loaded');