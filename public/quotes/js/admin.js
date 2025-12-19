// Default admin configuration (can be overridden by localStorage)
let adminConfig = {
    // Product catalog with pricing and details
    products: {
    focus: {
        name: "Focus+Flow",
        price: 4.50,                    // Wholesale price per bottle
        msrp: 9.99,                     // MSRP per bottle
        unitsPerCase: 12,               // 12 bottles per display box (as shown in PDF)
        displayBoxesPerCase: 12,        // 12 display boxes per master case
        description: "Kava + Kratom extract blend - #1 selling shot",
        category: "kava_kratom",
        isBestSeller: true
    },
    release: {
        name: "Release+Relax", 
        price: 4.50,                    // Wholesale price per bottle
        msrp: 9.99,                     // MSRP per bottle
        unitsPerCase: 12,               // 12 bottles per display box
        displayBoxesPerCase: 12,        // 12 display boxes per master case
        description: "Kanna + Kava blend for stress relief",
        category: "kanna_kava",
        isBestSeller: false
    },
    raw: {
        name: "Raw+Releaf",
        price: 4.50,                    // Wholesale price per bottle
        msrp: 9.99,                     // MSRP per bottle  
        unitsPerCase: 12,               // 12 bottles per display box
        displayBoxesPerCase: 12,        // 12 display boxes per master case
        description: "Pure leaf, pure relief - Kratom leaf + Kava extract",
        category: "kratom_kava",
        isNewProduct: true
    },
    zoom: {
        name: "Kanva Zoom",
        price: 3.10,                    // Lower wholesale price
        msrp: 6.99,                     // Lower MSRP
        unitsPerCase: 12,               // 12 bottles per display box
        displayBoxesPerCase: 12,        // 12 display boxes per master case  
        description: "Kratom energy shot",
        category: "kratom_energy",
        isBestSeller: false
    }
},


    // Volume tier pricing structure
    tiers: {
        "1": {
            tierId: 1,
            threshold: 0,
            discount: 0,
            name: "Tier 1",
            description: "Standard pricing for orders under 56 cases"
        },
        "2": {
            tierId: 2,
            threshold: 56,
            discount: 0.035,
            name: "Tier 2", 
            description: "Volume discount for 56-111 cases"
        },
        "3": {
            tierId: 3,
            threshold: 112,
            discount: 0.06,
            name: "Tier 3",
            description: "Best pricing for 112+ cases"
        }
    },

    // Shipping and logistics settings
    shipping: {
        rate: 0.015,                    // 1.5% of subtotal
        freeThreshold: 50000,           // Free shipping over $50k
        description: "Standard shipping rate and thresholds"
    },

    // Payment processing rules
    payment: {
        achThreshold: 10000,            // ACH required over $10k
        acceptedMethods: ['ACH', 'Wire Transfer', 'Company Check'],
        description: "Payment thresholds and accepted methods"
    },

    // Maximum retail price guidance
    maxRetailPrices: {
    default: 5.00,
    focus: 5.00,        // Focus+Flow max retail
    release: 5.00,      // Release+Relax max retail  
    raw: 5.00,          // Raw+Releaf max retail
    zoom: 3.50,         // Zoom max retail (lower due to lower MSRP)
    description: "Maximum recommended retail prices"
},

    // Email template settings
    emailSettings: {
        companyName: "Kanva Botanicals",
        supportEmail: "sales@kanvabotanicals.com",
        phone: "[PHONE NUMBER]",
        website: "www.kanvabotanicals.com"
    },

    // Feature flags
    features: {
        adminPanel: true,
        emailGeneration: true,
        crmIntegration: true,
        freeShipping: true,
        volumeDiscounts: true
    },

    // Admin email addresses for authentication
    adminEmails: [
        'ben@kanvabotanicals.com',
        'admin@kanvabotanicals.com',
        'sales@kanvabotanicals.com'
    ],

    // Application metadata
    metadata: {
        version: "2.0.0",
        lastUpdated: new Date().toISOString(),
        configuredBy: null
    }
};

// Global application state
let appState = {
    // User and authentication
    currentUser: null,
    isAdmin: false,
    isModalMode: false,
    isLeftNav: false,
    appLocation: 'sidebar',

    // Copper SDK integration
    sdk: null,
    copperContext: null,

    // UI state
    currentView: 'calculator',
    adminPanelOpen: false,
    
    // Calculation cache
    lastCalculation: null,
    
    // Application lifecycle
    isReady: false,
    hasError: false,
    loadTime: null,
    startTime: Date.now()
};

// Authentication helper functions are now in config.js

// Product helper functions are now in config.js

// Tier calculation helper is now in config.js

// Initialize configuration on script load
console.log('🔧 Initializing Kanva Botanicals configuration...');

// Configuration will be loaded by config.js when it loads

console.log('✅ Configuration initialized successfully');
