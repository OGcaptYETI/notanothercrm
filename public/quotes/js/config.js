// Kanva Botanicals Config Utilities
// Uses adminConfig already defined in admin.js

// Helper to safely get config (always available since admin.js loads first)
function getConfig(cb) {
    if (typeof adminConfig !== 'undefined') {
        cb(adminConfig);
    } else {
        // Fallback - retry after a short delay
        setTimeout(() => getConfig(cb), 100);
    }
}

// --- All shipping and payment config is now available via adminConfig ---

// NEW: Shipping zone detection helper
const ShippingManager = {
    // Get shipping zone for a state
    getZoneForState: function(state) {
        const stateUpper = state.toUpperCase();
        
        for (const [zoneKey, zone] of Object.entries(adminConfig.shipping.zones)) {
            if (zone.states.includes(stateUpper)) {
                return {
                    zone: zoneKey,
                    name: zone.name,
                    rates: zone.rates
                };
            }
        }
        
        // Default to Zone 4 (highest rate) if state not found
        return {
            zone: 'zone4',
            name: adminConfig.shipping.zones.zone4.name,
            rates: adminConfig.shipping.zones.zone4.rates
        };
    },
    
    // Calculate shipping cost based on quantity and zone
    calculateShipping: function(totalDisplayBoxes, totalMasterCases, state) {
        const zoneInfo = this.getZoneForState(state);
        const rates = zoneInfo.rates;
        
        // If customer ordered full master cases, use master case rate
        if (totalMasterCases >= 1) {
            return rates.mastercase * totalMasterCases;
        }
        
        // Otherwise use display box rates
        if (totalDisplayBoxes >= 1 && totalDisplayBoxes <= 3) {
            return rates['1-3boxes'];
        } else if (totalDisplayBoxes >= 4 && totalDisplayBoxes <= 8) {
            return rates['4-8boxes'];
        } else if (totalDisplayBoxes >= 9 && totalDisplayBoxes <= 11) {
            return rates['9-11boxes'];
        }
        
        // Default fallback
        return rates['1-3boxes'];
    },
    
    // Get all zones for dropdown
    getAllZones: function() {
        return Object.entries(adminConfig.shipping.zones).map(([key, zone]) => ({
            value: key,
            label: zone.name,
            states: zone.states
        }));
    }
};

// FIXED: Updated TierManager with correct thresholds
const TierManager = {
    // Get tier for given quantity (FIXED)
    getTier: function(masterCases) {
        const tiers = adminConfig.tiers;
        
        if (masterCases >= tiers['3'].threshold) return tiers['3'];
        if (masterCases >= tiers['2'].threshold) return tiers['2'];
        return tiers['1'];
    },

    // Get all tiers
    getAll: function() {
        return adminConfig.tiers;
    },
    
    // Get next tier info for upselling
    getNextTier: function(currentMasterCases) {
        const tiers = adminConfig.tiers;
        
        if (currentMasterCases < tiers['2'].threshold) {
            return {
                tier: tiers['2'],
                casesNeeded: tiers['2'].threshold - currentMasterCases
            };
        } else if (currentMasterCases < tiers['3'].threshold) {
            return {
                tier: tiers['3'],
                casesNeeded: tiers['3'].threshold - currentMasterCases
            };
        }
        
        return null; // Already at highest tier
    }
};

// Keep existing managers but update them
const ConfigManager = {
    // Load configuration from localStorage
    load: function() {
        try {
            const saved = localStorage.getItem('kanvaAdminConfig');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                // Merge saved config with defaults to handle new fields
                adminConfig = this.mergeConfigs(adminConfig, savedConfig);
                console.log('✅ Admin configuration loaded from localStorage');
                return true;
            }
        } catch (error) {
            console.error('❌ Error loading admin configuration:', error);
        }
        return false;
    },
    // Save configuration to localStorage
    save: function(config = adminConfig) {
        try {
            config.metadata.lastUpdated = new Date().toISOString();
            config.metadata.configuredBy = appState.currentUser?.email || 'Unknown';
            localStorage.setItem('kanvaAdminConfig', JSON.stringify(config));
            console.log('✅ Admin configuration saved to localStorage');
            return true;
        } catch (error) {
            console.error('❌ Error saving admin configuration:', error);
        }
        return false;
    },

    // Merge configurations (saved overwrites defaults)
    mergeConfigs: function(defaultConfig, savedConfig) {
        const merged = { ...defaultConfig };
        
        // Deep merge for nested objects
        for (const key in savedConfig) {
            if (typeof savedConfig[key] === 'object' && !Array.isArray(savedConfig[key])) {
                merged[key] = { ...defaultConfig[key], ...savedConfig[key] };
            } else {
                merged[key] = savedConfig[key];
            }
        }
        
        return merged;
    },

    // Reset to default configuration
    reset: function() {
        try {
            localStorage.removeItem('kanvaAdminConfig');
            console.log('✅ Admin configuration reset to defaults');
            return true;
        } catch (error) {
            console.error('❌ Error resetting admin configuration:', error);
        }
        return false;
    },

    // Validate configuration integrity
    validate: function(config = adminConfig) {
        const errors = [];

        // Validate products
        for (const [key, product] of Object.entries(config.products)) {
            if (!product.name || product.price <= 0 || product.msrp <= 0) {
                errors.push(`Invalid product configuration: ${key}`);
            }
        }

        // Validate tiers  
        if (config.tiers['2'].threshold <= config.tiers['1'].threshold ||
            config.tiers['3'].threshold <= config.tiers['2'].threshold) {
            errors.push('Invalid tier thresholds');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    // Get current configuration
    get: function() {
        return adminConfig;
    },

    // Update specific configuration section
    update: function(section, data) {
        if (adminConfig[section]) {
            adminConfig[section] = { ...adminConfig[section], ...data };
            return this.save();
        }
        return false;
    }
};

// Keep existing AuthManager
const AuthManager = {
    // Check if user is admin
    isAdmin: function(email) {
        return adminConfig.adminEmails.includes(email?.toLowerCase());
    },

    // Set current user
    setUser: function(user) {
        appState.currentUser = user;
        appState.isAdmin = this.isAdmin(user?.email);
        console.log(`👤 User set: ${user?.email || 'Unknown'} (Admin: ${appState.isAdmin})`);
    },

    // Get current user
    getUser: function() {
        return appState.currentUser;
    }
};

// Keep existing ProductManager
const ProductManager = {
    // Get all products
    getAll: function() {
        return adminConfig.products;
    },

    // Get specific product
    get: function(productId) {
        return adminConfig.products[productId];
    },

    // Get product options for dropdowns
    getOptions: function() {
        return Object.entries(adminConfig.products).map(([key, product]) => ({
            value: key,
            label: `${product.name} ($${product.price})`,
            product: product
        }));
    }
};

// Initialize configuration on script load
console.log('🔧 Initializing Kanva Botanicals configuration with 2025 pricing...');

// Load saved configuration
ConfigManager.load();

// Validate configuration
const validation = ConfigManager.validate();
if (!validation.isValid) {
    console.warn('⚠️  Configuration validation errors:', validation.errors);
}

console.log('✅ Configuration initialized with real 2025 pricing data');
