/**
 * Connections Updater
 * Fallback JavaScript solution for updating connections when PHP is not available
 */

class ConnectionsUpdater {
    constructor() {
        this.connectionsPath = './data/connections.json';
        this.sensitiveKeys = {
            github: ['token'],
            copper: ['apiKey'],
            fishbowl: ['password'],
            shipstation: ['apiKey', 'apiSecret', 'webhookSecret']
        };
    }
    
    /**
     * Update connections with new values
     * @param {Object} newConnections - New connections data
     * @returns {Promise} Promise that resolves when update is complete
     */
    async updateConnections(newConnections) {
        try {
            // Load current connections
            const currentConnections = await this.loadConnections();
            
            // Merge new connections with current ones
            const mergedConnections = this.mergeConnections(currentConnections, newConnections);
            
            // Create a sanitized version for display and storage
            const sanitizedConnections = this.sanitizeConnections(mergedConnections);
            
            // Store in localStorage for client-side persistence
            localStorage.setItem('connections', JSON.stringify(sanitizedConnections));
            
            // In a real server environment, we would save to the file system
            // But in a client-only environment, we can only persist to localStorage
            console.log('✅ Connections updated in localStorage');
            
            // Show a notification to the user that they should run the server-side script
            this.showServerSyncNotification();
            
            return true;
        } catch (error) {
            console.error('❌ Error updating connections:', error);
            return false;
        }
    }
    
    /**
     * Load connections from file or localStorage
     * @returns {Promise} Promise that resolves with connections data
     */
    async loadConnections() {
        console.log('🔥 Loading connections from Firebase only...');
        
        if (!window.firebaseDataService) {
            console.error('❌ Firebase Data Service not available');
            throw new Error('Firebase Data Service not initialized');
        }
        
        const connections = await window.firebaseDataService.fetchData(this.connectionsPath);
        
        // Cache in Firebase storage
        await window.firebaseDataService.setLocalStorage('connections', connections);
        
        console.log('✅ Connections loaded from Firebase:', connections ? 'SUCCESS' : 'NO DATA');
        return connections || {};
    }
    
    /**
     * Merge new connections with current ones
     * @param {Object} current - Current connections
     * @param {Object} updates - Updates to apply
     * @returns {Object} Merged connections
     */
    mergeConnections(current, updates) {
        const result = { ...current };
        
        for (const [section, values] of Object.entries(updates)) {
            if (!result[section]) {
                result[section] = {};
            }
            
            result[section] = { ...result[section], ...values };
        }
        
        // Update timestamps
        if (result.github) {
            result.github.timestamp = new Date().toISOString();
        }
        if (result.copper) {
            result.copper.lastUpdated = new Date().toISOString();
        }
        
        return result;
    }
    
    /**
     * Create a sanitized version of connections for display
     * @param {Object} connections - Connections data
     * @returns {Object} Sanitized connections
     */
    sanitizeConnections(connections) {
        const sanitized = JSON.parse(JSON.stringify(connections));
        
        for (const [section, keys] of Object.entries(this.sensitiveKeys)) {
            if (sanitized[section]) {
                for (const key of keys) {
                    if (sanitized[section][key]) {
                        // For display purposes, show a masked version
                        if (sanitized[section][key].length > 8) {
                            sanitized[section][key] = sanitized[section][key].substring(0, 4) + 
                                '•'.repeat(sanitized[section][key].length - 8) + 
                                sanitized[section][key].substring(sanitized[section][key].length - 4);
                        } else {
                            sanitized[section][key] = '•'.repeat(sanitized[section][key].length);
                        }
                    }
                }
            }
        }
        
        return sanitized;
    }
    
    /**
     * Show a notification to the user that they should run the server-side script
     */
    showServerSyncNotification() {
        // Check if we have a notification system
        if (typeof window.showNotification === 'function') {
            window.showNotification(
                'Integration settings updated locally. Run "npm run secure-connections" to sync with server.',
                'info',
                10000 // 10 seconds
            );
        } else {
            console.log('⚠️ Please run "npm run secure-connections" to sync integration settings with the server');
        }
    }
}

// Create a global instance
window.connectionsUpdater = new ConnectionsUpdater();

console.log('✅ Connections Updater loaded successfully');
