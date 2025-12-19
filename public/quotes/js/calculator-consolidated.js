
/**
 * Consolidated Kanva Botanicals Quote Calculator
 * Combines features from calculator.js, kanva-calculator.js, and multi-product-calculator.js
 * 
 * Features:
 * - Single & multi-product calculations
 * - Robust tier pricing with unit/display box/case structure
 * - Shipping zone detection with LTL percentages
 * - Admin panel functionality
 * - Product line management (add/remove)
 * - Quote generation and email templates
 * - JSON data loading architecture
 * - Credit card fee calculation (3%)
 * - Manual shipping override
 */

class KanvaCalculator {
    constructor() {
        this.data = {
            products: {},
            tiers: {},
            shipping: { zones: {}, states: [] },
            payment: {},
            adminEmails: []
        };
        
        this.lineItems = [];
        this.quote = {
            products: [],
            lineItems: [],
            subtotal: 0,
            shipping: 0,
            creditCardFee: 0,
            total: 0,
            tierInfo: null,
            paymentMethod: null,
            paymentMethods: []
        };
        
        this.isAdmin = false;
        this.isReady = false;
        this.currentShippingZone = null;
        this.isRetailMode = false; // Default to distribution pricing
        
        // Settings
        this.settings = {
            creditCardFeeRate: 0.03, // 3%
            shippingRateMin: 0.005,  // 0.5%
            shippingRateMax: 0.025,  // 2.5%
            palletThreshold: 0.5,    // Half pallet threshold
            paymentMethod: 'wire'    // Default payment method
        };
        
        // Admin password
        this.adminPassword = 'kanva123'; // Default admin password
    }

    /**
     * Initialize the calculator
     */
    async init() {
        console.log('🧮 Initializing Kanva Calculator...');
        
        try {
            await this.loadData();
            this.detectAdmin();
            this.initializeUI();
            this.updateEmptyState(); // Show empty state initially
            this.bindEvents();
            
            // Initialize order details manager if available
            if (typeof OrderDetailsManager !== 'undefined') {
                window.orderDetails = new OrderDetailsManager(this);
                console.log('📋 Order details manager initialized');
            }
            
            // Initialize admin manager if available
            if (typeof AdminManager !== 'undefined') {
                console.log('🔧 AdminManager class found, creating instance...');
                window.adminManager = new AdminManager(this);
                console.log('👥 Admin manager initialized:', window.adminManager);
                
                // Also create global reference for backward compatibility
                window.adminManager = window.adminManager;
            } else {
                console.error('❌ AdminManager class not found. Make sure admin-manager.js is loaded.');
            }
            
            this.isReady = true;
            this.showApp();
            
            console.log('✅ Kanva Calculator initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize calculator:', error);
            this.showError('Failed to initialize calculator. Please refresh the page.');
        }
    }

    /**
     * Fixed loadData method for KanvaCalculator
     * This replaces the existing loadData method in your calculator
     */
    async loadData() {
        console.log('🔄 Loading data from Firebase...');
        
        // Ensure Firebase Data Service is available and initialized
        if (!window.firebaseDataService) {
            console.error('❌ Firebase Data Service not available');
            throw new Error('Firebase Data Service not initialized');
        }
        
        // Initialize Firebase Data Service
        try {
            await window.firebaseDataService.initialize();
            console.log('✅ Firebase Data Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Firebase Data Service:', error);
            throw new Error('Failed to initialize Firebase Data Service');
        }
        
        // Load each data type individually with proper error handling
        const dataPromises = {
            products: this.loadProducts(),
            tiers: this.loadTiers(),
            shipping: this.loadShipping(),
            payment: this.loadPayment(),
            adminEmails: this.loadAdminEmails()
        };
        
        // Execute all loads in parallel but handle errors individually
        const results = await Promise.allSettled(Object.values(dataPromises));
        const keys = Object.keys(dataPromises);
        
        // Process results and set data
        for (let i = 0; i < results.length; i++) {
            const key = keys[i];
            const result = results[i];
            
            if (result.status === 'fulfilled') {
                this.data[key === 'adminEmails' ? 'adminEmails' : key] = result.value;
                console.log(`✅ Loaded ${key} successfully`);
            } else {
                console.error(`❌ Failed to load ${key}:`, result.reason);
                // Set empty defaults to prevent crashes
                if (key === 'adminEmails') {
                    this.data.adminEmails = [];
                } else {
                    this.data[key] = {};
                }
            }
        }
        
        console.log('📊 Final data state:', {
            products: Object.keys(this.data.products || {}).length,
            tiers: Object.keys(this.data.tiers || {}).length,
            shipping: Object.keys(this.data.shipping || {}).length,
            payment: Object.keys(this.data.payment || {}).length,
            adminEmails: this.data.adminEmails?.length || 0
        });
    }

    /**
     * Load products from Firebase
     */
    async loadProducts() {
        try {
            console.log('📦 Loading products from Firebase...');
            const productsData = await window.firebaseDataService.getCollection('products');
            
            if (!productsData || Object.keys(productsData).length === 0) {
                console.warn('⚠️ No products found in Firebase, checking for sample data...');
                // You might want to seed some sample data here
                return {};
            }
            
            console.log(`✅ Loaded ${Object.keys(productsData).length} products from Firebase`);
            return productsData;
        } catch (error) {
            console.error('❌ Error loading products:', error);
            throw error;
        }
    }

    /**
     * Load tiers from Firebase
     */
    async loadTiers() {
        try {
            console.log('🏆 Loading tiers from Firebase...');
            const tiersData = await window.firebaseDataService.getDocument('pricing', 'tiers');
            
            if (!tiersData || Object.keys(tiersData).length === 0) {
                console.warn('⚠️ No tiers found in Firebase');
                return {};
            }
            
            console.log(`✅ Loaded ${Object.keys(tiersData).length} tiers from Firebase`);
            return tiersData;
        } catch (error) {
            console.error('❌ Error loading tiers:', error);
            throw error;
        }
    }

    /**
     * Load shipping from Firebase
     */
    async loadShipping() {
        try {
            console.log('🚚 Loading shipping from Firebase...');
            const shippingData = await window.firebaseDataService.getDocument('shipping', 'config');
            
            if (!shippingData || Object.keys(shippingData).length === 0) {
                console.warn('⚠️ No shipping data found in Firebase');
                return { zones: {}, states: [] };
            }
            
            console.log(`✅ Loaded shipping data from Firebase`);
            return shippingData;
        } catch (error) {
            console.error('❌ Error loading shipping:', error);
            throw error;
        }
    }

    /**
     * Load payment from Firebase
     */
    async loadPayment() {
        try {
            console.log('💳 Loading payment from Firebase...');
            const paymentData = await window.firebaseDataService.getDocument('payment', 'config');
            
            if (!paymentData || Object.keys(paymentData).length === 0) {
                console.warn('⚠️ No payment data found in Firebase');
                return {};
            }
            
            console.log(`✅ Loaded payment data from Firebase`);
            return paymentData;
        } catch (error) {
            console.error('❌ Error loading payment:', error);
            throw error;
        }
    }

    /**
     * Load admin emails from Firebase
     */
    async loadAdminEmails() {
        try {
            console.log('👥 Loading admin emails from Firebase...');
            const emailData = await window.firebaseDataService.getDocument('admin', 'emails');
            
            if (!emailData || !emailData.emails) {
                console.warn('⚠️ No admin emails found in Firebase');
                return [];
            }
            
            console.log(`✅ Loaded ${emailData.emails.length} admin emails from Firebase`);
            return emailData.emails;
        } catch (error) {
            console.error('❌ Error loading admin emails:', error);
            throw error;
        }
    }

    /**
     * Detect if current user is admin
     */
    detectAdmin() {
        // For testing: Make everyone an admin
        this.isAdmin = false;
        console.log('👤 Admin mode DISABLED for testing');
        
        // Original admin detection (commented out for reference):
        // const urlParams = new URLSearchParams(window.location.search);
        // const email = urlParams.get('email') || 'demo@kanvabotanicals.com';
        // this.isAdmin = this.data.adminEmails.includes(email);
        // console.log(`👤 User: ${email} (Admin: ${this.isAdmin})`);
    }

    /**
     * Initialize UI elements
     */
    initializeUI() {
        this.populateProductDropdowns();
        this.populateStateDropdown();
        this.populateProductReference(); // Add product reference tiles
        this.updateAdminUI();
        
        console.log('✅ UI initialized with product reference tiles');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Pricing mode toggle
        const pricingToggle = document.getElementById('pricingModeToggle');
        if (pricingToggle) {
            console.log('🔗 Pricing toggle found and binding event listener');
            
            // Remove any existing event listeners to prevent duplicates
            pricingToggle.removeEventListener('change', this.pricingToggleHandler);
            
            // Create bound handler function
            this.pricingToggleHandler = (e) => {
                console.log('🔄 Pricing toggle event triggered');
                this.isRetailMode = e.target.checked;
                console.log(`💰 Pricing mode changed to: ${this.isRetailMode ? 'Retail' : 'Distribution'}`);
                console.log('🔄 Current toggle state:', e.target.checked);
                console.log('🔄 Current isRetailMode:', this.isRetailMode);
                
                // Show notification to user
                this.showNotification(`Pricing mode changed to ${this.isRetailMode ? 'Retail' : 'Distribution'}`, 'info');
                
                // Update product catalog with new pricing
                console.log('🔄 Calling populateProductReference...');
                this.populateProductReference();
                
                // Update any existing line items with new pricing
                console.log('🔄 Calling updateAllLineItemPricing...');
                this.updateAllLineItemPricing();
                
                // Force refresh the order details
                if (this.orderDetailsManager) {
                    console.log('🔄 Calling renderLineItemDetails...');
                    this.orderDetailsManager.renderLineItemDetails();
                }
                
                // Recalculate totals
                console.log('🔄 Calling calculateAll...');
                this.calculateAll();
                
                console.log('✅ Pricing toggle event completed');
            };
            
            // Add the event listener
            pricingToggle.addEventListener('change', this.pricingToggleHandler);
        } else {
            console.warn('⚠️ Pricing toggle element not found! ID: pricingModeToggle');
        }
        
        console.log('✅ Event listeners bound');
    }

    /**
     * Update pricing for all existing line items
     */
    updateAllLineItemPricing() {
        console.log('🔄 Updating all line item pricing with mode:', this.isRetailMode ? 'Retail' : 'Distribution');
        
        // First, update the product data in each line item
        this.lineItems.forEach(lineItem => {
            // Make sure we have the latest product data
            if (lineItem.productId) {
                lineItem.productData = this.data.products[lineItem.productId];
            }
        });
        
        // Then update pricing for each line item
        this.lineItems.forEach(lineItem => {
            const product = lineItem.productData;
            if (product) {
                // Get current price based on pricing mode
                const currentPrice = this.getCurrentPrice(product);
                
                // Skip update if user has overridden the price
                if (lineItem.customUnitPrice === undefined) {
                    lineItem.unitPrice = currentPrice;
                    console.log(`📊 Updated line item ${lineItem.id}: ${product.name} - Unit Price: $${currentPrice.toFixed(2)}`);
                } else {
                    console.log(`📊 Skipping price update for ${lineItem.id}: ${product.name} - Custom price set: $${lineItem.customUnitPrice.toFixed(2)}`);
                }
            }
        });
        
        // Refresh the UI
        this.renderProductLines();
        
        // Update the order details
        if (this.orderDetailsManager) {
            this.orderDetailsManager.renderLineItemDetails();
        }
        
        // Recalculate totals
        this.calculateAll();
    }

    /**
     * Get current price based on pricing mode and volume tiers
     */
    getCurrentPrice(product) {
        if (!product) return 0;
        
        // For retail mode, use fixed retail price (no volume tiers)
        if (this.isRetailMode && product.retailPrice !== undefined) {
            const retailPrice = parseFloat(product.retailPrice);
            console.log(`💰 Using retail price for ${product.name}: $${retailPrice.toFixed(2)}`);
            return retailPrice;
        }
        
        // For distribution mode, apply volume tier pricing
        const totalMasterCases = this.calculateTotalMasterCases();
        const tier = this.determinePricingTier(totalMasterCases);
        const tierPrice = this.getTierPrice(product, tier);
        
        console.log(`💰 Distribution pricing for ${product.name}:`, {
            totalMasterCases,
            tier: tier.name,
            tierPrice: tierPrice.toFixed(2)
        });
        
        return tierPrice;
    }
    
    /**
     * Calculate total master cases across all line items
     */
    calculateTotalMasterCases() {
        return this.lineItems.reduce((total, lineItem) => {
            return total + (lineItem.masterCases || 0);
        }, 0);
    }
    
    /**
     * Determine which pricing tier applies based on total volume
     */
    determinePricingTier(totalMasterCases) {
        // Default to tier 1 if no tiers data
        if (!this.data.tiers || Object.keys(this.data.tiers).length === 0) {
            return { id: '1', name: 'Tier 1', threshold: 0 };
        }
        
        // Sort tiers by threshold (highest first) to find the highest applicable tier
        const sortedTiers = Object.entries(this.data.tiers)
            .map(([id, tier]) => ({ id, ...tier }))
            .sort((a, b) => b.threshold - a.threshold);
        
        // Find the highest tier that the total volume qualifies for
        for (const tier of sortedTiers) {
            if (totalMasterCases >= tier.threshold) {
                return tier;
            }
        }
        
        // Fallback to the lowest tier
        return sortedTiers[sortedTiers.length - 1] || { id: '1', name: 'Tier 1', threshold: 0 };
    }
    
    /**
     * Get tier-specific price for a product
     */
    getTierPrice(product, tier) {
        // If we have tier pricing data, use it
        if (tier && tier.prices && tier.prices[product.productId]) {
            return parseFloat(tier.prices[product.productId]);
        }
        
        // Fallback to base product price
        return parseFloat(product.price || 0);
    }

    /**
     * Populate product dropdowns
     */
    populateProductDropdowns() {
        const productSelects = document.querySelectorAll('.product-select');
        
        productSelects.forEach(select => {
            this.populateProductDropdown(select);
        });
        
        console.log('✅ Product dropdowns populated');
    }

    populateProductDropdown(selectElement) {
        if (!selectElement) return;
        
        // Clear existing options except the first one
        selectElement.innerHTML = '<option value="">Select a product...</option>';
        
        // Handle both array and object product structures
        let products = [];
        if (Array.isArray(this.data.products)) {
            products = this.data.products;
        } else if (this.data.products && typeof this.data.products === 'object') {
            products = Object.entries(this.data.products).map(([key, product]) => ({
                ...product,
                id: key
            }));
        }
        
        // Sort products by name
        products.sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));
        
        // Add options
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name || product.title || 'Unknown'} - ${product.sku || product.id || 'No SKU'}`;
            selectElement.appendChild(option);
        });
    }
    
    /**
     * Populate state dropdown from shipping zones
     */
    populateStateDropdown() {
        const stateSelect = document.getElementById('customerState');
        if (!stateSelect || !this.data.shipping?.zones) return;
        
        // Clear existing options
        stateSelect.innerHTML = '<option value="">Select state...</option>';
        
        // Collect all states from zones
        const allStates = [];
        Object.values(this.data.shipping.zones).forEach(zone => {
            if (zone.states && Array.isArray(zone.states)) {
                zone.states.forEach(stateCode => {
                    allStates.push({
                        code: stateCode,
                        name: this.getStateName(stateCode)
                    });
                });
            }
        });
        
        // Sort states alphabetically by name
        allStates.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add options
        allStates.forEach(state => {
            const option = document.createElement('option');
            option.value = state.code;
            option.textContent = state.name;
            stateSelect.appendChild(option);
        });
        
        console.log('✅ State dropdown populated with', allStates.length, 'states');
    }
    
    /**
     * Convert state code to full name
     */
    getStateName(code) {
        const stateNames = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
            'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
            'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
            'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
            'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
            'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
            'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
            'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
            'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
            'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
            'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
        };
        return stateNames[code] || code;
    }
    
    /**
     * Update shipping zone display
     */
    updateShippingZoneDisplay() {
        const shippingZoneInfo = document.getElementById('shippingZoneInfo');
        if (!shippingZoneInfo) return;
        
        if (!this.currentShippingZone) {
            shippingZoneInfo.innerHTML = '<p class="text-muted">Select a state to see shipping information</p>';
            return;
        }
        
        const zoneData = this.data.shipping.zones[this.currentShippingZone];
        if (!zoneData) return;
        
        // Get ground shipping rates for this zone
        const groundRates = this.getGroundShippingRates(zoneData.zoneNumber);
        
        shippingZoneInfo.innerHTML = `
            <div class="shipping-zone-details">
                <div class="zone-header">
                    <span class="zone-name">${zoneData.name.toUpperCase()}</span>
                    <span class="zone-color" style="background-color: ${zoneData.color || '#ccc'}"></span>
                </div>
                <div class="zone-info">
                    <div class="shipping-methods">
                        <div class="ltl-shipping">
                            <p><strong>🚛 LTL Freight (12+ Master Cases):</strong> ${zoneData.ltlPercentage}% of subtotal</p>
                        </div>
                        <div class="ground-shipping">
                            <p><strong>📦 Ground Shipping (1-11 Master Cases):</strong></p>
                            <ul class="shipping-rates">
                                <li>1-3 cases: $${groundRates['1-3']} per mastercase</li>
                                <li>4-8 cases: $${groundRates['4-8']} per mastercase</li>
                                <li>9-11 cases: $${groundRates['9-11']} per mastercase</li>
                            </ul>
                        </div>
                    </div>
                    <p class="zone-states"><strong>States:</strong> ${zoneData.states ? zoneData.states.join(', ') : 'N/A'}</p>
                </div>
            </div>
        `;
    }

    /**
     * Get ground shipping rates for a specific zone
     */
    getGroundShippingRates(zoneNumber) {
        if (!this.data.shipping || !this.data.shipping.displayBoxShipping) {
            return { '1-3': 0, '4-8': 0, '9-11': 0 };
        }
        
        const ranges = this.data.shipping.displayBoxShipping.ranges;
        const zoneKey = `zone${zoneNumber}`;
        
        return {
            '1-3': ranges['1-3'][zoneKey] || 0,
            '4-8': ranges['4-8'][zoneKey] || 0,
            '9-11': ranges['9-11'][zoneKey] || 0
        };
    }

    /**
     * Update admin UI based on current admin status
     */
    updateAdminUI() {
        const adminPanel = document.getElementById('adminPanel');
        const adminContent = document.getElementById('adminContent');
        
        // Always show the admin panel, but control access to features
        if (adminPanel) {
            adminPanel.style.display = 'block';
            document.body.classList.add('admin-panel-open');
        }
        
        if (adminContent) {
            if (this.isAdmin) {
                // Show full admin controls when authenticated
                adminContent.innerHTML = `
                    <div class="admin-controls">
                        <h4 class="text-lg font-semibold text-blue-800 mb-3">Admin Panel</h4>
                        <p class="text-sm text-green-600 mb-3">✅ Admin Mode Active</p>
                        
                        <div class="admin-buttons">
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="calculator.showProductManager()">
                                📦 Manage Products
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="calculator.showTierManager()">
                                🏆 Manage Tiers
                            </button>
                            <button type="button" class="btn btn-outline-info btn-sm" onclick="calculator.showShippingManager()">
                                🚚 Manage Shipping
                            </button>
                            <button type="button" class="btn btn-outline-warning btn-sm" onclick="window.adminManager.showGitHubSettings()">
                                🔗 GitHub Settings
                            </button>
                            <button type="button" class="btn btn-outline-danger btn-sm" onclick="calculator.logoutAdmin()">
                                🚪 Logout
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Show login form when not authenticated
                adminContent.innerHTML = `
                    <div class="admin-controls">
                        <h4 class="text-lg font-semibold text-blue-800 mb-3">Admin Panel</h4>
                        <p class="text-sm text-gray-600 mb-3">Enter admin password to access management features</p>
                        
                        <div class="form-group mb-3">
                            <input type="password" id="adminPassword" class="form-control" placeholder="Admin Password" style="margin-bottom: 10px;">
                            <button type="button" class="btn btn-primary btn-sm" onclick="calculator.loginAdmin()">
                                🔑 Login
                            </button>
                        </div>
                    </div>
                `;
                
                // Add enter key support for password field
                setTimeout(() => {
                    const passwordField = document.getElementById('adminPassword');
                    if (passwordField) {
                        passwordField.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                this.loginAdmin();
                            }
                        });
                    }
                }, 100);
            }
        }
        
        console.log('✅ Admin UI updated');
    }

    /**
     * Toggle admin panel visibility
     */
    toggleAdminPanel() {
        const adminContent = document.getElementById('adminContent');
        if (adminContent) {
            const isVisible = adminContent.style.display !== 'none';
            adminContent.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Add Product button
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                this.addProductLine();
            });
        }

        // Customer state change for shipping zone detection
        const customerState = document.getElementById('customerState');
        if (customerState) {
            customerState.addEventListener('change', (e) => {
                this.updateShippingZone(e.target.value);
                this.calculateAll();
            });
        }

        // Admin toggle button
        const adminToggle = document.getElementById('adminToggle');
        if (adminToggle) {
            adminToggle.addEventListener('click', () => {
                if (this.isAdmin) {
                    // Use enhanced admin dashboard if available
                    if (window.adminManager && window.adminManager.adminDashboard) {
                        window.adminManager.showEnhancedDashboard();
                    } else {
                        this.showAdminPanel();
                    }
                } else {
                    this.showAdminLogin();
                }
            });
        }
        
        // Manual shipping override
        const manualShippingInput = document.getElementById('manualShipping');
        if (manualShippingInput) {
            manualShippingInput.addEventListener('input', () => {
                this.calculateAll();
            });
        }
        
        // Credit card fee toggle
        const creditCardFeeToggle = document.getElementById('includeCreditCardFee');
        if (creditCardFeeToggle) {
            creditCardFeeToggle.addEventListener('change', () => {
                this.calculateAll();
            });
        }
        
        // Quote generation buttons
        const generateQuoteBtn = document.getElementById('generateQuoteBtn');
        if (generateQuoteBtn) {
            generateQuoteBtn.addEventListener('click', async () => {
                const quote = this.generateQuote();
                // Non-blocking ShipStation order creation
                try {
                    if (quote && window.shipStation && window.shipStation.isConfigured) {
                        const customerData = {
                            companyName: document.getElementById('companyName')?.value || '',
                            email: document.getElementById('customerEmail')?.value || '',
                            phone: document.getElementById('customerPhone')?.value || '',
                            state: document.getElementById('customerState')?.value || '',
                            name: document.getElementById('contactName')?.value || document.getElementById('quoteName')?.value || ''
                        };
                        const resp = await window.shipStation.createOrderFromQuote(quote.quoteData || quote, customerData);
                        console.log('✅ ShipStation order created:', resp);
                        if (this.showNotification) this.showNotification('ShipStation order created successfully', 'success');
                    }
                } catch (err) {
                    console.error('❌ ShipStation order creation failed:', err);
                    if (this.showNotification) this.showNotification('ShipStation order creation failed (check credentials/logs)', 'warning');
                }
            });
        }
        
        // Copy quote button
        const copyQuoteBtn = document.getElementById('copyQuoteBtn');
        if (copyQuoteBtn) {
            copyQuoteBtn.addEventListener('click', () => this.copyQuote());
        }
        
        // Email quote button
        const emailQuoteBtn = document.getElementById('emailQuoteBtn');
        if (emailQuoteBtn) {
            emailQuoteBtn.addEventListener('click', () => this.emailQuote());
        }
        
        // Email template change
        const emailTemplateSelect = document.getElementById('emailTemplate');
        if (emailTemplateSelect) {
            emailTemplateSelect.addEventListener('change', () => {
                this.generateQuote(); // Regenerate quote with new template
            });
        }
        
        // Auto-generate quote when customer info changes
        const customerInfoFields = ['quoteName', 'companyName', 'customerEmail', 'customerState', 'customerSegment'];
        customerInfoFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                element.addEventListener('change', () => {
                    if (this.quote.products.length > 0) {
                        this.generateQuote();
                    }
                });
            }
        });
        
        console.log('✅ Event listeners bound');
    }

    /**
     * Show the app (hide loading state)
     */
    showApp() {
        const loadingElement = document.getElementById('loading');
        const appElement = document.getElementById('app');
        
        if (loadingElement) loadingElement.style.display = 'none';
        if (appElement) appElement.style.display = 'block';
        
        console.log('✅ App shown');
    }

    /**
     * Calculate all - main calculation method
     */
    /**
     * Update available payment methods based on order total
     */
    updatePaymentMethods() {
        if (!this.data.payment || !this.data.payment.paymentMethods) return;
        
        const total = this.quote.subtotal + this.quote.shipping;
        const methods = [];
        
        // Determine available payment methods based on order total
        for (const [key, method] of Object.entries(this.data.payment.paymentMethods)) {
            if ((method.availableAlways === true) || 
                (method.availableBelow && total < method.availableBelow)) {
                methods.push({
                    id: key,
                    label: method.label,
                    fee: method.fee,
                    feeDescription: method.feeDescription
                });
            }
        }
        
        this.quote.paymentMethods = methods;
        
        // Set default payment method if not set or if current method is no longer available
        if (!this.quote.paymentMethod || !methods.some(m => m.id === this.quote.paymentMethod)) {
            this.quote.paymentMethod = methods.length > 0 ? methods[0].id : null;
        }
        
        // Update payment method display
        this.updatePaymentMethodDisplay();
    }
    
    /**
     * Update the payment method display in the UI
     */
    updatePaymentMethodDisplay() {
        const container = document.getElementById('payment-methods-container');
        if (!container) return;
        
        const total = this.quote.subtotal + this.quote.shipping;
        const creditCardThreshold = this.data.payment?.creditCardThreshold || 10000;
        const isBelowThreshold = total < creditCardThreshold;
        
        let html = '';
        
        this.quote.paymentMethods.forEach(method => {
            const isSelected = this.quote.paymentMethod === method.id;
            const isDisabled = method.id === 'creditCard' && !isBelowThreshold;
            const feeText = method.fee > 0 ? 
                `<div class="payment-fee">${method.feeDescription}</div>` : '';
            const isRecommended = method.id === 'ach' && isBelowThreshold;
                
            html += `
                <div class="payment-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                     onclick="${!isDisabled ? `calculator.setPaymentMethod('${method.id}')` : ''}">
                    <input type="radio" 
                           name="paymentMethod" 
                           id="payment-${method.id}"
                           value="${method.id}" 
                           ${isSelected ? 'checked' : ''}
                           ${isDisabled ? 'disabled' : ''}
                           onchange="calculator.setPaymentMethod('${method.id}')">
                    <div class="payment-details">
                        <div class="payment-title">
                            ${method.label}
                            ${isRecommended ? '<span class="payment-badge">Recommended</span>' : ''}
                        </div>
                        ${feeText}
                    </div>
                </div>
            `;
        });
        
        if (!isBelowThreshold) {
            html += `
                <div class="payment-info-note">
                    <span>Orders over $${this.formatNumber(creditCardThreshold)} cannot be paid by credit card.</span>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    /**
     * Set the payment method and recalculate
     * @param {string} methodId - The ID of the payment method to set
     */
    setPaymentMethod(methodId) {
        // Only proceed if payment method is changing and is a valid method
        if (this.quote.paymentMethod === methodId) return;
        
        // Verify the method exists in available payment methods
        const methodExists = this.quote.paymentMethods.some(m => m.id === methodId);
        if (!methodExists) {
            console.warn(`Payment method ${methodId} is not available`);
            return;
        }
        
        // Update payment method
        this.quote.paymentMethod = methodId;
        
        // Recalculate to update fees and totals
        this.calculateAll();
        
        // Log the change to console
        const methodName = methodId === 'creditCard' ? 'Credit Card' : 
                          methodId === 'ach' ? 'ACH Transfer' : 
                          methodId === 'wire' ? 'Wire Transfer' : 'Company Check';
        console.log(`Payment method updated to: ${methodName}`);
    }
    
    calculateAll() {
        try {
            // Store current payment method before reset
            const currentPaymentMethod = this.quote?.paymentMethod || this.settings.paymentMethod;
            
            // Reset current quote but preserve payment methods if they exist
            this.quote = {
                products: [],
                lineItems: [],
                subtotal: 0,
                shipping: 0,
                creditCardFee: 0,
                total: 0,
                tierInfo: null,
                paymentMethod: currentPaymentMethod,
                paymentMethods: this.quote?.paymentMethods || []
            };
            
            // Calculate based on line items and shipping
            this.calculateLineItems();
            this.calculateShipping();
            
            // Update available payment methods based on order total
            this.updatePaymentMethods();
            
            // Calculate credit card fee if applicable
            const subtotalWithShipping = this.quote.subtotal + this.quote.shipping;
            const isCreditCard = this.quote.paymentMethod === 'creditCard';
            const isBelowThreshold = subtotalWithShipping < (this.data.payment?.creditCardThreshold || 10000);
            
            // If current method is credit card but order is above threshold, switch to default
            if (isCreditCard && !isBelowThreshold) {
                this.quote.paymentMethod = 'wire'; // Default to wire for large orders
                this.updatePaymentMethodDisplay(); // Update UI to reflect the change
            }
            
            // Calculate credit card fee if still applicable
            if (this.quote.paymentMethod === 'creditCard' && isBelowThreshold) {
                this.quote.creditCardFee = subtotalWithShipping * this.settings.creditCardFeeRate;
            } else {
                this.quote.creditCardFee = 0;
            }
            
            // Calculate total
            this.quote.total = this.quote.subtotal + this.quote.shipping + this.quote.creditCardFee;
            
            // Update UI
            this.updateCalculationDisplay();
            
            // Update order details if available
            if (window.orderDetails && this.quote.lineItems && this.quote.lineItems.length > 0) {
                window.orderDetails.renderLineItemDetails();
            }
            
            console.log('💰 Quote calculated:', this.quote);
        } catch (error) {
            console.error('❌ Calculation error:', error);
            this.showError('Error calculating quote. Please check your inputs.');
        }
    }

    /**
     * Legacy method for compatibility
     */
    calculateQuote() {
        this.calculateAll();
    }

    /**
     * Calculate line items
     */
    calculateLineItems() {
        let subtotalBeforeDiscount = 0;
        let subtotalAfterDiscount = 0;
        let totalCases = 0;
        
        // Reset products array
        this.quote.products = [];
        this.quote.lineItems = [];
        
        // Find applicable tier based on total cases
        let tier = null;
        const tiers = Object.values(this.data.tiers || {});
        
        // First pass to calculate total cases for tier determination
        this.lineItems.forEach(lineItem => {
            if (lineItem.productData && lineItem.masterCases) {
                totalCases += lineItem.masterCases;
            }
        });
        
        // If we have line items but no product data yet, skip calculation
        if (this.lineItems.length > 0 && !this.lineItems.some(item => item.productData)) {
            console.log('⏳ Skipping calculation - product data not fully loaded');
            return;
        }
        
        // Sort tiers by threshold in descending order to find the best matching tier
        const sortedTiers = [...tiers].sort((a, b) => b.threshold - a.threshold);
        
        // Find the best tier that matches our total cases
        for (const t of sortedTiers) {
            if (totalCases >= t.threshold) {
                tier = t;
                break;
            }
        }
        
        console.log('📊 Tier calculation:', {
            totalCases,
            selectedTier: tier ? tier.name : 'No tier',
            availableTiers: sortedTiers.map(t => ({
                name: t.name,
                threshold: t.threshold,
                margin: t.margin
            }))
        });
        
        // Process each line item with tier pricing
        this.lineItems.forEach(lineItem => {
            if (!lineItem.productData || !lineItem.masterCases) return;
            
            const product = lineItem.productData;
            const cases = lineItem.masterCases;
            const productId = lineItem.productId;
            const unitsPerCase = product.unitsPerCase || 1;
            const displayBoxes = lineItem.displayBoxes || cases * 12;
            
            // Get current price based on pricing mode (retail vs distribution)
            const currentPrice = this.getCurrentPrice(product);
            const baseUnitPrice = product.price || 0; // Always use distribution price as base
            
            // Apply tier pricing if available, otherwise use current price
            let unitPrice = currentPrice;
            if (tier && tier.prices && tier.prices[productId]) {
                unitPrice = tier.prices[productId];
            }
            
            console.log(`📊 Calculation for ${product.name}:`, {
                cases,
                currentPrice,
                baseUnitPrice,
                unitPrice,
                unitsPerCase,
                pricingMode: this.isRetailMode ? 'Retail' : 'Distribution'
            });
            
            const lineTotal = cases * unitPrice * unitsPerCase;
            const baseLineTotal = cases * baseUnitPrice * unitsPerCase;
            
            subtotalBeforeDiscount += baseLineTotal;
            subtotalAfterDiscount += lineTotal;
            
            // Add to products array for display
            this.quote.products.push({
                key: productId,
                name: product.name || product.title || 'Unknown Product',
                sku: product.sku || product.id || '',
                cases: cases,
                displayBoxes: displayBoxes,
                unitPrice: unitPrice,
                baseUnitPrice: baseUnitPrice, // Store base price for reference
                unitsPerCase: unitsPerCase,
                lineTotal: lineTotal,
                baseLineTotal: baseLineTotal // Store base line total for reference
            });
            
            // Also populate lineItems for order details manager
            this.quote.lineItems.push({
                id: lineItem.id,
                productId: productId,
                productName: product.name || product.title || 'Unknown Product',
                sku: product.sku || product.id || '',
                cases: cases,
                displayBoxes: displayBoxes,
                unitPrice: unitPrice,
                baseUnitPrice: baseUnitPrice,
                unitsPerCase: unitsPerCase,
                lineTotal: lineTotal,
                baseLineTotal: baseLineTotal,
                productData: product
            });
        });
        
        // Calculate total discount amount
        const totalDiscount = subtotalBeforeDiscount - subtotalAfterDiscount;
        this.quote.subtotal = subtotalAfterDiscount;
        
        // Set tier info if applicable
        if (tier && totalCases > 0) {
            const nextTier = sortedTiers.find(t => t.threshold > tier.threshold);
            const casesToNextTier = nextTier ? nextTier.threshold - totalCases : 0;
            const discountPercent = subtotalBeforeDiscount > 0 ? 
                ((subtotalBeforeDiscount - subtotalAfterDiscount) / subtotalBeforeDiscount * 100) : 0;
                
            this.quote.tierInfo = {
                tier: tier.key || tier.name || 'Unknown',
                tierName: tier.name || 'Unknown',
                threshold: tier.threshold,
                margin: tier.margin,
                discount: parseFloat(discountPercent.toFixed(2)),
                totalCases: totalCases,
                totalDiscount: totalDiscount,
                subtotalBeforeDiscount: subtotalBeforeDiscount,
                nextTier: nextTier ? {
                    name: nextTier.name,
                    threshold: nextTier.threshold,
                    casesNeeded: casesToNextTier
                } : null
            };
            
            console.log('🏷️ Applied tier info:', this.quote.tierInfo);
        } else {
            this.quote.tierInfo = null;
        }
    }

    /**
     * Calculate shipping based on display boxes, master cases, and zone
     */
    calculateShipping() {
        const manualShippingInput = document.getElementById('manualShipping');
        const manualShipping = manualShippingInput ? parseFloat(manualShippingInput.value) : 0;
        
        if (manualShipping > 0) {
            this.quote.shipping = manualShipping;
            return;
        }
        
        if (!this.currentShippingZone || this.quote.subtotal <= 0) {
            this.quote.shipping = 0;
            return;
        }
        
        // Calculate total display boxes and master cases
        const totalDisplayBoxes = this.lineItems.reduce((total, item) => {
            return total + (item.displayBoxes || 0);
        }, 0);
        
        const totalMasterCases = this.lineItems.reduce((total, item) => {
            return total + (item.masterCases || 0);
        }, 0);
        
        // Check for retail free shipping (2+ master cases)
        if (this.isRetailMode && totalMasterCases >= 2) {
            this.quote.shipping = 0;
            console.log(`🚚 Free shipping applied: Retail customer with ${totalMasterCases} master cases (2+ required)`);
            return;
        }
        
        // Get the zone data using the zone key
        const zoneData = this.data.shipping.zones[this.currentShippingZone];
        if (!zoneData || !zoneData.zoneNumber) {
            console.error(`❌ Zone data not found for: ${this.currentShippingZone}`);
            this.quote.shipping = 0;
            return;
        }
        
        const zoneNumber = zoneData.zoneNumber;
        const displayBoxShipping = this.data.shipping.displayBoxShipping;
        
        // Check if we should use LTL rates (12+ master cases)
        const ltlThreshold = this.data.shipping.ltlThreshold || 12;
        if (totalMasterCases >= ltlThreshold) {
            // Use LTL percentage for large orders
            const ltlPercentage = zoneData.ltlPercentage / 100;
            this.quote.shipping = this.quote.subtotal * ltlPercentage;
            console.log(`🚚 LTL Shipping calculated: ${this.formatCurrency(this.quote.shipping)} (${zoneData.ltlPercentage}% of ${this.formatCurrency(this.quote.subtotal)}) - ${totalMasterCases} master cases`);
            return;
        }
        
        // Use display box-based shipping for smaller orders
        if (!displayBoxShipping || !displayBoxShipping.ranges) {
            console.error('❌ Display box shipping data not found');
            this.quote.shipping = 0;
            return;
        }
        
        let shippingRate = 0;
        const zoneKey = `zone${zoneNumber}`;
        
        // Determine shipping rate based on display box quantity
        if (totalDisplayBoxes >= 1 && totalDisplayBoxes <= 3) {
            shippingRate = displayBoxShipping.ranges['1-3'][zoneKey] || 0;
        } else if (totalDisplayBoxes >= 4 && totalDisplayBoxes <= 8) {
            shippingRate = displayBoxShipping.ranges['4-8'][zoneKey] || 0;
        } else if (totalDisplayBoxes >= 9 && totalDisplayBoxes <= 11) {
            shippingRate = displayBoxShipping.ranges['9-11'][zoneKey] || 0;
        } else if (totalDisplayBoxes >= 12) {
            // Use master case rates for 12+ display boxes (1+ master cases)
            const masterCaseRate = displayBoxShipping.masterCaseRates[zoneKey] || 0;
            
            if (this.isRetailMode) {
                // Retail customers pay flat rate regardless of quantity
                shippingRate = masterCaseRate;
            } else {
                // Distribution customers pay per master case
                shippingRate = masterCaseRate * totalMasterCases;
            }
        }
        
        this.quote.shipping = shippingRate;
        
        const modeText = this.isRetailMode ? 'Retail' : 'Distribution';
        console.log(`🚚 ${modeText} shipping calculated: ${this.formatCurrency(this.quote.shipping)} (Zone ${zoneNumber}, ${totalDisplayBoxes} display boxes, ${totalMasterCases} master cases)`);
    }

    /**
     * Update calculation display in the UI
     */
    updateCalculationDisplay() {
        // Update main calculation display
        document.getElementById('subtotalAmount').textContent = this.formatCurrency(this.quote.subtotal);
        
        // Update shipping display with enhanced information
        const shippingAmountElement = document.getElementById('shippingAmount');
        if (shippingAmountElement) {
            const totalMasterCases = this.lineItems.reduce((total, item) => total + (item.masterCases || 0), 0);
            const totalDisplayBoxes = this.lineItems.reduce((total, item) => total + (item.displayBoxes || 0), 0);
            
            if (this.isRetailMode && this.quote.shipping === 0 && totalMasterCases >= 2) {
                // Show free shipping for retail customers
                const zoneData = this.data.shipping.zones[this.currentShippingZone];
                const estimatedShipping = zoneData ? 
                    (this.data.shipping.displayBoxShipping?.masterCaseRates?.[`zone${zoneData.zoneNumber}`] || 20) : 20;
                
                shippingAmountElement.innerHTML = `
                    <span style="text-decoration: line-through; color: #666; margin-right: 8px;">$${estimatedShipping.toFixed(2)}</span>
                    <span style="color: #10B981; font-weight: bold;">FREE</span>
                    <span style="font-size: 12px; color: #10B981; margin-left: 4px;">(Retail 2+ cases)</span>
                `;
            } else {
                shippingAmountElement.textContent = this.formatCurrency(this.quote.shipping);
            }
        }
        
        document.getElementById('creditCardFee').textContent = this.formatCurrency(this.quote.creditCardFee);
        document.getElementById('totalAmount').textContent = this.formatCurrency(this.quote.total);
        
        // Update tier info if available
        const tierInfoElement = document.getElementById('tierInfo');
        if (tierInfoElement && this.quote.tierInfo) {
            const tier = this.quote.tierInfo;
            const savings = this.formatCurrency(tier.totalDiscount);
            const originalSubtotal = this.formatCurrency(tier.subtotalBeforeDiscount);
            const currentMargin = tier.margin || '0%';
            
            let nextTierHtml = '';
            if (tier.nextTier) {
                // Calculate progress within current tier
                const currentTier = Object.values(this.data.tiers).find(t => t.threshold === tier.threshold);
                const nextTier = tier.nextTier;
                const tierRange = nextTier.threshold - tier.threshold;
                const progressInTier = tier.totalCases - tier.threshold;
                const progressPercent = Math.min(100, Math.max(0, (progressInTier / tierRange) * 100));
                const casesToNextTier = nextTier.threshold - tier.totalCases;
                
                nextTierHtml = `
                    <div class="tier-progress">
                        <div class="progress-labels">
                            <span class="tier-label">${tier.tierName}</span>
                            <span class="tier-label">${nextTier.name}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="tier-progress-text">
                            <span>${progressPercent.toFixed(0)}% to ${nextTier.name} (${casesToNextTier} cases to go)</span>
                        </div>
                    </div>`;
            } else {
                // Show progress within the highest tier
                const currentTier = Object.values(this.data.tiers).find(t => t.threshold === tier.threshold);
                const prevTier = Object.values(this.data.tiers)
                    .sort((a, b) => b.threshold - a.threshold)
                    .find(t => t.threshold < tier.threshold);
                
                if (prevTier) {
                    const tierRange = tier.threshold - prevTier.threshold;
                    const progressInTier = tier.totalCases - prevTier.threshold;
                    const progressPercent = Math.min(100, Math.max(0, (progressInTier / tierRange) * 100));
                    
                    nextTierHtml = `
                        <div class="tier-progress">
                            <div class="progress-labels">
                                <span class="tier-label">${prevTier.name}</span>
                                <span class="tier-label">${tier.tierName}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="tier-progress-text">
                                <span>You've reached our highest volume tier!</span>
                            </div>
                        </div>`;
                }
            }
            
            tierInfoElement.style.display = 'block';
            tierInfoElement.innerHTML = `
                <div class="tier-header">
                    <div class="tier-title">
                        <strong>Volume Discount Applied</strong>
                        <span class="tier-badge">${tier.tierName}</span>
                    </div>
                    <div class="tier-margin">Margin: ${currentMargin}</div>
                </div>
                <div class="tier-details">
                    <div class="tier-row">
                        <span>Master Cases:</span>
                        <strong>${tier.totalCases}</strong>
                    </div>
                    <div class="tier-row">
                        <span>Original Subtotal:</span>
                        <span>${originalSubtotal}</span>
                    </div>
                    <div class="tier-row highlight">
                        <span>Volume Discount (${tier.discount}%):</span>
                        <span>-${savings}</span>
                    </div>
                    ${nextTierHtml}
                </div>`;
        } else if (tierInfoElement) {
            tierInfoElement.style.display = 'none';
        }
        
        // Update credit card fee label based on order amount
        const feeRow = document.querySelector('.calc-row:nth-child(3) span:first-child');
        if (feeRow) {
            const subtotalWithShipping = this.quote.subtotal + this.quote.shipping;
            if (subtotalWithShipping >= 10000) {
                feeRow.textContent = 'Credit Card Fee (Waived - $10K+):';
            } else {
                feeRow.textContent = 'Credit Card Fee (3%):';
            }
        }
        
        // Update shipping zone info
        this.updateShippingZoneDisplay();
        
        console.log('💰 Quote calculated:', this.quote);
    }

    /**
     * Add a new product line
     */
    addProductLine() {
        const lineId = `line_${Date.now()}`;
        const newLine = {
            id: lineId,
            productId: '',
            masterCases: 0,
            displayBoxes: 0,
            productData: null
        };
        
        this.lineItems.push(newLine);
        this.renderProductLines();
        this.updateEmptyState();
        
        console.log('➕ Added product line:', lineId);
    }

    /**
     * Remove a product line
     */
    removeProductLine(lineId) {
        this.lineItems = this.lineItems.filter(item => item.id !== lineId);
        this.renderProductLines();
        this.updateEmptyState();
        this.calculateAll();
        
        console.log('➖ Removed product line:', lineId);
    }

    /**
     * Update product line
     */
    updateProductLine(lineId, field, value) {
        const lineItem = this.lineItems.find(item => item.id === lineId);
        if (!lineItem) return;

        if (field === 'productId') {
            lineItem.productId = value;
            lineItem.productData = this.data.products[value] || null;
            
            // Reset custom unit price when product changes
            delete lineItem.customUnitPrice;
            
            // Set unit price based on current pricing mode
            if (lineItem.productData) {
                lineItem.unitPrice = this.getCurrentPrice(lineItem.productData);
                console.log(`🔄 Set unit price for ${lineItem.productData.name} to $${lineItem.unitPrice.toFixed(2)} (${this.isRetailMode ? 'Retail' : 'Distribution'} mode)`);
            }
        } else if (field === 'masterCases') {
            lineItem.masterCases = parseInt(value) || 0;
            // Auto-calculate display boxes (12 per master case)
            lineItem.displayBoxes = lineItem.masterCases * 12;
            
            // When quantities change, update tier pricing for all line items
            // because total volume affects the tier
            if (!this.isRetailMode) {
                this.updateAllLineItemPricing();
                console.log('🔄 Updated tier pricing for all line items due to quantity change');
            }
        } else if (field === 'displayBoxes') {
            lineItem.displayBoxes = parseInt(value) || 0;
            // Auto-calculate master cases (12 display boxes = 1 master case)
            lineItem.masterCases = Math.floor(lineItem.displayBoxes / 12);
            
            // When quantities change, update tier pricing for all line items
            // because total volume affects the tier
            if (!this.isRetailMode) {
                this.updateAllLineItemPricing();
                console.log('🔄 Updated tier pricing for all line items due to quantity change');
            }
        } else if (field === 'customUnitPrice') {
            const newPrice = parseFloat(value) || 0;
            lineItem.customUnitPrice = newPrice;
            
            // Log the price override
            if (lineItem.productData) {
                const defaultPrice = this.getCurrentPrice(lineItem.productData);
                console.log(`💰 Custom price set for ${lineItem.productData.name}: $${newPrice.toFixed(2)} (Default: $${defaultPrice.toFixed(2)})`);
                this.showNotification(`Custom price set: $${newPrice.toFixed(2)}`, 'info');
            }
        }

        // Check for upsell opportunities
        this.checkUpsellOpportunity(lineItem);
        
        // Update order details if available
        if (this.orderDetailsManager) {
            this.orderDetailsManager.renderLineItemDetails();
        }
        
        this.renderProductLines();
        this.calculateAll();
    }

    /**
     * Check for upsell opportunities
     */
    checkUpsellOpportunity(lineItem) {
        if (!lineItem.displayBoxes || lineItem.displayBoxes < 8) return;

        const displayBoxes = lineItem.displayBoxes;
        const masterCases = Math.floor(displayBoxes / 12);
        const remainingBoxes = displayBoxes % 12;

        // Upsell if they're close to a full master case (8-11 display boxes remaining)
        if (remainingBoxes >= 8 && remainingBoxes < 12) {
            const suggestedBoxes = (masterCases + 1) * 12;
            const additionalBoxes = suggestedBoxes - displayBoxes;
            
            this.showUpsellAlert(lineItem, additionalBoxes, suggestedBoxes);
        } else {
            this.hideUpsellAlert();
        }
    }

    /**
     * Show upsell alert
     */
    showUpsellAlert(lineItem, additionalBoxes, suggestedBoxes) {
        const alertElement = document.getElementById('upsellAlert');
        const messageElement = document.getElementById('upsellMessage');
        const acceptBtn = document.getElementById('acceptUpsellBtn');

        if (!alertElement || !messageElement) return;

        const productName = lineItem.productData?.name || 'this product';
        messageElement.textContent = `Add ${additionalBoxes} more display boxes of ${productName} to complete a full master case (${suggestedBoxes} total boxes = ${Math.ceil(suggestedBoxes/12)} master cases)`;
        
        // Store upsell data for acceptance
        this.currentUpsell = {
            lineId: lineItem.id,
            suggestedBoxes: suggestedBoxes
        };

        alertElement.style.display = 'flex';
    }

    /**
     * Hide upsell alert
     */
    hideUpsellAlert() {
        const alertElement = document.getElementById('upsellAlert');
        if (alertElement) {
            alertElement.style.display = 'none';
        }
        this.currentUpsell = null;
    }

    /**
     * Accept upsell suggestion
     */
    acceptUpsell() {
        if (!this.currentUpsell) return;

        const lineItem = this.lineItems.find(item => item.id === this.currentUpsell.lineId);
        if (lineItem) {
            lineItem.displayBoxes = this.currentUpsell.suggestedBoxes;
            lineItem.masterCases = Math.floor(this.currentUpsell.suggestedBoxes / 12);
            
            this.renderProductLines();
            this.calculateAll();
            this.hideUpsellAlert();
            
            this.showNotification('✅ Upsell accepted! Order updated to full master cases.', 'success');
        }
    }

    /**
     * Reset a line item's unit price to the default based on current pricing mode
     */
    resetUnitPrice(lineId) {
        const lineItem = this.lineItems.find(item => item.id === lineId);
        if (!lineItem || !lineItem.productData) return;
        
        // Remove custom price override
        delete lineItem.customUnitPrice;
        
        // Get current price based on pricing mode
        const currentPrice = this.getCurrentPrice(lineItem.productData);
        lineItem.unitPrice = currentPrice;
        
        console.log(`🔄 Reset unit price for ${lineItem.productData.name} to $${currentPrice.toFixed(2)}`);
        this.showNotification(`Price reset to ${this.isRetailMode ? 'retail' : 'distribution'} default`, 'info');
        
        // Refresh UI
        this.renderProductLines();
        this.calculateAll();
    }

    /**
     * Render product lines
     */
    renderProductLines() {
        const container = document.getElementById('productLinesContainer');
        const emptyState = document.getElementById('emptyState');
        
        if (!container) return;

        if (this.lineItems.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        // Hide empty state when we have products
        if (emptyState) emptyState.style.display = 'none';

        container.innerHTML = this.lineItems.map(lineItem => {
            const product = lineItem.productData;
            
            // Get the default unit price based on current pricing mode
            const defaultUnitPrice = product ? this.getCurrentPrice(product) : 0;
            
            // Allow custom price override if set by user
            const currentUnitPrice = lineItem.customUnitPrice !== undefined ? lineItem.customUnitPrice : defaultUnitPrice;
            const isPriceOverridden = lineItem.customUnitPrice !== undefined;
            
            return `
            <div class="product-line" data-line-id="${lineItem.id}">
                <div class="product-line-header">
                    <span class="product-line-title">Product Line ${this.lineItems.indexOf(lineItem) + 1}</span>
                    <button type="button" class="product-line-remove" onclick="calculator.removeProductLine('${lineItem.id}')" title="Remove Product">
                        ×
                    </button>
                </div>
                
                <div class="grid grid-3" style="gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Product</label>
                        <select class="form-control" onchange="calculator.updateProductLine('${lineItem.id}', 'productId', this.value)">
                            <option value="">Select Product...</option>
                            ${Object.entries(this.data.products).map(([key, product]) => `
                                <option value="${key}" ${lineItem.productId === key ? 'selected' : ''}>
                                    ${product.name || product.title || key}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Master Cases</label>
                        <div class="quantity-input-group">
                            <input type="number" 
                                   class="form-control quantity-input" 
                                   value="${lineItem.masterCases || 0}"
                                   min="0"
                                   onchange="calculator.updateProductLine('${lineItem.id}', 'masterCases', this.value)">
                            <span class="quantity-label">cases</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Display Boxes</label>
                        <div class="quantity-input-group">
                            <input type="number" 
                                   class="form-control quantity-input" 
                                   value="${lineItem.displayBoxes || 0}"
                                   min="0"
                                   onchange="calculator.updateProductLine('${lineItem.id}', 'displayBoxes', this.value)">
                            <span class="quantity-label">boxes</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">
                            Cost Per Unit 
                            ${isPriceOverridden ? '<span class="price-override-indicator" title="Price has been overridden">⚠️</span>' : ''}
                        </label>
                        <div class="input-group">
                            <span class="input-group-text">$</span>
                            <input type="number" 
                                   class="form-control ${isPriceOverridden ? 'price-overridden' : ''}" 
                                   value="${currentUnitPrice.toFixed(2)}"
                                   step="0.01"
                                   min="0"
                                   placeholder="${defaultUnitPrice.toFixed(2)}"
                                   onchange="calculator.updateProductLine('${lineItem.id}', 'customUnitPrice', this.value)"
                                   ${!product ? 'disabled' : ''}>
                        </div>
                        ${isPriceOverridden ? `
                            <small class="text-muted">
                                Default: $${defaultUnitPrice.toFixed(2)} 
                                <button type="button" class="btn-link" onclick="calculator.resetUnitPrice('${lineItem.id}')" title="Reset to default price">
                                    Reset
                                </button>
                            </small>
                        ` : ''}
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Total Units</label>
                        <div class="form-control" style="background: #f8f9fa; font-weight: 600;">
                            ${this.calculateTotalUnits(lineItem).toLocaleString()} units
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Line Total</label>
                        <div class="form-control" style="background: #f8f9fa; font-weight: 600; color: var(--primary-color);">
                            ${this.calculateLineTotal(lineItem)}
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
        
        // Trigger calculation and order details update
        this.calculateAll();
    }

    /**
     * Calculate line total for display
     */
    calculateLineTotal(lineItem) {
        if (!lineItem.productData || !lineItem.displayBoxes) return '$0.00';

        const product = lineItem.productData;
        const displayBoxes = lineItem.displayBoxes;
        const masterCases = lineItem.masterCases || 0;
        
        // Get unit price based on pricing mode or custom override
        let unitPrice;
        
        if (lineItem.customUnitPrice !== undefined) {
            // Use custom price if set
            unitPrice = lineItem.customUnitPrice;
            console.log(`💳 Using custom price for ${product.name}: $${unitPrice.toFixed(2)}`);
        } else {
            // Use current price based on pricing mode
            unitPrice = this.getCurrentPrice(product);
            console.log(`💸 Using ${this.isRetailMode ? 'retail' : 'distribution'} price for ${product.name}: $${unitPrice.toFixed(2)}`);
        }
        
        // Calculate total units (master cases take precedence, display boxes are calculated from them)
        // Don't double-count: if we have master cases, use those; otherwise use display boxes
        let totalUnits;
        if (masterCases > 0) {
            // Use master cases calculation (each master case contains 144 units)
            totalUnits = masterCases * (product.unitsPerCase || 144);
            console.log(`📦 Using master cases calculation: ${masterCases} cases × ${product.unitsPerCase || 144} units = ${totalUnits} units`);
        } else {
            // Use display boxes calculation (each display box contains 12 units)
            totalUnits = displayBoxes * 12;
            console.log(`📦 Using display boxes calculation: ${displayBoxes} boxes × 12 units = ${totalUnits} units`);
        }
        
        // Calculate line total
        const lineTotal = totalUnits * unitPrice;
        
        return this.formatCurrency(lineTotal);
    }

    /**
     * Calculate total units for a line item (without double-counting)
     */
    calculateTotalUnits(lineItem) {
        if (!lineItem.productData) return 0;
        
        const product = lineItem.productData;
        const masterCases = lineItem.masterCases || 0;
        const displayBoxes = lineItem.displayBoxes || 0;
        
        // Don't double-count: if we have master cases, use those; otherwise use display boxes
        if (masterCases > 0) {
            return masterCases * (product.unitsPerCase || 144);
        } else {
            return displayBoxes * 12;
        }
    }

    /**
     * Update empty state visibility
     */
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const addBtn = document.getElementById('addProductBtn');
        
        if (emptyState) {
            emptyState.style.display = this.lineItems.length === 0 ? 'block' : 'none';
        }
        
        if (addBtn) {
            addBtn.style.display = this.lineItems.length === 0 ? 'none' : 'inline-block';
        }
    }

    /**
     * Populate product reference tiles with enhanced image-based design
     */
    populateProductReference() {
        const container = document.getElementById('productCatalog');
        if (!container || !this.data.products) return;

        container.innerHTML = '';
        
        // Pricing mode is now indicated by the toggle switch itself
        // No need for separate pricing mode indicator

        Object.entries(this.data.products).forEach(([key, product]) => {
            const tile = document.createElement('div');
            tile.className = 'product-tile';
            tile.dataset.productId = key;

            // Create badges
            const badges = [];
            if (product.isBestSeller) {
                badges.push('<span class="product-badge badge-bestseller">Best Seller</span>');
            }
            if (product.isNewProduct) {
                badges.push('<span class="product-badge badge-new">New</span>');
            }
            if (product.category) {
                const categoryName = product.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                badges.push(`<span class="product-badge badge-category">${categoryName}</span>`);
            }
            
            // Add pricing mode badge
            badges.push(`<span class="product-badge badge-pricing-mode ${this.isRetailMode ? 'retail' : 'distribution'}">${this.isRetailMode ? 'Retail' : 'Distribution'}</span>`);

            // Calculate pricing based on current mode
            const currentPrice = this.getCurrentPrice(product);
            const unitPrice = currentPrice.toFixed(2);
            const displayBoxPrice = (currentPrice * (product.unitsPerDisplayBox || 12)).toFixed(2);
            const masterCasePrice = (currentPrice * product.unitsPerCase).toFixed(2);

            tile.innerHTML = `
                <button class="add-to-quote-btn" title="Add to Quote">+</button>
                
                <div class="product-image-container">
                    <img src="${product.image || 'assets/logo/kanva-logo.png'}" 
                         alt="${product.name}" 
                         class="product-image"
                         onerror="this.src='assets/logo/kanva-logo.png'">
                </div>
                
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    
                    <div class="product-description">${product.description}</div>
                    
                    ${badges.length > 0 ? `<div class="product-badges">${badges.join('')}</div>` : ''}
                    
                    <div class="product-pricing">
                        <div class="price-row">
                            <span class="price-label">Unit:</span>
                            <span class="price-value price-primary">$${unitPrice}</span>
                        </div>
                        <div class="price-row">
                            <span class="price-label">Display Box (${product.unitsPerDisplayBox || 12}):</span>
                            <span class="price-value">$${displayBoxPrice}</span>
                        </div>
                        <div class="price-row">
                            <span class="price-label">Master Case (${product.unitsPerCase}):</span>
                            <span class="price-value">$${masterCasePrice}</span>
                        </div>
                    </div>
                </div>
            `;

            // Add click event listener
            tile.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectProductFromTile(key);
            });

            container.appendChild(tile);
        });
    }

    /**
     * Show a temporary green bar notification
     */
    showGreenBarNotification(message) {
        // Remove any existing notification
        const existingNotification = document.getElementById('greenBarNotification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'greenBarNotification';
        notification.textContent = message;
        
        // Style the notification
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = '#10B981'; // Green-500
        notification.style.color = 'white';
        notification.style.padding = '12px 24px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.3s ease-in-out';
        notification.style.fontWeight = '500';
        notification.style.fontSize = '14px';
        
        // Add to document
        document.body.appendChild(notification);
        
        // Auto-remove after 2 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    /**
     * Show a general notification
     */
    showNotification(message, type = 'info') {
        // Remove any existing notification
        const existingNotification = document.getElementById('generalNotification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'generalNotification';
        notification.textContent = message;
        
        // Style based on type
        const colors = {
            info: '#3B82F6',    // Blue
            success: '#10B981', // Green
            warning: '#F59E0B', // Yellow
            error: '#EF4444'    // Red
        };
        
        // Style the notification
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.style.color = 'white';
        notification.style.padding = '12px 24px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.3s ease-in-out';
        notification.style.fontWeight = '500';
        notification.style.fontSize = '14px';
        notification.style.maxWidth = '300px';
        
        // Add to document
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Select product from reference tile
     */
    selectProductFromTile(productId) {
        // Remove previous selections
        document.querySelectorAll('.product-tile').forEach(tile => {
            tile.classList.remove('selected');
        });
        
        // Mark this tile as selected
        const selectedTile = document.querySelector(`[data-product-id="${productId}"]`);
        if (selectedTile) {
            selectedTile.classList.add('selected');
            
            // Add temporary highlight class
            selectedTile.classList.add('product-added');
            setTimeout(() => {
                selectedTile.classList.remove('product-added');
            }, 1000);
        }

        // If no product lines exist, create one
        if (this.lineItems.length === 0) {
            this.addProductLine();
        }

        // Set the product for the first empty line or create a new one
        let targetLine = this.lineItems.find(item => !item.productId);
        if (!targetLine) {
            this.addProductLine();
            targetLine = this.lineItems[this.lineItems.length - 1];
        }

        // Update the line with selected product
        this.updateProductLine(targetLine.id, 'productId', productId);
        
        // Show green bar notification
        const productName = this.data.products[productId]?.name || 'Product';
        this.showGreenBarNotification(`✓ ${productName} added to quote`);
        
        // Log to console for debugging
        console.log(`✅ ${productName} added to quote`);
    }

    /**
     * Get shipping zone for a given state
     */
    getShippingZone(state) {
        if (!state || !this.data.shipping?.zones) return null;
        
        // Iterate through zones object (not array)
        for (const [zoneKey, zone] of Object.entries(this.data.shipping.zones)) {
            if (zone.states && zone.states.includes(state)) {
                return {
                    ...zone,
                    key: zoneKey
                };
            }
        }
        
        return null;
    }

    /**
     * Generate unique line item ID
     */
    generateLineItemId() {
        return 'line_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Format currency values
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    }

    /**
     * Format large numbers with commas
     */
    formatNumber(number) {
        return new Intl.NumberFormat('en-US').format(number || 0);
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('❌ Error:', message);
        // You can implement a toast notification or modal here
        alert(message);
    }

    /**
     * Generate quote for email
     */
    generateQuote() {
        if (this.quote.products.length === 0) {
            this.showError('Please add products and calculate before generating a quote.');
            return null;
        }
        
        // Get form values
        const quoteName = document.getElementById('quoteName')?.value || 'Product Quote';
        const companyName = document.getElementById('companyName')?.value || '[COMPANY NAME]';
        const customerEmail = document.getElementById('customerEmail')?.value || '';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        const customerState = document.getElementById('customerState')?.value || '';
        const customerSegment = document.getElementById('customerSegment')?.value || 'distributor';
        const emailTemplate = document.getElementById('emailTemplate')?.value || 'initial';
        
        // Get current date in a nice format
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Build email subject based on template
        let subject = '';
        switch(emailTemplate) {
            case 'followup':
                subject = `Follow-up: ${quoteName} for ${companyName}`;
                break;
            case 'negotiation':
                subject = `Revised Quote: ${quoteName} for ${companyName}`;
                break;
            case 'closing':
                subject = `Ready to Proceed: ${quoteName} for ${companyName}`;
                break;
            default: // initial
                subject = `Quote: ${quoteName} for ${companyName}`;
        }
        
        // Build email body
        let body = `KANVA BOTANICALS - QUOTE\n`;
        body += `Generated: ${formattedDate}\n`;
        body += `Quote For: ${companyName}\n`;
        if (customerEmail) body += `Email: ${customerEmail}\n`;
        if (customerPhone) body += `Phone: ${customerPhone}\n`;
        if (customerState) body += `Location: ${this.getStateName(customerState) || customerState}\n`;
        body += '\n';
        
        // Add products section
        body += `PRODUCTS\n`;
        body += `--------\n`;
        this.quote.products.forEach((product, index) => {
            body += `${index + 1}. ${product.name}\n`;
            body += `   - SKU: ${product.sku || 'N/A'}\n`;
            body += `   - Master Cases: ${product.cases}\n`;
            body += `   - Display Boxes: ${product.displayBoxes || product.cases * 12}\n`;
            body += `   - Units/Case: ${product.unitsPerCase || 1}\n`;
            body += `   - Unit Price: ${this.formatCurrency(product.unitPrice)}\n`;
            body += `   - Line Total: ${this.formatCurrency(product.lineTotal)}\n\n`;
        });
        
        // Add order summary
        body += `ORDER SUMMARY\n`;
        body += `------------\n`;
        body += `Subtotal: ${this.formatCurrency(this.quote.subtotal)}\n`;
        body += `Shipping: ${this.formatCurrency(this.quote.shipping)}\n`;
        if (this.quote.creditCardFee > 0) {
            body += `Credit Card Fee (3%): ${this.formatCurrency(this.quote.creditCardFee)}\n`;
        }
        body += `TOTAL: ${this.formatCurrency(this.quote.total)}\n\n`;
        
        // Add detailed tier discount info if applicable
        if (this.quote.tierInfo) {
            const tier = this.quote.tierInfo;
            body += `\nVOLUME DISCOUNT APPLIED\n`;
            body += `----------------------\n`;
            body += `• Tier: ${tier.tierName} (${tier.threshold}+ cases)\n`;
            body += `• Your Volume: ${tier.totalCases} master cases\n`;
            body += `• Margin: ${tier.margin || 'N/A'}\n`;
            body += `• Discount: ${tier.discount}%\n`;
            body += `• You Save: ${this.formatCurrency(tier.totalDiscount)}\n\n`;
            
            if (tier.nextTier) {
                body += `• Next Tier (${tier.nextTier.name}): Add ${tier.nextTier.casesNeeded} more cases for better pricing\n`;
                const progressPercent = Math.min(100, (tier.totalCases / tier.nextTier.threshold) * 100);
                body += `  [${'='.repeat(Math.floor(progressPercent/5))}${' '.repeat(20 - Math.floor(progressPercent/5))}] ${Math.round(progressPercent)}%\n\n`;
            } else {
                body += `• You've reached the highest volume tier!\n\n`;
            }
        }
        
        // Add next steps based on template
        body += `NEXT STEPS\n`;
        body += `----------\n`;
        
        switch(emailTemplate) {
            case 'followup':
                body += `1. Review the quote details above\n`;
                body += `2. Let us know if you have any questions\n`;
                body += `3. We're happy to schedule a call to discuss further\n\n`;
                break;
            case 'negotiation':
                body += `1. Review the revised proposal\n`;
                body += `2. Let us know if this works for your needs\n`;
                body += `3. We can adjust further if needed\n\n`;
                break;
            case 'closing':
                body += `1. Review the final details below\n`;
                body += `2. Confirm your acceptance by replying to this email\n`;
                body += `3. We'll send over the final paperwork\n\n`;
                break;
            default: // initial
                body += `1. Review the quote details above\n`;
                body += `2. Let us know if you'd like to proceed or have any questions\n`;
                body += `3. We're here to help with any additional information you need\n\n`;
        }
        
        // Add contact info
        body += `Best regards,\n`;
        body += `The Kanva Botanicals Team\n`;
        body += `contact@kanvabotanicals.com\n`;
        body += `(555) 123-4567\n\n`;
        
        // Add footer
        body += `---\n`;
        body += `Kanva Botanicals | Premium Kratom Extracts\n`;
        body += `This quote is valid for 30 days from the date of issue.`;
        
        // Update the email preview
        const emailPreview = document.getElementById('emailPreview');
        if (emailPreview) {
            emailPreview.value = body;
        }
        
        // Return the formatted quote
        return {
            subject: subject,
            body: body,
            quoteData: this.quote
        };
    }

    /**
     * Copy quote to clipboard
     */
    copyQuote() {
        const quote = this.generateQuote();
        if (quote) {
            navigator.clipboard.writeText(quote.body);
        }
    }
    
    /**
     * Email quote to customer
     */
    emailQuote() {
        const quote = this.generateQuote();
        if (!quote) return;
        
        // Get customer email or use a default
        const customerEmail = document.getElementById('customerEmail')?.value || '';
        const emailBody = encodeURIComponent(quote.body);
        const emailSubject = encodeURIComponent(quote.subject);
        
        // Create mailto link and open default email client
        window.location.href = `mailto:${customerEmail}?subject=${emailSubject}&body=${emailBody}`;
    }

    /**
     * Show product manager
     */
    showProductManager() {
        console.log('🔧 showProductManager called');
        console.log('adminManager exists:', typeof adminManager !== 'undefined');
        console.log('window.adminManager exists:', typeof window.adminManager !== 'undefined');
        
        if (window.adminManager) {
            console.log('✅ Calling adminManager.showProductManager()');
            window.adminManager.showProductManager();
        } else if (typeof adminManager !== 'undefined') {
            console.log('✅ Calling global adminManager.showProductManager()');
            adminManager.showProductManager();
        } else {
            console.error('❌ Admin manager not found');
            alert('Admin manager not initialized. Please refresh the page and try again.');
        }
    }

    /**
     * Show tier manager
     */
    showTierManager() {
        console.log('🔧 showTierManager called');
        console.log('adminManager exists:', typeof adminManager !== 'undefined');
        console.log('window.adminManager exists:', typeof window.adminManager !== 'undefined');
        
        if (window.adminManager) {
            console.log('✅ Calling adminManager.showTierManager()');
            window.adminManager.showTierManager();
        } else if (typeof adminManager !== 'undefined') {
            console.log('✅ Calling global adminManager.showTierManager()');
            adminManager.showTierManager();
        } else {
            console.error('❌ Admin manager not found');
            alert('Admin manager not initialized. Please refresh the page and try again.');
        }
    }

    /**
     * Show shipping manager
     */
    showShippingManager() {
        console.log('🔧 showShippingManager called');
        console.log('adminManager exists:', typeof adminManager !== 'undefined');
        console.log('window.adminManager exists:', typeof window.adminManager !== 'undefined');
        
        if (window.adminManager) {
            console.log('✅ Calling adminManager.showShippingManager()');
            window.adminManager.showShippingManager();
        } else if (typeof adminManager !== 'undefined') {
            console.log('✅ Calling global adminManager.showShippingManager()');
            adminManager.showShippingManager();
        } else {
            console.error('❌ Admin manager not found');
            alert('Admin manager not initialized. Please refresh the page and try again.');
        }
    }

    /**
     * Export configuration
     */
    exportConfig() {
        if (adminManager) {
            adminManager.downloadJSON('config', {
                products: this.data.products,
                tiers: this.data.tiers,
                shipping: this.data.shipping,
                timestamp: new Date().toISOString()
            });
        } else {
            // Fallback to original method
            const config = {
                products: this.data.products,
                tiers: this.data.tiers,
                shipping: this.data.shipping,
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kanva-config-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Email quote
     */
    emailQuote() {
        const quote = this.generateQuote();
        if (quote) {
            const subject = encodeURIComponent('Kanva Botanicals Quote');
            const body = encodeURIComponent(quote);
            window.open(`mailto:?subject=${subject}&body=${body}`);
        }
    }

    /**
     * Login as admin
     */
    loginAdmin() {
        const passwordField = document.getElementById('adminPassword');
        if (passwordField) {
            const password = passwordField.value.trim();
            if (password === this.adminPassword) {
                this.isAdmin = true;
                this.updateAdminUI();
            } else {
                this.showError('Invalid admin password. Please try again.');
            }
        }
    }

    /**
     * Logout as admin
     */
    logoutAdmin() {
        this.isAdmin = false;
        this.updateAdminUI();
    }

    /**
     * Delete a line item from the quote
     */
    deleteLineItem(lineId) {
        // Find and remove from lineItems array
        const lineIndex = this.lineItems.findIndex(item => item.id === lineId);
        if (lineIndex !== -1) {
            this.lineItems.splice(lineIndex, 1);
        }

        // Re-render everything
        this.renderProductLines();
        this.calculateAll();
        this.updateEmptyState();
        
        // Update order details if available
        if (window.orderDetails && this.quote.lineItems && this.quote.lineItems.length > 0) {
            window.orderDetails.renderLineItemDetails();
        }

        this.showNotification('Line item deleted successfully', 'success');
    }

    /**
     * Show notification
     */
    showNotification(message, type) {
        console.log(`📣 ${type}: ${message}`);
        // You can implement a toast notification or modal here
        alert(message);
    }

    /**
     * Reset unit price to default
     */
    resetUnitPrice(lineId) {
        const lineItem = this.lineItems.find(item => item.id === lineId);
        if (lineItem) {
            delete lineItem.customUnitPrice;
            this.renderProductLines();
            this.calculateAll();
        }
    }

    /**
     * Get shipping zone for a given state
     */
    getShippingZone(state) {
        if (!state || !this.data.shipping?.zones) return null;
        
        // Iterate through zones to find matching state
        for (const [zoneKey, zone] of Object.entries(this.data.shipping.zones)) {
            if (zone.states && zone.states.includes(state.toUpperCase())) {
                return {
                    ...zone,
                    key: zoneKey
                };
            }
        }
        
        return null;
    }

    /**
     * Update shipping zone based on customer state
     */
    updateShippingZone(state) {
        if (!state) {
            this.currentShippingZone = null;
            return;
        }

        // Find the shipping zone for this state
        const zones = this.data.shipping.zones;
        for (const [zoneKey, zone] of Object.entries(zones)) {
            if (zone.states && zone.states.includes(state.toUpperCase())) {
                this.currentShippingZone = zoneKey;
                console.log(`🚚 Shipping zone updated to: ${zoneKey} for state: ${state}`);
                return;
            }
        }

        // If no zone found, default to null
        this.currentShippingZone = null;
        console.log(`⚠️ No shipping zone found for state: ${state}`);
    }
}

// Global instance
let calculator;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Starting Kanva Calculator...');
    
    calculator = new KanvaCalculator();
    await calculator.init();
    
    // Make calculator globally available for HTML onclick handlers
    window.calculator = calculator;
    window.kanvaCalculator = calculator; // Also make available as kanvaCalculator for consistency
    
    // Ensure pricing toggle event listener is properly bound after initialization
    const pricingToggle = document.getElementById('pricingModeToggle');
    if (pricingToggle && calculator) {
        console.log('🔄 Re-binding pricing toggle event listener after initialization');
        
        // Remove any existing listeners
        pricingToggle.removeEventListener('change', calculator.pricingToggleHandler);
        
        // Create new handler
        calculator.pricingToggleHandler = (e) => {
            console.log('🔄 Pricing toggle event triggered');
            calculator.isRetailMode = e.target.checked;
            console.log(`💰 Pricing mode changed to: ${calculator.isRetailMode ? 'Retail' : 'Distribution'}`);
            
            // Show notification to user
            calculator.showNotification(`Pricing mode changed to ${calculator.isRetailMode ? 'Retail' : 'Distribution'}`, 'info');
            
            // Update product catalog with new pricing
            console.log('🔄 Calling populateProductReference...');
            calculator.populateProductReference();
            
            // Update any existing line items with new pricing
            console.log('🔄 Calling updateAllLineItemPricing...');
            calculator.updateAllLineItemPricing();
            
            // Force refresh the order details
            if (calculator.orderDetailsManager) {
                console.log('🔄 Calling renderLineItemDetails...');
                calculator.orderDetailsManager.renderLineItemDetails();
            }
            
            // Recalculate totals
            console.log('🔄 Calling calculateAll...');
            calculator.calculateAll();
            
            console.log('✅ Pricing toggle event completed');
        };
        
        // Add the event listener
        pricingToggle.addEventListener('change', calculator.pricingToggleHandler);
        console.log('✅ Pricing toggle event listener re-bound after initialization');
    }
});

console.log('✅ Consolidated Kanva Calculator module loaded successfully');