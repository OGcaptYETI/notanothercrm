/**
 * 🌿 KANVA DIALER INTEGRATION 🌿
 * Complete integration that ties together all WebPhone SDK components
 * Implements the comprehensive RingCentral WebPhone solution
 */

class KanvaDialerIntegration {
    constructor() {
        this.version = '3.0.0';
        this.salesDialer = null;
        this.copperIntegration = null;
        this.initialized = false;
        
        // Environment configuration
        this.config = this.getEnvironmentConfig();
        
        // Initialize components
        this.init();
    }
    
    getEnvironmentConfig() {
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
        
        return {
            development: {
                ringcentral: {
                    server: 'https://platform.devtest.ringcentral.com',
                    redirectUri: `${window.location.origin}/rc/auth/callback`
                },
                webphone: {
                    logLevel: 3, // Debug
                    enableQos: true,
                    enableMediaReportLogging: true
                },
                security: {
                    tokenExpiry: 3600,
                    enforceHttps: false
                }
            },
            production: {
                ringcentral: {
                    server: 'https://platform.ringcentral.com',
                    redirectUri: `${window.location.origin}/rc/auth/callback`
                },
                webphone: {
                    logLevel: 1, // Error only
                    enableQos: true,
                    enableMediaReportLogging: false
                },
                security: {
                    tokenExpiry: 1800,
                    enforceHttps: true
                }
            }
        }[isDevelopment ? 'development' : 'production'];
    }
    
    async init() {
        try {
            console.log(`🌿 Initializing Kanva Dialer Integration v${this.version}...`);
            
            // Show loading state
            this.showLoadingState();
            
            // Initialize Copper CRM integration
            this.copperIntegration = new CopperCRMIntegration();
            
            // Initialize the sales dialer with configuration
            this.salesDialer = new KanvaSalesDialer({
                ...this.config,
                userId: await this.getCurrentUserId(),
                debug: this.config.webphone.logLevel > 1
            });
            
            // Connect Copper integration to dialer
            this.copperIntegration.setDialer(this.salesDialer);
            
            // Initialize the dialer
            await this.salesDialer.initialize();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Show the dialer UI
            this.showDialerUI();
            
            this.initialized = true;
            console.log('✅ Kanva Dialer Integration initialized successfully');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showErrorState(error);
        }
    }
    
    async getCurrentUserId() {
        try {
            const response = await fetch('/api/auth/user', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const userData = await response.json();
                return userData.id || 'anonymous';
            }
        } catch (error) {
            console.warn('Failed to get user ID:', error);
        }
        
        return 'anonymous';
    }
    
    setupEventHandlers() {
        // Listen for dialer events
        window.addEventListener('kanva-dialer-state', (event) => {
            this.handleDialerStateChange(event.detail.state);
        });
        
        window.addEventListener('kanva-screen-pop', (event) => {
            this.handleScreenPop(event.detail);
        });
        
        window.addEventListener('kanva-call-muted', (event) => {
            this.updateMuteUI(event.detail.muted);
        });
        
        window.addEventListener('kanva-call-hold', (event) => {
            this.updateHoldUI(event.detail.onHold);
        });
        
        window.addEventListener('kanva-call-duration', (event) => {
            this.updateCallDurationUI(event.detail.callId, event.detail.duration);
        });
        
        // Setup UI event handlers
        this.setupUIEventHandlers();
    }
    
    setupUIEventHandlers() {
        // Number pad events
        document.addEventListener('click', (event) => {
            if (event.target.matches('.number-btn')) {
                this.handleNumberPadClick(event.target.dataset.number);
            }
            
            if (event.target.matches('#callButton')) {
                this.handleCallButtonClick();
            }
            
            if (event.target.matches('#clearButton')) {
                this.handleClearButtonClick();
            }
            
            if (event.target.matches('#loginButton, #statusLoginButton')) {
                this.handleLoginButtonClick();
            }
        });
        
        // Phone number input events
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.addEventListener('input', (event) => {
                this.formatPhoneNumber(event.target);
            });
            
            phoneInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.handleCallButtonClick();
                }
            });
        }
    }
    
    handleNumberPadClick(number) {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.value += number;
            this.formatPhoneNumber(phoneInput);
        }
    }
    
    async handleCallButtonClick() {
        const phoneInput = document.getElementById('phoneNumber');
        const phoneNumber = phoneInput?.value?.trim();
        
        if (!phoneNumber) {
            this.showToast('Please enter a phone number', 'warning');
            return;
        }
        
        if (!this.salesDialer) {
            this.showToast('Dialer not initialized', 'error');
            return;
        }
        
        try {
            await this.salesDialer.makeCall(phoneNumber);
            this.showToast('Call initiated', 'success');
        } catch (error) {
            console.error('Failed to make call:', error);
            this.showToast('Failed to make call: ' + error.message, 'error');
        }
    }
    
    handleClearButtonClick() {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            if (phoneInput.value.length > 0) {
                phoneInput.value = phoneInput.value.slice(0, -1);
                this.formatPhoneNumber(phoneInput);
            }
        }
    }
    
    async handleLoginButtonClick() {
        try {
            // Start OAuth flow
            const response = await fetch('/rc/auth/start', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const { authUrl } = await response.json();
                
                // Open OAuth popup
                const popup = window.open(authUrl, 'rcauth', 'width=500,height=600');
                
                // Monitor popup for completion
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        // Check auth status after popup closes
                        setTimeout(() => {
                            this.checkAuthenticationStatus();
                        }, 1000);
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Login failed:', error);
            this.showToast('Login failed: ' + error.message, 'error');
        }
    }
    
    async checkAuthenticationStatus() {
        try {
            const response = await fetch('/rc/status', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const status = await response.json();
                if (status.authenticated) {
                    // Re-initialize dialer with authentication
                    await this.salesDialer.initialize();
                    this.updateAuthenticationUI(true);
                    this.showToast('Successfully authenticated!', 'success');
                }
            }
        } catch (error) {
            console.error('Auth status check failed:', error);
        }
    }
    
    formatPhoneNumber(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.length >= 10) {
            value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
        } else if (value.length >= 6) {
            value = value.replace(/(\d{3})(\d{3})/, '($1) $2-');
        } else if (value.length >= 3) {
            value = value.replace(/(\d{3})/, '($1) ');
        }
        
        input.value = value;
    }
    
    handleDialerStateChange(state) {
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        const statusSubtext = document.getElementById('statusSubtext');
        
        if (statusIndicator && statusText && statusSubtext) {
            switch (state) {
                case 'ready':
                    statusIndicator.className = 'status-indicator status-ready';
                    statusText.textContent = 'Ready';
                    statusSubtext.textContent = 'Ready for calls';
                    break;
                case 'connected':
                    statusIndicator.className = 'status-indicator status-connected';
                    statusText.textContent = 'In Call';
                    statusSubtext.textContent = 'Call in progress';
                    break;
                case 'disconnected':
                    statusIndicator.className = 'status-indicator status-disconnected';
                    statusText.textContent = 'Disconnected';
                    statusSubtext.textContent = 'Connection lost';
                    break;
                case 'idle':
                    statusIndicator.className = 'status-indicator status-ready';
                    statusText.textContent = 'Ready';
                    statusSubtext.textContent = 'Ready for calls';
                    break;
            }
        }
    }
    
    handleScreenPop(contactData) {
        const customerInfo = document.getElementById('customerInfo');
        if (customerInfo) {
            document.getElementById('customerName').textContent = contactData.name || 'Unknown';
            document.getElementById('customerCompany').textContent = contactData.company || '-';
            document.getElementById('customerEmail').textContent = contactData.email || '-';
            
            customerInfo.classList.remove('hidden');
            
            // Show navigation buttons if we have record IDs
            if (contactData.leadId) {
                const leadBtn = document.getElementById('openLeadButton');
                if (leadBtn) {
                    leadBtn.classList.remove('hidden');
                    leadBtn.onclick = () => this.copperIntegration.openCopperRecord(contactData.leadId, 'lead');
                }
            }
            
            if (contactData.companyId) {
                const companyBtn = document.getElementById('openCompanyButton');
                if (companyBtn) {
                    companyBtn.classList.remove('hidden');
                    companyBtn.onclick = () => this.copperIntegration.openCopperRecord(contactData.companyId, 'company');
                }
            }
            
            if (contactData.personId) {
                const personBtn = document.getElementById('openPersonButton');
                if (personBtn) {
                    personBtn.classList.remove('hidden');
                    personBtn.onclick = () => this.copperIntegration.openCopperRecord(contactData.personId, 'person');
                }
            }
        }
    }
    
    updateMuteUI(muted) {
        const muteBtn = document.getElementById('muteButton');
        if (muteBtn) {
            if (muted) {
                muteBtn.classList.add('active');
                muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            } else {
                muteBtn.classList.remove('active');
                muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }
    }
    
    updateHoldUI(onHold) {
        const holdBtn = document.getElementById('holdButton');
        if (holdBtn) {
            if (onHold) {
                holdBtn.classList.add('active');
                holdBtn.innerHTML = '<i class="fas fa-play"></i>';
            } else {
                holdBtn.classList.remove('active');
                holdBtn.innerHTML = '<i class="fas fa-pause"></i>';
            }
        }
    }
    
    updateCallDurationUI(callId, duration) {
        const durationElement = document.getElementById('callDuration');
        if (durationElement) {
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            durationElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    updateAuthenticationUI(authenticated) {
        const authSection = document.getElementById('authSection');
        const callButton = document.getElementById('callButton');
        const statusLoginButton = document.getElementById('statusLoginButton');
        
        if (authenticated) {
            if (authSection) authSection.classList.add('hidden');
            if (callButton) {
                callButton.disabled = false;
                callButton.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            if (statusLoginButton) statusLoginButton.classList.add('hidden');
        } else {
            if (authSection) authSection.classList.remove('hidden');
            if (callButton) {
                callButton.disabled = true;
                callButton.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (statusLoginButton) statusLoginButton.classList.remove('hidden');
        }
    }
    
    showLoadingState() {
        document.getElementById('dialerApp').innerHTML = `
            <div class="dialer-container p-6">
                <div class="text-center mb-6">
                    <div class="flex items-center justify-center mb-4">
                        <span class="text-2xl mr-2">🌿</span>
                        <h1 class="text-lg font-semibold text-gray-800">Kanva Sales Dialer</h1>
                    </div>
                    <div class="flex items-center justify-center space-x-3 bg-gray-50 rounded-lg p-3">
                        <div class="status-indicator status-connecting"></div>
                        <div class="text-center">
                            <span class="text-sm font-medium text-gray-700">Initializing...</span>
                            <div class="text-xs text-gray-500">Loading WebPhone SDK</div>
                        </div>
                    </div>
                </div>
                
                <div class="text-center">
                    <div class="loading-spinner"></div>
                    <p class="text-gray-600 text-sm">Setting up RingCentral integration...</p>
                </div>
            </div>
        `;
    }
    
    showDialerUI() {
        document.getElementById('dialerApp').innerHTML = `
            <div class="dialer-container p-6">
                <!-- Header -->
                <div class="text-center mb-6">
                    <div class="flex items-center justify-center space-x-3 bg-gray-50 rounded-lg p-3">
                        <div id="connectionStatus" class="status-indicator status-ready"></div>
                        <div class="text-center">
                            <span id="statusText" class="text-sm font-medium text-gray-700">Ready</span>
                            <div id="statusSubtext" class="text-xs text-gray-500">WebPhone SDK loaded</div>
                        </div>
                    </div>
                </div>

                <!-- Customer Info -->
                <div id="customerInfo" class="customer-info p-4 mb-4 hidden">
                    <h3 class="font-semibold text-gray-800 mb-2">Customer Information</h3>
                    <div class="text-sm text-gray-600">
                        <div><strong>Name:</strong> <span id="customerName">-</span></div>
                        <div><strong>Company:</strong> <span id="customerCompany">-</span></div>
                        <div><strong>Email:</strong> <span id="customerEmail">-</span></div>
                    </div>
                    <div class="mt-3 space-x-2">
                        <button id="openLeadButton" class="hidden px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">
                            <i class="fas fa-external-link-alt mr-1"></i>Open Lead
                        </button>
                        <button id="openCompanyButton" class="hidden px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">
                            <i class="fas fa-building mr-1"></i>Open Company
                        </button>
                        <button id="openPersonButton" class="hidden px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">
                            <i class="fas fa-user mr-1"></i>Open Person
                        </button>
                    </div>
                </div>

                <!-- Phone Number Input -->
                <div class="mb-4">
                    <input type="tel" id="phoneNumber" 
                           class="w-full text-xl text-center p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                           placeholder="Enter phone number">
                </div>

                <!-- Number Pad -->
                <div class="number-pad grid grid-cols-3 gap-2 mb-4">
                    ${this.generateNumberPad()}
                </div>

                <!-- Action Buttons -->
                <div class="flex space-x-2 mb-4">
                    <button id="callButton" class="call-button flex-1 text-white font-semibold py-3 px-4 rounded-lg">
                        <i class="fas fa-phone mr-2"></i>Call
                    </button>
                    <button id="clearButton" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg">
                        <i class="fas fa-backspace"></i>
                    </button>
                </div>

                <!-- Call Notes -->
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-sticky-note mr-1"></i>Call Notes
                    </label>
                    <textarea id="callNotes" 
                             class="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                             placeholder="Add notes about this call..." rows="2"></textarea>
                </div>
            </div>
        `;
        
        // Re-setup event handlers for new DOM elements
        this.setupUIEventHandlers();
    }
    
    generateNumberPad() {
        const numbers = [
            ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
            ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
            ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
            ['*', ''], ['0', '+'], ['#', '']
        ];
        
        return numbers.map(([num, letters]) => `
            <button class="number-btn bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-green-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-all duration-200" data-number="${num}">
                <div class="text-xl">${num}</div>
                ${letters ? `<div class="text-xs text-gray-500 mt-1">${letters}</div>` : ''}
            </button>
        `).join('');
    }
    
    showErrorState(error) {
        document.getElementById('dialerApp').innerHTML = `
            <div class="dialer-container p-6">
                <div class="text-center mb-6">
                    <div class="flex items-center justify-center mb-4">
                        <span class="text-2xl mr-2">🌿</span>
                        <h1 class="text-lg font-semibold text-gray-800">Kanva Sales Dialer</h1>
                    </div>
                    <div class="flex items-center justify-center space-x-3 bg-red-50 rounded-lg p-3">
                        <div class="status-indicator status-error"></div>
                        <div class="text-center">
                            <span class="text-sm font-medium text-red-700">Error</span>
                            <div class="text-xs text-red-500">Initialization failed</div>
                        </div>
                    </div>
                </div>
                
                <div class="alert error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Initialization Failed</strong><br>
                        <small>${error.message}</small>
                        <br>
                        <button onclick="window.location.reload()" class="kanva-btn mt-2 px-4 py-2 text-white rounded-lg">
                            <i class="fas fa-redo mr-2"></i>Retry
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.kanvaDialerIntegration = new KanvaDialerIntegration();
});

// Export for global use
window.KanvaDialerIntegration = KanvaDialerIntegration;
