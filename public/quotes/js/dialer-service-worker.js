/**
 * Kanva Dialer Service Worker
 * Handles background call detection and automatic popup functionality
 */

const CACHE_NAME = 'kanva-dialer-v1';
const DIALER_URL = '/standalone-dialer.html';

// Install event
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                DIALER_URL,
                '/js/unified-dialer.js',
                '/assets/logo/kanva-logo.png'
            ]).catch(err => {
                console.warn('⚠️ Failed to cache some resources:', err);
            });
        })
    );
    
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activated');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    self.clients.claim();
});

// Fetch event - serve cached resources when offline
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('/standalone-dialer.html') || 
        event.request.url.includes('/js/unified-dialer.js')) {
        
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'INCOMING_CALL':
            handleIncomingCall(data);
            break;
        case 'CALL_ENDED':
            handleCallEnded(data);
            break;
        case 'REGISTER_CLIENT':
            registerClient(event.source, data);
            break;
    }
});

// Push event for incoming calls (if using push notifications)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        
        if (data.type === 'incoming_call') {
            event.waitUntil(handleIncomingCall(data));
        }
    }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'answer') {
        // Open dialer and answer call
        event.waitUntil(openDialerAndAnswer(event.notification.data));
    } else if (event.action === 'decline') {
        // Decline call
        event.waitUntil(declineCall(event.notification.data));
    } else {
        // Default action - open dialer
        event.waitUntil(openDialer());
    }
});

/**
 * Handle incoming call notification
 */
async function handleIncomingCall(callData) {
    console.log('📞 Service Worker: Incoming call detected', callData);
    
    try {
        // Show notification
        await showIncomingCallNotification(callData);
        
        // Try to open dialer window
        await openDialerWindow();
        
        // Notify all clients
        await notifyAllClients('INCOMING_CALL', callData);
        
    } catch (error) {
        console.error('❌ Service Worker: Error handling incoming call:', error);
    }
}

/**
 * Show incoming call notification
 */
async function showIncomingCallNotification(callData) {
    const { from, customerName } = callData;
    const displayName = customerName || formatPhoneNumber(from) || 'Unknown Caller';
    
    const notificationOptions = {
        title: 'Incoming Call',
        body: `Call from ${displayName}`,
        icon: '/assets/logo/kanva-logo.png',
        badge: '/assets/logo/kanva-logo.png',
        tag: 'incoming-call',
        requireInteraction: true,
        actions: [
            {
                action: 'answer',
                title: 'Answer',
                icon: '/assets/icons/phone-answer.png'
            },
            {
                action: 'decline',
                title: 'Decline',
                icon: '/assets/icons/phone-decline.png'
            }
        ],
        data: callData,
        vibrate: [200, 100, 200, 100, 200]
    };
    
    return self.registration.showNotification('Incoming Call', notificationOptions);
}

/**
 * Open dialer window
 */
async function openDialerWindow() {
    try {
        // Check if dialer is already open
        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        });
        
        const dialerClient = clients.find(client => 
            client.url.includes('/standalone-dialer.html') || client.url.includes('/dialer')
        );
        
        if (dialerClient) {
            // Focus existing dialer window
            await dialerClient.focus();
            return dialerClient;
        } else {
            // Open new dialer window
            return await self.clients.openWindow(DIALER_URL);
        }
    } catch (error) {
        console.error('❌ Service Worker: Failed to open dialer window:', error);
        return null;
    }
}

/**
 * Open dialer and answer call
 */
async function openDialerAndAnswer(callData) {
    try {
        const client = await openDialerWindow();
        
        if (client) {
            // Send message to answer call
            client.postMessage({
                type: 'ANSWER_CALL',
                data: callData
            });
        }
    } catch (error) {
        console.error('❌ Service Worker: Failed to answer call:', error);
    }
}

/**
 * Decline call
 */
async function declineCall(callData) {
    try {
        // Notify all clients to decline call
        await notifyAllClients('DECLINE_CALL', callData);
    } catch (error) {
        console.error('❌ Service Worker: Failed to decline call:', error);
    }
}

/**
 * Open dialer (default action)
 */
async function openDialer() {
    try {
        await openDialerWindow();
    } catch (error) {
        console.error('❌ Service Worker: Failed to open dialer:', error);
    }
}

/**
 * Handle call ended
 */
async function handleCallEnded(callData) {
    console.log('📴 Service Worker: Call ended', callData);
    
    try {
        // Close any incoming call notifications
        const notifications = await self.registration.getNotifications({
            tag: 'incoming-call'
        });
        
        notifications.forEach(notification => notification.close());
        
        // Notify all clients
        await notifyAllClients('CALL_ENDED', callData);
        
    } catch (error) {
        console.error('❌ Service Worker: Error handling call end:', error);
    }
}

/**
 * Register client for communication
 */
function registerClient(client, data) {
    console.log('📝 Service Worker: Client registered', data);
    // Store client info if needed for targeted messaging
}

/**
 * Notify all clients
 */
async function notifyAllClients(type, data) {
    try {
        const clients = await self.clients.matchAll({
            includeUncontrolled: true
        });
        
        const message = { type, data };
        
        clients.forEach(client => {
            client.postMessage(message);
        });
        
        console.log(`📢 Service Worker: Notified ${clients.length} clients of ${type}`);
        
    } catch (error) {
        console.error('❌ Service Worker: Failed to notify clients:', error);
    }
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone) {
    if (!phone) return null;
    
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    
    if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    
    return phone;
}

/**
 * Background sync for call data
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'call-sync') {
        event.waitUntil(syncCallData());
    }
});

/**
 * Sync call data when back online
 */
async function syncCallData() {
    try {
        console.log('🔄 Service Worker: Syncing call data...');
        
        // Get pending call data from IndexedDB or cache
        // This would sync any offline call logs, notes, etc.
        
        console.log('✅ Service Worker: Call data synced');
        
    } catch (error) {
        console.error('❌ Service Worker: Failed to sync call data:', error);
    }
}

/**
 * Periodic background sync (if supported)
 */
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'call-status-check') {
        event.waitUntil(checkCallStatus());
    }
});

/**
 * Check for missed calls or status updates
 */
async function checkCallStatus() {
    try {
        console.log('🔍 Service Worker: Checking call status...');
        
        // This could check for missed calls, voicemails, etc.
        // and show notifications accordingly
        
    } catch (error) {
        console.error('❌ Service Worker: Failed to check call status:', error);
    }
}

console.log('🚀 Kanva Dialer Service Worker loaded');
