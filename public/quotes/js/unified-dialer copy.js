/**
 * Unified Dialer - Consolidates all RingCentral implementations
 * Replaces: kanva-dialer.js, kanva-call-widget, and native SalesPortal dialer
 * Works in both standalone and Copper modal contexts
 */

// Check if RingCentral SDK is loaded
if (typeof RingCentral === 'undefined' || typeof RingCentralWebPhone === 'undefined') {
    console.error('RingCentral SDK not loaded. Make sure the SDK scripts are included before this file.');
    // Show error to user
    if (document.getElementById('dialerApp')) {
        document.getElementById('dialerApp').innerHTML = `
            <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <h3 class="font-bold">Error: RingCentral SDK Not Loaded</h3>
                <p>Failed to load required RingCentral components. Please refresh the page or contact support.</p>
                <button onclick="window.location.reload()" class="mt-2 px-4 py-2 bg-red-500 text-white rounded">
                    Refresh Page
                </button>
            </div>
        `;
    }
    throw new Error('RingCentral SDK not loaded');
}

// Create global references for backward compatibility
window.RingCentral = window.RingCentral || RingCentral;
window.RingCentralWebPhone = window.RingCentralWebPhone || RingCentralWebPhone;
class UnifiedDialer {
    constructor(options = {}) {
        this.isModal = options.isModal || false;
        this.contextMode = options.contextMode || 'standalone-mode';
        this.viewport = options.viewport || { width: window.innerWidth, height: window.innerHeight };
        this.parentOrigin = options.parentOrigin;
        this.webPhone = null;
        this.currentCall = null;
        this.isAuthenticated = false;
        this.callTimer = null;
        this.callStartTime = null;
        this.customerData = null;
        this.isMuted = false;
        this.isOnHold = false;
        
        // Configuration
        this.config = {
            ringcentral: {
                clientId: '',
                server: 'https://platform.ringcentral.com',
                redirectUri: `${window.location.origin}/rc/auth/callback`,
                environment: 'production'
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

    // Resolve an owner identifier to support per-user RingCentral tokens
    getOwnerId() {
        try {
            const url = new URL(window.location.href);
            const qpOwner = url.searchParams.get('ownerId') || url.searchParams.get('email');
            if (qpOwner) {
                localStorage.setItem('kanva.ownerId', qpOwner);
                return qpOwner;
            }
            const stored = localStorage.getItem('kanva.ownerId');
            if (stored) return stored;
        } catch {}
        // Fallback: try configured Copper user email if available
        return this?.config?.copper?.userEmail || '';
    }

    /**
     * Initialize the unified dialer
     */
    async init() {
        console.log('🚀 Initializing Unified Dialer...', { 
            isModal: this.isModal, 
            contextMode: this.contextMode,
            viewport: this.viewport 
        });
        
        try {
            // Always attempt to load config so clientId/server are available in all contexts
            // If it fails (e.g., sandboxed iframe restrictions), we'll continue with defaults
            await this.loadConfigurations();
            
            this.bindEvents();
            await this.checkAuthStatus();
            this.updateConnectionStatus('connecting', 'Initializing...', 'Setting up dialer');
            this.registerServiceWorker();
            this.adaptUIToContext();
            
            // Post message to parent if in modal mode
            if (this.isModal && this.parentOrigin) {
                this.postToParent('dialer-ready', { 
                    ready: true, 
                    contextMode: this.contextMode,
                    viewport: this.viewport 
                });
            }
            
            console.log('✅ Unified Dialer initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Unified Dialer:', error);
            this.updateConnectionStatus('error', 'Initialization failed', 'Please refresh and try again');
        }
    }

    /**
     * Load configurations from Firestore
     */
    async loadConfigurations() {
        try {
            console.log('⚙️ Loading configurations from Firestore...');
            
            const response = await fetch('/api/config');
            if (response.ok) {
                const result = await response.json();
                const config = result.config;
                
                // Update RingCentral config
                if (config.ringcentral) {
                    this.config.ringcentral.clientId = config.ringcentral.clientId || '';
                    this.config.ringcentral.environment = config.ringcentral.environment || 'production';
                    this.config.ringcentral.server = config.ringcentral.environment === 'sandbox' 
                        ? 'https://platform.devtest.ringcentral.com' 
                        : 'https://platform.ringcentral.com';
                    this.config.ringcentral.redirectUri = config.ringcentral.redirectUri || `${window.location.origin}/rc/auth/callback`;
                }
                
                // Update Copper config
                if (config.copper) {
                    this.config.copper.configured = config.copper.configured;
                    this.config.copper.userEmail = config.copper.userEmail || '';
                }
                
                console.log('✅ Configurations loaded:', {
                    ringcentral: !!this.config.ringcentral.clientId,
                    copper: this.config.copper.configured
                });
            } else {
                console.warn('⚠️ Could not load configurations');
            }
        } catch (error) {
            console.error('❌ Error loading configurations:', error);
        }
    }

    /**
     * Adapt UI based on context mode
     */
    adaptUIToContext() {
        const container = document.querySelector('.dialer-container');
        if (!container) return;

        // Adjust UI elements based on context
        switch (this.contextMode) {
            case 'sidebar-mode':
                this.hideCustomerInfo();
                this.compactifyNumberPad();
                this.hideCallHistory();
                break;
                
            case 'activity-bar-mode':
            case 'activity-panel-mode':
                this.hideCallHistory();
                this.compactifyUI();
                break;
                
            case 'modal-mode':
                this.optimizeForModal();
                break;
                
            case 'main-view-mode':
                this.showFullFeatures();
                break;
                
            default: // standalone-mode
                this.showFullFeatures();
        }
        
        console.log('🎨 UI adapted for context:', this.contextMode);
    }

    hideCustomerInfo() {
        const customerInfo = document.getElementById('customerInfo');
        if (customerInfo) customerInfo.style.display = 'none';
    }

    compactifyNumberPad() {
        const numberPad = document.querySelector('.number-pad');
        if (numberPad) {
            numberPad.style.gap = '4px';
            const buttons = numberPad.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.style.height = '32px';
                btn.style.fontSize = '12px';
                btn.style.padding = '4px';
            });
        }
    }

    hideCallHistory() {
        const callHistory = document.getElementById('callHistory');
        if (callHistory) callHistory.style.display = 'none';
    }

    compactifyUI() {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.style.fontSize = '16px';
            phoneInput.style.padding = '8px';
        }
        
        const callNotes = document.getElementById('callNotes');
        if (callNotes) {
            callNotes.rows = 2;
        }
    }

    optimizeForModal() {
        // Remove background elements, optimize for iframe
        document.body.style.background = 'white';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
    }

    showFullFeatures() {
        // Show all features for full-size contexts
        const elements = ['customerInfo', 'callHistory'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'block';
        });
    }

    /**
     * Bind UI events
     */
    bindEvents() {
        // Number pad
        document.querySelectorAll('.number-pad button').forEach(button => {
            button.addEventListener('click', (e) => {
                const number = e.target.dataset.number;
                if (number) {
                    this.addDigit(number);
                }
            });
        });

        // Action buttons
        document.getElementById('callButton')?.addEventListener('click', () => this.makeCall());
        document.getElementById('clearButton')?.addEventListener('click', () => this.clearNumber());
        document.getElementById('loginButton')?.addEventListener('click', () => this.login());
        document.getElementById('statusLoginButton')?.addEventListener('click', () => this.login());
        document.getElementById('saveNotesButton')?.addEventListener('click', () => this.saveNotes());

        // Incoming call actions
        document.getElementById('answerButton')?.addEventListener('click', () => this.answerCall());
        document.getElementById('declineButton')?.addEventListener('click', () => this.declineCall());

        // Active call controls
        document.getElementById('muteButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('holdButton')?.addEventListener('click', () => this.toggleHold());
        document.getElementById('hangupButton')?.addEventListener('click', () => this.hangupCall());

        // Copper navigation buttons
        document.getElementById('openLeadButton')?.addEventListener('click', () => this.openCopperRecord('lead'));
        document.getElementById('openCompanyButton')?.addEventListener('click', () => this.openCopperRecord('company'));
        document.getElementById('openPersonButton')?.addEventListener('click', () => this.openCopperRecord('person'));

        // Active call Copper buttons
        document.getElementById('activeOpenLeadButton')?.addEventListener('click', () => this.openCopperRecord('lead'));
        document.getElementById('activeOpenCompanyButton')?.addEventListener('click', () => this.openCopperRecord('company'));
        document.getElementById('activeOpenPersonButton')?.addEventListener('click', () => this.openCopperRecord('person'));

        // Phone number input
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                e.target.value = this.formatPhoneNumber(e.target.value);
            });
            phoneInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.makeCall();
                }
            });
        }

        // Listen for messages from parent (if in modal)
        if (this.isModal) {
            window.addEventListener('message', (event) => {
                this.handleParentMessage(event);
            });
        }
    }

    /**
     * Check authentication status
     */
    async checkAuthStatus() {
        try {
            console.log('🔍 Checking authentication status...');
            
            const ownerId = this.getOwnerId();
            const response = await fetch(`/rc/status${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`);
            if (response.ok) {
                const data = await response.json();
                console.log('🔐 Auth status:', data.success && data.data.authenticated ? 'Authenticated' : 'Not authenticated');
                
                if (data.success && data.data.authenticated) {
                    // Try to initialize WebPhone, but handle token failures gracefully
                    try {
                        await this.initializeWebPhoneFromToken();
                        this.isAuthenticated = true;
                        this.showConnectedStatus();
                        this.hideAuthSection();
                    } catch (tokenError) {
                        console.warn('⚠️ Auth status shows authenticated but token retrieval failed, showing login button');
                        this.isAuthenticated = false;
                        this.showDisconnectedStatus();
                        this.showAuthSection();
                    }
                } else {
                    this.isAuthenticated = false;
                    this.showDisconnectedStatus();
                    this.showAuthSection();
                }
                
                return this.isAuthenticated;
            } else {
                console.warn('⚠️ Could not check auth status');
                this.isAuthenticated = false;
                this.showAuthSection();
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error checking auth status:', error);
            this.isAuthenticated = false;
            this.showAuthSection();
            return false;
        }
    }

    /**
     * Initialize WebPhone from stored token
     */
    async initializeWebPhoneFromToken() {
        try {
            console.log('📞 Getting access token and initializing WebPhone...');
            
            const ownerId = this.getOwnerId();
            const tokenResponse = await fetch(`/rc/token${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`);
            if (!tokenResponse.ok) {
                throw new Error('Failed to get access token');
            }
            
            const tokenData = await tokenResponse.json();
            if (!tokenData.access_token) {
                throw new Error('Invalid token response');
            }
            
            await this.initializeWebPhone(tokenData.access_token);
            
        } catch (error) {
            console.error('❌ Failed to initialize WebPhone from token:', error);
            this.isAuthenticated = false;
            this.showAuthSection();
            throw error;
        }
    }

    /**
     * Handle login button click - start OAuth flow
     */
    async login() {
        try {
            console.log('🔐 Starting RingCentral OAuth flow...');
            
            // Open OAuth popup
            const ownerId = this.getOwnerId();
            const authUrl = `/rc/auth/start${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`;
            const popup = window.open(authUrl, 'ringcentral-auth',
                'width=500,height=650,noopener,noreferrer,scrollbars=yes,resizable=yes');
            
            if (!popup) {
                // Fallback for sandboxed iframes or popup blockers: navigate current tab
                console.warn('Popup not opened (blocked or sandboxed). Falling back to same-window navigation.');
                this.showInfo('Redirecting to RingCentral login...');
                window.location.href = authUrl;
                return;
            }
            
            // Listen for OAuth completion
            this.showInfo('Waiting for RingCentral authentication...');
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    console.log('🔄 OAuth popup closed, checking auth status...');
                    
                    // Wait a moment then check auth status
                    setTimeout(async () => {
                        const ok = await this.checkAuthStatus();
                        if (!ok) {
                            this.showError('Not authenticated. Please try logging in again.');
                        }
                    }, 1000);
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Login failed:', error);
            this.showError('Login failed: ' + (error?.message || 'Unknown error'));
        }
    }

    /**
     * Initialize RingCentral WebPhone
     */
    async initializeWebPhone(accessToken) {
        try {
            console.log('📞 Initializing WebPhone with access token...');
            
            if (!this.config.ringcentral.clientId) {
                throw new Error('RingCentral client ID not configured');
            }
            
            const sdk = new RingCentral({
                clientId: this.config.ringcentral.clientId,
                server: this.config.ringcentral.server
            });

            sdk.platform().auth().setData({ access_token: accessToken });

            this.webPhone = new RingCentralWebPhone(sdk, {
                appName: 'Kanva Dialer',
                appVersion: '1.0.0',
                uuid: this.generateUUID(),
                logLevel: 1,
                audioHelper: {
                    enabled: true
                }
            });

            this.bindWebPhoneEvents();
            
            this.isAuthenticated = true;
            this.updateConnectionStatus('connected', 'Connected');
            this.enableCallButton();
            
            console.log('✅ WebPhone initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize WebPhone:', error);
            this.updateConnectionStatus('error', 'Connection failed', 'Check your internet connection');
            this.showAuthSection();
            throw error;
        }
    }

    /**
     * Bind WebPhone events
     */
    bindWebPhoneEvents() {
        if (!this.webPhone) return;

        // Incoming call
        this.webPhone.on('invite', (session) => {
            console.log('📞 Incoming call:', session);
            this.currentCall = session;
            this.handleIncomingCall(session);
        });

        // Call connected
        this.webPhone.on('connected', (session) => {
            console.log('✅ Call connected:', session);
            this.handleCallConnected(session);
        });

        // Call ended
        this.webPhone.on('disconnected', (session) => {
            console.log('📴 Call ended:', session);
            this.handleCallEnded(session);
        });

        // Registration events
        this.webPhone.on('registered', () => {
            console.log('✅ WebPhone registered');
            this.updateConnectionStatus('connected', 'Connected');
        });

        this.webPhone.on('unregistered', () => {
            console.log('📴 WebPhone unregistered');
            this.updateConnectionStatus('disconnected', 'Disconnected', 'Connection lost');
        });

        this.webPhone.on('registrationFailed', (error) => {
            console.error('❌ WebPhone registration failed:', error);
            this.updateConnectionStatus('disconnected', 'Registration failed', 'Authentication error');
        });
    }

    /**
     * Handle incoming call
     */
    async handleIncomingCall(session) {
        const callerNumber = session.request.from.uri.user;
        console.log('📞 Incoming call from:', callerNumber);

        // Update UI
        document.getElementById('incomingNumber').textContent = this.formatPhoneNumber(callerNumber);
        
        // Lookup customer info
        await this.lookupCustomer(callerNumber, 'incoming');
        
        // Show incoming call overlay
        document.getElementById('incomingCallOverlay').classList.remove('hidden');

        // Auto-popup if in background
        if (this.isModal) {
            this.postToParent('incoming-call', {
                number: callerNumber,
                customerData: this.customerData
            });
        } else {
            // Focus window and show notification
            window.focus();
            this.showBrowserNotification('Incoming Call', `Call from ${this.formatPhoneNumber(callerNumber)}`);
        }
    }

    /**
     * Handle call connected
     */
    handleCallConnected(session) {
        const number = session.request.to?.uri?.user || session.request.from?.uri?.user;
        
        // Hide incoming call overlay
        document.getElementById('incomingCallOverlay').classList.add('hidden');
        
        // Show active call interface
        document.getElementById('activeCallNumber').textContent = this.formatPhoneNumber(number);
        document.getElementById('activeCallOverlay').classList.remove('hidden');
        
        // Start call timer
        this.startCallTimer();
        
        // Update status
        document.getElementById('callStatus').textContent = 'Connected';
        
        console.log('✅ Call connected, starting timer');
    }

    /**
     * Handle call ended
     */
    async handleCallEnded(session) {
        console.log('📴 Call ended');
        
        // Stop call timer
        this.stopCallTimer();
        
        // Hide overlays
        document.getElementById('incomingCallOverlay').classList.add('hidden');
        document.getElementById('activeCallOverlay').classList.add('hidden');
        
        // Reset call state
        this.currentCall = null;
        this.isMuted = false;
        this.isOnHold = false;
        
        // Log call to Copper if customer data exists
        if (this.customerData) {
            await this.logCallToCopper();
        }
        
        // Clear customer data
        this.clearCustomerInfo();
        
        console.log('✅ Call cleanup completed');
    }

    /**
     * Make outbound call
     */
    async makeCall() {
        const phoneNumber = document.getElementById('phoneNumber').value.replace(/\D/g, '');
        
        if (!phoneNumber) {
            alert('Please enter a phone number');
            return;
        }

        if (!this.webPhone || !this.isAuthenticated) {
            alert('Please login to RingCentral first');
            return;
        }

        try {
            console.log('📞 Making call to:', phoneNumber);
            
            // Lookup customer before calling
            await this.lookupCustomer(phoneNumber);
            
            // Make the call
            const session = this.webPhone.call({
                toNumber: phoneNumber,
                fromNumber: this.config.ringcentral.fromNumber
            });
            
            this.currentCall = session;
            
            // Update UI immediately
            document.getElementById('activeCallNumber').textContent = this.formatPhoneNumber(phoneNumber);
            document.getElementById('callStatus').textContent = 'Calling...';
            document.getElementById('activeCallOverlay').classList.remove('hidden');
            
        } catch (error) {
            console.error('❌ Failed to make call:', error);
            alert('Failed to make call: ' + error.message);
        }
    }

    /**
     * Answer incoming call
     */
    answerCall() {
        if (this.currentCall) {
            console.log('📞 Answering call');
            this.currentCall.accept();
        }
    }

    /**
     * Decline incoming call
     */
    declineCall() {
        if (this.currentCall) {
            console.log('📴 Declining call');
            this.currentCall.reject();
            document.getElementById('incomingCallOverlay').classList.add('hidden');
        }
    }

    /**
     * Hangup active call
     */
    hangupCall() {
        if (this.currentCall) {
            console.log('📴 Hanging up call');
            this.currentCall.terminate();
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        if (!this.currentCall) return;

        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            this.currentCall.mute();
            document.getElementById('muteButton').classList.add('active');
            document.querySelector('#muteButton i').className = 'fas fa-microphone-slash';
        } else {
            this.currentCall.unmute();
            document.getElementById('muteButton').classList.remove('active');
            document.querySelector('#muteButton i').className = 'fas fa-microphone';
        }
        
        console.log('🔇 Mute toggled:', this.isMuted);
    }

    /**
     * Toggle hold
     */
    toggleHold() {
        if (!this.currentCall) return;

        this.isOnHold = !this.isOnHold;
        
        if (this.isOnHold) {
            this.currentCall.hold();
            document.getElementById('holdButton').classList.add('active');
            document.getElementById('callStatus').textContent = 'On Hold';
        } else {
            this.currentCall.unhold();
            document.getElementById('holdButton').classList.remove('active');
            document.getElementById('callStatus').textContent = 'Connected';
        }
        
        console.log('⏸️ Hold toggled:', this.isOnHold);
    }

    /**
     * Lookup customer in Copper CRM
     */
    async lookupCustomer(phoneNumber, context = 'main') {
        if (!this.config.copper.configured) {
            console.log('⚠️ Copper not configured, skipping lookup');
            return;
        }

        try {
            console.log('🔍 Looking up customer:', phoneNumber);
            
            const response = await fetch(`${this.config.functions.baseUrl}/copper-lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber })
            });

            if (response.ok) {
                const data = await response.json();
                this.customerData = data;
                this.displayCustomerInfo(data, context);
                console.log('✅ Customer lookup successful:', data);
            } else {
                console.log('ℹ️ No customer found for:', phoneNumber);
                this.clearCustomerInfo();
            }
        } catch (error) {
            console.error('❌ Customer lookup failed:', error);
            this.clearCustomerInfo();
        }
    }

    /**
     * Display customer information
     */
    displayCustomerInfo(data, context = 'main') {
        const prefix = context === 'incoming' ? 'incoming' : '';
        
        // Update customer details
        const nameEl = document.getElementById(`${prefix}customerName`);
        const companyEl = document.getElementById(`${prefix}customerCompany`);
        const emailEl = document.getElementById(`${prefix}customerEmail`);
        
        if (nameEl) nameEl.textContent = data.name || '-';
        if (companyEl) companyEl.textContent = data.company || '-';
        if (emailEl) emailEl.textContent = data.email || '-';

        // Show customer info section
        const infoEl = document.getElementById(`${prefix}CustomerInfo`);
        if (infoEl) infoEl.classList.remove('hidden');

        // Show/hide Copper navigation buttons
        this.updateCopperButtons(data, prefix);
    }

    /**
     * Update Copper navigation buttons
     */
    updateCopperButtons(data, prefix = '') {
        const leadBtn = document.getElementById(`${prefix}openLeadButton`);
        const companyBtn = document.getElementById(`${prefix}openCompanyButton`);
        const personBtn = document.getElementById(`${prefix}openPersonButton`);

        // Show appropriate buttons based on data
        if (leadBtn && data.leadId) {
            leadBtn.classList.remove('hidden');
            leadBtn.onclick = () => this.openCopperRecord('lead', data.leadId);
        }
        
        if (companyBtn && data.companyId) {
            companyBtn.classList.remove('hidden');
            companyBtn.onclick = () => this.openCopperRecord('company', data.companyId);
        }
        
        if (personBtn && data.personId) {
            personBtn.classList.remove('hidden');
            personBtn.onclick = () => this.openCopperRecord('person', data.personId);
        }

        // Also update active call buttons
        const activeLeadBtn = document.getElementById('activeOpenLeadButton');
        const activeCompanyBtn = document.getElementById('activeOpenCompanyButton');
        const activePersonBtn = document.getElementById('activeOpenPersonButton');

        if (activeLeadBtn && data.leadId) {
            activeLeadBtn.classList.remove('hidden');
            activeLeadBtn.onclick = () => this.openCopperRecord('lead', data.leadId);
        }
        
        if (activeCompanyBtn && data.companyId) {
            activeCompanyBtn.classList.remove('hidden');
            activeCompanyBtn.onclick = () => this.openCopperRecord('company', data.companyId);
        }
        
        if (activePersonBtn && data.personId) {
            activePersonBtn.classList.remove('hidden');
            activePersonBtn.onclick = () => this.openCopperRecord('person', data.personId);
        }
    }

    /**
     * Clear customer information
     */
    clearCustomerInfo() {
        this.customerData = null;
        
        // Hide customer info sections
        document.getElementById('customerInfo')?.classList.add('hidden');
        document.getElementById('incomingCustomerInfo')?.classList.add('hidden');
        
        // Hide all Copper buttons
        document.querySelectorAll('[id*="Button"]').forEach(btn => {
            if (btn.id.includes('Lead') || btn.id.includes('Company') || btn.id.includes('Person')) {
                btn.classList.add('hidden');
            }
        });
    }

    /**
     * Open Copper CRM record
     */
    openCopperRecord(type, id) {
        if (!id && this.customerData) {
            id = this.customerData[`${type}Id`];
        }
        
        if (!id) {
            console.warn('⚠️ No ID available for Copper record:', type);
            return;
        }

        const baseUrl = 'https://app.copper.com';
        let url;
        
        switch (type) {
            case 'lead':
                url = `${baseUrl}/leads/${id}`;
                break;
            case 'company':
                url = `${baseUrl}/companies/${id}`;
                break;
            case 'person':
                url = `${baseUrl}/people/${id}`;
                break;
            default:
                console.warn('⚠️ Unknown Copper record type:', type);
                return;
        }

        if (this.isModal) {
            // Post message to parent to open in new tab
            this.postToParent('open-copper-record', { url, type, id });
        } else {
            // Open directly
            window.open(url, '_blank');
        }
        
        console.log('🔗 Opening Copper record:', { type, id, url });
    }

    /**
     * Log call to Copper CRM
     */
    async logCallToCopper() {
        if (!this.customerData || !this.config.copper.configured) {
            console.log('⚠️ Skipping call logging - no customer data or Copper not configured');
            return;
        }

        try {
            const notes = document.getElementById('activeCallNotes')?.value || 
                         document.getElementById('callNotes')?.value || '';
            
            const callData = {
                customerData: this.customerData,
                duration: this.getCallDuration(),
                notes: notes,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`${this.config.functions.baseUrl}/copper-log-call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(callData)
            });

            if (response.ok) {
                console.log('✅ Call logged to Copper successfully');
            } else {
                console.error('❌ Failed to log call to Copper');
            }
        } catch (error) {
            console.error('❌ Call logging error:', error);
        }
    }

    /**
     * Start call timer
     */
    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            const duration = this.getCallDuration();
            document.getElementById('callDuration').textContent = this.formatDuration(duration);
        }, 1000);
    }

    /**
     * Stop call timer
     */
    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        this.callStartTime = null;
    }

    /**
     * Get call duration in seconds
     */
    getCallDuration() {
        if (!this.callStartTime) return 0;
        return Math.floor((Date.now() - this.callStartTime) / 1000);
    }

    /**
     * Format duration as MM:SS
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Start OAuth authentication
     */
    login() {
        try {
            console.log('🔐 Starting OAuth flow...');
            
            if (!this.config.ringcentral.clientId) {
                this.showError('RingCentral not configured. Please contact administrator.');
                return;
            }
            
            // Use existing Firebase Functions OAuth flow
            const authUrl = `${window.location.origin}/rc/auth/start`;
            
            // Open OAuth in popup window
            const popup = window.open(
                authUrl,
                'ringcentral-oauth',
                'width=500,height=600,scrollbars=yes,resizable=yes'
            );
            
            if (!popup) {
                this.showError('Popup blocked. Please allow popups and try again.');
                return;
            }
            
            // Monitor popup for completion
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    console.log('✅ OAuth popup closed, checking for tokens...');
                    
                    // Check for tokens after popup closes
                    setTimeout(() => {
                        this.checkAuthStatus();
                    }, 2000);
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ OAuth start error:', error);
            this.showError('Failed to start authentication');
        }
    }

    /**
     * Add digit to phone number
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
     * Clear phone number
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
     * Format phone number for display
     */
    formatPhoneNumber(number) {
        const cleaned = number.replace(/\D/g, '');
        
        if (cleaned.length === 0) return '';
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
        if (cleaned.length <= 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        
        // Handle international numbers
        return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
    }

    /**
     * Save call notes
     */
    async saveNotes() {
        const callNotes = document.getElementById('callNotes');
        const activeCallNotes = document.getElementById('activeCallNotes');
        const notes = callNotes?.value || activeCallNotes?.value || '';
        
        if (!notes.trim()) {
            this.showSaveStatus('No notes to save');
            return;
        }

        try {
            const response = await fetch(`${this.config.functions.baseUrl}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentCall?.id || `draft-${Date.now()}`,
                    notes: notes,
                    customerData: this.customerData,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                this.showSaveStatus('Notes saved');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to save notes:', error);
            this.showSaveStatus('Save failed');
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status = 'connecting', message = 'Connecting...', subtext = '') {
        const statusEl = document.getElementById('connectionStatus');
        const textEl = document.getElementById('statusText');
        const subtextEl = document.getElementById('statusSubtext');
        const loginBtn = document.getElementById('loginButton');
        
        if (statusEl) {
            statusEl.className = `status-indicator status-${status}`;
        }
        
        if (textEl) {
            textEl.textContent = message;
        }
        
        if (subtextEl) {
            subtextEl.textContent = subtext;
        }
        
        // Show/hide login button based on status
        if (loginBtn) {
            if (status === 'disconnected' && message.includes('Authentication')) {
                loginBtn.classList.remove('hidden');
                loginBtn.onclick = () => this.startOAuth();
            } else {
                loginBtn.classList.add('hidden');
            }
        }
    }

    showConnectedStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = 'Connected';
            statusElement.className = 'text-green-600 font-medium';
        }
    }

    showDisconnectedStatus() {
        const statusText = document.getElementById('statusText');
        const statusSubtext = document.getElementById('statusSubtext');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (statusText) statusText.textContent = 'Disconnected';
        if (statusSubtext) statusSubtext.textContent = 'Click Login to connect';
        if (connectionStatus) {
            connectionStatus.className = 'status-indicator status-disconnected';
        }
    }

    /**
     * Show/hide auth section
     */
    showAuthSection() {
        const authSection = document.getElementById('authSection');
        if (authSection) {
            authSection.classList.remove('hidden');
        }
        
        // Also show status login button
        const statusLoginButton = document.getElementById('statusLoginButton');
        if (statusLoginButton) {
            statusLoginButton.classList.remove('hidden');
        }
        
        document.getElementById('callButton').disabled = true;
        this.updateConnectionStatus('disconnected', 'Authentication required', 'Click Login to connect');
    }

    hideAuthSection() {
        const authSection = document.getElementById('authSection');
        if (authSection) {
            authSection.classList.add('hidden');
        }
        
        // Also hide status login button
        const statusLoginButton = document.getElementById('statusLoginButton');
        if (statusLoginButton) {
            statusLoginButton.classList.add('hidden');
        }
        
        this.enableCallButton();
    }

    enableCallButton() {
        const callButton = document.getElementById('callButton');
        if (callButton) callButton.disabled = false;
    }

    showError(message) {
        // Use inline status area instead of alert (alerts are blocked in sandboxed contexts)
        const statusText = document.getElementById('statusText');
        const statusSubtext = document.getElementById('statusSubtext');
        if (statusText) statusText.textContent = 'Error';
        if (statusSubtext) {
            statusSubtext.textContent = message;
            statusSubtext.classList.remove('text-gray-500');
            statusSubtext.classList.add('text-red-600');
        }
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) connectionStatus.className = 'status-indicator status-disconnected';
    }

    showInfo(message) {
        const statusText = document.getElementById('statusText');
        const statusSubtext = document.getElementById('statusSubtext');
        if (statusText) statusText.textContent = 'Authenticating...';
        if (statusSubtext) {
            statusSubtext.textContent = message;
            statusSubtext.classList.remove('text-red-600');
            statusSubtext.classList.add('text-gray-500');
        }
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) connectionStatus.className = 'status-indicator status-connecting';
    }

    showSaveStatus(message) {
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = message;
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 3000);
        }
    }

    autoSaveNotes() {
        // Auto-save notes every 5 seconds
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            const notes = document.getElementById('callNotes')?.value || 
                         document.getElementById('activeCallNotes')?.value || '';
            if (notes) {
                this.saveNotes();
            }
        }, 5000);
    }

    /**
     * Register service worker for background functionality
     */
    registerServiceWorker() {
        if ('serviceWorker' in navigator && !this.isModal) {
            navigator.serviceWorker.register('/js/dialer-service-worker.js')
                .then(registration => {
                    console.log('✅ Service Worker registered:', registration);
                })
                .catch(error => {
                    console.warn('⚠️ Service Worker registration failed:', error);
                });
        }
    }

    /**
     * Show browser notification
     */
    showBrowserNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/assets/logo/kanva-logo.png' });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body, icon: '/assets/logo/kanva-logo.png' });
                }
            });
        }
    }

    /**
     * Post message to parent window (for modal context)
     */
    postToParent(type, data) {
        if (this.isModal && window.parent) {
            window.parent.postMessage({
                source: 'kanva-dialer',
                type,
                data
            }, '*');
        }
    }

    /**
     * Handle messages from parent window
     */
    handleParentMessage(event) {
        if (event.data.target !== 'kanva-dialer') return;
        
        const { type, data } = event.data;
        
        switch (type) {
            case 'dial-number':
                document.getElementById('phoneNumber').value = this.formatPhoneNumber(data.number);
                if (data.autoCall) {
                    this.makeCall();
                }
                break;
                
            case 'customer-context':
                this.customerData = data;
                this.displayCustomerInfo(data);
                break;
                
            default:
                console.log('Unknown parent message:', type, data);
        }
    }

    /**
     * Generate UUID for WebPhone
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedDialer;
}
