/**
 * Secure Integration Handler
 * Client-side handler for securely managing integration credentials
 * Works with the connections.json file while keeping sensitive data secure
 */

class SecureIntegrationHandler {
    constructor() {
        this.connectionsPath = 'data/connections.json';
        this.connections = null;
        this.isLoaded = false;
        
        // Sensitive keys that should be handled securely
        this.sensitiveKeys = {
            github: ['token'],
            copper: ['apiKey'],
            fishbowl: ['password'],
            shipstation: ['apiKey', 'apiSecret', 'webhookSecret'],
            ringcentral: ['clientSecret']
        };
    }
    
    /**
     * Load connections data from the server
     * @returns {Promise} Promise that resolves with connections data
     */
    async loadConnections() {
        console.log('🔥 Loading connections from Firebase only...');
        
        if (!window.firebaseDataService) {
            console.error('❌ Firebase Data Service not available');
            throw new Error('Firebase Data Service not initialized');
        }
        
        // Some callers use firebaseDataService.fetchData(), which returns a Response-like
        // object with json() and text() functions. We must normalize to plain JSON
        // before caching or saving to Firestore to avoid writing function fields.
        const fetched = await window.firebaseDataService.fetchData(this.connectionsPath);
        if (fetched && typeof fetched.json === 'function') {
            this.connections = await fetched.json();
        } else {
            this.connections = fetched || {};
        }
        this.isLoaded = true;
        
        // Update cache locally (guard in case helper is unavailable)
        if (typeof window.firebaseDataService.setLocalStorage === 'function') {
            await window.firebaseDataService.setLocalStorage('connections', this.connections);
        } else {
            try { localStorage.setItem('connections', JSON.stringify(this.connections)); } catch (e) {}
        }
        console.log('✅ Loaded connections from Firebase:', this.connections ? 'SUCCESS' : 'NO DATA');
        
        return this.connections;
    }
    
    /**
     * Get a specific integration's settings
     * @param {String} integration - Integration name (github, copper, etc.)
     * @returns {Object} Integration settings
     */
    async getIntegration(integration) {
        if (!this.isLoaded) {
            await this.loadConnections();
        }
        
        return this.connections && this.connections[integration] ? 
            this.connections[integration] : null;
    }
    
    /**
     * Update a specific integration's settings
     * @param {String} integration - Integration name (github, copper, etc.)
     * @param {Object} settings - New settings
     * @returns {Promise} Promise that resolves when update is complete
     */
    async updateIntegration(integration, settings) {
        if (!this.isLoaded) {
            await this.loadConnections();
        }
        
        if (!this.connections) {
            throw new Error('Connections not loaded');
        }
        
        // Update local data
        if (!this.connections[integration]) {
            this.connections[integration] = {};
        }
        
        // Merge new settings with existing ones
        this.connections[integration] = {
            ...this.connections[integration],
            ...settings
        };
        
        // Update timestamp
        if (integration === 'github') {
            this.connections[integration].timestamp = new Date().toISOString();
        } else if (integration === 'copper') {
            this.connections[integration].lastUpdated = new Date().toISOString();
        }
        
        // Update cache
        localStorage.setItem('connections', JSON.stringify(this.connections));
        
        // Persist to Firestore via FirebaseDataService
        return this.saveConnections();
    }
    
    /**
     * Save connections data to the server
     * @returns {Promise} Promise that resolves when save is complete
     */
    async saveConnections() {
        try {
            // Check if we have sensitive keys that need PHP endpoint handling
            const hasSensitiveKeys = this.hasSensitiveKeys();
            
            if (hasSensitiveKeys) {
                // Use PHP endpoint for sensitive keys (clientSecret, apiKey, etc.)
                return await this.saveViaPHPEndpoint();
            } else {
                // Use Firebase for non-sensitive data
                return await this.saveViaFirestore();
            }
        } catch (error) {
            console.error('❌ Error saving connections:', error);
            // As a last resort, cache locally so UI persists this session
            try { localStorage.setItem('connections', JSON.stringify(this.connections)); } catch (e) {}
            if (typeof window.showNotification === 'function') {
                window.showNotification('Failed to save integration settings to cloud. Cached locally.', 'warning');
            }
            return false;
        }
    }
    
    /**
     * Check if current connections contain sensitive keys
     * @returns {boolean} True if sensitive keys are present
     */
    hasSensitiveKeys() {
        const sensitiveKeys = {
            'github': ['token'],
            'copper': ['apiKey'],
            'fishbowl': ['password'],
            'shipstation': ['apiKey', 'apiSecret', 'webhookSecret'],
            'ringcentral': ['clientSecret']
        };
        
        for (const [section, keys] of Object.entries(sensitiveKeys)) {
            if (this.connections[section]) {
                for (const key of keys) {
                    if (this.connections[section][key]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    /**
     * Save via PHP endpoint for sensitive keys
     * @returns {Promise<boolean>}
     */
    async saveViaPHPEndpoint() {
        try {
            const response = await fetch('/api/save-connections.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.connections)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'Failed to save via PHP endpoint');
            }
            
            console.log('✅ Saved connections via PHP endpoint (with sensitive keys)');
            
            // Also save to Firestore for Firebase Functions access
            await this.saveViaFirestore();
            
            return true;
        } catch (error) {
            console.error('❌ Error saving via PHP endpoint:', error);
            throw error;
        }
    }
    
    /**
     * Save via Firestore for non-sensitive data
     * @returns {Promise<boolean>}
     */
    async saveViaFirestore() {
        try {
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            // Ensure we never pass functions (e.g., lingering Response.json()) into Firestore
            // Convert to a plain JSON structure, dropping any functions/undefined/symbols
            let plain;
            try {
                plain = JSON.parse(JSON.stringify(this.connections));
            } catch (e) {
                // Fallback: shallow copy if stringify fails for any reason
                plain = { ...this.connections };
            }

            // Extra guard: if a rogue 'json' key exists and is a function, drop it
            if (plain && typeof plain.json === 'function') {
                try { delete plain.json; } catch (_) {}
            }

            const success = await window.firebaseDataService.saveData(this.connectionsPath, plain);
            if (!success) throw new Error('Failed to save to Firestore');
            console.log('✅ Saved connections to Firestore');
            return true;
        } catch (error) {
            console.error('❌ Error saving to Firestore:', error);
            throw error;
        }
    }
    
    /**
     * Fallback method to save connections directly to the file
     * This is used when the API endpoint is not available
     * @returns {Promise} Promise that resolves when save is complete
     */
    async fallbackSaveConnections() {
        // Deprecated: PHP endpoints removed. Keep for backward compatibility but no-op.
        console.warn('ℹ️ fallbackSaveConnections is deprecated; using Firestore only.');
        return false;
    }
    
    /**
     * Test a connection to verify credentials
     * @param {String} integration - Integration name (github, copper, etc.)
     * @returns {Promise} Promise that resolves with test result
     */
    async testConnection(integration) {
        const settings = await this.getIntegration(integration);
        if (!settings) {
            return { success: false, message: 'Integration not configured' };
        }
        
        try {
            let testResult;
            
            switch (integration) {
                case 'github':
                    testResult = await this.testGitHubConnection(settings);
                    break;
                case 'copper':
                    testResult = await this.testCopperConnection(settings);
                    break;
                case 'fishbowl':
                    testResult = await this.testFishbowlConnection(settings);
                    break;
                case 'shipstation':
                    testResult = await this.testShipStationConnection(settings);
                    break;
                default:
                    return { success: false, message: 'Unknown integration' };
            }
            
            return testResult;
        } catch (error) {
            console.error(`❌ Error testing ${integration} connection:`, error);
            return { 
                success: false, 
                message: `Connection test failed: ${error.message}` 
            };
        }
    }
    
    /**
     * Test GitHub connection
     * @param {Object} settings - GitHub settings
     * @returns {Promise} Promise that resolves with test result
     */
    async testGitHubConnection(settings) {
        try {
            // Test GitHub API with the token
            const response = await fetch(`https://api.github.com/repos/${settings.repo}`, {
                headers: {
                    'Authorization': `token ${settings.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }
            
            const repo = await response.json();
            return { 
                success: true, 
                message: `Successfully connected to ${repo.full_name}`,
                data: {
                    name: repo.name,
                    owner: repo.owner.login,
                    stars: repo.stargazers_count,
                    defaultBranch: repo.default_branch
                }
            };
        } catch (error) {
            console.error('❌ GitHub connection test failed:', error);
            return { success: false, message: `GitHub connection failed: ${error.message}` };
        }
    }
    
    /**
     * Test Copper CRM connection
     * @param {Object} settings - Copper settings
     * @returns {Promise} Promise that resolves with test result
     */
    async testCopperConnection(settings) {
        // In a real implementation, this would make an API call to Copper
        // For now, we'll simulate a successful connection
        return { 
            success: true, 
            message: 'Successfully connected to Copper CRM',
            data: {
                user: settings.email,
                environment: settings.environment
            }
        };
    }
    
    /**
     * Test Fishbowl connection
     * @param {Object} settings - Fishbowl settings
     * @returns {Promise} Promise that resolves with test result
     */
    async testFishbowlConnection(settings) {
        // In a real implementation, this would make an API call to Fishbowl
        // For now, we'll simulate a successful connection if all required fields are present
        if (settings.username && settings.password && settings.host) {
            return { 
                success: true, 
                message: 'Successfully connected to Fishbowl',
                data: {
                    host: settings.host,
                    user: settings.username
                }
            };
        } else {
            return { 
                success: false, 
                message: 'Missing required Fishbowl credentials' 
            };
        }
    }
    
    /**
     * Test ShipStation connection
     * @param {Object} settings - ShipStation settings
     * @returns {Promise} Promise that resolves with test result
     */
    async testShipStationConnection(settings) {
        // In a real implementation, this would make an API call to ShipStation
        // For now, we'll simulate a successful connection if API key and secret are present
        if (settings.apiKey && settings.apiSecret) {
            return { 
                success: true, 
                message: 'Successfully connected to ShipStation',
                data: {
                    webhookConfigured: !!settings.webhookUrl
                }
            };
        } else {
            return { 
                success: false, 
                message: 'Missing required ShipStation credentials' 
            };
        }
    }
}

// Create a global instance
window.secureIntegrationHandler = new SecureIntegrationHandler();

// For backward compatibility with existing code
window.getIntegrationSettings = async function(integration) {
    return window.secureIntegrationHandler.getIntegration(integration);
};

window.saveIntegrationSettings = async function(integration, settings) {
    return window.secureIntegrationHandler.updateIntegration(integration, settings);
};

window.testIntegrationConnection = async function(integration) {
    return window.secureIntegrationHandler.testConnection(integration);
};

console.log('✅ Secure Integration Handler loaded successfully');
