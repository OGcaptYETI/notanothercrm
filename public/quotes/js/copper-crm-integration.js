/**
 * 🌿 COPPER CRM INTEGRATION 🌿
 * Cross-origin communication implementation for Copper CRM iframe embedding
 * Handles screen pops, call logging, and CRM navigation
 */

class CopperCRMIntegration {
    constructor() {
        this.allowedOrigins = [
            'https://app.copper.com',
            'https://apps.ringcentral.com',
            'https://kanvaportal.web.app'
        ];
        this.dialer = null;
        this.setupMessageHandlers();
    }
    
    setDialer(dialer) {
        this.dialer = dialer;
    }
    
    setupMessageHandlers() {
        window.addEventListener('message', (event) => {
            if (!this.allowedOrigins.includes(event.origin)) {
                console.warn('Message from unauthorized origin:', event.origin);
                return;
            }
            
            this.handleMessage(event.data, event.origin);
        });
    }
    
    handleMessage(data, origin) {
        switch (data.type) {
            case 'MAKE_CALL':
                this.makeCall(data.phoneNumber, data.contactData);
                break;
            case 'rc-call-ring-notify':
                this.handleIncomingCall(data.call);
                break;
            case 'rc-post-message-request':
                if (data.path === '/callLogger') {
                    this.logCallToCopper(data.body);
                }
                break;
            case 'COPPER_CONTEXT':
                this.handleCopperContext(data.context);
                break;
        }
    }
    
    async makeCall(phoneNumber, contactData) {
        if (!this.dialer) {
            console.error('Dialer not initialized');
            return;
        }
        
        try {
            const callSession = await this.dialer.makeCall(phoneNumber);
            
            // Send call status back to Copper
            this.sendMessage({
                type: 'CALL_STARTED',
                callId: callSession.callId,
                phoneNumber: phoneNumber,
                contactData: contactData
            });
        } catch (error) {
            console.error('Failed to make call:', error);
            this.sendMessage({
                type: 'CALL_ERROR',
                error: error.message,
                phoneNumber: phoneNumber
            });
        }
    }
    
    async handleIncomingCall(callData) {
        const phoneNumber = callData.phoneNumber;
        
        // Search Copper for matching contact
        const contact = await this.searchCopperContact(phoneNumber);
        
        if (contact) {
            // Show screen pop with contact info
            this.showScreenPop({
                name: contact.name,
                company: contact.company,
                email: contact.email,
                lastActivity: contact.last_activity_date,
                phoneNumber: phoneNumber
            });
        }
    }
    
    async searchCopperContact(phoneNumber) {
        try {
            const response = await fetch('/api/copper/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phoneNumber })
            });
            
            if (response.ok) {
                return response.json();
            }
        } catch (error) {
            console.error('Failed to search Copper contact:', error);
        }
        
        return null;
    }
    
    showScreenPop(contactData) {
        // Create screen pop modal
        const modal = this.createScreenPopModal(contactData);
        document.body.appendChild(modal);
        
        // Send message to parent Copper window
        this.sendMessage({
            type: 'SCREEN_POP',
            contactData: contactData
        });
    }
    
    createScreenPopModal(contactData) {
        const modal = document.createElement('div');
        modal.className = 'kanva-screen-pop';
        modal.innerHTML = `
            <div class="screen-pop-content">
                <div class="screen-pop-header">
                    <h3>Incoming Call</h3>
                    <button class="close-btn" onclick="this.closest('.kanva-screen-pop').remove()">×</button>
                </div>
                <div class="contact-info">
                    <div class="contact-name">${contactData.name || 'Unknown Caller'}</div>
                    <div class="contact-phone">${contactData.phoneNumber}</div>
                    ${contactData.company ? `<div class="contact-company">${contactData.company}</div>` : ''}
                    ${contactData.email ? `<div class="contact-email">${contactData.email}</div>` : ''}
                </div>
                <div class="call-actions">
                    <button class="answer-btn" onclick="kanvaDialer.answerCall('${contactData.callId}')">Answer</button>
                    <button class="decline-btn" onclick="kanvaDialer.hangup('${contactData.callId}')">Decline</button>
                </div>
                ${contactData.company ? `
                    <div class="crm-actions">
                        <button onclick="copperIntegration.openCopperRecord('${contactData.id}', 'person')">
                            Open in Copper
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        return modal;
    }
    
    async logCallToCopper(callData) {
        const headers = {
            'X-PW-AccessToken': await this.getCopperApiKey(),
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': await this.getCopperEmail(),
            'Content-Type': 'application/json'
        };
        
        const activity = {
            type: 'phone_call',
            details: {
                phone_number: callData.phoneNumber,
                direction: callData.direction,
                duration: callData.duration,
                result: callData.result,
                recording_url: callData.recordingUrl,
                notes: callData.notes || ''
            },
            activity_date: new Date().toISOString()
        };
        
        try {
            const response = await fetch('https://api.copper.com/developer_api/v1/activities', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(activity)
            });
            
            if (response.ok) {
                console.log('Call logged to Copper successfully');
            } else {
                console.error('Failed to log call to Copper:', response.statusText);
            }
        } catch (error) {
            console.error('Error logging call to Copper:', error);
        }
    }
    
    async getCopperApiKey() {
        // Get from secure backend
        const response = await fetch('/api/copper/credentials', {
            credentials: 'include'
        });
        const data = await response.json();
        return data.apiKey;
    }
    
    async getCopperEmail() {
        // Get from secure backend
        const response = await fetch('/api/copper/credentials', {
            credentials: 'include'
        });
        const data = await response.json();
        return data.email;
    }
    
    openCopperRecord(recordId, recordType) {
        const copperUrl = `https://app.copper.com/${recordType}s/${recordId}`;
        
        // Try to open in parent window (if in iframe)
        if (window.parent !== window) {
            this.sendMessage({
                type: 'OPEN_RECORD',
                url: copperUrl,
                recordId: recordId,
                recordType: recordType
            });
        } else {
            // Open in new tab
            window.open(copperUrl, '_blank');
        }
    }
    
    handleCopperContext(context) {
        // Store Copper context for enhanced integration
        this.copperContext = context;
        
        // Update UI based on context
        if (context.currentRecord) {
            this.updateUIForRecord(context.currentRecord);
        }
    }
    
    updateUIForRecord(record) {
        // Update dialer UI to show current Copper record context
        const contextElement = document.getElementById('copper-context');
        if (contextElement) {
            contextElement.innerHTML = `
                <div class="current-record">
                    <span class="record-type">${record.type}</span>
                    <span class="record-name">${record.name}</span>
                </div>
            `;
        }
    }
    
    sendMessage(data) {
        // Send message to parent window (Copper CRM)
        if (window.parent !== window) {
            parent.postMessage(data, 'https://app.copper.com');
        }
        
        // Also send to any listening frames
        window.postMessage(data, window.location.origin);
    }
    
    // Click-to-dial functionality
    initializeClickToDial() {
        // Listen for phone number clicks in Copper
        document.addEventListener('click', (event) => {
            const phoneElement = event.target.closest('[data-phone]');
            if (phoneElement) {
                event.preventDefault();
                const phoneNumber = phoneElement.dataset.phone || phoneElement.textContent.trim();
                this.makeCall(phoneNumber, {
                    source: 'click-to-dial',
                    element: phoneElement.outerHTML
                });
            }
        });
    }
    
    // Auto-dial from URL parameters
    checkForAutoDialParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const phoneNumber = urlParams.get('dial');
        
        if (phoneNumber) {
            // Auto-dial after a short delay
            setTimeout(() => {
                this.makeCall(phoneNumber, {
                    source: 'url-parameter'
                });
            }, 1000);
        }
    }
}

/**
 * Copper SDK Integration Helper
 */
class CopperSDKHelper {
    constructor() {
        this.sdk = null;
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Check if Copper SDK is available
            if (window.Copper && window.Copper.SDK) {
                this.sdk = window.Copper.SDK;
                await this.sdk.init();
                this.setupSDKHandlers();
                this.initialized = true;
                console.log('Copper SDK initialized successfully');
            } else {
                console.warn('Copper SDK not available');
            }
        } catch (error) {
            console.error('Failed to initialize Copper SDK:', error);
        }
    }
    
    setupSDKHandlers() {
        if (!this.sdk) return;
        
        // Listen for context changes
        this.sdk.on('context', (context) => {
            window.copperIntegration.handleCopperContext(context);
        });
        
        // Listen for navigation events
        this.sdk.on('navigate', (navigation) => {
            console.log('Copper navigation:', navigation);
        });
    }
    
    async getCurrentContext() {
        if (!this.sdk) return null;
        
        try {
            return await this.sdk.getContext();
        } catch (error) {
            console.error('Failed to get Copper context:', error);
            return null;
        }
    }
    
    async showNotification(message, type = 'info') {
        if (!this.sdk) return;
        
        try {
            await this.sdk.showNotification({
                message: message,
                type: type
            });
        } catch (error) {
            console.error('Failed to show Copper notification:', error);
        }
    }
}

// Initialize global instances
window.CopperCRMIntegration = CopperCRMIntegration;
window.CopperSDKHelper = CopperSDKHelper;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.copperIntegration = new CopperCRMIntegration();
    window.copperSDK = new CopperSDKHelper();
    
    // Initialize Copper SDK
    window.copperSDK.initialize();
    
    // Initialize click-to-dial
    window.copperIntegration.initializeClickToDial();
    
    // Check for auto-dial parameters
    window.copperIntegration.checkForAutoDialParams();
});
