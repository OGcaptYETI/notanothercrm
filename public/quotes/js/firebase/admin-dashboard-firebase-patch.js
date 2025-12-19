/**
 * Complete Firebase Admin Dashboard Patch - ENHANCED VERSION
 * Combines the FIXED Firebase integration with the restored fancy product edit modal
 * Addresses event binding, function connection issues, and provides beautiful UI
 */

(async function() {
    'use strict';

    console.log('🔥 Loading ENHANCED AdminDashboard Firebase patch with fancy modal...');

    // Enhanced Firebase readiness check
    async function ensureFirebaseReady() {
        let retryCount = 0;
        while (retryCount < 15) {
            if (window.firebase && window.firebase.db && 
                window.firebaseStorageService && window.firebaseDataService) {
                
                if (!window.firebaseDataService.initialized) {
                    console.log('🔄 Initializing Firebase Data Service...');
                    await window.firebaseDataService.initialize();
                }
                
                console.log('✅ Firebase services ready');
                return true;
            }
            
            retryCount++;
            console.log(`⏳ Waiting for Firebase services... (${retryCount}/15)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Firebase services failed to initialize. Check Firebase configuration.');
    }

    // Wait for AdminDashboard to be available
    let dashboardRetries = 0;
    while (typeof AdminDashboard === 'undefined' && dashboardRetries < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        dashboardRetries++;
    }

    if (typeof AdminDashboard === 'undefined') {
        console.error('❌ AdminDashboard class not found');
        return;
    }

    console.log('🔧 Applying ENHANCED Firebase patches to AdminDashboard...');

    // ==========================================
    // RESTORED FANCY PRODUCT EDIT MODAL
    // ==========================================

    /**
     * Override showProductEditModal with the original fancy styling and Firebase integration
     */
    AdminDashboard.prototype.showProductEditModal = async function(productId = null) {
        const isEdit = productId !== null;
        const title = isEdit ? `Edit Product ${productId}` : 'Add New Product';
        
        // Get existing product data from Firebase if editing
        let productData = {};
        if (isEdit) {
            try {
                console.log(`🔍 Loading product data from Firebase for edit: ${productId}`);
                
                if (!window.firebaseDataService) {
                    throw new Error('Firebase Data Service not available');
                }
                
                // Load product data from Firebase
                const firebaseProduct = await window.firebaseDataService.getDocument(`products/${productId}`);
                
                if (firebaseProduct && Object.keys(firebaseProduct).length > 0) {
                    productData = {
                        id: productId,
                        name: firebaseProduct.name || '',
                        price: firebaseProduct.price || 0,
                        msrp: firebaseProduct.msrp || 0,
                        cost: firebaseProduct.cost || 0,
                        category: firebaseProduct.category || '',
                        unitsPerCase: firebaseProduct.unitsPerCase || 1,
                        retailPrice: firebaseProduct.retailPrice || 0,
                        description: firebaseProduct.description || '',
                        image: firebaseProduct.image || firebaseProduct.imageUrl || ''
                    };
                    console.log('✅ Product data loaded from Firebase:', productData);
                } else {
                    throw new Error(`Product ${productId} not found in Firebase`);
                }
            } catch (error) {
                console.error('❌ Error loading product data from Firebase:', error);
                if (this.showNotification) {
                    this.showNotification(`Failed to load product data: ${error.message}`, 'error');
                }
                return; // Don't show modal if we can't load data
            }
        }
        
        const modalHTML = `
            <div class="modal-overlay">
                <div class="product-edit-modal modern-modal">
                    <div class="modal-header">
                        <div class="modal-title-section">
                            <div class="modal-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div>
                                <h3>${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
                                <p class="modal-subtitle">${isEdit ? 'Update product information and settings' : 'Create a new product for the catalog'}</p>
                            </div>
                        </div>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    
                    <form id="product-form" class="modal-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="product-id">
                                    <span class="label-text">Product ID</span>
                                    <span class="required-indicator">*</span>
                                </label>
                                <input type="text" id="product-id" name="id" required ${isEdit ? 'readonly style="background: #f8f9fa; color: #6c757d;"' : ''} 
                                       placeholder="e.g., focus, release, zoom" class="form-input" value="${productData.id || ''}">
                                <small class="form-help">Unique identifier for this product</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="product-name">
                                    <span class="label-text">Product Name</span>
                                    <span class="required-indicator">*</span>
                                </label>
                                <input type="text" id="product-name" name="name" required 
                                       placeholder="e.g., Focus+Flow" class="form-input" value="${productData.name || ''}">
                                <small class="form-help">Display name for customers</small>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="product-price">
                                    <span class="label-text">Distribution Price</span>
                                    <span class="required-indicator">*</span>
                                </label>
                                <div class="input-with-suffix">
                                    <input type="number" id="product-price" name="price" step="0.01" required 
                                           placeholder="4.50" class="form-input" value="${productData.price || ''}">
                                    <span class="input-suffix">$</span>
                                </div>
                                <small class="form-help">Wholesale price per unit for distributors</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="product-retail-price">
                                    <span class="label-text">Retail Price</span>
                                    <span class="required-indicator">*</span>
                                </label>
                                <div class="input-with-suffix">
                                    <input type="number" id="product-retail-price" name="retailPrice" step="0.01" required 
                                           placeholder="5.50" class="form-input" value="${productData.retailPrice || ''}">
                                    <span class="input-suffix">$</span>
                                </div>
                                <small class="form-help">Direct retail price per unit for stores</small>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="product-msrp">
                                    <span class="label-text">MSRP</span>
                                </label>
                                <div class="input-with-suffix">
                                    <input type="number" id="product-msrp" name="msrp" step="0.01" 
                                           placeholder="9.99" class="form-input" value="${productData.msrp || ''}">
                                    <span class="input-suffix">$</span>
                                </div>
                                <small class="form-help">Manufacturer's suggested retail price</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="product-cost">
                                    <span class="label-text">Cost</span>
                                </label>
                                <div class="input-with-suffix">
                                    <input type="number" id="product-cost" name="cost" step="0.01" 
                                           placeholder="3.25" class="form-input" value="${productData.cost || ''}">
                                    <span class="input-suffix">$</span>
                                </div>
                                <small class="form-help">Cost per unit (optional)</small>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="product-category">
                                    <span class="label-text">Category</span>
                                    <span class="required-indicator">*</span>
                                </label>
                                <select id="product-category" name="category" required class="form-input">
                                    <option value="">Select Category</option>
                                    <option value="2oz_wellness" ${productData.category === '2oz_wellness' ? 'selected' : ''}>2oz Wellness</option>
                                    <option value="energy_shots" ${productData.category === 'energy_shots' ? 'selected' : ''}>Energy Shots</option>
                                    <option value="extract_shots" ${productData.category === 'extract_shots' ? 'selected' : ''}>Extract Shots</option>
                                    <option value="supplements" ${productData.category === 'supplements' ? 'selected' : ''}>Supplements</option>
                                    <option value="beverages" ${productData.category === 'beverages' ? 'selected' : ''}>Beverages</option>
                                    <option value="accessories" ${productData.category === 'accessories' ? 'selected' : ''}>Accessories</option>
                                </select>
                                <small class="form-help">Product category for organization</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="product-units">
                                    <span class="label-text">Units Per Case</span>
                                </label>
                                <input type="number" id="product-units" name="unitsPerCase" 
                                       placeholder="144" class="form-input" value="${productData.unitsPerCase || ''}">
                                <small class="form-help">Number of units in a master case</small>
                            </div>
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="product-description">
                                <span class="label-text">Description</span>
                            </label>
                            <textarea id="product-description" name="description" rows="3" 
                                      placeholder="Product description..." class="form-textarea">${productData.description || ''}</textarea>
                            <small class="form-help">Detailed product description for customers</small>
                        </div>
                        
                        <!-- Image Upload Section -->
                        <div class="form-group">
                            <label>Product Image</label>
                            <div class="image-upload-section">
                                <div class="current-image" id="current-image" style="${productData.image ? 'display: block;' : 'display: none;'}">
                                    <img id="current-image-preview" src="${productData.image || ''}" alt="Current image" />
                                    <button type="button" class="btn btn-small btn-secondary" onclick="window.adminDashboard.removeCurrentImage()">
                                        Remove Image
                                    </button>
                                </div>
                                
                                <div class="image-drop-zone-small" id="product-image-drop-zone" style="${productData.image ? 'display: none;' : 'display: block;'}">
                                    <div class="drop-zone-content">
                                        <div class="drop-zone-icon">📷</div>
                                        <p>Drag & drop image or <button type="button" class="btn-link" onclick="document.getElementById('product-image-input').click()">browse</button></p>
                                        <small>Recommended: 200x200px, JPG/PNG</small>
                                    </div>
                                </div>
                                
                                <input type="file" id="product-image-input" accept="image/*" style="display: none;" />
                                
                                <div class="image-preview-small" id="product-image-preview" style="display: none;">
                                    <img id="preview-image-small" src="" alt="Preview" />
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                </svg>
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${isEdit ? 'Update Product' : 'Create Product'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup form handlers
        this.setupProductFormHandlers(productId);
        
        // Focus first input (name field for existing products, ID field for new products)
        setTimeout(() => {
            const firstInput = isEdit ? 
                document.querySelector('.product-edit-modal input[name="name"]') :
                document.querySelector('.product-edit-modal input[name="id"]');
            if (firstInput) firstInput.focus();
        }, 100);
    };

    /**
     * Setup product form handlers (restored from original with Firebase integration)
     */
    AdminDashboard.prototype.setupProductFormHandlers = function(productId) {
        const form = document.getElementById('product-form');
        const imageDropZone = document.getElementById('product-image-drop-zone');
        const imageInput = document.getElementById('product-image-input');
        const imagePreview = document.getElementById('product-image-preview');
        const previewImage = document.getElementById('preview-image-small');
        
        let selectedImageFile = null;
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProductForm(productId, selectedImageFile);
        });
        
        // Image drag and drop
        if (imageDropZone) {
            imageDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                imageDropZone.classList.add('drag-over');
            });
            
            imageDropZone.addEventListener('dragleave', () => {
                imageDropZone.classList.remove('drag-over');
            });
            
            imageDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                imageDropZone.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleImageSelection(files[0]);
                }
            });
        }
        
        // File input change
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleImageSelection(e.target.files[0]);
                }
            });
        }
        
        // Handle image selection
        const handleImageSelection = (file) => {
            if (!file.type.startsWith('image/')) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Please select an image file (JPG, PNG, etc.)', 'warning');
                } else {
                    console.warn('Please select an image file (JPG, PNG, etc.)');
                }
                return;
            }
            
            selectedImageFile = file;
            
            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                if (previewImage) {
                    previewImage.src = e.target.result;
                    imagePreview.style.display = 'block';
                    imageDropZone.style.display = 'none';
                }
            };
            reader.readAsDataURL(file);
        };
        
        // Store reference for form submission
        this.selectedProductImageFile = selectedImageFile;
    };

    /**
     * Remove current image preview
     */
    AdminDashboard.prototype.removeCurrentImage = function() {
        const currentImage = document.getElementById('current-image');
        const imageDropZone = document.getElementById('product-image-drop-zone');
        const imagePreview = document.getElementById('product-image-preview');
        
        if (currentImage) currentImage.style.display = 'none';
        if (imagePreview) imagePreview.style.display = 'none';
        if (imageDropZone) imageDropZone.style.display = 'block';
        
        this.selectedProductImageFile = null;
    };

    /**
     * Enhanced saveProductForm with Firebase integration
     */
    AdminDashboard.prototype.saveProductForm = async function(productId, imageFile) {
        try {
            const form = document.getElementById('product-form');
            const formData = new FormData(form);
            
            // Convert form data to object
            const productData = {
                name: formData.get('name'),
                price: parseFloat(formData.get('price')),
                retailPrice: parseFloat(formData.get('retailPrice')),
                msrp: parseFloat(formData.get('msrp')) || null,
                cost: parseFloat(formData.get('cost')) || null,
                category: formData.get('category'),
                unitsPerCase: parseInt(formData.get('unitsPerCase')) || 1,
                description: formData.get('description') || '',
                image: null // Will be set after image upload
            };
            
            const newProductId = productId || formData.get('id');
            
            // Upload image if provided
            if (imageFile) {
                const result = await this.uploadProductImageFile(newProductId, imageFile);
                if (result.success) {
                    productData.image = result.imageUrl;
                    productData.imageUrl = result.imageUrl;
                }
            }
            
            // Save product data
            let success;
            if (productId) {
                success = await this.updateProductData(productId, productData);
            } else {
                success = await this.saveNewProductData(newProductId, productData);
            }
            
            if (success) {
                if (this.showNotification) {
                    this.showNotification(productId ? 'Product updated successfully' : 'Product added successfully', 'success');
                }
                document.querySelector('.modal-overlay').remove();
                await this.loadProductsData(); // Refresh table
                if (this.refreshFrontendData) {
                    this.refreshFrontendData(); // Refresh frontend
                }
            } else {
                throw new Error('Failed to save product data');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            if (this.showNotification) {
                this.showNotification(`Failed to save product: ${error.message}`, 'error');
            }
        }
    };

    /**
     * Save new product data to Firebase
     */
    AdminDashboard.prototype.saveNewProductData = async function(productId, productData) {
        try {
            console.log('💾 Saving new product to Firebase:', productId);
            await ensureFirebaseReady();
            
            const docRef = window.firebase.db.collection('products').doc(productId);
            await docRef.set({
                ...productData,
                createdAt: new Date(),
                updatedAt: new Date(),
                active: true
            });
            
            console.log('✅ New product saved to Firebase successfully');
            return true;
        } catch (error) {
            console.error('❌ Error saving new product to Firebase:', error);
            return false;
        }
    };

    // ==========================================
    // ENHANCED PRODUCT CRUD - Firebase Integration
    // ==========================================

    /**
     * Override loadProductsData with proper error handling
     */
    AdminDashboard.prototype.loadProductsData = async function() {
        if (this.loadingProducts) {
            console.log('⏳ Products already loading, skipping...');
            return this.productsData || [];
        }
        
        this.loadingProducts = true;
        
        try {
            console.log('🔄 Loading products data from Firebase...');
            await ensureFirebaseReady();

            const productsData = await window.firebaseDataService.getCollection('products');
            
            if (productsData && Object.keys(productsData).length > 0) {
                console.log('✅ Products data loaded from Firebase:', Object.keys(productsData).length, 'products');
                
                this.productsData = Object.entries(productsData).map(([id, data]) => ({
                    id,
                    name: data.name || '',
                    price: parseFloat(data.price) || 0,
                    retailPrice: parseFloat(data.retailPrice) || parseFloat(data.price) || 0,
                    msrp: parseFloat(data.msrp) || 0,
                    cost: parseFloat(data.cost) || 0,
                    category: data.category || '',
                    unitsPerCase: parseInt(data.unitsPerCase) || 1,
                    description: data.description || '',
                    image: data.image || data.imageUrl || '',
                    imageUrl: data.imageUrl || data.image || '',
                    active: data.active !== false,
                    ...data
                }));
                
                // Ensure image compatibility
                this.productsData.forEach(product => {
                    if (!product.image && product.imageUrl) {
                        product.image = product.imageUrl;
                    }
                    if (!product.imageUrl && product.image) {
                        product.imageUrl = product.image;
                    }
                    if (!product.image) {
                        product.image = '';
                    }
                });
                
                console.log('📊 Processed products array:', this.productsData.length, 'products');
                
                if (typeof this.renderProductsTable === 'function') {
                    this.renderProductsTable(this.productsData);
                    console.log('✅ Products table rendered successfully');
                }
            } else {
                console.warn('⚠️ No products data found in Firebase');
                this.productsData = [];
                if (typeof this.renderProductsTable === 'function') {
                    this.renderProductsTable([]);
                }
            }
            
            return this.productsData;
            
        } catch (error) {
            console.error('❌ Error loading products from Firebase:', error);
            this.productsData = [];
            
            if (typeof this.renderProductsError === 'function') {
                this.renderProductsError();
            }
            
            return [];
        } finally {
            this.loadingProducts = false;
        }
    };

    /**
     * Override deleteProduct with FIXED Firebase support and real-time UI refresh
     */
    AdminDashboard.prototype.deleteProduct = async function(productId) {
        // FIXED: Proper confirmation dialog
        const confirmed = confirm(`Are you sure you want to delete product "${productId}"?\n\nThis action cannot be undone and will remove the product from both the admin dashboard and the main application.`);
        if (!confirmed) return;

        try {
            console.log(`🗑️ Deleting product: ${productId}`);
            await ensureFirebaseReady();
            
            // Delete product from Firebase
            await window.firebase.db.collection('products').doc(productId).delete();
            
            // Delete product image from Firebase Storage if it exists
            try {
                if (window.firebaseStorageService?.deleteProductImage) {
                    await window.firebaseStorageService.deleteProductImage(productId);
                    console.log('✅ Product image deleted from Firebase Storage');
                }
            } catch (imageError) {
                console.warn('⚠️ Could not delete product image:', imageError.message);
            }
            
            console.log(`✅ Product ${productId} deleted successfully`);
            
            if (this.showNotification) {
                this.showNotification('Product deleted successfully', 'success');
            }
            
            // Clear cache and refresh UI immediately
            if (window.firebaseDataService?.clearCache) {
                window.firebaseDataService.clearCache('products');
            }
            
            // FIXED: Real-time UI refresh - reload and re-render table
            await this.loadProductsData();
            
            // Refresh frontend data
            if (this.refreshFrontendData) {
                this.refreshFrontendData();
            }
            
        } catch (error) {
            console.error('❌ Error deleting product:', error);
            
            if (this.showNotification) {
                this.showNotification(`Failed to delete product: ${error.message}`, 'error');
            }
        }
    };

    /**
     * Override updateProductData with FIXED Firebase support
     */
    AdminDashboard.prototype.updateProductData = async function(productId, fieldOrData, value) {
        try {
            console.log('🔄 Updating product data in Firebase...', { productId, fieldOrData, value });
            await ensureFirebaseReady();
            
            let updateData;
            
            if (typeof fieldOrData === 'string') {
                updateData = { [fieldOrData]: value };
            } else {
                updateData = fieldOrData;
            }
            
            // Type conversion for numeric fields
            if (updateData.price !== undefined) updateData.price = parseFloat(updateData.price) || 0;
            if (updateData.retailPrice !== undefined) updateData.retailPrice = parseFloat(updateData.retailPrice) || 0;
            if (updateData.msrp !== undefined) updateData.msrp = parseFloat(updateData.msrp) || 0;
            if (updateData.cost !== undefined) updateData.cost = parseFloat(updateData.cost) || 0;
            if (updateData.unitsPerCase !== undefined) updateData.unitsPerCase = parseInt(updateData.unitsPerCase) || 1;
            
            updateData.updatedAt = new Date();
            
            // Update in Firebase
            const docRef = window.firebase.db.collection('products').doc(productId);
            await docRef.update(updateData);
            
            console.log('✅ Product data updated in Firebase successfully');
            
            // Update local data
            if (this.productsData) {
                const existingIndex = this.productsData.findIndex(p => p.id === productId);
                if (existingIndex >= 0) {
                    Object.assign(this.productsData[existingIndex], updateData);
                }
            }
            
            // Clear cache and refresh UI
            if (window.firebaseDataService?.clearCache) {
                window.firebaseDataService.clearCache('products');
            }
            
            if (typeof this.renderProductsTable === 'function') {
                this.renderProductsTable(this.productsData);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error updating product data in Firebase:', error);
            return false;
        }
    };

    // ==========================================
    // TIERS MANAGEMENT - FIXED Firebase Integration
    // ==========================================

    /**
     * Override deleteTier with enhanced metadata field detection
     */
    AdminDashboard.prototype.deleteTier = async function(tierId) {
        // ENHANCED: Check for metadata/system fields more comprehensively
        const metadataFields = [
            'migratedAt', 'createdAt', 'updatedAt', 'timestamp', 
            'version', 'schema', 'meta', 'system', 'config',
            'lastModified', 'dateCreated', 'dateUpdated', 'migrated'
        ];
        
        // Check if this is a metadata field by exact match or contains check
        const isMetadataField = metadataFields.some(field => 
            tierId.toLowerCase() === field.toLowerCase() ||
            tierId.toLowerCase().includes(field.toLowerCase()) || 
            field.toLowerCase().includes(tierId.toLowerCase())
        );
        
        // Also check if the tier ID looks like a timestamp or system field
        const isSystemField = /^(created|updated|migrated|timestamp|date|meta|system|config)/i.test(tierId) ||
                             /\d{4}-\d{2}-\d{2}/.test(tierId) || // Date pattern
                             tierId.startsWith('_') || // Underscore prefix
                             tierId.includes('At') && tierId.length < 15; // Likely timestamp field
        
        if (isMetadataField || isSystemField) {
            console.warn(`⚠️ Attempted to delete metadata/system field: ${tierId}`);
            if (this.showNotification) {
                this.showNotification(`Cannot delete system/metadata field: ${tierId}`, 'error');
            }
            return;
        }
        
        // FIXED: Proper confirmation dialog
        const confirmed = confirm(`Are you sure you want to delete tier "${tierId}"?\n\nThis action cannot be undone and will affect pricing calculations.`);
        if (!confirmed) return;
        
        try {
            console.log(`🗑️ Deleting tier: ${tierId}`);
            await ensureFirebaseReady();
            
            const tiersData = await window.firebaseDataService.getDocument('pricing', 'tiers');
            
            if (!tiersData || !tiersData[tierId]) {
                throw new Error(`Tier ${tierId} not found`);
            }
            
            const tierName = tiersData[tierId].name || tierId;
            
            delete tiersData[tierId];
            
            await window.firebaseDataService.saveData('pricing/tiers', tiersData);
            
            console.log(`✅ Tier ${tierId} deleted successfully`);
            
            if (this.showNotification) {
                this.showNotification(`Tier "${tierName}" deleted successfully`, 'success');
            }
            
            // Clear cache and refresh UI immediately
            if (window.firebaseDataService?.clearCache) {
                window.firebaseDataService.clearCache('pricing/tiers');
            }
            
            // FIXED: Real-time UI refresh - reload and re-render table
            await this.loadTiersData();
            
            // Refresh frontend data
            if (this.refreshFrontendData) {
                this.refreshFrontendData();
            }
            
        } catch (error) {
            console.error('❌ Error deleting tier:', error);
            if (this.showNotification) {
                this.showNotification(`Failed to delete tier: ${error.message}`, 'error');
            }
        }
    };

    // ==========================================
    // SHIPPING MANAGEMENT - FIXED Firebase Integration
    // ==========================================

    /**
     * Override deleteShippingZone with FIXED confirmation dialog and real-time UI refresh
     */
    AdminDashboard.prototype.deleteShippingZone = async function(zoneId) {
        // FIXED: Proper confirmation dialog
        const confirmed = confirm(`Are you sure you want to delete shipping zone "${zoneId}"?\n\nThis action cannot be undone and will affect shipping calculations.`);
        if (!confirmed) return;
        
        try {
            console.log(`🗑️ Deleting shipping zone: ${zoneId}`);
            await ensureFirebaseReady();
            
            const shippingData = await window.firebaseDataService.getDocument('shipping', 'config');
            
            if (!shippingData || !shippingData.zones || !shippingData.zones[zoneId]) {
                throw new Error(`Shipping zone ${zoneId} not found`);
            }
            
            const zoneName = shippingData.zones[zoneId].name || zoneId;
            
            delete shippingData.zones[zoneId];
            
            await window.firebaseDataService.saveData('shipping/config', shippingData);
            
            console.log(`✅ Shipping zone ${zoneId} deleted successfully`);
            
            if (this.showNotification) {
                this.showNotification(`Shipping zone "${zoneName}" deleted successfully`, 'success');
            }
            
            // Clear cache and refresh UI immediately
            if (window.firebaseDataService?.clearCache) {
                window.firebaseDataService.clearCache('shipping/config');
            }
            
            // FIXED: Real-time UI refresh - reload and re-render table
            await this.loadShippingData();
            
            // Refresh frontend data
            if (this.refreshFrontendData) {
                this.refreshFrontendData();
            }
            
        } catch (error) {
            console.error('❌ Error deleting shipping zone:', error);
            if (this.showNotification) {
                this.showNotification(`Failed to delete shipping zone: ${error.message}`, 'error');
            }
        }
    };

    // ==========================================
    // EDIT FUNCTIONALITY - FIXED Event Handlers
    // ==========================================

    /**
     * FIXED: Enhanced edit product modal with proper Firebase data loading
     */
    AdminDashboard.prototype.editProduct = async function(productId) {
        console.log(`✏️ Editing product: ${productId}`);
        
        try {
            await ensureFirebaseReady();
            
            // Use the enhanced showProductEditModal which handles Firebase data loading internally
            this.showProductEditModal(productId);
            
        } catch (error) {
            console.error('❌ Error loading product for edit:', error);
            if (this.showNotification) {
                this.showNotification(`Failed to load product: ${error.message}`, 'error');
            }
        }
    };

    /**
     * FIXED: Enhanced edit tier functionality
     */
    AdminDashboard.prototype.editTier = async function(tierId) {
        console.log(`✏️ Editing tier: ${tierId}`);
        
        try {
            await ensureFirebaseReady();
            
            // Load current tier data from Firebase
            const tiersData = await window.firebaseDataService.getDocument('pricing', 'tiers');
            
            if (!tiersData || !tiersData[tierId]) {
                throw new Error(`Tier ${tierId} not found`);
            }
            
            const tierData = tiersData[tierId];
            
            // FIXED: Call the existing modal method with current data
            if (typeof this.showTierModal === 'function') {
                this.showTierModal(tierId, tierData);
            } else {
                console.error('❌ No tier edit modal method found');
                this.showNotification('Tier edit modal not available', 'error');
            }
            
        } catch (error) {
            console.error('❌ Error loading tier for edit:', error);
            if (this.showNotification) {
                this.showNotification(`Failed to load tier: ${error.message}`, 'error');
            }
        }
    };

    /**
     * FIXED: Enhanced edit shipping zone functionality
     */
    AdminDashboard.prototype.editShippingZone = async function(zoneId) {
        console.log(`✏️ Editing shipping zone: ${zoneId}`);
        
        try {
            await ensureFirebaseReady();
            
            // Load current shipping data from Firebase
            const shippingData = await window.firebaseDataService.getDocument('shipping', 'config');
            
            if (!shippingData || !shippingData.zones || !shippingData.zones[zoneId]) {
                throw new Error(`Shipping zone ${zoneId} not found`);
            }
            
            const zoneData = shippingData.zones[zoneId];
            
            // FIXED: Call the existing modal method with current data
            if (typeof this.showShippingModal === 'function') {
                this.showShippingModal(zoneId, zoneData);
            } else if (typeof this.showShippingZoneModal === 'function') {
                this.showShippingZoneModal(zoneId);
            } else {
                console.error('❌ No shipping zone edit modal method found');
                this.showNotification('Shipping zone edit modal not available', 'error');
            }
            
        } catch (error) {
            console.error('❌ Error loading shipping zone for edit:', error);
            if (this.showNotification) {
                this.showNotification(`Failed to load shipping zone: ${error.message}`, 'error');
            }
        }
    };

    // ==========================================
    // GLOBAL FUNCTION BINDINGS - FIXED
    // ==========================================

    /**
     * FIXED: Ensure proper function binding after AdminDashboard initialization
     */
    const originalInit = AdminDashboard.prototype.init;
    AdminDashboard.prototype.init = async function() {
        try {
            console.log('🔄 Initializing AdminDashboard with ENHANCED Firebase integration...');
            
            // Call original init
            if (originalInit) {
                originalInit.call(this);
            }
            
            // FIXED: Ensure Firebase is ready before binding functions
            await ensureFirebaseReady();
            
            // FIXED: Properly bind functions to global admin dashboard instance
            window.adminDashboard = this;
            
            // Ensure RingCentral methods are bound to global instance
            if (this.viewRingCentralStatus) {
                window.adminDashboard.viewRingCentralStatus = this.viewRingCentralStatus.bind(this);
            }
            if (this.sendRingCentralTestWebhook) {
                window.adminDashboard.sendRingCentralTestWebhook = this.sendRingCentralTestWebhook.bind(this);
            }
            if (this.startRingCentralOAuth) {
                window.adminDashboard.startRingCentralOAuth = this.startRingCentralOAuth.bind(this);
            }
            if (this.saveRingCentralSettings) {
                window.adminDashboard.saveRingCentralSettings = this.saveRingCentralSettings.bind(this);
            }
            
            console.log('✅ AdminDashboard initialized with ENHANCED Firebase integration');
        } catch (error) {
            console.error('❌ Error initializing AdminDashboard with Firebase:', error);
        }
    };

    // ==========================================
    // LEGACY OVERRIDE METHODS - KEEP COMPATIBILITY
    // ==========================================

    /**
     * Override saveDataToGit to redirect to Firebase
     */
    AdminDashboard.prototype.saveDataToGit = async function(filename, data) {
        console.log('🔄 Intercepting legacy Git save, redirecting to Firebase...', filename);
        
        try {
            await ensureFirebaseReady();
            
            const firestoreMapping = {
                'products.json': { path: 'products', isCollection: true },
                'tiers.json': { path: 'pricing/tiers' },
                'shipping.json': { path: 'shipping/config' },
                'payment.json': { path: 'payment/config' },
                'admin-emails.json': { path: 'admin/emails' },
                'email-templates.json': { path: 'templates/email-config' },
                'connections.json': { path: 'integrations/connections' }
            };
            
            const mapping = firestoreMapping[filename];
            if (!mapping) {
                throw new Error(`Unknown file mapping for ${filename}`);
            }
            
            if (mapping.isCollection) {
                const batch = window.firebase.db.batch();
                for (const [itemId, itemData] of Object.entries(data)) {
                    const docRef = window.firebase.db.collection('products').doc(itemId);
                    batch.set(docRef, {
                        ...itemData,
                        updatedAt: new Date()
                    }, { merge: true });
                }
                await batch.commit();
            } else {
                await window.firebaseDataService.saveData(mapping.path, data);
            }
            
            console.log(`✅ Successfully saved ${filename} to Firebase`);
            return { success: true, message: 'Data saved to Firebase successfully' };
            
        } catch (error) {
            console.error(`❌ Error saving ${filename} to Firebase:`, error);
            return { success: false, message: error.message };
        }
    };

    // ==========================================
    // FIXED INLINE EDITING - Shipping Zone Support
    // ==========================================

    /**
     * Override startInlineEdit to properly handle shipping zones and other data types
     */
    AdminDashboard.prototype.startInlineEdit = function(cell) {
        if (cell.querySelector('input')) return; // Already editing
        
        const originalValue = cell.textContent.replace('$', '').replace('%', '').trim();
        const field = cell.dataset.field;
        
        // FIXED: Properly determine item ID based on current section and data attributes
        let itemId;
        const row = cell.closest('tr');
        
        if (this.currentSection === 'products') {
            itemId = cell.dataset.id || row.dataset.productId || row.dataset.id;
        } else if (this.currentSection === 'tiers') {
            itemId = cell.dataset.id || row.dataset.tierId || row.dataset.id;
        } else if (this.currentSection === 'shipping') {
            itemId = cell.dataset.id || row.dataset.zoneId || row.dataset.id;
        } else {
            itemId = cell.dataset.id || row.dataset.id;
        }
        
        console.log(`🔧 Starting inline edit for ${this.currentSection}:`, { itemId, field, originalValue });
        
        if (!itemId) {
            console.error('❌ No item ID found for inline editing');
            this.showNotification('Unable to edit: No item ID found', 'error');
            return;
        }
        
        // Store original value for restoration
        cell.dataset.originalValue = originalValue;
        
        // Create input element
        const input = document.createElement('input');
        
        // Set input type based on field
        if (field === 'price' || field === 'msrp' || field === 'cost' || field === 'retailPrice' || 
            field.includes('Rate') || field.includes('Cases') || field === 'threshold') {
            input.type = 'number';
            input.step = field.includes('Percentage') || field.includes('Rate') ? '0.01' : '0.01';
        } else if (field === 'unitsPerCase' || field === 'zoneNumber') {
            input.type = 'number';
            input.step = '1';
        } else {
            input.type = 'text';
        }
        
        input.value = originalValue;
        input.className = 'inline-edit-input';
        
        // Replace cell content with input
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        // Handle save on Enter or blur
        const saveEdit = async () => {
            const newValue = input.value.trim();
            if (newValue !== originalValue) {
                console.log(`💾 Saving inline edit: ${itemId}.${field} = ${newValue}`);
                await this.saveInlineEdit(itemId, field, newValue, cell);
            } else {
                // Restore original value
                const displayValue = field.includes('price') || field.includes('cost') || field.includes('Rate') ? 
                    (field.includes('Percentage') || field.includes('Rate') ? `${originalValue}%` : `$${originalValue}`) : originalValue;
                cell.textContent = displayValue;
            }
        };
        
        // Handle cancel on Escape
        const cancelEdit = () => {
            const displayValue = field.includes('price') || field.includes('cost') || field.includes('Rate') ? 
                (field.includes('Percentage') || field.includes('Rate') ? `${originalValue}%` : `$${originalValue}`) : originalValue;
            cell.textContent = displayValue;
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    };

    /**
     * Override updateShippingData to fix the undefined zone ID issue
     */
    AdminDashboard.prototype.updateShippingData = async function(zoneId, field, newValue) {
        try {
            console.log(`🔄 Updating shipping zone ${zoneId} field ${field} to: ${newValue}`);
            
            if (!zoneId || zoneId === 'undefined') {
                throw new Error('Invalid zone ID provided for shipping update');
            }
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            await ensureFirebaseReady();
            
            // Get current shipping data from Firebase
            const shippingData = await window.firebaseDataService.getDocument('shipping/config');
            
            if (!shippingData || !shippingData.zones || !shippingData.zones[zoneId]) {
                throw new Error(`Shipping zone ${zoneId} not found in Firebase`);
            }
            
            // Update the specific field with proper type conversion
            const updatedShippingData = { ...shippingData };
            
            if (field === 'ltlPercentage' || field.includes('Percentage')) {
                updatedShippingData.zones[zoneId][field] = parseFloat(newValue);
            } else if (field.includes('Rate') || field.includes('Cases') || field === 'price') {
                updatedShippingData.zones[zoneId][field] = parseFloat(newValue);
            } else if (field === 'states') {
                // Convert comma-separated string to array
                updatedShippingData.zones[zoneId][field] = newValue.split(',').map(s => s.trim());
            } else {
                updatedShippingData.zones[zoneId][field] = newValue;
            }
            
            console.log(`📝 Updated shipping zone:`, updatedShippingData.zones[zoneId]);
            
            // Save to Firebase
            const success = await window.firebaseDataService.saveData('shipping/config', updatedShippingData);
            
            if (success) {
                console.log('✅ Shipping data saved to Firebase successfully');
                
                // Clear cache to force refresh
                window.firebaseDataService.clearCache('shipping/config');
                
                return true;
            } else {
                throw new Error('Failed to save to Firebase');
            }
            
        } catch (error) {
            console.error('❌ Error updating shipping data:', error);
            return false;
        }
    };

    /**
     * Enhanced saveProductForm with real-time UI refresh after save
     */
    const originalSaveProductForm = AdminDashboard.prototype.saveProductForm;
    AdminDashboard.prototype.saveProductForm = async function(productId, imageFile) {
        try {
            // Call the original save method
            const result = await originalSaveProductForm.call(this, productId, imageFile);
            
            // FIXED: Real-time UI refresh after successful save
            if (result !== false) {
                console.log('🔄 Refreshing UI after product save...');
                
                // Clear cache and reload products data
                if (window.firebaseDataService?.clearCache) {
                    window.firebaseDataService.clearCache('products');
                }
                
                // Reload products data to refresh table with new/updated data
                await this.loadProductsData();
                
                // Refresh frontend data
                if (this.refreshFrontendData) {
                    this.refreshFrontendData();
                }
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error in enhanced saveProductForm:', error);
            throw error;
        }
    };

    /**
     * Override loadTiersData to filter out metadata fields from UI display
     */
    AdminDashboard.prototype.loadTiersData = async function() {
        try {
            console.log('📊 Loading tiers data from Firebase...');
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            await ensureFirebaseReady();
            
            // Get tiers data from Firebase
            const tiersData = await window.firebaseDataService.getDocument('pricing/tiers');
            
            if (tiersData && Object.keys(tiersData).length > 0) {
                // FIXED: Filter out metadata/system fields from UI display
                const metadataFields = [
                    'createdAt', 'updatedAt', 'migratedAt', 'timestamp', 
                    'version', 'schema', 'meta', 'system', 'config',
                    'lastModified', 'dateCreated', 'dateUpdated', 'migrated'
                ];
                
                // Convert object to array format, filtering out metadata fields
                this.tiersData = Object.entries(tiersData)
                    .filter(([id, tier]) => {
                        // Filter out metadata fields and system fields
                        const isMetadataField = metadataFields.some(field => 
                            id.toLowerCase() === field.toLowerCase() ||
                            id.toLowerCase().includes(field.toLowerCase()) || 
                            field.toLowerCase().includes(id.toLowerCase())
                        );
                        
                        // Also filter out fields that look like timestamps or system fields
                        const isSystemField = /^(created|updated|migrated|timestamp|date|meta|system|config)/i.test(id) ||
                                             /\d{4}-\d{2}-\d{2}/.test(id) || // Date pattern
                                             id.startsWith('_') || // Underscore prefix
                                             id.includes('At') && id.length < 15; // Likely timestamp field
                        
                        // Only include actual tier data (not metadata)
                        return !isMetadataField && !isSystemField && typeof tier === 'object' && tier !== null;
                    })
                    .map(([id, tier]) => ({
                        id,
                        name: tier.name || '',
                        minQuantity: tier.minQuantity || tier.threshold || 0,
                        discount: tier.discount || tier.margin || '0%',
                        description: tier.description || '',
                        active: tier.active !== false,
                        ...tier
                    }));
                
                console.log('✅ Tiers data loaded (filtered):', this.tiersData.length, 'tiers');
                console.log('🔍 Filtered out metadata fields, showing only actual tiers');
                this.renderTiersTable(this.tiersData);
            } else {
                console.log('ℹ️ No tiers data found');
                this.tiersData = [];
                this.renderTiersTable([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading tiers data:', error);
            this.renderTiersError();
        }
    };

    /**
     * Override loadShippingData to filter out metadata fields from UI display
     */
    AdminDashboard.prototype.loadShippingData = async function() {
        try {
            console.log('🚚 Loading shipping data from Firebase...');
            
            if (!window.firebaseDataService) {
                throw new Error('Firebase Data Service not available');
            }
            
            await ensureFirebaseReady();
            
            // Get shipping data from Firebase
            const shippingData = await window.firebaseDataService.getDocument('shipping/config');
            
            if (shippingData && shippingData.zones && Object.keys(shippingData.zones).length > 0) {
                // FIXED: Filter out metadata fields from zones display
                const metadataFields = [
                    'createdAt', 'updatedAt', 'migratedAt', 'timestamp', 
                    'version', 'schema', 'meta', 'system', 'config',
                    'lastModified', 'dateCreated', 'dateUpdated', 'migrated'
                ];
                
                // Convert zones object to array format, filtering out metadata
                this.shippingData = Object.entries(shippingData.zones)
                    .filter(([id, zone]) => {
                        // Filter out metadata fields
                        const isMetadataField = metadataFields.some(field => 
                            id.toLowerCase() === field.toLowerCase() ||
                            id.toLowerCase().includes(field.toLowerCase()) || 
                            field.toLowerCase().includes(id.toLowerCase())
                        );
                        
                        // Also filter out system fields
                        const isSystemField = /^(created|updated|migrated|timestamp|date|meta|system|config)/i.test(id) ||
                                             /\d{4}-\d{2}-\d{2}/.test(id) ||
                                             id.startsWith('_') ||
                                             id.includes('At') && id.length < 15;
                        
                        // Only include actual shipping zones
                        return !isMetadataField && !isSystemField && typeof zone === 'object' && zone !== null;
                    })
                    .map(([id, zone]) => ({
                        id,
                        name: zone.name || id,
                        states: zone.states || [],
                        groundRates: zone.groundRates || {},
                        ltlPercentage: zone.ltlPercentage || 0,
                        active: zone.active !== false,
                        ...zone
                    }));
                
                console.log('✅ Shipping data loaded (filtered):', this.shippingData.length, 'zones');
                console.log('🔍 Filtered out metadata fields, showing only actual shipping zones');
                this.renderShippingTable(this.shippingData);
            } else {
                console.log('ℹ️ No shipping data found');
                this.shippingData = [];
                this.renderShippingTable([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading shipping data:', error);
            this.renderShippingError();
        }
    };

    console.log('🔥 ENHANCED AdminDashboard Firebase patch loaded successfully!');

})();