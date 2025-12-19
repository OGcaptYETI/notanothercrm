/**
 * Copper CRM Dialer Integration
 * Replaces the Dial4$ button and native RingCentral integration
 * Embeds the unified dialer as a modal within Copper CRM
 */
class CopperDialerIntegration {
    constructor() {
        this.modal = null;
        this.iframe = null;
        this.isOpen = false;
        this.currentContext = null;
        
        this.init();
    }

    /**
     * Initialize Copper integration
     */
    init() {
        console.log('🚀 Initializing Copper Dialer Integration...');
        
        // Wait for Copper to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupIntegration());
        } else {
            this.setupIntegration();
        }
    }

    /**
     * Setup integration with Copper CRM
     */
    setupIntegration() {
        // Remove old Dial4$ button if it exists
        this.removeOldDialer();
        
        // Add new dialer button to Copper interface
        this.addDialerButton();
        
        // Listen for phone number clicks in Copper
        this.bindPhoneClickEvents();
        
        // Listen for messages from dialer iframe
        window.addEventListener('message', (event) => this.handleDialerMessage(event));
        
        console.log('✅ Copper integration setup complete');
    }

    /**
     * Remove old Dial4$ button and native RingCentral integration
     */
    removeOldDialer() {
        // Remove Dial4$ button
        const dial4Button = document.querySelector('[data-action="dial4"]');
        if (dial4Button) {
            dial4Button.remove();
            console.log('🗑️ Removed old Dial4$ button');
        }

        // Remove old RingCentral widget containers
        const oldWidgets = document.querySelectorAll('[id*="ringcentral"], [class*="ringcentral"]');
        oldWidgets.forEach(widget => {
            if (widget.id !== 'kanva-dialer-modal') { // Don't remove our modal
                widget.remove();
            }
        });

        // Remove old dialer scripts
        const oldScripts = document.querySelectorAll('script[src*="ringcentral"]');
        oldScripts.forEach(script => {
            if (!script.src.includes('unified-dialer')) { // Keep our script
                script.remove();
            }
        });

        console.log('🗑️ Cleaned up old RingCentral integrations');
    }

    /**
     * Add Kanva dialer button to Copper interface
     */
    addDialerButton() {
        // Find Copper's action bar or toolbar
        const actionBar = document.querySelector('.action-bar, .toolbar, .header-actions, [data-testid="action-bar"]');
        
        if (actionBar) {
            const dialerButton = document.createElement('button');
            dialerButton.id = 'kanva-dialer-button';
            dialerButton.className = 'btn btn-primary kanva-dialer-btn';
            dialerButton.innerHTML = `
                <i class="fas fa-phone" style="margin-right: 8px;"></i>
                Kanva Dialer
            `;
            dialerButton.style.cssText = `
                background: linear-gradient(135deg, #22c55e, #16a34a);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                margin-left: 8px;
                transition: all 0.2s ease;
            `;
            
            dialerButton.addEventListener('click', () => this.openDialer());
            dialerButton.addEventListener('mouseenter', () => {
                dialerButton.style.transform = 'translateY(-1px)';
                dialerButton.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
            });
            dialerButton.addEventListener('mouseleave', () => {
                dialerButton.style.transform = 'translateY(0)';
                dialerButton.style.boxShadow = 'none';
            });
            
            actionBar.appendChild(dialerButton);
            console.log('✅ Added Kanva dialer button to Copper');
        } else {
            console.warn('⚠️ Could not find Copper action bar to add dialer button');
        }
    }

    /**
     * Bind click events to phone numbers in Copper
     */
    bindPhoneClickEvents() {
        // Use event delegation to handle dynamically loaded content
        document.addEventListener('click', (event) => {
            const target = event.target;
            
            // Check if clicked element is a phone number
            if (this.isPhoneNumber(target)) {
                event.preventDefault();
                const phoneNumber = this.extractPhoneNumber(target.textContent);
                this.openDialer(phoneNumber, true); // Auto-call
            }
        });

        // Also bind to phone input fields
        document.addEventListener('dblclick', (event) => {
            const target = event.target;
            
            if (target.tagName === 'INPUT' && (
                target.type === 'tel' || 
                target.name?.includes('phone') || 
                target.placeholder?.toLowerCase().includes('phone')
            )) {
                const phoneNumber = this.extractPhoneNumber(target.value);
                if (phoneNumber) {
                    this.openDialer(phoneNumber);
                }
            }
        });

        console.log('✅ Phone click events bound');
    }

    /**
     * Check if element contains a phone number
     */
    isPhoneNumber(element) {
        if (!element || !element.textContent) return false;
        
        const text = element.textContent.trim();
        const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
        
        return phoneRegex.test(text) && (
            element.tagName === 'A' ||
            element.classList.contains('phone') ||
            element.getAttribute('data-type') === 'phone' ||
            element.closest('[data-field-type="phone"]') ||
            text.length >= 10 && text.length <= 17
        );
    }

    /**
     * Extract phone number from text
     */
    extractPhoneNumber(text) {
        if (!text) return '';
        
        const cleaned = text.replace(/\D/g, '');
        
        // Handle US numbers
        if (cleaned.length === 10) {
            return cleaned;
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return cleaned.substring(1);
        }
        
        return cleaned;
    }

    /**
     * Open dialer modal
     */
    openDialer(phoneNumber = '', autoCall = false) {
        if (this.isOpen) {
            // If already open, just update the number
            if (phoneNumber && this.iframe) {
                this.iframe.contentWindow.postMessage({
                    target: 'kanva-dialer',
                    type: 'dial-number',
                    data: { number: phoneNumber, autoCall }
                }, '*');
            }
            return;
        }

        console.log('📞 Opening Kanva dialer modal', { phoneNumber, autoCall });

        // Get current Copper context
        this.currentContext = this.getCopperContext();

        // Create modal overlay
        this.createModal();

        // Create iframe
        this.createIframe(phoneNumber, autoCall);

        // Show modal
        this.showModal();

        this.isOpen = true;
    }

    /**
     * Get current Copper context (customer/company info)
     */
    getCopperContext() {
        const context = {
            url: window.location.href,
            type: null,
            id: null,
            name: null,
            company: null,
            email: null,
            phone: null
        };

        // Extract from URL
        const urlMatch = window.location.pathname.match(/\/(people|companies|leads)\/(\d+)/);
        if (urlMatch) {
            context.type = urlMatch[1].slice(0, -1); // Remove 's' from plural
            context.id = urlMatch[2];
        }

        // Try to extract name from page
        const nameSelectors = [
            'h1[data-testid="entity-name"]',
            '.entity-name',
            '.contact-name',
            '.company-name',
            'h1.name'
        ];

        for (const selector of nameSelectors) {
            const nameEl = document.querySelector(selector);
            if (nameEl) {
                context.name = nameEl.textContent.trim();
                break;
            }
        }

        // Try to extract email
        const emailEl = document.querySelector('[data-field-type="email"] a, .email a, [href^="mailto:"]');
        if (emailEl) {
            context.email = emailEl.textContent.trim() || emailEl.href.replace('mailto:', '');
        }

        // Try to extract phone
        const phoneEl = document.querySelector('[data-field-type="phone"], .phone, [href^="tel:"]');
        if (phoneEl) {
            context.phone = this.extractPhoneNumber(phoneEl.textContent || phoneEl.href.replace('tel:', ''));
        }

        console.log('📋 Copper context:', context);
        return context;
    }

    /**
     * Create modal overlay
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = 'kanva-dialer-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Close on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeDialer();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeDialer();
            }
        });

        document.body.appendChild(this.modal);
    }

    /**
     * Create dialer iframe
     */
    createIframe(phoneNumber = '', autoCall = false) {
        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            width: 100%;
            max-width: 420px;
            height: 600px;
            position: relative;
            transform: translateY(20px);
            transition: transform 0.3s ease;
        `;

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            border: none;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
        `;
        closeButton.addEventListener('click', () => this.closeDialer());
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(0, 0, 0, 0.2)';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(0, 0, 0, 0.1)';
        });

        // Create iframe
        this.iframe = document.createElement('iframe');
        this.iframe.src = '/standalone-dialer.html';
        this.iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 12px;
        `;

        // Handle iframe load
        this.iframe.addEventListener('load', () => {
            console.log('✅ Dialer iframe loaded');
            
            // Send initial data to iframe
            setTimeout(() => {
                if (phoneNumber) {
                    this.iframe.contentWindow.postMessage({
                        target: 'kanva-dialer',
                        type: 'dial-number',
                        data: { number: phoneNumber, autoCall }
                    }, '*');
                }

                if (this.currentContext) {
                    this.iframe.contentWindow.postMessage({
                        target: 'kanva-dialer',
                        type: 'customer-context',
                        data: this.currentContext
                    }, '*');
                }
            }, 1000);
        });

        iframeContainer.appendChild(closeButton);
        iframeContainer.appendChild(this.iframe);
        this.modal.appendChild(iframeContainer);

        // Animate in
        setTimeout(() => {
            iframeContainer.style.transform = 'translateY(0)';
        }, 10);
    }

    /**
     * Show modal
     */
    showModal() {
        setTimeout(() => {
            this.modal.style.opacity = '1';
        }, 10);
    }

    /**
     * Close dialer modal
     */
    closeDialer() {
        if (!this.isOpen) return;

        console.log('📴 Closing Kanva dialer modal');

        this.modal.style.opacity = '0';
        
        setTimeout(() => {
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            this.modal = null;
            this.iframe = null;
            this.isOpen = false;
            this.currentContext = null;
        }, 300);
    }

    /**
     * Handle messages from dialer iframe
     */
    handleDialerMessage(event) {
        if (event.data.source !== 'kanva-dialer') return;

        const { type, data } = event.data;

        switch (type) {
            case 'dialer-ready':
                console.log('✅ Dialer ready in iframe');
                break;

            case 'incoming-call':
                console.log('📞 Incoming call notification:', data);
                // Could show browser notification or update Copper UI
                this.showIncomingCallNotification(data);
                break;

            case 'open-copper-record':
                console.log('🔗 Opening Copper record:', data);
                window.open(data.url, '_blank');
                break;

            case 'call-ended':
                console.log('📴 Call ended, refreshing Copper context');
                // Could refresh the current Copper page or update UI
                break;

            default:
                console.log('Unknown dialer message:', type, data);
        }
    }

    /**
     * Show incoming call notification
     */
    showIncomingCallNotification(data) {
        // Create a small notification in Copper
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            font-weight: 500;
            cursor: pointer;
            animation: slideIn 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center;">
                <i class="fas fa-phone" style="margin-right: 12px; font-size: 18px;"></i>
                <div>
                    <div style="font-weight: bold;">Incoming Call</div>
                    <div style="font-size: 14px; opacity: 0.9;">${data.number}</div>
                    ${data.customerData ? `<div style="font-size: 12px; opacity: 0.8;">${data.customerData.name || 'Known Customer'}</div>` : ''}
                </div>
            </div>
        `;

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        notification.addEventListener('click', () => {
            if (!this.isOpen) {
                this.openDialer();
            }
            notification.remove();
        });

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }
}

// Initialize when Copper loads
if (typeof window !== 'undefined') {
    // Wait for Copper to be ready
    const initIntegration = () => {
        if (document.querySelector('.app-container, #app, [data-testid="app"]') || 
            window.location.hostname.includes('copper.com')) {
            new CopperDialerIntegration();
        } else {
            setTimeout(initIntegration, 1000);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initIntegration);
    } else {
        initIntegration();
    }
}

// Export for manual initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CopperDialerIntegration;
}
