/**
 * 🌿 KANVA WEBPHONE SDK LOADER 🌿
 * Production-ready RingCentral WebPhone SDK loader with comprehensive fallback strategies
 * Implements JSDelivr CDN integration with robust error handling and recovery
 */

class WebPhoneSDKLoader {
    constructor() {
        this.cdnUrls = [
            // Primary: JSDelivr with specific version
            'https://cdn.jsdelivr.net/npm/ringcentral-web-phone@2.1.13/dist/esm/index.umd.min.js',
            // Secondary: unpkg fallback
            'https://unpkg.com/ringcentral-web-phone@2.1.13/dist/esm/index.umd.min.js',
        ];
        this.loaded = false;
        this.loading = false;
        this.loadPromise = null;
    }

    async load() {
        if (this.loaded) return;
        if (this.loading) return this.loadPromise;
        
        this.loading = true;
        this.loadPromise = this.attemptLoad();
        
        try {
            await this.loadPromise;
            this.loaded = true;
        } finally {
            this.loading = false;
        }
    }

    async attemptLoad() {
        for (let i = 0; i < this.cdnUrls.length; i++) {
            try {
                await this.loadFromUrl(this.cdnUrls[i]);
                console.log(`Successfully loaded from: ${this.cdnUrls[i]}`);
                return;
            } catch (error) {
                console.warn(`Failed to load from ${this.cdnUrls[i]}:`, error.message);
                if (i === this.cdnUrls.length - 1) {
                    throw new Error('All CDN sources failed to load RingCentral WebPhone SDK');
                }
            }
        }
    }

    loadFromUrl(url) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout loading from ${url}`));
            }, 10000);

            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                clearTimeout(timeout);
                if (this.verifyLoad()) {
                    resolve();
                } else {
                    reject(new Error('SDK loaded but verification failed'));
                }
            };
            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`Network error loading ${url}`));
            };

            document.head.appendChild(script);
        });
    }

    verifyLoad() {
        return !!(
            window.WebPhone || 
            window.RingCentral?.WebPhone ||
            window.RingCentralWebPhone ||
            (window.require && window.require.defined && window.require.defined('ringcentral-web-phone'))
        );
    }
}

/**
 * Token management with automatic refresh
 */
class TokenManager {
    constructor() {
        this.refreshThreshold = 0.8; // Refresh at 80% of token lifetime
        this.backendStorage = {
            store: async (tokens) => {
                // Store tokens securely via backend API
                const response = await fetch('/api/auth/store-tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(tokens)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to store tokens');
                }
                
                const { sessionId } = await response.json();
                return sessionId;
            }
        };
    }
    
    async storeTokens(tokens) {
        // Never store in localStorage - use secure backend storage
        const sessionId = await this.backendStorage.store(tokens);
        this.scheduleRefresh(tokens.expires_in);
        return sessionId;
    }
    
    scheduleRefresh(expiresIn) {
        const refreshTime = expiresIn * this.refreshThreshold * 1000;
        
        setTimeout(async () => {
            try {
                const newTokens = await this.refreshTokens();
                await this.storeTokens(newTokens);
            } catch (error) {
                console.error('Token refresh failed:', error);
                // Force re-authentication
                window.location.href = '/login';
            }
        }, refreshTime);
    }
    
    async refreshTokens() {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Token refresh failed');
        }
        
        return response.json();
    }
}

/**
 * Audio permission management
 */
class AudioPermissionManager {
    async requestPermission() {
        try {
            // Check current permission state
            const permission = await navigator.permissions.query({name: 'microphone'});
            
            if (permission.state === 'granted') {
                return true;
            } else if (permission.state === 'prompt') {
                // Request permission
                const stream = await navigator.mediaDevices.getUserMedia({audio: true});
                stream.getTracks().forEach(track => track.stop());
                return true;
            } else {
                // Permission denied - show instructions
                this.showPermissionInstructions();
                return false;
            }
        } catch (error) {
            console.error('Permission request failed:', error);
            
            // Fallback for browsers that don't support permissions API
            try {
                const stream = await navigator.mediaDevices.getUserMedia({audio: true});
                stream.getTracks().forEach(track => track.stop());
                return true;
            } catch (fallbackError) {
                this.showPermissionInstructions();
                return false;
            }
        }
    }
    
    showPermissionInstructions() {
        const modal = document.createElement('div');
        modal.className = 'permission-modal';
        modal.innerHTML = `
            <div class="permission-content">
                <h3>Microphone Access Required</h3>
                <p>To enable calling features, please:</p>
                <ol>
                    <li>Click the microphone icon in your browser's address bar</li>
                    <li>Select "Allow" for microphone access</li>
                    <li>Refresh the page</li>
                </ol>
                <button onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

/**
 * WebRTC connection management with ICE gathering
 */
class WebRTCConnectionManager {
    constructor() {
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:your-turn-server.com:3478',
                username: 'username',
                credential: 'password'
            },
            {
                urls: 'turns:your-turn-server.com:443',
                username: 'username',
                credential: 'password'
            }
        ];
    }
    
    createPeerConnection() {
        const config = {
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all'
        };
        
        const pc = new RTCPeerConnection(config);
        
        pc.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', pc.iceConnectionState);
            
            if (pc.iceConnectionState === 'failed') {
                this.handleConnectionFailure(pc);
            }
        };
        
        return pc;
    }
    
    async handleConnectionFailure(pc) {
        console.log('ICE connection failed, attempting TURN-only mode');
        
        // Recreate with TURN-only configuration
        const turnOnlyConfig = {
            iceServers: this.iceServers.filter(server => server.urls.includes('turn')),
            iceTransportPolicy: 'relay'
        };
        
        pc.close();
        return new RTCPeerConnection(turnOnlyConfig);
    }
}

/**
 * Network recovery and WebSocket reconnection
 */
class NetworkRecoveryManager {
    constructor(webPhone) {
        this.webPhone = webPhone;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 15; // Increased from 10 to 15 attempts
        this.reconnectTimer = null;
        this.isReconnecting = false;
        this.lastConnectionState = null;
        this.setupNetworkMonitoring();
    }
    
    setupNetworkMonitoring() {
        // Monitor online/offline events
        window.addEventListener('online', () => this.handleNetworkRestore());
        window.addEventListener('offline', () => this.handleNetworkLoss());
        
        // Monitor WebSocket connection if available
        if (this.webPhone.sipClient && this.webPhone.sipClient.wsc) {
            const wsc = this.webPhone.sipClient.wsc;
            
            wsc.addEventListener('open', () => {
                console.log('WebSocket connection established');
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                this.updateConnectionUI('connected');
            });
            
            wsc.addEventListener('close', (event) => {
                console.log(`WebSocket closed: ${event.code} ${event.reason || 'No reason provided'}`);
                if (!event.wasClean) {
                    this.handleWebSocketDisconnect(event);
                } else {
                    this.updateConnectionUI('disconnected');
                }
            });
            
            wsc.addEventListener('error', (error) => {
                console.error('WebSocket error:', error);
                this.handleWebSocketDisconnect({ code: 1006, reason: 'WebSocket error' });
            });
        }
        
        // Monitor connection state changes
        if (this.webPhone.sipClient) {
            this.webPhone.sipClient.on('connectionState', (state) => {
                if (state !== this.lastConnectionState) {
                    console.log(`Connection state changed to: ${state}`);
                    this.lastConnectionState = state;
                    this.updateConnectionUI(state);
                }
            });
        }
    }
    
    async handleNetworkRestore() {
        if (this.isReconnecting) {
            console.log('Already attempting to reconnect...');
            return;
        }
        
        console.log('Network restored, reconnecting WebPhone...');
        this.isReconnecting = true;
        this.updateConnectionUI('reconnecting');
        
        try {
            await this.webPhone.start();
            
            // Re-invite active calls if any were active
            if (this.webPhone.callSessions) {
                this.webPhone.callSessions.forEach((callSession) => {
                    if (callSession.state === 'answered') {
                        console.log('Re-inviting active call after reconnection');
                        callSession.reInvite().catch(err => {
                            console.warn('Failed to re-invite call:', err);
                        });
                    }
                });
            }
            
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            console.log('WebPhone reconnected successfully');
            this.updateConnectionUI('connected');
            
        } catch (error) {
            console.error('Failed to restore WebPhone:', error);
            this.scheduleReconnect();
        }
    }
    
    handleNetworkLoss() {
        console.log('Network connection lost');
        this.updateConnectionUI('disconnected');
        
        // Clear any pending reconnection attempts
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    
    handleWebSocketDisconnect(event) {
        console.log(`WebSocket disconnected: ${event.code} - ${event.reason || 'No reason provided'}`);
        
        // Don't try to reconnect if this was a normal closure
        if (event.code === 1000) {
            console.log('Normal WebSocket closure, not reconnecting');
            return;
        }
        
        this.scheduleReconnect();
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.updateConnectionUI('disconnected');
            this.isReconnecting = false;
            return;
        }
        
        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        
        this.reconnectAttempts++;
        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${Math.round(delay/1000)}s`);
        
        this.updateConnectionUI('reconnecting', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            nextAttemptIn: Math.round(delay/1000)
        });
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.reconnectTimer = setTimeout(() => {
            this.handleNetworkRestore();
        }, delay);
    }
    
    updateConnectionUI(state, data = {}) {
        // Dispatch a custom event that the UI can listen to
        const event = new CustomEvent('kanva-dialer-connection-state', {
            detail: { state, ...data }
        });
        window.dispatchEvent(event);
        
        // Update UI elements if they exist
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            const statusMap = {
                'connected': { text: 'Connected', class: 'status-connected' },
                'disconnected': { text: 'Disconnected', class: 'status-disconnected' },
                'reconnecting': { 
                    text: `Reconnecting (${data.attempt || 1}/${data.maxAttempts || '?'})`,
                    class: 'status-reconnecting' 
                },
                'connecting': { text: 'Connecting...', class: 'status-connecting' }
            };
            
            const status = statusMap[state] || { text: 'Unknown', class: 'status-unknown' };
            
            statusElement.textContent = status.text;
            statusElement.className = `connection-status ${status.class}`;
            
            // Update tooltip with additional info if available
            if (data.nextAttemptIn) {
                statusElement.title = `Next attempt in ${data.nextAttemptIn}s`;
            }
        }
    }
}

// Audio constraints for echo cancellation and feedback prevention
const audioConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Advanced constraints for better quality
        googEchoCancellation: true,
        googNoiseSuppression: true,
        googAutoGainControl: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true
    }
};

// Setup audio stream with feedback detection
async function setupAudioStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        
        // Monitor audio levels for feedback detection
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        function checkForFeedback() {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            if (average > 200) {
                console.warn('Possible audio feedback detected');
                // Temporarily reduce volume or mute
                stream.getAudioTracks()[0].enabled = false;
                setTimeout(() => {
                    stream.getAudioTracks()[0].enabled = true;
                }, 100);
            }
            
            requestAnimationFrame(checkForFeedback);
        }
        
        checkForFeedback();
        return stream;
        
    } catch (error) {
        console.error('Failed to setup audio stream:', error);
        throw error;
    }
}

// Export classes for use in other modules
window.WebPhoneSDKLoader = WebPhoneSDKLoader;
window.TokenManager = TokenManager;
window.AudioPermissionManager = AudioPermissionManager;
window.WebRTCConnectionManager = WebRTCConnectionManager;
window.NetworkRecoveryManager = NetworkRecoveryManager;
window.setupAudioStream = setupAudioStream;
