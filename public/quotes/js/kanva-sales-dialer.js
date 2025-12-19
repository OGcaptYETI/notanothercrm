/**
 * 🌿 KANVA SALES DIALER - COMPLETE WEBPHONE SDK IMPLEMENTATION 🌿
 * Production-ready RingCentral WebPhone integration with comprehensive features
 * Follows the complete implementation guide with security and monitoring
 */

class KanvaSalesDialer {
    constructor(config) {
        this.config = config;
        this.webPhone = null;
        this.activeCalls = new Map();
        this.rc = null;
        this.tokenManager = new TokenManager();
        this.sdkLoader = new WebPhoneSDKLoader();
        this.audioManager = new AudioPermissionManager();
        this.connectionManager = null;
        this.networkManager = null;
        this.qualityMonitor = new CallQualityMonitor();
        
        // Initialize managers
        this.initializeManagers();
    }
    
    initializeManagers() {
        this.connectionManager = new WebRTCConnectionManager();
    }
    
    async initialize() {
        try {
            // Load WebPhone SDK with fallback strategies
            await this.sdkLoader.load();
            
            // Request microphone permissions
            const hasPermission = await this.audioManager.requestPermission();
            if (!hasPermission) {
                throw new Error('Microphone permission required for calling');
            }
            
            // Get SIP provisioning from secure backend
            const sipData = await this.getSipProvisioning();
            
            // Initialize WebPhone with comprehensive configuration
            const WebPhone = window.WebPhone || window.RingCentralWebPhone;
            
            // Configure WebSocket server URL based on environment
            const wsServer = this.config.ringcentral.server === 'https://platform.ringcentral.com' 
                ? 'wss://ws.ringcentral.com/ws' 
                : 'wss://ws.dev.ringcentral.com/ws';
            
            this.webPhone = new WebPhone({ 
                sipInfo: sipData.sipInfo,
                instanceId: `${this.config.userId}_${Date.now()}`,
                debug: this.config.debug || false,
                autoAnswer: false,
                enableQos: true,
                enableMediaReportLogging: this.config.enableMediaReportLogging || false,
                // Add WebSocket configuration
                server: wsServer,
                // Add ICE servers for better connectivity
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    // Add your TURN servers here if available
                ]
            });
            
            await this.webPhone.start();
            this.setupEventHandlers();
            this.setupNetworkRecovery();
            
            console.log('Kanva Sales Dialer initialized successfully');
            return this.webPhone;
            
        } catch (error) {
            console.error('Initialization failed:', error);
            throw error;
        }
    }
    
    async getSipProvisioning() {
        const response = await fetch('/api/webphone/provision', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get SIP provisioning');
        }
        
        return response.json();
    }
    
    setupEventHandlers() {
        // Inbound call handling
        this.webPhone.on('inboundCall', (callSession) => {
            console.log('Incoming call from:', callSession.remoteNumber);
            this.activeCalls.set(callSession.callId, callSession);
            this.setupCallHandlers(callSession);
            
            // Start call quality monitoring
            this.qualityMonitor.startMonitoring(callSession);
            
            // Trigger screen pop in Copper CRM
            this.handleScreenPop(callSession.remoteNumber);
        });
        
        // Outbound call handling
        this.webPhone.on('outboundCall', (callSession) => {
            console.log('Outbound call to:', callSession.remoteNumber);
            this.activeCalls.set(callSession.callId, callSession);
            this.setupCallHandlers(callSession);
            
            // Start call quality monitoring
            this.qualityMonitor.startMonitoring(callSession);
        });
        
        // WebPhone connection events
        this.webPhone.on('registered', () => {
            console.log('WebPhone registered successfully');
            this.updateUI('ready');
        });
        
        this.webPhone.on('unregistered', () => {
            console.log('WebPhone unregistered');
            this.updateUI('disconnected');
        });
    }
    
    setupCallHandlers(callSession) {
        callSession.on('answered', () => {
            console.log(`Call ${callSession.callId} answered`);
            this.updateUI('connected');
            this.startCallTimer(callSession);
        });
        
        callSession.on('disposed', () => {
            console.log(`Call ${callSession.callId} ended`);
            this.activeCalls.delete(callSession.callId);
            this.stopCallTimer(callSession);
            this.logCallToCopper(callSession);
            this.updateUI('idle');
        });
        
        callSession.on('muted', () => {
            console.log(`Call ${callSession.callId} muted`);
            this.updateMuteUI(true);
        });
        
        callSession.on('unmuted', () => {
            console.log(`Call ${callSession.callId} unmuted`);
            this.updateMuteUI(false);
        });
        
        callSession.on('hold', () => {
            console.log(`Call ${callSession.callId} on hold`);
            this.updateHoldUI(true);
        });
        
        callSession.on('unhold', () => {
            console.log(`Call ${callSession.callId} off hold`);
            this.updateHoldUI(false);
        });
    }
    
    setupNetworkRecovery() {
        this.networkManager = new NetworkRecoveryManager(this.webPhone);
    }
    
    // Core call control methods
    async makeCall(toNumber, fromNumber) {
        try {
            const callSession = await this.webPhone.call(toNumber, fromNumber);
            this.activeCalls.set(callSession.callId, callSession);
            this.setupCallHandlers(callSession);
            this.qualityMonitor.startMonitoring(callSession);
            return callSession;
        } catch (error) {
            console.error('Failed to make call:', error);
            throw error;
        }
    }
    
    async answerCall(callId) {
        const callSession = this.activeCalls.get(callId);
        if (callSession) {
            await callSession.answer();
        }
    }
    
    async toggleMute(callId) {
        const callSession = this.activeCalls.get(callId);
        if (!callSession) return;
        
        if (callSession.muted) {
            await callSession.unmute();
        } else {
            await callSession.mute();
        }
    }
    
    async toggleHold(callId) {
        const callSession = this.activeCalls.get(callId);
        if (!callSession) return;
        
        if (callSession.onHold) {
            await callSession.unhold();
        } else {
            await callSession.hold();
        }
    }
    
    async transferCall(callId, targetNumber, warm = false) {
        const callSession = this.activeCalls.get(callId);
        if (!callSession) return;
        
        if (warm) {
            const { complete, cancel } = await callSession.warmTransfer(targetNumber);
            // After consulting with target, complete or cancel
            return { complete, cancel };
        } else {
            await callSession.transfer(targetNumber);
        }
    }
    
    async sendDTMF(callId, tones) {
        const callSession = this.activeCalls.get(callId);
        if (callSession) {
            await callSession.sendDtmf(tones);
        }
    }
    
    async hangup(callId) {
        const callSession = this.activeCalls.get(callId);
        if (callSession) {
            await callSession.hangup();
        }
    }
    
    // Call timer management
    startCallTimer(callSession) {
        callSession.startTime = Date.now();
        callSession.timer = setInterval(() => {
            const duration = Date.now() - callSession.startTime;
            this.updateCallDurationUI(callSession.callId, duration);
        }, 1000);
    }
    
    stopCallTimer(callSession) {
        if (callSession.timer) {
            clearInterval(callSession.timer);
            callSession.timer = null;
        }
        
        if (callSession.startTime) {
            callSession.duration = Date.now() - callSession.startTime;
        }
    }
    
    // CRM Integration
    async handleScreenPop(phoneNumber) {
        try {
            const customerData = await this.lookupCustomer(phoneNumber);
            if (customerData) {
                this.showScreenPop(customerData);
            }
        } catch (error) {
            console.error('Failed to lookup customer:', error);
        }
    }
    
    async lookupCustomer(phoneNumber) {
        const response = await fetch('/api/copper/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phoneNumber })
        });
        
        if (response.ok) {
            return response.json();
        }
        
        return null;
    }
    
    showScreenPop(customerData) {
        // Emit event for UI to handle screen pop
        window.dispatchEvent(new CustomEvent('kanva-screen-pop', {
            detail: customerData
        }));
    }
    
    async logCallToCopper(callSession) {
        try {
            const callData = {
                phoneNumber: callSession.remoteNumber,
                direction: callSession.direction,
                duration: callSession.duration || 0,
                startTime: callSession.startTime,
                endTime: Date.now(),
                callId: callSession.callId,
                result: callSession.disposed ? 'completed' : 'missed'
            };
            
            await fetch('/api/copper/log-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(callData)
            });
        } catch (error) {
            console.error('Failed to log call to Copper:', error);
        }
    }
    
    // UI Update methods (to be implemented by UI layer)
    updateUI(state) {
        window.dispatchEvent(new CustomEvent('kanva-dialer-state', {
            detail: { state }
        }));
    }
    
    updateMuteUI(muted) {
        window.dispatchEvent(new CustomEvent('kanva-call-muted', {
            detail: { muted }
        }));
    }
    
    updateHoldUI(onHold) {
        window.dispatchEvent(new CustomEvent('kanva-call-hold', {
            detail: { onHold }
        }));
    }
    
    updateCallDurationUI(callId, duration) {
        window.dispatchEvent(new CustomEvent('kanva-call-duration', {
            detail: { callId, duration }
        }));
    }
    
    // Cleanup
    async destroy() {
        if (this.webPhone) {
            await this.webPhone.stop();
        }
        
        this.activeCalls.clear();
        
        if (this.networkManager) {
            // Cleanup network manager
        }
    }
}

/**
 * Call quality monitoring with MOS scoring
 */
class CallQualityMonitor {
    constructor() {
        this.metrics = new Map();
        this.analyticsEndpoint = '/api/analytics/call-quality';
    }

    startMonitoring(callSession) {
        const statsInterval = setInterval(() => {
            this.collectStats(callSession);
        }, 2000);

        callSession.on('disposed', () => {
            clearInterval(statsInterval);
            this.generateCallReport(callSession.callId);
        });
    }

    async collectStats(callSession) {
        try {
            const stats = await callSession.getStats();
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                    const metrics = {
                        callId: callSession.callId,
                        timestamp: Date.now(),
                        packetsReceived: report.packetsReceived,
                        packetsLost: report.packetsLost,
                        packetLossRate: report.packetsLost / (report.packetsReceived + report.packetsLost),
                        jitter: report.jitter * 1000,
                        audioLevel: report.audioLevel
                    };
                    
                    // Calculate MOS score
                    metrics.mosScore = this.calculateMOS(metrics.packetLossRate, metrics.jitter);
                    
                    this.metrics.set(callSession.callId, metrics);
                    this.sendMetrics(metrics);
                }
            });
        } catch (error) {
            console.error('Failed to collect stats:', error);
        }
    }

    calculateMOS(packetLoss, jitter) {
        let mos = 4.5;
        
        // Packet loss impact
        if (packetLoss > 0.01) mos -= 0.5;
        if (packetLoss > 0.03) mos -= 1.0;
        if (packetLoss > 0.05) mos -= 1.5;
        
        // Jitter impact
        if (jitter > 50) mos -= 0.3;
        if (jitter > 100) mos -= 0.7;
        if (jitter > 200) mos -= 1.2;
        
        return Math.max(1.0, Math.min(4.5, mos));
    }

    async sendMetrics(metrics) {
        try {
            await fetch(this.analyticsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(metrics)
            });
        } catch (error) {
            console.error('Failed to send metrics:', error);
        }
    }

    generateCallReport(callId) {
        const metrics = this.metrics.get(callId);
        if (metrics) {
            console.log(`Call Quality Report for ${callId}:`, {
                averageMOS: metrics.mosScore,
                packetLoss: (metrics.packetLossRate * 100).toFixed(2) + '%',
                jitter: metrics.jitter.toFixed(2) + 'ms'
            });
        }
    }
}

// Export for global use
window.KanvaSalesDialer = KanvaSalesDialer;
window.CallQualityMonitor = CallQualityMonitor;
