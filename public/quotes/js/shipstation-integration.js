/**
 * ShipStation Integration for Kanva Quotes
 * Handles shipping rate calculations and order fulfillment
 * Based on ShipStation API: https://www.shipstation.com/docs/api/
 */

class ShipStationIntegration {
    /**
     * Initialize the ShipStation integration
     * @param {Object} config - Configuration object
     * @param {string} config.apiKey - ShipStation API key
     * @param {string} config.apiSecret - ShipStation API secret
     * @param {string} config.environment - Environment (production or sandbox)
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.apiSecret = config.apiSecret || '';
        this.environment = config.environment || 'sandbox';
        this.connected = false;
        this.lastSync = null;
        this.useProxy = true; // legacy proxy flag (kept for compatibility)
        this.useQueue = false; // Disabled: Firebase queue requires Cloud Function; use server proxy instead
        this.allowOrderCreation = config.allowOrderCreation !== undefined ? config.allowOrderCreation : false; // Do not send orders to ShipStation from this app
        
        // ShipStation uses a single base URL; sandbox/prod is determined by credentials
        this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
        
        console.log('🚢 ShipStationIntegration initialized');
        
        // Load connection from server if available
        this.loadConnectionFromServer();
    }

    /**
     * Build full API URL respecting proxy vs direct mode
     */
    _endpoint(path) {
        const base = this.apiBase.endsWith('/') ? this.apiBase.slice(0, -1) : this.apiBase;
        const p = path.startsWith('/') ? path : `/${path}`;
        return `${base}${p}`;
    }

    /**
     * Build headers. In proxy mode, do NOT attach Authorization in browser.
     */
    _headers() {
        if (this.useProxy || this.useQueue) {
            return { 'Content-Type': 'application/json' };
        }
        const authHeader = 'Basic ' + btoa(`${this.apiKey}:${this.apiSecret}`);
        return { 'Authorization': authHeader, 'Content-Type': 'application/json' };
    }

    /**
     * Enqueue a request in Firestore and wait for response.
     * @param {string} op - operation name (e.g., 'testConnection','listOrders','getOrder','getRates')
     * @param {Object} params - operation parameters
     * @param {number} timeoutMs - timeout in ms
     */
    async _enqueue(op, params = {}, timeoutMs = 20000) {
        // Ensure Firebase is initialized
        if (!window.firebase || !window.firebase.db) {
            throw new Error('Firebase is not initialized');
        }
        const db = window.firebase.db;
        const now = new Date();
        const requestRef = db.collection('shipstationRequests').doc();
        const requestId = requestRef.id;
        const payload = {
            op,
            params,
            createdAt: now,
            requestedBy: (window.firebase.auth && window.firebase.auth.currentUser) ? window.firebase.auth.currentUser.uid : 'anonymous'
        };
        await requestRef.set(payload, { merge: true });

        return new Promise((resolve, reject) => {
            const responseRef = db.collection('shipstationResponses').doc(requestId);
            let unsub = null;
            const timer = setTimeout(() => {
                if (unsub) unsub();
                reject(new Error('Request timed out'));
            }, timeoutMs);

            unsub = responseRef.onSnapshot((doc) => {
                if (doc && doc.exists) {
                    const data = doc.data();
                    clearTimeout(timer);
                    if (unsub) unsub();
                    if (data?.status === 'ok') {
                        resolve(data?.data);
                    } else {
                        reject(new Error(data?.error || 'Unknown error'));
                    }
                }
            }, (err) => {
                clearTimeout(timer);
                if (unsub) unsub();
                reject(err);
            });
        });
    }
    
    /**
     * Load ShipStation connection from server
     */
    async loadConnectionFromServer() {
        try {
            // First try to load from secure integration handler if available
            if (window.secureIntegrationHandler) {
                try {
                    const shipstationConfig = await window.secureIntegrationHandler.getIntegration('shipstation');
                    if (shipstationConfig) {
                        // Update configuration from secure storage
                        if (shipstationConfig.apiKey) this.apiKey = shipstationConfig.apiKey;
                        if (shipstationConfig.apiSecret) this.apiSecret = shipstationConfig.apiSecret;
                        if (shipstationConfig.environment) this.environment = shipstationConfig.environment;
                        if (shipstationConfig.connected) this.connected = shipstationConfig.connected;
                        if (shipstationConfig.lastUpdated) this.lastSync = new Date(shipstationConfig.lastUpdated);
                        
                        // Always use proxy base by default
                        this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
                        
                        console.log('✅ ShipStation connection loaded from secure storage');
                        return;
                    }
                } catch (secureError) {
                    console.warn('⚠️ Could not load ShipStation credentials from secure storage:', secureError);
                }
            }
            
            // Fallback to legacy method
            const response = await fetch('/api/connections');
            const result = await response.json();
            
            if (result.success && result.data && result.data.shipstation) {
                const shipstationConfig = result.data.shipstation;
                
                // Update configuration from server
                if (shipstationConfig.apiKey) this.apiKey = shipstationConfig.apiKey;
                if (shipstationConfig.apiSecret) this.apiSecret = shipstationConfig.apiSecret;
                if (shipstationConfig.environment) this.environment = shipstationConfig.environment;
                if (shipstationConfig.connected) this.connected = shipstationConfig.connected;
                if (shipstationConfig.lastUpdated) this.lastSync = new Date(shipstationConfig.lastUpdated);
                
                // Always use proxy base by default
                this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
                
                console.log('✅ ShipStation connection loaded from server');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load ShipStation connection from server:', error);
        }
    }
    
    /**
     * Save ShipStation connection to server
     */
    async saveConnectionToServer() {
        const shipstationConfig = {
            apiKey: this.apiKey,
            apiSecret: this.apiSecret,
            environment: this.environment,
            connected: this.connected,
            lastUpdated: new Date().toISOString()
        };
        
        // First try to save using secure integration handler if available
        if (window.secureIntegrationHandler) {
            try {
                await window.secureIntegrationHandler.updateIntegration('shipstation', shipstationConfig);
                console.log('✅ ShipStation connection saved to secure storage');
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('ShipStation API credentials updated successfully', 'success');
                }
                
                return true;
            } catch (secureError) {
                console.warn('⚠️ Could not save ShipStation credentials to secure storage:', secureError);
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('Failed to save ShipStation API credentials securely', 'warning');
                }
                
                // Fall through to legacy method
            }
        }
        
        // Fallback to legacy method
        try {
            const response = await fetch('/api/connections/shipstation', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(shipstationConfig)
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ ShipStation connection saved to server');
                return true;
            } else {
                console.warn('⚠️ Failed to save ShipStation connection to server:', result.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Error saving ShipStation connection to server:', error);
            return false;
        }
    }
    
    /**
     * Configure ShipStation connection settings
     * @param {Object} config - Configuration object
     * @param {string} config.apiKey - ShipStation API key
     * @param {string} config.apiSecret - ShipStation API secret
     * @param {string} config.environment - Environment (production or sandbox)
     * @returns {Promise<boolean>} - Success status
     */
    async configure(config = {}) {
        let updated = false;
        
        if (config.apiKey) {
            this.apiKey = config.apiKey;
            updated = true;
        }
        
        if (config.apiSecret) {
            this.apiSecret = config.apiSecret;
            updated = true;
        }
        
        if (config.environment) {
            this.environment = config.environment;
            // Always use single endpoint; prefer proxy when enabled
            this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
            
            updated = true;
        }
        
        if (config.allowOrderCreation !== undefined) {
            this.allowOrderCreation = config.allowOrderCreation;
            updated = true;
        }
        
        if (updated) {
            console.log('✅ ShipStationIntegration configuration updated');
            
            // Save to server
            return await this.saveConnectionToServer();
        }
        
        return updated;
    }
    
    /**
     * Test ShipStation connection
     * @returns {Promise<Object>} - Test result with status and message
     */
    async testConnection() {
        if (!this.apiKey || !this.apiSecret) {
            return {
                success: false,
                message: 'ShipStation credentials not configured. Please enter valid API key and secret.',
                details: null
            };
        }
        
        try {
            console.log('🔍 Testing ShipStation connection...');
            let stores;
            if (this.useQueue) {
                stores = await this._enqueue('testConnection', {});
            } else {
                const response = await fetch(this._endpoint('/stores'), {
                    method: 'GET',
                    headers: this._headers()
                });
                if (!response.ok) throw new Error(response.statusText);
                stores = await response.json();
            }
                
                // Connection successful, save to server
                this.connected = true;
                await this.saveConnectionToServer();
                
                return {
                    success: true,
                    message: `Successfully connected to ShipStation API (${this.environment})`,
                    details: {
                        environment: this.environment,
                        storesCount: Array.isArray(stores) ? stores.length : (stores?.length || 0)
                    }
                };
            
        } catch (error) {
            console.error('❌ ShipStation connection test failed:', error);
            
            this.connected = false;
            await this.saveConnectionToServer();
            
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                details: error
            };
        }
    }
    
    /**
     * Get configuration information
     * @returns {Object} - Configuration object
     */
    getConfig() {
        return {
            apiKey: this.apiKey ? '••••••••' + this.apiKey.substring(this.apiKey.length - 4) : '',
            apiSecret: this.apiSecret ? '••••••••' + this.apiSecret.substring(this.apiSecret.length - 4) : '',
            environment: this.environment,
            connected: this.connected,
            lastSync: this.lastSync,
            allowOrderCreation: this.allowOrderCreation
        };
    }

    /**
     * Get a single order by ShipStation orderId
     * @param {number|string} orderId
     * @returns {Promise<Object>}
     */
    async getOrder(orderId) {
        if (!this.apiKey || !this.apiSecret) throw new Error('ShipStation not configured');
        if (this.useQueue) {
            return await this._enqueue('getOrder', { orderId });
        }
        const resp = await fetch(this._endpoint(`/orders/${orderId}`), { method: 'GET', headers: this._headers() });
        if (!resp.ok) { const txt = await resp.text().catch(() => ''); throw new Error(`Failed to get order ${orderId}: ${resp.status} ${txt}`); }
        return await resp.json();
    }

    /**
     * Get a single order by orderNumber (first match)
     * @param {string} orderNumber
     * @returns {Promise<Object|null>}
     */
    async getOrderByOrderNumber(orderNumber) {
        // Skip credential check when using proxy (server has credentials)
        if (!this.useProxy && (!this.apiKey || !this.apiSecret)) throw new Error('ShipStation not configured');
        let data;
        if (this.useQueue) {
            // ShipStation API doesn't have direct orderNumber lookup except via /orders
            data = await this._enqueue('listOrders', { orderNumber });
        } else {
            const params = new URLSearchParams({ orderNumber });
            const resp = await fetch(this._endpoint(`/orders?${params.toString()}`), { method: 'GET', headers: this._headers() });
            if (!resp.ok) { const txt = await resp.text().catch(() => ''); throw new Error(`Failed to find order ${orderNumber}: ${resp.status} ${txt}`); }
            data = await resp.json();
        }
        if (Array.isArray(data?.orders) && data.orders.length) return data.orders[0];
        if (Array.isArray(data) && data.length) return data[0];
        return null;
    }

    /**
     * Fetch ShipStation orders for a date range (created date)
     * @param {Object} opts
     * @param {string|Date} opts.start - inclusive start (Date or ISO string)
     * @param {string|Date} opts.end - inclusive end (Date or ISO string)
     * @param {number} [opts.pageSize=50] - page size (max 500 per API docs)
     * @param {number} [opts.page=1] - page number
     * @returns {Promise<{orders: Array, total: number, page: number, pages: number}>}
     */
    async listOrders({ start, end, page = 1, pageSize = 50 } = {}) {
        // Skip credential check when using proxy (server has credentials)
        if (!this.useProxy && (!this.apiKey || !this.apiSecret)) throw new Error('ShipStation not configured');
        const startIso = (start instanceof Date) ? start.toISOString() : (start || new Date(Date.now() - 24*3600*1000).toISOString());
        const endIso = (end instanceof Date) ? end.toISOString() : (end || new Date().toISOString());
        // Coerce pagination to numbers to prevent passing events/objects into Firestore
        const safePage = Math.max(1, Number(page) || 1);
        const safePageSize = Math.min(500, Math.max(1, Number(pageSize) || 50));
        let data;
        if (this.useQueue) {
            data = await this._enqueue('listOrders', { start: startIso, end: endIso, page: safePage, pageSize: safePageSize });
        } else {
            const params = new URLSearchParams({ 'createDateStart': startIso, 'createDateEnd': endIso, pageSize: String(safePageSize), page: String(safePage) });
            const url = this._endpoint(`/orders?${params.toString()}`);
            const resp = await fetch(url, { method: 'GET', headers: this._headers() });
            if (!resp.ok) { const txt = await resp.text().catch(() => ''); throw new Error(`ShipStation orders failed: ${resp.status} ${txt}`); }
            data = await resp.json();
        }
        // Normalize response
        return {
            orders: data.orders || data || [],
            total: data.total,
            page: data.page || safePage,
            pages: data.pages || (data.total && safePageSize ? Math.ceil(data.total / safePageSize) : undefined)
        };
    }

    /**
     * List shipments using v1 API (includes orderId, orderNumber, and trackingNumber)
     * @param {Object} options - Query options
     * @param {Date|string} options.start - Start date
     * @param {Date|string} options.end - End date
     * @param {number} options.page - Page number
     * @param {number} options.pageSize - Page size
     * @returns {Promise<Object>} - Shipments response
     */
    async listShipments({ start, end, page = 1, pageSize = 500 } = {}) {
        const startIso = (start instanceof Date) ? start.toISOString() : start;
        const endIso = (end instanceof Date) ? end.toISOString() : end;
        const params = new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
            sortBy: 'ShipDate',
            sortDir: 'DESC'
        });
        if (startIso) params.set('shipDateStart', startIso);
        if (endIso) params.set('shipDateEnd', endIso);
        
        const url = this._endpoint(`/shipments?${params.toString()}`);
        const resp = await fetch(url, { method: 'GET', headers: this._headers() });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`ShipStation shipments failed: ${resp.status} ${txt}`);
        }
        const data = await resp.json();
        return {
            shipments: data.shipments || [],
            total: data.total,
            page: data.page || page,
            pages: data.pages
        };
    }

    /**
     * List shipments using v2 API (includes tracking numbers)
     * @param {Object} options - Query options
     * @param {Date|string} options.start - Start date
     * @param {Date|string} options.end - End date
     * @param {number} options.page - Page number
     * @param {number} options.pageSize - Page size
     * @returns {Promise<Object>} - Shipments response
     */
    async listShipmentsV2({ start, end, page = 1, pageSize = 100 } = {}) {
        const startIso = (start instanceof Date) ? start.toISOString() : start;
        const endIso = (end instanceof Date) ? end.toISOString() : end;
        const params = new URLSearchParams({
            page: String(page),
            page_size: String(pageSize),
            sort_by: 'created_at',
            sort_dir: 'desc'
        });
        if (startIso) params.set('created_at_start', startIso);
        if (endIso) params.set('created_at_end', endIso);
        // Filter for label_purchased shipments to get tracking numbers
        params.set('shipment_status', 'label_purchased');
        
        const url = `/api/shipstation-v2/v2/shipments?${params.toString()}`;
        const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`ShipStation v2 shipments failed: ${resp.status} ${txt}`);
        }
        const data = await resp.json();
        return {
            shipments: data.shipments || [],
            total: data.total,
            page: data.page || page,
            pages: data.pages
        };
    }

    /**
     * List labels using v2 API to get label IDs for tracking
     * @param {Object} options - Query options
     * @param {Date|string} options.start - Start date
     * @param {Date|string} options.end - End date
     * @param {number} options.pageSize - Page size
     * @returns {Promise<Object>} - Labels response
     */
    async listLabelsV2({ start, end, pageSize = 100 } = {}) {
        const startIso = (start instanceof Date) ? start.toISOString() : start;
        const endIso = (end instanceof Date) ? end.toISOString() : end;
        const params = new URLSearchParams({
            page_size: String(pageSize),
            sort_by: 'created_at',
            sort_dir: 'desc'
        });
        if (startIso) params.set('created_at_start', startIso);
        if (endIso) params.set('created_at_end', endIso);
        
        const url = `/api/shipstation-v2/v2/labels?${params.toString()}`;
        const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`ShipStation v2 labels failed: ${resp.status} ${txt}`);
        }
        const data = await resp.json();
        return {
            labels: data.labels || [],
            total: data.total,
            page: data.page,
            pages: data.pages
        };
    }

    /**
     * Get tracking info for a label using v2 API
     * @param {string} labelId - Label ID (e.g., 'se-324658')
     * @returns {Promise<Object>} - Tracking response
     */
    async getTrackingV2(labelId) {
        if (!labelId) throw new Error('Label ID required');
        const url = `/api/shipstation-v2/v2/labels/${encodeURIComponent(labelId)}/track`;
        const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`ShipStation v2 tracking failed: ${resp.status} ${txt}`);
        }
        return await resp.json();
    }

    /**
     * Get shipping rates for a package
     * @param {Object} shipment - Shipment details
     * @returns {Promise<Array>} - Array of rate options
     */
    async getRates(shipment) {
        if (!this.apiKey || !this.apiSecret || !this.connected) {
            throw new Error('ShipStation not configured or connected');
        }
        
        try {
            if (this.useQueue) {
                const rates = await this._enqueue('getRates', { shipment });
                return rates;
            } else {
                // Prefer ShipStation API v2 quick estimate
                // Try '/v2/rates/estimate', fall back to '/v2/rates', then legacy '/shipments/getrates'
                const tryEndpoints = ['/v2/rates/estimate', '/v2/rates', '/shipments/getrates'];
                let lastErr;
                for (const ep of tryEndpoints) {
                    try {
                        const resp = await fetch(this._endpoint(ep), {
                            method: 'POST',
                            headers: this._headers(),
                            body: JSON.stringify(shipment)
                        });
                        if (!resp.ok) {
                            // If 404/405 on v2 path, try next; otherwise capture and break
                            if (resp.status === 404 || resp.status === 405) {
                                lastErr = new Error(`Endpoint ${ep} unavailable (${resp.status})`);
                                continue;
                            }
                            const txt = await resp.text().catch(() => '');
                            throw new Error(`Failed to get rates via ${ep}: ${resp.status} ${resp.statusText} ${txt}`);
                        }
                        const data = await resp.json();
                        return data;
                    } catch (e) {
                        lastErr = e;
                        // Try next endpoint
                    }
                }
                // If all attempts failed
                throw lastErr || new Error('Failed to get rates: unknown error');
            }
        } catch (error) {
            console.error('❌ Error getting shipping rates:', error);
            throw error;
        }
    }
    
    /**
     * Lightweight configuration check
     */
    get isConfigured() {
        return Boolean(this.apiKey && this.apiSecret);
    }

    /**
     * Create a ShipStation order from calculator quote data
     * @param {Object} quoteData - calculator quote object (products/items, totals, etc.)
     * @param {Object} customerData - {companyName, email, phone, state, name, address fields}
     * @returns {Promise<Object>} ShipStation API response
     */
    async createOrderFromQuote(quoteData, customerData = {}) {
        if (!this.allowOrderCreation) {
            console.warn('ShipStation order creation is disabled by configuration. Skipping.');
            return { skipped: true, reason: 'disabled' };
        }
        if (!this.isConfigured) {
            throw new Error('ShipStation not configured');
        }
        if (!this.connected) {
            // Optionally attempt a connection test before creating an order
            try {
                await this.testConnection();
            } catch (e) {
                console.warn('ShipStation connection test failed before order creation:', e);
            }
            if (!this.connected) throw new Error('ShipStation not connected');
        }

        const nowIso = new Date().toISOString();
        const orderNumber = quoteData?.quoteNumber || `KANVA-${nowIso.replace(/[-:TZ.]/g, '').slice(0,14)}`;

        const company = customerData.companyName || customerData.company || '';
        const contactName = customerData.name || customerData.contactName || company || 'Customer';
        const email = customerData.email || '';
        const phone = customerData.phone || '';

        const shipTo = {
            name: contactName,
            company,
            street1: customerData.address1 || customerData.street1 || customerData.address || 'TBD',
            street2: customerData.address2 || customerData.street2 || '',
            city: customerData.city || 'TBD',
            state: customerData.state || customerData.region || 'NA',
            postalCode: customerData.postalCode || customerData.zip || '00000',
            country: customerData.country || 'US',
            phone,
            residential: false
        };

        const itemsSource = quoteData?.items || quoteData?.products || [];
        const itemsArray = Array.isArray(itemsSource) ? itemsSource : Object.values(itemsSource || {});
        const items = itemsArray.map((p, idx) => ({
            lineItemKey: p.sku || p.key || String(idx + 1),
            sku: p.sku || p.key || `SKU-${idx + 1}`,
            name: p.name || p.productName || `Item ${idx + 1}`,
            quantity: Number(p.quantity ?? ((p.displayBoxes || p.cases || 1) * (p.unitsPerCase || 1))) || 1,
            unitPrice: Number(p.unitPrice ?? p.price ?? 0),
        }));

        const orderPayload = {
            orderNumber,
            orderDate: nowIso,
            orderStatus: 'awaiting_shipment',
            customerEmail: email,
            billTo: { name: contactName, company, phone },
            shipTo,
            items,
            amountPaid: 0,
            taxAmount: Number(quoteData?.tax || 0),
            shippingAmount: Number(quoteData?.shipping || 0),
            customerNotes: quoteData?.notes || '',
            internalNotes: `Created from Kanva quote ${orderNumber}`,
            advancedOptions: { source: 'Kanva Quotes' }
        };

        const resp = await fetch(this._endpoint('/orders/createorder'), {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(orderPayload)
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`ShipStation create order failed: ${resp.status} ${resp.statusText} ${text}`);
        }
        return await resp.json();
    }
}

/**
 * Standalone ShipStation Orders Viewer
 * Can be used independently of AdminDashboard
 */
class ShipStationOrdersViewer {
    constructor() {
        this.currentOrders = [];
        this.currentPage = 1;
        this.totalPages = 1;
    }

    /**
     * Get tracking URL for a carrier
     */
    getTrackingUrl(carrier, trackingNumber) {
        if (!carrier || !trackingNumber) return '';
        const c = carrier.toLowerCase();
        if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
        if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
        if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
        if (c.includes('dhl')) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`;
        if (c.includes('ontrac')) return `https://www.ontrac.com/tracking/?number=${encodeURIComponent(trackingNumber)}`;
        if (c.includes('lasership') || c.includes('laser')) return `https://www.lasership.com/track/${encodeURIComponent(trackingNumber)}`;
        return '';
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Open the orders viewer modal
     */
    open() {
        let modal = document.getElementById('shipstation-orders-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'shipstation-orders-modal';
            modal.className = 'modal';
            modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; overflow:auto;';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1400px; margin: 2% auto; max-height: 90vh; overflow: hidden; background:#fff; border-radius:8px; padding:20px; position:relative; display:flex; flex-direction:column;">
                    <button class="close-btn" style="position:absolute; top:10px; right:15px; font-size:24px; border:none; background:none; cursor:pointer;" onclick="document.getElementById('shipstation-orders-modal').style.display='none'">&times;</button>
                    <h2 style="margin:0 0 10px 0;">🚢 ShipStation Orders</h2>
                    <div style="display:flex; gap:12px; align-items:center; margin: 8px 0; flex-wrap: wrap;">
                        <label>Start: <input type="date" id="ss-orders-start"></label>
                        <label>End: <input type="date" id="ss-orders-end"></label>
                        <button id="ss-orders-fetch" class="btn btn-primary" style="padding:8px 16px; background:#4CAF50; color:#fff; border:none; border-radius:4px; cursor:pointer;">Fetch</button>
                        <input type="text" id="ss-orders-search" placeholder="Search orders..." style="flex:1; min-width: 180px; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        <span id="ss-orders-status" style="margin-left:auto; font-size: 12px; opacity: .8;"></span>
                    </div>
                    <div style="display:flex; gap:8px; margin: 8px 0; flex-wrap: wrap;">
                        <span style="font-size:12px; font-weight:600; color:#666; align-self:center;">Source:</span>
                        <button class="ss-source-btn" data-source="all" style="padding:6px 12px; border:2px solid #4CAF50; background:#4CAF50; color:#fff; border-radius:4px; cursor:pointer; font-size:12px;">All</button>
                        <button class="ss-source-btn" data-source="shopify" style="padding:6px 12px; border:2px solid #ddd; background:#fff; color:#333; border-radius:4px; cursor:pointer; font-size:12px;">🛒 Shopify</button>
                        <button class="ss-source-btn" data-source="reprally" style="padding:6px 12px; border:2px solid #ddd; background:#fff; color:#333; border-radius:4px; cursor:pointer; font-size:12px;">🤝 RepRally</button>
                        <button class="ss-source-btn" data-source="fishbowl" style="padding:6px 12px; border:2px solid #ddd; background:#fff; color:#333; border-radius:4px; cursor:pointer; font-size:12px;">🐟 Fishbowl</button>
                        <span style="margin-left:16px; font-size:12px; font-weight:600; color:#666; align-self:center;">Status:</span>
                        <button class="ss-status-btn" data-status="all" style="padding:6px 12px; border:2px solid #4CAF50; background:#4CAF50; color:#fff; border-radius:4px; cursor:pointer; font-size:12px;">All</button>
                        <button class="ss-status-btn" data-status="delivered" style="padding:6px 12px; border:2px solid #ddd; background:#fff; color:#333; border-radius:4px; cursor:pointer; font-size:12px;">✅ Delivered</button>
                        <button class="ss-status-btn" data-status="in_transit" style="padding:6px 12px; border:2px solid #ddd; background:#fff; color:#333; border-radius:4px; cursor:pointer; font-size:12px;">🚚 In Transit</button>
                        <button class="ss-status-btn" data-status="label_purchased" style="padding:6px 12px; border:2px solid #ddd; background:#fff; color:#333; border-radius:4px; cursor:pointer; font-size:12px;">🏷️ Label</button>
                        <button class="ss-status-btn" data-status="awaiting" style="padding:6px 12px; border:2px solid #ddd; background:#fff; color:#333; border-radius:4px; cursor:pointer; font-size:12px;">⏳ Awaiting</button>
                    </div>
                    <div id="ss-orders-results" style="border:1px solid #ddd; border-radius:6px; overflow-y:auto; flex:1; max-height:calc(90vh - 180px);">
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
                        <div id="ss-orders-loader" style="display:none; text-align:center; padding:16px; color:#666;">Loading more orders...</div>
                    </div>
                    <div id="ss-orders-count" style="font-size:12px; opacity:.8; margin-top:8px;"></div>
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
        const resultsContainer = modal.querySelector('#ss-orders-results');
        const loader = modal.querySelector('#ss-orders-loader');
        const countEl = modal.querySelector('#ss-orders-count');
        const sourceBtns = modal.querySelectorAll('.ss-source-btn');
        const statusBtns = modal.querySelectorAll('.ss-status-btn');
        
        // Filter state
        let activeSourceFilter = 'all';
        let activeStatusFilter = 'all';
        let isLoadingMore = false;
        let hasMorePages = true;
        let currentPage = 1;
        let totalPages = 1;

        const renderRows = (orders) => {
            if (!orders || orders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="padding:12px;">No orders found for selected date(s).</td></tr>`;
                return;
            }
            tbody.innerHTML = orders.map((o, idx) => {
                const orderDate = o.orderDate || o.createDate || '';
                const formattedDate = orderDate ? new Date(orderDate).toLocaleDateString() : '';
                const cust = (o.billTo?.name || o.shipTo?.name || '').toString();
                const email = o.customerEmail || '';
                const shipToCity = o.shipTo ? `${o.shipTo.city || ''}${o.shipTo.state ? ', ' + o.shipTo.state : ''}` : '';
                const itemsCount = Array.isArray(o.items) ? o.items.reduce((a, it) => a + (Number(it.quantity)||0), 0) : (o.itemCount || 0);
                const status = o.orderStatus || '';
                const total = o.orderTotal ?? o.amountPaid ?? '';
                const shipment = Array.isArray(o.shipments) && o.shipments.length > 0 ? o.shipments[0] : null;
                const carrier = shipment?.carrierCode || o.carrierCode || o.requestedShippingService || '';
                const tracking = shipment?.trackingNumber || '';
                const trackingLink = tracking && carrier ? this.getTrackingUrl(carrier, tracking) : '';
                const trackingDisplay = tracking ? (trackingLink ? `<a href="${trackingLink}" target="_blank" title="Track package" onclick="event.stopPropagation();">${tracking}</a>` : tracking) : '<span style="color:#999;">—</span>';
                
                // Determine actual shipment status with timestamp
                let displayStatus = status;
                let shipTimestamp = '';
                
                if (shipment) {
                    // Priority 1: Use real carrier tracking status from labels API (delivered, in_transit, etc.)
                    if (shipment.carrierStatus) {
                        displayStatus = shipment.carrierStatus; // Already in friendly format
                        if (shipment.shipDate) {
                            shipTimestamp = new Date(shipment.shipDate).toLocaleDateString();
                        }
                    }
                    // Priority 2: Use v2 shipment_status (label_purchased, pending, etc.)
                    else if (shipment.shipmentStatus) {
                        displayStatus = shipment.shipmentStatus;
                        if (shipment.modifiedAt) {
                            shipTimestamp = new Date(shipment.modifiedAt).toLocaleString();
                        }
                    }
                    // Priority 3: Infer from ship date
                    else if (shipment.shipDate) {
                        const shipDate = new Date(shipment.shipDate);
                        shipTimestamp = shipDate.toLocaleDateString();
                        const daysSinceShip = (Date.now() - shipDate.getTime()) / (1000 * 60 * 60 * 24);
                        
                        if (status === 'shipped' || tracking) {
                            if (daysSinceShip < 1) {
                                displayStatus = 'label_purchased';
                            } else if (daysSinceShip < 7) {
                                displayStatus = 'in_transit';
                            } else {
                                displayStatus = 'delivered';
                            }
                        }
                    }
                } else if (o._v2Status) {
                    displayStatus = o._v2Status.status;
                    if (o._v2Status.modifiedAt) {
                        shipTimestamp = new Date(o._v2Status.modifiedAt).toLocaleString();
                    }
                }
                
                // Status colors with more granular states
                const statusColors = {
                    'delivered': '#155724',
                    'out_for_delivery': '#20c997',
                    'in_transit': '#28a745',
                    'label_purchased': '#17a2b8',
                    'label_created': '#17a2b8',
                    'pending': '#6c757d',
                    'awaiting_shipment': '#ffc107',
                    'cancelled': '#dc3545',
                    'shipped': '#28a745'
                };
                
                // Store displayStatus on order for filtering
                o._displayStatus = displayStatus;
                const statusColor = statusColors[displayStatus] || '#6c757d';
                const statusLabel = displayStatus.replace(/_/g, ' ');
                
                // Build detail row content
                const shipTo = o.shipTo || {};
                const shipAddr = [shipTo.street1, shipTo.street2, `${shipTo.city || ''}, ${shipTo.state || ''} ${shipTo.postalCode || ''}`, shipTo.country].filter(Boolean).join('<br>');
                const billTo = o.billTo || {};
                const billAddr = [billTo.street1, billTo.street2, `${billTo.city || ''}, ${billTo.state || ''} ${billTo.postalCode || ''}`, billTo.country].filter(Boolean).join('<br>');
                
                const shipments = o.shipments || [];
                const shipmentsHtml = shipments.length > 0 ? shipments.map((s, i) => {
                    const trackUrl = this.getTrackingUrl(s.carrierCode, s.trackingNumber);
                    const tLink = s.trackingNumber ? (trackUrl ? `<a href="${trackUrl}" target="_blank">${s.trackingNumber}</a>` : s.trackingNumber) : '—';
                    return `<div style="background:#fff; padding:6px; border-radius:4px; margin-bottom:4px; border:1px solid #e0e0e0;">
                        <strong>${s.carrierCode || ''}</strong> ${s.serviceCode || ''} | Tracking: ${tLink} | Ship Date: ${s.shipDate || '—'}
                    </div>`;
                }).join('') : '<span style="color:#999;">No shipments yet</span>';
                
                const itemsHtml = (o.items || []).map((it, i) => `
                    <tr>
                        <td style="padding:4px 6px; border-bottom:1px solid #eee;">${it.sku || ''}</td>
                        <td style="padding:4px 6px; border-bottom:1px solid #eee;">${it.name || ''}</td>
                        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">${it.quantity || 0}</td>
                        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:right;">$${Number(it.unitPrice ?? 0).toFixed(2)}</td>
                    </tr>`).join('') || '<tr><td colspan="4" style="padding:6px; color:#999;">No items</td></tr>';

                return `
                    <tr class="ss-order-row" data-order-idx="${idx}" style="cursor:pointer; transition: background 0.15s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;"><span style="font-weight:500; color:#007bff;">▶ ${o.orderNumber || o.orderId || ''}</span></td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; white-space:nowrap;">${formattedDate}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${cust}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:12px;">${email}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:12px;">${shipToCity}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:12px;">${carrier}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:11px;">${trackingDisplay}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;"><span style="background:${statusColor}; color:#fff; padding:2px 6px; border-radius:3px; font-size:11px;">${statusLabel}</span>${shipTimestamp ? `<div style="font-size:10px; color:#666; margin-top:2px;">${shipTimestamp}</div>` : ''}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">$${Number(total).toFixed(2)}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${itemsCount}</td>
                    </tr>
                    <tr class="ss-order-detail" data-order-idx="${idx}" style="display:none;">
                        <td colspan="10" style="padding:0; background:#f8f9fa; border-bottom:2px solid #ddd;">
                            <div style="padding:12px 16px; animation: slideDown 0.2s ease-out;">
                                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
                                    <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e0e0e0;">
                                        <div style="font-weight:600; color:#666; margin-bottom:6px; font-size:12px;">📦 SHIP TO</div>
                                        <div style="font-weight:500;">${shipTo.name || ''}</div>
                                        <div style="font-size:12px; line-height:1.4;">${shipAddr}</div>
                                        <div style="font-size:12px; margin-top:4px;">📞 ${shipTo.phone || '—'}</div>
                                    </div>
                                    <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e0e0e0;">
                                        <div style="font-weight:600; color:#666; margin-bottom:6px; font-size:12px;">💳 BILL TO</div>
                                        <div style="font-weight:500;">${billTo.name || ''}</div>
                                        <div style="font-size:12px; line-height:1.4;">${billAddr}</div>
                                        <div style="font-size:12px; margin-top:4px;">✉️ ${o.customerEmail || '—'}</div>
                                    </div>
                                    <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e0e0e0;">
                                        <div style="font-weight:600; color:#666; margin-bottom:6px; font-size:12px;">💰 ORDER TOTALS</div>
                                        <div style="font-size:13px;">Subtotal: <strong>$${Number(o.orderTotal ?? 0).toFixed(2)}</strong></div>
                                        <div style="font-size:13px;">Shipping: $${Number(o.shippingAmount ?? 0).toFixed(2)}</div>
                                        <div style="font-size:13px;">Tax: $${Number(o.taxAmount ?? 0).toFixed(2)}</div>
                                        <div style="font-size:13px; margin-top:4px;">Paid: <strong>$${Number(o.amountPaid ?? 0).toFixed(2)}</strong></div>
                                    </div>
                                </div>
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                                    <div>
                                        <div style="font-weight:600; color:#666; margin-bottom:6px; font-size:12px;">🚚 SHIPMENTS & TRACKING</div>
                                        ${shipmentsHtml}
                                    </div>
                                    <div>
                                        <div style="font-weight:600; color:#666; margin-bottom:6px; font-size:12px;">📋 ITEMS (${o.items?.length || 0})</div>
                                        <table style="width:100%; border-collapse:collapse; font-size:12px; background:#fff; border:1px solid #e0e0e0; border-radius:4px;">
                                            <thead><tr style="background:#f0f0f0;">
                                                <th style="text-align:left; padding:4px 6px;">SKU</th>
                                                <th style="text-align:left; padding:4px 6px;">Name</th>
                                                <th style="text-align:center; padding:4px 6px;">Qty</th>
                                                <th style="text-align:right; padding:4px 6px;">Price</th>
                                            </tr></thead>
                                            <tbody>${itemsHtml}</tbody>
                                        </table>
                                    </div>
                                </div>
                                ${o.customerNotes || o.internalNotes ? `
                                <div style="margin-top:10px;">
                                    ${o.customerNotes ? `<div style="background:#fff3cd; padding:6px 10px; border-radius:4px; margin-bottom:4px; font-size:12px;"><strong>Customer Notes:</strong> ${o.customerNotes}</div>` : ''}
                                    ${o.internalNotes ? `<div style="background:#d1ecf1; padding:6px 10px; border-radius:4px; font-size:12px;"><strong>Internal Notes:</strong> ${o.internalNotes}</div>` : ''}
                                </div>` : ''}
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        };

        const fetchOrders = async (page = 1, append = false) => {
            if (!window.shipStation) {
                this.showNotification('ShipStation not initialized', 'error');
                return;
            }
            if (isLoadingMore && append) return;
            
            try {
                if (append) {
                    isLoadingMore = true;
                    loader.style.display = 'block';
                    statusEl.textContent = 'Loading more orders...';
                } else {
                    statusEl.textContent = 'Loading orders...';
                    this.allOrders = [];
                    hasMorePages = true;
                }
                
                const startDate = new Date(`${startInput.value}T00:00:00`);
                const endDate = new Date(`${endInput.value}T23:59:59`);
                const { orders, total, page: pg, pages } = await window.shipStation.listOrders({ start: startDate, end: endDate, page: page, pageSize: 100 });
                
                currentPage = pg || page;
                totalPages = pages || 1;
                hasMorePages = currentPage < totalPages;
                
                // Fetch shipments via v1 API for tracking numbers (has orderId/orderNumber)
                let shipmentsMap = {};
                try {
                    statusEl.textContent = 'Loading tracking info...';
                    const { shipments } = await window.shipStation.listShipments({ start: startDate, end: endDate, pageSize: 500 });
                    // Build a map of orderId -> shipments array
                    for (const s of shipments) {
                        // v1 shipments have orderId, orderNumber, trackingNumber
                        const key = s.orderId || s.orderNumber;
                        if (key) {
                            if (!shipmentsMap[key]) shipmentsMap[key] = [];
                            shipmentsMap[key].push(s);
                        }
                        // Also map by orderNumber string
                        if (s.orderNumber && s.orderNumber !== key) {
                            if (!shipmentsMap[s.orderNumber]) shipmentsMap[s.orderNumber] = [];
                            shipmentsMap[s.orderNumber].push(s);
                        }
                    }
                    console.log(`🚢 Loaded ${shipments.length} shipments with tracking`);
                    // Log first shipment to see available fields for debugging
                    if (shipments.length > 0) console.log('📦 Sample shipment data:', JSON.stringify(shipments[0], null, 2));
                } catch (shipErr) {
                    console.warn('Could not fetch shipments (tracking may be limited):', shipErr.message);
                }
                
                // Try to get v2 shipments for shipment_status (label_purchased, pending, etc.)
                let v2StatusMap = {};
                try {
                    statusEl.textContent = 'Loading carrier status...';
                    const v2Data = await window.shipStation.listShipmentsV2({ start: startDate, end: endDate, pageSize: 200 });
                    console.log(`🚢 Loaded ${v2Data.shipments?.length || 0} v2 shipments`);
                    if (v2Data.shipments?.length > 0) {
                        console.log('📦 Sample v2 shipment:', JSON.stringify(v2Data.shipments[0], null, 2));
                        // Map by shipment_number and external_shipment_id to match with orders
                        for (const s of v2Data.shipments) {
                            const statusInfo = {
                                status: s.shipment_status || 'unknown',
                                shipmentId: s.shipment_id,
                                modifiedAt: s.modified_at
                            };
                            // Map by multiple keys for matching
                            if (s.shipment_number) v2StatusMap[s.shipment_number] = statusInfo;
                            if (s.external_shipment_id) v2StatusMap[s.external_shipment_id] = statusInfo;
                            // Also try without 'S' prefix (SSh117333 -> Sh117333)
                            if (s.external_shipment_id?.startsWith('S')) {
                                v2StatusMap[s.external_shipment_id.substring(1)] = statusInfo;
                            }
                        }
                    }
                } catch (v2Err) {
                    console.warn('Could not fetch v2 shipments:', v2Err.message);
                }
                
                // Fetch labels which have tracking_status directly (delivered, in_transit, etc.)
                let trackingStatusMap = {};
                try {
                    statusEl.textContent = 'Loading delivery status...';
                    const labelsData = await window.shipStation.listLabelsV2({ start: startDate, end: endDate, pageSize: 100 });
                    console.log(`🏷️ Loaded ${labelsData.labels?.length || 0} labels`);
                    if (labelsData.labels?.length > 0) {
                        console.log('🏷️ Sample label:', JSON.stringify(labelsData.labels[0], null, 2));
                        // Labels already have tracking_status directly on them!
                        for (const label of labelsData.labels) {
                            if (label.tracking_number && label.tracking_status) {
                                trackingStatusMap[label.tracking_number] = {
                                    status: label.tracking_status, // "delivered", "in_transit", etc.
                                    shipDate: label.ship_date,
                                    labelId: label.label_id
                                };
                            }
                        }
                        console.log(`📍 Got tracking status for ${Object.keys(trackingStatusMap).length} packages`);
                        // Log status breakdown
                        const statusCounts = {};
                        Object.values(trackingStatusMap).forEach(t => {
                            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
                        });
                        console.log('� Status breakdown:', statusCounts);
                    }
                } catch (labelsErr) {
                    console.warn('Could not fetch labels for tracking:', labelsErr.message);
                }
                
                // Merge tracking data into orders
                const enrichedOrders = (orders || []).map(o => {
                    // Look for matching shipments by orderId or orderNumber
                    const matchedShipments = shipmentsMap[o.orderId] || shipmentsMap[o.orderNumber] || [];
                    
                    // Get v2 status by order number
                    const v2Status = v2StatusMap[o.orderNumber] || v2StatusMap[`S${o.orderNumber}`] || null;
                    
                    if (matchedShipments.length > 0) {
                        // Add shipments array with tracking data
                        o.shipments = matchedShipments.map(s => {
                            // Check for real tracking status from labels API
                            const labelTracking = trackingStatusMap[s.trackingNumber];
                            // Use v2 status matched by order number
                            return {
                                shipmentId: s.shipmentId,
                                carrierCode: s.carrierCode || '',
                                trackingNumber: s.trackingNumber || '',
                                shipDate: labelTracking?.shipDate || s.shipDate,
                                serviceCode: s.serviceCode || '',
                                voided: s.voided,
                                shipmentCost: s.shipmentCost,
                                // Add v2 shipment status if available
                                shipmentStatus: v2Status?.status || null,
                                modifiedAt: v2Status?.modifiedAt || null,
                                // Add real carrier tracking status from labels API (delivered, in_transit, etc.)
                                carrierStatus: labelTracking?.status || null
                            };
                        });
                    } else if (v2Status) {
                        // Even if no v1 shipment, we have v2 status
                        o._v2Status = v2Status;
                    }
                    return o;
                });
                
                // Append or replace orders
                if (append) {
                    this.allOrders = [...(this.allOrders || []), ...enrichedOrders];
                } else {
                    this.allOrders = enrichedOrders;
                }
                this.currentOrders = this.allOrders;
                
                statusEl.textContent = `Loaded ${this.allOrders.length}${typeof total === 'number' ? ` of ${total}` : ''}`;
                loader.style.display = 'none';
                isLoadingMore = false;
                filterOrders();
            } catch (err) {
                console.error('Failed to fetch ShipStation orders:', err);
                statusEl.textContent = 'Error';
                loader.style.display = 'none';
                isLoadingMore = false;
                this.showNotification(`ShipStation orders error: ${err.message}`, 'error');
            }
        };

        const filterOrders = () => {
            const q = (searchInput.value || '').toLowerCase().trim();
            
            let filtered = this.allOrders || this.currentOrders || [];
            
            // Apply source filter
            if (activeSourceFilter !== 'all') {
                filtered = filtered.filter(o => {
                    const orderNum = (o.orderNumber || '').toString();
                    if (activeSourceFilter === 'shopify') {
                        return orderNum.toLowerCase().startsWith('sh');
                    } else if (activeSourceFilter === 'reprally') {
                        return orderNum.startsWith('#');
                    } else if (activeSourceFilter === 'fishbowl') {
                        return /^\d{4,5}$/.test(orderNum);
                    }
                    return true;
                });
            }
            
            // Apply status filter
            if (activeStatusFilter !== 'all') {
                filtered = filtered.filter(o => {
                    const status = o._displayStatus || o.orderStatus || '';
                    if (activeStatusFilter === 'delivered') {
                        return status === 'delivered';
                    } else if (activeStatusFilter === 'in_transit') {
                        return status === 'in_transit';
                    } else if (activeStatusFilter === 'label_purchased') {
                        return status === 'label_purchased' || status === 'label_created';
                    } else if (activeStatusFilter === 'awaiting') {
                        return status === 'awaiting_shipment' || status === 'pending' || !status;
                    }
                    return true;
                });
            }
            
            // Apply search filter
            if (q) {
                filtered = filtered.filter(o => {
                    try { return JSON.stringify(o).toLowerCase().includes(q); } catch { return false; }
                });
            }
            
            countEl.textContent = `Showing ${filtered.length} of ${(this.allOrders || []).length} orders`;
            renderRows(filtered);
        };

        // Toggle expandable row
        const toggleOrderDetail = (idx) => {
            const detailRow = tbody.querySelector(`.ss-order-detail[data-order-idx="${idx}"]`);
            const mainRow = tbody.querySelector(`.ss-order-row[data-order-idx="${idx}"]`);
            if (!detailRow || !mainRow) return;
            
            const isOpen = detailRow.style.display !== 'none';
            
            // Close all other open details
            tbody.querySelectorAll('.ss-order-detail').forEach(r => r.style.display = 'none');
            tbody.querySelectorAll('.ss-order-row').forEach(r => {
                const arrow = r.querySelector('td:first-child span');
                if (arrow) arrow.textContent = arrow.textContent.replace('▼', '▶');
                r.style.background = '';
            });
            
            // Toggle this one
            if (!isOpen) {
                detailRow.style.display = '';
                mainRow.style.background = '#e3f2fd';
                const arrow = mainRow.querySelector('td:first-child span');
                if (arrow) arrow.textContent = arrow.textContent.replace('▶', '▼');
            }
        };

        // Wire up controls
        fetchBtn.onclick = () => { fetchOrders(1); };
        searchInput.oninput = filterOrders;
        
        // Source filter buttons
        sourceBtns.forEach(btn => {
            btn.onclick = () => {
                activeSourceFilter = btn.dataset.source;
                // Update button styles
                sourceBtns.forEach(b => {
                    if (b.dataset.source === activeSourceFilter) {
                        b.style.background = '#4CAF50';
                        b.style.borderColor = '#4CAF50';
                        b.style.color = '#fff';
                    } else {
                        b.style.background = '#fff';
                        b.style.borderColor = '#ddd';
                        b.style.color = '#333';
                    }
                });
                filterOrders();
            };
        });
        
        // Status filter buttons
        statusBtns.forEach(btn => {
            btn.onclick = () => {
                activeStatusFilter = btn.dataset.status;
                // Update button styles
                statusBtns.forEach(b => {
                    if (b.dataset.status === activeStatusFilter) {
                        b.style.background = '#4CAF50';
                        b.style.borderColor = '#4CAF50';
                        b.style.color = '#fff';
                    } else {
                        b.style.background = '#fff';
                        b.style.borderColor = '#ddd';
                        b.style.color = '#333';
                    }
                });
                filterOrders();
            };
        });

        // Row click to expand/collapse
        tbody.onclick = (ev) => {
            // Don't toggle if clicking a link
            if (ev.target.closest('a')) return;
            
            const row = ev.target.closest('.ss-order-row');
            if (!row) return;
            
            const idx = row.getAttribute('data-order-idx');
            if (idx !== null) toggleOrderDetail(idx);
        };
        
        // Infinite scroll - load more when near bottom
        resultsContainer.onscroll = () => {
            if (isLoadingMore || !hasMorePages) return;
            
            const scrollTop = resultsContainer.scrollTop;
            const scrollHeight = resultsContainer.scrollHeight;
            const clientHeight = resultsContainer.clientHeight;
            
            // Load more when within 200px of bottom
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                fetchOrders(currentPage + 1, true);
            }
        };

        // Show modal and fetch
        modal.style.display = 'block';
        fetchOrders();
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ShipStationIntegration = ShipStationIntegration;
    window.ShipStationOrdersViewer = ShipStationOrdersViewer;
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚢 ShipStation integration ready');
        // Create singleton instances
        if (!window.shipStation) {
            window.shipStation = new ShipStationIntegration();
        }
        if (!window.shipStationViewer) {
            window.shipStationViewer = new ShipStationOrdersViewer();
        }
        
        // Wire up the main dashboard button if present
        const ordersBtn = document.getElementById('shipstationOrdersBtn');
        if (ordersBtn) {
            ordersBtn.onclick = () => window.shipStationViewer.open();
        }
    });
}

console.log('🚢 ShipStation integration module loaded successfully');
