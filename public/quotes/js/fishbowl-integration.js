/**
 * Fishbowl ERP Integration for Kanva Quotes
 * Handles inventory management and product data synchronization
 * Based on Fishbowl REST API: https://help.fishbowlinventory.com/advanced/s/apidocs/introduction.html
 */

class FishbowlIntegration {
    /**
     * Initialize the Fishbowl integration
     * @param {Object} config - Configuration object
     * @param {string} config.host - Fishbowl server hostname or IP
     * @param {number} config.port - Fishbowl server port (default: 28192)
     * @param {string} config.username - Fishbowl username
     * @param {string} config.password - Fishbowl password
     */
    constructor(config = {}) {
        this.host = config.host || 'localhost';
        this.port = config.port || 28192;
        this.username = config.username || '';
        this.password = config.password || '';
        this.token = null;
        this.connected = false;
        this.lastSync = null;
        this.apiBase = `http://${this.host}:${this.port}/api`;
        
        console.log('🐟 FishbowlIntegration initialized');
        
        // Load connection from server if available
        this.loadConnectionFromServer();
    }
    
    /**
     * Load Fishbowl connection from server
     */
    async loadConnectionFromServer() {
        try {
            // First try to load from secure integration handler if available
            if (window.secureIntegrationHandler) {
                try {
                    const fishbowlConfig = await window.secureIntegrationHandler.getIntegration('fishbowl');
                    if (fishbowlConfig) {
                        // Update configuration from secure storage
                        if (fishbowlConfig.host) this.host = fishbowlConfig.host;
                        if (fishbowlConfig.port) this.port = fishbowlConfig.port;
                        if (fishbowlConfig.username) this.username = fishbowlConfig.username;
                        if (fishbowlConfig.password) this.password = fishbowlConfig.password;
                        if (fishbowlConfig.connected) this.connected = fishbowlConfig.connected;
                        if (fishbowlConfig.lastUpdated) this.lastSync = new Date(fishbowlConfig.lastUpdated);
                        
                        // Update API base URL with new host/port
                        this.apiBase = `http://${this.host}:${this.port}/api`;
                        
                        console.log('✅ Fishbowl connection loaded from secure storage');
                        return;
                    }
                } catch (secureError) {
                    console.warn('⚠️ Could not load Fishbowl credentials from secure storage:', secureError);
                }
            }
            
            // Fallback to legacy method
            const response = await fetch('/api/connections');
            const result = await response.json();
            
            if (result.success && result.data && result.data.fishbowl) {
                const fishbowlConfig = result.data.fishbowl;
                
                // Update configuration from server
                if (fishbowlConfig.host) this.host = fishbowlConfig.host;
                if (fishbowlConfig.port) this.port = fishbowlConfig.port;
                if (fishbowlConfig.username) this.username = fishbowlConfig.username;
                if (fishbowlConfig.password) this.password = fishbowlConfig.password;
                if (fishbowlConfig.connected) this.connected = fishbowlConfig.connected;
                if (fishbowlConfig.lastUpdated) this.lastSync = new Date(fishbowlConfig.lastUpdated);
                
                // Update API base URL with new host/port
                this.apiBase = `http://${this.host}:${this.port}/api`;
                
                console.log('✅ Fishbowl connection loaded from server');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load Fishbowl connection from server:', error);
        }
    }
    
    /**
     * Save Fishbowl connection to server
     */
    async saveConnectionToServer() {
        const fishbowlConfig = {
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
            connected: this.connected,
            lastUpdated: new Date().toISOString()
        };
        
        // First try to save using secure integration handler if available
        if (window.secureIntegrationHandler) {
            try {
                await window.secureIntegrationHandler.updateIntegration('fishbowl', fishbowlConfig);
                console.log('✅ Fishbowl connection saved to secure storage');
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('Fishbowl connection settings updated successfully', 'success');
                }
                
                return true;
            } catch (secureError) {
                console.warn('⚠️ Could not save Fishbowl credentials to secure storage:', secureError);
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('Failed to save Fishbowl connection settings securely', 'warning');
                }
                
                // Fall through to legacy method
            }
        }
        
        // Fallback to legacy method
        try {
            const response = await fetch('/api/connections/fishbowl', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fishbowlConfig)
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ Fishbowl connection saved to server');
                return true;
            } else {
                console.warn('⚠️ Failed to save Fishbowl connection to server:', result.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Error saving Fishbowl connection to server:', error);
            return false;
        }
    }
    
    /**
     * Configure Fishbowl connection settings
     * @param {Object} config - Configuration object
     * @param {string} config.host - Fishbowl server hostname or IP
     * @param {number} config.port - Fishbowl server port
     * @param {string} config.username - Fishbowl username
     * @param {string} config.password - Fishbowl password
     * @returns {Promise<boolean>} - Success status
     */
    async configure(config = {}) {
        let updated = false;
        
        if (config.host) {
            this.host = config.host;
            updated = true;
        }
        
        if (config.port) {
            this.port = config.port;
            updated = true;
        }
        
        if (config.username) {
            this.username = config.username;
            updated = true;
        }
        
        if (config.password) {
            this.password = config.password;
            updated = true;
        }
        
        if (updated) {
            // Update API base URL with new host/port
            this.apiBase = `http://${this.host}:${this.port}/api`;
            console.log('✅ FishbowlIntegration configuration updated');
            
            // Save to server
            return await this.saveConnectionToServer();
        }
        
        return updated;
    }
    
    /**
     * Test Fishbowl connection
     * @returns {Promise<Object>} - Test result with status and message
     */
    async testConnection() {
        if (!this.username || !this.password) {
            return {
                success: false,
                message: 'Fishbowl credentials not configured. Please enter valid username and password.',
                details: null
            };
        }
        
        try {
            console.log('🔍 Testing Fishbowl connection...');
            
            // Attempt to authenticate and get a token
            const token = await this.authenticate();
            
            if (token) {
                // Connection successful, save to server
                this.connected = true;
                await this.saveConnectionToServer();
                
                return {
                    success: true,
                    message: `Successfully connected to Fishbowl ERP at ${this.host}:${this.port}`,
                    details: {
                        host: this.host,
                        port: this.port,
                        username: this.username,
                        token: token.substring(0, 10) + '...' // Only show part of the token for security
                    }
                };
            } else {
                // Authentication failed
                this.connected = false;
                await this.saveConnectionToServer();
                
                return {
                    success: false,
                    message: 'Failed to authenticate with Fishbowl ERP',
                    details: null
                };
            }
        } catch (error) {
            console.error('❌ Fishbowl connection test failed:', error);
            
            this.connected = false;
            await this.saveConnectionToServer();
            
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                details: error
            };
        }
    }
    
    /**
     * Authenticate with Fishbowl API and get token
     * @returns {Promise<string|null>} - Authentication token or null if failed
     */
    async authenticate() {
        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: this.username,
                    password: this.password
                })
            });
            
            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.token) {
                this.token = data.token;
                console.log('✅ Fishbowl authentication successful');
                return data.token;
            } else {
                throw new Error('No token received from Fishbowl API');
            }
        } catch (error) {
            console.error('❌ Fishbowl authentication failed:', error);
            this.token = null;
            return null;
        }
    }
    
    /**
     * Get configuration information
     * @returns {Object} - Configuration object
     */
    getConfig() {
        return {
            host: this.host,
            port: this.port,
            username: this.username,
            hasPassword: !!this.password,
            connected: this.connected,
            lastSync: this.lastSync
        };
    }
    
    /**
     * Get product inventory levels
     * @param {Array<string>} productNumbers - List of product numbers to check
     * @returns {Promise<Object>} - Inventory data by product number
     */
    async getInventoryLevels(productNumbers = []) {
        if (!this.token && !await this.authenticate()) {
            throw new Error('Not authenticated with Fishbowl');
        }
        
        try {
            // If no specific product numbers provided, get all
            if (!productNumbers || productNumbers.length === 0) {
                const response = await fetch(`${this.apiBase}/inventory`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to get inventory: ${response.statusText}`);
                }
                
                const data = await response.json();
                return this.processInventoryData(data);
            } else {
                // Get inventory for specific products
                const inventoryPromises = productNumbers.map(productNum => 
                    fetch(`${this.apiBase}/inventory/${encodeURIComponent(productNum)}`, {
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        }
                    })
                    .then(response => {
                        if (!response.ok) {
                            console.warn(`Failed to get inventory for ${productNum}: ${response.statusText}`);
                            return null;
                        }
                        return response.json();
                    })
                    .catch(error => {
                        console.error(`Error getting inventory for ${productNum}:`, error);
                        return null;
                    })
                );
                
                const results = await Promise.all(inventoryPromises);
                
                // Combine results into a single object
                const inventoryData = {};
                results.forEach((result, index) => {
                    if (result) {
                        const productNum = productNumbers[index];
                        inventoryData[productNum] = result;
                    }
                });
                
                return this.processInventoryData(inventoryData);
            }
        } catch (error) {
            console.error('❌ Error getting inventory levels:', error);
            throw error;
        }
    }
    
    /**
     * Process inventory data from API into a more usable format
     * @param {Object} data - Raw inventory data from API
     * @returns {Object} - Processed inventory data
     */
    processInventoryData(data) {
        const processed = {};
        
        try {
            // Handle different response formats
            if (Array.isArray(data)) {
                // Array of inventory items
                data.forEach(item => {
                    if (item.partNumber) {
                        processed[item.partNumber] = {
                            partNumber: item.partNumber,
                            partDescription: item.partDescription || '',
                            qtyOnHand: item.qtyOnHand || 0,
                            qtyAvailable: item.qtyAvailable || 0,
                            qtyOnOrder: item.qtyOnOrder || 0,
                            averageCost: item.averageCost || 0,
                            lastCost: item.lastCost || 0
                        };
                    }
                });
            } else if (typeof data === 'object') {
                // Object with part numbers as keys
                Object.keys(data).forEach(key => {
                    const item = data[key];
                    processed[key] = {
                        partNumber: key,
                        partDescription: item.partDescription || '',
                        qtyOnHand: item.qtyOnHand || 0,
                        qtyAvailable: item.qtyAvailable || 0,
                        qtyOnOrder: item.qtyOnOrder || 0,
                        averageCost: item.averageCost || 0,
                        lastCost: item.lastCost || 0
                    };
                });
            }
        } catch (error) {
            console.error('❌ Error processing inventory data:', error);
        }
        
        return processed;
    }
    
    /**
     * Get product information
     * @param {string} productNumber - Product number to look up
     * @returns {Promise<Object>} - Product data
     */
    async getProductInfo(productNumber) {
        if (!this.token && !await this.authenticate()) {
            throw new Error('Not authenticated with Fishbowl');
        }
        
        try {
            const response = await fetch(`${this.apiBase}/product/${encodeURIComponent(productNumber)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get product info: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`❌ Error getting product info for ${productNumber}:`, error);
            throw error;
        }
    }
    
    /**
     * Sync product data from Fishbowl to local products.json
     * @returns {Promise<Object>} - Result with success status and message
     */
    async syncProductData() {
        try {
            console.log('🔄 Starting product data sync from Fishbowl...');
            
            if (!this.token && !await this.authenticate()) {
                throw new Error('Not authenticated with Fishbowl');
            }
            
            // Get all products from Fishbowl
            const response = await fetch(`${this.apiBase}/product`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get products: ${response.statusText}`);
            }
            
            const fishbowlProducts = await response.json();
            
            // Get current products from Firebase
            if (!window.firebaseDataService) {
                console.error('❌ Firebase Data Service not available');
                throw new Error('Firebase Data Service not initialized');
            }
            
            const localProducts = await window.firebaseDataService.fetchData('/data/products.json');
            
            // Update local products with Fishbowl data
            const updatedProducts = { ...localProducts };
            let updateCount = 0;
            
            fishbowlProducts.forEach(fbProduct => {
                const productKey = fbProduct.num.toLowerCase().replace(/[^a-z0-9]/g, '-');
                
                if (updatedProducts[productKey]) {
                    // Update existing product
                    updatedProducts[productKey].price = fbProduct.price || updatedProducts[productKey].price;
                    updatedProducts[productKey].msrp = fbProduct.standardPrice || updatedProducts[productKey].msrp;
                    updatedProducts[productKey].inventory = {
                        qtyOnHand: fbProduct.qtyOnHand || 0,
                        qtyAvailable: fbProduct.qtyAvailable || 0,
                        qtyOnOrder: fbProduct.qtyOnOrder || 0
                    };
                    updatedProducts[productKey].lastSyncedAt = new Date().toISOString();
                    updateCount++;
                }
            });
            
            // Save updated products back to JSON file
            if (updateCount > 0) {
                // Use AdminManager to save data if available
                if (window.adminManager) {
                    await window.adminManager.saveData('products', updatedProducts);
                } else {
                    // Fallback to direct API call
                    await fetch('/api/products', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatedProducts)
                    });
                }
                
                // Update last sync timestamp
                this.lastSync = new Date();
                await this.saveConnectionToServer();
                
                return {
                    success: true,
                    message: `Successfully synced ${updateCount} products from Fishbowl`,
                    updatedCount: updateCount
                };
            } else {
                return {
                    success: true,
                    message: 'No products needed updating',
                    updatedCount: 0
                };
            }
        } catch (error) {
            console.error('❌ Error syncing product data:', error);
            return {
                success: false,
                message: `Failed to sync products: ${error.message}`,
                error: error
            };
        }
    }
    
    /**
     * Create a sales order in Fishbowl
     * @param {Object} orderData - Sales order data
     * @returns {Promise<Object>} - Result with success status and order number
     */
    async createSalesOrder(orderData) {
        if (!this.token && !await this.authenticate()) {
            throw new Error('Not authenticated with Fishbowl');
        }
        
        try {
            const response = await fetch(`${this.apiBase}/order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(orderData)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create sales order: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            return {
                success: true,
                message: 'Sales order created successfully',
                orderNumber: result.num || result.orderNumber || 'Unknown'
            };
        } catch (error) {
            console.error('❌ Error creating sales order:', error);
            return {
                success: false,
                message: `Failed to create sales order: ${error.message}`,
                error: error
            };
        }
    }
    
    /**
     * Format quote data for Fishbowl sales order
     * @param {Object} quoteData - Quote data from calculator
     * @returns {Object} - Formatted sales order data for Fishbowl
     */
    formatSalesOrderData(quoteData) {
        // Default customer information
        const customer = {
            name: quoteData.customerName || quoteData.companyName || 'New Customer',
            contact: quoteData.contactName || '',
            phone: quoteData.phone || '',
            email: quoteData.email || '',
            shipAddress: quoteData.shippingAddress || {}
        };
        
        // Format line items
        const items = [];
        if (quoteData.products) {
            quoteData.products.forEach(product => {
                items.push({
                    productNumber: product.sku || product.id,
                    description: product.name,
                    quantity: product.quantity || 1,
                    unitPrice: product.price,
                    total: product.total
                });
            });
        }
        
        // Build sales order object
        return {
            customerName: customer.name,
            customerContact: customer.contact,
            billToName: customer.name,
            billToAddress: customer.shipAddress.address1 || '',
            billToCity: customer.shipAddress.city || '',
            billToState: customer.shipAddress.state || '',
            billToZip: customer.shipAddress.zip || '',
            billToCountry: customer.shipAddress.country || 'USA',
            shipToName: customer.name,
            shipToAddress: customer.shipAddress.address1 || '',
            shipToCity: customer.shipAddress.city || '',
            shipToState: customer.shipAddress.state || '',
            shipToZip: customer.shipAddress.zip || '',
            shipToCountry: customer.shipAddress.country || 'USA',
            phoneNumber: customer.phone,
            email: customer.email,
            poNum: quoteData.quoteNumber || '',
            customerPO: quoteData.purchaseOrderNumber || '',
            dateCreated: new Date().toISOString(),
            salesman: quoteData.salesperson || '',
            taxRateName: quoteData.taxRate ? quoteData.taxRate.name : 'Default',
            priorityName: 'Normal',
            items: items,
            note: `Quote created in Kanva Quotes. Quote #: ${quoteData.quoteNumber || 'N/A'}`
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.FishbowlIntegration = FishbowlIntegration;
    
    // Auto-initialize if adminManager is available
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (window.adminManager) {
                window.fishbowlIntegration = new FishbowlIntegration();
                console.log('✅ FishbowlIntegration initialized globally');
            }
        });
    } else {
        // DOM already loaded
        if (window.adminManager) {
            window.fishbowlIntegration = new FishbowlIntegration();
            console.log('✅ FishbowlIntegration initialized globally');
        }
    }
}

console.log('✅ Fishbowl integration module loaded successfully');
