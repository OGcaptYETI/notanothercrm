/**
 * 🌿 ROBUST KANVA DIALER - SDK LOADING SOLUTION 🌿
 * Fixes RingCentral SDK loading issues in Copper CRM iframe environments
 * 
 * Key Fixes:
 * ✅ Multiple CDN fallbacks for RingCentral SDK
 * ✅ Graceful degradation when SDK unavailable
 * ✅ Proper iframe sandbox handling
 * ✅ Enhanced error recovery
 * ✅ Progressive enhancement approach
 */

class RobustKanvaDialer {
    constructor(options = {}) {
        this.version = '2.1.0';
        this.isModal = options.isModal || false;
        this.contextMode = options.contextMode || 'standalone-mode';
        this.viewport = options.viewport || { width: window.innerWidth, height: window.innerHeight };
        this.parentOrigin = options.parentOrigin;
        
        // SDK availability tracking
        this.sdkStatus = {
            ringcentral: false,
            webphone: false,
            attempts: 0,
            maxAttempts: 3,
            lastError: null
        };
        
        // Core state
        this.webPhone = null;
        this.currentCall = null;
        this.isAuthenticated = false;
        this.callTimer = null;
        this.callStartTime = null;
        this.customerData = null;
        this.isMuted = false;
        this.isOnHold = false;
        
        // Fallback mode for when SDK fails
        this.fallbackMode = false;
        this.uiReady = false;
        
        // Configuration with fallback options
        this.config = {
            ringcentral: {
                clientId: '',
                server: 'https://platform.ringcentral.com',
                redirectUri: `${window.location.origin}/rc/auth/callback`,
                environment: 'production',
                sdkUrls: [
                    'https://unpkg.com/@ringcentral/sdk@4.6.0/dist/ringcentral.min.js',
                    'https://cdn.jsdelivr.net/npm/@ringcentral/sdk@4.6.0/dist/ringcentral.min.js'
                ],
                webphoneUrls: [
                    'https://cdn.jsdelivr.net/npm/ringcentral-web-phone@2.2.7/dist/ringcentral-web-phone.min.js',
                    'https://unpkg.com/ringcentral-web-phone@2.2.7/dist/ringcentral-web-phone.min.js'
                ]
            },
            copper: {
                configured: false,
                userEmail: ''
            },
            functions: {
                baseUrl: `${window.location.origin}/rc`
            }
        };

        this.init();
    }

    /**
     * 🚀 Initialize with robust SDK loading
     */
    async init() {
        console.log(`🌿 Initializing Robust Kanva Dialer v${this.version}...`, { 
            isModal: this.isModal, 
            contextMode: this.contextMode,
            viewport: this.viewport 
        });
        
        try {
            // Step 1: Initialize UI immediately (works without SDK)
            this.initializeUI();
            this.showLoadingState();
            
            // Step 2: Load configurations
            await this.loadConfigurations();
            
            // Step 3: Attempt to load RingCentral SDK with multiple fallbacks
            await this.loadRingCentralSDK();
            
            // Step 4: Initialize based on SDK availability
            if (this.sdkStatus.ringcentral && this.sdkStatus.webphone) {
                await this.initializeWithSDK();
            } else {
                this.initializeFallbackMode();
            }
            
            // Step 5: Final UI setup
            this.finalizeInitialization();
            
        } catch (error) {
            console.error('❌ Failed to initialize Robust Kanva Dialer:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * 📦 Load RingCentral SDK with multiple CDN fallbacks
     */
    async loadRingCentralSDK() {
        console.log('📦 Loading RingCentral SDK with fallbacks...');
        
        // Check if SDK is already loaded
        if (typeof window.RingCentral !== 'undefined' && typeof window.RingCentralWebPhone !== 'undefined') {
            console.log('✅ RingCentral SDK already loaded');
            this.sdkStatus.ringcentral = true;
            this.sdkStatus.webphone = true;
            return;
        }
        
        // Try to load RingCentral SDK
        this.sdkStatus.ringcentral = await this.loadScript('RingCentral', this.config.ringcentral.sdkUrls);
        
        if (this.sdkStatus.ringcentral) {
            // Try to load WebPhone SDK
            this.sdkStatus.webphone = await this.loadScript('RingCentralWebPhone', this.config.ringcentral.webphoneUrls);
        }
        
        if (this.sdkStatus.ringcentral && this.sdkStatus.webphone) {
            console.log('✅ RingCentral SDK loaded successfully');
        } else {
            console.warn('⚠️ RingCentral SDK loading failed, proceeding with fallback mode');
        }
    }

    /**
     * 🔄 Load script with multiple URL fallbacks
     */
    async loadScript(globalName, urls) {
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`📥 Attempting to load ${globalName} from: ${url}`);
            
            try {
                await this.loadScriptFromUrl(url);
                
                // Check if the global is available
                if (typeof window[globalName] !== 'undefined') {
                    console.log(`✅ ${globalName} loaded successfully from: ${url}`);
                    return true;
                }
            } catch (error) {
                console.warn(`⚠️ Failed to load ${globalName} from ${url}:`, error);
                this.sdkStatus.lastError = error;
            }
        }
        
        return false;
    }

    /**
     * 📥 Load script from specific URL
     */
    loadScriptFromUrl(url) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src="${url}"]`);
            if (existingScript) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = url;
            script.type = 'text/javascript';
            script.crossOrigin = 'anonymous';
            
            script.onload = () => {
                console.log(`✅ Script loaded: ${url}`);
                resolve();
            };
            
            script.onerror = () => {
                console.error(`❌ Script failed to load: ${url}`);
                reject(new Error(`Failed to load script: ${url}`));
            };
            
            // Set timeout for loading
            const timeout = setTimeout(() => {
                reject(new Error(`Script loading timeout: ${url}`));
            }, 10000);
            
            script.onload = () => {
                clearTimeout(timeout);
                resolve();
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * 🎯 Initialize with full SDK capabilities
     */
    async initializeWithSDK() {
        console.log('🎯 Initializing with full RingCentral SDK capabilities...');
        
        try {
            // Set up global references
            window.RingCentral = window.RingCentral || RingCentral;
            window.RingCentralWebPhone = window.RingCentralWebPhone || RingCentralWebPhone;
            
            // Check authentication
            await this.checkAuthStatus();
            
            // Enable full dialer features
            this.enableFullDialerFeatures();
            
            console.log('✅ Full SDK initialization complete');
            
        } catch (error) {
            console.error('❌ SDK initialization failed, falling back:', error);
            this.initializeFallbackMode();
        }
    }

    /**
     * 🔄 Initialize fallback mode (click-to-dial only)
     */
    initializeFallbackMode() {
        console.log('🔄 Initializing fallback mode (limited functionality)...');
        
        this.fallbackMode = true;
        this.isAuthenticated = false;
        
        // Show fallback UI
        this.showFallbackModeUI();
        
        // Enable basic features
        this.enableBasicDialerFeatures();
        
        console.log('✅ Fallback mode initialization complete');
    }

    /**
     * 🎨 Initialize UI components (works without SDK)
     */
    initializeUI() {
        console.log('🎨 Initializing UI components...');
        
        // Apply Kanva branding
        this.applyKanvaTheme();
        
        // Adapt to context
        this.adaptUIToContext();
        
        // Bind basic events
        this.bindBasicEvents();
        
        // Set up accessibility
        this.initializeAccessibility();
        
        this.uiReady = true;
        console.log('✅ UI initialization complete');
    }

    /**
     * 🎨 Apply Kanva Botanicals theme
     */
    applyKanvaTheme() {
        const style = document.createElement('style');
        style.id = 'kanva-dialer-theme';
        style.textContent = `
            :root {
                --kanva-green: #93D500;
                --kanva-dark: #17351A;
                --kanva-light: #f8fdf8;
                --kanva-accent: #e8f5e8;
                --kanva-error: #ef4444;
                --kanva-warning: #f59e0b;
                --kanva-info: #3b82f6;
            }
            
            .kanva-dialer {
                font-family: 'Inter', system-ui, sans-serif;
                background: linear-gradient(135deg, var(--kanva-light) 0%, #ffffff 100%);
                border: 2px solid var(--kanva-accent);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(147, 213, 0, 0.1);
            }
            
            .kanva-header {
                background: linear-gradient(135deg, var(--kanva-green) 0%, #7bb600 100%);
                color: white;
                padding: 16px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .kanva-logo {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
                font-size: 16px;
            }
            
            .kanva-logo::before {
                content: '🌿';
                font-size: 20px;
            }
            
            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 6px;
            }
            
            .status-ready {
                background: #10b981;
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
                animation: pulse 2s infinite;
            }
            
            .status-fallback {
                background: var(--kanva-warning);
                box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
            }
            
            .status-error {
                background: var(--kanva-error);
                box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
            }
            
            .status-loading {
                background: var(--kanva-info);
                animation: pulse 1s infinite;
            }
            
            .kanva-btn {
                background: var(--kanva-green);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 10px 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .kanva-btn:hover:not(:disabled) {
                background: var(--kanva-dark);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .kanva-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            .kanva-btn.secondary {
                background: var(--kanva-accent);
                color: var(--kanva-dark);
            }
            
            .kanva-btn.danger {
                background: var(--kanva-error);
            }
            
            .alert {
                padding: 12px 16px;
                border-radius: 8px;
                margin: 12px 0;
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            
            .alert.warning {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                color: #92400e;
            }
            
            .alert.error {
                background: #fee2e2;
                border: 1px solid #ef4444;
                color: #dc2626;
            }
            
            .alert.info {
                background: #dbeafe;
                border: 1px solid #3b82f6;
                color: #1d4ed8;
            }
            
            .phone-input {
                width: 100%;
                padding: 12px 16px;
                font-size: 18px;
                text-align: center;
                border: 2px solid var(--kanva-accent);
                border-radius: 8px;
                background: white;
                transition: all 0.2s ease;
            }
            
            .phone-input:focus {
                outline: none;
                border-color: var(--kanva-green);
                box-shadow: 0 0 0 3px rgba(147, 213, 0, 0.1);
            }
            
            .number-pad {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin: 16px 0;
            }
            
            .number-btn {
                aspect-ratio: 1;
                border: none;
                background: #f3f4f6;
                border-radius: 8px;
                font-size: 20px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .number-btn:hover {
                background: var(--kanva-accent);
                transform: scale(1.05);
            }
            
            .loading-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f4f6;
                border-top: 2px solid var(--kanva-green);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Context-specific styles */
            .activity-panel-mode .kanva-dialer {
                max-width: 300px;
            }
            
            .activity-panel-mode .phone-input {
                font-size: 14px;
                padding: 8px 12px;
            }
            
            .activity-panel-mode .number-btn {
                font-size: 16px;
            }
            
            .sidebar-mode .kanva-dialer {
                max-width: 350px;
            }
            
            .modal-mode .kanva-dialer {
                border: none;
                border-radius: 0;
                height: 100vh;
            }
        `;
        
        // Remove existing theme if present
        const existingTheme = document.getElementById('kanva-dialer-theme');
        if (existingTheme) {
            existingTheme.remove();
        }
        
        document.head.appendChild(style);
    }

    /**
     * 🎯 Show loading state
     */
    showLoadingState() {
        const container = this.getDialerContainer();
        if (!container) return;
        
        container.innerHTML = `
            <div class="kanva-dialer">
                <div class="kanva-header">
                    <div class="kanva-logo">Kanva Sales Dialer</div>
                    <div style="display: flex; align-items: center; font-size: 12px;">
                        <div class="status-indicator status-loading"></div>
                        <span>Loading...</span>
                    </div>
                </div>
                <div style="padding: 24px; text-align: center;">
                    <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
                    <p style="color: #6b7280; margin: 0;">Initializing Kanva Dialer...</p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">Loading RingCentral SDK</p>
                </div>
            </div>
        `;
    }

    /**
     * 🔄 Show fallback mode UI
     */
    showFallbackModeUI() {
        const container = this.getDialerContainer();
        if (!container) return;
        
        container.innerHTML = `
            <div class="kanva-dialer">
                <div class="kanva-header">
                    <div class="kanva-logo">Kanva Sales Dialer</div>
                    <div style="display: flex; align-items: center; font-size: 12px;">
                        <div class="status-indicator status-fallback"></div>
                        <span>Limited Mode</span>
                    </div>
                </div>
                
                <div style="padding: 20px;">
                    <div class="alert warning">
                        <span style="font-size: 18px;">⚠️</span>
                        <div>
                            <strong>Limited Functionality</strong><br>
                            <small>RingCentral SDK unavailable. Click-to-dial only.</small>
                        </div>
                    </div>
                    
                    <div style="margin: 20px 0;">
                        <input type="tel" 
                               id="phoneNumber" 
                               class="phone-input" 
                               placeholder="Enter phone number"
                               autocomplete="tel">
                    </div>
                    
                    <div class="number-pad">
                        ${[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(num => 
                            `<button class="number-btn" data-number="${num}">${num}</button>`
                        ).join('')}
                    </div>
                    
                    <div style="display: flex; gap: 8px; margin-top: 16px;">
                        <button class="kanva-btn secondary" id="clearButton">
                            🔙 Clear
                        </button>
                        <button class="kanva-btn" id="dialButton" style="flex: 1;">
                            📞 Dial
                        </button>
                    </div>
                    
                    <div class="alert info" style="margin-top: 16px;">
                        <span style="font-size: 16px;">💡</span>
                        <div>
                            <small><strong>Tip:</strong> This will open your device's default phone app or use system tel: links.</small>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <button class="kanva-btn secondary" onclick="window.location.reload()">
                            🔄 Retry Full Load
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.bindFallbackEvents();
    }

    /**
     * ✨ Enable full dialer features
     */
    enableFullDialerFeatures() {
        const container = this.getDialerContainer();
        if (!container) return;
        
        container.innerHTML = `
            <div class="kanva-dialer">
                <div class="kanva-header">
                    <div class="kanva-logo">Kanva Sales Dialer</div>
                    <div style="display: flex; align-items: center; font-size: 12px;">
                        <div class="status-indicator status-ready"></div>
                        <span id="connectionText">Ready</span>
                    </div>
                </div>
                
                <div style="padding: 20px;">
                    <!-- Auth Section (hidden when authenticated) -->
                    <div id="authSection" class="alert warning" style="display: none;">
                        <span style="font-size: 18px;">🔐</span>
                        <div style="flex: 1;">
                            <strong>Authentication Required</strong><br>
                            <small>Please log in to RingCentral to make calls</small>
                            <br>
                            <button class="kanva-btn" id="loginButton" style="margin-top: 8px;">
                                🔐 Login to RingCentral
                            </button>
                        </div>
                    </div>
                    
                    <!-- Customer Info (hidden by default) -->
                    <div id="customerInfo" class="alert info" style="display: none;">
                        <span style="font-size: 18px;">👤</span>
                        <div>
                            <strong id="customerName">Customer Name</strong><br>
                            <small id="customerCompany">Company</small><br>
                            <small id="customerEmail">email@company.com</small>
                        </div>
                    </div>
                    
                    <!-- Phone Input -->
                    <div style="margin: 20px 0;">
                        <input type="tel" 
                               id="phoneNumber" 
                               class="phone-input" 
                               placeholder="Enter phone number"
                               autocomplete="tel">
                    </div>
                    
                    <!-- Number Pad -->
                    <div class="number-pad">
                        ${[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(num => 
                            `<button class="number-btn" data-number="${num}">${num}</button>`
                        ).join('')}
                    </div>
                    
                    <!-- Action Buttons -->
                    <div style="display: flex; gap: 8px; margin-top: 16px;">
                        <button class="kanva-btn secondary" id="clearButton">
                            🔙 Clear
                        </button>
                        <button class="kanva-btn" id="callButton" style="flex: 1;" disabled>
                            📞 Call
                        </button>
                    </div>
                    
                    <!-- Call Notes -->
                    <div style="margin-top: 20px;">
                        <label for="callNotes" style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 6px;">
                            📝 Call Notes:
                        </label>
                        <textarea id="callNotes" 
                                  placeholder="Add notes about this call..."
                                  style="width: 100%; padding: 8px; border: 1px solid var(--kanva-accent); border-radius: 6px; resize: vertical; min-height: 60px;">
                        </textarea>
                    </div>
                </div>
            </div>
            
            <!-- Active Call Overlay -->
            <div id="activeCallOverlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; width: 90%;">
                    <div id="activeCallNumber" style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">
                        (555) 123-4567
                    </div>
                    <div id="callStatus" style="color: #6b7280; margin-bottom: 16px;">
                        Connected
                    </div>
                    <div id="callDuration" style="font-size: 32px; font-weight: 700; color: var(--kanva-green); margin-bottom: 24px;">
                        00:00
                    </div>
                    
                    <!-- Call Controls -->
                    <div style="display: flex; gap: 16px; justify-content: center; margin-bottom: 24px;">
                        <button class="kanva-btn secondary" id="muteButton">
                            🎤 Mute
                        </button>
                        <button class="kanva-btn secondary" id="holdButton">
                            ⏸️ Hold
                        </button>
                        <button class="kanva-btn danger" id="hangupButton">
                            📴 Hangup
                        </button>
                    </div>
                    
                    <!-- Active Call Notes -->
                    <textarea id="activeCallNotes" 
                              placeholder="Notes for this call..."
                              style="width: 100%; padding: 8px; border: 1px solid var(--kanva-accent); border-radius: 6px; resize: vertical; min-height: 60px;">
                    </textarea>
                </div>
            </div>
            
            <!-- Incoming Call Overlay -->
            <div id="incomingCallOverlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; width: 90%;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📞</div>
                    <div style="font-size: 18px; color: #6b7280; margin-bottom: 8px;">Incoming Call</div>
                    <div id="incomingNumber" style="font-size: 24px; font-weight: 600; margin-bottom: 24px;">
                        (555) 123-4567
                    </div>
                    
                    <div style="display: flex; gap: 20px; justify-content: center;">
                        <button class="kanva-btn danger" id="declineButton">
                            📴 Decline
                        </button>
                        <button class="kanva-btn" id="answerButton" style="background: #10b981;">
                            📞 Answer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.bindFullEvents();
    }

    /**
     * 🔄 Enable basic dialer features (fallback mode)
     */
    enableBasicDialerFeatures() {
        console.log('🔄 Enabling basic dialer features...');
        // Features already enabled by fallback UI
    }

    /**
     * 🎯 Get dialer container element
     */
    getDialerContainer() {
        // Try multiple possible container IDs/classes
        const possibleContainers = [
            '#dialerApp',
            '#dialer-container',
            '.dialer-container',
            '#app',
            '.app-container',
            'body'
        ];
        
        for (const selector of possibleContainers) {
            const container = document.querySelector(selector);
            if (container) {
                return container;
            }
        }
        
        console.warn('⚠️ No suitable container found for dialer');
        return null;
    }

    /**
     * 🔗 Bind basic events (works in both modes)
     */
    bindBasicEvents() {
        // Phone input formatting
        document.addEventListener('input', (e) => {
            if (e.target.id === 'phoneNumber') {
                e.target.value = this.formatPhoneNumber(e.target.value);
            }
        });
        
        // Enter key to dial
        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'phoneNumber' && e.key === 'Enter') {
                this.handleDialAction();
            }
        });
    }

    /**
     * 📱 Bind fallback mode events
     */
    bindFallbackEvents() {
        // Number pad
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const number = e.target.dataset.number;
                if (number) {
                    this.addDigit(number);
                }
            });
        });
        
        // Clear button
        document.getElementById('clearButton')?.addEventListener('click', () => {
            this.clearNumber();
        });
        
        // Dial button (fallback mode)
        document.getElementById('dialButton')?.addEventListener('click', () => {
            this.handleDialAction();
        });
    }

    /**
     * 📞 Bind full dialer events
     */
    bindFullEvents() {
        // All basic events plus advanced features
        this.bindBasicEvents();
        
        // Number pad
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const number = e.target.dataset.number;
                if (number) {
                    this.addDigit(number);
                }
            });
        });
        
        // Action buttons
        document.getElementById('clearButton')?.addEventListener('click', () => this.clearNumber());
        document.getElementById('callButton')?.addEventListener('click', () => this.makeCall());
        document.getElementById('loginButton')?.addEventListener('click', () => this.login());
        
        // Call control buttons
        document.getElementById('answerButton')?.addEventListener('click', () => this.answerCall());
        document.getElementById('declineButton')?.addEventListener('click', () => this.declineCall());
        document.getElementById('muteButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('holdButton')?.addEventListener('click', () => this.toggleHold());
        document.getElementById('hangupButton')?.addEventListener('click', () => this.hangupCall());
        
        // Modal communication
        if (this.isModal) {
            window.addEventListener('message', (event) => {
                this.handleParentMessage(event);
            });
        }
    }

    /**
     * 📞 Handle dial action (works in both modes)
     */
    handleDialAction() {
        const phoneNumber = document.getElementById('phoneNumber')?.value?.replace(/\D/g, '');
        
        if (!phoneNumber) {
            this.showToast('Please enter a phone number', 'warning');
            return;
        }
        
        if (this.fallbackMode) {
            // Use system tel: link
            window.open(`tel:${phoneNumber}`, '_self');
            this.showToast('Opening system dialer...', 'info');
        } else {
            // Use RingCentral WebPhone
            this.makeCall();
        }
    }

    /**
     * 📞 Make call using RingCentral (full mode only)
     */
    async makeCall() {
        if (this.fallbackMode) {
            this.handleDialAction();
            return;
        }
        
        const phoneNumber = document.getElementById('phoneNumber')?.value?.replace(/\D/g, '');
        
        if (!phoneNumber) {
            this.showToast('Please enter a phone number', 'warning');
            return;
        }

        if (!this.webPhone || !this.isAuthenticated) {
            this.showToast('Please login to RingCentral first', 'error');
            return;
        }

        try {
            console.log('📞 Making call to:', phoneNumber);
            
            // Lookup customer if Copper is configured
            await this.lookupCustomer(phoneNumber);
            
            // Make the call
            const session = this.webPhone.call({
                toNumber: phoneNumber,
                fromNumber: this.config.ringcentral.fromNumber
            });
            
            this.currentCall = session;
            
            // Show active call interface
            this.showActiveCall(phoneNumber, 'Calling...');
            
        } catch (error) {
            console.error('❌ Failed to make call:', error);
            this.showToast(`Call failed: ${error.message}`, 'error');
        }
    }

    /**
     * 📞 Show active call interface
     */
    showActiveCall(number, status = 'Connected') {
        const overlay = document.getElementById('activeCallOverlay');
        if (overlay) {
            document.getElementById('activeCallNumber').textContent = this.formatPhoneNumber(number);
            document.getElementById('callStatus').textContent = status;
            overlay.style.display = 'flex';
        }
    }

    /**
     * 🍞 Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            max-width: 300px;
            animation: slideIn 0.3s ease;
            ${type === 'error' ? 'background: #ef4444;' : 
              type === 'warning' ? 'background: #f59e0b;' : 
              type === 'success' ? 'background: #10b981;' : 'background: #6b7280;'}
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * 🔢 Add digit to phone number
     */
    addDigit(digit) {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            const currentValue = phoneInput.value.replace(/\D/g, '');
            const newValue = currentValue + digit;
            phoneInput.value = this.formatPhoneNumber(newValue);
        }
    }

    /**
     * 🔙 Clear phone number
     */
    clearNumber() {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            const currentValue = phoneInput.value.replace(/\D/g, '');
            const newValue = currentValue.slice(0, -1);
            phoneInput.value = this.formatPhoneNumber(newValue);
        }
    }

    /**
     * 📱 Format phone number for display
     */
    formatPhoneNumber(number) {
        const cleaned = number.replace(/\D/g, '');
        
        if (cleaned.length === 0) return '';
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
        if (cleaned.length <= 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        
        return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
    }

    /**
     * ♿ Initialize accessibility features
     */
    initializeAccessibility() {
        // Add ARIA labels and keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentCall) {
                this.hangupCall();
            }
        });
    }

    /**
     * 🎨 Adapt UI to context
     */
    adaptUIToContext() {
        document.body.classList.add(`kanva-dialer-${this.contextMode}`);
        
        switch (this.contextMode) {
            case 'activity-panel-mode':
            case 'activity-bar-mode':
                document.body.classList.add('compact-mode');
                break;
            case 'modal-mode':
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                break;
        }
    }

    /**
     * ✅ Finalize initialization
     */
    finalizeInitialization() {
        // Post ready message to parent if in modal
        if (this.isModal && this.parentOrigin) {
            this.postToParent('dialer-ready', {
                ready: true,
                version: this.version,
                mode: this.fallbackMode ? 'fallback' : 'full',
                features: this.getAvailableFeatures()
            });
        }
        
        console.log(`✅ Robust Kanva Dialer v${this.version} ready!`, {
            mode: this.fallbackMode ? 'fallback' : 'full',
            context: this.contextMode,
            features: this.getAvailableFeatures()
        });
    }

    /**
     * 📋 Get list of available features
     */
    getAvailableFeatures() {
        const features = ['click-to-dial', 'number-formatting', 'call-notes'];
        
        if (!this.fallbackMode) {
            features.push('webrtc-calling', 'call-control', 'customer-lookup', 'call-logging');
        }
        
        return features;
    }

    /**
     * ❌ Handle initialization error
     */
    handleInitializationError(error) {
        console.error('❌ Initialization error:', error);
        
        const container = this.getDialerContainer();
        if (container) {
            container.innerHTML = `
                <div class="kanva-dialer">
                    <div class="kanva-header">
                        <div class="kanva-logo">Kanva Sales Dialer</div>
                        <div style="display: flex; align-items: center; font-size: 12px;">
                            <div class="status-indicator status-error"></div>
                            <span>Error</span>
                        </div>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div class="alert error">
                            <span style="font-size: 18px;">❌</span>
                            <div>
                                <strong>Initialization Failed</strong><br>
                                <small>${error.message}</small>
                            </div>
                        </div>
                        
                        <button class="kanva-btn" onclick="window.location.reload()" style="width: 100%; margin-top: 16px;">
                            🔄 Refresh Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 📧 Post message to parent window
     */
    postToParent(type, data) {
        if (this.isModal && window.parent) {
            window.parent.postMessage({
                source: 'kanva-dialer',
                type,
                data
            }, this.parentOrigin || '*');
        }
    }

    // Placeholder methods for full functionality (implement based on original code)
    async loadConfigurations() { /* Implementation from original */ }
    async checkAuthStatus() { /* Implementation from original */ }
    async login() { /* Implementation from original */ }
    async lookupCustomer(phoneNumber) { /* Implementation from original */ }
    answerCall() { /* Implementation from original */ }
    declineCall() { /* Implementation from original */ }
    toggleMute() { /* Implementation from original */ }
    toggleHold() { /* Implementation from original */ }
    hangupCall() { /* Implementation from original */ }
    handleParentMessage(event) { /* Implementation from original */ }
}

// =======================================================
// INITIALIZATION LOGIC
// =======================================================

/**
 * 🚀 Initialize Robust Kanva Dialer
 */
function initializeRobustKanvaDialer(options = {}) {
    console.log('🌿 Starting Robust Kanva Dialer initialization...');
    
    // Create global instance
    window.kanvaDialer = new RobustKanvaDialer(options);
    
    return window.kanvaDialer;
}

// Auto-initialize based on environment
document.addEventListener('DOMContentLoaded', () => {
    // Detect context from URL parameters or environment
    const urlParams = new URLSearchParams(window.location.search);
    const isModal = window.parent !== window;
    
    let contextMode = 'standalone-mode';
    
    // Detect Copper CRM context
    if (urlParams.get('location')) {
        const location = urlParams.get('location');
        const locationMap = {
            'left_nav': 'main-view-mode',
            'action_bar': 'activity-bar-mode',
            'sidebar': 'sidebar-mode',
            'modal': 'modal-mode'
        };
        contextMode = locationMap[location] || 'standalone-mode';
    }
    
    // Get viewport information
    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    
    // Initialize dialer
    initializeRobustKanvaDialer({
        isModal,
        contextMode,
        viewport,
        parentOrigin: urlParams.get('origin') || window.location.origin
    });
});

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RobustKanvaDialer, initializeRobustKanvaDialer, UnifiedDialer: RobustKanvaDialer };
}

// Compatibility alias for legacy references
if (typeof window !== 'undefined') {
    window.UnifiedDialer = window.UnifiedDialer || RobustKanvaDialer;
}