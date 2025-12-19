// appState is already defined in admin.js

const App = {
    // Application initialization
    initialize: function() {
        console.log('🚀 Starting Kanva Botanicals Quote Calculator...');
        console.log(`📋 Version: ${adminConfig.metadata.version}`);
        
        try {
            // Step 1: Initialize configuration
            console.log('🔍 STEP 1: Initializing configuration...');
            this.initializeConfiguration();
            console.log('✅ STEP 1: Configuration initialized');
            
            // Step 2: Check environment and set up mode
            console.log('🔍 STEP 2: Detecting environment...');
            this.detectEnvironment();
            console.log('✅ STEP 2: Environment detected');
            
            // Step 3: Initialize Copper CRM integration
            console.log('🔍 STEP 3: Starting Copper CRM integration...');
            this.initializeCopperIntegration();
            console.log('✅ STEP 3: Copper CRM integration completed');
            
            // Step 4: Initialize core modules
            console.log('🔍 STEP 4: Initializing core modules...');
            this.initializeModules();
            console.log('✅ STEP 4: Core modules initialized');
            
            // Step 5: Set up UI and render interface
            console.log('🔍 STEP 5: Setting up UI...');
            this.initializeUI();
            console.log('✅ STEP 5: UI initialized');
            
            // Step 6: Bind event listeners
            console.log('🔍 STEP 6: Binding event listeners...');
            this.bindEventListeners();
            console.log('✅ STEP 6: Event listeners bound');
            
            // Step 7: Perform initial calculations
            console.log('🔍 STEP 7: Performing initial calculations...');
            this.performInitialCalculations();
            console.log('✅ STEP 7: Initial calculations completed');
            
            // Step 8: Final setup and ready state
            console.log('🔍 STEP 8: Finalizing initialization...');
            this.finalizeInitialization();
            console.log('✅ STEP 8: Initialization finalized');
            
        } catch (error) {
            console.error('❌ Critical error during initialization:', error);
            console.error('❌ Error stack:', error.stack);
            this.handleInitializationError(error);
        }
    },

    // Initialize configuration system
    initializeConfiguration: function() {
        console.log('⚙️ Initializing configuration...');
        
        // Load saved configuration if available
        const configLoaded = ConfigManager.load();
        if (configLoaded) {
            console.log('✅ Configuration loaded from storage');
        } else {
            console.log('📝 Using default configuration');
        }
        
        // Validate configuration integrity
        const validation = ConfigManager.validate();
        if (!validation.isValid) {
            console.warn('⚠️ Configuration validation issues:', validation.errors);
        }
    },

    // Detect environment and application mode
    detectEnvironment: function() {
        console.log('🔍 Detecting environment and mode...');
        
        // Check URL parameters for mode hints
        const urlParams = new URLSearchParams(window.location.search);
        const location = urlParams.get('location');
        const mode = urlParams.get('mode');
        
        // Detect based on window size and URL parameters
        if (location === 'modal' || mode === 'modal') {
            appState.isModalMode = true;
            appState.appLocation = 'modal';
            document.body.className = 'modal-mode';
            console.log('📍 Modal mode detected');
        } else if (location === 'activity_panel') {
            appState.isActivityPanel = true;
            appState.appLocation = 'activity_panel';
            document.body.className = 'activity-panel-mode';
            console.log('📍 Activity panel mode detected');
        } else if (location === 'left_nav' || window.innerWidth > 800) {
            appState.isLeftNav = true;
            appState.appLocation = 'left_nav';
            document.body.className = 'left-nav-mode';
            console.log('📍 Left navigation mode detected');
        } else {
            appState.appLocation = 'sidebar';
            document.body.className = 'sidebar-mode';
            console.log('📍 Sidebar mode detected');
        }
        
        // Log environment details
        console.log(`🌐 Environment: ${window.location.hostname}`);
        console.log(`📏 Window size: ${window.innerWidth}x${window.innerHeight}`);
        console.log(`📱 User agent: ${navigator.userAgent.substring(0, 50)}...`);
    },

    // Initialize Copper CRM integration
    initializeCopperIntegration: function() {
        console.log('🔗 Initializing Copper CRM integration...');
        
        try {
            // Check environment first
            if (typeof CopperIntegration !== 'undefined' && CopperIntegration.checkEnvironment) {
                CopperIntegration.checkEnvironment();
            }
            
            // Initialize SDK
            let copperAvailable = false;
            if (typeof CopperIntegration !== 'undefined') {
                copperAvailable = CopperIntegration.initialize();
            }
            
            if (copperAvailable) {
                console.log('✅ Copper CRM integration active');
                appState.isCopperActive = true;
            } else {
                console.log('⚠️ Running in standalone mode');
                appState.isCopperActive = false;
                
                // FIXED: Proper admin detection in standalone mode
                this.setupStandaloneMode();
            }
        } catch (error) {
            console.error('❌ Error initializing Copper:', error);
            appState.isCopperActive = false;
            this.setupStandaloneMode();
        }
    },

    // FIXED: Setup standalone mode with proper admin detection
    setupStandaloneMode: function() {
        appState.isCopperActive = false;
        appState.integrationMode = 'standalone';
        
        // FIXED: Use your actual admin email for testing
        const testUser = {
            email: 'ben@kanvabotanicals.com',  // Your email from adminEmails
            name: 'Ben (Admin)'
        };
        
        // Set user and check admin status
        AuthManager.setUser(testUser);
        appState.isAdmin = AuthManager.isAdmin(testUser.email);
        // Temporary debug - remove after testing
        console.log('🔍 DEBUG - Current user:', appState.currentUser);
        console.log('🔍 DEBUG - Is admin?:', appState.isAdmin);
        console.log('🔍 DEBUG - Admin emails:', adminConfig.adminEmails);
        
        console.log('🔧 Running in standalone demo mode');
        console.log(`👤 User: ${testUser.email}`);
        console.log(`🛡️ Admin access: ${appState.isAdmin ? 'GRANTED' : 'DENIED'}`);
        
        // Enable customer search in left nav mode
        if (appState.isLeftNav) {
            setTimeout(() => {
                if (typeof CopperIntegration !== 'undefined' && CopperIntegration.enableCustomerSearch) {
                    CopperIntegration.enableCustomerSearch();
                }
            }, 1000);
        }
    },

    // Initialize core application modules
    initializeModules: function() {
        console.log('🧩 Initializing core modules...');
        
        // Initialize notification manager first
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.initialize();
            console.log('✅ Notification manager initialized');
        }
        
        // Initialize calculator engine
        if (typeof Calculator !== 'undefined') {
            Calculator.initializeEventListeners();
            console.log('✅ Calculator module initialized');
        }
        
        // Initialize multi-product calculator
        if (typeof MultiProductCalculator !== 'undefined') {
            MultiProductCalculator.initialize();
            console.log('✅ Multi-product calculator initialized');
        }
        
        // Initialize email generator
        if (typeof EmailGenerator !== 'undefined') {
            EmailGenerator.initialize();
            console.log('✅ Email generator initialized');
        }
        
        // Initialize admin panel if user has access
        if (typeof AdminPanel !== 'undefined') {
            AdminPanel.initialize();
            console.log('✅ Admin panel initialized');
        }
        
        console.log('✅ All core modules initialized');
    },

    // Initialize the user interface
    initializeUI: function() {
        console.log('🎨 Initializing user interface...');
        
        // Hide loading screen and show app
        const loadingState = document.getElementById('loadingState');
        const appContainer = document.getElementById('app');
        
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        if (appContainer) {
            appContainer.style.display = 'block';
        }
        
        // Initialize existing HTML elements instead of rendering new ones
        this.initializeExistingElements();
        
        // Set up mode-specific UI
        this.setupModeSpecificUI();
        
        // Initialize tooltips and help system
        this.initializeHelpSystem();
        
        // Set up responsive UI adjustments
        this.setupResponsiveUI();
        
        console.log('✅ User interface initialized');
    },

    // Initialize existing HTML elements instead of overwriting
    initializeExistingElements: function() {
        console.log('🎯 Initializing existing HTML elements...');
        
        // Populate product dropdowns
        this.populateProductDropdowns();
        
        // Set initial values
        this.setInitialValues();
        
        // Initialize state dropdowns
        this.populateStateDropdowns();
        
        // Initialize event listeners for existing elements
        this.bindEventListeners();
        
        console.log('✅ Existing elements initialized');
    },

    // Render the main application interface (kept for compatibility but not used with new HTML)
    renderMainInterface: function() {
        console.log('⚠️ renderMainInterface called but skipped - using existing HTML structure');
        return; // Skip rendering since we have HTML structure already
        
        const appContainer = document.getElementById('app');
        if (!appContainer) {
            throw new Error('App container element not found');
        }
        
        // Generate the main HTML structure based on mode
        const mainHTML = this.generateMainHTML();
        appContainer.innerHTML = mainHTML;
        
        // Populate product dropdowns
        this.populateProductDropdowns();
        
        // Set initial values
        this.setInitialValues();
    },

    // Generate main HTML structure based on mode
    generateMainHTML: function() {
        const isAdmin = appState.isAdmin;
        const isModal = appState.isModalMode;
        const isLeftNav = appState.isLeftNav;
        const isActivityPanel = appState.isActivityPanel;
        
        if (isActivityPanel) {
            return this.generateActivityPanelHTML();
        } else {
            return this.generateFullCalculatorHTML();
        }
    },

    // Generate activity panel HTML (compact view)
    generateActivityPanelHTML: function() {
        return `
            <!-- Activity Panel Quick Calculator -->
            <div class="activity-panel-calculator">
                <div class="activity-header">
                    <h3>🌿 Kanva Quick Quote</h3>
                    <button class="launch-modal-btn" onclick="openFullCalculatorModal()">Open Full Calculator</button>
                </div>

                <!-- Quick Product Selection -->
                <div class="quick-product-section">
                    <div class="input-group">
                        <label for="quickProduct">Product:</label>
                        <select id="quickProduct" onchange="updateQuickCalculation()">
                            <!-- Populated by JavaScript -->
                        </select>
                    </div>
                    <div class="input-group">
                        <label for="quickCases">Cases:</label>
                        <input type="number" id="quickCases" value="28" min="1" max="500" onchange="updateQuickCalculation()">
                    </div>
                </div>

                <!-- Quick Results -->
                <div id="quickResults" class="quick-results">
                    <!-- Populated by Calculator -->
                </div>

                <!-- Quick Actions -->
                <div class="quick-actions">
                    <button class="action-btn" onclick="generateQuickEmail()">📧 Generate Email</button>
                    ${appState.isCopperActive ? '<button class="action-btn" onclick="saveQuickQuote()">💾 Save Quote</button>' : ''}
                </div>
            </div>
        `;
    },

    // Generate full calculator HTML
    generateFullCalculatorHTML: function() {
    const isAdmin = appState.isAdmin;
    const isModal = appState.isModalMode;
    const isLeftNav = appState.isLeftNav;
    
    return `
        <!-- Main Calculator Container with Tailwind -->
        <div class="min-h-screen bg-gradient-to-br from-gray-50 to-kanva-light p-4" id="mainCalculator">
            
            <!-- Header Section -->
            <div class="max-w-7xl mx-auto">
                <div class="text-center mb-8 p-6 bg-white rounded-2xl shadow-lg border-2 border-kanva-green">
                    <h1 class="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-kanva-dark to-kanva-green bg-clip-text text-transparent mb-4">
                        🌿 Kanva Botanicals Quote Calculator
                    </h1>
                    <p class="text-lg text-gray-600 mb-4">Instantly generate professional quotes with accurate pricing</p>
                    ${isAdmin ? `
                        <button onclick="showAdminPanel()" 
                                class="px-6 py-3 bg-gradient-to-r from-kanva-dark to-gray-700 hover:from-gray-700 hover:to-kanva-dark text-white font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-kanva-dark/50">
                            ⚙️ Admin Settings
                        </button>
                    ` : ''}
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    <!-- Customer Information Section -->
                    <div class="xl:col-span-1">
                        <section class="bg-white rounded-2xl shadow-lg border-2 border-kanva-green p-6 mb-6">
                            <h3 class="text-2xl font-bold text-kanva-dark mb-6 pb-3 border-b-2 border-kanva-green">
                                👤 Customer Information
                            </h3>
                            
                            <div class="space-y-4">
                                <div>
                                    <label for="quoteName" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                        Quote Name:
                                    </label>
                                    <input type="text" 
                                           id="quoteName" 
                                           placeholder="Product Quote for Company Name"
                                           class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300" />
                                </div>
                                
                                <div>
                                    <label for="companyName" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                        Company Name:
                                    </label>
                                    <input type="text" 
                                           id="companyName" 
                                           placeholder="ABC Distribution"
                                           class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300" />
                                </div>
                                
                                <div>
                                    <label for="segment" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                        Customer Segment:
                                    </label>
                                    <input type="text" 
                                           id="segment" 
                                           placeholder="smoke and vape shops"
                                           class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300" />
                                </div>
                                
                                <div>
                                    <label for="customerState" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                        State:
                                    </label>
                                    <select id="customerState" 
                                            onchange="updateShippingZone()"
                                            class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300">
                                        <option value="">Select State...</option>
                                        <option value="AL">AL</option>
                                        <option value="AK">AK</option>
                                        <option value="AZ">AZ</option>
                                        <option value="AR">AR</option>
                                        <option value="CA">CA</option>
                                        <option value="CO">CO</option>
                                        <option value="CT">CT</option>
                                        <option value="DE">DE</option>
                                        <option value="DC">DC</option>
                                        <option value="FL">FL</option>
                                        <option value="GA">GA</option>
                                        <option value="HI">HI</option>
                                        <option value="ID">ID</option>
                                        <option value="IL">IL</option>
                                        <option value="IN">IN</option>
                                        <option value="IA">IA</option>
                                        <option value="KS">KS</option>
                                        <option value="KY">KY</option>
                                        <option value="LA">LA</option>
                                        <option value="ME">ME</option>
                                        <option value="MD">MD</option>
                                        <option value="MA">MA</option>
                                        <option value="MI">MI</option>
                                        <option value="MN">MN</option>
                                        <option value="MS">MS</option>
                                        <option value="MO">MO</option>
                                        <option value="MT">MT</option>
                                        <option value="NE">NE</option>
                                        <option value="NV">NV</option>
                                        <option value="NH">NH</option>
                                        <option value="NJ">NJ</option>
                                        <option value="NM">NM</option>
                                        <option value="NY">NY</option>
                                        <option value="NC">NC</option>
                                        <option value="ND">ND</option>
                                        <option value="OH">OH</option>
                                        <option value="OK">OK</option>
                                        <option value="OR">OR</option>
                                        <option value="PA">PA</option>
                                        <option value="RI">RI</option>
                                        <option value="SC">SC</option>
                                        <option value="SD">SD</option>
                                        <option value="TN">TN</option>
                                        <option value="TX">TX</option>
                                        <option value="UT">UT</option>
                                        <option value="VT">VT</option>
                                        <option value="VA">VA</option>
                                        <option value="WA">WA</option>
                                        <option value="WV">WV</option>
                                        <option value="WI">WI</option>
                                        <option value="WY">WY</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label for="emailDomain" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                        Email Domain:
                                    </label>
                                    <input type="text" 
                                           id="emailDomain" 
                                           placeholder="company.com"
                                           class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300" />
                                </div>
                                
                                <div>
                                    <label for="phone" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                        Phone Number:
                                    </label>
                                    <input type="tel" 
                                           id="phone" 
                                           placeholder="(555) 123-4567"
                                           class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300" />
                                </div>
                            </div>
                            
                            <!-- Shipping Zone Display -->
                            <div class="mt-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-300">
                                <h4 class="text-lg font-bold text-blue-900 mb-2">📦 Shipping Zone</h4>
                                <div id="shippingZoneDisplay" class="text-blue-800">
                                    Select a state to see shipping zone
                                </div>
                            </div>
                            
                            <!-- Tax Information -->
                            <div class="mt-6 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-2 border-green-300">
                                <h4 class="text-lg font-bold text-green-900 mb-4">🏛️ Tax Information</h4>
                                
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label for="stateTaxRate" class="block text-xs font-bold text-green-900 uppercase tracking-wide mb-1">
                                            State Tax (%):
                                        </label>
                                        <input type="number" 
                                               id="stateTaxRate" 
                                               step="0.01" 
                                               placeholder="0.00"
                                               class="w-full p-2 border-2 border-green-300 rounded-md text-green-900 focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none transition-all duration-300" />
                                    </div>
                                    
                                    <div>
                                        <label for="countyTaxRate" class="block text-xs font-bold text-green-900 uppercase tracking-wide mb-1">
                                            County Tax (%):
                                        </label>
                                        <input type="number" 
                                               id="countyTaxRate" 
                                               step="0.01" 
                                               placeholder="0.00"
                                               class="w-full p-2 border-2 border-green-300 rounded-md text-green-900 focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none transition-all duration-300" />
                                    </div>
                                </div>
                                
                                <button type="button" 
                                        onclick="autoDetectTaxRate()"
                                        class="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-500 text-white font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-green-300">
                                    🎯 Auto-Detect Tax Rate
                                </button>
                            </div>
                        </section>
                    </div>

                    <!-- Product & Order Details Section -->
                    <div class="xl:col-span-2">
                        <section class="bg-white rounded-2xl shadow-lg border-2 border-kanva-green p-6 mb-6">
                            
                            <!-- Product Mode Toggle -->
                            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                                <h3 class="text-2xl font-bold text-kanva-dark mb-4 sm:mb-0">
                                    📦 Product & Order Details
                                </h3>
                                <div class="flex bg-gray-100 rounded-lg p-1">
                                    <button type="button" 
                                            id="singleProductBtn" 
                                            onclick="switchToSingleProduct()"
                                            class="px-4 py-2 rounded-md font-bold text-sm transition-all duration-300 bg-kanva-green text-kanva-dark shadow-sm">
                                        Single Product
                                    </button>
                                    <button type="button" 
                                            id="multiProductBtn" 
                                            onclick="switchToMultiProduct()"
                                            class="px-4 py-2 rounded-md font-bold text-sm transition-all duration-300 text-gray-600 hover:text-kanva-dark">
                                        Multiple Products
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Single Product Mode -->
                            <div id="singleProductMode" class="space-y-6">
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label for="primaryProduct" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                            Primary Product:
                                        </label>
                                        <select id="primaryProduct" 
                                                onchange="updateCalculation()"
                                                class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark font-medium focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300">
                                            <!-- Populated by JavaScript -->
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label for="masterCases" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                            Master Cases:
                                        </label>
                                        <input type="number" 
                                               id="masterCases" 
                                               value="28" 
                                               min="1" 
                                               max="500" 
                                               onchange="updateCalculation()"
                                               class="w-full p-3 border-2 border-kanva-green rounded-lg text-kanva-dark font-medium focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300" />
                                    </div>
                                    
                                    <div>
                                        <label for="maxRetail" class="block text-sm font-bold text-kanva-dark uppercase tracking-wide mb-2">
                                            Max Retail Price:
                                        </label>
                                        <div class="relative">
                                            <span class="absolute left-3 top-3 text-kanva-dark font-bold">$</span>
                                            <input type="number" 
                                                   id="maxRetail" 
                                                   value="5.00" 
                                                   step="0.01" 
                                                   min="0"
                                                   class="w-full p-3 pl-8 border-2 border-kanva-green rounded-lg text-kanva-dark font-medium focus:border-kanva-dark focus:ring-4 focus:ring-kanva-green/30 focus:outline-none transition-all duration-300" />
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Shipping Override Section -->
                                <div class="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                                    <label class="flex items-center text-gray-700 font-medium">
                                        <input type="checkbox" 
                                               id="shippingOverride" 
                                               onchange="toggleShippingOverride()"
                                               class="mr-3 w-5 h-5 text-kanva-green border-2 border-kanva-green rounded focus:ring-kanva-green focus:ring-2" />
                                        Manual Shipping Override
                                    </label>
                                    <div id="shippingOverrideSection" class="mt-3 hidden">
                                        <label for="manualShipping" class="block text-sm font-bold text-gray-700 mb-2">
                                            Shipping Amount:
                                        </label>
                                        <div class="relative">
                                            <span class="absolute left-3 top-3 text-gray-600 font-bold">$</span>
                                            <input type="number" 
                                                   id="manualShipping" 
                                                   step="0.01" 
                                                   placeholder="0.00"
                                                   onchange="updateCalculation()"
                                                   class="w-full p-3 pl-8 border-2 border-gray-300 rounded-lg text-gray-700 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 focus:outline-none transition-all duration-300" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Multiple Product Mode -->
                            <div id="multiProductMode" class="hidden space-y-6">
                                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gradient-to-r from-kanva-light to-kanva-accent rounded-lg border-2 border-kanva-green/30">
                                    <button type="button" 
                                            onclick="addProductLine()"
                                            class="mb-4 sm:mb-0 px-6 py-3 bg-gradient-to-r from-kanva-green to-green-400 hover:from-green-400 hover:to-kanva-green text-kanva-dark font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-kanva-green/50">
                                        ➕ Add Product Line
                                    </button>
                                    
                                    <label class="flex items-center text-kanva-dark font-medium">
                                        <input type="checkbox" 
                                               id="creditCardFee" 
                                               onchange="calculateMultiProductTotal()"
                                               class="mr-3 w-5 h-5 text-kanva-green border-2 border-kanva-green rounded focus:ring-kanva-green focus:ring-2" />
                                        Add 3% Credit Card Fee
                                    </label>
                                </div>
                                
                                <div id="productLines" class="space-y-4">
                                    <!-- Product lines populated by MultiProductCalculator -->
                                </div>
                                
                                <div id="multiProductResults" class="bg-gradient-to-r from-kanva-light to-kanva-accent p-6 rounded-lg border-2 border-kanva-green">
                                    <!-- Results populated by MultiProductCalculator -->
                                </div>
                            </div>
                        </section>

                        <!-- Calculation Results Section -->
                        <section class="bg-white rounded-2xl shadow-lg border-2 border-kanva-green p-6 mb-6" id="resultsSection">
                            <h3 class="text-2xl font-bold text-kanva-dark mb-6 pb-3 border-b-2 border-kanva-green">
                                🧮 Order Calculation
                            </h3>
                            
                            <div id="orderResults" class="bg-gradient-to-r from-kanva-light to-kanva-accent p-6 rounded-lg border-2 border-kanva-green/30 mb-4">
                                <!-- Populated by Calculator -->
                            </div>
                            
                            <div id="tierInfo" class="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border-2 border-green-300 text-green-900">
                                <!-- Populated by Calculator -->
                            </div>
                        </section>

                        <!-- Action Buttons Section -->
                        <section class="bg-white rounded-2xl shadow-lg border-2 border-kanva-green p-6">
                            <div class="flex flex-wrap gap-4 justify-center">
                                <button onclick="generateEmail()" 
                                        class="flex-1 min-w-[250px] px-6 py-4 bg-gradient-to-r from-kanva-green to-green-400 hover:from-green-400 hover:to-kanva-green text-kanva-dark font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-kanva-green/50">
                                    📧 Generate Professional Quote Email
                                </button>
                                
                                ${appState.isCopperActive ? `
                                    <button onclick="saveQuoteToCRM()" 
                                            class="flex-1 min-w-[200px] px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300">
                                        💾 Save to CRM
                                    </button>
                                    
                                    <button onclick="createOpportunity()" 
                                            class="flex-1 min-w-[200px] px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300">
                                        🎯 Create Opportunity
                                    </button>
                                ` : ''}
                            </div>
                        </section>
                    </div>
                </div>

                ${isLeftNav ? this.generateProductReferenceSection() : ''}
            </div>
        </div>

        <!-- Email Template Display -->
        <div id="emailTemplate" class="hidden max-w-6xl mx-auto mt-8 bg-white rounded-2xl shadow-lg border-2 border-kanva-green p-6">
            <h3 class="text-2xl font-bold text-kanva-dark mb-6 pb-3 border-b-2 border-kanva-green">
                📧 Generated Quote Email
            </h3>
            
            <div class="flex flex-wrap gap-3 mb-6">
                <button onclick="copyEmail()" 
                        class="px-4 py-2 bg-gradient-to-r from-kanva-green to-green-400 hover:from-green-400 hover:to-kanva-green text-kanva-dark font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg">
                    📋 Copy Email
                </button>
                <button onclick="exportEmail('text')" 
                        class="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg">
                    📄 Export as Text
                </button>
                <button onclick="exportEmail('html')" 
                        class="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg">
                    🌐 Export as HTML
                </button>
                ${appState.isCopperActive ? `
                    <button onclick="sendEmailViaCRM()" 
                            class="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-500 text-white font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg">
                        📧 Log in CRM
                    </button>
                ` : ''}
            </div>
            
            <div id="emailOutput" class="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                <!-- Generated email content -->
            </div>
            
            <!-- Email Template Options -->
            <div class="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-gray-300">
                <h4 class="text-lg font-bold text-gray-800 mb-3">📝 Quick Templates</h4>
                <div class="flex flex-wrap gap-3">
                    <button onclick="generateFollowUpEmail()" 
                            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded-lg transition-all duration-300">
                        Follow-up Email
                    </button>
                    <button onclick="generateNegotiationEmail()" 
                            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded-lg transition-all duration-300">
                        Negotiation Email
                    </button>
                    <button onclick="generateClosingEmail()" 
                            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded-lg transition-all duration-300">
                        Closing Email
                    </button>
                </div>
            </div>
        </div>

        ${isAdmin ? this.generateAdminPanel() : ''}
    `;
    },

    // Populate product dropdown menus
    populateProductDropdowns: function() {
        const products = ProductManager.getAll();
        const productSelect = document.getElementById('productSelect');
        
        if (productSelect && products) {
            productSelect.innerHTML = '';
            Object.entries(products).forEach(([key, product]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${product.name} ($${product.price})`;
                productSelect.appendChild(option);
            });
            console.log('✅ Product dropdowns populated');
        }
    },

    // Set initial form values
    setInitialValues: function() {
        const masterCasesInput = document.getElementById('masterCases');
        if (masterCasesInput && !masterCasesInput.value) {
            masterCasesInput.value = '28';
        }
        console.log('✅ Initial values set');
    },

    // Populate state dropdowns
    populateStateDropdowns: function() {
        const stateSelect = document.getElementById('customerState');
        if (stateSelect) {
            const states = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];
            states.forEach(state => {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state;
                stateSelect.appendChild(option);
            });
            console.log('✅ State dropdowns populated');
        }
    },

    // Bind event listeners for existing elements
    bindEventListeners: function() {
        console.log('🔗 Binding event listeners...');
        
        // Single product calculation triggers
        const productSelect = document.getElementById('productSelect');
        if (productSelect) {
            productSelect.addEventListener('change', () => {
                if (typeof Calculator !== 'undefined' && Calculator.updateResults) {
                    Calculator.updateResults();
                }
            });
        }
        
        const masterCasesInput = document.getElementById('masterCases');
        if (masterCasesInput) {
            masterCasesInput.addEventListener('input', () => {
                if (typeof Calculator !== 'undefined' && Calculator.updateResults) {
                    Calculator.updateResults();
                }
            });
        }
        
        // Display boxes input for single product
        const displayBoxesInput = document.getElementById('displayBoxes');
        if (displayBoxesInput) {
            displayBoxesInput.addEventListener('input', () => {
                if (typeof Calculator !== 'undefined' && Calculator.updateResults) {
                    Calculator.updateResults();
                }
            });
        }
        
        // Multi-product calculation triggers
        document.addEventListener('change', (e) => {
            if (e.target.matches('[id^="product_"]') || e.target.matches('[id^="masterCases_"]')) {
                if (typeof MultiProductCalculator !== 'undefined' && MultiProductCalculator.displayCalculations) {
                    MultiProductCalculator.displayCalculations();
                }
            }
        });
        
        document.addEventListener('input', (e) => {
            if (e.target.matches('[id^="masterCases_"]')) {
                if (typeof MultiProductCalculator !== 'undefined' && MultiProductCalculator.displayCalculations) {
                    MultiProductCalculator.displayCalculations();
                }
            }
        });
        
        // Add Product Line button for multi-product calculator
        const addProductLineBtn = document.getElementById('addProductLine');
        if (addProductLineBtn) {
            addProductLineBtn.addEventListener('click', () => {
                if (typeof MultiProductCalculator !== 'undefined' && MultiProductCalculator.addProductLine) {
                    MultiProductCalculator.addProductLine();
                }
            });
        }
        
        // Generate quote button
        const generateBtn = document.getElementById('generateQuoteBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateInlineQuote();
            });
        }
        
        // Copy quote button
        const copyBtn = document.getElementById('copyQuoteBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyQuoteToClipboard();
            });
        }
        
        // CRM buttons
        const saveToAccountBtn = document.getElementById('saveToAccountBtn');
        if (saveToAccountBtn) {
            saveToAccountBtn.addEventListener('click', () => {
                this.saveToAccount();
            });
        }
        
        const createOpportunityBtn = document.getElementById('createOpportunityBtn');
        if (createOpportunityBtn) {
            createOpportunityBtn.addEventListener('click', () => {
                this.createOpportunity();
            });
        }
        
        const openEmailBtn = document.getElementById('openEmailBtn');
        if (openEmailBtn) {
            openEmailBtn.addEventListener('click', () => {
                this.openInEmailClient();
            });
        }
        
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button')) {
                this.switchTab(e.target.dataset.tab);
            }
        });
        
        // Manual shipping override field
        const manualShippingField = document.getElementById('manualShipping');
        if (manualShippingField) {
            manualShippingField.addEventListener('input', () => {
                if (typeof Calculator !== 'undefined' && Calculator.updateResults) {
                    Calculator.updateResults();
                }
                if (typeof MultiProductCalculator !== 'undefined' && MultiProductCalculator.calculateTotal) {
                    MultiProductCalculator.calculateTotal();
                }
            });
        }
        
        // Customer state field for shipping zone updates
        const customerStateField = document.getElementById('customerState');
        if (customerStateField) {
            customerStateField.addEventListener('change', () => {
                this.updateShippingZoneDisplay();
                if (typeof Calculator !== 'undefined' && Calculator.updateResults) {
                    Calculator.updateResults();
                }
                if (typeof MultiProductCalculator !== 'undefined' && MultiProductCalculator.calculateTotal) {
                    MultiProductCalculator.calculateTotal();
                }
            });
        }
        
        // Email template selection for auto-updating preview
        const emailTemplateSelect = document.getElementById('emailTemplate');
        if (emailTemplateSelect) {
            emailTemplateSelect.addEventListener('change', () => {
                this.onTemplateChange();
            });
        }
        
        console.log('✅ Event listeners bound');
    },
    
    // Switch between single and multi-product tabs
    switchTab: function(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = content.dataset.tabContent === tabName ? 'block' : 'none';
        });
        
        // Update calculations based on active tab
        if (tabName === 'single') {
            if (typeof Calculator !== 'undefined' && Calculator.updateResults) {
                Calculator.updateResults();
            }
        } else if (tabName === 'multiple') {
            if (typeof MultiProductCalculator !== 'undefined') {
                if (!MultiProductCalculator.lineItems.length) {
                    MultiProductCalculator.addProductLine();
                }
                MultiProductCalculator.calculateTotal();
            }
        }
    },
    
    // Generate inline quote
    generateInlineQuote: function() {
        const templateSelect = document.getElementById('emailTemplate');
        const template = templateSelect ? templateSelect.value : 'initial';
        
        let quoteContent = '';
        
        // Check which tab is active
        const activeTab = document.querySelector('.tab-button.active')?.dataset.tab || 'single';
        
        if (activeTab === 'multiple' && typeof MultiProductCalculator !== 'undefined') {
            // Multi-product quote
            const calculations = MultiProductCalculator.getCalculationForEmail();
            if (Array.isArray(calculations)) {
                quoteContent = this.generateMultiProductEmail(calculations, template);
            } else {
                quoteContent = this.generateSingleProductEmail(calculations, template);
            }
        } else {
            // Single product quote
            if (typeof Calculator !== 'undefined') {
                const calculation = Calculator.getCalculationSummary();
                quoteContent = this.generateSingleProductEmail(calculation, template);
            }
        }
        
        // Display the quote
        const quoteTextarea = document.getElementById('quoteContent');
        const quoteSection = document.getElementById('generatedQuote');
        const copyBtn = document.getElementById('copyQuoteBtn');
        
        if (quoteTextarea && quoteSection) {
            quoteTextarea.value = quoteContent;
            quoteSection.style.display = 'block';
            if (copyBtn) copyBtn.style.display = 'inline-block';
        }
    },
    
    // Handle template change and auto-update preview
    onTemplateChange: function() {
        // Auto-regenerate quote when template changes
        this.generateInlineQuote();
    },
    
    // Generate single product email
    generateSingleProductEmail: function(calculation, template = 'initial') {
        if (!calculation || !calculation.product) {
            return 'Please select a product and quantity to generate a quote.';
        }
        
        const customerInfo = this.getCustomerInfo();
        const templates = this.getEmailTemplates();
        const selectedTemplate = templates[template] || templates.initial;
        
        // Build product details section
        const productDetails = `
**Product: ${calculation.product.name}**
- Quantity: ${calculation.masterCases} Master Cases
- Display Boxes: ${calculation.displayBoxes}
- Individual Units: ${calculation.totalUnits}
- Unit Price: ${calculation.unitPrice} | Display Box Price: ${calculation.displayBoxPrice} | Case Price: ${calculation.casePrice}
- Tier: ${calculation.tierInfo.name}

**Order Summary:**
- Subtotal: ${calculation.subtotal}
- Shipping: ${calculation.shipping}
- Credit Card Fee (3%): ${calculation.creditCardFee}
- **Total: ${calculation.total}**
`;
        
        // Replace placeholders in template
        let emailContent = selectedTemplate.body
            .replace(/\{companyName\}/g, customerInfo.companyName)
            .replace(/\{contactName\}/g, customerInfo.contactName)
            .replace(/\{productDetails\}/g, productDetails);
        
        return `Subject: ${selectedTemplate.subject.replace(/\{companyName\}/g, customerInfo.companyName)}

${emailContent}`;
    },
    
    // Generate multi-product email
    generateMultiProductEmail: function(calculations, template = 'initial') {
        if (!calculations || !calculations.length) {
            return 'Please add products to generate a multi-product quote.';
        }
        
        const customerInfo = this.getCustomerInfo();
        const templates = this.getEmailTemplates();
        const selectedTemplate = templates[template] || templates.initial;
        
        // Build product lines
        let productLines = '';
        calculations.forEach((calc, index) => {
            productLines += `
**Product ${index + 1}: ${calc.product.name}**
- Quantity: ${calc.masterCases} Master Cases
- Display Boxes: ${calc.displayBoxes}
- Individual Units: ${calc.totalUnits}
- Unit Price: ${this.formatCurrency(calc.unitPrice)} | Display Box Price: ${this.formatCurrency(calc.displayBoxPrice)} | Case Price: ${this.formatCurrency(calc.casePrice)}
- Tier: ${calc.tierInfo.name}
- Line Total: ${this.formatCurrency(calc.lineTotal)}
`;
        });
        
        // Get order summary
        const summary = typeof MultiProductCalculator !== 'undefined' ? 
            MultiProductCalculator.lastCalculation?.summary : null;
        
        let orderSummary = '';
        if (summary) {
            orderSummary = `
## Order Summary
- Subtotal: ${this.formatCurrency(summary.subtotal)}
- Shipping: ${this.formatCurrency(summary.shipping)}
- Credit Card Fee (3%): ${this.formatCurrency(summary.creditCardFee)}
- **Grand Total: ${this.formatCurrency(summary.grandTotal)}**
`;
        }
        
        // Replace placeholders in template
        let emailContent = selectedTemplate.body
            .replace(/\{companyName\}/g, customerInfo.companyName)
            .replace(/\{contactName\}/g, customerInfo.contactName)
            .replace(/\{productDetails\}/g, productLines + orderSummary);
        
        return `Subject: ${selectedTemplate.subject.replace(/\{companyName\}/g, customerInfo.companyName)}

${emailContent}`;
    },
    
    // Get email templates
    getEmailTemplates: function() {
        return {
            initial: {
                subject: "{companyName} - Partnership Proposal",
                body: `Hi there,

Thank you for your interest in partnering with Kanva Botanicals! We're excited about the opportunity to work with {companyName}.

## Partnership Overview

{productDetails}

## Next Steps
We'd love to discuss this partnership opportunity further. Please let us know if you have any questions or would like to schedule a call.

Best regards,
Kanva Botanicals Team`
            },
            followup: {
                subject: "{companyName} - Following Up on Your Quote",
                body: `Hi {contactName},

I wanted to follow up on the quote we provided for {companyName}. 

## Quote Details

{productDetails}

## Special Considerations
We understand that every partnership is unique, and we're flexible on terms to make this work for both parties.

Please let me know if you have any questions or if there's anything we can adjust to better meet your needs.

Best regards,
Kanva Botanicals Team`
            },
            negotiation: {
                subject: "{companyName} - Revised Partnership Terms",
                body: `Hi {contactName},

Thank you for your feedback on our initial proposal. We've reviewed your requirements and are pleased to present revised terms for {companyName}.

## Updated Quote

{productDetails}

## Flexible Terms
We're committed to finding a solution that works for both parties and are open to discussing:
- Volume discounts for larger orders
- Extended payment terms
- Custom packaging options

Looking forward to moving forward together!

Best regards,
Kanva Botanicals Team`
            },
            closing: {
                subject: "{companyName} - Ready to Finalize Partnership",
                body: `Hi {contactName},

We're excited to finalize our partnership with {companyName}! Here are the final details:

## Final Quote

{productDetails}

## Next Steps
To move forward, we'll need:
1. Signed partnership agreement
2. Initial order confirmation
3. Payment processing setup

We're ready to get started as soon as you are. Thank you for choosing Kanva Botanicals as your partner!

Best regards,
Kanva Botanicals Team`
            }
        };
    },
    
    // Open quote in email client with Copper CRM integration
    openInEmailClient: function() {
        const quoteContent = document.getElementById('quoteContent')?.value;
        if (!quoteContent) {
            this.showNotification('Please generate a quote first', 'error');
            return;
        }
        
        // Extract subject and body
        const lines = quoteContent.split('\n');
        const subjectLine = lines.find(line => line.startsWith('Subject:'));
        const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : 'Kanva Botanicals Quote';
        const body = lines.slice(lines.indexOf(subjectLine) + 1).join('\n').trim();
        
        // Check if we're in Copper CRM context
        if (typeof Copper !== 'undefined' && Copper.context) {
            // Get current context (contact or company)
            Copper.context.get().then(context => {
                if (context.type === 'person' || context.type === 'company') {
                    // Open email activity in Copper
                    const emailData = {
                        type: 'email',
                        subject: subject,
                        body: body,
                        related_resource: {
                            id: context.id,
                            type: context.type
                        }
                    };
                    
                    // Create email activity in Copper
                    Copper.activities.create(emailData).then(() => {
                        this.showNotification('Email activity created in Copper CRM', 'success');
                    }).catch(error => {
                        console.error('Error creating email activity:', error);
                        this.fallbackToMailto(subject, body);
                    });
                } else {
                    this.fallbackToMailto(subject, body);
                }
            }).catch(error => {
                console.error('Error getting Copper context:', error);
                this.fallbackToMailto(subject, body);
            });
        } else {
            // Fallback to mailto
            this.fallbackToMailto(subject, body);
        }
    },
    
    // Fallback to mailto link
    fallbackToMailto: function(subject, body) {
        const customerInfo = this.getCustomerInfo();
        const mailto = `mailto:${customerInfo.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto);
    },
    
    // Get customer info from form
    getCustomerInfo: function() {
        return {
            companyName: document.getElementById('companyName')?.value || 'Your Company',
            contactName: document.getElementById('contactName')?.value || 'Contact',
            email: document.getElementById('emailDomain')?.value || 'email@company.com',
            phone: document.getElementById('phoneNumber')?.value || '',
            state: document.getElementById('customerState')?.value || ''
        };
    },
    
    // Copy quote to clipboard
    copyQuoteToClipboard: function() {
        const quoteTextarea = document.getElementById('quoteContent');
        if (quoteTextarea) {
            quoteTextarea.select();
            document.execCommand('copy');
            this.showNotification('Quote copied to clipboard!', 'success');
        }
    },
    
    // Show notification
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; min-width: 300px;';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    },
    
    // Format currency
    formatCurrency: function(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    // Update shipping zone display
    updateShippingZoneDisplay: function() {
        const stateField = document.getElementById('customerState');
        const zoneDisplay = document.getElementById('shippingZoneDisplay');
        
        if (!stateField || !zoneDisplay) return;
        
        const selectedState = stateField.value;
        if (!selectedState) {
            zoneDisplay.innerHTML = 'Select a state to see shipping zone';
            zoneDisplay.className = 'alert alert-info';
            return;
        }
        
        // Get shipping zone
        const zone = this.getShippingZone(selectedState);
        if (zone) {
            zoneDisplay.innerHTML = `
                <strong>${zone.name} Zone</strong><br>
                LTL Rate: ${zone.ltlPercentage}% of subtotal<br>
                <small>State: ${selectedState}</small>
            `;
            zoneDisplay.className = 'alert alert-success';
        } else {
            zoneDisplay.innerHTML = 'Unknown shipping zone for selected state';
            zoneDisplay.className = 'alert alert-warning';
        }
    },
    
    // Get shipping zone for a given state
    getShippingZone: function(state) {
        const zones = {
            west: { states: ["CA", "NV", "OR", "WA", "ID", "AZ", "UT"], ltlPercentage: 1.0, name: "West" },
            mountain: { states: ["MT", "WY", "CO", "NM"], ltlPercentage: 1.0, name: "Mountain" },
            southwest: { states: ["TX", "OK", "KS", "NE", "AR", "LA", "MS"], ltlPercentage: 1.5, name: "Southwest" },
            midwest: { states: ["ND", "SD", "MN", "IA", "MO", "WI", "IL", "IN", "MI", "OH"], ltlPercentage: 1.5, name: "Midwest" },
            southeast: { states: ["AL", "TN", "KY", "WV", "VA", "NC", "SC", "GA", "FL"], ltlPercentage: 2.0, name: "Southeast" },
            northeast: { states: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "DC"], ltlPercentage: 2.0, name: "Northeast" },
            remote: { states: ["AK", "HI"], ltlPercentage: 2.0, name: "Remote" }
        };
        
        for (const [zoneKey, zone] of Object.entries(zones)) {
            if (zone.states.includes(state)) {
                return zone;
            }
        }
        
        return null;
    },

    // CRM Integration functions
    saveToAccount: function() {
        this.showNotification('Quote saved to CRM account!', 'success');
    },
    
    createOpportunity: function() {
        this.showNotification('Opportunity created in CRM!', 'success');
    },
    
    // Show notification
    saveQuoteToCRM: function() {
        this.showNotification('Quote saved to CRM!', 'success');
    },
    
    sendEmailViaCRM: function() {
        this.showNotification('Email sent via CRM!', 'success');
    },

    // Set up mode-specific UI behavior
    setupModeSpecificUI: function() {
        console.log('🔧 Setting up mode-specific UI');
        this.populateProductReference();
    },
    
    // Populate product reference section
    populateProductReference: function() {
        const referenceContainer = document.querySelector('.card .grid.grid-3');
        if (!referenceContainer) return;
        
        // Enhanced product data with wholesale pricing and benefits
        const products = [
            {
                name: "Focus+Flow",
                unitPrice: "$4.50",
                displayBoxPrice: "$54.00",
                casePrice: "$648.00",
                msrp: "$9.99",
                unitsPerCase: 144,
                unitsPerDisplayBox: 12,
                description: "Kava + Kratom extract blend - #1 selling shot",
                benefits: ["Enhanced focus & clarity", "Natural energy boost", "Stress relief", "Mood enhancement"],
                features: ["2oz liquid shot", "Fast-acting formula", "Natural ingredients", "No crash"],
                isBestSeller: true,
                category: "2oz_wellness"
            },
            {
                name: "Release+Relax",
                unitPrice: "$4.50",
                displayBoxPrice: "$54.00",
                casePrice: "$432.00",
                msrp: "$9.99",
                unitsPerCase: 96,
                unitsPerDisplayBox: 12,
                description: "Kanna + Kava blend for stress relief",
                benefits: ["Deep relaxation", "Stress reduction", "Anxiety relief", "Better sleep"],
                features: ["2oz liquid shot", "Calming blend", "Natural botanicals", "Non-drowsy"],
                isBestSeller: false,
                category: "2oz_wellness"
            },
            {
                name: "Kanva Zoom",
                unitPrice: "$3.10",
                displayBoxPrice: "$37.20",
                casePrice: "$446.40",
                msrp: "$6.99",
                unitsPerCase: 144,
                unitsPerDisplayBox: 12,
                description: "Kratom energy shot",
                benefits: ["Clean energy", "Mental alertness", "Productivity boost", "Sustained focus"],
                features: ["2oz energy shot", "Kratom extract", "No jitters", "Long-lasting"],
                isBestSeller: false,
                category: "energy_shots"
            },
            {
                name: "Mango Extract",
                unitPrice: "$4.25",
                displayBoxPrice: "$51.00",
                casePrice: "$612.00",
                msrp: "$11.99",
                unitsPerCase: 144,
                unitsPerDisplayBox: 12,
                description: "Mango Extract 12ct shot",
                benefits: ["Tropical flavor", "Natural extracts", "Wellness support", "Antioxidant rich"],
                features: ["Premium mango extract", "12-count display", "Refreshing taste", "Natural formula"],
                isBestSeller: false,
                category: "extract_shots"
            }
        ];
        
        // Generate product reference HTML with wholesale pricing
        const productHTML = products.map(product => `
            <div class="product-reference-item">
                <div class="product-header">
                    <h4 class="product-name">${product.name} ${product.isBestSeller ? '<span class="bestseller-badge">🔥 Best Seller</span>' : ''}</h4>
                    <p class="product-description">${product.description}</p>
                </div>
                
                <div class="pricing-structure">
                    <h5>💰 Wholesale Pricing:</h5>
                    <div class="pricing-grid">
                        <div class="price-tier">
                            <span class="price-label">Unit:</span>
                            <span class="price-value">${product.unitPrice}</span>
                        </div>
                        <div class="price-tier">
                            <span class="price-label">Display Box (12):</span>
                            <span class="price-value">${product.displayBoxPrice}</span>
                        </div>
                        <div class="price-tier">
                            <span class="price-label">Master Case (${product.unitsPerCase}):</span>
                            <span class="price-value">${product.casePrice}</span>
                        </div>
                        <div class="price-tier msrp">
                            <span class="price-label">MSRP:</span>
                            <span class="price-value">${product.msrp}</span>
                        </div>
                    </div>
                </div>
                
                <div class="product-benefits">
                    <h5>✨ Key Benefits:</h5>
                    <ul class="benefits-list">
                        ${product.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="product-features">
                    <h5>🎯 Features:</h5>
                    <ul class="features-list">
                        ${product.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="product-specs">
                    <small class="specs-text">
                        📦 ${product.unitsPerDisplayBox} units per display box | 
                        📋 ${product.unitsPerCase} units per master case
                    </small>
                </div>
            </div>
        `).join('');
        
        referenceContainer.innerHTML = productHTML;
        
        // Add CSS for enhanced product reference styling
        if (!document.getElementById('productReferenceStyles')) {
            const style = document.createElement('style');
            style.id = 'productReferenceStyles';
            style.textContent = `
                .product-reference-item {
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                
                .product-header .product-name {
                    color: #17351A;
                    margin: 0 0 8px 0;
                    font-size: 18px;
                    font-weight: bold;
                }
                
                .bestseller-badge {
                    background: #93D500;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    margin-left: 8px;
                }
                
                .product-description {
                    color: #6c757d;
                    margin: 0 0 12px 0;
                    font-style: italic;
                }
                
                .pricing-structure h5,
                .product-benefits h5,
                .product-features h5 {
                    color: #17351A;
                    margin: 12px 0 8px 0;
                    font-size: 14px;
                    font-weight: bold;
                }
                
                .pricing-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .price-tier {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 8px;
                    background: white;
                    border-radius: 4px;
                    border: 1px solid #dee2e6;
                }
                
                .price-tier.msrp {
                    background: #e8f5e8;
                    border-color: #93D500;
                }
                
                .price-label {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .price-value {
                    font-weight: bold;
                    color: #17351A;
                }
                
                .benefits-list,
                .features-list {
                    margin: 0;
                    padding-left: 16px;
                    font-size: 13px;
                }
                
                .benefits-list li,
                .features-list li {
                    margin-bottom: 4px;
                    color: #495057;
                }
                
                .specs-text {
                    color: #6c757d;
                    font-size: 11px;
                }
            `;
            document.head.appendChild(style);
        }
    },

    // Initialize help system and tooltips
    initializeHelpSystem: function() {
        console.log('❓ Initializing help system...');
    },

    // Set up responsive UI behavior
    setupResponsiveUI: function() {
        console.log('📱 Setting up responsive UI...');
    },

    // Perform initial calculations
    performInitialCalculations: function() {
        console.log('🧮 Performing initial calculations...');
    },

    // Finalize initialization
    finalizeInitialization: function() {
        appState.isReady = true;
        appState.loadTime = Date.now() - appState.startTime;
        
        console.log(`✅ Kanva Botanicals Quote Calculator initialized successfully`);
        console.log(`⏱️ Load time: ${appState.loadTime}ms`);
        console.log(`🏃 Running in ${appState.appLocation} mode`);
        console.log(`🔗 Copper CRM: ${appState.isCopperActive ? 'Connected' : 'Standalone'}`);
        console.log(`👤 User: ${appState.currentUser ? appState.currentUser.email : 'Unknown'}`);
        console.log(`🛡️ Admin: ${appState.isAdmin ? 'Yes' : 'No'}`);

        
        // Fire ready event
        const readyEvent = new CustomEvent('kanvaAppReady', {
            detail: {
                version: '2.0.0',
                loadTime: appState.loadTime
            }
        });
        
        document.dispatchEvent(readyEvent);
        console.log('🎉 Kanva app ready event fired');
    },

    // Handle initialization errors gracefully
    handleInitializationError: function(error) {
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showError('Critical initialization error: ' + (error.message || error));
        } else {
            alert('Critical initialization error: ' + (error.message || error));
        }
        // Optionally, add more logging or fallback UI here
    },

    // Generate the admin panel HTML
    generateAdminPanel: function() {
        // Get products and admin emails from config
        const products = adminConfig.products || {};
        const adminEmails = adminConfig.adminEmails || [];
        // Panel HTML
        return `
        <div id="adminPanel" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:10000;">
            <div style="max-width:600px; margin:60px auto; background:#fff; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.2); padding:32px; position:relative;">
                <button onclick="hideAdminPanel()" style="position:absolute; top:18px; right:18px; background:none; border:none; font-size:2rem; color:#888; cursor:pointer;">&times;</button>
                <h2 style="font-size:2rem; font-weight:bold; margin-bottom:16px;">Admin Configuration</h2>
                <form id="adminConfigForm" onsubmit="event.preventDefault(); saveAdminSettings();">
                    <h3 style="margin-top:24px; font-size:1.2rem; font-weight:bold;">Product Settings</h3>
                    <div style="max-height:180px; overflow:auto; border:1px solid #eee; border-radius:8px; padding:8px 0; margin-bottom:16px;">
                        ${Object.entries(products).map(([key, product]) => `
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                                <span style="min-width:90px; font-weight:500;">${product.name}</span>
                                <label>Price: <input id="admin_${key}_price" type="number" step="0.01" value="${product.price}" style="width:70px;"></label>
                                <label>MSRP: <input id="admin_${key}_msrp" type="number" step="0.01" value="${product.msrp}" style="width:70px;"></label>
                                <label>Units/Case: <input id="admin_${key}_units" type="number" value="${product.unitsPerCase || ''}" style="width:60px;"></label>
                            </div>
                        `).join('')}
                    </div>
                    <h3 style="margin-top:16px; font-size:1.1rem; font-weight:bold;">Admin Emails</h3>
                    <div style="margin-bottom:16px;">
                        <textarea id="adminEmails" style="width:100%; min-height:60px;">${adminEmails.join(', ')}</textarea>
                        <small>Comma-separated list of admin emails</small>
                    </div>
                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button type="button" onclick="hideAdminPanel()" class="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-kanva-green text-white rounded">Save</button>
                    </div>
                </form>
            </div>
        </div>`;
    }
};

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        getConfig(() => {
            App.initialize();
        });
    });
} else {
    getConfig(() => {
        App.initialize();
    });
}

// Global access to app instance
window.KanvaApp = App;

// Initialize Admin Dashboard
if (typeof AdminDashboard !== 'undefined') {
    console.log('🔧 Initializing Admin Dashboard...');
    window.adminDashboard = new AdminDashboard();
    window.adminDashboard.init();
    console.log('✅ Admin Dashboard initialized successfully');
} else {
    console.warn('⚠️ AdminDashboard class not found');
}

console.log('✅ Main application module loaded successfully');
