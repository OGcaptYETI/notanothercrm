/**
 * Admin Manager - Firebase Only Version
 * Handles admin functionality with Firebase backend
 */
class AdminManager {
    constructor(calculator = null) {
        this.calculator = calculator;
        this.data = {
            products: null,
            tiers: null,
            shipping: null,
            payment: null
        };
        
        // Firebase-only configuration (no GitHub legacy code)
        this.initialized = false;
        
        // Load data immediately if calculator is provided
        if (calculator && calculator.data) {
            this.data = { ...calculator.data };
        } else {
            this.loadData().catch(console.error);
        }
        
        // Initialize components after page load
        setTimeout(() => {
            this.initializeComponents();
        }, 500);
    }

    /**
     * Initialize Firebase-only admin components
     */
    initializeComponents() {
        console.log('🔧 Initializing Firebase admin components...');
        
        // Initialize AdminDashboard with Firebase integration
        if (typeof window.AdminDashboard !== 'undefined') {
            this.adminDashboard = new window.AdminDashboard();
            console.log('✅ AdminDashboard initialized');
        }
        
        this.initialized = true;
        console.log('🚀 Firebase admin components initialized');
    }

    /**
     * Show enhanced admin dashboard
     */
    showEnhancedDashboard() {
        if (this.adminDashboard) {
            this.adminDashboard.show();
        } else {
            console.error('❌ AdminDashboard not available');
            alert('Admin dashboard not available. Please refresh the page.');
        }
    }

    /**
     * Load all JSON data from Firebase
     */
    async loadData() {
        try {
            // Wait for Firebase data service to be available
            let attempts = 0;
            while (!window.firebaseDataService && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available after 5 seconds');
            }
            
            await window.firebaseDataService.initialize();
            
            const [products, tiers, shipping, payment] = await Promise.all([
                window.firebaseDataService.getCollection('products'),
                window.firebaseDataService.getDocument('pricing', 'tiers'),
                window.firebaseDataService.getDocument('shipping', 'config'),
                window.firebaseDataService.getDocument('payment', 'config')
            ]);

            this.data = { products, tiers, shipping, payment };
            console.log('✅ Admin data loaded from Firebase');
            return this.data;
        } catch (error) {
            console.error('❌ Failed to load admin data from Firebase:', error);
            throw error;
        }
    }

    /**
     * Save data to Firebase
     */
    async saveData(type, data) {
        try {
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            await window.firebaseDataService.initialize();
            
            // Map data types to Firebase paths
            const firebasePaths = {
                'products': { path: 'products', isCollection: true },
                'tiers': { path: 'pricing/tiers', isCollection: false },
                'shipping': { path: 'shipping/config', isCollection: false },
                'payment': { path: 'payment/config', isCollection: false }
            };
            
            const pathConfig = firebasePaths[type];
            if (!pathConfig) {
                throw new Error(`Unknown data type: ${type}`);
            }
            
            // Save to Firebase
            let success;
            if (pathConfig.isCollection) {
                // For collections like products, save each item as a document
                const batch = window.firebase.db.batch();
                for (const [id, itemData] of Object.entries(data)) {
                    const docRef = window.firebase.db.collection('products').doc(id);
                    batch.set(docRef, {
                        ...itemData,
                        updatedAt: new Date()
                    }, { merge: true });
                }
                await batch.commit();
                success = true;
            } else {
                // For documents, save as single document
                success = await window.firebaseDataService.saveData(pathConfig.path, data);
            }
            
            if (success) {
                // Update local data
                this.data[type] = data;
                
                // Clear cache to ensure fresh data
                window.firebaseDataService.clearCache();
                
                console.log(`✅ ${type} data saved to Firebase`);
                return true;
            } else {
                throw new Error('Save operation failed');
            }
        } catch (error) {
            console.error(`❌ Failed to save ${type} data to Firebase:`, error);
            return false;
        }
    }

    /**
     * Download JSON file as backup
     */
    downloadJSON(type, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Create modal dialog
     */
    createModal(title, content) {
        console.log('🔧 AdminManager.createModal() called');
        
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.innerHTML = `
            <div class="admin-modal-content">
                <div class="admin-modal-header">
                    <h3>${title}</h3>
                    <button class="admin-modal-close" onclick="window.adminManager.closeModal()">&times;</button>
                </div>
                <div class="admin-modal-body">
                    ${content}
                </div>
            </div>
        `;
        console.log('✅ Modal created');
        document.body.appendChild(modal);
    }

    /**
     * Close modal
     */
    closeModal() {
        console.log('🔧 AdminManager.closeModal() called');
        const modal = document.querySelector('.admin-modal');
        if (modal) {
            modal.remove();
            console.log('✅ Modal closed');
        }
    }

    /**
     * Refresh calculator data after admin changes
     */
    refreshCalculatorData() {
        if (this.calculator) {
            console.log('🔄 Refreshing calculator data...');
            this.calculator.data = { ...this.data };
            
            if (typeof this.calculator.populateProductDropdowns === 'function') {
                this.calculator.populateProductDropdowns();
            }
            if (typeof this.calculator.populateStateDropdown === 'function') {
                this.calculator.populateStateDropdown();
            }
            if (typeof this.calculator.calculateAll === 'function') {
                this.calculator.calculateAll();
            }
            
            console.log('✅ Calculator data refreshed');
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.NotificationManager && window.NotificationManager.show) {
            window.NotificationManager.show(message, type);
        } else {
            // Fallback to alert if notification system not available
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Get Firebase status for debugging
     */
    getFirebaseStatus() {
        return {
            dataService: !!window.firebaseDataService,
            storageService: !!window.firebaseStorageService,
            firebase: !!window.firebase,
            initialized: this.initialized,
            dataLoaded: {
                products: !!this.data.products,
                tiers: !!this.data.tiers,
                shipping: !!this.data.shipping,
                payment: !!this.data.payment
            }
        };
    }
}

// Global admin manager instance
let adminManager;