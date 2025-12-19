/**
 * Firebase Storage Service - Fixed Version
 * Handles image uploads, resizing, and deletions for product images
 */

class FirebaseStorageService {
    constructor() {
        this.storage = null;
        this.auth = null;
        this.initialized = false;
        this.initPromise = null;
        console.log('🔥 Firebase Storage Service initializing...');
    }

    /**
     * Initialize the storage service
     */
    async initialize() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    async _doInitialize() {
        try {
            // Wait for Firebase config to be loaded with timeout
            let attempts = 0;
            while ((!window.firebase || !window.firebase.storage) && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.firebase || !window.firebase.storage) {
                throw new Error('Firebase configuration not available after 5 seconds');
            }
            
            // Use the pre-initialized Firebase services from config
            this.storage = window.firebase.storage;
            this.auth = window.firebase.auth;
            
            // Initialize auth if needed
            if (window.firebase.initializeAuth) {
                await window.firebase.initializeAuth();
            }
            
            this.initialized = true;
            console.log('📁 Firebase Storage Service initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Firebase Storage Service:', error);
            this.initialized = false;
            throw error;
        }
    }

    /**
     * Resize image to specified dimensions
     */
    async resizeImage(file, maxWidth = 400, maxHeight = 400, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions maintaining aspect ratio
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;

                // Draw and resize image
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob
                canvas.toBlob(resolve, 'image/png', quality);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Upload product image to Firebase Storage
     */
    async uploadProductImage(productId, file) {
        await this.initialize();

        try {
            console.log('📤 Uploading product image to Firebase Storage...', { productId, fileName: file.name });

            // Resize image
            const resizedBlob = await this.resizeImage(file, 400, 400, 0.8);
            
            // Create storage reference
            const timestamp = Date.now();
            const fileName = `${productId}_${timestamp}.png`;
            const storageRef = this.storage.ref(`product-images/${fileName}`);

            // Upload image with metadata
            const snapshot = await storageRef.put(resizedBlob, {
                contentType: 'image/png',
                customMetadata: {
                    productId: productId,
                    uploadedAt: new Date().toISOString(),
                    originalName: file.name
                }
            });

            // Get download URL
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            console.log('✅ Product image uploaded successfully:', downloadURL);
            return downloadURL;

        } catch (error) {
            console.error('❌ Error uploading product image:', error);
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }

    /**
     * Get product image URL from Firebase Storage
     */
    async getProductImageUrl(productId) {
        await this.initialize();

        try {
            console.log('🔍 Getting product image URL from Firebase Storage...', productId);

            // Try to find files that start with the productId by listing the directory
            try {
                const listRef = this.storage.ref('product-images');
                const listResult = await listRef.listAll();
                
                // Find files that start with the productId
                const matchingFile = listResult.items.find(item => 
                    item.name.startsWith(`${productId}_`) || 
                    item.name === `${productId}.png` || 
                    item.name === `${productId}.jpg` || 
                    item.name === `${productId}.jpeg` ||
                    item.name === `${productId}.webp`
                );

                if (matchingFile) {
                    const downloadURL = await matchingFile.getDownloadURL();
                    console.log('✅ Product image URL found:', downloadURL);
                    return downloadURL;
                }
            } catch (listError) {
                console.log('ℹ️ Could not list storage directory, trying direct paths...', listError.message);
            }

            // Try direct paths as fallback
            const possiblePaths = [
                `product-images/${productId}.png`,
                `product-images/${productId}.jpg`,
                `product-images/${productId}.jpeg`,
                `product-images/${productId}.webp`
            ];

            for (const path of possiblePaths) {
                try {
                    const storageRef = this.storage.ref(path);
                    const downloadURL = await storageRef.getDownloadURL();
                    console.log('✅ Product image URL found at:', path, downloadURL);
                    return downloadURL;
                } catch (error) {
                    // Continue to next path if this one doesn't exist
                    continue;
                }
            }

            console.log('ℹ️ No product image found for:', productId);
            return null;

        } catch (error) {
            console.error('❌ Error getting product image URL:', error);
            return null;
        }
    }

    /**
     * Delete a product image from Firebase Storage
     */
    async deleteProductImage(productId) {
        await this.initialize();
        
        try {
            console.log('🗑️ Deleting product image from Firebase Storage:', productId);
            
            // First try to find existing images by listing the directory
            try {
                const listRef = this.storage.ref('product-images');
                const listResult = await listRef.listAll();
                
                // Find all files that start with the productId
                const matchingFiles = listResult.items.filter(item => 
                    item.name.startsWith(`${productId}_`) || 
                    item.name === `${productId}.png` || 
                    item.name === `${productId}.jpg` || 
                    item.name === `${productId}.jpeg` ||
                    item.name === `${productId}.webp`
                );

                let deleted = false;
                for (const file of matchingFiles) {
                    try {
                        await file.delete();
                        console.log(`✅ Product image deleted: ${file.name}`);
                        deleted = true;
                    } catch (error) {
                        console.warn(`⚠️ Error deleting ${file.name}:`, error.message);
                    }
                }
                
                if (deleted) {
                    return true;
                }
            } catch (listError) {
                console.log('ℹ️ Could not list storage directory for deletion, trying direct paths...');
            }
            
            // Fallback to trying direct paths
            const possiblePaths = [
                `product-images/${productId}.png`,
                `product-images/${productId}.jpg`,
                `product-images/${productId}.jpeg`,
                `product-images/${productId}.webp`
            ];
            
            let deleted = false;
            for (const imagePath of possiblePaths) {
                try {
                    const imageRef = this.storage.ref(imagePath);
                    await imageRef.delete();
                    console.log(`✅ Product image deleted: ${imagePath}`);
                    deleted = true;
                    break; // Stop after first successful deletion
                } catch (error) {
                    // Image doesn't exist at this path, try next one
                    if (error.code !== 'storage/object-not-found') {
                        console.warn(`⚠️ Error deleting ${imagePath}:`, error.message);
                    }
                }
            }
            
            if (!deleted) {
                console.log('ℹ️ No product image found to delete for:', productId);
            }
            
            return deleted;
            
        } catch (error) {
            console.error('❌ Error deleting product image:', error);
            throw error;
        }
    }

    /**
     * Delete product image by URL
     */
    async deleteProductImageByUrl(imageUrl) {
        try {
            console.log('🗑️ Deleting product image by URL...', imageUrl);

            // Extract path from URL
            const url = new URL(imageUrl);
            const pathMatch = url.pathname.match(/\/b\/[^\/]+\/o\/(.+)\?/);
            
            if (!pathMatch) {
                throw new Error('Invalid Firebase Storage URL');
            }

            const imagePath = decodeURIComponent(pathMatch[1]);
            const storageRef = this.storage.ref(imagePath);

            // Delete image
            await storageRef.delete();
            
            console.log('✅ Product image deleted successfully by URL');
            return true;

        } catch (error) {
            console.error('❌ Error deleting product image by URL:', error);
            
            // Don't throw error if image doesn't exist
            if (error.code === 'storage/object-not-found') {
                console.log('ℹ️ Product image not found (may have already been deleted)');
                return true;
            }
            
            throw new Error(`Failed to delete image: ${error.message}`);
        }
    }

    /**
     * List all product images
     */
    async listProductImages() {
        try {
            await this.initialize();
            
            const listRef = this.storage.ref('product-images');
            const result = await listRef.listAll();
            
            const images = await Promise.all(
                result.items.map(async (imageRef) => {
                    const url = await imageRef.getDownloadURL();
                    const metadata = await imageRef.getMetadata();
                    return {
                        name: imageRef.name,
                        url: url,
                        metadata: metadata
                    };
                })
            );

            console.log('📋 Listed product images:', images.length);
            return images;

        } catch (error) {
            console.error('❌ Error listing product images:', error);
            throw new Error(`Failed to list images: ${error.message}`);
        }
    }
}

// Create singleton instance
const firebaseStorageService = new FirebaseStorageService();

// Expose globally for legacy scripts
if (typeof window !== 'undefined') {
    window.firebaseStorageService = firebaseStorageService;
    console.log('🌐 FirebaseStorageService exposed globally');
}

console.log('🔥 Firebase Storage Service loaded');