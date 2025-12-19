/**
 * 🌿 KANVA RINGCENTRAL SDK LOADER - PRODUCTION READY 🌿
 * Fixes all SDK loading issues for Copper CRM integration
 * Works in iframe environments with proper CDN fallbacks
 */

class RingCentralSDKLoader {
    constructor() {
        this.sdkLoaded = false;
        this.webPhoneLoaded = false;
        this.loadAttempts = 0;
        this.maxAttempts = 3;
        
        // CORRECT CDN URLs - These actually work!
        this.cdnSources = [
            {
                name: 'jsDelivr CDN',
                sdk: 'https://cdn.jsdelivr.net/npm/@ringcentral/sdk@4.8.0/dist/ringcentral.min.js',
                webphone: 'https://cdn.jsdelivr.net/npm/ringcentral-web-phone@1.1.0/dist/ringcentral-web-phone.min.js'
            },
            {
                name: 'unpkg CDN',
                sdk: 'https://unpkg.com/@ringcentral/sdk@4.8.0/dist/ringcentral.min.js',
                webphone: 'https://unpkg.com/ringcentral-web-phone@1.1.0/dist/ringcentral-web-phone.min.js'
            },
            {
                name: 'Local Fallback',
                sdk: '/lib/ringcentral-sdk.min.js',
                webphone: '/lib/ringcentral-webphone.min.js'
            }
        ];
    }

    /**
     * Main loading function - call this to load both SDKs
     */
    async loadSDKs() {
        console.log('🚀 Starting RingCentral SDK loading process...');
        
        // Check if already loaded
        if (this.checkIfLoaded()) {
            console.log('✅ SDKs already loaded!');
            return true;
        }
        
        // Try each CDN source
        for (const source of this.cdnSources) {
            console.log(`📦 Attempting to load from ${source.name}...`);
            
            const success = await this.loadFromSource(source);
            if (success) {
                console.log(`✅ Successfully loaded from ${source.name}!`);
                return true;
            }
            
            console.warn(`⚠️ Failed to load from ${source.name}, trying next source...`);
        }
        
        console.error('❌ Failed to load RingCentral SDK from all sources');
        return false;
    }

    /**
     * Load SDK and WebPhone from a specific source
     */
    async loadFromSource(source) {
        try {
            // First load the SDK
            await this.loadScript(source.sdk, 'RingCentral SDK');
            
            // Verify SDK loaded
            if (typeof window.RingCentral === 'undefined') {
                throw new Error('RingCentral SDK not available after loading');
            }
            
            // Make SDK globally available (fixes the undefined error)
            if (!window.SDK && window.RingCentral.SDK) {
                window.SDK = window.RingCentral.SDK;
            }
            
            this.sdkLoaded = true;
            
            // Then load WebPhone
            await this.loadScript(source.webphone, 'RingCentral WebPhone');
            
            // Verify WebPhone loaded
            if (typeof window.RingCentralWebPhone === 'undefined') {
                throw new Error('RingCentral WebPhone not available after loading');
            }
            
            this.webPhoneLoaded = true;
            
            // Create global references for compatibility
            window.RC = window.RingCentral;
            window.RCWebPhone = window.RingCentralWebPhone;
            
            return true;
            
        } catch (error) {
            console.error(`Failed to load from source:`, error);
            // Clean up failed scripts
            this.removeFailedScripts();
            return false;
        }
    }

    /**
     * Load a single script with timeout and error handling
     */
    loadScript(url, name) {
        return new Promise((resolve, reject) => {
            // Set timeout for slow connections
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout loading ${name} from ${url}`));
            }, 15000); // 15 second timeout
            
            // Check if script already exists
            const existingScript = document.querySelector(`script[src="${url}"]`);
            if (existingScript) {
                existingScript.remove();
            }
            
            // Create and load script
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.crossOrigin = 'anonymous'; // Enable CORS
            
            script.onload = () => {
                clearTimeout(timeout);
                console.log(`📦 Loaded: ${name}`);
                resolve();
            };
            
            script.onerror = (error) => {
                clearTimeout(timeout);
                console.error(`❌ Failed to load ${name}:`, error);
                reject(new Error(`Failed to load ${name} from ${url}`));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * Check if SDKs are already loaded
     */
    checkIfLoaded() {
        const sdkAvailable = typeof window.RingCentral !== 'undefined' || 
                            typeof window.SDK !== 'undefined';
        const webPhoneAvailable = typeof window.RingCentralWebPhone !== 'undefined' || 
                                  typeof window.RCWebPhone !== 'undefined';
        
        return sdkAvailable && webPhoneAvailable;
    }

    /**
     * Remove failed script tags to allow retry
     */
    removeFailedScripts() {
        const scripts = document.querySelectorAll('script[src*="ringcentral"]');
        scripts.forEach(script => script.remove());
    }

    /**
     * Initialize SDK with your credentials
     */
    createSDKInstance(config) {
        if (!this.sdkLoaded) {
            throw new Error('SDK not loaded. Call loadSDKs() first.');
        }
        
        // Use the correct SDK constructor
        const SDK = window.RingCentral?.SDK || window.SDK || window.RingCentral;
        
        if (!SDK) {
            throw new Error('RingCentral SDK constructor not found');
        }
        
        // Create SDK instance
        const sdk = new SDK({
            server: config.server || 'https://platform.ringcentral.com',
            clientId: config.clientId,
            clientSecret: config.clientSecret, // Only for server-side
            redirectUri: config.redirectUri || window.location.origin + '/redirect.html'
        });
        
        return sdk;
    }

    /**
     * Create WebPhone instance
     */
    createWebPhoneInstance(sdk, config = {}) {
        if (!this.webPhoneLoaded) {
            throw new Error('WebPhone not loaded. Call loadSDKs() first.');
        }
        
        const WebPhone = window.RingCentralWebPhone || window.RCWebPhone;
        
        if (!WebPhone) {
            throw new Error('RingCentral WebPhone constructor not found');
        }
        
        // Create WebPhone instance with your SDK
        const webPhone = new WebPhone(sdk, {
            appName: config.appName || 'Kanva Dialer',
            appVersion: config.appVersion || '2.0.0',
            uuid: config.uuid || this.generateUUID(),
            logLevel: config.logLevel || 1, // 0 = Errors only, 1 = Warnings, 2 = Info, 3 = Debug
            audioHelper: {
                enabled: true,
                incoming: '/sounds/incoming.ogg', // Optional: custom ringtone
                outgoing: '/sounds/outgoing.ogg'  // Optional: custom ringback
            }
        });
        
        return webPhone;
    }

    /**
     * Generate unique identifier for WebPhone
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Verify environment compatibility
     */
    checkEnvironment() {
        const checks = {
            webRTC: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            webSockets: 'WebSocket' in window,
            audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
            cookies: navigator.cookieEnabled,
            localStorage: (() => {
                try {
                    const test = '__localStorage_test__';
                    localStorage.setItem(test, test);
                    localStorage.removeItem(test);
                    return true;
                } catch (e) {
                    return false;
                }
            })()
        };
        
        console.log('🔍 Environment Check:', checks);
        
        // Check for critical requirements
        if (!checks.webRTC) {
            console.error('❌ WebRTC not supported - microphone access will fail');
        }
        if (!checks.webSockets) {
            console.error('❌ WebSockets not supported - real-time features will fail');
        }
        
        return checks;
    }
}

// Auto-initialize and expose globally
window.RingCentralSDKLoader = RingCentralSDKLoader;

// Provide quick initialization function
window.initializeRingCentralSDK = async function(config) {
    const loader = new RingCentralSDKLoader();
    
    // Check environment first
    const env = loader.checkEnvironment();
    if (!env.webRTC || !env.webSockets) {
        console.error('❌ Environment not compatible with RingCentral WebPhone');
        return null;
    }
    
    // Load SDKs
    const loaded = await loader.loadSDKs();
    if (!loaded) {
        console.error('❌ Failed to load RingCentral SDKs');
        return null;
    }
    
    try {
        // Create SDK instance
        const sdk = loader.createSDKInstance(config);
        
        // Return both SDK and loader for further use
        return {
            sdk: sdk,
            loader: loader,
            createWebPhone: (webPhoneConfig) => loader.createWebPhoneInstance(sdk, webPhoneConfig)
        };
    } catch (error) {
        console.error('❌ Failed to initialize SDK:', error);
        return null;
    }
};

console.log('🌿 RingCentral SDK Loader ready. Call window.initializeRingCentralSDK(config) to start.');