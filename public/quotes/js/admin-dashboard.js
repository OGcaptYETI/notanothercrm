/**
 * Enhanced Admin Dashboard for Kanva Quotes
 * Integrates admin functionality with modern UI and Kanva branding
 */

class AdminDashboard {
    constructor(options = {}) {
        this.calculator = options.calculator || window.calculator;
        this.adminManager = options.adminManager || window.adminManager;
        this.container = null;
        this.floatingButton = null;
        this.loginModal = null;
        this.adminModal = null;
        this.isInitialized = false;
        this.isLoggedIn = false;
        this.currentSection = 'products';
        this.currentTab = 'products';
        this.adminManager = null;
        this.isLoggedIn = false;
        this.modal = null;
        this.loginModal = null;
        this.connectionData = {}; // Store real connection data
        
        // Git integration is deprecated; ensure connector is null
        this.gitConnector = null;
        
        // Admin emails loaded from data file
        this.adminEmails = [];
        this.defaultPassword = 'K@nva2025'; // Default password for all admin emails
        
        // Load admin emails and connection data
        this.loadAdminEmails();
        this.loadConnectionData();
        
        console.log('🎛️ AdminDashboard instance created');
    }

    /**
     * Load admin emails from data file
     */
    async loadAdminEmails() {
        try {
            const response = await fetch('/data/admin-emails.json');
            if (response.ok) {
                const data = await response.json();
                // Handle both array format and object format
                this.adminEmails = Array.isArray(data) ? data : (data.emails || []);
                console.log('✅ Admin emails loaded:', this.adminEmails.length, this.adminEmails);
            } else {
                console.warn('⚠️ Could not load admin emails, using defaults');
                this.adminEmails = ['ben@kanvabotanicals.com'];
            }
        } catch (error) {
            console.error('❌ Error loading admin emails:', error);
            this.adminEmails = ['ben@kanvabotanicals.com'];
        }
    }

    /**
     * Save RingCentral settings
     */
    async saveRingCentralSettings(showAlert = true) {
        const environment = document.getElementById('ringcentral-environment')?.value || 'production';
        const clientId = document.getElementById('ringcentral-client-id')?.value?.trim();
        const redirectUri = document.getElementById('ringcentral-redirect-uri')?.value?.trim() || 'https://kanvaportal.web.app/rc/auth/callback';
        const clientSecretInput = document.getElementById('ringcentral-client-secret');
        const clientSecret = clientSecretInput?.value?.trim();
        if (!clientId) {
            if (showAlert) alert('Please enter RingCentral Client ID');
            return false;
        }
        const payload = { environment, clientId, redirectUri, enabled: true, lastUpdated: new Date().toISOString() };
        try {
            let saved = false;
            if (window.secureIntegrationHandler) {
                try { saved = await window.secureIntegrationHandler.updateIntegration('ringcentral', payload); } catch (e) { console.warn('Secure save failed:', e); }
            }
            if (!saved) {
                const resp = await fetch('/api/connections/ringcentral', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                const result = await resp.json().catch(() => ({}));
                saved = resp.ok && result?.success !== false;
            }
            // Securely persist the clientSecret to .env via PHP endpoint if provided
            if (clientSecret) {
                try {
                    await fetch('/api/save-connections.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ringcentral: { clientSecret } })
                    });
                    // Clear the sensitive input after attempting save
                    if (clientSecretInput) clientSecretInput.value = '';
                } catch (e) {
                    console.warn('Failed saving RingCentral clientSecret via PHP endpoint:', e);
                }
            }
            if (!saved) { if (showAlert) alert('Failed to save RingCentral settings'); return false; }
            this.connectionData = this.connectionData || {}; this.connectionData.ringcentral = payload;
            const statusEl = document.getElementById('ringcentral-status');
            if (statusEl) this.updateIntegrationStatus(statusEl, 'ok', 'Configured');
            if (this.showNotification) this.showNotification('RingCentral settings saved', 'success');
            return true;
        } catch (e) {
            console.error('Error saving RingCentral settings:', e);
            if (this.showNotification) this.showNotification(`Failed to save RingCentral settings: ${e.message}`, 'error');
            return false;
        }
    }

    /**
     * Start RingCentral OAuth via Hosting rewrite
     */
    startRingCentralOAuth() {
        const rcBase = 'https://kanvaportal.web.app';
        window.open(`${rcBase}/rc/auth/start`, '_blank', 'noopener');
    }

    /**
     * View RingCentral status endpoint and display basic info
     */
    async viewRingCentralStatus() {
        const statusEl = document.getElementById('ringcentral-status');
        this.updateIntegrationStatus(statusEl, 'testing', 'Checking...');
        try {
            const rcBase = 'https://kanvaportal.web.app';
            const resp = await fetch(`${rcBase}/rc/status`);
            const text = await resp.text();
            this.updateIntegrationStatus(statusEl, resp.ok ? 'ok' : 'warning', resp.ok ? 'OK' : `HTTP ${resp.status}`);
            alert(`RingCentral Status:\n${text.substring(0, 2000)}`);
        } catch (e) {
            this.updateIntegrationStatus(statusEl, 'error', 'Error');
            alert(`Error fetching RingCentral status: ${e.message}`);
        }
    }

    /**
     * Send a test webhook POST to validate endpoint
     */
    async sendRingCentralTestWebhook() {
        try {
            const rcBase = 'https://kanvaportal.web.app';
            const resp = await fetch(`${rcBase}/rc/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'test', ts: new Date().toISOString() }) });
            const message = resp.ok ? 'Webhook test sent successfully' : `Webhook test failed: HTTP ${resp.status}`;
            console.log('🔔 Webhook Test:', message);
            this.showNotification(message, resp.ok ? 'success' : 'error');
        } catch (e) {
            const message = `Webhook test error: ${e.message}`;
            console.error('❌ Webhook Test Error:', message);
            this.showNotification(message, 'error');
        }
    }
    
    /**
     * Load real connection data from server or localStorage
     */
    async loadConnectionData() {
        try {
            // Always load from server in our environment
            {
                // Running locally - load from server
                console.log('🔄 Loading connection data from server...');
                const response = await fetch('/api/connections');
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        this.connectionData = result.data || {};
                        console.log('✅ Connection data loaded:', Object.keys(this.connectionData));
                        
                        // Update UI with real connection statuses
                        this.updateConnectionStatuses();
                    } else {
                        console.warn('⚠️ Failed to load connection data:', result.message);
                    }
                } else {
                    console.warn('⚠️ Could not load connection data from server');
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not load connection data from server');
        }
    }
    
    /**
     * Update UI with real connection statuses
     */
    updateConnectionStatuses() {
        const integrations = ['copper', 'ringcentral', 'shipstation', 'fishbowl'];
        
        integrations.forEach(integration => {
            const statusElement = document.getElementById(`${integration}-status`);
            if (statusElement) {
                const connectionInfo = this.connectionData[integration];
                if (connectionInfo && this.isConnectionValid(integration, connectionInfo)) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                } else {
                    this.updateIntegrationStatus(statusElement, 'warning', 'Not Configured');
                }
            }
        });
    }
    
    /**
     * Check if connection data is valid
     */
    isConnectionValid(integration, connectionInfo) {
        if (!connectionInfo) return false;
        
        switch (integration) {
            case 'copper':
                return connectionInfo.apiKey && connectionInfo.email;
            case 'ringcentral':
                return !!connectionInfo.clientId;
            case 'shipstation':
                return connectionInfo.apiKey && connectionInfo.apiSecret;
            case 'fishbowl':
                return connectionInfo.username && connectionInfo.password && connectionInfo.host;
            default:
                return false;
        }
    }
    
    /**
     * Save connection data to server or localStorage
     */
    async saveConnectionData(integration, connectionData) {
        try {
            console.log(`💾 Saving ${integration} connection data...`);
            
            // Check if we're running on GitHub Pages (no local server)
            const isGitHubPages = window.location.hostname.includes('github.io');
            
            if (isGitHubPages) {
                // Running on GitHub Pages - save to localStorage
                console.log(`💾 Saving ${integration} connection to localStorage (GitHub Pages mode)`);
                localStorage.setItem(`${integration}-connection`, JSON.stringify(connectionData));
                
                // Update local connection data
                this.connectionData[integration] = connectionData;
                console.log(`✅ ${integration} connection data saved to localStorage`);
                return true;
            } else {
                // Running locally - save to server
                const response = await fetch(`/api/connections/${integration}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(connectionData)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        // Update local connection data
                        this.connectionData[integration] = connectionData;
                        console.log(`✅ ${integration} connection data saved successfully`);
                        return true;
                    } else {
                        console.warn(`⚠️ Failed to save ${integration} connection:`, result.message);
                        return false;
                    }
                } else {
                    console.warn(`⚠️ Server returned ${response.status} when saving ${integration} connection`);
                    return false;
                }
            }
        } catch (error) {
            console.error(`❌ Error saving ${integration} connection:`, error);
            return false;
        }
    }
    
    /**
     * Populate form fields with existing connection data
     */
    populateConnectionForms() {
        // Copper CRM form population
        if (this.connectionData.copper) {
            const copper = this.connectionData.copper;
            const apiKeyInput = document.getElementById('copper-api-key');
            const emailInput = document.getElementById('copper-email');
            const envSelect = document.getElementById('copper-environment');
            
            if (apiKeyInput && copper.apiKey) apiKeyInput.value = copper.apiKey;
            if (emailInput && copper.email) emailInput.value = copper.email;
            if (envSelect && copper.environment) envSelect.value = copper.environment;

            // Advanced Copper settings
            const actTypeEl = document.getElementById('copper-activity-type-id');
            const assignUserEl = document.getElementById('copper-assign-user-id');
            const phoneStrategyEl = document.getElementById('copper-phone-strategy');
            const defaultCountryEl = document.getElementById('copper-default-country');
            const taskStatusEl = document.getElementById('copper-task-status');
            const taskDueEl = document.getElementById('copper-task-due-offset');
            const actFieldsEl = document.getElementById('copper-activity-custom-fields-json');
            const taskFieldsEl = document.getElementById('copper-task-custom-fields-json');

            if (actTypeEl && typeof copper.activityTypeId === 'number') actTypeEl.value = String(copper.activityTypeId);
            if (assignUserEl && typeof copper.assignToUserId === 'number') assignUserEl.value = String(copper.assignToUserId);
            if (phoneStrategyEl && copper.phoneMatch?.strategy) phoneStrategyEl.value = copper.phoneMatch.strategy;
            if (defaultCountryEl && copper.phoneMatch?.defaultCountry) defaultCountryEl.value = copper.phoneMatch.defaultCountry;
            if (taskStatusEl && copper.taskDefaults?.status) taskStatusEl.value = copper.taskDefaults.status;
            if (taskDueEl && typeof copper.taskDefaults?.dueDateOffsetMinutes === 'number') taskDueEl.value = String(copper.taskDefaults.dueDateOffsetMinutes);
            if (actFieldsEl && copper.activityCustomFields) actFieldsEl.value = JSON.stringify(copper.activityCustomFields, null, 2);
            if (taskFieldsEl && copper.taskCustomFields) taskFieldsEl.value = JSON.stringify(copper.taskCustomFields, null, 2);
        }
        
        // ShipStation form population
        if (this.connectionData.shipstation) {
            const shipstation = this.connectionData.shipstation;
            const apiKeyInput = document.getElementById('shipstation-api-key');
            const apiSecretInput = document.getElementById('shipstation-api-secret');
            const envSelect = document.getElementById('shipstation-environment');
            
            if (apiKeyInput && shipstation.apiKey) apiKeyInput.value = shipstation.apiKey;
            if (apiSecretInput && shipstation.apiSecret) apiSecretInput.value = shipstation.apiSecret;
            if (envSelect && shipstation.environment) envSelect.value = shipstation.environment;
        }
        
        // Fishbowl ERP form population
        if (this.connectionData.fishbowl) {
            const fishbowl = this.connectionData.fishbowl;
            const serverInput = document.getElementById('fishbowl-server');
            const usernameInput = document.getElementById('fishbowl-username');
            const passwordInput = document.getElementById('fishbowl-password');
            
            if (serverInput && fishbowl.host) serverInput.value = fishbowl.host;
            if (usernameInput && fishbowl.username) usernameInput.value = fishbowl.username;
            if (passwordInput && fishbowl.password) passwordInput.value = fishbowl.password;
        }

        // RingCentral form population
        if (this.connectionData.ringcentral) {
            const rc = this.connectionData.ringcentral;
            const envEl = document.getElementById('ringcentral-environment');
            const clientIdEl = document.getElementById('ringcentral-client-id');
            const redirectEl = document.getElementById('ringcentral-redirect-uri');
            if (envEl && rc.environment) envEl.value = rc.environment;
            if (clientIdEl && rc.clientId) clientIdEl.value = rc.clientId;
            if (redirectEl && rc.redirectUri) redirectEl.value = rc.redirectUri;
        }
    }

    /**
     * Initialize the admin dashboard
     */
    init() {
        if (this.isInitialized) {
            console.log('⚠️ AdminDashboard already initialized, skipping...');
            return;
        }
        
        console.log('🔄 Initializing AdminDashboard...');
        
        try {
            // Create UI elements
            this.createFloatingButton();
            this.createLoginModal();
            this.createAdminModal();
            
            // Bind events
            this.bindEvents();
            
            // Load data
            this.loadProductsData();
            this.loadTiersData();
            this.loadShippingData();
            this.loadIntegrationsData();
            
            this.isInitialized = true;
            console.log('✅ AdminDashboard initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing AdminDashboard:', error);
            throw error;
        }
    }
    
    /**
     * Create floating admin button
     */
    createFloatingButton() {
        // Remove existing button if any
        const existing = document.getElementById('floating-admin-btn');
        if (existing) {
            existing.remove();
        }

        this.floatingButton = document.createElement('button');
        this.floatingButton.id = 'floating-admin-btn';
        this.floatingButton.className = 'floating-admin-btn';
        this.floatingButton.innerHTML = 'Admin';
        this.floatingButton.title = 'Admin Panel';
        
        // Force append to body to ensure it's visible
        setTimeout(() => {
            document.body.appendChild(this.floatingButton);
            console.log('✅ Floating admin button created and appended to body');
            
            // Bind click event
            this.floatingButton.addEventListener('click', () => {
                console.log('🔧 Admin button clicked!');
                if (this.isLoggedIn) {
                    console.log('👤 User already logged in, showing admin dashboard');
                    this.showAdminModal();
                } else {
                    console.log('🔐 User not logged in, showing login modal');
                    this.showLoginModal();
                }
            });
        }, 500); // Small delay to ensure DOM is ready
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // This method is called during initialization
        // Additional event bindings can be added here
        console.log('🔗 Admin dashboard events bound');
    }

    /**
     * Create login modal
     */
    createLoginModal() {
        this.loginModal = document.createElement('div');
        this.loginModal.id = 'admin-login-modal';
        this.loginModal.className = 'modal';
        this.loginModal.style.display = 'none';
        
        this.loginModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; height: auto; margin: 10% auto;">
                <div class="admin-header">
                    <h2>🔐 Admin Login</h2>
                    <button class="close-btn" onclick="window.adminDashboard.hideLoginModal()">&times;</button>
                </div>
                <div class="admin-content" style="padding: 30px;">
                    <form id="admin-login-form" style="display: flex; flex-direction: column; gap: 20px;">
                        <div class="form-group">
                            <label for="admin-email" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--kanva-dark-blue);">Admin Email</label>
                            <input type="email" id="admin-email" class="form-control" placeholder="Enter admin email" style="width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;" required>
                        </div>
                        <div class="form-group">
                            <label for="admin-password" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--kanva-dark-blue);">Password</label>
                            <div class="password-input-container" style="position: relative;">
                                <input type="text" id="admin-password" class="form-control" placeholder="Enter admin password" style="width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;" required>
                                <!-- Password toggle button removed - password is now always visible -->
                            </div>
                        </div>
                        <div id="login-error" style="color: var(--admin-danger); font-size: 14px; display: none;"></div>
                        <button type="submit" class="btn btn-primary" style="padding: 12px 24px; font-size: 16px;">Login</button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.loginModal);
        console.log('✅ Login modal created');
    }

    /**
     * Create main admin modal
     */
    createAdminModal() {
        this.adminModal = document.createElement('div');
        this.adminModal.id = 'admin-modal';
        this.adminModal.className = 'modal';
        this.adminModal.style.display = 'none';
        
        this.adminModal.innerHTML = `
            <div class="modal-content" style="margin: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto;">
                <div class="admin-header">
                    <h2>🎛️ Admin Dashboard</h2>
                    <button class="close-btn" onclick="window.adminDashboard.hideAdminModal()">&times;</button>
                </div>
                <div class="admin-navigation">
                    <button class="nav-btn active" data-section="products">
                        📦 Manage Products
                    </button>
                    <button class="nav-btn" data-section="tiers">
                        📊 Manage Tiers
                    </button>
                    <button class="nav-btn" data-section="shipping">
                        🚚 Manage Shipping
                    </button>
                    <button class="nav-btn" data-section="integrations">
                        🔗 Integrations
                    </button>
                    <button class="nav-btn btn-danger" data-section="logout">
                        🚪 Logout
                    </button>
                </div>
                <div class="admin-content">
                    <div id="admin-section-content">
                        <!-- Content will be dynamically loaded -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.adminModal);
        console.log('✅ Admin modal created');
    }

    /**
     * Bind events to floating button, login modal, and admin modal
     */
    bindEvents() {
        this.floatingButton.addEventListener('click', () => {
            if (!this.isLoggedIn) {
                this.showLoginModal();
            } else {
                this.showAdminModal();
            }
        });

        document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('admin-email').value.toLowerCase().trim();
            const password = document.getElementById('admin-password').value;
            
            // Debug logging
            console.log('🔍 Login attempt:');
            console.log('  Email entered:', email);
            console.log('  Password entered:', password);
            console.log('  Expected password:', this.defaultPassword);
            console.log('  Available admin emails:', this.adminEmails);
            console.log('  Password match:', password === this.defaultPassword);
            
            // Check if admin emails are loaded, if not try to load them
            if (this.adminEmails.length === 0) {
                console.log('⏳ Admin emails not loaded yet, attempting to load...');
                await this.loadAdminEmails();
                
                // If still empty after loading, use fallback
                if (this.adminEmails.length === 0) {
                    console.log('⚠️ Using fallback admin emails');
                    this.adminEmails = ['ben@kanvabotanicals.com'];
                }
            }
            
            // Check if email is in admin list and password matches
            const isValidAdmin = this.adminEmails.some(adminEmail => 
                adminEmail.toLowerCase() === email
            );
            
            console.log('  Email is valid admin:', isValidAdmin);
            
            if (isValidAdmin && password === this.defaultPassword) {
                this.isLoggedIn = true;
                this.currentAdminEmail = email;
                this.loginModal.style.display = 'none';
                this.showAdminModal();
                
                console.log('✅ Admin logged in:', email);
                
                // Clear form
                document.getElementById('admin-email').value = '';
                document.getElementById('admin-password').value = '';
            } else {
                alert('Invalid credentials. Please check your email and password.');
                console.warn('❌ Failed login attempt for:', email);
            }
        });

        // Use event delegation for navigation buttons since they're created dynamically
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                const section = e.target.dataset.section;
                this.showAdminSection(section);
            }
        });
    }

    // Modal methods are now at the end of the class with proper login state management
    
    /**
     * Adjust modal height based on content
     * This ensures the modal properly adapts to different tab contents
     */
    adjustModalHeight() {
        const modalContent = this.adminModal.querySelector('.modal-content');
        const adminContent = this.adminModal.querySelector('.admin-content');
        const sectionContent = this.adminModal.querySelector('#admin-section-content');
        
        if (!modalContent || !adminContent || !sectionContent) return;
        
        // Get the actual content height
        const contentHeight = sectionContent.scrollHeight;
        const headerHeight = this.adminModal.querySelector('.admin-header')?.offsetHeight || 0;
        const navHeight = this.adminModal.querySelector('.admin-navigation')?.offsetHeight || 0;
        
        // Calculate total required height with some padding
        const totalHeight = contentHeight + headerHeight + navHeight + 40;
        
        // Set minimum height
        const minHeight = 500;
        const finalHeight = Math.max(totalHeight, minHeight);
        
        console.log('📏 Adjusting modal height:', {
            contentHeight,
            headerHeight,
            navHeight,
            totalHeight,
            finalHeight
        });
        
        // Apply the height to the modal content
        modalContent.style.height = `${finalHeight}px`;
        
        // Ensure admin content takes remaining space
        adminContent.style.flex = '1';
        adminContent.style.overflow = 'visible';
    }

    /**
     * Show admin section
     */
    showAdminSection(section) {
        // Set current section for data operations
        this.currentSection = section;
        
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === section) {
                btn.classList.add('active');
            }
        });

        const content = document.getElementById('admin-section-content');
        content.innerHTML = '';

        switch (section) {
            case 'products':
                content.innerHTML = this.renderProductsSection();
                break;
            case 'tiers':
                content.innerHTML = this.renderTiersSection();
                break;
            case 'shipping':
                content.innerHTML = this.renderShippingSection();
                break;
            case 'integrations':
                content.innerHTML = this.renderIntegrationsSection();
                break;
            case 'logout':
                this.isLoggedIn = false;
                this.hideAdminModal();
                break;
        }
        
        // Adjust modal height after content is rendered
        setTimeout(() => this.adjustModalHeight(), 100);
    }

    /**
     * Render products section with real data
     */
    renderProductsSection() {
        // Load products data and render table
        this.loadProductsData();
        
        return `
            <div class="card">
                <h3>📦 Product Management</h3>
                <div class="admin-actions">
                    <button class="btn btn-primary" onclick="window.adminDashboard.addNewProduct()">
                        <span class="icon">➕</span> Add New Product
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshProductsData()">
                        <span class="icon">🔄</span> Refresh Data
                    </button>
                    <button class="btn btn-warning" onclick="window.adminDashboard.exportProductsData()">
                        <span class="icon">📄</span> Export Data
                    </button>
                </div>
                
                <div class="data-table-container">
                    <table class="admin-data-table" id="products-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Image</th>
                                <th>Product Name</th>
                                <th>Distro</th>
                                <th>Retail</th>
                                <th>MSRP</th>
                                <th>Cost</th>
                                <th>Category</th>
                                <th>Units/Case</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="products-table-body">
                            <tr><td colspan="10" class="loading-row">Loading products data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    /**
     * Load products data from JSON file
     */
    async loadProductsData() {
        // Prevent multiple simultaneous loads
        if (this.loadingProducts) {
            console.log('⏳ Products data already loading, skipping...');
            return;
        }
        
        this.loadingProducts = true;
        
        try {
            console.log('🔄 Loading products data...');
            const response = await fetch('data/products.json');
            if (response.ok) {
                const productsData = await response.json();
                console.log('✅ Products data loaded:', productsData);
                
                // Convert object to array format for table rendering
                const productsArray = Object.entries(productsData).map(([id, product]) => ({
                    id,
                    name: product.name,
                    price: product.price,
                    retailPrice: product.retailPrice || product.price, // Fallback to price if no retail price
                    msrp: product.msrp,
                    cost: (product.price * 0.7).toFixed(2), // Estimated cost
                    category: product.category,
                    unitsPerCase: product.unitsPerCase,
                    image: product.image || null, // Product image path
                    active: true // Default to active
                }));
                
                console.log('📊 Processed products array:', productsArray);
                this.renderProductsTable(productsArray);
            } else {
                console.error('❌ Failed to load products data:', response.status, response.statusText);
                this.renderProductsError();
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
            this.renderProductsError();
        } finally {
            this.loadingProducts = false;
        }
    }
    
    /**
     * Render products table with data
     */
    renderProductsTable(products) {
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = products.map(product => {
            // Get image source - use product image or fallback to placeholder
            const imageSrc = product.image || 'assets/logo/Kanva_Logo_White_Master.png';
            const hasImage = product.image && typeof product.image === 'string' && product.image.trim() !== '';
            
            return `
                <tr data-product-id="${product.id}">
                    <td class="product-id">${product.id}</td>
                    <td class="product-image">
                        <div class="image-container">
                            <img src="${imageSrc}" alt="${product.name}" class="product-thumbnail" 
                                 onerror="this.src='assets/logo/Kanva_Logo_White_Master.png'" />
                            <div class="image-actions">
                                <button class="btn-small btn-edit-image" onclick="window.adminDashboard.editProductImage('${product.id}')" title="Edit Image">
                                    📷
                                </button>
                                ${hasImage ? `<button class="btn-small btn-delete-image" onclick="window.adminDashboard.deleteProductImage('${product.id}')" title="Delete Image">🗑️</button>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="product-name editable" data-field="name">${product.name}</td>
                    <td class="product-price editable" data-field="price">$${product.price}</td>
                    <td class="product-retail-price editable" data-field="retailPrice">$${product.retailPrice || 'N/A'}</td>
                    <td class="product-msrp editable" data-field="msrp">$${product.msrp || 'N/A'}</td>
                    <td class="product-cost editable" data-field="cost">$${product.cost || 'N/A'}</td>
                    <td class="product-category editable" data-field="category">${product.category}</td>
                    <td class="product-units editable" data-field="unitsPerCase">${product.unitsPerCase || 1}</td>
                    <td class="product-actions">
                        <button class="btn-small btn-edit" onclick="window.adminDashboard.editProduct('${product.id}')" title="Edit Product">
                            ✏️
                        </button>
                        <button class="btn-small btn-delete" onclick="window.adminDashboard.deleteProduct('${product.id}')" title="Delete Product">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add click listeners for inline editing
        this.setupInlineEditing();
        
        // Adjust modal height after table is rendered
        setTimeout(() => this.adjustModalHeight(), 100);
    }
    
    /**
     * Render error state for products table
     */
    renderProductsError() {
        const tbody = document.getElementById('products-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="error-row">
                        ❌ Failed to load products data. 
                        <button onclick="window.adminDashboard.loadProductsData()" class="btn btn-small">
                            Try Again
                        </button>
                    </td>
                </tr>
            `;
            
            // Adjust modal height after error is rendered
            setTimeout(() => this.adjustModalHeight(), 100);
        }
    }

    /**
     * Load tiers data from JSON file
     */
    async loadTiersData() {
        if (this.loadingTiers) return;
        this.loadingTiers = true;
        
        try {
            console.log('🔄 Loading tiers data...');
            const response = await fetch('data/tiers.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Convert object to array if needed
            if (Array.isArray(data)) {
                this.tiersData = data;
            } else {
                this.tiersData = Object.entries(data).map(([key, value]) => ({
                    id: key,
                    name: value.name,
                    threshold: value.threshold || value.minQuantity || 0,
                    margin: value.margin || value.discount || '0%',
                    description: value.description || '',
                    active: value.active !== false,
                    ...value
                }));
            }
            
            console.log('✅ Tiers data loaded:', this.tiersData);
            this.renderTiersTable();
            
        } catch (error) {
            console.error('❌ Error loading tiers:', error);
            this.renderTiersError();
        } finally {
            this.loadingTiers = false;
        }
    }

    /**
     * Load shipping data from JSON file
     */
    async loadShippingData() {
        if (this.loadingShipping) return;
        this.loadingShipping = true;
        
        try {
            console.log('🔄 Loading shipping data...');
            const response = await fetch('data/shipping.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Store full shipping data for ground rates access
            this.fullShippingData = data;
            
            // Convert zones object to array if needed
            if (data.zones) {
                this.shippingData = Object.entries(data.zones).map(([key, value]) => {
                    // Get ground shipping rates for this zone
                    const zoneNumber = value.zoneNumber || parseInt(key.replace('zone', ''));
                    const groundRates = this.extractGroundRates(data, zoneNumber);
                    
                    return {
                        id: key,
                        name: value.name,
                        ltlPercentage: value.ltlPercentage || 0,
                        states: value.states || [],
                        color: value.color || '#4CAF50',
                        active: value.active !== false,
                        zoneNumber: zoneNumber,
                        groundRates: groundRates,
                        ...value
                    };
                });
            } else if (Array.isArray(data)) {
                this.shippingData = data;
            } else {
                this.shippingData = Object.entries(data).map(([key, value]) => ({
                    id: key,
                    ...value
                }));
            }
            
            console.log('✅ Shipping data loaded:', this.shippingData);
            this.renderShippingTable();
            
        } catch (error) {
            console.error('❌ Error loading shipping:', error);
            this.renderShippingError();
        } finally {
            this.loadingShipping = false;
        }
    }

    /**
     * Extract ground shipping rates for a specific zone
     */
    extractGroundRates(shippingData, zoneNumber) {
        if (!shippingData.displayBoxShipping || !shippingData.displayBoxShipping.ranges) {
            return { '1-3': 0, '4-8': 0, '9-11': 0 };
        }
        
        const ranges = shippingData.displayBoxShipping.ranges;
        const zoneKey = `zone${zoneNumber}`;
        
        return {
            '1-3': ranges['1-3'][zoneKey] || 0,
            '4-8': ranges['4-8'][zoneKey] || 0,
            '9-11': ranges['9-11'][zoneKey] || 0
        };
    }

    /**
     * Render tiers section with table structure
     */
    renderTiersSection() {
        // Load tiers data and render table
        this.loadTiersData();
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3>Tier Management</h3>
                    <div class="action-bar">
                        <button class="btn btn-primary" onclick="window.adminDashboard.addNewTier()">
                            ➕ Add New Tier
                        </button>
                        <button class="btn btn-secondary" onclick="window.adminDashboard.exportTiers()">
                            📄 Export
                        </button>
                        <button class="btn btn-secondary" onclick="window.adminDashboard.loadTiersData()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Threshold</th>
                                <th>Margin</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tiers-table-body">
                            <tr><td colspan="7" class="loading-row">Loading tiers data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Refresh Copper metadata via backend and display summary
     */
    async refreshCopperMetadata() {
        const out = document.getElementById('copper-metadata-summary');
        try {
            if (out) out.textContent = 'Loading Copper metadata...';
            // Hit refresh endpoint to fetch and cache latest metadata
            const res = await fetch('/api/metadata/copper/refresh');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json();
            const data = payload?.data || payload;
            // Show concise summary
            const summary = {
                pipelines: data?.pipelines?.map(p => ({ id: p.id, name: p.name })) || [],
                stages: data?.stages?.map(s => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id })) || [],
                customFields: {
                    opportunity: data?.customFields?.opportunity?.map(f => ({ id: f.id, name: f.name, type: f.value_type })) || [],
                    company: data?.customFields?.company?.map(f => ({ id: f.id, name: f.name, type: f.value_type })) || []
                }
            };
            if (out) out.textContent = JSON.stringify(summary, null, 2);
            this.showNotification('Copper metadata refreshed', 'success');
        } catch (e) {
            console.error('Failed to refresh Copper metadata', e);
            if (out) out.textContent = `Error loading Copper metadata: ${e.message}`;
            this.showNotification('Failed to refresh Copper metadata', 'error');
        }
    }

    /**
     * Refresh ShipStation metadata via backend and display summary
     */
    async refreshShipStationMetadata() {
        const out = document.getElementById('shipstation-metadata-summary');
        try {
            if (out) out.textContent = 'Loading ShipStation metadata...';
            // Hit refresh endpoint to fetch and cache latest metadata
            const res = await fetch('/api/metadata/shipstation/refresh');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json();
            const data = payload?.data || payload;
            const summary = {
                stores: data?.stores?.map(s => ({ id: s.storeId || s.id, name: s.storeName || s.name })) || [],
                carriers: data?.carriers?.map(c => ({ code: c.code || c.carrierCode, name: c.name })) || [],
                servicesByCarrier: Object.keys(data?.servicesByCarrier || {})
            };
            if (out) out.textContent = JSON.stringify(summary, null, 2);
            this.showNotification('ShipStation metadata refreshed', 'success');
        } catch (e) {
            console.error('Failed to refresh ShipStation metadata', e);
            if (out) out.textContent = `Error loading ShipStation metadata: ${e.message}`;
            this.showNotification('Failed to refresh ShipStation metadata', 'error');
        }
    }

    /**
     * Load current ShipStation → Copper mapping and display
     */
    async loadCurrentMapping() {
        const out = document.getElementById('current-mapping-summary');
        try {
            if (out) out.textContent = 'Loading current mapping...';
            const res = await fetch('/api/mappings/shipstation-to-copper');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json();
            const mapping = payload?.data ?? payload;
            if (out) out.textContent = JSON.stringify(mapping, null, 2);
            this._currentMapping = mapping;
            this.showNotification('Mapping loaded', 'success');
        } catch (e) {
            console.error('Failed to load mapping', e);
            if (out) out.textContent = `Error loading mapping: ${e.message}`;
            this.showNotification('Failed to load mapping', 'error');
        }
    }

    /**
     * Validate ShipStation → Copper mapping against live metadata
     */
    async validateShipStationToCopperMapping() {
        const resultsEl = document.getElementById('mapping-validation-results');
        if (resultsEl) resultsEl.textContent = 'Validating...';
        try {
            // Ensure we have mapping and metadata
            const [mappingRes, copperRes] = await Promise.all([
                fetch('/api/mappings/shipstation-to-copper'),
                fetch('/api/metadata/copper')
            ]);
            if (!mappingRes.ok) throw new Error(`Mapping HTTP ${mappingRes.status}`);
            if (!copperRes.ok) throw new Error(`Copper HTTP ${copperRes.status}`);
            const mappingPayload = await mappingRes.json();
            const copperPayload = await copperRes.json();
            const mapping = mappingPayload?.data ?? mappingPayload;
            const copper = copperPayload?.data ?? copperPayload;

            const issues = [];
            const pipelines = new Map((copper?.pipelines || []).map(p => [String(p.id), p]));
            const stagesByPipeline = new Map();
            (copper?.stages || []).forEach(s => {
                const pid = String(s.pipeline_id);
                if (!stagesByPipeline.has(pid)) stagesByPipeline.set(pid, new Map());
                stagesByPipeline.get(pid).set(String(s.id), s);
            });
            const customFieldArray = [
                ...((copper?.customFields?.opportunity) || []),
                ...((copper?.customFields?.company) || [])
            ];
            const customFields = new Map(customFieldArray.map(f => [String(f.id), f]));

            const pipelineId = String(mapping?.opportunity?.pipelineId || '');
            const stageId = String(mapping?.opportunity?.stageId || '');
            if (!pipelineId || !pipelines.has(pipelineId)) {
                issues.push('Invalid or missing pipelineId');
            }
            if (!stageId || !stagesByPipeline.get(pipelineId)?.has(stageId)) {
                issues.push('Invalid or missing stageId for selected pipeline');
            }
            // Validate required custom field mappings if present
            const fieldMap = mapping?.fieldMap || {};
            Object.entries(fieldMap).forEach(([key, cfg]) => {
                const cfId = cfg?.copperFieldId != null ? String(cfg.copperFieldId) : '';
                if (cfId && !customFields.has(cfId)) {
                    issues.push(`Custom field not found for mapping key "${key}": ${cfId}`);
                }
            });

            if (resultsEl) {
                if (issues.length === 0) {
                    resultsEl.innerHTML = '<div class="status-ok">✅ Mapping looks valid.</div>';
                } else {
                    resultsEl.innerHTML = `
                        <div class="status-warning">⚠️ Issues found:</div>
                        <ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>
                    `;
                }
            }
        } catch (e) {
            console.error('Validation failed', e);
            if (resultsEl) resultsEl.textContent = `Validation error: ${e.message}`;
            this.showNotification('Mapping validation failed', 'error');
        }
    }

    /**
     * Open a simple JSON edit modal for the mapping
     */
    async openEditMappingModal() {
        try {
            if (!this._currentMapping) await this.loadCurrentMapping();
        } catch {}
        const mapping = this._currentMapping || { opportunity: {}, fieldMap: {} };
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modern-modal">
                <div class="modal-header">
                    <div class="modal-title-text">✏️ Edit ShipStation → Copper Mapping</div>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom:8px;">Edit the JSON mapping below. Ensure valid JSON.</p>
                    <textarea id="mapping-json-editor" style="width:100%; height:300px; font-family:monospace;">${
                        JSON.stringify(mapping, null, 2)
                    }</textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" id="save-mapping-btn">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const saveBtn = overlay.querySelector('#save-mapping-btn');
        saveBtn.onclick = async () => {
            try {
                const text = overlay.querySelector('#mapping-json-editor').value;
                const next = JSON.parse(text);
                await this.saveShipStationToCopperMapping(next);
                overlay.remove();
                await this.loadCurrentMapping();
            } catch (e) {
                alert(`Invalid JSON or save failed: ${e.message}`);
            }
        };
    }

    /**
     * Save mapping via backend
     */
    async saveShipStationToCopperMapping(mapping) {
        try {
            const res = await fetch('/api/mappings/shipstation-to-copper', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mapping)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json();
            this._currentMapping = payload?.data ?? mapping;
            this.showNotification('Mapping saved', 'success');
        } catch (e) {
            console.error('Failed to save mapping', e);
            this.showNotification('Failed to save mapping', 'error');
            throw e;
        }
    }

    /**
     * Initialize integration tab switching
     */
    initIntegrationTabs() {
        const tabs = Array.from(document.querySelectorAll('.integration-tabs .integration-tab'));
        const allPanels = Array.from(document.querySelectorAll('.integration-tab-content'));
        if (!tabs.length || !allPanels.length) return;

        const activate = (key) => {
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === key));
            allPanels.forEach(p => p.classList.toggle('active', p.id === `${key}-tab`));
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => activate(tab.dataset.tab));
        });

        // Ensure default selection
        const defaultKey = 'metadata';
        activate(defaultKey);
    }

    /**
     * Render shipping section with table structure
     */
    renderShippingSection() {
        // Load shipping data and render table
        this.loadShippingData();
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3>Shipping Zone Management</h3>
                    <div class="action-bar">
                        <button class="btn btn-primary" onclick="window.adminDashboard.addNewShippingZone()">
                            ➕ Add New Zone
                        </button>
                        <button class="btn btn-secondary" onclick="window.adminDashboard.exportShipping()">
                            📄 Export
                        </button>
                        <button class="btn btn-secondary" onclick="window.adminDashboard.loadShippingData()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="data-table shipping-table">
                        <thead>
                            <tr>
                                <th rowspan="2">ID</th>
                                <th rowspan="2">Name</th>
                                <th rowspan="2">LTL %</th>
                                <th colspan="3">Ground Shipping (per master case)</th>
                                <th rowspan="2">States</th>
                                <th rowspan="2">Color</th>
                                <th rowspan="2">Status</th>
                                <th rowspan="2">Actions</th>
                            </tr>
                            <tr>
                                <th class="ground-header">1-3 Cases</th>
                                <th class="ground-header">4-8 Cases</th>
                                <th class="ground-header">9-11 Cases</th>
                            </tr>
                        </thead>
                        <tbody id="shipping-table-body">
                            <tr><td colspan="10" class="loading-row">Loading shipping data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render tiers table with data
     */
    renderTiersTable(tiers) {
        const tbody = document.getElementById('tiers-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = tiers.map(tier => `
            <tr data-tier-id="${tier.id}">
                <td class="tier-id">${tier.id}</td>
                <td class="tier-name editable" data-field="name">${tier.name}</td>
                <td class="tier-min-qty editable" data-field="minQuantity">${tier.minQuantity}</td>
                <td class="tier-discount editable" data-field="discount">${(tier.discount * 100).toFixed(1)}%</td>
                <td class="tier-description editable" data-field="description">${tier.description || ''}</td>
                <td class="tier-status">
                    <span class="status-badge status-active">✓ Active</span>
                </td>
                <td class="tier-actions">
                    <button class="btn-small btn-edit" onclick="window.adminDashboard.editTier('${tier.id}')" title="Edit Tier">
                        ✏️
                    </button>
                    <button class="btn-small btn-toggle" onclick="window.adminDashboard.toggleTierStatus('${tier.id}')" title="Toggle Status">
                        ⏸️
                    </button>
                    <button class="btn-small btn-delete" onclick="window.adminDashboard.deleteTier('${tier.id}')" title="Delete Tier">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Add click listeners for inline editing
        this.setupInlineEditing();
        
        // Adjust modal height after table is rendered
        setTimeout(() => this.adjustModalHeight(), 100);
    }

    /**
     * Render shipping table with data
     */
    renderShippingTable(zones) {
        const tbody = document.getElementById('shipping-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = zones.map(zone => {
            const groundRates = zone.groundRates || { '1-3': 0, '4-8': 0, '9-11': 0 };
            const statesDisplay = Array.isArray(zone.states) ? zone.states.join(', ') : zone.states;
            const statesShort = statesDisplay.length > 50 ? statesDisplay.substring(0, 50) + '...' : statesDisplay;
            
            return `
                <tr data-zone-id="${zone.id}">
                    <td class="zone-id">${zone.id}</td>
                    <td class="zone-name editable" data-field="name">${zone.name}</td>
                    <td class="zone-ltl editable" data-field="ltlPercentage">${zone.ltlPercentage}%</td>
                    <td class="ground-rate editable" data-field="ground1-3" data-zone="${zone.zoneNumber}">$${groundRates['1-3']}</td>
                    <td class="ground-rate editable" data-field="ground4-8" data-zone="${zone.zoneNumber}">$${groundRates['4-8']}</td>
                    <td class="ground-rate editable" data-field="ground9-11" data-zone="${zone.zoneNumber}">$${groundRates['9-11']}</td>
                    <td class="zone-states" title="${statesDisplay}">${statesShort}</td>
                    <td class="zone-color">
                        <div class="color-indicator" style="background-color: ${zone.color}; width: 20px; height: 20px; border-radius: 3px; display: inline-block;"></div>
                    </td>
                    <td class="zone-status">
                        <span class="status-badge status-active">✓ Active</span>
                    </td>
                    <td class="zone-actions">
                        <button class="btn-small btn-edit" onclick="window.adminDashboard.editShippingZone('${zone.id}')" title="Edit Zone">
                            ✏️
                        </button>
                        <button class="btn-small btn-toggle" onclick="window.adminDashboard.toggleShippingZoneStatus('${zone.id}')" title="Toggle Status">
                            ⏸️
                        </button>
                        <button class="btn-small btn-delete" onclick="window.adminDashboard.deleteShippingZone('${zone.id}')" title="Delete Zone">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add click listeners for inline editing
        this.setupInlineEditing();
        
        // Adjust modal height after table is rendered
        setTimeout(() => this.adjustModalHeight(), 100);
    }

    /**
     * Render error state for tiers table
     */
    renderTiersError() {
        const tbody = document.getElementById('tiers-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="error-row">
                        ❌ Failed to load tiers data. 
                        <button onclick="window.adminDashboard.loadTiersData()" class="btn btn-small">
                            Try Again
                        </button>
                    </td>
                </tr>
            `;
            
            // Adjust modal height after error is rendered
            setTimeout(() => this.adjustModalHeight(), 100);
        }
    }

    /**
     * Render error state for shipping table
     */
    renderShippingError() {
        const tbody = document.getElementById('shipping-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="error-row">
                        ❌ Failed to load shipping data. 
                        <button onclick="window.adminDashboard.loadShippingData()" class="btn btn-small">
                            Try Again
                        </button>
                    </td>
                </tr>
            `;
            
            // Adjust modal height after error is rendered
            setTimeout(() => this.adjustModalHeight(), 100);
        }
    }

    /**
     * Setup inline editing for data tables
     */
    setupInlineEditing() {
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                this.startInlineEdit(e.target);
            });
        });
    }

    /**
     * Start inline editing for a cell
     */
    startInlineEdit(cell) {
        if (cell.classList.contains('editing')) return;
        
        const originalValue = cell.textContent.replace('$', '');
        const field = cell.dataset.field;
        
        cell.classList.add('editing');
        cell.innerHTML = `
            <input type="text" 
                   value="${originalValue}" 
                   class="inline-edit-input"
                   data-original="${originalValue}"
                   onblur="window.adminDashboard.finishInlineEdit(this)"
                   onkeydown="window.adminDashboard.handleInlineEditKey(event, this)">
        `;
        
        const input = cell.querySelector('input');
        input.focus();
        input.select();
    }

    /**
     * Handle keyboard events in inline edit
     */
    handleInlineEditKey(event, input) {
        if (event.key === 'Enter') {
            this.finishInlineEdit(input);
        } else if (event.key === 'Escape') {
            this.cancelInlineEdit(input);
        }
    }

    /**
     * Finish inline editing
     */
    finishInlineEdit(input) {
        const cell = input.parentElement;
        const newValue = input.value;
        const originalValue = input.dataset.original;
        const field = cell.dataset.field;
        const row = cell.closest('tr');
        const productId = row.dataset.productId;
        const zoneId = row.dataset.zoneId;
        
        if (newValue !== originalValue) {
            // Save the change based on field type
            if (field.startsWith('ground')) {
                // Handle ground shipping rate changes
                const zoneNumber = cell.dataset.zone;
                this.saveGroundShippingRate(zoneId, field, newValue, zoneNumber);
            } else if (productId) {
                // Handle product field changes
                this.saveProductField(productId, field, newValue);
            } else if (zoneId) {
                // Handle shipping zone field changes
                this.saveShippingField(zoneId, field, newValue);
            }
            
            // Update display
            let displayValue = newValue;
            if (field === 'price' || field === 'msrp' || field === 'cost' || field.startsWith('ground')) {
                displayValue = `$${newValue}`;
            } else if (field === 'ltlPercentage') {
                displayValue = `${newValue}%`;
            }
            
            cell.innerHTML = displayValue;
            cell.classList.add('field-updated');
            
            // Remove the updated class after animation
            setTimeout(() => {
                cell.classList.remove('field-updated');
            }, 2000);
        } else {
            const needsDollar = field.includes('price') || field.includes('msrp') || field.includes('cost') || field.startsWith('ground');
            const needsPercent = field === 'ltlPercentage';
            
            let displayValue = originalValue;
            if (needsDollar) displayValue = `$${originalValue}`;
            else if (needsPercent) displayValue = `${originalValue}%`;
            
            cell.innerHTML = displayValue;
        }
        
        cell.classList.remove('editing');
    }

    /**
     * Cancel inline editing
     */
    cancelInlineEdit(input) {
        const cell = input.parentElement;
        const originalValue = input.dataset.original;
        const field = cell.dataset.field;
        
        const needsDollar = field.includes('price') || field.includes('msrp') || field.includes('cost') || field.startsWith('ground');
        const needsPercent = field === 'ltlPercentage';
        
        let displayValue = originalValue;
        if (needsDollar) displayValue = `$${originalValue}`;
        else if (needsPercent) displayValue = `${originalValue}%`;
        
        cell.innerHTML = displayValue;
        cell.classList.remove('editing');
    }

    /**
     * Save product field change
     */
    async saveProductField(productId, field, value) {
        try {
            console.log(`💾 Saving ${field} = ${value} for product ${productId}`);
            
            // Here you would typically make an API call to save the data
            // For now, we'll just show a success message
            
            const notification = document.createElement('div');
            notification.className = 'save-notification';
            notification.innerHTML = `✅ ${field} updated for product ${productId}`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
            
        } catch (error) {
            console.error('Error saving product field:', error);
            alert(`❌ Failed to save ${field} change`);
        }
    }
    
    /**
     * Save shipping field change
     */
    async saveShippingField(zoneId, field, value) {
        try {
            console.log(`💾 Saving shipping ${field} = ${value} for zone ${zoneId}`);
            
            // Update the shipping data in memory
            const zone = this.shippingData.find(z => z.id === zoneId);
            if (zone) {
                if (field === 'ltlPercentage') {
                    zone.ltlPercentage = parseFloat(value);
                } else {
                    zone[field] = value;
                }
            }
            
            // Save to server (implement actual API call)
            await this.saveShippingDataToServer();
            
            const notification = document.createElement('div');
            notification.className = 'save-notification';
            notification.innerHTML = `✅ ${field} updated for ${zoneId}`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
            
        } catch (error) {
            console.error('Error saving shipping field:', error);
            alert(`❌ Failed to save ${field} change`);
        }
    }
    
    /**
     * Save ground shipping rate change
     */
    async saveGroundShippingRate(zoneId, field, value, zoneNumber) {
        try {
            console.log(`💾 Saving ground shipping ${field} = $${value} for zone ${zoneNumber}`);
            
            // Parse the field to get the range (e.g., 'ground1-3' -> '1-3')
            const range = field.replace('ground', '').replace('-', '-');
            const zoneKey = `zone${zoneNumber}`;
            
            // Update the full shipping data structure
            if (this.fullShippingData && this.fullShippingData.displayBoxShipping) {
                if (!this.fullShippingData.displayBoxShipping.ranges[range]) {
                    this.fullShippingData.displayBoxShipping.ranges[range] = {};
                }
                this.fullShippingData.displayBoxShipping.ranges[range][zoneKey] = parseFloat(value);
            }
            
            // Update the zone data in memory
            const zone = this.shippingData.find(z => z.id === zoneId);
            if (zone && zone.groundRates) {
                zone.groundRates[range] = parseFloat(value);
            }
            
            // Save to server (implement actual API call)
            await this.saveShippingDataToServer();
            
            const notification = document.createElement('div');
            notification.className = 'save-notification';
            notification.innerHTML = `✅ Ground shipping rate updated for ${range} cases in ${zoneId}`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
            
        } catch (error) {
            console.error('Error saving ground shipping rate:', error);
            alert(`❌ Failed to save ground shipping rate`);
        }
    }
    
    /**
     * Save shipping data to server
     */
    async saveShippingDataToServer() {
        try {
            const response = await fetch('/api/save-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file: 'shipping.json',
                    data: this.fullShippingData
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('✅ Shipping data saved to server');
            
        } catch (error) {
            console.error('❌ Error saving shipping data to server:', error);
        }
    }

    /**
     * Show product edit modal with Firebase data loading
     */
    async showProductEditModal(productId = null) {
    try {
        const response = await fetch('/api/save-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: 'shipping.json',
                data: this.fullShippingData
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log(' Shipping data saved to server');

    } catch (error) {
        console.error(' Error saving shipping data to server:', error);
        throw error;
    }
}

/**
 * Show product edit modal
 */
async showProductEditModal(productId = null) {
    const isEdit = productId !== null;
    const title = isEdit ? `Edit Product ${productId}` : 'Add New Product';

    // Get existing product data from Firebase if editing
    let productData = {};
    if (isEdit) {
        try {
            console.log(` Loading product data from Firebase for edit: ${productId}`);

            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }

            // Load product data from Firebase
            const firebaseProduct = await window.firebaseDataService.getDocument(`products/${productId}`);

            if (firebaseProduct && Object.keys(firebaseProduct).length > 0) {
                productData = {
                    id: productId,
                    name: firebaseProduct.name || '',
                    price: firebaseProduct.price || 0,
                    msrp: firebaseProduct.msrp || 0,
                    cost: firebaseProduct.cost || 0,
                    category: firebaseProduct.category || '',
                    unitsPerCase: firebaseProduct.unitsPerCase || 1,
                    retailPrice: firebaseProduct.retailPrice || 0
                };
                console.log(' Product data loaded from Firebase:', productData);
            } else {
                throw new Error(`Product ${productId} not found in Firebase`);
            }
        } catch (error) {
            console.error(' Error loading product data from Firebase:', error);
            this.showNotification(`Failed to load product data: ${error.message}`, 'error');
            return; // Don't show modal if we can't load data
        }
    }

    const modalHTML = `
        <div class="modal-overlay">
            <div class="product-edit-modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form class="product-form" onsubmit="return false;">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Product Name:</label>
                                <input type="text" name="name" value="${productData.name || ''}" required>
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form class="product-form" onsubmit="return false;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Product Name:</label>
                                    <input type="text" name="name" value="${productData.name || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>Category:</label>
                                    <select name="category" required>
                                        <option value="">Select Category</option>
                                        <option value="2oz_wellness" ${productData.category === '2oz_wellness' ? 'selected' : ''}>2oz Wellness</option>
                                        <option value="energy_shots" ${productData.category === 'energy_shots' ? 'selected' : ''}>Energy Shots</option>
                                        <option value="extract_shots" ${productData.category === 'extract_shots' ? 'selected' : ''}>Extract Shots</option>
                                        <option value="accessories" ${productData.category === 'accessories' ? 'selected' : ''}>Accessories</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Price ($):</label>
                                    <input type="number" name="price" step="0.01" value="${productData.price || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>MSRP ($):</label>
                                    <input type="number" name="msrp" step="0.01" value="${productData.msrp || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Cost ($):</label>
                                    <input type="number" name="cost" step="0.01" value="${productData.cost || ''}">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Units per Case:</label>
                                    <input type="number" name="unitsPerCase" value="${productData.unitsPerCase || 1}" min="1">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button class="btn btn-primary" onclick="window.adminDashboard.saveProductForm('${productId || ''}')">
                            ${isEdit ? 'Update Product' : 'Add Product'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Focus first input
        setTimeout(() => {
            const firstInput = document.querySelector('.product-edit-modal input[name="name"]');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * Save product form data
     */
    async saveProductForm(productId) {
        const form = document.querySelector('.product-form');
        const formData = new FormData(form);
        
        const productData = {
            name: formData.get('name'),
            category: formData.get('category'),
            price: parseFloat(formData.get('price')),
            msrp: parseFloat(formData.get('msrp')) || 0,
            cost: parseFloat(formData.get('cost')) || 0,
            unitsPerCase: parseInt(formData.get('unitsPerCase')) || 1
        };
        
        try {
            // Load current products data
            const response = await fetch('data/products.json');
            if (!response.ok) throw new Error('Failed to load products data');
            
            const productsData = await response.json();
            
            if (productId) {
                // Update existing product
                if (productsData[productId]) {
                    Object.assign(productsData[productId], productData);
                } else {
                    throw new Error(`Product ${productId} not found`);
                }
            } else {
                // Add new product - generate ID from name
                const newId = productData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                productsData[newId] = productData;
            }
            
            // Save to backend
            const saveResult = await this.saveDataToGit('products.json', productsData);
            
            if (saveResult.success) {
                this.showNotification(productId ? 'Product updated successfully' : 'Product added successfully', 'success');
                
                // Close modal
                document.querySelector('.modal-overlay').remove();
                
                // Refresh products data
                this.loadProductsData();
                
                // Refresh frontend data if calculator exists
                this.refreshFrontendData();
            } else {
                throw new Error(saveResult.message || 'Failed to save product');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            this.showNotification(`Failed to save product: ${error.message}`, 'error');
        }
    }

    /**
     * Edit product in modal
     */
    editProduct(productId) {
        console.log(`✏️ Editing product ${productId}`);
        
        // Create and show edit modal
        this.showProductEditModal(productId);
    }
    

    
    /**
     * Delete product
     */
    deleteProduct(productId) {
        if (confirm(`⚠️ Are you sure you want to delete product ${productId}?\n\nThis action cannot be undone.`)) {
            console.log(`🗑️ Deleting product ${productId}`);
            
            const row = document.querySelector(`tr[data-product-id="${productId}"]`);
            if (row) {
                row.style.opacity = '0.5';
                row.style.transform = 'scale(0.95)';
                
                setTimeout(() => {
                    row.remove();
                    this.showNotification(`Product ${productId} deleted successfully`, 'success');
                }, 300);
            }
        }
    }
    
    /**
     * Add new product
     */
    addNewProduct() {
        console.log('➕ Adding new product');
        this.showProductEditModal();
    }
    
    /**
     * Refresh products data
     */
    refreshProductsData() {
        console.log('🔄 Refreshing products data');
        this.loadProductsData();
        this.showNotification('Products data refreshed', 'info');
    }
    
    /**
     * Export products data
     */
    exportProductsData() {
        console.log('📄 Exporting products data');
        
        // Get table data
        const table = document.getElementById('products-table');
        if (table) {
            const data = this.tableToCSV(table);
            this.downloadCSV(data, 'kanva-products.csv');
            this.showNotification('Products data exported', 'success');
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `admin-notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Render tiers section
     */
    renderTiersSection() {
        // Load tiers data and render table
        this.loadTiersData();
        
        return `
            <div class="card">
                <h3>📊 Tier Management</h3>
                <div class="admin-actions">
                    <button class="btn btn-primary" onclick="window.adminDashboard.addNewTier()">
                        <span class="icon">➕</span> Add New Tier
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshTiersData()">
                        <span class="icon">🔄</span> Refresh
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.exportTiersData()">
                        <span class="icon">📄</span> Export CSV
                    </button>
                </div>
                <div class="table-container">
                    <table id="tiers-table" class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Min Quantity</th>
                                <th>Discount %</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tiers-table-body">
                            <tr><td colspan="7" class="loading-row">Loading tiers data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render shipping section
     */
    renderShippingSection() {
        // Load shipping data and render table
        this.loadShippingData();
        
        return `
            <div class="card">
                <h3>🚚 Shipping Management</h3>
                <div class="admin-actions">
                    <button class="btn btn-primary" onclick="window.adminDashboard.addNewShippingZone()">
                        <span class="icon">➕</span> Add New Zone
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshShippingData()">
                        <span class="icon">🔄</span> Refresh
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.exportShippingData()">
                        <span class="icon">📄</span> Export CSV
                    </button>
                </div>
                <div class="table-container">
                    <table id="shipping-table" class="data-table">
                        <thead>
                            <tr>
                                <th>Zone ID</th>
                                <th>Zone Name</th>
                                <th>LTL Rate %</th>
                                <th>States</th>
                                <th>Color</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="shipping-table-body">
                            <tr><td colspan="7" class="loading-row">Loading shipping data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render integrations section
     */
    renderIntegrationsSection() {
        // Set a timeout to adjust modal height after rendering
        setTimeout(() => this.adjustModalHeight(), 100);
        setTimeout(() => this.initIntegrationTabs(), 200);
        setTimeout(() => this.populateConnectionForms(), 300);
        
        return `
            <div class="integrations-section">
                <div class="section-header">
                    <h2>🔗 Integrations</h2>
                    <button class="btn btn-accent" onclick="window.adminDashboard.runIntegrationValidation()">
                        🔍 Validate All Integrations
                    </button>
                </div>
                
                <div class="integration-tabs">
                    <div class="integration-tab active" data-tab="metadata">🗂️ Metadata & Mapping</div>
                    <div class="integration-tab" data-tab="copper">🥇 Copper CRM</div>
                    <div class="integration-tab" data-tab="ringcentral">📞 RingCentral</div>
                    <div class="integration-tab" data-tab="shipstation">🚢 ShipStation</div>
                    <div class="integration-tab" data-tab="fishbowl">🐟 Fishbowl ERP</div>
                </div>
                
                <div class="integration-cards">
                    <!-- Metadata & Mapping -->
                    <div class="integration-tab-content active" id="metadata-tab">
                        <div class="integration-card">
                            <div class="integration-header">
                                <h3>🗂️ Metadata & Mapping</h3>
                            </div>
                            <div class="integration-content">
                                <p>Fetch live metadata from Copper CRM and ShipStation. Configure and validate the ShipStation → Copper mapping.</p>
                                <div class="metadata-actions" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshCopperMetadata()">🔄 Refresh Copper Metadata</button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshShipStationMetadata()">🔄 Refresh ShipStation Metadata</button>
                                    <button class="btn" onclick="window.adminDashboard.loadCurrentMapping()">📥 Load Current Mapping</button>
                                    <button class="btn" onclick="window.adminDashboard.validateShipStationToCopperMapping()">✅ Validate Mapping</button>
                                    <button class="btn btn-primary" onclick="window.adminDashboard.openEditMappingModal()">✏️ Edit Mapping</button>
                                </div>
                                <div class="metadata-summary" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                    <div class="card">
                                        <div class="card-header"><h4>Copper Metadata</h4></div>
                                        <div class="card-body"><pre id="copper-metadata-summary" style="white-space:pre-wrap; word-break:break-word;">No data yet.</pre></div>
                                    </div>
                                    <div class="card">
                                        <div class="card-header"><h4>ShipStation Metadata</h4></div>
                                        <div class="card-body"><pre id="shipstation-metadata-summary" style="white-space:pre-wrap; word-break:break-word;">No data yet.</pre></div>
                                    </div>
                                </div>
                                <div class="card" style="margin-top:12px;">
                                    <div class="card-header"><h4>Current Mapping</h4></div>
                                    <div class="card-body"><pre id="current-mapping-summary" style="white-space:pre-wrap; word-break:break-word;">No mapping loaded.</pre></div>
                                </div>
                                <div class="card" style="margin-top:12px;">
                                    <div class="card-header"><h4>Validation</h4></div>
                                    <div class="card-body"><div id="mapping-validation-results">Not validated.</div></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Copper CRM Integration -->
                    <div class="integration-tab-content" id="copper-tab">
                        <div class="integration-card">
                            <div class="integration-header">
                                <h3>🥇 Copper CRM Integration</h3>
                                <div class="integration-status" id="copper-status">
                                    <span class="status-indicator status-unknown">❓</span>
                                    <span>Not Tested</span>
                                </div>
                            </div>
                            <div class="integration-content">
                                <p>Configure Copper CRM API credentials to enable customer data auto-population and activity logging.</p>
                                <div class="form-group">
                                    <label>API Key:</label>
                                    <input type="password" id="copper-api-key" placeholder="Enter Copper API key" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Email Address:</label>
                                    <input type="email" id="copper-email" placeholder="Enter Copper user email" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Environment:</label>
                                    <select id="copper-environment" class="form-control">
                                        <option value="production">Production</option>
                                        <option value="sandbox">Sandbox</option>
                                    </select>
                                </div>
                                <hr/>
                                <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                    <div class="form-group">
                                        <label>Activity Type ID:</label>
                                        <input type="number" id="copper-activity-type-id" placeholder="e.g. 1" class="form-control">
                                    </div>
                                    <div class="form-group">
                                        <label>Default Owner User ID:</label>
                                        <input type="number" id="copper-assign-user-id" placeholder="e.g. 12345" class="form-control">
                                    </div>
                                </div>
                                <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                    <div class="form-group">
                                        <label>Phone Match Strategy:</label>
                                        <select id="copper-phone-strategy" class="form-control">
                                            <option value="e164">E.164 (recommended)</option>
                                            <option value="any">Any substring</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Default Country (for 10-digit):</label>
                                        <input type="text" id="copper-default-country" placeholder="US" class="form-control">
                                    </div>
                                </div>
                                <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                    <div class="form-group">
                                        <label>Task Default Status:</label>
                                        <input type="text" id="copper-task-status" placeholder="Completed" class="form-control">
                                    </div>
                                    <div class="form-group">
                                        <label>Task Due Offset (minutes):</label>
                                        <input type="number" id="copper-task-due-offset" placeholder="60" class="form-control">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Activity Custom Fields (JSON map of label -> definitionId):</label>
                                    <textarea id="copper-activity-custom-fields-json" class="form-control" placeholder='{"Session ID": 1111, "Recording URL": 2222}'></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Task Custom Fields (JSON map of label -> definitionId):</label>
                                    <textarea id="copper-task-custom-fields-json" class="form-control" placeholder='{"Outcome": 3333}'></textarea>
                                </div>
                                <div class="integration-features">
                                    <div class="feature-item">
                                        <span class="feature-icon">👥</span>
                                        <span>Customer Auto-Population</span>
                                    </div>
                                    <div class="feature-item">
                                        <span class="feature-icon">💾</span>
                                        <span>Quote Activity Logging</span>
                                    </div>
                                    <div class="feature-item">
                                        <span class="feature-icon">📧</span>
                                        <span>Email Activity Tracking</span>
                                    </div>
                                </div>
                                <div class="integration-actions">
                                    <button class="btn btn-primary" onclick="window.adminDashboard.testCopperIntegration()">
                                        🧪 Test Connection
                                    </button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.saveCopperSettings()">
                                        💾 Save Settings
                                    </button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.viewCopperLogs()">
                                        📔 View Activity Logs
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- RingCentral Integration -->
                    <div class="integration-tab-content" id="ringcentral-tab">
                        <div class="integration-card">
                            <div class="integration-header">
                                <h3>📞 RingCentral Integration</h3>
                                <div class="integration-status" id="ringcentral-status">
                                    <span class="status-indicator status-unknown">❓</span>
                                    <span>Not Configured</span>
                                </div>
                            </div>
                            <div class="integration-content">
                                <p>Configure RingCentral OAuth and verify Hosting endpoints. Keep Cloud Run private; use Hosting rewrites.</p>
                                <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                    <div class="form-group">
                                        <label>Environment:</label>
                                        <select id="ringcentral-environment" class="form-control">
                                            <option value="production">Production</option>
                                            <option value="sandbox">Sandbox</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Client ID:</label>
                                        <input type="text" id="ringcentral-client-id" placeholder="RC App Client ID" class="form-control">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Client Secret:</label>
                                    <input type="password" id="ringcentral-client-secret" placeholder="RC App Client Secret (stored securely)" class="form-control">
                                    <small style="color:#6c757d;">Stored only in server .env. Not displayed once saved.</small>
                                </div>
                                <div class="form-group">
                                    <label>Redirect URI:</label>
                                    <input type="text" id="ringcentral-redirect-uri" placeholder="${window.location.origin}/rc/auth/callback" class="form-control">
                                </div>
                                <div class="card" style="margin:8px 0;">
                                    <div class="card-body" style="font-size:13px; line-height:1.6;">
                                        <div><strong>Auth Start:</strong> <code>https://kanvaportal.web.app/rc/auth/start</code></div>
                                        <div><strong>Status:</strong> <code>https://kanvaportal.web.app/rc/status</code></div>
                                        <div><strong>Webhook:</strong> <code>https://kanvaportal.web.app/rc/webhook</code></div>
                                        <div><strong>Widget URL:</strong> <code>https://kanvaportal.web.app/standalone-dialer.html</code></div>
                                    </div>
                                </div>
                                <div class="integration-actions">
                                    <button class="btn btn-primary" onclick="window.adminDashboard.startRingCentralOAuth()">🔐 Start OAuth</button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.viewRingCentralStatus()">🩺 View Status</button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.sendRingCentralTestWebhook()">📤 Send Test Webhook</button>
                                    <button class="btn" onclick="window.adminDashboard.saveRingCentralSettings()">💾 Save Settings</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- ShipStation Integration -->
                    <div class="integration-tab-content" id="shipstation-tab">
                        <div class="integration-card">
                            <div class="integration-header">
                                <h3>🚢 ShipStation Integration</h3>
                                <div class="integration-status" id="shipstation-status">
                                    <span class="status-indicator status-unknown">❓</span>
                                    <span>Not Tested</span>
                                </div>
                            </div>
                            <div class="integration-content">
                                <p>Connect to ShipStation to enable automated shipping label generation and order fulfillment.</p>
                                <div class="form-group">
                                    <label>API Key:</label>
                                    <input type="password" id="shipstation-api-key" placeholder="Enter ShipStation API key" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>API Secret:</label>
                                    <input type="password" id="shipstation-api-secret" placeholder="Enter ShipStation API secret" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Environment:</label>
                                    <select id="shipstation-environment" class="form-control">
                                        <option value="production">Production</option>
                                        <option value="sandbox">Sandbox</option>
                                    </select>
                                </div>
                                <div class="integration-features">
                                    <div class="feature-item">
                                        <span class="feature-icon">🏷️</span>
                                        <span>Shipping Label Generation</span>
                                    </div>
                                    <div class="feature-item">
                                        <span class="feature-icon">📦</span>
                                        <span>Order Fulfillment</span>
                                    </div>
                                    <div class="feature-item">
                                        <span class="feature-icon">🚚</span>
                                        <span>Tracking Updates</span>
                                    </div>
                                    <div class="feature-item">
                                        <span class="feature-icon">💰</span>
                                        <span>Rate Calculation</span>
                                    </div>
                                </div>
                                <div class="integration-actions">
                                    <button class="btn btn-primary" onclick="window.adminDashboard.testShipStationIntegration()">
                                        🧪 Test Connection
                                    </button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.saveShipStationSettings()">
                                        💾 Save Settings
                                    </button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.viewShipStationOrders()">
                                        📋 View Orders
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Fishbowl ERP Integration -->
                    <div class="integration-tab-content" id="fishbowl-tab">
                        <div class="integration-card">
                            <div class="integration-header">
                                <h3>🐟 Fishbowl ERP Integration</h3>
                                <div class="integration-status" id="fishbowl-status">
                                    <span class="status-indicator status-unknown">❓</span>
                                    <span>Not Tested</span>
                                </div>
                            </div>
                            <div class="integration-content">
                                <p>Configure Fishbowl ERP connection to enable inventory synchronization and order management.</p>
                                <div class="form-group">
                                    <label>Host:</label>
                                    <input type="text" id="fishbowl-host" placeholder="Fishbowl server hostname or IP" value="localhost" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Port:</label>
                                    <input type="text" id="fishbowl-port" placeholder="Fishbowl server port" value="28192" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Username:</label>
                                    <input type="text" id="fishbowl-username" placeholder="Fishbowl username" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Password:</label>
                                    <input type="password" id="fishbowl-password" placeholder="Fishbowl password" class="form-control">
                                </div>
                                <div class="integration-features">
                                    <div class="feature-item">
                                        <span class="feature-icon">📦</span>
                                        <span>Product Inventory Sync</span>
                                    </div>
                                    <div class="feature-item">
                                        <span class="feature-icon">💰</span>
                                        <span>Real-time Pricing</span>
                                    </div>
                                    <div class="feature-item">
                                        <span class="feature-icon">📈</span>
                                        <span>Order Management</span>
                                    </div>
                                </div>
                                <div class="integration-actions">
                                    <button class="btn btn-primary" onclick="window.adminDashboard.testFishbowlIntegration()">
                                        🧪 Test Connection
                                    </button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.saveFishbowlSettings()">
                                        💾 Save Settings
                                    </button>
                                    <button class="btn btn-secondary" onclick="window.adminDashboard.syncFishbowlData()">
                                        🔄 Sync Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="integration-validation-results" class="validation-results" style="display: none;">
                    <!-- Validation results will be displayed here -->
                </div>
            </div>
        `;
    }

    /**
     * Render tiers table
     */
    renderTiersTable() {
        const tableBody = document.getElementById('tiers-table-body');
        if (!tableBody) return;
        
        if (!this.tiersData || this.tiersData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="no-data-row">No tiers data available</td></tr>';
            return;
        }
        
        const rows = this.tiersData.map(tier => `
            <tr>
                <td>${tier.id}</td>
                <td class="editable" data-field="name" data-id="${tier.id}">${tier.name || ''}</td>
                <td class="editable" data-field="minQuantity" data-id="${tier.id}">${tier.minQuantity || tier.threshold || 0}</td>
                <td class="editable" data-field="discount" data-id="${tier.id}">${tier.discount || 0}%</td>
                <td class="editable" data-field="description" data-id="${tier.id}">${tier.description || ''}</td>
                <td>
                    <span class="status-badge ${tier.active ? 'active' : 'inactive'}">
                        ${tier.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.editTier('${tier.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.adminDashboard.deleteTier('${tier.id}')">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = rows;
    }
    
    /**
     * Render shipping table
     */
    renderShippingTable() {
        const tableBody = document.getElementById('shipping-table-body');
        if (!tableBody) return;
        
        if (!this.shippingData || this.shippingData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="no-data-row">No shipping data available</td></tr>';
            return;
        }
        
        const rows = this.shippingData.map(zone => `
            <tr>
                <td>${zone.id}</td>
                <td class="editable" data-field="name" data-id="${zone.id}">${zone.name || ''}</td>
                <td class="editable" data-field="ltlPercentage" data-id="${zone.id}">${zone.ltlPercentage || 0}%</td>
                <td class="editable" data-field="states" data-id="${zone.id}">${Array.isArray(zone.states) ? zone.states.join(', ') : zone.states || ''}</td>
                <td>
                    <span class="color-indicator" style="background-color: ${zone.color || '#4CAF50'};"></span>
                    ${zone.color || '#4CAF50'}
                </td>
                <td>
                    <span class="status-badge ${zone.active ? 'active' : 'inactive'}">
                        ${zone.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.editShippingZone('${zone.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.adminDashboard.deleteShippingZone('${zone.id}')">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = rows;
    }
    
    // =====================================
    // DATA LOADING METHODS
    // =====================================

    /**
     * Load tiers data from Firebase
     */
    async loadTiersData() {
        try {
            console.log('📊 Loading tiers data from Firebase...');
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            // Get tiers data from Firebase
            const tiersData = await window.firebaseDataService.getDocument('pricing/tiers');
            
            if (tiersData && Object.keys(tiersData).length > 0) {
                // Convert object to array format expected by render method
                this.tiersData = Object.entries(tiersData).map(([id, tier]) => ({
                    id,
                    ...tier
                }));
                
                console.log('✅ Tiers data loaded:', this.tiersData);
                this.renderTiersTable(this.tiersData);
            } else {
                console.log('ℹ️ No tiers data found');
                this.tiersData = [];
                this.renderTiersTable([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading tiers data:', error);
            this.renderTiersError();
        }
    }

    /**
     * Load shipping data from Firebase
     */
    async loadShippingData() {
        try {
            console.log('🚚 Loading shipping data from Firebase...');
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            // Get shipping data from Firebase
            const shippingData = await window.firebaseDataService.getDocument('shipping/config');
            
            if (shippingData && shippingData.zones && Object.keys(shippingData.zones).length > 0) {
                // Convert zones object to array format expected by render method
                this.shippingData = Object.entries(shippingData.zones).map(([id, zone]) => ({
                    id,
                    ...zone
                }));
                
                console.log('✅ Shipping data loaded:', this.shippingData);
                this.renderShippingTable(this.shippingData);
            } else {
                console.log('ℹ️ No shipping data found');
                this.shippingData = [];
                this.renderShippingTable([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading shipping data:', error);
            this.renderShippingError();
        }
    }

    /**
     * Refresh tiers data
     */
    refreshTiersData() {
        console.log('🔄 Refreshing tiers data...');
        if (window.firebaseDataService) {
            window.firebaseDataService.clearCache();
        }
        this.loadTiersData();
    }

    /**
     * Refresh shipping data
     */
    refreshShippingData() {
        console.log('🔄 Refreshing shipping data...');
        if (window.firebaseDataService) {
            window.firebaseDataService.clearCache();
        }
        this.loadShippingData();
    }

    /**
     * Render tiers error
     */
    renderTiersError() {
        const tableBody = document.getElementById('tiers-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    <div class="error-message">
                        <span class="error-icon">❌</span>
                        Failed to load tiers data
                        <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.loadTiersData()" style="margin-left: 10px;">
                            🔄 Try Again
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    /**
     * Render shipping error
     */
    renderShippingError() {
        const tableBody = document.getElementById('shipping-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    <div class="error-message">
                        <span class="error-icon">❌</span>
                        Failed to load shipping data
                        <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.loadShippingData()" style="margin-left: 10px;">
                            🔄 Try Again
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Show admin dashboard (public method for compatibility)
     */
    show() {
        if (!this.isLoggedIn) {
            this.showLoginModal();
        } else {
            this.showAdminModal();
        }
    }

    // =====================================
    // INTEGRATION ACTION METHODS
    // =====================================

    /**
     * Run comprehensive integration validation
     */
    async runIntegrationValidation() {
        console.log('🔍 Running integration validation...');
        
        if (window.IntegrationValidator) {
            const validator = new window.IntegrationValidator();
            const results = await validator.validateAllIntegrations();
            
            const resultsContainer = document.getElementById('integration-validation-results');
            if (resultsContainer) {
                resultsContainer.style.display = 'block';
                resultsContainer.innerHTML = validator.generateHTMLReport(results);
            }
        } else {
            console.warn('IntegrationValidator not available');
            alert('Integration validator is not loaded. Please refresh the page.');
        }
    }

    /**
     * Test GitHub integration (called by the UI button)
     */
    async testGitHubIntegration() {
        console.log('🧪 Testing GitHub integration...');
        
        const statusElement = document.getElementById('github-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        // Declare variables in the correct scope
        let token, repoOwner, repoName;
        
        try {
            // Check if we're running on GitHub Pages (no local server)
            const isGitHubPages = window.location.hostname.includes('github.io');
            
            if (isGitHubPages) {
                // Running on GitHub Pages - use form input values
                token = document.getElementById('github-token').value.trim();
                repoOwner = document.getElementById('github-owner').value.trim() || 'benatkanva';
                repoName = document.getElementById('github-repo').value.trim() || 'kanva-quotes';
                
                if (!token) {
                    throw new Error('Please enter a GitHub token');
                }
            } else {
                // Running locally - try to load from server
                const envResponse = await fetch('/api/env-config');
                if (!envResponse.ok) {
                    throw new Error('Failed to load environment configuration');
                }
                
                const envResult = await envResponse.json();
                if (!envResult.success || !envResult.data || !envResult.data.github) {
                    throw new Error('GitHub configuration not found in environment');
                }
                
                const githubConfig = envResult.data.github;
                token = githubConfig.token;
                const owner = githubConfig.username || 'benatkanva';
                const repo = githubConfig.repo || 'benatkanva/kanva-quotes';
                
                // Extract repo name from full repo path if needed
                repoName = repo.includes('/') ? repo.split('/')[1] : repo;
                repoOwner = repo.includes('/') ? repo.split('/')[0] : owner;
            }
            
            if (!token) {
                this.updateIntegrationStatus(statusElement, 'error', 'No Token');
                this.showNotification('GitHub token not found in environment variables', 'error');
                return;
            }
            
            console.log('🔐 Using GitHub token from environment variables');
            console.log('📋 Testing repository:', `${repoOwner}/${repoName}`);
            
            // Make real API call to GitHub using environment variables
            const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Quotes-Admin'
                }
            });
            
            console.log('🔍 GitHub API Response Status:', response.status);
            
            if (response.ok) {
                const repoData = await response.json();
                this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                
                console.log('✅ GitHub API connection successful!');
                
                // Save successful connection data
                await this.saveConnectionData('github', {
                    token: token,
                    repo: `${repoOwner}/${repoName}`,
                    owner: repoOwner,
                    repoName: repoName,
                    timestamp: new Date().toISOString(),
                    repoData: {
                        full_name: repoData.full_name,
                        default_branch: repoData.default_branch,
                        description: repoData.description
                    }
                });
                
                this.showNotification(`GitHub connection successful! Repository: ${repoData.full_name}`, 'success');
                
            } else if (response.status === 401) {
                this.updateIntegrationStatus(statusElement, 'error', 'Unauthorized');
                this.showNotification('GitHub token is invalid or expired', 'error');
            } else if (response.status === 404) {
                this.updateIntegrationStatus(statusElement, 'error', 'Not Found');
                this.showNotification('Repository not found or no access', 'error');
            } else {
                throw new Error(`GitHub API returned ${response.status}`);
            }
            
        } catch (error) {
            console.error('GitHub integration test failed:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Test Failed');
            this.showNotification(`GitHub test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Initialize integration tabs
     */
    initIntegrationTabs() {
        const tabs = document.querySelectorAll('.integration-tab');
        if (!tabs || tabs.length === 0) return;
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                document.querySelectorAll('.integration-tab').forEach(t => {
                    t.classList.remove('active');
                });
                
                // Hide all tab content
                document.querySelectorAll('.integration-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Show corresponding tab content
                const tabName = tab.dataset.tab;
                const tabContent = document.getElementById(`${tabName}-tab`);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
                
                // Reload connection statuses to persist state
                this.updateConnectionStatuses();
                
                // Populate forms with existing data
                setTimeout(() => this.populateConnectionForms(), 50);
                
                // Adjust modal height after tab switch
                setTimeout(() => this.adjustModalHeight(), 100);
            });
        });
    }

    /**
     * Save GitHub settings
     */
    async saveGitHubSettings() {
        const owner = document.getElementById('github-owner')?.value;
        const repo = document.getElementById('github-repo')?.value;
        const token = document.getElementById('github-token')?.value;
        const branch = document.getElementById('github-branch')?.value || 'main';
        
        if (!owner || !repo || !token) {
            alert('Please fill in all required GitHub settings');
            return;
        }
        
        try {
            // Check if we're running on GitHub Pages (no local server)
            const isGitHubPages = window.location.hostname.includes('github.io');
            
            // Update admin manager settings
            if (this.adminManager) {
                this.adminManager.github = { owner, repo, branch, token };
                await this.adminManager.setGitHubToken(token);
            }
            
            // Configure GitConnector with the new settings
            if (window.GitConnector) {
                const gitConnector = new window.GitConnector({
                    repo: `${owner}/${repo}`,
                    branch: branch,
                    token: token
                });
                
                if (isGitHubPages) {
                    // Running on GitHub Pages - save to localStorage only
                    console.log('💾 Saving GitHub settings to localStorage (GitHub Pages mode)');
                    localStorage.setItem('github-connection', JSON.stringify({
                        token: token,
                        repo: `${owner}/${repo}`,
                        owner: owner,
                        repoName: repo,
                        branch: branch,
                        timestamp: new Date().toISOString()
                    }));
                } else {
                    // Running locally - save to server
                    await gitConnector.saveConnectionToServer();
                }
                
                console.log('✅ GitHub settings saved successfully');
                this.showNotification('GitHub settings saved successfully!', 'success');
                
                // Update status indicator
                const statusElement = document.getElementById('github-status');
                if (statusElement) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                }
            } else {
                console.error('GitConnector not available');
                alert('Could not save GitHub settings: GitConnector not available');
            }
        } catch (error) {
            console.error('Failed to save GitHub settings:', error);
            alert(`Failed to save GitHub settings: ${error.message}`);
        }
    }

    /**
     * Test Copper CRM integration
     */
    async testCopperIntegration() {
        console.log('🧪 Testing Copper CRM integration...');
        
        const apiKey = document.getElementById('copper-api-key')?.value;
        const email = document.getElementById('copper-email')?.value;
        const environment = document.getElementById('copper-environment')?.value || 'production';
        
        const statusElement = document.getElementById('copper-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        try {
            if (!apiKey || !email) {
                throw new Error('API Key and Email are required');
            }
            
            // Make real API call to Copper CRM
            const response = await fetch('https://api.copper.com/developer_api/v1/account', {
                method: 'GET',
                headers: {
                    'X-PW-AccessToken': apiKey,
                    'X-PW-Application': 'developer_api',
                    'X-PW-UserEmail': email,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const accountData = await response.json();
                this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                
                // Save successful connection data
                await this.saveConnectionData('copper', {
                    apiKey: apiKey,
                    email: email,
                    environment: environment,
                    timestamp: new Date().toISOString(),
                    accountData: {
                        name: accountData.name,
                        id: accountData.id
                    }
                });
                
                this.showNotification(`Copper CRM connection successful! Account: ${accountData.name}`, 'success');
                
            } else if (response.status === 401) {
                this.updateIntegrationStatus(statusElement, 'error', 'Unauthorized');
                this.showNotification('Copper CRM API key is invalid or email is incorrect', 'error');
            } else if (response.status === 403) {
                this.updateIntegrationStatus(statusElement, 'error', 'Forbidden');
                this.showNotification('Access denied. Check your Copper CRM permissions', 'error');
            } else {
                throw new Error(`Copper CRM API returned ${response.status}`);
            }
            
        } catch (error) {
            console.error('Copper CRM connection error:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Error');
            this.showNotification(`Copper CRM connection failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Test ShipStation integration
     */
    async testShipStationIntegration() {
        console.log('🧪 Testing ShipStation integration...');
        
        const apiKey = document.getElementById('shipstation-api-key')?.value;
        const apiSecret = document.getElementById('shipstation-api-secret')?.value;
        const environment = document.getElementById('shipstation-environment')?.value || 'production';
        
        const statusElement = document.getElementById('shipstation-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        try {
            if (!apiKey || !apiSecret) {
                throw new Error('API Key and API Secret are required');
            }
            
            // Configure singleton and use its tested method (handles base URL and headers)
            if (window.shipStation) {
                window.shipStation.configure({ apiKey, apiSecret, environment });
            }

            const result = window.shipStation
                ? await window.shipStation.testConnection()
                : { success: false, message: 'ShipStation integration not initialized' };

            if (result.success) {
                this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                
                // Save successful connection data
                await this.saveConnectionData('shipstation', {
                    apiKey: apiKey,
                    apiSecret: apiSecret,
                    environment: environment,
                    timestamp: new Date().toISOString(),
                    connectionTest: result.details || { message: result.message }
                });
                
                this.showNotification('ShipStation connection successful!', 'success');
                
            } else {
                this.updateIntegrationStatus(statusElement, 'error', 'Error');
                // Provide a friendlier message for common CORS/auth cases
                const msg = /CORS/i.test(result.message || '')
                    ? 'CORS blocked the browser request. Use a backend proxy for production.'
                    : result.message || 'ShipStation connection failed';
                this.showNotification(`ShipStation connection failed: ${msg}`, 'error');
            }
            
        } catch (error) {
            console.error('ShipStation connection error:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Error');
            this.showNotification(`ShipStation connection failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Save ShipStation settings
     */
    async saveShipStationSettings() {
        console.log('💾 Saving ShipStation settings...');
        
        const apiKey = document.getElementById('shipstation-api-key')?.value;
        const apiSecret = document.getElementById('shipstation-api-secret')?.value;
        const environment = document.getElementById('shipstation-environment')?.value || 'production';
        
        if (!apiKey || !apiSecret) {
            alert('Please enter both API Key and API Secret');
            return;
        }
        
        try {
            // Simulate saving settings
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Save settings to local storage for demo purposes
            localStorage.setItem('shipstation_api_key', apiKey);
            localStorage.setItem('shipstation_environment', environment);
            
            this.showNotification('ShipStation settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to save ShipStation settings:', error);
            this.showNotification(`Failed to save ShipStation settings: ${error.message}`, 'error');
        }
    }
    
    /**
     * View ShipStation orders
     */
    viewShipStationOrders() {
        // Create modal container if not present
        let modal = document.getElementById('shipstation-orders-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'shipstation-orders-modal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1400px; margin: 2% auto; max-height: 90vh; overflow: auto;">
                    <button class="close-btn" onclick="document.getElementById('shipstation-orders-modal').style.display='none'">&times;</button>
                    <h2>ShipStation Orders</h2>
                    <div style="display:flex; gap:12px; align-items:center; margin: 10px 0; flex-wrap: wrap;">
                        <label>Start: <input type="date" id="ss-orders-start"></label>
                        <label>End: <input type="date" id="ss-orders-end"></label>
                        <button id="ss-orders-fetch" class="btn btn-primary">Fetch</button>
                        <input type="text" id="ss-orders-search" placeholder="Search orders..." style="flex:1; min-width: 220px; padding:6px;">
                        <span id="ss-orders-status" style="margin-left:auto; font-size: 12px; opacity: .8;"></span>
                    </div>
                    <div id="ss-orders-results" style="border:1px solid #ddd; border-radius:6px; overflow:hidden; max-height:65vh; overflow-y:auto;">
                        <table id="ss-orders-table" style="width:100%; border-collapse: collapse; font-size:13px;">
                            <thead>
                                <tr style="background:#f6f6f6; position:sticky; top:0; z-index:1;">
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Order #</th>
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Date</th>
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Customer</th>
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Email</th>
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Ship To</th>
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Carrier</th>
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Tracking</th>
                                    <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Status</th>
                                    <th style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">Total</th>
                                    <th style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">Items</th>
                                </tr>
                            </thead>
                            <tbody id="ss-orders-tbody">
                                <tr><td colspan="10" style="padding:12px;">No data yet. Choose a date and click Fetch.</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="display:flex; align-items:center; justify-content: space-between; margin-top:8px; gap:8px;">
                        <div>
                            <button id="ss-orders-prev" class="btn">Prev</button>
                            <button id="ss-orders-next" class="btn">Next</button>
                        </div>
                        <div id="ss-orders-pageinfo" style="font-size:12px; opacity:.8;"></div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }

        // Initialize dates to today
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const startInput = modal.querySelector('#ss-orders-start');
        const endInput = modal.querySelector('#ss-orders-end');
        if (startInput && !startInput.value) startInput.value = `${yyyy}-${mm}-${dd}`;
        if (endInput && !endInput.value) endInput.value = `${yyyy}-${mm}-${dd}`;

        const statusEl = modal.querySelector('#ss-orders-status');
        const tbody = modal.querySelector('#ss-orders-tbody');
        const fetchBtn = modal.querySelector('#ss-orders-fetch');
        const searchInput = modal.querySelector('#ss-orders-search');
        const prevBtn = modal.querySelector('#ss-orders-prev');
        const nextBtn = modal.querySelector('#ss-orders-next');
        const pageInfo = modal.querySelector('#ss-orders-pageinfo');
        let currentOrders = [];
        let currentPage = 1;
        let totalPages = 1;

        const renderRows = (orders) => {
            if (!orders || orders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="padding:12px;">No orders found for selected date(s).</td></tr>`;
                return;
            }
            tbody.innerHTML = orders.map(o => {
                const orderDate = o.orderDate || o.createDate || '';
                const formattedDate = orderDate ? new Date(orderDate).toLocaleDateString() : '';
                const cust = (o.billTo?.name || o.shipTo?.name || '').toString();
                const email = o.customerEmail || '';
                const shipTo = o.shipTo ? `${o.shipTo.city || ''}${o.shipTo.state ? ', ' + o.shipTo.state : ''}` : '';
                const itemsCount = Array.isArray(o.items) ? o.items.reduce((a, it) => a + (Number(it.quantity)||0), 0) : (o.itemCount || 0);
                const status = o.orderStatus || '';
                const total = o.orderTotal ?? o.amountPaid ?? '';
                // Get tracking from shipments array
                const shipment = Array.isArray(o.shipments) && o.shipments.length > 0 ? o.shipments[0] : null;
                const carrier = shipment?.carrierCode || o.carrierCode || o.requestedShippingService || '';
                const tracking = shipment?.trackingNumber || '';
                const trackingLink = tracking && carrier ? this.getTrackingUrl(carrier, tracking) : '';
                const trackingDisplay = tracking ? (trackingLink ? `<a href="${trackingLink}" target="_blank" title="Track package">${tracking}</a>` : tracking) : '<span style="color:#999;">—</span>';
                // Status badge color
                const statusColor = status === 'shipped' ? '#28a745' : status === 'awaiting_shipment' ? '#ffc107' : status === 'cancelled' ? '#dc3545' : '#6c757d';
                return `
                    <tr>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;"><a href="#" class="ss-order-link" data-order-id="${o.orderId || ''}" data-order-number="${o.orderNumber || ''}" style="font-weight:500;">${o.orderNumber || o.orderId || ''}</a></td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; white-space:nowrap;">${formattedDate}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${cust}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:12px;">${email}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:12px;">${shipTo}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:12px;">${carrier}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:11px;">${trackingDisplay}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;"><span style="background:${statusColor}; color:#fff; padding:2px 6px; border-radius:3px; font-size:11px;">${status}</span></td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">$${Number(total).toFixed(2)}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${itemsCount}</td>
                    </tr>`;
            }).join('');
        };

        const fetchOrders = async (page = 1) => {
            if (!window.shipStation || !window.shipStation.isConfigured) {
                this.showNotification('ShipStation not configured', 'error');
                return;
            }
            try {
                statusEl.textContent = 'Loading...';
                const startDate = new Date(`${startInput.value}T00:00:00`);
                const endDate = new Date(`${endInput.value}T23:59:59`);
                const { orders, total, page: pg, pages } = await window.shipStation.listOrders({ start: startDate, end: endDate, page: page, pageSize: 100 });
                currentOrders = orders || [];
                currentPage = pg || page || 1;
                totalPages = pages || 1;
                statusEl.textContent = `Loaded ${currentOrders.length}${typeof total === 'number' ? ` of ${total}` : ''}`;
                pageInfo.textContent = `Page ${currentPage}${totalPages ? ` of ${totalPages}` : ''}`;
                prevBtn.disabled = currentPage <= 1;
                nextBtn.disabled = totalPages ? currentPage >= totalPages : (currentOrders.length < 100);
                renderRows(currentOrders);
            } catch (err) {
                console.error('Failed to fetch ShipStation orders:', err);
                statusEl.textContent = 'Error';
                const msg = /CORS/i.test(String(err)) ? 'CORS blocked the browser request. Use a backend proxy.' : (err.message || 'Failed to fetch orders');
                this.showNotification(`ShipStation orders error: ${msg}`, 'error');
            }
        };

        const filterOrders = () => {
            const q = (searchInput.value || '').toLowerCase().trim();
            if (!q) { renderRows(currentOrders); return; }
            const filtered = currentOrders.filter(o => {
                try {
                    return JSON.stringify(o).toLowerCase().includes(q);
                } catch { return false; }
            });
            renderRows(filtered);
        };

        // Wire up controls
        fetchBtn.onclick = () => { currentPage = 1; fetchOrders(1); };
        prevBtn.onclick = () => { if (currentPage > 1) fetchOrders(currentPage - 1); };
        nextBtn.onclick = () => { fetchOrders(currentPage + 1); };

        // Order details modal
        const openOrderDetails = async (orderId, orderNumber) => {
            try {
                const order = orderId ? await window.shipStation.getOrder(orderId) : await window.shipStation.getOrderByOrderNumber(orderNumber);
                if (!order) { this.showNotification('Order not found', 'warning'); return; }

                let detail = document.getElementById('shipstation-order-detail-modal');
                if (!detail) {
                    detail = document.createElement('div');
                    detail.id = 'shipstation-order-detail-modal';
                    detail.className = 'modal';
                    detail.style.display = 'none';
                    document.body.appendChild(detail);
                }
                const itemsRows = (order.items || []).map((it, i) => `
                    <tr>
                        <td style="padding:6px; border-bottom:1px solid #eee;">${i+1}</td>
                        <td style="padding:6px; border-bottom:1px solid #eee;">${it.sku || ''}</td>
                        <td style="padding:6px; border-bottom:1px solid #eee;">${it.name || ''}</td>
                        <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${it.quantity || 0}</td>
                        <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">$${Number(it.unitPrice ?? 0).toFixed(2)}</td>
                    </tr>`).join('') || '<tr><td colspan="5" style="padding:8px;">No items</td></tr>';
                
                // Build shipping address
                const shipTo = order.shipTo || {};
                const shipAddr = [shipTo.street1, shipTo.street2, `${shipTo.city || ''}, ${shipTo.state || ''} ${shipTo.postalCode || ''}`, shipTo.country].filter(Boolean).join('<br>');
                const billTo = order.billTo || {};
                const billAddr = [billTo.street1, billTo.street2, `${billTo.city || ''}, ${billTo.state || ''} ${billTo.postalCode || ''}`, billTo.country].filter(Boolean).join('<br>');
                
                // Build shipments/tracking info
                const shipments = order.shipments || [];
                const shipmentsHtml = shipments.length > 0 ? shipments.map((s, i) => {
                    const trackUrl = this.getTrackingUrl(s.carrierCode, s.trackingNumber);
                    const trackLink = s.trackingNumber ? (trackUrl ? `<a href="${trackUrl}" target="_blank">${s.trackingNumber}</a>` : s.trackingNumber) : '—';
                    return `
                        <div style="background:#f9f9f9; padding:8px; border-radius:4px; margin-bottom:6px;">
                            <div><strong>Shipment ${i+1}:</strong> ${s.carrierCode || ''} - ${s.serviceCode || ''}</div>
                            <div><strong>Tracking:</strong> ${trackLink}</div>
                            <div><strong>Ship Date:</strong> ${s.shipDate || ''}</div>
                            <div><strong>Weight:</strong> ${s.weight?.value || ''} ${s.weight?.units || ''}</div>
                        </div>`;
                }).join('') : '<div style="color:#999;">No shipments yet</div>';
                
                // Status badge
                const status = order.orderStatus || '';
                const statusColor = status === 'shipped' ? '#28a745' : status === 'awaiting_shipment' ? '#ffc107' : status === 'cancelled' ? '#dc3545' : '#6c757d';
                
                detail.innerHTML = `
                    <div class="modal-content" style="max-width: 900px; margin: 3% auto; max-height: 90vh; overflow: auto;">
                        <button class="close-btn" onclick="document.getElementById('shipstation-order-detail-modal').style.display='none'">&times;</button>
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                            <h3 style="margin:0;">Order ${order.orderNumber || order.orderId || ''}</h3>
                            <span style="background:${statusColor}; color:#fff; padding:4px 10px; border-radius:4px; font-size:12px;">${status}</span>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom:16px;">
                            <div style="background:#f8f9fa; padding:12px; border-radius:6px;">
                                <h4 style="margin:0 0 8px 0; font-size:14px; color:#666;">Order Info</h4>
                                <div style="font-size:13px;"><strong>Date:</strong> ${order.orderDate ? new Date(order.orderDate).toLocaleString() : ''}</div>
                                <div style="font-size:13px;"><strong>Order Total:</strong> $${Number(order.orderTotal ?? 0).toFixed(2)}</div>
                                <div style="font-size:13px;"><strong>Amount Paid:</strong> $${Number(order.amountPaid ?? 0).toFixed(2)}</div>
                                <div style="font-size:13px;"><strong>Shipping Paid:</strong> $${Number(order.shippingAmount ?? 0).toFixed(2)}</div>
                                <div style="font-size:13px;"><strong>Tax:</strong> $${Number(order.taxAmount ?? 0).toFixed(2)}</div>
                                <div style="font-size:13px;"><strong>Service:</strong> ${order.requestedShippingService || order.carrierCode || '—'}</div>
                            </div>
                            <div style="background:#f8f9fa; padding:12px; border-radius:6px;">
                                <h4 style="margin:0 0 8px 0; font-size:14px; color:#666;">Ship To</h4>
                                <div style="font-size:13px;"><strong>${shipTo.name || ''}</strong></div>
                                <div style="font-size:12px; line-height:1.4;">${shipAddr}</div>
                                <div style="font-size:12px; margin-top:4px;"><strong>Phone:</strong> ${shipTo.phone || '—'}</div>
                            </div>
                            <div style="background:#f8f9fa; padding:12px; border-radius:6px;">
                                <h4 style="margin:0 0 8px 0; font-size:14px; color:#666;">Bill To</h4>
                                <div style="font-size:13px;"><strong>${billTo.name || ''}</strong></div>
                                <div style="font-size:12px; line-height:1.4;">${billAddr}</div>
                                <div style="font-size:12px; margin-top:4px;"><strong>Email:</strong> ${order.customerEmail || '—'}</div>
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom:16px;">
                            <div>
                                <h4 style="margin:0 0 8px 0;">Tracking & Shipments</h4>
                                ${shipmentsHtml}
                            </div>
                            <div>
                                <h4 style="margin:0 0 8px 0;">Package Details</h4>
                                <div style="background:#f9f9f9; padding:8px; border-radius:4px; font-size:13px;">
                                    <div><strong>Weight:</strong> ${order.weight?.value || '—'} ${order.weight?.units || ''}</div>
                                    <div><strong>Dimensions:</strong> ${order.dimensions ? `${order.dimensions.length}x${order.dimensions.width}x${order.dimensions.height} ${order.dimensions.units || ''}` : '—'}</div>
                                    <div><strong>Warehouse:</strong> ${order.warehouseId || '—'}</div>
                                    <div><strong>Store:</strong> ${order.advancedOptions?.storeId || '—'}</div>
                                </div>
                            </div>
                        </div>
                        
                        <h4 style="margin:0 0 8px 0;">Items (${order.items?.length || 0})</h4>
                        <div style="border:1px solid #ddd; border-radius:6px; overflow:hidden;">
                            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                                <thead>
                                    <tr style="background:#f6f6f6;">
                                        <th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">#</th>
                                        <th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">SKU</th>
                                        <th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Name</th>
                                        <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Qty</th>
                                        <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Unit Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsRows}
                                </tbody>
                            </table>
                        </div>
                        
                        ${order.customerNotes || order.internalNotes ? `
                        <div style="margin-top:12px;">
                            ${order.customerNotes ? `<div style="background:#fff3cd; padding:8px; border-radius:4px; margin-bottom:6px;"><strong>Customer Notes:</strong> ${order.customerNotes}</div>` : ''}
                            ${order.internalNotes ? `<div style="background:#d1ecf1; padding:8px; border-radius:4px;"><strong>Internal Notes:</strong> ${order.internalNotes}</div>` : ''}
                        </div>` : ''}
                    </div>`;
                detail.style.display = 'block';
            } catch (e) {
                console.error('Failed to load order details:', e);
                const msg = /CORS/i.test(String(e)) ? 'CORS blocked the browser request. Use a backend proxy.' : (e.message || 'Failed to load order');
                this.showNotification(`Order details error: ${msg}`, 'error');
            }
        };

        // Delegate click on order links
        tbody.onclick = (ev) => {
            const a = ev.target.closest('a.ss-order-link');
            if (!a) return;
            ev.preventDefault();
            const orderId = a.getAttribute('data-order-id');
            const orderNumber = a.getAttribute('data-order-number');
            openOrderDetails(orderId, orderNumber);
        };

        // Bind search
        if (searchInput) {
            searchInput.oninput = () => {
                // Delay-free filter on client-side list
                filterOrders();
            };
        }

        // Bind fetch
        // Ensure we do NOT pass the click event as the first arg (which would become params.page)
        fetchBtn.onclick = () => { fetchOrders(currentPage || 1); };
        // Show modal and auto-fetch
        modal.style.display = 'block';
        fetchOrders();
    }

    /**
     * Get tracking URL for a carrier and tracking number
     * @param {string} carrier - Carrier code (e.g., 'ups', 'fedex', 'usps')
     * @param {string} trackingNumber - The tracking number
     * @returns {string} - Tracking URL or empty string
     */
    getTrackingUrl(carrier, trackingNumber) {
        if (!carrier || !trackingNumber) return '';
        const c = carrier.toLowerCase();
        if (c.includes('ups')) {
            return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
        } else if (c.includes('fedex')) {
            return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
        } else if (c.includes('usps')) {
            return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
        } else if (c.includes('dhl')) {
            return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`;
        } else if (c.includes('ontrac')) {
            return `https://www.ontrac.com/tracking/?number=${encodeURIComponent(trackingNumber)}`;
        } else if (c.includes('lasership') || c.includes('laser')) {
            return `https://www.lasership.com/track/${encodeURIComponent(trackingNumber)}`;
        }
        return '';
    }
    
    /**
     * View GitHub history
     */
    viewGitHubHistory() {
        console.log('📄 Opening GitHub history...');
        
        const owner = document.getElementById('github-owner')?.value || 'benatkanva';
        const repo = document.getElementById('github-repo')?.value || 'kanva-quotes';
        
        if (window.GitConnector) {
            try {
                // Open GitHub repository in new tab
                const repoUrl = `https://github.com/${owner}/${repo}/commits`;
                window.open(repoUrl, '_blank');
                
                this.showNotification('Opening GitHub commit history...', 'info');
            } catch (error) {
                console.error('Error opening GitHub history:', error);
                this.showNotification('Failed to open GitHub history', 'error');
            }
        } else {
            alert('GitHub integration not available. Please check that git-connector.js is loaded.');
        }
    }
    
    /**
     * View Copper activity logs
     */
    viewCopperActivity() {
        console.log('📄 Opening Copper activity logs...');
        
        // For now, show a placeholder message
        // In a real implementation, this would open a modal or new window with activity logs
        alert('Copper CRM activity logs would be displayed here. This feature is under development.');
    }
    
    /**
     * Test Fishbowl ERP integration
     */
    async testFishbowlIntegration() {
        console.log('🧪 Testing Fishbowl ERP integration...');
        
        const server = document.getElementById('fishbowl-server')?.value;
        const username = document.getElementById('fishbowl-username')?.value;
        const password = document.getElementById('fishbowl-password')?.value;
        
        const statusElement = document.getElementById('fishbowl-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        try {
            if (!server || !username || !password) {
                throw new Error('Server, Username, and Password are required');
            }
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // For demo purposes, we'll simulate a successful connection
            this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
            
            // Show success message
            this.showNotification('Fishbowl ERP connection successful!', 'success');
            
        } catch (error) {
            console.error('Fishbowl ERP connection error:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Error');
            this.showNotification(`Fishbowl ERP connection failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Save Fishbowl ERP settings
     */
    async saveFishbowlSettings() {
        console.log('💾 Saving Fishbowl ERP settings...');
        
        const server = document.getElementById('fishbowl-server')?.value;
        const username = document.getElementById('fishbowl-username')?.value;
        const password = document.getElementById('fishbowl-password')?.value;
        
        if (!server || !username || !password) {
            alert('Please enter Server, Username, and Password');
            return;
        }
        
        try {
            // Simulate saving settings
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Save settings to local storage for demo purposes
            localStorage.setItem('fishbowl_server', server);
            localStorage.setItem('fishbowl_username', username);
            
            this.showNotification('Fishbowl ERP settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to save Fishbowl ERP settings:', error);
            this.showNotification(`Failed to save Fishbowl ERP settings: ${error.message}`, 'error');
        }
    }
    
    /**
     * View Fishbowl inventory
     */
    viewFishbowlInventory() {
        alert('Fishbowl ERP inventory view would open here. This feature is under development.');
    }
    
    /**
     * Save Copper CRM settings
     */
    async saveCopperSettings(showAlert = true) {
        const apiKey = document.getElementById('copper-api-key')?.value?.trim();
        const email = document.getElementById('copper-email')?.value?.trim();
        const environment = document.getElementById('copper-environment')?.value || 'production';
      
        if (!apiKey || !email) {
          if (showAlert) alert('Please enter both API Key and Email');
          return false;
        }
        // Optional advanced settings (if inputs exist)
        const activityTypeIdStr = document.getElementById('copper-activity-type-id')?.value?.trim();
        const assignToUserIdStr = document.getElementById('copper-assign-user-id')?.value?.trim();
        const phoneStrategy = document.getElementById('copper-phone-strategy')?.value || undefined; // 'e164' | 'any'
        const defaultCountry = document.getElementById('copper-default-country')?.value?.trim() || undefined;
        const taskStatus = document.getElementById('copper-task-status')?.value?.trim() || undefined; // default 'Completed'
        const taskDueOffsetStr = document.getElementById('copper-task-due-offset')?.value?.trim(); // minutes
        const activityCustomFieldsJson = document.getElementById('copper-activity-custom-fields-json')?.value?.trim();
        const taskCustomFieldsJson = document.getElementById('copper-task-custom-fields-json')?.value?.trim();

        // Build payload
        const payload = {
          apiKey,
          email,
          environment,
          enabled: true,
          lastUpdated: new Date().toISOString()
        };

        // Attach optional settings only if present
        const activityTypeId = activityTypeIdStr ? Number(activityTypeIdStr) : undefined;
        const assignToUserId = assignToUserIdStr ? Number(assignToUserIdStr) : undefined;
        if (!isNaN(activityTypeId)) payload.activityTypeId = activityTypeId;
        if (!isNaN(assignToUserId)) payload.assignToUserId = assignToUserId;

        if (phoneStrategy || defaultCountry) {
          payload.phoneMatch = {
            ...(defaultCountry ? { defaultCountry } : {}),
            ...(phoneStrategy ? { strategy: phoneStrategy } : {})
          };
        }

        if (taskStatus || taskDueOffsetStr) {
          const dueOffset = taskDueOffsetStr ? Number(taskDueOffsetStr) : undefined;
          payload.taskDefaults = {
            ...(taskStatus ? { status: taskStatus } : {}),
            ...(typeof dueOffset === 'number' && !isNaN(dueOffset) ? { dueDateOffsetMinutes: dueOffset } : {})
          };
        }

        if (activityCustomFieldsJson) {
          try {
            const parsed = JSON.parse(activityCustomFieldsJson);
            if (parsed && typeof parsed === 'object') payload.activityCustomFields = parsed;
          } catch (e) {
            console.warn('Invalid activity custom fields JSON:', e);
            if (showAlert) alert('Invalid JSON in Copper Activity Custom Fields. Please fix and try again.');
            return false;
          }
        }
        if (taskCustomFieldsJson) {
          try {
            const parsed = JSON.parse(taskCustomFieldsJson);
            if (parsed && typeof parsed === 'object') payload.taskCustomFields = parsed;
          } catch (e) {
            console.warn('Invalid task custom fields JSON:', e);
            if (showAlert) alert('Invalid JSON in Copper Task Custom Fields. Please fix and try again.');
            return false;
          }
        }
      
        try {
          // 1) Secure handler → Firestore (global credentials)
          let saved = false;
          if (window.secureIntegrationHandler) {
            try {
              saved = await window.secureIntegrationHandler.updateIntegration('copper', payload);
            } catch (e) {
              console.warn('Secure save failed, will fall back:', e);
            }
          }
      
          // 2) Fallback → server endpoint
          if (!saved) {
            const resp = await fetch('/api/connections/copper', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const result = await resp.json().catch(() => ({}));
            saved = resp.ok && result?.success !== false;
          }
      
          if (!saved) {
            if (showAlert) alert('Failed to save Copper settings');
            return false;
          }
      
          // Update local cache and UI
          this.connectionData = this.connectionData || {};
          this.connectionData.copper = payload;
      
          const statusEl = document.getElementById('copper-status');
          if (statusEl) this.updateIntegrationStatus(statusEl, 'ok', 'Configured');
      
          // Configure Copper SDK if available
          if (window.CopperIntegration?.configure) {
            await window.CopperIntegration.configure({ apiKey, email, environment });
          }
      
          if (typeof this.showNotification === 'function') {
            this.showNotification('Copper CRM settings saved', 'success');
          } else if (showAlert) {
            alert('Copper CRM settings saved successfully!');
          }
          return true;
      
        } catch (error) {
          console.error('Error saving Copper settings:', error);
          if (typeof this.showNotification === 'function') {
            this.showNotification(`Failed to save Copper settings: ${error.message}`, 'error');
          } else if (showAlert) {
            alert(`Error saving Copper settings: ${error.message}`);
          }
          return false;
        }
      }
    /**
     * View Copper activity logs
     */
    viewCopperLogs() {
        console.log('📄 Opening Copper activity logs...');
        alert('Copper activity logs would be displayed here. This feature shows recent CRM activities and quote submissions.');
    }

    /**
     * Test Fishbowl ERP integration
     */
    async testFishbowlIntegration() {
        console.log('🧪 Testing Fishbowl integration...');
        
        const host = document.getElementById('fishbowl-host')?.value || 'localhost';
        const port = document.getElementById('fishbowl-port')?.value || '28192';
        const username = document.getElementById('fishbowl-username')?.value;
        const password = document.getElementById('fishbowl-password')?.value;
        
        if (!username || !password) {
            alert('Please enter both username and password for Fishbowl ERP');
            return;
        }
        
        const statusElement = document.getElementById('fishbowl-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        try {
            if (window.FishbowlIntegration) {
                // Save credentials to server first
                await this.saveFishbowlSettings(false); // Don't show alert
                
                // Create new instance with the credentials
                const fishbowlIntegration = new window.FishbowlIntegration({
                    host: host,
                    port: port,
                    username: username,
                    password: password
                });
                
                // Test connection
                const testResult = await fishbowlIntegration.testConnection();
                
                if (testResult.success) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                    
                    // Store reference to fishbowl integration
                    window.fishbowlIntegration = fishbowlIntegration;
                    
                    alert(`✅ Fishbowl API Connection Successful\n\nServer: ${testResult.details.serverInfo || host + ':' + port}\nVersion: ${testResult.details.version || 'Unknown'}\nUser: ${testResult.details.userName || username}`);
                } else {
                    this.updateIntegrationStatus(statusElement, 'error', testResult.message);
                    alert(`❌ Fishbowl Connection Failed\n\nError: ${testResult.message}`);
                }
            } else {
                this.updateIntegrationStatus(statusElement, 'error', 'Integration Not Loaded');
                alert('❌ FishbowlIntegration not loaded. Please refresh the page and try again.');
            }
        } catch (error) {
            console.error('Fishbowl test failed:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Test Failed');
            alert(`❌ Fishbowl Test Failed\n\nError: ${error.message}`);
        }
    }

    /**
     * Sync Fishbowl data
     */
    async syncFishbowlData() {
        console.log('🔄 Syncing Fishbowl data...');
        
        const statusElement = document.getElementById('fishbowl-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Syncing...');
        
        try {
            if (window.fishbowlIntegration) {
                // Use existing instance if available
                const syncResult = await window.fishbowlIntegration.syncProductData();
                
                if (syncResult.success) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Synced');
                    alert(`✅ Fishbowl Data Sync Successful\n\nUpdated ${syncResult.updatedCount} products\nLast Sync: ${new Date().toLocaleString()}`);
                    
                    // Refresh products data if we're on the products tab
                    if (this.currentSection === 'products') {
                        this.refreshProductsData();
                    }
                } else {
                    this.updateIntegrationStatus(statusElement, 'error', 'Sync Failed');
                    alert(`❌ Fishbowl Sync Failed\n\nError: ${syncResult.message}`);
                }
            } else if (window.FishbowlIntegration) {
                // Create new instance if needed
                const fishbowlIntegration = new window.FishbowlIntegration();
                await fishbowlIntegration.loadConnectionFromServer();
                
                // Test connection first
                const testResult = await fishbowlIntegration.testConnection();
                
                if (testResult.success) {
                    // Connection successful, now sync data
                    const syncResult = await fishbowlIntegration.syncProductData();
                    
                    if (syncResult.success) {
                        this.updateIntegrationStatus(statusElement, 'ok', 'Synced');
                        alert(`✅ Fishbowl Data Sync Successful\n\nUpdated ${syncResult.updatedCount} products\nLast Sync: ${new Date().toLocaleString()}`);
                        
                        // Store reference to fishbowl integration
                        window.fishbowlIntegration = fishbowlIntegration;
                        
                        // Refresh products data if we're on the products tab
                        if (this.currentSection === 'products') {
                            this.refreshProductsData();
                        }
                    } else {
                        this.updateIntegrationStatus(statusElement, 'error', 'Sync Failed');
                        alert(`❌ Fishbowl Sync Failed\n\nError: ${syncResult.message}`);
                    }
                } else {
                    this.updateIntegrationStatus(statusElement, 'error', 'Connection Failed');
                    alert(`❌ Fishbowl Connection Failed\n\nPlease test the connection first.\nError: ${testResult.message}`);
                }
            } else {
                this.updateIntegrationStatus(statusElement, 'error', 'Integration Not Loaded');
                alert('❌ FishbowlIntegration not loaded. Please refresh the page and try again.');
            }
        } catch (error) {
            console.error('Fishbowl sync failed:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Sync Failed');
            alert(`❌ Fishbowl Sync Failed\n\nError: ${error.message}`);
        }
    }
    
    /**
     * Save Fishbowl ERP settings
     */
    async saveFishbowlSettings(showAlert = true) {
        console.log('💾 Saving Fishbowl ERP settings...');
        
        const host = document.getElementById('fishbowl-host')?.value || 'localhost';
        const port = document.getElementById('fishbowl-port')?.value || '28192';
        const username = document.getElementById('fishbowl-username')?.value;
        const password = document.getElementById('fishbowl-password')?.value;
        
        if (!username || !password) {
            if (showAlert) alert('Please enter both username and password for Fishbowl ERP');
            return false;
        }
        
        // Check if we're running on GitHub Pages
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        const connectionData = {
            host: host,
            port: port,
            username: username,
            password: password,
            lastUpdated: new Date().toISOString()
        };
        
        try {
            if (isGitHubPages) {
                // Save to localStorage in GitHub Pages mode
                localStorage.setItem('fishbowl-connection', JSON.stringify(connectionData));
                this.connectionData.fishbowl = connectionData;
                console.log('✅ Fishbowl ERP settings saved to localStorage');
            } else {
                // Save to server via API
                const response = await fetch('/api/connections/fishbowl', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(connectionData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Fishbowl ERP settings saved to server');
                
                    // Update status indicator
                    const statusElement = document.getElementById('fishbowl-status');
                    if (statusElement) {
                        this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                    }
                    
                    // Configure Fishbowl integration with new credentials if available
                    if (window.fishbowlIntegration) {
                        await window.fishbowlIntegration.configure({
                            host: host,
                            port: port,
                            username: username,
                            password: password
                        });
                    } else if (window.FishbowlIntegration) {
                        // Create new instance with the credentials
                        window.fishbowlIntegration = new window.FishbowlIntegration({
                            host: host,
                            port: port,
                            username: username,
                            password: password
                        });
                    }
                    
                    if (showAlert) alert('Fishbowl ERP settings saved successfully!');
                    return true;
                } else {
                    console.error('Failed to save Fishbowl settings:', result.message);
                    if (showAlert) alert(`Failed to save Fishbowl settings: ${result.message}`);
                    return false;
                }
            }
        } catch (error) {
            console.error('Error saving Fishbowl settings:', error);
            if (showAlert) alert(`Error saving Fishbowl settings: ${error.message}`);
            return false;
        }
    }

    /**
     * Load integrations data from the server
     */
    async loadIntegrationsData() {
        // Check if we're running on GitHub Pages
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        if (isGitHubPages) {
            console.log('💾 Loading integrations data from localStorage (GitHub Pages mode)...');
            // Skip server call and just update UI with localStorage data
            this.updateConnectionStatuses();
            return;
        }
        
        console.log('📂 Loading integrations data from server...');
        
        try {
            // Fetch all connections data
            const response = await fetch('/api/connections');
            
            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                console.warn(`⚠️ Server returned ${response.status} when loading integrations data`);
                // Try to load from localStorage instead
                return;
            }
            
            try {
                const data = await response.json();
                
                if (data && data.connections) {
                    console.log('✅ Loaded connections data:', data.connections);
                    // Cache all connections
                    this.connectionData = data.connections;
                    
                    // Load GitHub credentials
                    if (data.connections.github) {
                    const github = data.connections.github;
                    const githubOwnerEl = document.getElementById('github-owner');
                    if (githubOwnerEl) githubOwnerEl.value = github.owner || '';
                    const githubRepoEl = document.getElementById('github-repo');
                    if (githubRepoEl) githubRepoEl.value = github.repo || '';
                    const githubTokenEl = document.getElementById('github-token');
                    if (githubTokenEl) githubTokenEl.value = github.token || '';
                    
                    // Update status if token exists
                    if (github.token) {
                        const statusElement = document.getElementById('github-status');
                        this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                    }
                }
                
                // Load Copper credentials
                if (data.connections.copper) {
                    const copper = data.connections.copper;
                    const copperApiKeyEl = document.getElementById('copper-api-key');
                    if (copperApiKeyEl) copperApiKeyEl.value = copper.apiKey || '';
                    const copperEmailEl = document.getElementById('copper-email');
                    if (copperEmailEl) copperEmailEl.value = copper.email || '';
                    
                    if (document.getElementById('copper-environment')) {
                        document.getElementById('copper-environment').value = copper.environment || 'production';
                    }
                    // Advanced fields
                    if (document.getElementById('copper-activity-type-id') && typeof copper.activityTypeId === 'number') {
                        document.getElementById('copper-activity-type-id').value = String(copper.activityTypeId);
                    }
                    if (document.getElementById('copper-assign-user-id') && typeof copper.assignToUserId === 'number') {
                        document.getElementById('copper-assign-user-id').value = String(copper.assignToUserId);
                    }
                    if (document.getElementById('copper-phone-strategy') && copper.phoneMatch?.strategy) {
                        document.getElementById('copper-phone-strategy').value = copper.phoneMatch.strategy;
                    }
                    if (document.getElementById('copper-default-country') && copper.phoneMatch?.defaultCountry) {
                        document.getElementById('copper-default-country').value = copper.phoneMatch.defaultCountry;
                    }
                    if (document.getElementById('copper-task-status') && copper.taskDefaults?.status) {
                        document.getElementById('copper-task-status').value = copper.taskDefaults.status;
                    }
                    if (document.getElementById('copper-task-due-offset') && typeof copper.taskDefaults?.dueDateOffsetMinutes === 'number') {
                        document.getElementById('copper-task-due-offset').value = String(copper.taskDefaults.dueDateOffsetMinutes);
                    }
                    if (document.getElementById('copper-activity-custom-fields-json') && copper.activityCustomFields) {
                        document.getElementById('copper-activity-custom-fields-json').value = JSON.stringify(copper.activityCustomFields, null, 2);
                    }
                    if (document.getElementById('copper-task-custom-fields-json') && copper.taskCustomFields) {
                        document.getElementById('copper-task-custom-fields-json').value = JSON.stringify(copper.taskCustomFields, null, 2);
                    }
                    
                    // Update status if API key exists
                    if (copper.apiKey) {
                        const statusElement = document.getElementById('copper-status');
                        this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                        
                        // Configure Copper SDK with credentials if available
                        if (window.CopperIntegration && typeof window.CopperIntegration.configure === 'function') {
                            window.CopperIntegration.configure({
                                apiKey: copper.apiKey,
                                email: copper.email,
                                environment: copper.environment || 'production'
                            });
                        }
                    }
                }
                
                // Load RingCentral settings
                if (data.connections.ringcentral) {
                    const rc = data.connections.ringcentral;
                    const envEl = document.getElementById('ringcentral-environment');
                    if (envEl) envEl.value = rc.environment || 'production';
                    const cidEl = document.getElementById('ringcentral-client-id');
                    if (cidEl) cidEl.value = rc.clientId || '';
                    const redirEl = document.getElementById('ringcentral-redirect-uri');
                    if (redirEl) redirEl.value = rc.redirectUri || 'https://kanvaportal.web.app/rc/auth/callback';
                    const rcStatus = document.getElementById('ringcentral-status');
                    if (rcStatus) this.updateIntegrationStatus(rcStatus, rc.clientId ? 'ok' : 'warning', rc.clientId ? 'Configured' : 'Missing Client ID');
                }

                // Load Fishbowl credentials
                if (data.connections.fishbowl) {
                    const fishbowl = data.connections.fishbowl;
                    const fishbowlHostEl = document.getElementById('fishbowl-host');
                    if (fishbowlHostEl) fishbowlHostEl.value = fishbowl.host || 'localhost';
                    const fishbowlPortEl = document.getElementById('fishbowl-port');
                    if (fishbowlPortEl) fishbowlPortEl.value = fishbowl.port || '28192';
                    const fishbowlUsernameEl = document.getElementById('fishbowl-username');
                    if (fishbowlUsernameEl) fishbowlUsernameEl.value = fishbowl.username || '';
                    const fishbowlPasswordEl = document.getElementById('fishbowl-password');
                    if (fishbowlPasswordEl) fishbowlPasswordEl.value = fishbowl.password || '';
                    
                    // Update status if username and password exist
                    if (fishbowl.username && fishbowl.password) {
                        const statusElement = document.getElementById('fishbowl-status');
                        this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                        
                        // Initialize Fishbowl integration with credentials if available
                        if (window.FishbowlIntegration && !window.fishbowlIntegration) {
                            window.fishbowlIntegration = new window.FishbowlIntegration({
                                host: fishbowl.host || 'localhost',
                                port: fishbowl.port || '28192',
                                username: fishbowl.username,
                                password: fishbowl.password
                            });
                        }
                    }
                }
            }
            } catch (jsonError) {
                console.error('❌ Error parsing integrations data JSON:', jsonError);
            }
        } catch (error) {
            console.error('❌ Error loading integrations data:', error);
        }
    }

    /**
     * Update integration status indicator
     */
    updateIntegrationStatus(element, status, message) {
        if (!element) return;
        
        const indicator = element.querySelector('.status-indicator');
        const text = element.querySelector('span:last-child');
        
        if (indicator) {
            indicator.className = 'status-indicator';
            
            switch (status) {
                case 'ok':
                    indicator.classList.add('status-ok');
                    indicator.innerHTML = '✅';
                    break;
                case 'error':
                    indicator.classList.add('status-error');
                    indicator.innerHTML = '❌';
                    break;
                case 'warning':
                    indicator.classList.add('status-warning');
                    indicator.innerHTML = '⚠️';
                    break;
                case 'testing':
                    indicator.classList.add('status-testing');
                    indicator.innerHTML = '⏳';
                    break;
                default:
                    indicator.classList.add('status-unknown');
                    indicator.innerHTML = '❓';
            }
        }
        
        if (text && message) {
            text.textContent = message;
        }
    }

    // =====================================
    // PASSWORD TOGGLE AND PICTURE UPLOAD METHODS
    // =====================================

    /**
     * Password visibility function - now just a stub since we're making passwords always visible
     */
    togglePasswordVisibility(button) {
        // Function kept as a stub to prevent errors, but no longer toggles password visibility
        console.log('Password toggle functionality removed - passwords are now always visible');
    }

    /**
     * Handle picture upload with resizing and validation
     */
    async handlePictureUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            this.showNotification('❌ Please select a valid image file (JPEG, PNG, GIF, etc.)', 'error');
            return;
        }
        
        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showNotification('⚠️ Image size should be less than 5MB', 'warning');
            return;
        }
        
        // Show loading state
        const container = event.target.closest('.image-upload-container');
        const previewImg = container.querySelector('.image-preview');
        const placeholder = container.querySelector('.upload-placeholder');
        const removeBtn = container.querySelector('.btn-outline-secondary');
        const uploadBtn = container.querySelector('.image-upload-btn');
        
        const originalBtnText = uploadBtn.textContent;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Processing...';
        
        try {
            // Resize image before preview
            const resizedImageUrl = await this.resizeImage(file, 800, 800, 0.8);
            
            // Update preview
            previewImg.src = resizedImageUrl;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-block';
            
            // Store the resized image data for form submission
            event.target.setAttribute('data-image-data', resizedImageUrl);
            
            // Show success feedback
            this.showNotification('✅ Image uploaded successfully', 'success');
            console.log('🖼️ Image processed and preview updated');
            
        } catch (error) {
            console.error('Error processing image:', error);
            this.showNotification('❌ Failed to process image. Please try another one.', 'error');
            
            // Reset to default state
            previewImg.src = 'assets/logo/Kanva_Logo_White_Master.png';
            placeholder.style.display = 'block';
            removeBtn.style.display = 'none';
            event.target.value = ''; // Clear file input
            event.target.removeAttribute('data-image-data');
        } finally {
            // Restore button state
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalBtnText;
        }
    }

    /**
     * Setup inline editing for table cells
     */
    setupInlineEditing() {
        const editableCells = document.querySelectorAll('.editable');
        
        editableCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                this.startInlineEdit(e.target);
            });
        });
    }

    /**
     * Start inline editing for a cell
     */
    startInlineEdit(cell) {
        if (cell.querySelector('input')) return; // Already editing
        
        const originalValue = cell.textContent.replace('$', '').trim();
        const field = cell.dataset.field;
        const productId = cell.dataset.id || cell.closest('tr').dataset.productId;
        
        // Create input element
        const input = document.createElement('input');
        input.type = field === 'price' || field === 'msrp' || field === 'cost' || field === 'unitsPerCase' ? 'number' : 'text';
        input.value = originalValue;
        input.className = 'inline-edit-input';
        
        // Replace cell content with input
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        // Handle save on Enter or blur
        const saveEdit = async () => {
            const newValue = input.value.trim();
            if (newValue !== originalValue) {
                await this.saveInlineEdit(productId, field, newValue, cell);
            } else {
                // Restore original value
                cell.textContent = field.includes('price') || field.includes('cost') ? `$${originalValue}` : originalValue;
            }
        };
        
        // Handle cancel on Escape
        const cancelEdit = () => {
            cell.textContent = field.includes('price') || field.includes('cost') ? `$${originalValue}` : originalValue;
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    }

    /**
     * Save inline edit changes
     */
    async saveInlineEdit(itemId, field, newValue, cell) {
        try {
            console.log(`💾 Saving ${field} for item ${itemId}: ${newValue}`);
            console.log(`🔍 Current section: ${this.currentSection}`);
            
            // Determine data type based on current section
            let success = false;
            if (this.currentSection === 'products') {
                console.log('📎 Using updateProductData');
                success = await this.updateProductData(itemId, field, newValue);
            } else if (this.currentSection === 'tiers') {
                console.log('📎 Using updateTierData');
                success = await this.updateTierData(itemId, field, newValue);
            } else if (this.currentSection === 'shipping') {
                console.log('📎 Using updateShippingData');
                success = await this.updateShippingData(itemId, field, newValue);
            } else {
                console.error(`❌ Unknown section: ${this.currentSection}`);
                throw new Error(`Unknown section: ${this.currentSection}`);
            }
            
            if (success) {
                // Update cell display
                const displayValue = field.includes('price') || field.includes('cost') || field.includes('Percentage') ? 
                    (field.includes('Percentage') ? `${newValue}%` : `$${newValue}`) : newValue;
                cell.textContent = displayValue;
                
                // Show success feedback
                cell.classList.add('edit-success');
                setTimeout(() => cell.classList.remove('edit-success'), 2000);
                
                this.showNotification(`Updated ${field} successfully`, 'success');
                
                // Refresh frontend data if calculator exists
                this.refreshFrontendData();
            } else {
                throw new Error('Failed to update data');
            }
        } catch (error) {
            console.error('Failed to save inline edit:', error);
            cell.textContent = field.includes('price') || field.includes('cost') ? `$${cell.dataset.originalValue || '0'}` : cell.dataset.originalValue || '';
            cell.classList.add('edit-error');
            setTimeout(() => cell.classList.remove('edit-error'), 2000);
            this.showNotification(`Failed to update ${field}: ${error.message}`, 'error');
        }
    }

    /**
     * Update product data and save to Firebase
     */
    async updateProductData(productId, field, newValue) {
        try {
            console.log(`🔄 Updating product ${productId} field ${field} to: ${newValue}`);
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            // Get current product data from Firebase
            const currentProduct = await window.firebaseDataService.getDocument(`products/${productId}`);
            
            if (!currentProduct || Object.keys(currentProduct).length === 0) {
                throw new Error(`Product ${productId} not found in Firebase`);
            }
            
            // Update the specific field with proper type conversion
            const updatedProduct = { ...currentProduct };
            
            if (field === 'price' || field === 'msrp' || field === 'cost' || field === 'retailPrice') {
                updatedProduct[field] = parseFloat(newValue);
            } else if (field === 'unitsPerCase') {
                updatedProduct[field] = parseInt(newValue);
            } else {
                updatedProduct[field] = newValue;
            }
            
            console.log(`📝 Updated product data:`, updatedProduct);
            
            // Save to Firebase
            const success = await window.firebaseDataService.saveDocument(`products/${productId}`, updatedProduct);
            
            if (success) {
                console.log('✅ Product data saved to Firebase successfully');
                
                // Clear cache to force refresh
                window.firebaseDataService.clearCache();
                
                return true;
            } else {
                throw new Error('Failed to save to Firebase');
            }
            
        } catch (error) {
            console.error('❌ Error updating product data:', error);
            return false;
        }
    }

    /**
     * Update tier data and save to Firebase
     */
    async updateTierData(tierId, field, newValue) {
        try {
            console.log(`🔄 Updating tier ${tierId} field ${field} to: ${newValue}`);
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            // Get current tiers data from Firebase
            const tiersData = await window.firebaseDataService.getDocument('pricing/tiers');
            
            if (!tiersData || !tiersData[tierId]) {
                throw new Error(`Tier ${tierId} not found in Firebase`);
            }
            
            // Update the specific field with proper type conversion
            const updatedTiersData = { ...tiersData };
            
            if (field === 'threshold' || field === 'minQuantity') {
                updatedTiersData[tierId][field] = parseInt(newValue);
            } else if (field === 'margin' || field === 'discount') {
                // Remove % sign if present and handle percentage formatting
                const numValue = parseFloat(newValue.toString().replace('%', ''));
                updatedTiersData[tierId][field] = field === 'margin' ? `${numValue}%` : numValue;
            } else {
                updatedTiersData[tierId][field] = newValue;
            }
            
            console.log(`📝 Updated tier data:`, updatedTiersData[tierId]);
            
            // Save to Firebase
            const success = await window.firebaseDataService.saveDocument('pricing/tiers', updatedTiersData);
            
            if (success) {
                console.log('✅ Tier data saved to Firebase successfully');
                
                // Clear cache to force refresh
                window.firebaseDataService.clearCache();
                
                return true;
            } else {
                throw new Error('Failed to save to Firebase');
            }
            
        } catch (error) {
            console.error('❌ Error updating tier data:', error);
            return false;
        }
    }

    /**
     * Update shipping data and save to Firebase
     */
    async updateShippingData(zoneId, field, newValue) {
        try {
            console.log(`🔄 Updating shipping zone ${zoneId} field ${field} to: ${newValue}`);
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            // Get current shipping data from Firebase
            const shippingData = await window.firebaseDataService.getDocument('shipping/config');
            
            if (!shippingData || !shippingData.zones || !shippingData.zones[zoneId]) {
                throw new Error(`Shipping zone ${zoneId} not found in Firebase`);
            }
            
            // Update the specific field with proper type conversion
            const updatedShippingData = { ...shippingData };
            
            if (field === 'ltlPercentage') {
                updatedShippingData.zones[zoneId][field] = parseFloat(newValue);
            } else if (field === 'states') {
                // Convert comma-separated string to array
                updatedShippingData.zones[zoneId][field] = newValue.split(',').map(s => s.trim());
            } else {
                updatedShippingData.zones[zoneId][field] = newValue;
            }
            
            console.log(`📝 Updated shipping zone:`, updatedShippingData.zones[zoneId]);
            
            // Save to Firebase
            const success = await window.firebaseDataService.saveDocument('shipping/config', updatedShippingData);
            
            if (success) {
                console.log('✅ Shipping data saved to Firebase successfully');
                
                // Clear cache to force refresh
                window.firebaseDataService.clearCache();
                
                return true;
            } else {
                throw new Error('Failed to save to Firebase');
            }
            
        } catch (error) {
            console.error('❌ Error updating shipping data:', error);
            return false;
        }
    }

    /**
     * Save data to Git repository
     */
    async saveDataToGit(filename, data) {
        try {
            // Use AdminManager if available (works in Copper environment)
            if (this.adminManager && typeof this.adminManager.saveData === 'function') {
                const result = await this.adminManager.saveData(`data/${filename}`, JSON.stringify(data, null, 2));
                return { success: true, result };
            }
            
            // Fallback for local development
            if (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1') {
                const response = await fetch('/api/save-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: `data/${filename}`,
                        data: JSON.stringify(data, null, 2),
                        message: `Update ${filename} via admin dashboard`
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    return { success: true, result };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // If we get here, we're in an unsupported environment
            throw new Error('Cannot save data in this environment. AdminManager is not available.');
            
        } catch (error) {
            console.error('Error saving data:', error);
            return { 
                success: false, 
                message: error.message || 'Failed to save data',
                details: error.stack
            };
        }
    }

    /**
     * Render tiers table
     */
    renderTiersTable(tiers = null) {
        const tableBody = document.getElementById('tiers-table-body');
        if (!tableBody) return;
        
        const tiersData = tiers || this.tiersData;
        
        if (!tiersData || tiersData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="no-data-row">No tiers data available</td></tr>';
            return;
        }
        
        const rows = tiersData.map(tier => `
            <tr data-tier-id="${tier.id}">
                <td>${tier.id}</td>
                <td class="editable" data-field="name" data-id="${tier.id}">${tier.name || ''}</td>
                <td class="editable" data-field="threshold" data-id="${tier.id}">${tier.threshold || tier.minQuantity || 0}</td>
                <td class="editable" data-field="margin" data-id="${tier.id}">${tier.margin || tier.discount || '0%'}</td>
                <td class="editable" data-field="description" data-id="${tier.id}">${tier.description || ''}</td>
                <td>
                    <span class="status-badge ${tier.active !== false ? 'active' : 'inactive'}">
                        ${tier.active !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.editTier('${tier.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.adminDashboard.deleteTier('${tier.id}')">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = rows;
        
        // Setup inline editing
        this.setupInlineEditing();
    }
    
    /**
     * Render shipping table
     */
    renderShippingTable(shipping = null) {
        const tableBody = document.getElementById('shipping-table-body');
        if (!tableBody) return;
        
        const shippingData = shipping || this.shippingData;
        
        if (!shippingData || shippingData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="no-data-row">No shipping data available</td></tr>';
            return;
        }
        
        const rows = shippingData.map(zone => `
            <tr data-zone-id="${zone.id}">
                <td>${zone.id}</td>
                <td class="editable" data-field="name" data-id="${zone.id}">${zone.name || ''}</td>
                <td class="editable" data-field="ltlPercentage" data-id="${zone.id}">${zone.ltlPercentage || 0}%</td>
                <td class="editable" data-field="states" data-id="${zone.id}">${Array.isArray(zone.states) ? zone.states.join(', ') : zone.states || ''}</td>
                <td>
                    <span class="color-indicator" style="background-color: ${zone.color || '#4CAF50'};"></span>
                    ${zone.color || '#4CAF50'}
                </td>
                <td>
                    <span class="status-badge ${zone.active !== false ? 'active' : 'inactive'}">
                        ${zone.active !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.editShippingZone('${zone.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.adminDashboard.deleteShippingZone('${zone.id}')">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = rows;
        
        // Setup inline editing
        this.setupInlineEditing();
    }
    
    /**
     * Render tiers error
     */
    renderTiersError() {
        const tableBody = document.getElementById('tiers-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    <div class="error-message">
                        <span class="error-icon">❌</span>
                        Failed to load tiers data
                        <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.loadTiersData()" style="margin-left: 10px;">
                            🔄 Try Again
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    /**
     * Render shipping error
     */
    renderShippingError() {
        const tableBody = document.getElementById('shipping-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    <div class="error-message">
                        <span class="error-icon">❌</span>
                        Failed to load shipping data
                        <button class="btn btn-sm btn-primary" onclick="window.adminDashboard.loadShippingData()" style="margin-left: 10px;">
                            🔄 Try Again
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Edit tier (placeholder for modal)
     */
    editTier(tierId) {
        console.log('Edit tier:', tierId);
        this.showNotification('Tier editing modal coming soon!', 'info');
    }

    /**
     * Delete tier
     */
    async deleteTier(tierId) {
        if (!confirm(`Are you sure you want to delete tier ${tierId}?`)) return;
        
        try {
            // Load current tiers data
            const response = await fetch('data/tiers.json');
            if (!response.ok) throw new Error('Failed to load tiers data');
            
            const tiersData = await response.json();
            
            // Remove the tier
            delete tiersData[tierId];
            
            // Save back to Git
            const saveResult = await this.saveDataToGit('tiers.json', tiersData);
            
            if (saveResult.success) {
                this.showNotification(`Tier ${tierId} deleted successfully`, 'success');
                this.loadTiersData(); // Reload data
            } else {
                throw new Error(saveResult.message || 'Failed to save changes');
            }
        } catch (error) {
            console.error('Error deleting tier:', error);
            this.showNotification(`Failed to delete tier: ${error.message}`, 'error');
        }
    }

    /**
     * Edit shipping zone (placeholder for modal)
     */
    editShippingZone(zoneId) {
        console.log('Edit shipping zone:', zoneId);
        this.showNotification('Shipping zone editing modal coming soon!', 'info');
    }

    /**
     * Delete shipping zone
     */
    async deleteShippingZone(zoneId) {
        if (!confirm(`Are you sure you want to delete shipping zone ${zoneId}?`)) return;
        
        try {
            // Load current shipping data
            const response = await fetch('data/shipping.json');
            if (!response.ok) throw new Error('Failed to load shipping data');
            
            const shippingData = await response.json();
            
            // Remove the zone from zones object
            if (shippingData.zones && shippingData.zones[zoneId]) {
                delete shippingData.zones[zoneId];
                
                // Save back to Git
                const saveResult = await this.saveDataToGit('shipping.json', shippingData);
                
                if (saveResult.success) {
                    this.showNotification(`Shipping zone ${zoneId} deleted successfully`, 'success');
                    this.loadShippingData(); // Reload data
                } else {
                    throw new Error(saveResult.message || 'Failed to save changes');
                }
            } else {
                throw new Error(`Shipping zone ${zoneId} not found`);
            }
        } catch (error) {
            console.error('Error deleting shipping zone:', error);
            this.showNotification(`Failed to delete shipping zone: ${error.message}`, 'error');
        }
    }

    /**
     * Clear picture upload and reset to default state
     */
    clearPictureUpload(removeBtn) {
        const container = removeBtn.closest('.image-upload-container');
        const fileInput = container.querySelector('input[type="file"]');
        const previewImg = container.querySelector('.image-preview');
        const placeholder = container.querySelector('.upload-placeholder');
        
        // Clear file input and reset to fallback logo
        fileInput.value = '';
        fileInput.removeAttribute('data-image-data');
        previewImg.src = 'assets/logo/Kanva_Logo_White_Master.png';
        previewImg.style.display = 'block';
        placeholder.style.display = 'block';
        placeholder.textContent = '📷 Click to upload product image (200x200 recommended)';
        removeBtn.style.display = 'none';
        
        console.log('🗑️ Image cleared, reset to fallback logo');
    }

    // =====================================
    // PLACEHOLDER METHODS FOR FUTURE IMPLEMENTATION
    // =====================================

    addNewTier() {
        alert('Add New Tier functionality would be implemented here.');
    }

    addNewShippingZone() {
        alert('Add New Shipping Zone functionality would be implemented here.');
    }

    /**
     * Add new tier (placeholder)
     */
    addNewTier() {
        this.showNotification('Add New Tier functionality coming soon!', 'info');
    }

    /**
     * Export tiers data
     */
    exportTiers() {
        try {
            if (!this.tiersData || this.tiersData.length === 0) {
                this.showNotification('No tiers data to export', 'warning');
                return;
            }
            
            const csvContent = this.convertToCSV(this.tiersData, ['id', 'name', 'threshold', 'margin', 'description']);
            this.downloadCSV(csvContent, 'tiers-export.csv');
            this.showNotification('Tiers data exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Failed to export tiers data', 'error');
        }
    }

    /**
     * Export shipping data
     */
    exportShipping() {
        try {
            if (!this.shippingData || this.shippingData.length === 0) {
                this.showNotification('No shipping data to export', 'warning');
                return;
            }
            
            const csvContent = this.convertToCSV(this.shippingData, ['id', 'name', 'ltlPercentage', 'states', 'color']);
            this.downloadCSV(csvContent, 'shipping-export.csv');
            this.showNotification('Shipping data exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Failed to export shipping data', 'error');
        }
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data, headers) {
        const csvHeaders = headers.join(',');
        const csvRows = data.map(item => {
            return headers.map(header => {
                const value = item[header];
                if (Array.isArray(value)) {
                    return `"${value.join('; ')}"`;
                }
                return `"${value || ''}"`;
            }).join(',');
        });
        
        return [csvHeaders, ...csvRows].join('\n');
    }

    /**
     * Download CSV file
     */
    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Add new product
     */
    addNewProduct() {
        console.log('➕ Adding new product...');
        this.showProductModal();
    }

    /**
     * Show product modal for adding/editing
     */
    showProductModal(productId = null) {
        const isEdit = productId !== null;
        const title = isEdit ? '✏️ Edit Product' : '➕ Add New Product';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="product-edit-modal modern-modal">
                <div class="modal-header">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h3>${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
                            <p class="modal-subtitle">${isEdit ? 'Update product information and settings' : 'Create a new product for the catalog'}</p>
                        </div>
                    </div>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                
                <form id="product-form" class="modal-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="product-id">
                                <span class="label-text">Product ID</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <input type="text" id="product-id" name="id" required ${isEdit ? 'readonly style="background: #f8f9fa; color: #6c757d;"' : ''} 
                                   placeholder="e.g., focus, release, zoom" class="form-input">
                            <small class="form-help">Unique identifier for this product</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="product-name">
                                <span class="label-text">Product Name</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <input type="text" id="product-name" name="name" required 
                                   placeholder="e.g., Focus+Flow" class="form-input">
                            <small class="form-help">Display name for customers</small>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="product-price">
                                <span class="label-text">Distribution Price</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <div class="input-with-suffix">
                                <input type="number" id="product-price" name="price" step="0.01" required 
                                       placeholder="4.50" class="form-input">
                                <span class="input-suffix">$</span>
                            </div>
                            <small class="form-help">Wholesale price per unit for distributors</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="product-retail-price">
                                <span class="label-text">Retail Price</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <div class="input-with-suffix">
                                <input type="number" id="product-retail-price" name="retailPrice" step="0.01" required 
                                       placeholder="5.50" class="form-input">
                                <span class="input-suffix">$</span>
                            </div>
                            <small class="form-help">Direct retail price per unit for stores</small>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="product-msrp">
                                <span class="label-text">MSRP</span>
                            </label>
                            <div class="input-with-suffix">
                                <input type="number" id="product-msrp" name="msrp" step="0.01" 
                                       placeholder="9.99" class="form-input">
                                <span class="input-suffix">$</span>
                            </div>
                            <small class="form-help">Manufacturer's suggested retail price</small>
                        </div>
                        
                        <div class="form-group">
                            <!-- Spacer for layout -->
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="product-category">
                                <span class="label-text">Category</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <select id="product-category" name="category" required class="form-input">
                                <option value="">Select Category</option>
                                <option value="2oz_wellness">2oz Wellness</option>
                                <option value="energy_shots">Energy Shots</option>
                                <option value="extract_shots">Extract Shots</option>
                                <option value="supplements">Supplements</option>
                                <option value="beverages">Beverages</option>
                            </select>
                            <small class="form-help">Product category for organization</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="product-units">
                                <span class="label-text">Units Per Case</span>
                            </label>
                            <input type="number" id="product-units" name="unitsPerCase" 
                                   placeholder="144" class="form-input">
                            <small class="form-help">Number of units in a master case</small>
                        </div>
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="product-description">
                            <span class="label-text">Description</span>
                        </label>
                        <textarea id="product-description" name="description" rows="3" 
                                  placeholder="Product description..." class="form-textarea"></textarea>
                        <small class="form-help">Detailed product description for customers</small>
                    </div>
                    
                    <!-- Image Upload Section -->
                    <div class="form-group">
                        <label>Product Image</label>
                        <div class="image-upload-section">
                            <div class="current-image" id="current-image" style="display: none;">
                                <img id="current-image-preview" src="" alt="Current image" />
                                <button type="button" class="btn btn-small btn-secondary" onclick="window.adminDashboard.removeCurrentImage()">
                                    Remove Image
                                </button>
                            </div>
                            
                            <div class="image-drop-zone-small" id="product-image-drop-zone">
                                <div class="drop-zone-content">
                                    <div class="drop-zone-icon">📷</div>
                                    <p>Drag & drop image or <button type="button" class="btn-link" onclick="document.getElementById('product-image-input').click()">browse</button></p>
                                    <small>Recommended: 200x200px, JPG/PNG</small>
                                </div>
                            </div>
                            
                            <input type="file" id="product-image-input" accept="image/*" style="display: none;" />
                            
                            <div class="image-preview-small" id="product-image-preview" style="display: none;">
                                <img id="preview-image-small" src="" alt="Preview" />
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${isEdit ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.setupProductFormHandlers(productId);
        
        // Load existing product data if editing
        if (isEdit) {
            this.loadProductDataIntoForm(productId);
        }
    }

    /**
     * Setup product form handlers
     */
    setupProductFormHandlers(productId) {
        const form = document.getElementById('product-form');
        const imageDropZone = document.getElementById('product-image-drop-zone');
        const imageInput = document.getElementById('product-image-input');
        const imagePreview = document.getElementById('product-image-preview');
        const previewImage = document.getElementById('preview-image-small');
        
        let selectedImageFile = null;
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProductForm(productId, selectedImageFile);
        });
        
        // Image drag and drop
        imageDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageDropZone.classList.add('drag-over');
        });
        
        imageDropZone.addEventListener('dragleave', () => {
            imageDropZone.classList.remove('drag-over');
        });
        
        imageDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            imageDropZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleImageSelection(files[0]);
            }
        });
        
        // File input change
        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageSelection(e.target.files[0]);
            }
        });
        
        // Handle image selection
        function handleImageSelection(file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file (JPG, PNG, etc.)');
                return;
            }
            
            selectedImageFile = file;
            
            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                imagePreview.style.display = 'block';
                imageDropZone.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
        
        // Store reference for form submission
        this.selectedProductImageFile = selectedImageFile;
    }

    /**
     * Remove current image preview
     */
    removeCurrentImage() {
        const currentImage = document.getElementById('current-image');
        const imageDropZone = document.getElementById('product-image-drop-zone');
        const imagePreview = document.getElementById('product-image-preview');
        
        currentImage.style.display = 'none';
        imagePreview.style.display = 'none';
        imageDropZone.style.display = 'block';
        
        this.selectedProductImageFile = null;
    }

    /**
     * Save product form
     */
    async saveProductForm(productId, imageFile) {
        try {
            const form = document.getElementById('product-form');
            const formData = new FormData(form);
            
            // Convert form data to object
            const productData = {
                name: formData.get('name'),
                price: parseFloat(formData.get('price')),
                retailPrice: parseFloat(formData.get('retailPrice')),
                msrp: parseFloat(formData.get('msrp')) || null,
                category: formData.get('category'),
                unitsPerCase: parseInt(formData.get('unitsPerCase')) || 1,
                description: formData.get('description') || '',
                image: null // Will be set after image upload
            };
            
            const newProductId = productId || formData.get('id');
            
            // Upload image if provided
            if (imageFile) {
                const imagePath = await this.uploadProductImageFile(newProductId, imageFile);
                productData.image = imagePath;
            }
            
            // Save product data
            const success = await this.saveNewProductData(newProductId, productData);
            
            if (success) {
                this.showNotification(productId ? 'Product updated successfully' : 'Product added successfully', 'success');
                document.querySelector('.modal-overlay').remove();
                this.loadProductsData(); // Refresh table
                this.refreshFrontendData(); // Refresh frontend
            } else {
                throw new Error('Failed to save product data');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            this.showNotification(`Failed to save product: ${error.message}`, 'error');
        }
    }

    /**
     * Upload product image file
     */
    async uploadProductImageFile(productId, file) {
        // Check if we're running on GitHub Pages
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        if (isGitHubPages) {
            // In GitHub Pages mode, convert image to base64 and store locally
            console.log('💾 GitHub Pages mode: Converting image to base64 for local storage');
            
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                return new Promise((resolve, reject) => {
                    img.onload = () => {
                        // Resize to 200x200
                        canvas.width = 200;
                        canvas.height = 200;
                        
                        // Draw image with proper scaling
                        const scale = Math.min(200 / img.width, 200 / img.height);
                        const x = (200 - img.width * scale) / 2;
                        const y = (200 - img.height * scale) / 2;
                        
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, 200, 200);
                        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                        
                        // Convert to base64 data URL
                        const dataURL = canvas.toDataURL('image/png', 0.9);
                        
                        // Generate a simple filename for reference
                        const timestamp = Date.now();
                        const filename = `product_${productId}_${timestamp}.png`;
                        
                        console.log('✅ Image converted to base64 for GitHub Pages mode');
                        resolve(dataURL); // Return base64 data URL instead of server path
                    };
                    
                    img.onerror = () => reject(new Error('Failed to load image'));
                    img.src = URL.createObjectURL(file);
                });
            } catch (error) {
                throw new Error(`Failed to process image: ${error.message}`);
            }
        }
        
        // Local server mode - original upload functionality
        try {
            // Create a canvas to resize the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            return new Promise((resolve, reject) => {
                img.onload = async () => {
                    // Resize to 200x200
                    canvas.width = 200;
                    canvas.height = 200;
                    
                    // Draw image with proper scaling
                    const scale = Math.min(200 / img.width, 200 / img.height);
                    const x = (200 - img.width * scale) / 2;
                    const y = (200 - img.height * scale) / 2;
                    
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, 200, 200);
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                    
                    // Convert to blob
                    canvas.toBlob(async (blob) => {
                        try {
                            // Generate filename
                            const timestamp = Date.now();
                            const filename = `${productId}_${timestamp}.png`;
                            
                            // Upload file to server
                            const formData = new FormData();
                            formData.append('image', blob, filename);
                            formData.append('productId', productId);
                            
                            const uploadResponse = await fetch('/api/upload-image', {
                                method: 'POST',
                                body: formData
                            });
                            
                            if (uploadResponse.ok) {
                                const result = await uploadResponse.json();
                                resolve(result.path);
                            } else {
                                reject(new Error('Failed to upload image to server'));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    }, 'image/png', 0.9);
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = URL.createObjectURL(file);
            });
        } catch (error) {
            throw new Error(`Failed to process image: ${error.message}`);
        }
    }

    /**
     * Save new product data
     */
    async saveNewProductData(productId, productData) {
        try {
            // Load current products data
            const response = await fetch('data/products.json');
            if (!response.ok) throw new Error('Failed to load products data');
            
            const productsData = await response.json();
            
            // Add/update product
            productsData[productId] = productData;
            
            // Save to backend
            const saveResult = await this.saveDataToGit('products.json', productsData);
            
            if (saveResult.success) {
                console.log('✅ Product data saved successfully');
                return true;
            } else {
                throw new Error(saveResult.message || 'Failed to save to Git');
            }
        } catch (error) {
            console.error('Error saving product data:', error);
            return false;
        }
    }

    /**
     * Refresh products data
     */
    refreshProductsData() {
        console.log('🔄 Refreshing products data...');
        this.loadProductsData();
    }

    /**
     * Export products data to CSV
     */
    exportProductsData() {
        try {
            console.log('📄 Exporting products data...');
            
            // Get table data
            const table = document.getElementById('products-table');
            if (!table) {
                this.showNotification('No products data to export', 'error');
                return;
            }
            
            const rows = table.querySelectorAll('tbody tr');
            if (rows.length === 0) {
                this.showNotification('No products data to export', 'error');
                return;
            }
            
            // Create CSV content
            const headers = ['ID', 'Name', 'Price', 'MSRP', 'Cost', 'Category', 'Units Per Case', 'Status'];
            let csvContent = headers.join(',') + '\n';
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 8) {
                    const rowData = [
                        cells[0].textContent.trim(), // ID
                        `"${cells[2].textContent.trim()}"`, // Name (quoted for safety)
                        cells[3].textContent.replace('$', ''), // Price
                        cells[4].textContent.replace('$', ''), // MSRP
                        cells[5].textContent.replace('$', ''), // Cost
                        cells[6].textContent.trim(), // Category
                        cells[7].textContent.trim(), // Units
                        cells[8].textContent.trim() // Status
                    ];
                    csvContent += rowData.join(',') + '\n';
                }
            });
            
            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `kanva-products-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Products data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting products data:', error);
            this.showNotification(`Failed to export data: ${error.message}`, 'error');
        }
    }

    /**
     * Delete product
     */
    async deleteProduct(productId) {
        const confirmed = await this.showConfirmDialog(
            `Are you sure you want to delete product "${productId}"?<br><br>This action cannot be undone and will remove the product from both the admin dashboard and the main application.`,
            'Delete Product',
            'Delete Product',
            'Cancel'
        );
        
        if (!confirmed) {
            return;
        }

        try {
            console.log(`🗑️ Deleting product from Firebase: ${productId}`);
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            // Delete product from Firebase
            const success = await window.firebaseDataService.deleteDocument('products', productId);
            
            if (success) {
                this.showNotification('Product deleted successfully from Firebase', 'success');
                
                // Immediately remove from admin table with animation
                const productRow = document.querySelector(`tr[data-product-id="${productId}"]`);
                if (productRow) {
                    productRow.style.transition = 'all 0.3s ease';
                    productRow.style.opacity = '0';
                    productRow.style.transform = 'translateX(-20px)';
                    setTimeout(() => {
                        productRow.remove();
                    }, 300);
                }
                
                // Refresh admin table data
                setTimeout(() => {
                    this.loadProductsData();
                }, 400);
                
                // Immediately refresh frontend
                this.refreshFrontendData();
                
                // Force refresh main UI product tiles
                this.forceRefreshMainUI();
            } else {
                throw new Error('Failed to delete product from Firebase');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showNotification(`Failed to delete product: ${error.message}`, 'error');
        }
    }

    /**
     * Edit product (opens modal with existing data)
     */
    editProduct(productId) {
        console.log(`✏️ Editing product: ${productId}`);
        this.showProductModal(productId);
    }



    /**
     * Load product data into form for editing
     */
    async loadProductDataIntoForm(productId) {
        try {
            const response = await fetch('data/products.json');
            if (!response.ok) throw new Error('Failed to load products data');
            
            const productsData = await response.json();
            const product = productsData[productId];
            
            if (product) {
                // Populate form fields
                document.getElementById('product-id').value = productId;
                document.getElementById('product-name').value = product.name || '';
                document.getElementById('product-price').value = product.price || '';
                document.getElementById('product-retail-price').value = product.retailPrice || '';
                document.getElementById('product-msrp').value = product.msrp || '';
                document.getElementById('product-category').value = product.category || '';
                document.getElementById('product-units').value = product.unitsPerCase || '';
                document.getElementById('product-description').value = product.description || '';
                
                // Show current image if exists
                if (product.image) {
                    const currentImage = document.getElementById('current-image');
                    const currentImagePreview = document.getElementById('current-image-preview');
                    const imageDropZone = document.getElementById('product-image-drop-zone');
                    
                    currentImagePreview.src = product.image;
                    currentImage.style.display = 'block';
                    imageDropZone.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error loading product data:', error);
            this.showNotification(`Failed to load product data: ${error.message}`, 'error');
        }
    }

    /**
     * Edit product image
     */
    editProductImage(productId) {
        console.log(`📷 Editing image for product: ${productId}`);
        this.showImageUploadModal(productId);
    }

    /**
     * Delete product image
     */
    async deleteProductImage(productId) {
        if (!confirm('Are you sure you want to delete this product image?')) {
            return;
        }

        try {
            console.log(`🗑️ Deleting image for product: ${productId}`);
            
            // Update product data to remove image
            const success = await this.updateProductData(productId, 'image', null);
            
            if (success) {
                this.showNotification('Product image deleted successfully', 'success');
                this.loadProductsData(); // Refresh table
            } else {
                throw new Error('Failed to delete image');
            }
        } catch (error) {
            console.error('Error deleting product image:', error);
            this.showNotification(`Failed to delete image: ${error.message}`, 'error');
        }
    }

    /**
     * Show image upload modal
     */
    showImageUploadModal(productId) {
        const modal = document.createElement('div');
        modal.className = 'image-upload-modal';
        modal.innerHTML = `
            <div class="image-upload-content">
                <div class="image-upload-header">
                    <h3>📷 Upload Product Image</h3>
                    <button class="btn-close" onclick="this.closest('.image-upload-modal').remove()">×</button>
                </div>
                
                <div class="image-drop-zone" id="image-drop-zone">
                    <div class="drop-zone-content">
                        <div class="drop-zone-icon">📷</div>
                        <p><strong>Drag & drop an image here</strong></p>
                        <p>or <button type="button" class="btn btn-secondary" onclick="document.getElementById('image-file-input').click()">Browse Files</button></p>
                        <small>Recommended: 200x200px, JPG/PNG format</small>
                    </div>
                </div>
                
                <input type="file" id="image-file-input" accept="image/*" />
                
                <div class="image-preview" id="image-preview" style="display: none;">
                    <img id="preview-image" src="" alt="Preview" />
                </div>
                
                <div class="image-upload-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.image-upload-modal').remove()">Cancel</button>
                    <button class="btn btn-primary" id="upload-image-btn" disabled onclick="window.adminDashboard.uploadProductImage('${productId}')">Upload Image</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.setupImageUploadHandlers(productId);
    }

    /**
     * Setup image upload handlers
     */
    setupImageUploadHandlers(productId) {
        const dropZone = document.getElementById('image-drop-zone');
        const fileInput = document.getElementById('image-file-input');
        const preview = document.getElementById('image-preview');
        const previewImage = document.getElementById('preview-image');
        const uploadBtn = document.getElementById('upload-image-btn');
        
        let selectedFile = null;
        
        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelection(files[0]);
            }
        });
        
        // File input handler
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
        
        // Handle file selection
        function handleFileSelection(file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file (JPG, PNG, etc.)');
                return;
            }
            
            selectedFile = file;
            
            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                preview.style.display = 'block';
                uploadBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        }
        
        // Store selected file for upload
        this.selectedImageFile = selectedFile;
    }

    /**
     * Upload product image
     */
    async uploadProductImage(productId) {
        const fileInput = document.getElementById('image-file-input');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('Please select an image file', 'error');
            return;
        }
        
        try {
            console.log(`📤 Uploading image for product: ${productId}`);
            
            // Create a canvas to resize the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = async () => {
                // Resize to 200x200
                canvas.width = 200;
                canvas.height = 200;
                
                // Draw image with proper scaling
                const scale = Math.min(200 / img.width, 200 / img.height);
                const x = (200 - img.width * scale) / 2;
                const y = (200 - img.height * scale) / 2;
                
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 200, 200);
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                
                // Convert to blob
                canvas.toBlob(async (blob) => {
                    try {
                        // Generate filename
                        const timestamp = Date.now();
                        const filename = `${productId}_${timestamp}.png`;
                        const imagePath = `assets/product_renders/${filename}`;
                        
                        // Upload file to server
                        const formData = new FormData();
                        formData.append('image', blob, filename);
                        formData.append('productId', productId);
                        
                        const uploadResponse = await fetch('/api/upload-image', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (uploadResponse.ok) {
                            const uploadResult = await uploadResponse.json();
                            // Use the path returned from server
                            const imagePath = uploadResult.path;
                            
                            // Update product data with new image path
                            const success = await this.updateProductData(productId, 'image', imagePath);
                            
                            if (success) {
                                this.showNotification('Image uploaded successfully', 'success');
                                document.querySelector('.image-upload-modal').remove();
                                this.loadProductsData(); // Refresh table
                                this.refreshFrontendData(); // Refresh frontend immediately
                            } else {
                                throw new Error('Failed to update product data');
                            }
                        } else {
                            throw new Error('Failed to upload image to server');
                        }
                    } catch (error) {
                        console.error('Error uploading image:', error);
                        this.showNotification(`Failed to upload image: ${error.message}`, 'error');
                    }
                }, 'image/png', 0.9);
            };
            
            img.src = URL.createObjectURL(file);
            
        } catch (error) {
            console.error('Error processing image:', error);
            this.showNotification(`Failed to process image: ${error.message}`, 'error');
        }
    }

    // ==================== TIER MANAGEMENT METHODS ====================

    /**
     * Add new tier
     */
    addNewTier() {
        console.log('➕ Adding new tier...');
        this.showTierModal();
    }

    /**
     * Show tier modal for adding/editing
     */
    showTierModal(tierId = null) {
        const isEdit = tierId !== null;
        const title = isEdit ? '✏️ Edit Tier' : '➕ Add New Tier';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="tier-edit-modal modern-modal">
                <div class="modal-header">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" fill="currentColor"/>
                            </svg>
                        </div>
                        <div>
                            <h3>${isEdit ? 'Edit Pricing Tier' : 'Add New Pricing Tier'}</h3>
                            <p class="modal-subtitle">${isEdit ? 'Update pricing tier configuration' : 'Create a new pricing tier for volume discounts'}</p>
                        </div>
                    </div>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                
                <form id="add-tier-form" class="modal-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tier-id">
                                <span class="label-text">Tier ID</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <input type="text" id="tier-id" name="tierId" required placeholder="e.g., tier1, tier2, tier3" class="form-input" ${isEdit ? 'readonly style="background: #f8f9fa; color: #6c757d;"' : ''}>
                            <small class="form-help">Unique identifier for this tier</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="tier-name">
                                <span class="label-text">Tier Name</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <input type="text" id="tier-name" name="tierName" required placeholder="e.g., Bronze, Silver, Gold" class="form-input">
                            <small class="form-help">Display name for customers</small>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tier-threshold">
                                <span class="label-text">Minimum Quantity</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <input type="number" id="tier-threshold" name="threshold" required placeholder="1000" class="form-input">
                            <small class="form-help">Minimum order quantity to qualify</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="tier-margin">
                                <span class="label-text">Discount Percentage</span>
                            </label>
                            <div class="input-with-suffix">
                                <input type="number" id="tier-margin" name="margin" step="0.1" placeholder="25.0" class="form-input">
                                <span class="input-suffix">%</span>
                            </div>
                            <small class="form-help">Discount percentage for this tier</small>
                        </div>
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="tier-description">
                            <span class="label-text">Description</span>
                        </label>
                        <textarea id="tier-description" name="description" placeholder="Describe the benefits and requirements for this tier..." class="form-textarea"></textarea>
                        <small class="form-help">Optional description of tier benefits</small>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${isEdit ? 'Update Tier' : 'Create Tier'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.setupTierFormHandlers(tierId);
        
        // Load existing tier data if editing
        if (isEdit) {
            this.loadTierDataIntoForm(tierId);
        }
    }

    /**
     * Setup tier form handlers
     */
    setupTierFormHandlers(tierId) {
        const form = document.getElementById('add-tier-form');
        
        if (!form) {
            console.error('❌ Tier form not found');
            return;
        }
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTierForm(tierId);
        });
    }

    /**
     * Save tier form
     */
    async saveTierForm(tierId) {
        try {
            const form = document.getElementById('add-tier-form');
            if (!form) {
                throw new Error('Tier form not found');
            }
            
            // Get form values directly from inputs
            const tierIdInput = document.getElementById('tier-id');
            const tierNameInput = document.getElementById('tier-name');
            const tierThresholdInput = document.getElementById('tier-threshold');
            const tierMarginInput = document.getElementById('tier-margin');
            const tierDescriptionInput = document.getElementById('tier-description');
            
            const tierData = {
                name: tierNameInput.value.trim(),
                threshold: parseInt(tierThresholdInput.value) || 0,
                margin: tierMarginInput.value ? `${tierMarginInput.value}%` : null,
                description: tierDescriptionInput.value.trim() || ''
            };
            
            const newTierId = tierId || tierIdInput.value.trim();
            
            if (!newTierId || !tierData.name) {
                throw new Error('Tier ID and Name are required');
            }
            
            const success = await this.saveNewTierData(newTierId, tierData);
            
            if (success) {
                this.showNotification(tierId ? 'Tier updated successfully' : 'Tier added successfully', 'success');
                document.querySelector('.modal-overlay').remove();
                this.loadTiersData();
                this.refreshFrontendData();
            } else {
                throw new Error('Failed to save tier data');
            }
        } catch (error) {
            console.error('Error saving tier:', error);
            this.showNotification(`Failed to save tier: ${error.message}`, 'error');
        }
    }

    /**
     * Save new tier data
     */
    async saveNewTierData(tierId, tierData) {
        try {
            const response = await fetch('data/tiers.json');
            if (!response.ok) throw new Error('Failed to load tiers data');
            
            const tiersData = await response.json();
            tiersData[tierId] = tierData;
            
            const saveResult = await this.saveDataToGit('tiers.json', tiersData);
            
            if (saveResult.success) {
                console.log('✅ Tier data saved successfully');
                return true;
            } else {
                throw new Error(saveResult.message || 'Failed to save to Git');
            }
        } catch (error) {
            console.error('Error saving tier data:', error);
            return false;
        }
    }

    /**
     * Delete tier
     */
    async deleteTier(tierId) {
        const confirmed = await this.showConfirmDialog(
            `Are you sure you want to delete tier "${tierId}"?<br><br>This action cannot be undone and will affect pricing calculations.`,
            'Delete Tier',
            'Delete Tier',
            'Cancel'
        );
        
        if (!confirmed) {
            return;
        }

        try {
            console.log(`🗑️ Deleting tier: ${tierId}`);
            
            const response = await fetch('data/tiers.json');
            if (!response.ok) throw new Error('Failed to load tiers data');
            
            const tiersData = await response.json();
            
            if (tiersData[tierId]) {
                delete tiersData[tierId];
                
                const saveResult = await this.saveDataToGit('tiers.json', tiersData);
                
                if (saveResult.success) {
                    this.showNotification('Tier deleted successfully', 'success');
                    this.loadTiersData();
                    this.refreshFrontendData();
                } else {
                    throw new Error(saveResult.message || 'Failed to save changes');
                }
            } else {
                throw new Error(`Tier ${tierId} not found`);
            }
        } catch (error) {
            console.error('Error deleting tier:', error);
            this.showNotification(`Failed to delete tier: ${error.message}`, 'error');
        }
    }

    /**
     * Edit tier
     */
    editTier(tierId) {
        console.log(`✏️ Editing tier: ${tierId}`);
        this.showTierModal(tierId);
    }

    /**
     * Load tier data into form
     */
    async loadTierDataIntoForm(tierId) {
        try {
            const response = await fetch('data/tiers.json');
            if (!response.ok) throw new Error('Failed to load tiers data');
            
            const tiersData = await response.json();
            const tier = tiersData[tierId];
            
            if (tier) {
                document.getElementById('tier-id').value = tierId;
                document.getElementById('tier-name').value = tier.name || '';
                document.getElementById('tier-threshold').value = tier.threshold || '';
                document.getElementById('tier-margin').value = tier.margin ? tier.margin.replace('%', '') : '';
                document.getElementById('tier-description').value = tier.description || '';
            }
        } catch (error) {
            console.error('Error loading tier data:', error);
            this.showNotification(`Failed to load tier data: ${error.message}`, 'error');
        }
    }

    // ==================== SHIPPING MANAGEMENT METHODS ====================

    /**
     * Add new shipping zone
     */
    addNewShippingZone() {
        console.log('➕ Adding new shipping zone...');
        this.showShippingModal();
    }

    /**
     * Show shipping modal for adding/editing
     */
    showShippingModal(zoneId = null) {
        const isEdit = zoneId !== null;
        const title = isEdit ? '✏️ Edit Shipping Zone' : '➕ Add New Shipping Zone';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="shipping-edit-modal modern-modal">
                <div class="modal-header">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H8C7.4 20 7 19.6 7 19V13M9 17H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h3>${isEdit ? 'Edit Shipping Zone' : 'Add New Shipping Zone'}</h3>
                            <p class="modal-subtitle">${isEdit ? 'Update shipping zone configuration' : 'Create a new shipping zone for regional pricing'}</p>
                        </div>
                    </div>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                
                <form id="shipping-form" class="modal-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="zone-id">
                                <span class="label-text">Zone ID</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <input type="text" id="zone-id" name="id" required ${isEdit ? 'readonly' : ''} 
                                   placeholder="e.g., west, east, central" class="form-input" ${isEdit ? 'style="background: #f8f9fa; color: #6c757d;"' : ''}>
                            <small class="form-help">Unique identifier for this zone</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="zone-name">
                                <span class="label-text">Zone Name</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <input type="text" id="zone-name" name="name" required 
                                   placeholder="e.g., West Coast, East Coast" class="form-input">
                            <small class="form-help">Display name for this zone</small>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="zone-ltl">
                                <span class="label-text">LTL Percentage</span>
                                <span class="required-indicator">*</span>
                            </label>
                            <div class="input-with-suffix">
                                <input type="number" id="zone-ltl" name="ltlPercentage" step="0.1" required 
                                       placeholder="15.0" class="form-input">
                                <span class="input-suffix">%</span>
                            </div>
                            <small class="form-help">Less-than-truckload shipping percentage</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="zone-color">
                                <span class="label-text">Zone Color</span>
                            </label>
                            <div class="color-input-wrapper">
                                <input type="color" id="zone-color" name="color" class="form-color-input" value="#ff6b35">
                                <div class="color-preview" id="color-preview"></div>
                            </div>
                            <small class="form-help">Color identifier for maps and charts</small>
                        </div>
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="zone-states">
                            <span class="label-text">States</span>
                        </label>
                        <textarea id="zone-states" name="states" rows="3" 
                                  placeholder="CA, OR, WA, NV, AZ" class="form-textarea"></textarea>
                        <small class="form-help">Comma-separated list of state abbreviations covered by this zone</small>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${isEdit ? 'Update Zone' : 'Create Zone'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.setupShippingFormHandlers(zoneId);
        this.setupColorPicker();
        
        // Load existing zone data if editing
        if (isEdit) {
            this.loadShippingDataIntoForm(zoneId);
        }
    }

    /**
     * Setup color picker functionality
     */
    setupColorPicker() {
        const colorInput = document.getElementById('zone-color');
        const colorPreview = document.getElementById('color-preview');
        
        if (colorInput && colorPreview) {
            // Update preview when color changes
            colorInput.addEventListener('input', (e) => {
                colorPreview.style.backgroundColor = e.target.value;
            });
            
            // Set initial color
            colorPreview.style.backgroundColor = colorInput.value;
        }
    }

    /**
     * Setup shipping form handlers
     */
    setupShippingFormHandlers(zoneId) {
        const form = document.getElementById('shipping-form');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveShippingForm(zoneId);
        });
    }

    /**
     * Save shipping form
     */
    async saveShippingForm(zoneId) {
        try {
            const form = document.getElementById('shipping-form');
            const formData = new FormData(form);
            
            const zoneData = {
                name: formData.get('name'),
                ltlPercentage: parseFloat(formData.get('ltlPercentage')),
                color: formData.get('color') || '#007bff',
                states: formData.get('states') ? formData.get('states').split(',').map(s => s.trim()) : []
            };
            
            const newZoneId = zoneId || formData.get('id');
            const success = await this.saveNewShippingData(newZoneId, zoneData);
            
            if (success) {
                this.showNotification(zoneId ? 'Shipping zone updated successfully' : 'Shipping zone added successfully', 'success');
                document.querySelector('.admin-modal').remove();
                this.loadShippingData();
            } else {
                throw new Error('Failed to save shipping zone data');
            }
        } catch (error) {
            console.error('Error saving shipping zone:', error);
            this.showNotification(`Failed to save shipping zone: ${error.message}`, 'error');
        }
    }

    /**
     * Save new shipping data
     */
    async saveNewShippingData(zoneId, zoneData) {
        try {
            const response = await fetch('data/shipping.json');
            if (!response.ok) throw new Error('Failed to load shipping data');
            
            const shippingData = await response.json();
            
            if (!shippingData.zones) {
                shippingData.zones = {};
            }
            
            shippingData.zones[zoneId] = zoneData;
            
            const saveResult = await this.saveDataToGit('shipping.json', shippingData);
            
            if (saveResult.success) {
                console.log('✅ Shipping data saved successfully');
                return true;
            } else {
                throw new Error(saveResult.message || 'Failed to save to Git');
            }
        } catch (error) {
            console.error('Error saving shipping data:', error);
            return false;
        }
    }

    /**
     * Delete shipping zone
     */
    async deleteShippingZone(zoneId) {
        const confirmed = await this.showConfirmDialog(
            `Are you sure you want to delete shipping zone "${zoneId}"?<br><br>This action cannot be undone and will affect shipping calculations.`,
            'Delete Shipping Zone',
            'Delete Zone',
            'Cancel'
        );
        
        if (!confirmed) {
            return;
        }

        try {
            console.log(`🗑️ Deleting shipping zone: ${zoneId}`);
            
            const response = await fetch('data/shipping.json');
            if (!response.ok) throw new Error('Failed to load shipping data');
            
            const shippingData = await response.json();
            
            if (shippingData.zones && shippingData.zones[zoneId]) {
                delete shippingData.zones[zoneId];
                
                const saveResult = await this.saveDataToGit('shipping.json', shippingData);
                
                if (saveResult.success) {
                    this.showNotification('Shipping zone deleted successfully', 'success');
                    this.loadShippingData();
                    this.refreshFrontendData();
                } else {
                    throw new Error(saveResult.message || 'Failed to save changes');
                }
            } else {
                throw new Error(`Shipping zone ${zoneId} not found`);
            }
        } catch (error) {
            console.error('Error deleting shipping zone:', error);
            this.showNotification(`Failed to delete shipping zone: ${error.message}`, 'error');
        }
    }

    /**
     * Edit shipping zone
     */
    editShippingZone(zoneId) {
        console.log(`✏️ Editing shipping zone: ${zoneId}`);
        this.showShippingModal(zoneId);
    }

    /**
     * Load shipping data into form
     */
    async loadShippingDataIntoForm(zoneId) {
        try {
            const response = await fetch('data/shipping.json');
            if (!response.ok) throw new Error('Failed to load shipping data');
            
            const shippingData = await response.json();
            const zone = shippingData.zones && shippingData.zones[zoneId];
            
            if (zone) {
                document.getElementById('zone-id').value = zoneId;
                document.getElementById('zone-name').value = zone.name || '';
                document.getElementById('zone-ltl').value = zone.ltlPercentage || '';
                document.getElementById('zone-color').value = zone.color || '#007bff';
                document.getElementById('zone-states').value = Array.isArray(zone.states) ? zone.states.join(', ') : '';
            }
        } catch (error) {
            console.error('Error loading shipping data:', error);
            this.showNotification(`Failed to load shipping data: ${error.message}`, 'error');
        }
    }

    /**
     * Show custom confirmation dialog
     */
    showConfirmDialog(message, title = 'Confirm Action', confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'confirm-dialog-modal';
            modal.innerHTML = `
                <div class="confirm-dialog-content">
                    <div class="confirm-dialog-header">
                        <h3>⚠️ ${title}</h3>
                    </div>
                    
                    <div class="confirm-dialog-body">
                        <p>${message}</p>
                    </div>
                    
                    <div class="confirm-dialog-actions">
                        <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
                        <button class="btn btn-danger" id="confirm-ok">${confirmText}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Focus on cancel button by default
            const cancelBtn = modal.querySelector('#confirm-cancel');
            const confirmBtn = modal.querySelector('#confirm-ok');
            
            cancelBtn.addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            
            confirmBtn.addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            
            // Close on escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            
            document.addEventListener('keydown', handleEscape);
            
            // Focus on confirm button
            setTimeout(() => confirmBtn.focus(), 100);
        });
    }

    /**
     * Force refresh main UI product tiles
     */
    forceRefreshMainUI() {
        try {
            // Clear any cached product data
            if (window.productData) {
                delete window.productData;
            }
            
            // Force reload product data in main UI
            if (window.productManager && typeof window.productManager.loadProducts === 'function') {
                console.log('🔄 Force refreshing main UI product tiles...');
                window.productManager.loadProducts();
            }
            
            // Force refresh calculator data
            if (window.calculator && typeof window.calculator.loadData === 'function') {
                console.log('🔄 Force refreshing calculator data...');
                window.calculator.loadData();
            }
            
            // Clear image cache by adding timestamp to image sources
            const productImages = document.querySelectorAll('img[src*="product_renders"]');
            productImages.forEach(img => {
                const originalSrc = img.src.split('?')[0]; // Remove existing timestamp
                img.src = `${originalSrc}?t=${Date.now()}`;
            });
            
            // If there's a product grid or tiles container, force refresh
            const productGrid = document.querySelector('.product-grid, .products-container, #product-tiles');
            if (productGrid) {
                // Force refresh the product grid
                if (window.loadProducts && typeof window.loadProducts === 'function') {
                    window.loadProducts();
                }
            }
        } catch (error) {
            console.error('Error forcing UI refresh:', error);
        }
    }

    // ==========================================
    // SHIPPING MANAGEMENT METHODS
    // ==========================================

    /**
     * Load shipping data from JSON file
     */
    async loadShippingData() {
        if (this.loadingShipping) {
            console.log('Shipping data already loading, skipping...');
            return;
        }

        this.loadingShipping = true;
        
        try {
            console.log('📦 Loading shipping data...');
            const response = await fetch('data/shipping.json');
            if (!response.ok) throw new Error('Failed to load shipping data');
            
            const shippingData = await response.json();
            
            // Convert zones object to array and add ground rates
            const zonesArray = Object.entries(shippingData.zones || {}).map(([id, zone]) => {
                const groundRates = this.extractGroundRates(shippingData, zone.zoneNumber);
                return {
                    id,
                    zoneNumber: zone.zoneNumber,
                    name: zone.name,
                    ltlPercentage: zone.ltlPercentage,
                    states: zone.states,
                    color: zone.color,
                    groundRates
                };
            });
            
            this.shippingData = zonesArray;
            this.originalShippingData = shippingData; // Keep original for saving
            
            console.log('✅ Shipping data loaded:', this.shippingData.length, 'zones');
            this.renderShippingTable(this.shippingData);
            
        } catch (error) {
            console.error('❌ Error loading shipping data:', error);
            this.renderShippingError(error.message);
        } finally {
            this.loadingShipping = false;
        }
    }

    /**
     * Extract ground shipping rates for a zone
     */
    extractGroundRates(shippingData, zoneNumber) {
        if (!shippingData.displayBoxShipping || !shippingData.displayBoxShipping.ranges) {
            return { '1-3': 0, '4-8': 0, '9-11': 0 };
        }
        
        const ranges = shippingData.displayBoxShipping.ranges;
        const zoneKey = `zone${zoneNumber}`;
        
        return {
            '1-3': ranges['1-3'][zoneKey] || 0,
            '4-8': ranges['4-8'][zoneKey] || 0,
            '9-11': ranges['9-11'][zoneKey] || 0
        };
    }

    /**
     * Render shipping section with enhanced table structure
     */
    renderShippingSection() {
        // Load shipping data and render table
        this.loadShippingData();
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3>🚚 Shipping Zone Management</h3>
                    <div class="action-bar">
                        <button class="btn btn-primary" onclick="window.adminDashboard.addNewShippingZone()">
                            ➕ Add New Zone
                        </button>
                        <button class="btn btn-secondary" onclick="window.adminDashboard.exportShippingData()">
                            📄 Export CSV
                        </button>
                        <button class="btn btn-secondary" onclick="window.adminDashboard.loadShippingData()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="data-table shipping-table">
                        <thead>
                            <tr>
                                <th rowspan="2">Zone ID</th>
                                <th rowspan="2">Zone Name</th>
                                <th rowspan="2">LTL Rate %</th>
                                <th colspan="3" class="ground-shipping-header">Ground Shipping (per master case)</th>
                                <th rowspan="2">States</th>
                                <th rowspan="2">Color</th>
                                <th rowspan="2">Actions</th>
                            </tr>
                            <tr>
                                <th class="ground-header">1-3 Cases</th>
                                <th class="ground-header">4-8 Cases</th>
                                <th class="ground-header">9-11 Cases</th>
                            </tr>
                        </thead>
                        <tbody id="shipping-table-body">
                            <tr><td colspan="9" class="loading-row">Loading shipping data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render shipping table with data
     */
    renderShippingTable(zones) {
        const tbody = document.getElementById('shipping-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = zones.map(zone => {
            const groundRates = zone.groundRates || { '1-3': 0, '4-8': 0, '9-11': 0 };
            const statesDisplay = Array.isArray(zone.states) ? zone.states.join(', ') : zone.states;
            const statesShort = statesDisplay.length > 50 ? statesDisplay.substring(0, 50) + '...' : statesDisplay;
            
            return `
                <tr data-zone-id="${zone.id}">
                    <td class="zone-id">${zone.id}</td>
                    <td class="zone-name editable" data-field="name">${zone.name}</td>
                    <td class="zone-ltl editable" data-field="ltlPercentage">${zone.ltlPercentage}%</td>
                    <td class="ground-rate editable" data-field="ground1-3" data-zone="${zone.zoneNumber}">$${groundRates['1-3']}</td>
                    <td class="ground-rate editable" data-field="ground4-8" data-zone="${zone.zoneNumber}">$${groundRates['4-8']}</td>
                    <td class="ground-rate editable" data-field="ground9-11" data-zone="${zone.zoneNumber}">$${groundRates['9-11']}</td>
                    <td class="zone-states" title="${statesDisplay}">${statesShort}</td>
                    <td class="zone-color">
                        <div class="color-indicator" style="background-color: ${zone.color}; width: 20px; height: 20px; border-radius: 3px; display: inline-block;"></div>
                    </td>
                    <td class="zone-actions">
                        <button class="btn-small btn-edit" onclick="window.adminDashboard.editShippingZone('${zone.id}')" title="Edit Zone">
                            ✏️ Edit
                        </button>
                        <button class="btn-small btn-delete" onclick="window.adminDashboard.deleteShippingZone('${zone.id}')" title="Delete Zone">
                            🗑️ Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add click listeners for inline editing
        this.setupInlineEditing();
        
        // Adjust modal height after table is rendered
        setTimeout(() => this.adjustModalHeight(), 100);
    }

    /**
     * Render shipping error state
     */
    renderShippingError(errorMessage) {
        const tbody = document.getElementById('shipping-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="error-row">
                    <div class="error-message">
                        <span class="error-icon">⚠️</span>
                        <span class="error-text">Error loading shipping data: ${errorMessage}</span>
                        <button class="btn btn-small btn-primary" onclick="window.adminDashboard.loadShippingData()" style="margin-left: 10px;">
                            🔄 Try Again
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Save ground shipping rate
     */
    async saveGroundShippingRate(zoneId, field, newValue, zoneNumber) {
        try {
            console.log(`💾 Saving ground shipping rate: ${field} = ${newValue} for zone ${zoneId}`);
            
            // Parse the field to get the range
            const range = field.replace('ground', '').replace('-', '-'); // ground1-3 -> 1-3
            
            // Update the original shipping data structure
            if (!this.originalShippingData.displayBoxShipping) {
                this.originalShippingData.displayBoxShipping = { ranges: {} };
            }
            if (!this.originalShippingData.displayBoxShipping.ranges) {
                this.originalShippingData.displayBoxShipping.ranges = {};
            }
            if (!this.originalShippingData.displayBoxShipping.ranges[range]) {
                this.originalShippingData.displayBoxShipping.ranges[range] = {};
            }
            
            const zoneKey = `zone${zoneNumber}`;
            this.originalShippingData.displayBoxShipping.ranges[range][zoneKey] = parseFloat(newValue) || 0;
            
            // Save to server
            await this.saveShippingDataToServer();
            
            this.showNotification(`Ground shipping rate updated: ${range} cases = $${newValue}`, 'success');
            
        } catch (error) {
            console.error('Error saving ground shipping rate:', error);
            this.showNotification(`Failed to save ground shipping rate: ${error.message}`, 'error');
        }
    }

    /**
     * Save shipping field (LTL percentage, zone name, etc.)
     */
    async saveShippingField(zoneId, field, newValue) {
        try {
            console.log(`💾 Saving shipping field: ${field} = ${newValue} for zone ${zoneId}`);
            
            // Update the original shipping data structure
            if (this.originalShippingData.zones && this.originalShippingData.zones[zoneId]) {
                if (field === 'ltlPercentage') {
                    this.originalShippingData.zones[zoneId][field] = parseFloat(newValue) || 0;
                } else {
                    this.originalShippingData.zones[zoneId][field] = newValue;
                }
            }
            
            // Save to server
            await this.saveShippingDataToServer();
            
            this.showNotification(`Shipping ${field} updated successfully`, 'success');
            
        } catch (error) {
            console.error('Error saving shipping field:', error);
            this.showNotification(`Failed to save shipping field: ${error.message}`, 'error');
        }
    }

    /**
     * Save shipping data to server
     */
    async saveShippingDataToServer() {
        try {
            const response = await fetch('/api/save-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: 'shipping.json',
                    data: this.originalShippingData
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to save shipping data to server');
            }
            
            const result = await response.json();
            console.log('✅ Shipping data saved to server:', result);
            
        } catch (error) {
            console.error('❌ Error saving shipping data:', error);
            throw error;
        }
    }

    /**
     * Enhanced finish inline edit method to handle ground shipping rates
     */
    finishInlineEdit(input) {
        const cell = input.parentElement;
        const newValue = input.value;
        const originalValue = input.dataset.original;
        const field = cell.dataset.field;
        const row = cell.closest('tr');
        const productId = row.dataset.productId;
        const zoneId = row.dataset.zoneId;
        
        if (newValue !== originalValue) {
            if (field.startsWith('ground')) {
                const zoneNumber = cell.dataset.zone;
                this.saveGroundShippingRate(zoneId, field, newValue, zoneNumber);
            } else if (productId) {
                this.saveProductField(productId, field, newValue);
            } else if (zoneId) {
                this.saveShippingField(zoneId, field, newValue);
            }
            
            // Format display value
            let displayValue = newValue;
            if (field === 'price' || field === 'msrp' || field === 'cost' || field.startsWith('ground')) {
                displayValue = `$${newValue}`;
            } else if (field === 'ltlPercentage') {
                displayValue = `${newValue}%`;
            }
            
            cell.innerHTML = displayValue;
            cell.classList.add('field-updated');
            setTimeout(() => {
                cell.classList.remove('field-updated');
            }, 2000);
        } else {
            // Restore original formatting
            const needsDollar = field.includes('price') || field.includes('msrp') || field.includes('cost') || field.startsWith('ground');
            const needsPercent = field === 'ltlPercentage';
            let displayValue = originalValue;
            if (needsDollar) displayValue = `$${originalValue}`;
            else if (needsPercent) displayValue = `${originalValue}%`;
            cell.innerHTML = displayValue;
        }
        
        cell.classList.remove('editing');
    }

    /**
     * Enhanced cancel inline edit method
     */
    cancelInlineEdit(input) {
        const cell = input.parentElement;
        const originalValue = input.dataset.original;
        const field = cell.dataset.field;
        
        // Restore original formatting
        const needsDollar = field.includes('price') || field.includes('msrp') || field.includes('cost') || field.startsWith('ground');
        const needsPercent = field === 'ltlPercentage';
        let displayValue = originalValue;
        if (needsDollar) displayValue = `$${originalValue}`;
        else if (needsPercent) displayValue = `${originalValue}%`;
        
        cell.innerHTML = displayValue;
        cell.classList.remove('editing');
    }

    /**
     * Export shipping data to CSV
     */
    exportShippingData() {
        if (!this.shippingData || this.shippingData.length === 0) {
            this.showNotification('No shipping data to export', 'warning');
            return;
        }
        
        const headers = ['Zone ID', 'Zone Name', 'LTL Rate %', '1-3 Cases ($)', '4-8 Cases ($)', '9-11 Cases ($)', 'States', 'Color'];
        const csvContent = [headers.join(',')];
        
        this.shippingData.forEach(zone => {
            const row = [
                zone.id,
                `"${zone.name}"`,
                zone.ltlPercentage,
                zone.groundRates['1-3'],
                zone.groundRates['4-8'],
                zone.groundRates['9-11'],
                `"${Array.isArray(zone.states) ? zone.states.join(', ') : zone.states}"`,
                zone.color
            ];
            csvContent.push(row.join(','));
        });
        
        const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kanva-shipping-zones-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showNotification('Shipping data exported successfully', 'success');
    }

    // ==========================================
    // SHIPPING ZONE CRUD OPERATIONS
    // ==========================================

    /**
     * Add new shipping zone
     */
    addNewShippingZone() {
        console.log('➕ Adding new shipping zone');
        this.showShippingZoneModal();
    }
    
    /**
     * Edit existing shipping zone
     */
    editShippingZone(zoneId) {
        console.log(`✏️ Editing shipping zone: ${zoneId}`);
        this.showShippingZoneModal(zoneId);
    }
    

    
    /**
     * Delete shipping zone
     */
    async deleteShippingZone(zoneId) {
        if (!confirm(`Are you sure you want to delete shipping zone "${zoneId}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            console.log(`🗑️ Deleting shipping zone: ${zoneId}`);
            
            // Remove from original data structure
            if (this.originalShippingData.zones && this.originalShippingData.zones[zoneId]) {
                delete this.originalShippingData.zones[zoneId];
            }
            
            // Save to server
            await this.saveShippingDataToServer();
            
            // Remove from local data array
            this.shippingData = this.shippingData.filter(zone => zone.id !== zoneId);
            
            // Remove from UI with animation
            const zoneRow = document.querySelector(`tr[data-zone-id="${zoneId}"]`);
            if (zoneRow) {
                zoneRow.style.transition = 'all 0.3s ease';
                zoneRow.style.opacity = '0';
                zoneRow.style.transform = 'translateX(-20px)';
                setTimeout(() => {
                    zoneRow.remove();
                }, 300);
            }
            
            this.showNotification('Shipping zone deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting shipping zone:', error);
            this.showNotification(`Failed to delete shipping zone: ${error.message}`, 'error');
        }
    }

    /**
     * Show shipping zone modal for add/edit
     */
    showShippingZoneModal(zoneId = null) {
        const isEdit = zoneId !== null;
        const zone = isEdit ? this.shippingData.find(z => z.id === zoneId) : null;
        
        // Remove existing modal if any
        const existingModal = document.querySelector('.shipping-zone-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal-overlay shipping-zone-modal">
                <div class="modern-modal">
                    <div class="modal-header">
                        <div class="modal-title-section">
                            <div class="modal-icon">🚚</div>
                            <div class="modal-title-text">
                                <h2>${isEdit ? 'Edit Shipping Zone' : 'Add New Shipping Zone'}</h2>
                                <p class="modal-subtitle">${isEdit ? 'Update shipping zone information and rates' : 'Create a new shipping zone with rates'}</p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="shipping-zone-form" class="modern-form">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">Zone ID</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <input type="text" 
                                           id="zone-id" 
                                           class="form-input ${isEdit ? 'readonly' : ''}" 
                                           value="${zone ? zone.id : ''}" 
                                           ${isEdit ? 'readonly' : ''} 
                                           placeholder="e.g., zone5" 
                                           required>
                                    <div class="form-help">Unique identifier for the shipping zone</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">Zone Name</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <input type="text" 
                                           id="zone-name" 
                                           class="form-input" 
                                           value="${zone ? zone.name : ''}" 
                                           placeholder="e.g., Zone 5" 
                                           required>
                                    <div class="form-help">Display name for the shipping zone</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">Zone Number</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <input type="number" 
                                           id="zone-number" 
                                           class="form-input" 
                                           value="${zone ? zone.zoneNumber : ''}" 
                                           placeholder="e.g., 5" 
                                           min="1" 
                                           required>
                                    <div class="form-help">Numeric zone identifier for rate calculations</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">LTL Rate %</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <div class="input-with-suffix">
                                        <input type="number" 
                                               id="ltl-percentage" 
                                               class="form-input" 
                                               value="${zone ? zone.ltlPercentage : ''}" 
                                               placeholder="e.g., 15" 
                                               step="0.1" 
                                               min="0" 
                                               required>
                                        <span class="input-suffix">%</span>
                                    </div>
                                    <div class="form-help">LTL freight percentage for 12+ master cases</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">Ground Rate: 1-3 Cases</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <div class="input-with-suffix">
                                        <input type="number" 
                                               id="ground-1-3" 
                                               class="form-input" 
                                               value="${zone && zone.groundRates ? zone.groundRates['1-3'] : ''}" 
                                               placeholder="e.g., 10" 
                                               step="0.01" 
                                               min="0" 
                                               required>
                                        <span class="input-suffix">$</span>
                                    </div>
                                    <div class="form-help">Per master case rate for 1-3 cases</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">Ground Rate: 4-8 Cases</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <div class="input-with-suffix">
                                        <input type="number" 
                                               id="ground-4-8" 
                                               class="form-input" 
                                               value="${zone && zone.groundRates ? zone.groundRates['4-8'] : ''}" 
                                               placeholder="e.g., 15" 
                                               step="0.01" 
                                               min="0" 
                                               required>
                                        <span class="input-suffix">$</span>
                                    </div>
                                    <div class="form-help">Per master case rate for 4-8 cases</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">Ground Rate: 9-11 Cases</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <div class="input-with-suffix">
                                        <input type="number" 
                                               id="ground-9-11" 
                                               class="form-input" 
                                               value="${zone && zone.groundRates ? zone.groundRates['9-11'] : ''}" 
                                               placeholder="e.g., 20" 
                                               step="0.01" 
                                               min="0" 
                                               required>
                                        <span class="input-suffix">$</span>
                                    </div>
                                    <div class="form-help">Per master case rate for 9-11 cases</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="label-text">Zone Color</span>
                                        <span class="required-indicator">*</span>
                                    </label>
                                    <input type="color" 
                                           id="zone-color" 
                                           class="form-input color-input" 
                                           value="${zone ? zone.color : '#FF6B35'}" 
                                           required>
                                    <div class="form-help">Color identifier for the shipping zone</div>
                                </div>
                            </div>
                            
                            <div class="form-group full-width">
                                <label class="form-label">
                                    <span class="label-text">States</span>
                                    <span class="required-indicator">*</span>
                                </label>
                                <textarea id="zone-states" 
                                          class="form-input" 
                                          rows="3" 
                                          placeholder="Enter states separated by commas (e.g., CA, NV, OR, WA, ID)" 
                                          required>${zone && zone.states ? (Array.isArray(zone.states) ? zone.states.join(', ') : zone.states) : ''}</textarea>
                                <div class="form-help">States covered by this shipping zone, separated by commas</div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                            Cancel
                        </button>
                        <button type="button" class="btn btn-primary" onclick="window.adminDashboard.saveShippingZoneForm('${zoneId || ''}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
                                <polyline points="17,21 17,13 7,13 7,21"></polyline>
                                <polyline points="7,3 7,8 15,8"></polyline>
                            </svg>
                            ${isEdit ? 'Update Zone' : 'Create Zone'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Focus first input
        setTimeout(() => {
            const firstInput = document.querySelector('.shipping-zone-modal .form-input:not(.readonly)');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * Save shipping zone form
     */
    async saveShippingZoneForm(editZoneId = '') {
        try {
            const form = document.getElementById('shipping-zone-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const formData = {
                id: document.getElementById('zone-id').value.trim(),
                name: document.getElementById('zone-name').value.trim(),
                zoneNumber: parseInt(document.getElementById('zone-number').value),
                ltlPercentage: parseFloat(document.getElementById('ltl-percentage').value),
                groundRates: {
                    '1-3': parseFloat(document.getElementById('ground-1-3').value),
                    '4-8': parseFloat(document.getElementById('ground-4-8').value),
                    '9-11': parseFloat(document.getElementById('ground-9-11').value)
                },
                color: document.getElementById('zone-color').value,
                states: document.getElementById('zone-states').value.split(',').map(s => s.trim()).filter(s => s),
                active: true
            };
            
            const isEdit = editZoneId !== '';
            
            // Validate zone ID uniqueness for new zones
            if (!isEdit && this.originalShippingData.zones && this.originalShippingData.zones[formData.id]) {
                throw new Error(`Zone ID "${formData.id}" already exists. Please choose a different ID.`);
            }
            
            // Update original data structure
            if (!this.originalShippingData.zones) {
                this.originalShippingData.zones = {};
            }
            
            this.originalShippingData.zones[formData.id] = {
                zoneNumber: formData.zoneNumber,
                name: formData.name,
                ltlPercentage: formData.ltlPercentage,
                states: formData.states,
                color: formData.color,
                active: formData.active
            };
            
            // Update ground shipping rates
            if (!this.originalShippingData.displayBoxShipping) {
                this.originalShippingData.displayBoxShipping = { ranges: {} };
            }
            if (!this.originalShippingData.displayBoxShipping.ranges) {
                this.originalShippingData.displayBoxShipping.ranges = {};
            }
            
            const zoneKey = `zone${formData.zoneNumber}`;
            ['1-3', '4-8', '9-11'].forEach(range => {
                if (!this.originalShippingData.displayBoxShipping.ranges[range]) {
                    this.originalShippingData.displayBoxShipping.ranges[range] = {};
                }
                this.originalShippingData.displayBoxShipping.ranges[range][zoneKey] = formData.groundRates[range];
            });
            
            // Save to server
            await this.saveShippingDataToServer();
            
            // Update local data
            if (isEdit) {
                const zoneIndex = this.shippingData.findIndex(z => z.id === editZoneId);
                if (zoneIndex !== -1) {
                    this.shippingData[zoneIndex] = formData;
                }
            } else {
                this.shippingData.push(formData);
            }
            
            // Close modal
            document.querySelector('.shipping-zone-modal').remove();
            
            // Refresh table
            this.renderShippingTable(this.shippingData);
            
            this.showNotification(`Shipping zone ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            
        } catch (error) {
            console.error('Error saving shipping zone:', error);
            this.showNotification(`Failed to save shipping zone: ${error.message}`, 'error');
        }
    }

    /**
     * Refresh frontend data when admin changes are made
     */
    refreshFrontendData() {
        try {
            // Refresh calculator data if it exists
            if (window.calculator && typeof window.calculator.loadData === 'function') {
                console.log('🔄 Refreshing frontend calculator data...');
                window.calculator.loadData();
            }
            
            // Refresh any other frontend components that use the data
            if (window.productManager && typeof window.productManager.loadProducts === 'function') {
                console.log('🔄 Refreshing product manager data...');
                window.productManager.loadProducts();
            }
            
            // Trigger a custom event for other components to listen to
            window.dispatchEvent(new CustomEvent('adminDataUpdated', {
                detail: {
                    section: this.currentSection,
                    timestamp: new Date().toISOString()
                }
            }));
            
            console.log('✅ Frontend data refresh triggered');
        } catch (error) {
            console.error('❌ Error refreshing frontend data:', error);
        }
    }

    /**
     * Show login modal
     */
    showLoginModal() {
        console.log('🔐 Showing login modal');
        if (this.loginModal) {
            this.loginModal.style.display = 'block';
        }
    }

    /**
     * Hide login modal
     */
    hideLoginModal() {
        console.log('🔐 Hiding login modal');
        if (this.loginModal) {
            this.loginModal.style.display = 'none';
        }
    }

    /**
     * Show admin modal
     */
    showAdminModal() {
        console.log('🎛️ Showing admin modal');
        if (this.adminModal) {
            this.adminModal.style.display = 'block';
            this.showAdminSection('products'); // Default to products section
            this.adjustModalHeight();
        }
    }

    /**
     * Hide admin modal (does NOT log out user)
     */
    hideAdminModal() {
        console.log('🎛️ Hiding admin modal (user remains logged in)');
        if (this.adminModal) {
            this.adminModal.style.display = 'none';
        }
        // Note: We do NOT set this.isLoggedIn = false here
        // Only the logout button should log the user out
    }
}

// Initialize AdminDashboard when DOM is loaded
if (typeof window !== 'undefined') {
    window.AdminDashboard = AdminDashboard;
    
    // Auto-initialize if page is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.adminDashboard = new AdminDashboard({
                adminManager: window.adminManager
            });
            window.adminDashboard.init();
            
            // Ensure RingCentral methods are bound to global instance
            window.adminDashboard.viewRingCentralStatus = window.adminDashboard.viewRingCentralStatus.bind(window.adminDashboard);
            window.adminDashboard.sendRingCentralTestWebhook = window.adminDashboard.sendRingCentralTestWebhook.bind(window.adminDashboard);
            window.adminDashboard.startRingCentralOAuth = window.adminDashboard.startRingCentralOAuth.bind(window.adminDashboard);
            window.adminDashboard.saveRingCentralSettings = window.adminDashboard.saveRingCentralSettings.bind(window.adminDashboard);
        });
    } else {
        // DOM already loaded
        window.adminDashboard = new AdminDashboard({
            adminManager: window.adminManager
        });
        window.adminDashboard.init();
        
        // Ensure RingCentral methods are bound to global instance
        window.adminDashboard.viewRingCentralStatus = window.adminDashboard.viewRingCentralStatus.bind(window.adminDashboard);
        window.adminDashboard.sendRingCentralTestWebhook = window.adminDashboard.sendRingCentralTestWebhook.bind(window.adminDashboard);
        window.adminDashboard.startRingCentralOAuth = window.adminDashboard.startRingCentralOAuth.bind(window.adminDashboard);
        window.adminDashboard.saveRingCentralSettings = window.adminDashboard.saveRingCentralSettings.bind(window.adminDashboard);
    }
}
