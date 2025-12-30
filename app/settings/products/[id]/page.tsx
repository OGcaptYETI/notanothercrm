'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, storage } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Save, Package, DollarSign, Barcode, Box, Image as ImageIcon, Upload, X, Star } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AdminProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activePricingTab, setActivePricingTab] = useState<'retail' | 'wholesale' | 'distribution'>('retail');
  const [parentProducts, setParentProducts] = useState<any[]>([]);
  const [loadingParent, setLoadingParent] = useState(false);

  useEffect(() => {
    loadProduct();
    loadParentProducts();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const data = { id: productDoc.id, ...productDoc.data() };
        setProduct(data);
        setFormData(data);
      } else {
        toast.error('Product not found');
        router.push('/settings?tab=products');
      }
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      product: {
        ...prev.product,
        [field]: value
      },
      [field]: value
    }));
  };

  const handleNestedInputChange = (parent: string, child: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [child]: value
      }
    }));
  };

  // Calculate margin: ((Selling Price - Cost) / Selling Price) * 100
  const calculateMargin = (cost: number, sellingPrice: number): string => {
    if (!cost || !sellingPrice || sellingPrice === 0) return '';
    const margin = ((sellingPrice - cost) / sellingPrice) * 100;
    return margin.toFixed(2) + '%';
  };

  // Calculate selling price from cost and margin: Cost / (1 - Margin%)
  const calculateSellingPrice = (cost: number, marginPercent: string): number => {
    if (!cost || !marginPercent) return 0;
    const margin = parseFloat(marginPercent.replace('%', '')) / 100;
    if (margin >= 1) return 0;
    return cost / (1 - margin);
  };

  const loadParentProducts = async () => {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setParentProducts(products);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const copyFromParent = async () => {
    if (!formData.parentSku) {
      toast.error('Please select a parent SKU first');
      return;
    }

    setLoadingParent(true);
    try {
      const parentProduct = parentProducts.find(p => p.productNum === formData.parentSku);
      if (!parentProduct) {
        toast.error('Parent product not found');
        return;
      }

      const copiedImages = parentProduct.images || [];
      
      setFormData((prev: any) => ({
        ...prev,
        productDescription: parentProduct.productDescription,
        category: parentProduct.category,
        productType: parentProduct.productType,
        images: copiedImages,
        // Don't copy imageUrl - let user select the correct main image for this SKU
        imageUrl: copiedImages.length > 0 ? copiedImages[0] : prev.imageUrl,
        size: parentProduct.size,
        uom: parentProduct.uom,
        notes: parentProduct.notes,
        pricing: parentProduct.pricing,
        // Unit Configuration
        unitsPerCase: parentProduct.unitsPerCase,
        displayBoxesPerCase: parentProduct.displayBoxesPerCase,
        unitsPerDisplayBox: parentProduct.unitsPerDisplayBox,
        casesPerPallet: parentProduct.casesPerPallet,
        // UPC Codes
        upc: parentProduct.upc,
        // Dimensions
        masterCaseDimensions: parentProduct.masterCaseDimensions,
        displayBoxDimensions: parentProduct.displayBoxDimensions
      }));

      // Reset to first image so user can select the correct one
      setSelectedImageIndex(0);

      toast.success('Copied shared fields from parent SKU. Select the correct main image for this product.');
    } catch (error) {
      console.error('Error copying from parent:', error);
      toast.error('Failed to copy from parent');
    } finally {
      setLoadingParent(false);
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newImageUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        // Upload to Firebase Storage (product-images bucket)
        const timestamp = Date.now();
        const fileName = `${productId}_${timestamp}_${i}.${file.name.split('.').pop()}`;
        const storageRef = ref(storage, `product-images/${fileName}`);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        
        newImageUrls.push(downloadUrl);
      }

      const currentImages = formData.images || (formData.imageUrl ? [formData.imageUrl] : []);
      const updatedImages = [...currentImages, ...newImageUrls];

      setFormData((prev: any) => ({
        ...prev,
        images: updatedImages,
        imageUrl: updatedImages[0] // Keep first image as main for backward compatibility
      }));

      toast.success(`${newImageUrls.length} image(s) uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleImageUpload(e.target.files);
    }
  };

  const removeImage = (index: number) => {
    const currentImages = formData.images || [];
    const updatedImages = currentImages.filter((_: any, i: number) => i !== index);
    
    setFormData((prev: any) => ({
      ...prev,
      images: updatedImages,
      imageUrl: updatedImages[0] || null
    }));

    if (selectedImageIndex >= updatedImages.length) {
      setSelectedImageIndex(Math.max(0, updatedImages.length - 1));
    }

    toast.success('Image removed');
  };

  const setMainImage = (index: number) => {
    const currentImages = formData.images || [];
    if (index >= 0 && index < currentImages.length) {
      const reorderedImages = [
        currentImages[index],
        ...currentImages.filter((_: any, i: number) => i !== index)
      ];
      
      setFormData((prev: any) => ({
        ...prev,
        images: reorderedImages,
        imageUrl: reorderedImages[0]
      }));

      setSelectedImageIndex(0);
      toast.success('Main image updated');
    }
  };

  const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefinedValues).filter(v => v !== undefined);
    
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null) {
          const cleanedValue = removeUndefinedValues(value);
          if (cleanedValue !== null && Object.keys(cleanedValue).length > 0) {
            cleaned[key] = cleanedValue;
          }
        } else {
          cleaned[key] = value;
        }
      }
    });
    return cleaned;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        ...formData,
        updatedAt: new Date().toISOString()
      };
      delete updateData.id;
      delete updateData.createdAt;

      // Remove undefined values to prevent Firestore errors
      const cleanedData = removeUndefinedValues(updateData);

      await updateDoc(doc(db, 'products', productId), cleanedData);
      toast.success('Product updated successfully!');
      setProduct({ ...product, ...cleanedData });
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#93D500] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/settings?tab=products"
              className="btn btn-ghost flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Products
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
              <p className="text-sm text-gray-600 mt-1">
                Product ID: {product.productNum}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Product Image Gallery */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#93D500]" />
            Product Images
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Image Viewer */}
            <div className="lg:col-span-2">
              {(() => {
                const images = formData.images || (formData.imageUrl ? [formData.imageUrl] : []);
                return images.length > 0 ? (
                  <div className="relative aspect-square bg-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden">
                    <img
                      src={images[selectedImageIndex]}
                      alt={formData.productDescription}
                      className="w-full h-full object-contain"
                    />
                    {selectedImageIndex === 0 && (
                      <div className="absolute top-2 left-2 bg-[#93D500] text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" />
                        Main Image
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <ImageIcon className="w-16 h-16 mx-auto mb-2" />
                      <p className="text-sm">No images uploaded</p>
                    </div>
                  </div>
                );
              })()}

              {/* Thumbnail Strip */}
              {(() => {
                const images = formData.images || (formData.imageUrl ? [formData.imageUrl] : []);
                return images.length > 0 && (
                  <div className="flex gap-4 mt-4 overflow-x-auto pb-3 pt-4 px-4">
                    {images.map((img: string, index: number) => (
                      <div key={index} className="relative flex-shrink-0 mb-3">
                        <button
                          onClick={() => setSelectedImageIndex(index)}
                          className={`w-20 h-20 rounded-lg border-2 overflow-hidden transition-all ${
                            selectedImageIndex === index
                              ? 'border-[#93D500] ring-2 ring-[#93D500] ring-opacity-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <img
                            src={img}
                            alt={`Product ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                        {index === 0 && (
                          <div className="absolute -top-1 -right-1 bg-[#93D500] rounded-full p-1">
                            <Star className="w-3 h-3 text-white fill-white" />
                          </div>
                        )}
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {index !== 0 && (
                          <button
                            onClick={() => setMainImage(index)}
                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white border border-gray-300 text-gray-600 rounded-full p-1 hover:bg-[#93D500] hover:text-white hover:border-[#93D500] transition-colors text-xs"
                            title="Set as main image"
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Upload Area */}
            <div>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? 'border-[#93D500] bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="file"
                  id="image-upload"
                  multiple
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer block"
                >
                  <Upload className={`w-12 h-12 mx-auto mb-3 ${dragActive ? 'text-[#93D500]' : 'text-gray-400'}`} />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {uploading ? 'Uploading...' : 'Drop images here'}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">or click to browse</p>
                  <div className="btn btn-sm btn-secondary">
                    Choose Files
                  </div>
                </label>
              </div>

              <div className="mt-4 text-xs text-gray-600 space-y-1">
                <p>• Upload multiple images</p>
                <p>• First image is the main image</p>
                <p>• Click thumbnails to view</p>
                <p>• Click star to set as main</p>
                <p>• Click X to remove</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#93D500]" />
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Product Number</label>
                <input
                  type="text"
                  value={formData.productNum || ''}
                  onChange={(e) => handleInputChange('productNum', e.target.value)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  type="text"
                  value={formData.productDescription || ''}
                  onChange={(e) => handleInputChange('productDescription', e.target.value)}
                  className="input input-bordered w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="label">Product Type</label>
                  <input
                    type="text"
                    value={formData.productType || ''}
                    onChange={(e) => handleInputChange('productType', e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
              </div>

              {/* Product Family Section */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Family (Optional)</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label text-sm">Variant Type</label>
                      <select
                        value={formData.variantType || ''}
                        onChange={(e) => handleInputChange('variantType', e.target.value)}
                        className="select select-bordered w-full"
                      >
                        <option value="">Not Set</option>
                        <option value="unit">Unit</option>
                        <option value="box">Box/Case Pack</option>
                        <option value="mastercase">Master Case</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-sm">Parent SKU</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.parentSku || ''}
                          onChange={(e) => handleInputChange('parentSku', e.target.value)}
                          className="input input-bordered w-full"
                          placeholder="e.g., KB-2000"
                          list="parent-skus"
                        />
                        <datalist id="parent-skus">
                          {parentProducts.map(p => (
                            <option key={p.id} value={p.productNum}>
                              {p.productDescription}
                            </option>
                          ))}
                        </datalist>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {parentProducts.length} products available
                      </p>
                    </div>
                  </div>
                  {formData.parentSku && (
                    <button
                      onClick={copyFromParent}
                      disabled={loadingParent}
                      className="btn btn-sm btn-outline btn-primary w-full"
                    >
                      {loadingParent ? 'Copying...' : '📋 Copy Shared Fields from Parent SKU'}
                    </button>
                  )}
                  <p className="text-xs text-gray-500">
                    Link related SKUs (Unit/Box/MasterCase) by setting a parent SKU. This helps organize product families without affecting commissions or existing data.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Size</label>
                  <input
                    type="text"
                    value={formData.size || ''}
                    onChange={(e) => handleInputChange('size', e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="label">UOM</label>
                  <input
                    type="text"
                    value={formData.uom || ''}
                    onChange={(e) => handleInputChange('uom', e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={3}
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive || false}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                  <span className="label-text">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.quarterlyBonusEligible || false}
                    onChange={(e) => handleInputChange('quarterlyBonusEligible', e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                  <span className="label-text">Quarterly Bonus Eligible</span>
                </label>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#93D500]" />
              Pricing Models
            </h2>
            
            {/* Pricing Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              <button
                onClick={() => setActivePricingTab('retail')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activePricingTab === 'retail'
                    ? 'border-[#93D500] text-[#93D500]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Retail
              </button>
              <button
                onClick={() => setActivePricingTab('wholesale')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activePricingTab === 'wholesale'
                    ? 'border-[#93D500] text-[#93D500]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Wholesale
              </button>
              <button
                onClick={() => setActivePricingTab('distribution')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activePricingTab === 'distribution'
                    ? 'border-[#93D500] text-[#93D500]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Distribution
              </button>
            </div>

            {/* Retail Pricing */}
            {activePricingTab === 'retail' && (
              <div className="space-y-4">
                <div>
                  <label className="label">Unit Price (Cost)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.pricing?.retail?.unit || formData.retailPrice || ''}
                    onChange={(e) => handleNestedInputChange('pricing', 'retail', { ...formData.pricing?.retail, unit: parseFloat(e.target.value) || 0 })}
                    className="input input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="label">MSRP (Selling Price)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.pricing?.retail?.msrp || formData.msrp || ''}
                    onChange={(e) => handleNestedInputChange('pricing', 'retail', { ...formData.pricing?.retail, msrp: parseFloat(e.target.value) || 0 })}
                    className="input input-bordered w-full"
                  />
                </div>
                {(() => {
                  const unit = formData.pricing?.retail?.unit || formData.retailPrice || 0;
                  const msrp = formData.pricing?.retail?.msrp || formData.msrp || 0;
                  const margin = calculateMargin(unit, msrp);
                  return margin && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Calculated Margin:</span>
                        <span className="text-lg font-bold text-green-700">{margin}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Wholesale Pricing */}
            {activePricingTab === 'wholesale' && (
              <div className="space-y-6">
                {/* Tier 1 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Tier 1 - &lt; MC</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label text-xs">Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.wholesale?.tier1?.unit || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'wholesale', { 
                          ...formData.pricing?.wholesale,
                          tier1: { ...formData.pricing?.wholesale?.tier1, unit: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Mastercase</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.wholesale?.tier1?.mastercase || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'wholesale', { 
                          ...formData.pricing?.wholesale,
                          tier1: { ...formData.pricing?.wholesale?.tier1, mastercase: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Margin</label>
                      <input
                        type="text"
                        value={formData.pricing?.wholesale?.tier1?.margin || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'wholesale', { 
                          ...formData.pricing?.wholesale,
                          tier1: { ...formData.pricing?.wholesale?.tier1, margin: e.target.value }
                        })}
                        className="input input-bordered input-sm w-full"
                        placeholder="49.95%"
                      />
                    </div>
                  </div>
                </div>

                {/* Tier 2 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Tier 2 - &gt; MC</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label text-xs">Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.wholesale?.tier2?.unit || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'wholesale', { 
                          ...formData.pricing?.wholesale,
                          tier2: { ...formData.pricing?.wholesale?.tier2, unit: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Mastercase</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.wholesale?.tier2?.mastercase || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'wholesale', { 
                          ...formData.pricing?.wholesale,
                          tier2: { ...formData.pricing?.wholesale?.tier2, mastercase: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Margin</label>
                      <input
                        type="text"
                        value={formData.pricing?.wholesale?.tier2?.margin || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'wholesale', { 
                          ...formData.pricing?.wholesale,
                          tier2: { ...formData.pricing?.wholesale?.tier2, margin: e.target.value }
                        })}
                        className="input input-bordered input-sm w-full"
                        placeholder="52.45%"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Distribution Pricing */}
            {activePricingTab === 'distribution' && (
              <div className="space-y-6">
                {/* Tier 1 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Tier 1 - &lt;1 Pallet (0-55 MC)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label text-xs">Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.distribution?.tier1?.unit || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier1: { ...formData.pricing?.distribution?.tier1, unit: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Master Case</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.distribution?.tier1?.masterCase || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier1: { ...formData.pricing?.distribution?.tier1, masterCase: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Margin</label>
                      <input
                        type="text"
                        value={formData.pricing?.distribution?.tier1?.margin || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier1: { ...formData.pricing?.distribution?.tier1, margin: e.target.value }
                        })}
                        className="input input-bordered input-sm w-full"
                        placeholder="13.00%"
                      />
                    </div>
                  </div>
                </div>

                {/* Tier 2 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Tier 2 - 1-2 Pallets (56-111 MC)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label text-xs">Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.distribution?.tier2?.unit || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier2: { ...formData.pricing?.distribution?.tier2, unit: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Master Case</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.distribution?.tier2?.masterCase || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier2: { ...formData.pricing?.distribution?.tier2, masterCase: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Margin</label>
                      <input
                        type="text"
                        value={formData.pricing?.distribution?.tier2?.margin || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier2: { ...formData.pricing?.distribution?.tier2, margin: e.target.value }
                        })}
                        className="input input-bordered input-sm w-full"
                        placeholder="15.00%"
                      />
                    </div>
                  </div>
                </div>

                {/* Tier 3 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Tier 3 - 2-4 Pallets (112-228 MC)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label text-xs">Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.distribution?.tier3?.unit || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier3: { ...formData.pricing?.distribution?.tier3, unit: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Master Case</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricing?.distribution?.tier3?.masterCase || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier3: { ...formData.pricing?.distribution?.tier3, masterCase: parseFloat(e.target.value) || 0 }
                        })}
                        className="input input-bordered input-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Margin</label>
                      <input
                        type="text"
                        value={formData.pricing?.distribution?.tier3?.margin || ''}
                        onChange={(e) => handleNestedInputChange('pricing', 'distribution', { 
                          ...formData.pricing?.distribution,
                          tier3: { ...formData.pricing?.distribution?.tier3, margin: e.target.value }
                        })}
                        className="input input-bordered input-sm w-full"
                        placeholder="15.00%"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Unit Configuration */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Box className="w-5 h-5 text-[#93D500]" />
              Unit Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Units Per Case</label>
                <input
                  type="number"
                  value={formData.unitsPerCase || ''}
                  onChange={(e) => handleInputChange('unitsPerCase', parseInt(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Display Boxes Per Case</label>
                <input
                  type="number"
                  value={formData.displayBoxesPerCase || ''}
                  onChange={(e) => handleInputChange('displayBoxesPerCase', parseInt(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Units Per Display Box</label>
                <input
                  type="number"
                  value={formData.unitsPerDisplayBox || ''}
                  onChange={(e) => handleInputChange('unitsPerDisplayBox', parseInt(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Cases Per Pallet</label>
                <input
                  type="number"
                  value={formData.casesPerPallet || ''}
                  onChange={(e) => handleInputChange('casesPerPallet', parseInt(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
            </div>
          </div>

          {/* UPC Codes */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Barcode className="w-5 h-5 text-[#93D500]" />
              UPC Codes
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Unit UPC</label>
                <input
                  type="text"
                  value={formData.upc?.unit || ''}
                  onChange={(e) => handleNestedInputChange('upc', 'unit', e.target.value)}
                  className="input input-bordered w-full font-mono"
                />
              </div>
              <div>
                <label className="label">Display Box UPC</label>
                <input
                  type="text"
                  value={formData.upc?.displayBox || ''}
                  onChange={(e) => handleNestedInputChange('upc', 'displayBox', e.target.value)}
                  className="input input-bordered w-full font-mono"
                />
              </div>
              <div>
                <label className="label">Master Case UPC</label>
                <input
                  type="text"
                  value={formData.upc?.masterCase || ''}
                  onChange={(e) => handleNestedInputChange('upc', 'masterCase', e.target.value)}
                  className="input input-bordered w-full font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Master Case Dimensions */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Master Case Dimensions</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Length (in)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.masterCaseDimensions?.length || ''}
                  onChange={(e) => handleNestedInputChange('masterCaseDimensions', 'length', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Width (in)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.masterCaseDimensions?.width || ''}
                  onChange={(e) => handleNestedInputChange('masterCaseDimensions', 'width', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Height (in)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.masterCaseDimensions?.height || ''}
                  onChange={(e) => handleNestedInputChange('masterCaseDimensions', 'height', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.masterCaseDimensions?.weight || ''}
                  onChange={(e) => handleNestedInputChange('masterCaseDimensions', 'weight', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
            </div>
          </div>

          {/* Display Box Dimensions */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Display Box Dimensions</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Length (in)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.displayBoxDimensions?.length || ''}
                  onChange={(e) => handleNestedInputChange('displayBoxDimensions', 'length', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Width (in)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.displayBoxDimensions?.width || ''}
                  onChange={(e) => handleNestedInputChange('displayBoxDimensions', 'width', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Height (in)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.displayBoxDimensions?.height || ''}
                  onChange={(e) => handleNestedInputChange('displayBoxDimensions', 'height', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="label">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.displayBoxDimensions?.weight || ''}
                  onChange={(e) => handleNestedInputChange('displayBoxDimensions', 'weight', parseFloat(e.target.value) || 0)}
                  className="input input-bordered w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="card mt-6">
          <h2 className="text-lg font-semibold mb-4">Metadata</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Created:</span>{' '}
              <span className="font-mono">
                {product.createdAt ? new Date(product.createdAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Last Updated:</span>{' '}
              <span className="font-mono">
                {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Save Button (Bottom) */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary btn-lg flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
