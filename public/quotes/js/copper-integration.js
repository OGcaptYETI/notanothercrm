/**
 * KANVA BOTANICALS QUOTE CALCULATOR - ENHANCED COPPER CRM INTEGRATION
 * ==================================================================
 * 
 * Streamlined and optimized Copper CRM integration without removing functionality.
 * This version improves performance, reduces redundancy, and enhances maintainability.
 * 
 * Key Improvements:
 * - Consolidated initialization routines
 * - Removed redundant code and dormant functions
 * - Streamlined modal overlay handling
 * - Improved error handling and logging
 * - Better state management
 * - Enhanced performance
 */

// =============================================================================
// ENHANCED MODAL OVERLAY HANDLER
// =============================================================================

const ModalOverlayHandler = {
    // Private state to prevent duplicate operations
    _initialized: false,
    _context: null,
    
    /**
     * Check if running in modal mode
     */
    isModalMode: function() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('location') === 'modal';
    },
    
    /**
     * Extract context from Copper SDK or URL parameters
     */
    extractModalContext: function() {
        if (this._context) {
            return this._context; // Return cached context
        }
        
        console.log('🖥️ Modal mode detected - extracting context...');
        
        // First check URL parameters for passed data
        const urlParams = new URLSearchParams(window.location.search);
        const urlContext = this._extractUrlContext(urlParams);
        
        // If we have URL parameters, use them
        if (urlContext.entity_id || urlContext.entity_name) {
            this._context = this._createContextFromUrl(urlContext);
            this.populateFromModalContext(this._context);
            return this._context;
        }
        
        // Fallback: Try to get context from Copper SDK
        if (typeof window.Copper !== 'undefined') {
            this._fetchCopperContext();
        }
        
        return { isModal: true };
    },
    
    /**
     * Extract context from URL parameters
     */
    _extractUrlContext: function(urlParams) {
        return {
            entity_type: urlParams.get('entity_type'),
            entity_id: urlParams.get('entity_id'),
            entity_name: urlParams.get('entity_name'),
            entity_email: urlParams.get('entity_email'),
            entity_phone: urlParams.get('entity_phone'),
            entity_state: urlParams.get('entity_state')
        };
    },
    
    /**
     * Create context object from URL parameters
     */
    _createContextFromUrl: function(urlContext) {
        return {
            entityId: urlContext.entity_id,
            entityType: urlContext.entity_type,
            entityName: urlContext.entity_name,
            companyName: urlContext.entity_name,
            entityEmail: urlContext.entity_email,
            entityPhone: urlContext.entity_phone,
            entityState: urlContext.entity_state,
            isModal: true
        };
    },
    
    /**
     * Fetch context from Copper SDK
     */
    _fetchCopperContext: function() {
        try {
            const sdk = window.Copper.init();
            sdk.getContext()
                .then(({ type, context }) => {
                    if (context && context.entity) {
                        this._context = this._createContextFromSdk(context.entity, type);
                        this.populateFromModalContext(this._context);
                    }
                })
                .catch(error => {
                    console.warn('⚠️ Error getting context from SDK:', error);
                });
        } catch (error) {
            console.warn('⚠️ Error initializing SDK for context:', error);
        }
    },
    
    /**
     * Create context object from SDK data
     */
    _createContextFromSdk: function(entity, type) {
        return {
            entityId: entity.id,
            entityType: type,
            entityName: entity.name || entity.company_name,
            companyName: entity.name || entity.company_name,
            entityEmail: entity.email,
            entityPhone: entity.phone_number,
            entityState: entity.address?.state,
            entityAddress: entity.address,
            isModal: true
        };
    },
    
    /**
     * Auto-populate form from modal context
     */
    populateFromModalContext: function(context) {
        if (!context || !context.isModal) return;
        
        console.log('🔍 MODAL DEBUG: Auto-populating form from context:', JSON.stringify(context, null, 2));
        console.log('📋 MODAL DEBUG: Available form fields:', this._listAvailableFormFields());
        
        const fieldMappings = {
            companyName: ['companyName', 'company-name'],
            entityEmail: ['customerEmail', 'customer-email', 'contactEmail'],
            entityPhone: ['customerPhone', 'customer-phone', 'contactPhone'],
            entityState: ['customerState', 'customer-state', 'state']
        };
        
        console.log('🗺️ MODAL DEBUG: Field mappings:', fieldMappings);
        
        let populatedCount = 0;
        
        // Populate all available context fields
        Object.entries(fieldMappings).forEach(([contextKey, fieldIds]) => {
            const value = context[contextKey] || context.entityName;
            console.log(`🔄 MODAL DEBUG: Mapping ${contextKey} = "${value}" to fields:`, fieldIds);
            if (value && this._populateField(fieldIds, value)) {
                populatedCount++;
                console.log(`✅ MODAL DEBUG: Successfully populated ${contextKey} field`);
            } else {
                console.warn(`⚠️ MODAL DEBUG: Failed to populate ${contextKey} field. No matching form field found.`);
            }
        });
        
        // Set customer segment based on entity type
        this._setCustomerSegment(context.entityType);
        
        // Store context for later use
        window.modalContext = context;
        
        if (populatedCount > 0) {
            this.showModalNotification(`Auto-populated ${populatedCount} fields from CRM`, 'success');
        } else {
            console.error('❌ MODAL DEBUG: No fields were populated! Form field IDs may be incorrect.');
        }
    },
    
    /**
     * Helper to populate a field by trying multiple selectors
     */
    _populateField: function(fieldIds, value) {
        for (const fieldId of fieldIds) {
            console.log(`🔍 MODAL DEBUG: Looking for field with ID or name "${fieldId}"`);
            const field = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
            if (field) {
                console.log(`✅ MODAL DEBUG: Found field ${fieldId}, setting value to "${value}"`);
                field.value = value;
                field.classList.add('auto-populated');
                return true;
            } else {
                console.warn(`⚠️ MODAL DEBUG: Field ${fieldId} not found in document`);
            }
        }
        console.error(`❌ MODAL DEBUG: None of these fields found:`, fieldIds);
        return false;
    },
    
    /**
     * Helper to list all available form fields for debugging
     */
    _listAvailableFormFields: function() {
        const inputFields = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea, select'))
            .map(field => ({
                id: field.id,
                name: field.name,
                type: field.type || field.tagName.toLowerCase(),
                value: field.value
            }));
        return inputFields;
    },
    
    /**
     * Set customer segment based on entity type
     */
    _setCustomerSegment: function(entityType) {
        const segmentField = document.getElementById('customerSegment');
        if (segmentField && entityType) {
            const segmentMap = {
                'company': 'distributor',
                'person': 'retailer',
                'lead': 'direct'
            };
            segmentField.value = segmentMap[entityType.toLowerCase()] || 'distributor';
        }
    },
    
    /**
     * Save quote as Copper activity
     */
    saveQuoteAsActivity: function(quoteData) {
        if (!this.isModalMode() || !window.modalContext) {
            return false;
        }
        
        if (typeof window.Copper === 'undefined') {
            this.showModalNotification('CRM not available', 'error');
            return false;
        }
        
        try {
            const sdk = window.Copper.init();
            const activityDetails = this._formatActivityDetails(quoteData);
            
            sdk.logActivity(0, activityDetails);
            this.showModalNotification('Quote saved to CRM!', 'success');
            
            // Close modal after delay
            setTimeout(() => sdk.closeModal(), 2000);
            return true;
        } catch (error) {
            console.error('❌ Error saving quote:', error);
            this.showModalNotification('Error saving to CRM', 'error');
            return false;
        }
    },
    
    /**
     * Format activity details for CRM
     */
    _formatActivityDetails: function(quoteData) {
        return `Quote Generated: ${quoteData.quoteName}\n` +
               `Company: ${quoteData.companyName}\n` +
               `Total: ${quoteData.totalAmount}\n` +
               `Products: ${quoteData.products.join(', ')}\n` +
               `Generated via Kanva Quote Tool`;
    },
    
    /**
     * Show notification in modal
     */
    showModalNotification: function(message, type = 'info') {
        const notification = this._createNotificationElement(message, type);
        document.body.appendChild(notification);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    },
    
    /**
     * Create notification element
     */
    _createNotificationElement: function(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 12px 20px;
            border-radius: 6px; color: white; font-weight: bold; z-index: 10000;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
            transition: opacity 0.3s ease;
        `;
        notification.textContent = message;
        return notification;
    },
    
    /**
     * Initialize modal overlay handler
     */
    initialize: function() {
        if (this._initialized) return;
        
        console.log('🖥️ Initializing Modal Overlay Handler...');
        
        if (this.isModalMode()) {
            this.extractModalContext();
            this._setupModalBehavior();
        }
        
        this._initialized = true;
    },
    
    /**
     * Setup modal-specific behavior
     */
    _setupModalBehavior: function() {
        // Add modal-specific CSS class
        document.body.classList.add('modal-mode');
        
        // Setup any modal-specific event listeners
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    },
    
    /**
     * Close modal
     */
    closeModal: function() {
        if (appState.sdk && typeof appState.sdk.closeModal === 'function') {
            appState.sdk.closeModal();
        } else {
            // For non-Copper environments, try to close the custom modal
            const modalOverlay = document.getElementById('copperModalOverlay');
            if (modalOverlay) {
                modalOverlay.remove();
                document.body.classList.remove('modal-open');
            }
        }
    },

    /**
     * Create and display a full-screen modal overlay
     */
    createFullScreenModal: function() {
        console.log('🖥️ Creating full-screen modal overlay...');
        
        // Don't create duplicate modals
        if (document.getElementById('copperModalOverlay')) {
            return;
        }
        
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'copperModalOverlay';
        modalOverlay.className = 'copper-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-container" id="modalContainer">
                <div class="modal-header" id="modalHeader" style="background-color: #93D500;">
                    <div class="modal-title">
                        <img src="assets/logo/kanva-logo.png" alt="Kanva" class="modal-logo">
                        <span>Kanva Quote Generator</span>
                    </div>
                    <div class="modal-controls">
                        <button class="modal-minimize" onclick="ModalOverlayHandler.minimizeModal()" title="Minimize">−</button>
                        <button class="modal-maximize" onclick="ModalOverlayHandler.maximizeModal()" title="Maximize">□</button>
                        <button class="modal-close" onclick="ModalOverlayHandler.closeModal()" title="Close">×</button>
                    </div>
                </div>
                <div class="modal-content" id="modalContent">
                    <!-- App content will be moved here -->
                </div>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(modalOverlay);
        document.body.classList.add('modal-open');
        
        // Move the app container into the modal content
        const appContainer = document.getElementById('app-container');
        const modalContent = document.getElementById('modalContent');
        
        if (appContainer && modalContent) {
            // Store original parent for restoring later
            appContainer._originalParent = appContainer.parentNode;
            appContainer._originalNextSibling = appContainer.nextSibling;
            
            // Move into modal
            modalContent.appendChild(appContainer);
        }
        
        // Make the modal draggable
        this.makeDraggable(document.getElementById('modalContainer'), document.getElementById('modalHeader'));
        
        return modalOverlay;
    },
    
    /**
     * Minimize the modal
     */
    minimizeModal: function() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.classList.toggle('minimized');
        }
    },
    
    /**
     * Maximize the modal
     */
    maximizeModal: function() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.classList.toggle('maximized');
        }
    },
    
    /**
     * Make an element draggable
     */
    makeDraggable: function(element, handle) {
        if (!element) return;
        
        const dragHandle = handle || element;
        let offsetX = 0, offsetY = 0;
        
        const onMouseDown = function(e) {
            e.preventDefault();
            
            // Get the current position
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            
            // Change cursor style
            document.body.style.cursor = 'grabbing';
            dragHandle.style.cursor = 'grabbing';
            
            // Add event listeners for movement and release
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            // Disable text selection during drag
            dragHandle.style.userSelect = 'none';
        };
        
        const onMouseMove = function(e) {
            e.preventDefault();
            
            // Calculate new position with boundary constraints
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            
            // Apply boundary constraints
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            // Update position
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        };
        
        const onMouseUp = function() {
            // Remove event listeners
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Reset cursor style
            document.body.style.cursor = 'auto';
            dragHandle.style.cursor = 'grab';
            dragHandle.style.userSelect = '';
        };
        
        // Add mouse event listeners
        dragHandle.addEventListener('mousedown', onMouseDown);
        
        // Add touch event listeners for mobile
        dragHandle.addEventListener('touchstart', function(e) {
            const touch = e.touches[0];
            offsetX = touch.clientX - element.getBoundingClientRect().left;
            offsetY = touch.clientY - element.getBoundingClientRect().top;
            
            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
        });
        
        const onTouchMove = function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            
            let newX = touch.clientX - offsetX;
            let newY = touch.clientY - offsetY;
            
            // Apply boundary constraints
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        };
        
        const onTouchEnd = function() {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
        
        // Reset position on window resize
        window.addEventListener('resize', function() {
            // Center the element
            element.style.left = ((window.innerWidth - element.offsetWidth) / 2) + 'px';
            element.style.top = ((window.innerHeight - element.offsetHeight) / 2) + 'px';
        });
        
        // Initialize position
        element.style.position = 'fixed';
        element.style.left = ((window.innerWidth - element.offsetWidth) / 2) + 'px';
        element.style.top = ((window.innerHeight - element.offsetHeight) / 2) + 'px';
        dragHandle.style.cursor = 'grab';
    }
};

// =============================================================================
// ENHANCED COPPER INTEGRATION
// =============================================================================

const CopperIntegration = {
    // Private state
    _initialized: false,
    _retryCount: 0,
    _maxRetries: 3,
    
    /**
     * Main initialization method
     */
    async initialize() {
        if (this._initialized) return true;
        
        console.log('🔗 Initializing Copper CRM integration...');
        
        try {
            // Load credentials
            await this._loadCredentials();
            
            // Detect and initialize SDK
            const sdkReady = await this._initializeSDK();
            
            if (sdkReady) {
                this._setupCopperEnvironment();
                this._initialized = true;
                return true;
            } else {
                this._setupStandaloneMode();
                return false;
            }
        } catch (error) {
            console.error('❌ Error initializing Copper SDK:', error);
            this._setupStandaloneMode();
            return false;
        }
    },
    
    /**
     * Load credentials from secure storage
     */
    async _loadCredentials() {
        try {
            // Try loading from secureIntegrationHandler first
            if (window.secureIntegrationHandler) {
                try {
                    const copperConfig = await window.secureIntegrationHandler.getIntegration('copper');
                    if (copperConfig) {
                        if (!appState.copper) appState.copper = {};
                        Object.assign(appState.copper, copperConfig);
                        console.log('✅ Copper credentials loaded from secure integration handler');
                        return;
                    }
                } catch (error) {
                    console.warn('⚠️ Could not load Copper credentials from secure handler:', error.message);
                    // Continue to fallback methods
                }
            }
            
            // Fallback to localStorage directly if secure handler failed
            try {
                const storedConfig = localStorage.getItem('copper_credentials');
                if (storedConfig) {
                    const config = JSON.parse(storedConfig);
                    if (!appState.copper) appState.copper = {};
                    Object.assign(appState.copper, config);
                    console.log('✅ Copper credentials loaded from localStorage');
                    return;
                }
            } catch (lsError) {
                console.warn('⚠️ Could not load Copper credentials from localStorage:', lsError.message);
            }
            
            // If we reach here, we couldn't load credentials
            console.info('🔍 No Copper credentials found - proceeding with defaults');
        } catch (error) {
            console.warn('⚠️ Error in credential loading process:', error.message);
        }
    },
    
    /**
     * Initialize Copper SDK with retry logic
     */
    async _initializeSDK() {
        if (typeof window.Copper !== 'undefined') {
            try {
                appState.sdk = window.Copper.init();
                console.log('✅ Copper SDK initialized');
                return true;
            } catch (error) {
                console.error('❌ Error calling Copper.init():', error);
                return false;
            }
        }
        
        // Wait for SDK to load with retry logic
        return await this._waitForSDK();
    },
    
    /**
     * Wait for SDK to load with exponential backoff
     */
    async _waitForSDK() {
        const checkSDK = () => {
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    this._retryCount++;
                    
                    if (typeof window.Copper !== 'undefined') {
                        clearInterval(interval);
                        try {
                            appState.sdk = window.Copper.init();
                            console.log('✅ Copper SDK found on retry!');
                            resolve(true);
                        } catch (error) {
                            console.error('❌ Error initializing SDK on retry:', error);
                            resolve(false);
                        }
                    } else if (this._retryCount >= this._maxRetries) {
                        clearInterval(interval);
                        console.log('⚠️ Copper SDK not found after retries');
                        resolve(false);
                    }
                }, 1000 * this._retryCount); // Exponential backoff
            });
        };
        
        return await checkSDK();
    },
    
    /**
     * Setup Copper environment
     */
    _setupCopperEnvironment() {
        appState.isCopperActive = true;
        appState.integrationMode = this._detectIntegrationMode();
        
        // Initialize context and UI based on mode
        this._initializeByMode();
        
        // Setup context bridge for cross-iframe communication
        this._initializeContextBridge();
        
        // Get user context
        this._getUserContext();
    },
    
    /**
     * Detect integration mode with improved logic
     */
    _detectIntegrationMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const location = urlParams.get('location');
        const isInIframe = window.self !== window.top;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Clear any existing modal state
        this._clearModalState();
        
        // Determine mode based on context
        if (location === 'modal') {
            return 'modal';
        } else if (location === 'activity_panel' || (isInIframe && windowWidth < 500 && windowHeight < 500)) {
            return 'activity_panel';
        } else if (location === 'left_nav' || location === 'action_bar' || isInIframe) {
            return 'left_nav';
        } else {
            return 'standalone';
        }
    },
    
    /**
     * Clear any existing modal state
     */
    _clearModalState() {
        const existingOverlay = document.getElementById('copperModalOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Reset button visibility
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'block';
        }
    },
    
    /**
     * Initialize based on detected mode
     */
    _initializeByMode() {
        appState.isActivityPanel = appState.integrationMode === 'activity_panel';
        appState.isLeftNav = appState.integrationMode === 'left_nav';
        appState.isEmbedded = appState.integrationMode !== 'standalone';
        
        switch (appState.integrationMode) {
            case 'activity_panel':
                this._setupActivityPanel();
                break;
            case 'left_nav':
            case 'action_bar':
                this._setupLeftNav();
                break;
            case 'modal':
                // Modal setup is handled by ModalOverlayHandler
                break;
            default:
                // Standalone mode - no special setup needed
                break;
        }
        
        console.log(`🎯 Integration mode: ${appState.integrationMode}`);
    },
    
    /**
     * Setup Activity Panel mode
     */
    _setupActivityPanel() {
        this._showLaunchModalButton();
        this._hideFullscreenButton();
        
        // Automatically fetch entity context data when app loads in activity panel
        console.log('🔄 Activity panel mode detected - auto-fetching entity data...');
        this._getUserContext();
    },
    
    /**
     * Setup Left Nav mode
     */
    _setupLeftNav() {
        this._hideModalElements();
        // Enable customer search after DOM is ready
        setTimeout(() => this._enableCustomerSearch(), 500);
    },
    
    /**
     * Show/hide UI elements based on mode
     */
    _showLaunchModalButton() {
        const launchBtn = document.getElementById('launchQuoteModalBtn');
        if (launchBtn) {
            launchBtn.style.display = 'inline-block';
        }
    },
    
    _hideFullscreenButton() {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'none';
        }
    },
    
    _hideModalElements() {
        const launchBtn = document.getElementById('launchQuoteModalBtn');
        if (launchBtn) {
            launchBtn.style.display = 'none';
        }
    },
    
    /**
     * Get user context from Copper
     */
    _getUserContext() {
        if (!appState.sdk) return;
        
        appState.sdk.getContext()
            .then((data) => {
                this._processContext(data);
            })
            .catch((error) => {
                console.error('❌ Error getting Copper context:', error);
                appState.hasEntityContext = false;
                
                // Enable customer search as fallback for left nav
                if (appState.isLeftNav) {
                    this._enableCustomerSearch();
                }
            });
    },
    
    /**
     * Process received context data
     */
    _processContext(data) {
        console.log('👤 Copper context received:', data);
        console.log('📋 DEBUG: COPPER CONTEXT STRUCTURE', JSON.stringify(data, null, 2));
        
        // Fix: Parse the JSON string if context is a string
        let parsedContext = data.context;
        if (data.context && typeof data.context === 'string') {
            try {
                parsedContext = JSON.parse(data.context);
                console.log('✅ Successfully parsed context JSON string to object');
            } catch (e) {
                console.error('❌ Error parsing context JSON string:', e);
                // Keep the original context if parsing fails
            }
        }
        
        appState.copperContext = data;
        appState.hasEntityContext = !!(parsedContext && (parsedContext.id || parsedContext.entity));
        appState.contextData = {
            entity: parsedContext, // Store the entity data directly
            type: data.type       // Keep the type from the outer object
        };
        
        // Log context availability status
        console.log(`🔍 Copper context availability: ${appState.hasEntityContext ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
        if (parsedContext) {
            console.log('🔢 Context entity type:', data.type);
            console.log('📊 Context entity state:', parsedContext.address?.state);
            console.log('📌 Context entity ID:', parsedContext.id);
            console.log('📝 Entity name:', parsedContext.name || parsedContext.company_name || 'Unknown');
        }
        
        // Auto-populate if we have entity data
        if (parsedContext && parsedContext.id) {
            this._autoPopulateFromEntity(parsedContext, data.type);
        } else {
            console.warn('⚠️ No entity data available for auto-population');
        }
        
        // Update UI based on context
        if (typeof UIManager !== 'undefined' && UIManager.onContextReceived) {
            UIManager.onContextReceived(data);
        }
    },
    
    /**
     * Auto-populate form fields from entity data
     */
    _autoPopulateFromEntity(entity, entityType) {
        console.log('🧩 Auto-populating from entity type:', entityType);
        console.log('📝 Entity data received:', entity);
        
        // Extract data based on entity type
        const extractedData = this._extractEntityData(entity, entityType);
        
        console.log('🔄 Extracted data for form mapping:', extractedData);
        
        // Populate form fields
        const populatedCount = this._populateFormFields(extractedData);
        console.log(`✅ Populated ${populatedCount} form fields from entity data`);
        
        if (populatedCount > 0) {
            this._showAutoPopulationSuccess(populatedCount, entityType, extractedData.displayName);
        } else {
            console.warn('⚠️ No fields were populated from entity data');
        }
        
        // Trigger calculation update
        if (typeof App !== 'undefined' && App.triggerCalculation) {
            App.triggerCalculation();
            console.log('🔄 Triggered calculation update');
        }
    },
    
    /**
     * Extract relevant data from entity
     */
    _extractEntityData(entity, entityType) {
        console.log('🧪 EXTRACTING ENTITY DATA', { entity, entityType });
        
        let data = {
            displayName: '',
            companyName: '',
            customerName: '',
            email: '',
            emailOptions: [],
            phone: '',
            phoneOptions: [],
            address: '',
            state: '',
            customerSegment: '',
            entityId: entity.id || '',
            entityType: entityType || ''
        };
        
        console.log('⚙️ Raw Copper entity fields:', Object.keys(entity));
        console.log('📊 DEBUG: ENTITY STRUCTURE', JSON.stringify(entity, null, 2));
        
        // Extract state from address if available
        if (entity.address && entity.address.state) {
            data.state = entity.address.state;
            console.log('🗺️ Extracted state:', data.state);
        }
        
        // Extract customer segment from various possible sources
        // Enhanced logic to better handle company objects and mappings
        
        // 1. First try to extract segment from customer_type field if exists
        if (entity.customer_type) {
            data.customerSegment = this._mapCustomerTypeToSegment(entity.customer_type);
            console.log('🏷️ Extracted customer segment from customer_type:', data.customerSegment);
        }
        
        // 2. Check company_type for companies
        else if (entity.company_type) {
            data.customerSegment = this._mapCustomerTypeToSegment(entity.company_type);
            console.log('🏷️ Extracted customer segment from company_type:', data.customerSegment);
        }
        
        // 3. Check for tags that indicate customer segment
        else if (entity.tags && entity.tags.length > 0) {
            // Look for specific segment indicator tags
            const segmentTags = entity.tags.filter(tag => 
                tag.toLowerCase().includes('retail') || 
                tag.toLowerCase().includes('wholesale') || 
                tag.toLowerCase().includes('distributor') ||
                tag.toLowerCase().includes('direct'));
                
            if (segmentTags.length > 0) {
                data.customerSegment = this._mapCustomerTypeToSegment(segmentTags[0]);
                console.log('🏷️ Extracted customer segment from tags:', data.customerSegment);
            }
        }
        
        // 4. Try to extract from custom fields if available
        if (!data.customerSegment && entity.custom_fields) {
            // Look for custom fields that might contain segment information
            Object.entries(entity.custom_fields).forEach(([fieldId, value]) => {
                if (!data.customerSegment && (
                    (typeof fieldId === 'string' && 
                    (fieldId.toLowerCase().includes('segment') || 
                     fieldId.toLowerCase().includes('type') || 
                     fieldId.toLowerCase().includes('category'))) || 
                    (typeof value === 'string' && 
                    (value.toLowerCase().includes('retail') || 
                     value.toLowerCase().includes('wholesale') || 
                     value.toLowerCase().includes('distributor') ||
                     value.toLowerCase().includes('direct'))))) {
                    
                    data.customerSegment = this._mapCustomerTypeToSegment(value);
                    console.log('🏷️ Extracted customer segment from custom field:', data.customerSegment);
                }
            });
        }
        
        // Different extraction based on entity type
        if (entityType === 'person') {
            data.displayName = entity.name || '';
            data.customerName = entity.name || '';
            
            // Extract email with options
            const emailResult = this._extractEmail(entity);
            data.email = emailResult.primary;
            data.emailOptions = emailResult.options;
            
            // Extract phone with options
            const phoneResult = this._extractPhone(entity);
            data.phone = phoneResult.primary;
            data.phoneOptions = phoneResult.options;
            
            // Check for related company
            if (entity.company_name) {
                data.companyName = entity.company_name;
            }
            
            console.log('👤 Extracted PERSON data:', {
                name: entity.name,
                email: data.email,
                emailOptions: data.emailOptions,
                phone: data.phone,
                phoneOptions: data.phoneOptions,
                company: data.companyName,
                state: data.state,
                customerSegment: data.customerSegment,
                source: 'entity.name, entity.email_addresses, entity.phone_numbers, entity.company_name, entity.address'
            });
            
        } else if (entityType === 'company') {
            data.displayName = entity.name || '';
            data.companyName = entity.name || '';
            
            // Extract email with options
            const emailResult = this._extractEmail(entity);
            data.email = emailResult.primary;
            data.emailOptions = emailResult.options;
            
            // Extract phone with options
            const phoneResult = this._extractPhone(entity);
            data.phone = phoneResult.primary;
            data.phoneOptions = phoneResult.options;
            
            console.log('🏢 Extracted COMPANY data:', {
                name: entity.name,
                email: data.email,
                emailOptions: data.emailOptions,
                phone: data.phone,
                phoneOptions: data.phoneOptions,
                state: data.state,
                customerSegment: data.customerSegment,
                source: 'entity.name, entity.email_addresses, entity.phone_numbers, entity.address'
            });
        } else {
            console.warn('⚠️ Unknown entity type for extraction:', entityType);
        }
        
        console.log('🔄 Final extracted data:', data);
        return data;
    },
    
    /**
     * Extract email from entity
     * @returns {Object} {primary: string, options: Array}
     */
    _extractEmail(entity) {
        if (!entity) return { primary: '', options: [] };
        
        let primary = '';
        let options = [];
        let source = 'none';
        
        try {
            // Case 1: Array of email_addresses objects (most common in person entities)
            if (entity.email_addresses && Array.isArray(entity.email_addresses) && entity.email_addresses.length > 0) {
                // Convert to consistent format
                const emailObjs = entity.email_addresses.map(item => {
                    if (typeof item === 'string') return { email: item, category: 'other' };
                    return item;
                });
                
                // Filter out empty emails
                const validEmails = emailObjs.filter(e => e.email && e.email.trim() !== '');
                
                if (validEmails.length > 0) {
                    // Primary email is the first one marked as work, or first in array
                    const workEmail = validEmails.find(e => e.category === 'work');
                    primary = workEmail ? workEmail.email : validEmails[0].email;
                    
                    // Build dropdown options
                    options = validEmails.map(e => ({
                        value: e.email,
                        label: `${e.email} (${e.category || 'other'})`,
                        type: e.category || 'other'
                    }));
                    
                    console.log(`📧 Extracted ${options.length} email options from entity:`, options);
                }
                source = 'entity.email_addresses';
            } else if (entity.email) {
                // Entity has a single email field
                primary = entity.email;
                options = [{ value: entity.email, label: entity.email, type: 'primary' }];
                source = 'entity.email';
            }
        } catch (error) {
            console.error('⚠️ Error extracting email addresses:', error);
        }
        
        // Return the primary email and options array
        return {
            primary,
            options,
            source
        };
    },
    
    /**
     * Extract phone from entity
     * @returns {Object} {primary: string, options: Array}
     */
    _extractPhone(entity) {
        // Extract phone numbers from either contact object or direct field
        let primary = '';
        let options = [];
        let source = 'none';
        
        try {
            // Case 1: Direct phone_number field
            if (entity.phone_number) {
                primary = entity.phone_number;
                options.push({ value: entity.phone_number, label: entity.phone_number, type: 'primary' });
                source = 'entity.phone_number';
            }
            
            // Case 2: Array of phone_numbers (common in person entities)
            if (entity.phone_numbers && Array.isArray(entity.phone_numbers) && entity.phone_numbers.length > 0) {
                entity.phone_numbers.forEach((item, index) => {
                    const phoneObj = typeof item === 'string' ? { number: item } : item;
                    const phoneValue = phoneObj.number || '';
                    const phoneCategory = phoneObj.category || (index === 0 ? 'primary' : 'other');
                    
                    if (phoneValue) {
                        // Use first phone as primary if not already set
                        if (!primary && index === 0) {
                            primary = phoneValue;
                        }
                        
                        options.push({
                            value: phoneValue,
                            label: `${phoneValue} (${phoneCategory})`,
                            type: phoneCategory
                        });
                    }
                });
                source = 'entity.phone_numbers';
            }
            
            // Case 3: Simple phones array (less common but checking for consistency)
            if (entity.phones && Array.isArray(entity.phones) && entity.phones.length > 0) {
                entity.phones.forEach((phone, index) => {
                    const phoneValue = phone.number || (typeof phone === 'string' ? phone : '');
                    
                    if (phoneValue) {
                        // Use first phone as primary if not already set
                        if (!primary && index === 0) {
                            primary = phoneValue;
                        }
                        
                        options.push({
                            value: phoneValue,
                            label: `Phone ${index + 1}`,
                            type: index === 0 ? 'primary' : 'secondary'
                        });
                    }
                });
                source = 'entity.phones';
            }
            
            // De-duplicate options
            options = options.filter((item, index, self) => 
                index === self.findIndex(t => t.value === item.value)
            );
            
            console.log(`☎️ Extracted phones:`, {
                primary,
                count: options.length,
                options,
                source
            });
        } catch (error) {
            console.error('⚠️ Error extracting phone numbers:', error);
        }
        
        return { primary, options };
    },
    
    /**
     * Populate form fields with extracted entity data
     */
    _populateFormFields(data) {
        if (!data) {
            console.warn('⚠️ No data to populate form fields with');
            return 0;
        }
        
        let populatedCount = 0;
        let mappingResults = {};
        
        console.log('📝 POPULATING FORM FIELDS WITH DATA:', data);
        
        // Map fields to form inputs
        if (data.companyName) {
            const success = this._setFieldValue(['companyName', 'company_name'], data.companyName);
            mappingResults['Company Name'] = { success, value: data.companyName };
            if (success) populatedCount++;
        }
        
        if (data.customerName) {
            const success = this._setFieldValue(['customerName', 'customer_name'], data.customerName);
            mappingResults['Customer Name'] = { success, value: data.customerName };
            if (success) populatedCount++;
        }
        
        // ENHANCEMENT: Email - Either use dropdown or fallback to text field
        if (data.email && data.emailOptions && data.emailOptions.length > 0) {
            // Try to populate dropdown first
            const emailDropdown = document.getElementById('customerEmail_dropdown') || 
                                 document.getElementById('email_dropdown');
            const emailInput = document.getElementById('customerEmail');
                                 
            if (emailDropdown && emailDropdown.tagName === 'SELECT') {
                // Populate the dropdown with options
                const success = this._populateDropdownField(
                    ['customerEmail_dropdown', 'email_dropdown'], 
                    data.emailOptions, 
                    data.email
                );
                mappingResults['Email Dropdown'] = { success, value: data.email, options: data.emailOptions.length };
                if (success) populatedCount++;
            }
            
            // Always set the text field value
            const success = this._setFieldValue(['customerEmail', 'email'], data.email);
            mappingResults['Email'] = { success, value: data.email };
            if (success) populatedCount++;
            
            // Store options as data attribute for the dropdown handler
            if (emailInput && data.emailOptions.length > 1) {
                emailInput.dataset.options = JSON.stringify(data.emailOptions);
                emailInput.classList.add('has-options');
            }
        } else if (data.email) {
            // Just set the single email value
            const success = this._setFieldValue(['customerEmail', 'email'], data.email);
            mappingResults['Email'] = { success, value: data.email };
            if (success) populatedCount++;
        }
        
        // ENHANCEMENT: Phone - Either use dropdown or fallback to text field
        if (data.phone && data.phoneOptions && data.phoneOptions.length > 0) {
            // Try to populate dropdown first
            const phoneDropdown = document.getElementById('customerPhone_dropdown') || 
                                 document.getElementById('phone_dropdown');
            const phoneInput = document.getElementById('customerPhone');
                                 
            if (phoneDropdown && phoneDropdown.tagName === 'SELECT') {
                // Populate the dropdown with options
                const success = this._populateDropdownField(
                    ['customerPhone_dropdown', 'phone_dropdown'], 
                    data.phoneOptions, 
                    data.phone
                );
                mappingResults['Phone Dropdown'] = { success, value: data.phone, options: data.phoneOptions.length };
                if (success) populatedCount++;
            }
            
            // Always set the text field value
            const success = this._setFieldValue(['customerPhone', 'phone'], data.phone);
            mappingResults['Phone'] = { success, value: data.phone };
            if (success) populatedCount++;
            
            // Store options as data attribute for the dropdown handler
            if (phoneInput && data.phoneOptions.length > 1) {
                phoneInput.dataset.options = JSON.stringify(data.phoneOptions);
                phoneInput.classList.add('has-options');
            }
        } else if (data.phone) {
            // Just set the single phone value
            const success = this._setFieldValue(['customerPhone', 'phone'], data.phone);
            mappingResults['Phone'] = { success, value: data.phone };
            if (success) populatedCount++;
        }
        
        // ENHANCEMENT: State dropdown
        if (data.state) {
            const stateField = document.getElementById('customerState') || 
                             document.getElementById('state');
                             
            if (stateField && stateField.tagName === 'SELECT') {
                // Populate state dropdown with proper options and selection
                const success = this._populateStateField(['customerState', 'state'], data.state);
                mappingResults['State Dropdown'] = { success, value: data.state };
                if (success) populatedCount++;
            } else if (stateField) {
                // Fallback to text field
                const success = this._setFieldValue(['customerState', 'state'], data.state);
                mappingResults['State'] = { success, value: data.state };
                if (success) populatedCount++;
            }
        }
        
        // ENHANCEMENT: Customer segment dropdown
        if (data.customerSegment) {
            const segmentField = document.getElementById('customerSegment') || 
                               document.getElementById('customer_segment') || 
                               document.getElementById('customer_type');
                               
            if (segmentField && segmentField.tagName === 'SELECT') {
                // Populate segment dropdown
                const success = this._populateCustomerSegmentField(segmentField.id, data.customerSegment);
                mappingResults['Customer Segment'] = { success, value: data.customerSegment };
                if (success) populatedCount++;
            } else if (segmentField) {
                // Fallback to text field
                const success = this._setFieldValue([segmentField.id], data.customerSegment);
                mappingResults['Customer Segment'] = { success, value: data.customerSegment };
                if (success) populatedCount++;
            }
        }
        
        // Set entity ID and type as data attributes on the form for further processing
        const quoteForm = document.getElementById('quote-form');
        if (quoteForm) {
            quoteForm.dataset.entityId = data.entityId || '';
            quoteForm.dataset.entityType = data.entityType || '';
            mappingResults['Entity Metadata'] = { success: true, value: `ID: ${data.entityId}, Type: ${data.entityType}` };
        }
        
        // IMPORTANT: Quote Name field (id=quoteName) should always remain user input only
        // This field should never be auto-populated from Copper data
        console.log('📊 Field mapping results:');
        console.log('ℹ️ Note: Quote Name field is intentionally left for user input only');
        console.table(Object.entries(mappingResults).map(([field, result]) => ({
            'Field': field,
            'Value': result.value,
            'Populated': result.success ? '✅ Yes' : '❌ No'
        })));
        
        if (populatedCount > 0) {
            this._showAutoPopulationSuccess(populatedCount, data.entityType, data.displayName);
        }
        
        return populatedCount;
    },
    
    /**
     * Set field value by trying multiple IDs
     */
    _setFieldValue(fieldIds, value) {
        if (!fieldIds || !value) return false;
        
        let populated = false;
        let foundElement = null;
        
        // Try each field ID
        for (const fieldId of fieldIds) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
                populated = true;
                foundElement = fieldId;
                // No need to try other IDs if one worked
                break;
            }
        }
        
        if (populated) {
            console.log(`✅ Set field value: "${foundElement}" = "${value}"`);
        } else {
            console.warn(`❌ Failed to find any matching form fields for: ${fieldIds.join(', ')}`);
        }
        
        return populated;
    },
    
    /**
     * Populate dropdown field with options
     */
    _populateDropdownField(fieldIds, options, selectedValue) {
        if (!fieldIds || !options || !options.length) return false;
        
        let populated = false;
        let foundElement = null;
        
        // Try each field ID
        for (const fieldId of fieldIds) {
            const select = document.getElementById(fieldId);
            if (select && select.tagName === 'SELECT') {
                // Clear existing options
                while (select.options.length > 0) {
                    select.remove(0);
                }
                
                // Add options from provided list
                options.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.value;
                    opt.textContent = option.label || option.value;
                    opt.dataset.type = option.type || '';
                    
                    // Select the option that matches the selected value
                    if (option.value === selectedValue) {
                        opt.selected = true;
                    }
                    
                    select.appendChild(opt);
                });
                
                populated = true;
                foundElement = fieldId;
                
                // Also trigger change event to notify form handlers
                const event = new Event('change');
                select.dispatchEvent(event);
                
                // No need to try other IDs if one worked
                break;
            } else if (select) {
                // If element exists but isn't a dropdown, fallback to normal value setting
                select.value = selectedValue;
                populated = true;
                foundElement = fieldId;
                console.log(`⚠️ Element ${fieldId} is not a SELECT dropdown, using fallback value setting`);
                break;
            }
        }
        
        if (populated) {
            console.log(`✅ Populated dropdown: "${foundElement}" with ${options.length} options, selected "${selectedValue}"`);
        } else {
            console.warn(`❌ Failed to find any matching dropdown for: ${fieldIds.join(', ')}`);
        }
        
        return populated;
    },
    
    /**
     * Populate state field dropdown
     */
    _populateStateField(fieldIds, stateValue) {
        if (!fieldIds || !stateValue) return false;
        
        const stateOptions = [
            { value: '', label: 'Select State...' },
            { value: 'AL', label: 'Alabama' },
            { value: 'AK', label: 'Alaska' },
            { value: 'AZ', label: 'Arizona' },
            { value: 'AR', label: 'Arkansas' },
            { value: 'CA', label: 'California' },
            { value: 'CO', label: 'Colorado' },
            { value: 'CT', label: 'Connecticut' },
            { value: 'DE', label: 'Delaware' },
            { value: 'DC', label: 'District of Columbia' },
            { value: 'FL', label: 'Florida' },
            { value: 'GA', label: 'Georgia' },
            { value: 'HI', label: 'Hawaii' },
            { value: 'ID', label: 'Idaho' },
            { value: 'IL', label: 'Illinois' },
            { value: 'IN', label: 'Indiana' },
            { value: 'IA', label: 'Iowa' },
            { value: 'KS', label: 'Kansas' },
            { value: 'KY', label: 'Kentucky' },
            { value: 'LA', label: 'Louisiana' },
            { value: 'ME', label: 'Maine' },
            { value: 'MD', label: 'Maryland' },
            { value: 'MA', label: 'Massachusetts' },
            { value: 'MI', label: 'Michigan' },
            { value: 'MN', label: 'Minnesota' },
            { value: 'MS', label: 'Mississippi' },
            { value: 'MO', label: 'Missouri' },
            { value: 'MT', label: 'Montana' },
            { value: 'NE', label: 'Nebraska' },
            { value: 'NV', label: 'Nevada' },
            { value: 'NH', label: 'New Hampshire' },
            { value: 'NJ', label: 'New Jersey' },
            { value: 'NM', label: 'New Mexico' },
            { value: 'NY', label: 'New York' },
            { value: 'NC', label: 'North Carolina' },
            { value: 'ND', label: 'North Dakota' },
            { value: 'OH', label: 'Ohio' },
            { value: 'OK', label: 'Oklahoma' },
            { value: 'OR', label: 'Oregon' },
            { value: 'PA', label: 'Pennsylvania' },
            { value: 'RI', label: 'Rhode Island' },
            { value: 'SC', label: 'South Carolina' },
            { value: 'SD', label: 'South Dakota' },
            { value: 'TN', label: 'Tennessee' },
            { value: 'TX', label: 'Texas' },
            { value: 'UT', label: 'Utah' },
            { value: 'VT', label: 'Vermont' },
            { value: 'VA', label: 'Virginia' },
            { value: 'WA', label: 'Washington' },
            { value: 'WV', label: 'West Virginia' },
            { value: 'WI', label: 'Wisconsin' },
            { value: 'WY', label: 'Wyoming' }
        ];
        
        // Convert 2-letter code to full state name if needed
        const stateCode = stateValue.length === 2 ? stateValue.toUpperCase() : stateValue;
        const stateName = stateValue.length > 2 ? stateValue : null;
        
        let valueToSelect = stateCode;
        
        // If we have a state name, find its code
        if (stateName) {
            const matchingState = stateOptions.find(s => s.label.toLowerCase() === stateName.toLowerCase());
            if (matchingState) {
                valueToSelect = matchingState.value;
            }
        }
        
        return this._populateDropdownField(fieldIds, stateOptions, valueToSelect);
    },
    
    /**
     * Map customer type to standard segment value
     * @param {string} typeValue - The raw customer type or segment value
     * @return {string} Standardized segment value
     */
    _mapCustomerTypeToSegment(typeValue) {
        if (!typeValue) return '';
        
        const normalized = String(typeValue).toLowerCase();
        
        // Map to standard segment values
        if (normalized.includes('retail')) {
            return 'retailer';
        } else if (normalized.includes('wholesale') || normalized.includes('distribution') || normalized.includes('distributor')) {
            return 'distributor';
        } else if (normalized.includes('direct') || normalized.includes('consumer')) {
            return 'direct';
        }
        
        // Return original value if no mapping found
        return typeValue;
    },
    
    /**
     * Populate customer segment field dropdown
     */
    _populateCustomerSegmentField(fieldId, segmentValue) {
        if (!fieldId) return false;
        
        const segmentOptions = [
            { value: '', label: 'Select Customer Type...' },
            { value: 'retailer', label: 'Retailer' },
            { value: 'distributor', label: 'Distributor' },
            { value: 'direct', label: 'Direct Consumer' },
            { value: 'other', label: 'Other' }
        ];
        
        // Try to match the segment value with our options
        let valueToSelect = '';
        
        if (segmentValue) {
            const lowerSegment = segmentValue.toLowerCase();
            
            if (lowerSegment.includes('retail')) {
                valueToSelect = 'retail';
            } else if (lowerSegment.includes('wholesale')) {
                valueToSelect = 'wholesale';
            } else if (lowerSegment.includes('distribution') || lowerSegment.includes('dist')) {
                valueToSelect = 'distribution';
            } else {
                valueToSelect = 'other';
            }
        }
        
        return this._populateDropdownField([fieldId], segmentOptions, valueToSelect);
    },
    
    /**
     * Show auto-population success notification
     */
    _showAutoPopulationSuccess(fieldCount, entityType, entityName) {
        const message = `✅ Auto-populated ${fieldCount} field${fieldCount > 1 ? 's' : ''} from ${entityType}: ${entityName}`;
        console.log(message);
        
        // Show visual notification
        this._showNotification(message, 'success');
    },
    
    /**
     * Show notification to user
     */
    _showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'kanva-notification';
        notification.innerHTML = `
            <div class="notification-content ${type}">
                <span>${message}</span>
            </div>
        `;
        
        // Add notification styles if not present
        this._addNotificationStyles();
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
    },
    
    /**
     * Add notification styles
     */
    _addNotificationStyles() {
        if (document.getElementById('kanvaNotificationStyles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'kanvaNotificationStyles';
        styles.textContent = `
            .kanva-notification {
                position: fixed; top: 20px; right: 20px; z-index: 10001;
                animation: slideIn 0.3s ease;
            }
            .notification-content {
                padding: 12px 16px; border-radius: 8px; color: white;
                font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .notification-content.success { background: #10b981; }
            .notification-content.error { background: #ef4444; }
            .notification-content.info { background: #3b82f6; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .auto-populated {
                background-color: #ecfdf5 !important;
                border-color: #10b981 !important;
            }
        `;
        document.head.appendChild(styles);
    },
    
    /**
     * Enable customer search functionality
     */
    _enableCustomerSearch() {
        if (this._searchEnabled) return; // Prevent duplicate interfaces
        
        console.log('🔍 Enabling customer search...');
        
        const customerSection = document.querySelector('.customer-info');
        if (!customerSection) return;
        
        // Add search interface
        const searchHTML = this._generateSearchHTML();
        customerSection.insertAdjacentHTML('afterbegin', searchHTML);
        
        // Bind search events
        this._bindSearchEvents();
        
        this._searchEnabled = true;
    },
    
    /**
     * Generate search HTML
     */
    _generateSearchHTML() {
        return `
            <div class="customer-search" id="customerSearch">
                <h4>🔍 Quick Customer Lookup</h4>
                <div class="search-controls">
                    <input type="text" id="customerSearchInput" placeholder="Search companies & contacts..." />
                    <button class="search-btn" onclick="CopperIntegration.searchCustomers()">Search</button>
                </div>
                <div id="searchResults" class="search-results" style="display: none;"></div>
            </div>
        `;
    },
    
    /**
     * Bind search event listeners
     */
    _bindSearchEvents() {
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (e.target.value.length >= 2) {
                        this.searchCustomers(e.target.value);
                    } else {
                        this._hideSearchResults();
                    }
                }, 300);
            });
        }
    },
    
    /**
     * Search for customers
     */
    searchCustomers(query) {
        const searchQuery = query || document.getElementById('customerSearchInput')?.value;
        if (!searchQuery) return;
        
        console.log(`🔍 Searching customers: "${searchQuery}"`);
        
        if (!appState.sdk) {
            this._showDemoSearchResults(searchQuery);
            return;
        }
        
        this._showSearchLoading();
        
        // Search both companies and contacts
        Promise.allSettled([
            this._searchCompanies(searchQuery),
            this._searchContacts(searchQuery)
        ]).then(results => {
            const companies = results[0].status === 'fulfilled' ? results[0].value : [];
            const contacts = results[1].status === 'fulfilled' ? results[1].value : [];
            const allResults = [...companies, ...contacts];
            this._displaySearchResults(allResults);
        });
    },
    
    /**
     * Search companies using Copper SDK
     */
    async _searchCompanies(query) {
        if (!appState.sdk?.api?.companies?.search) return [];
        
        try {
            const response = await appState.sdk.api.companies.search({
                page_size: 10,
                search: { name: query }
            });
            
            return (response.data || response || []).map(company => ({
                ...company,
                type: 'company',
                display_name: company.name
            }));
        } catch (error) {
            console.warn('⚠️ Company search failed:', error);
            return [];
        }
    },
    
    /**
     * Search contacts using Copper SDK
     */
    async _searchContacts(query) {
        if (!appState.sdk?.api?.people?.search) return [];
        
        try {
            const response = await appState.sdk.api.people.search({
                page_size: 10,
                search: { name: query }
            });
            
            return (response.data || response || []).map(contact => ({
                ...contact,
                type: 'person',
                display_name: contact.name
            }));
        } catch (error) {
            console.warn('⚠️ Contact search failed:', error);
            return [];
        }
    },
    
    /**
     * Show search loading state
     */
    _showSearchLoading() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
            resultsContainer.style.display = 'block';
        }
    },
    
    /**
     * Display search results
     */
    _displaySearchResults(results) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No customers found</div>';
        } else {
            resultsContainer.innerHTML = results.map(customer => 
                this._formatSearchResult(customer)
            ).join('');
        }
        
        resultsContainer.style.display = 'block';
    },
    
    /**
     * Format individual search result
     */
    _formatSearchResult(customer) {
        const displayName = customer.display_name || customer.name;
        const companyInfo = customer.company_name ? ` at ${customer.company_name}` : '';
        const email = customer.emails?.[0]?.email || customer.emails?.[0] || 'No email';
        
        return `
            <div class="search-result" onclick="CopperIntegration.selectCustomer(${this._escapeJson(customer)})">
                <div class="customer-name">${displayName}</div>
                <div class="customer-type">${customer.type}${companyInfo}</div>
                <div class="customer-email">${email}</div>
            </div>
        `;
    },
    
    /**
     * Show demo search results for standalone mode
     */
    _showDemoSearchResults(query) {
        const demoResults = [
            {
                name: "ABC Distribution",
                type: "company",
                emails: [{ email: "contact@abcdistribution.com" }]
            },
            {
                name: "Green Leaf Retail",
                type: "company",
                emails: [{ email: "orders@greenleaf.com" }]
            }
        ].filter(customer => 
            customer.name.toLowerCase().includes(query.toLowerCase())
        );
        
        this._displaySearchResults(demoResults);
    },
    
    /**
     * Select customer from search results
     */
    selectCustomer(customer) {
        console.log('👤 Selected customer:', customer);
        
        // Auto-populate form
        this._autoPopulateFromEntity(customer);
        
        // Hide search results
        this._hideSearchResults();
        
        // Clear search input
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
    },
    
    /**
     * Hide search results
     */
    _hideSearchResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    },
    
    /**
     * Escape JSON for HTML attributes
     */
    _escapeJson(obj) {
        return JSON.stringify(obj).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    
    /**
     * Initialize context bridge for cross-iframe communication
     */
    _initializeContextBridge() {
        if (!appState.sdk) return;
        
        console.log('🌉 Initializing context bridge...');
        
        // Listen for context updates
        if (appState.sdk.on) {
            appState.sdk.on('customerContext', (data) => this._handleReceivedContext(data));
            appState.sdk.on('quoteSaved', (data) => this._handleQuoteSaved(data));
        }
    },
    
    /**
     * Handle received context from other instances
     */
    _handleReceivedContext(contextData) {
        console.log('📨 Received context:', contextData);
        
        if (contextData.entity) {
            this._autoPopulateFromEntity(contextData.entity);
        }
        
        this._showNotification('Customer data auto-populated from CRM', 'success');
        appState.hasEntityContext = !!contextData.entity;
        appState.contextData = contextData;
    },
    
    /**
     * Handle quote saved notification
     */
    _handleQuoteSaved(quoteData) {
        console.log('💾 Quote saved notification:', quoteData);
        this._showNotification(`Quote saved: ${quoteData.quoteId || 'New Quote'}`, 'success');
    },
    
    /**
     * Save quote to CRM as activity
     */
    saveQuoteToCRM() {
        if (!this._validateQuoteData()) return false;
        
        const calc = Calculator.calculateOrder();
        
        if (appState.sdk && appState.sdk.logActivity) {
            try {
                const details = this._formatQuoteActivity(calc);
                appState.sdk.logActivity(0, details);
                
                this._showNotification('Quote saved to CRM!', 'success');
                this._refreshCopperUI();
                return true;
            } catch (error) {
                console.error('❌ Error saving quote:', error);
                this._showNotification('Failed to save quote to CRM', 'error');
                return false;
            }
        } else {
            this._showNotification('CRM integration not available', 'info');
            return false;
        }
    },
    
    /**
     * Validate quote data before saving
     */
    _validateQuoteData() {
        if (typeof Calculator === 'undefined') {
            this._showNotification('Calculator not available', 'error');
            return false;
        }
        
        const calc = Calculator.calculateOrder();
        if (!calc || (!calc.product && !Array.isArray(calc))) {
            this._showNotification('Please calculate a quote first', 'error');
            return false;
        }
        
        return true;
    },
    
    /**
     * Format quote activity for CRM
     */
    _formatQuoteActivity(calc) {
        const timestamp = new Date().toLocaleString();
        const userEmail = appState.currentUser?.email || 'Unknown User';
        const quoteName = document.getElementById('quoteName')?.value || 'Quote';
        
        let productDetails = '';
        let total = 0;
        
        if (Array.isArray(calc)) {
            calc.forEach((item, index) => {
                productDetails += `Product ${index + 1}: ${item.product.name} - ${item.masterCases} cases\n`;
                total += item.raw.total;
            });
        } else {
            productDetails = `Product: ${calc.product.name}\nQuantity: ${calc.masterCases} cases`;
            total = calc.raw.total;
        }
        
        return `KANVA QUOTE: ${quoteName}\n\n${productDetails}\n\nTotal: $${total.toLocaleString()}\n\nGenerated by: ${userEmail}\nDate: ${timestamp}`;
    },
    
    /**
     * Create opportunity in CRM
     */
    createOpportunity() {
        if (!this._validateQuoteData()) return false;
        
        const calc = Calculator.calculateOrder();
        
        if (appState.sdk && appState.sdk.createEntity) {
            try {
                const opportunityData = this._formatOpportunityData(calc);
                appState.sdk.createEntity('opportunity', opportunityData);
                
                this._showNotification('Opportunity created in CRM!', 'success');
                this._refreshCopperUI();
                return true;
            } catch (error) {
                console.error('❌ Error creating opportunity:', error);
                this._showNotification('Failed to create opportunity', 'error');
                return false;
            }
        } else {
            this._showNotification('CRM integration not available', 'info');
            return false;
        }
    },
    
    /**
     * Format opportunity data for CRM
     */
    _formatOpportunityData(calc) {
        const quoteName = document.getElementById('quoteName')?.value || 'Kanva Quote';
        let monetaryValue = 0;
        
        if (Array.isArray(calc)) {
            monetaryValue = calc.reduce((sum, item) => sum + item.raw.total, 0);
        } else {
            monetaryValue = calc.raw.total;
        }
        
        return {
            name: quoteName,
            monetary_value: Math.round(monetaryValue * 100), // Convert to cents
            details: `Kanva Botanicals Quote - Total: $${monetaryValue.toLocaleString()}`,
            status: 'Open',
            close_date: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days from now
            priority: 'Normal'
        };
    },
    
    /**
     * Refresh Copper UI
     */
    _refreshCopperUI() {
        if (appState.sdk && appState.sdk.refreshUI) {
            try {
                appState.sdk.refreshUI({ name: 'ActivityLog' });
                if (appState.copperContext?.type) {
                    appState.sdk.refreshUI({ 
                        name: 'Related', 
                        data: { type: appState.copperContext.type } 
                    });
                }
            } catch (error) {
                console.warn('⚠️ Could not refresh Copper UI:', error);
            }
        }
    },
    
    /**
     * Setup standalone mode for testing
     */
    _setupStandaloneMode() {
        appState.isCopperActive = false;
        appState.isAdmin = true;
        appState.integrationMode = 'standalone';
        appState.isLeftNav = true;
        
        if (typeof AuthManager !== 'undefined') {
            AuthManager.setUser({
                email: 'demo@kanvabotanicals.com',
                name: 'Demo User'
            });
        }
        
        console.log('🔧 Running in standalone demo mode');
        
        // Enable customer search after delay
        setTimeout(() => this._enableCustomerSearch(), 1000);
    },
    
    /**
     * Configure Copper integration with API credentials
     */
    async configure(config) {
        if (!config) {
            console.error('❌ No configuration provided');
            return false;
        }
        
        // Store credentials
        if (!appState.copper) appState.copper = {};
        Object.assign(appState.copper, config);
        
        // Save to secure storage if available
        if (window.secureIntegrationHandler) {
            try {
                await window.secureIntegrationHandler.updateIntegration('copper', {
                    ...appState.copper,
                    lastUpdated: new Date().toISOString()
                });
                
                this._showNotification('Copper credentials updated', 'success');
                return true;
            } catch (error) {
                console.error('❌ Error saving credentials:', error);
                this._showNotification('Failed to save credentials', 'error');
                return false;
            }
        }
        
        return true;
    },
    
    /**
     * Check if CRM features are available
     */
    isCrmAvailable() {
        return appState.sdk !== null;
    },
    
    /**
     * Get current context data
     */
    getContextData() {
        return {
            user: appState.currentUser,
            context: appState.copperContext,
            isAdmin: appState.isAdmin,
            location: appState.appLocation,
            integrationMode: appState.integrationMode,
            hasEntityContext: appState.hasEntityContext
        };
    }
};

// =============================================================================
// GLOBAL FUNCTIONS FOR HTML HANDLERS
// =============================================================================

// Initialize handlers immediately
ModalOverlayHandler.initialize();

// Initialize Copper integration with delayed retry
setTimeout(() => {
    CopperIntegration.initialize();
}, 100);

// Global functions for HTML onclick handlers
function openCopperModal() {
    CopperIntegration.openModal();
}

function saveQuoteToCRM() {
    return CopperIntegration.saveQuoteToCRM();
}

function createOpportunity() {
    return CopperIntegration.createOpportunity();
}

function searchCustomers(query) {
    CopperIntegration.searchCustomers(query);
}

// Function removed - FULL SCREEN button functionality removed from UI

function launchQuoteModal() {
    if (!appState.sdk) {
        alert('Copper SDK not available. Please refresh and try again.');
        return;
    }
    
    console.log('🚀 Launching quote modal with Copper SDK...');
    
    // Use existing context data if already loaded in activity panel
    if (appState.hasEntityContext && appState.contextData && appState.contextData.entity) {
        console.log('💾 Using pre-loaded context data for modal');
        const entity = appState.contextData.entity;
        const entityType = appState.copperContext?.type || '';
        
        const customerData = {
            entity_id: entity.id,
            entity_type: entityType,
            entity_name: entity.name || entity.company_name || '',
            entity_email: entity.email || '',
            entity_phone: entity.phone_number || '',
            entity_state: entity.address?.state || ''
        };
        
        console.log('✅ Using cached entity data:', customerData);
        
        // Build modal URL with existing context
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams({ location: 'modal', ...customerData });
        const modalUrl = `${baseUrl}?${params.toString()}`;
        
        console.log('🔗 Modal URL:', modalUrl);
        
        // Launch modal
        appState.sdk.showModal({
            url: modalUrl,
            width: 1400,
            height: 900,
            title: 'Generate Quote - Kanva Botanicals'
        });
        return;
    }
    
    // Fallback: Get context from SDK if not already loaded
    console.log('🔎 No pre-loaded context found, fetching from SDK...');
    appState.sdk.getContext()
        .then((context) => {
            console.log('📋 Received context from SDK:', context);
            let customerData = {};
            
            // Parse JSON string if context is a string
            let parsedContext = context.context;
            if (context && context.context && typeof context.context === 'string') {
                try {
                    parsedContext = JSON.parse(context.context);
                    console.log('✅ Successfully parsed context JSON string:', parsedContext);
                } catch (e) {
                    console.error('❌ Error parsing context JSON string:', e);
                }
            }
            
            // Properly extract entity data from parsed context
            if (parsedContext && parsedContext.id) {
                const entity = parsedContext; // Entity data is directly in parsed context
                const entityType = context.type || '';
                
                console.log(`🔍 Entity type: ${entityType}, Entity ID: ${entity.id}`);
                
                customerData = {
                    entity_id: entity.id,
                    entity_type: entityType,
                    entity_name: entity.name || entity.company_name || '',
                    entity_email: entity.email || '',
                    entity_phone: entity.phone_number || '',
                    entity_state: entity.address?.state || ''
                };
                
                console.log('✅ Extracted entity data:', customerData);
            }
            
            // Build modal URL
            const baseUrl = window.location.origin + window.location.pathname;
            const params = new URLSearchParams({ location: 'modal', ...customerData });
            const modalUrl = `${baseUrl}?${params.toString()}`;
            
            console.log('🔗 Modal URL:', modalUrl);
            
            // Launch modal
            appState.sdk.showModal({
                url: modalUrl,
                width: 1400,
                height: 900,
                title: 'Generate Quote - Kanva Botanicals'
            });
        })
        .catch((error) => {
            console.error('❌ Error launching modal:', error);
            // Fallback modal without context
            const baseUrl = window.location.origin + window.location.pathname;
            appState.sdk.showModal({
                url: `${baseUrl}?location=modal`,
                width: 1400,
                height: 900,
                title: 'Generate Quote - Kanva Botanicals'
            });
        });
}

function generateQuoteWithModalSupport() {
    const quoteData = {
        quoteName: document.getElementById('quoteName')?.value || 'Kanva Quote',
        companyName: document.getElementById('companyName')?.value || 'Customer',
        customerEmail: document.getElementById('customerEmail')?.value || '',
        // Add any other required quote data fields
    };
    
    // Get Copper context if available
    const copperContext = appState.context || {};
    
    // Merge quote data with Copper context
    const combinedData = { ...quoteData, ...copperContext };
    
    console.log('📋 Generating quote with data:', combinedData);
    
    // TODO: Implement quote generation logic
    // This function should handle creating the quote and potentially showing it in a modal
    
    // For now, just show a success message
    alert('Quote generation feature will be implemented soon!');
    
    return combinedData;
}

console.log('✅ Enhanced Copper Integration loaded successfully');