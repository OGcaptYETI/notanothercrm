'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import {
  Upload,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Info,
  X,
  CheckCircle,
  XCircle,
  Star,
  MoreVertical,
  Edit,
  Image as ImageIcon,
  Eye,
  Clock,
  FileText,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductsTabProps {
  isAdmin: boolean;
}

export default function ProductsTab({ isAdmin }: ProductsTabProps) {
  // Products state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductType, setSelectedProductType] = useState('all');
  const [selectedProductStatus, setSelectedProductStatus] = useState('all');
  const [productSortField, setProductSortField] = useState<'productNum' | 'productDescription' | 'category' | 'productType' | 'isActive'>('productNum');
  const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load products on mount
  useEffect(() => {
    if (isAdmin) {
      loadProducts();
    }
  }, [isAdmin]);

  const loadProducts = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  // Filter and sort products
  useEffect(() => {
    let filtered = [...allProducts];

    // Apply search filter
    if (productSearchTerm) {
      const term = productSearchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.productNum?.toLowerCase().includes(term) ||
        product.productDescription?.toLowerCase().includes(term) ||
        product.category?.toLowerCase().includes(term)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Apply product type filter
    if (selectedProductType !== 'all') {
      filtered = filtered.filter(product => product.productType === selectedProductType);
    }

    // Apply status filter
    if (selectedProductStatus !== 'all') {
      if (selectedProductStatus === 'active') {
        filtered = filtered.filter(product => product.isActive === true);
      } else if (selectedProductStatus === 'inactive') {
        filtered = filtered.filter(product => product.isActive === false);
      } else if (selectedProductStatus === 'quarterlyBonus') {
        filtered = filtered.filter(product => product.quarterlyBonusEligible === true);
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[productSortField];
      let bVal = b[productSortField];

      // Special handling for isActive (boolean) - Active first when ascending
      if (productSortField === 'isActive') {
        const aActive = aVal === true ? 1 : 0;
        const bActive = bVal === true ? 1 : 0;
        return productSortDirection === 'asc' ? bActive - aActive : aActive - bActive;
      }

      // Handle null/undefined
      aVal = aVal || '';
      bVal = bVal || '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return productSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return productSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredProducts(filtered);
  }, [productSearchTerm, allProducts, selectedCategory, selectedProductType, selectedProductStatus, productSortField, productSortDirection]);

  const downloadTemplate = () => {
    // Create CSV template with headers and example row
    const headers = [
      'productNum',
      'productDescription',
      'category',
      'productType',
      'size',
      'uom',
      'isActive',
      'quarterlyBonusEligible',
      'notes'
    ];
    
    const exampleRow = [
      'Acrylic-007',
      '4-Tier Acrylic Focus+Flow Topper',
      'Display',
      'Acrylic',
      '4-Tier',
      'Each',
      'true',
      'false',
      'Example product for reference'
    ];
    
    const csvContent = [
      headers.join(','),
      exampleRow.join(',')
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'product_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Template downloaded! Fill it out and import.');
  };

  const handleImportProducts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingProducts(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/products/import-csv', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Imported ${result.stats.total} products!`);
        loadProducts();
      } else {
        toast.error(result.error || 'Failed to import products');
      }
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('Failed to import products');
    } finally {
      setImportingProducts(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    try {
      const productData = {
        productNum: formData.get('productNum'),
        productDescription: formData.get('productDescription'),
        category: formData.get('category'),
        productType: formData.get('productType'),
        size: formData.get('size'),
        uom: formData.get('uom'),
        notes: formData.get('notes') || '',
        isActive: formData.get('isActive') === 'on',
        quarterlyBonusEligible: formData.get('quarterlyBonusEligible') === 'on',
        updatedAt: new Date().toISOString(),
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success('Product updated successfully!');
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString(),
          imageUrl: null,
          imagePath: null,
        });
        toast.success('Product added successfully!');
      }

      setShowAddProductModal(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const product = allProducts.find(p => p.id === productId);

      // Delete image if exists
      if (product?.imagePath) {
        await fetch(`/api/products/upload-image?productId=${productId}&imagePath=${encodeURIComponent(product.imagePath)}`, {
          method: 'DELETE',
        });
      }

      await deleteDoc(doc(db, 'products', productId));
      toast.success('Product deleted successfully!');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleUploadProductImage = async (productId: string, productNum: string, file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productId', productId);
      formData.append('productNum', productNum);

      const response = await fetch('/api/products/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Image uploaded successfully!');
        loadProducts();
      } else {
        toast.error(result.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProductImage = async (productId: string, imagePath: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const response = await fetch(`/api/products/upload-image?productId=${productId}&imagePath=${encodeURIComponent(imagePath)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Image deleted successfully!');
        loadProducts();
      } else {
        toast.error(result.error || 'Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleToggleProductActive = async (productId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        isActive: !currentStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Product ${!currentStatus ? 'activated' : 'deactivated'}!`);
      loadProducts();
    } catch (error) {
      console.error('Error toggling product status:', error);
      toast.error('Failed to update product status');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="card bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              📦 Product Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage product catalog for spiffs and quarterly bonuses
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={downloadTemplate}
              className="btn btn-secondary flex items-center"
              title="Download CSV template for bulk product import"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </button>
            <label className="btn btn-secondary flex items-center cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              {importingProducts ? 'Importing...' : 'Import CSV'}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImportProducts}
                disabled={importingProducts}
                className="hidden"
              />
            </label>
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowAddProductModal(true);
              }}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2 mb-4">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by product number, description, or category..."
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
            className="input flex-1"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)))
                .sort()
                .map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              Product Type
            </label>
            <select
              value={selectedProductType}
              onChange={(e) => setSelectedProductType(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="all">All Types</option>
              {Array.from(new Set(allProducts.map(p => p.productType).filter(Boolean)))
                .sort()
                .map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              Status
            </label>
            <select
              value={selectedProductStatus}
              onChange={(e) => setSelectedProductStatus(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="quarterlyBonus">Quarterly Bonus Eligible</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <ArrowUpDown className="w-3 h-3 inline mr-1" />
              Sort By
            </label>
            <div className="flex space-x-2">
              <select
                value={productSortField}
                onChange={(e) => setProductSortField(e.target.value as any)}
                className="input w-full text-sm"
              >
                <option value="productNum">Product #</option>
                <option value="productDescription">Description</option>
                <option value="category">Category</option>
                <option value="productType">Type</option>
                <option value="isActive">Status</option>
              </select>
              <button
                onClick={() => setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc')}
                className="btn btn-secondary px-3"
                title={`Sort ${productSortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {productSortDirection === 'asc' ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <strong>{filteredProducts.length}</strong> of <strong>{allProducts.length}</strong> products
          {productSearchTerm && ` matching "${productSearchTerm}"`}
          {selectedCategory !== 'all' && ` • Category: ${selectedCategory}`}
          {selectedProductType !== 'all' && ` • Type: ${selectedProductType}`}
          {selectedProductStatus !== 'all' && ` • Status: ${selectedProductStatus}`}
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Status</th>
                <th>Product #</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Size</th>
                <th>UOM</th>
                <th>Quarterly Bonus</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-gray-500 py-8">
                    {productSearchTerm ? 'No products found matching your search.' : 'No products yet. Import from CSV or add manually.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {product.imageUrl ? (
                        <div className="relative group">
                          <img
                            src={product.imageUrl}
                            alt={product.productDescription}
                            className="w-16 h-16 object-cover rounded border"
                          />
                          <button
                            onClick={() => handleDeleteProductImage(product.id, product.imagePath)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete image"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors">
                          <Upload className="w-6 h-6 text-gray-400" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadProductImage(product.id, product.productNum, file);
                              }
                            }}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                        </label>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleProductActive(product.id, product.isActive)}
                        className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                          product.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                        title={`Click to ${product.isActive ? 'deactivate' : 'activate'}`}
                      >
                        {product.isActive ? '✓ Active' : '✗ Inactive'}
                      </button>
                    </td>
                    <td className="font-mono font-semibold">{product.productNum}</td>
                    <td className="max-w-xs truncate">{product.productDescription}</td>
                    <td>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {product.category || 'N/A'}
                      </span>
                    </td>
                    <td className="text-sm">{product.productType || 'N/A'}</td>
                    <td className="text-sm">{product.size || 'N/A'}</td>
                    <td className="text-sm font-mono">{product.uom || 'N/A'}</td>
                    <td>
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'products', product.id), {
                              quarterlyBonusEligible: !product.quarterlyBonusEligible,
                              updatedAt: new Date().toISOString(),
                            });
                            toast.success(`Quarterly bonus eligibility ${!product.quarterlyBonusEligible ? 'enabled' : 'disabled'}!`);
                            loadProducts();
                          } catch (error) {
                            console.error('Error updating quarterly bonus eligibility:', error);
                            toast.error('Failed to update eligibility');
                          }
                        }}
                        className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                          product.quarterlyBonusEligible
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                        title={`Click to ${product.quarterlyBonusEligible ? 'disable' : 'enable'} quarterly bonus`}
                      >
                        {product.quarterlyBonusEligible ? '✓ Yes' : '✗ No'}
                      </button>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowAddProductModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
