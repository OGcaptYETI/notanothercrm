'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import {
  Upload, Download, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  Plus, Trash2, Info, X, CheckCircle, XCircle, Star, MoreVertical,
  Edit, Image as ImageIcon, Eye, Clock, FileText, ChevronRight, ChevronDown,
  Package, DollarSign, Barcode
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface ProductsTabProps {
  isAdmin: boolean;
}

export default function ProductsTab({ isAdmin }: ProductsTabProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Products state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductType, setSelectedProductType] = useState('all');
  const [selectedProductStatus, setSelectedProductStatus] = useState('all');
  const [selectedQuoteToolStatus, setSelectedQuoteToolStatus] = useState('all');
  const [productSortField, setProductSortField] = useState<'productNum' | 'productDescription' | 'category' | 'productType' | 'isActive'>('productNum');
  const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Enhanced state for new features
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + N to add new product
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setEditingProduct(null);
        setShowAddProductModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load products and import history on mount
  useEffect(() => {
    if (isAdmin) {
      loadProducts();
      loadImportHistory();
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

  const loadImportHistory = async () => {
    try {
      const historySnapshot = await getDocs(collection(db, 'product_import_history'));
      const historyData = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setImportHistory(historyData.slice(0, 10)); // Keep last 10 imports
    } catch (error) {
      console.error('Error loading import history:', error);
    }
  };

  // Filter and sort products
  useEffect(() => {
    let filtered = [...allProducts];

    if (productSearchTerm) {
      const term = productSearchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.productNum?.toLowerCase().includes(term) ||
        product.productDescription?.toLowerCase().includes(term) ||
        product.category?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    if (selectedProductType !== 'all') {
      filtered = filtered.filter(product => product.productType === selectedProductType);
    }

    if (selectedProductStatus !== 'all') {
      if (selectedProductStatus === 'active') {
        filtered = filtered.filter(product => product.isActive === true);
      } else if (selectedProductStatus === 'inactive') {
        filtered = filtered.filter(product => product.isActive === false);
      } else if (selectedProductStatus === 'quarterlyBonus') {
        filtered = filtered.filter(product => product.quarterlyBonusEligible === true);
      }
    }

    if (selectedQuoteToolStatus !== 'all') {
      if (selectedQuoteToolStatus === 'enabled') {
        filtered = filtered.filter(product => product.showInQuoteTool === true);
      } else if (selectedQuoteToolStatus === 'disabled') {
        filtered = filtered.filter(product => product.showInQuoteTool !== true);
      }
    }

    filtered.sort((a, b) => {
      let aVal = a[productSortField];
      let bVal = b[productSortField];

      if (productSortField === 'isActive') {
        const aActive = aVal === true ? 1 : 0;
        const bActive = bVal === true ? 1 : 0;
        return productSortDirection === 'asc' ? bActive - aActive : aActive - bActive;
      }

      aVal = aVal || '';
      bVal = bVal || '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return productSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return productSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredProducts(filtered);
  }, [productSearchTerm, allProducts, selectedCategory, selectedProductType, selectedProductStatus, selectedQuoteToolStatus, productSortField, productSortDirection]);

  const downloadTemplate = () => {
    const headers = [
      'productNum', 'productDescription', 'category', 'productType',
      'size', 'uom', 'isActive', 'quarterlyBonusEligible', 'notes', 'imageUrl'
    ];
    
    const exampleRow = [
      'Acrylic-007', '4-Tier Acrylic Focus+Flow Topper', 'Display', 'Acrylic',
      '4-Tier', 'Each', 'true', 'false', 'Example product', 'https://example.com/image.jpg'
    ];
    
    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
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

  const exportCurrentView = () => {
    const exportData = filteredProducts.map(p => ({
      'Product #': p.productNum,
      'Description': p.productDescription,
      'Category': p.category,
      'Type': p.productType,
      'Size': p.size,
      'UOM': p.uom,
      'Active': p.isActive ? 'Yes' : 'No',
      'Quarterly Bonus': p.quarterlyBonusEligible ? 'Yes' : 'No',
      'Notes': p.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `products_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${exportData.length} products!`);
  };

  const parseCSV = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim());
          
          const data = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim());
            const row: any = { rowNumber: index + 2 };
            headers.forEach((header, i) => {
              row[header] = values[i] || '';
            });
            return row;
          });
          
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const validateImportData = (data: any[]): string[] => {
    const errors: string[] = [];
    const existingProductNums = new Set(allProducts.map(p => p.productNum));
    
    data.forEach((row, index) => {
      if (!row.productNum) {
        errors.push(`Row ${row.rowNumber}: Missing productNum`);
      }
      if (!row.productDescription) {
        errors.push(`Row ${row.rowNumber}: Missing productDescription`);
      }
      if (existingProductNums.has(row.productNum)) {
        errors.push(`Row ${row.rowNumber}: Duplicate productNum "${row.productNum}" (already exists)`);
      }
    });
    
    return errors;
  };

  const handleImportPreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseCSV(file);
      const errors = validateImportData(data);
      
      setPreviewData(data.slice(0, 5)); // Show first 5 rows
      setValidationErrors(errors);
      setPendingImportFile(file);
      setShowImportPreview(true);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file');
    }
    
    e.target.value = ''; // Reset input
  };

  const confirmImport = async () => {
    if (!pendingImportFile) return;

    setImportingProducts(true);
    setShowImportPreview(false);
    setImportProgress(0);

    try {
      const data = await parseCSV(pendingImportFile);
      const total = data.length;
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        setImportProgress(Math.round(((i + 1) / total) * 100));

        try {
          // Check for duplicates
          const exists = allProducts.find(p => p.productNum === row.productNum);
          if (exists) {
            skipped++;
            continue;
          }

          await addDoc(collection(db, 'products'), {
            productNum: row.productNum,
            productDescription: row.productDescription,
            category: row.category || '',
            productType: row.productType || '',
            size: row.size || '',
            uom: row.uom || 'Each',
            isActive: row.isActive === 'true',
            quarterlyBonusEligible: row.quarterlyBonusEligible === 'true',
            notes: row.notes || '',
            imageUrl: row.imageUrl || null,
            imagePath: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          imported++;
        } catch (error: any) {
          errors.push(`Row ${row.rowNumber}: ${error.message}`);
        }
      }

      // Save import history
      await addDoc(collection(db, 'product_import_history'), {
        timestamp: new Date().toISOString(),
        filename: pendingImportFile.name,
        totalRows: total,
        imported,
        skipped,
        errors: errors.length,
        errorDetails: errors.slice(0, 10), // Store first 10 errors
      });

      toast.success(`Import complete! ${imported} imported, ${skipped} skipped`);
      if (errors.length > 0) {
        toast.error(`${errors.length} errors occurred. Check import history for details.`);
      }
      
      loadProducts();
      loadImportHistory();
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('Failed to import products');
    } finally {
      setImportingProducts(false);
      setImportProgress(0);
      setPendingImportFile(null);
    }
  };

  const clearFilters = () => {
    setProductSearchTerm('');
    setSelectedCategory('all');
    setSelectedProductType('all');
    setSelectedProductStatus('all');
    toast.success('Filters cleared');
  };

  const hasActiveFilters = productSearchTerm || selectedCategory !== 'all' || 
    selectedProductType !== 'all' || selectedProductStatus !== 'all';

  const toggleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const bulkActivate = async () => {
    if (selectedProducts.size === 0) return;
    
    try {
      const promises = Array.from(selectedProducts).map(id =>
        updateDoc(doc(db, 'products', id), {
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(promises);
      toast.success(`Activated ${selectedProducts.size} products`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      toast.error('Failed to activate products');
    }
  };

  const bulkDeactivate = async () => {
    if (selectedProducts.size === 0) return;
    
    try {
      const promises = Array.from(selectedProducts).map(id =>
        updateDoc(doc(db, 'products', id), {
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(promises);
      toast.success(`Deactivated ${selectedProducts.size} products`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      toast.error('Failed to deactivate products');
    }
  };

  const bulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`Delete ${selectedProducts.size} products? This cannot be undone.`)) return;
    
    try {
      const promises = Array.from(selectedProducts).map(id =>
        deleteDoc(doc(db, 'products', id))
      );
      await Promise.all(promises);
      toast.success(`Deleted ${selectedProducts.size} products`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      toast.error('Failed to delete products');
    }
  };

  const bulkToggleBonus = async () => {
    if (selectedProducts.size === 0) return;
    
    try {
      const promises = Array.from(selectedProducts).map(async (id) => {
        const product = allProducts.find(p => p.id === id);
        return updateDoc(doc(db, 'products', id), {
          quarterlyBonusEligible: !product?.quarterlyBonusEligible,
          updatedAt: new Date().toISOString(),
        });
      });
      await Promise.all(promises);
      toast.success(`Toggled bonus eligibility for ${selectedProducts.size} products`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      toast.error('Failed to toggle bonus eligibility');
    }
  };

  const bulkEnableQuoteTool = async () => {
    if (selectedProducts.size === 0) return;
    
    try {
      const promises = Array.from(selectedProducts).map(id =>
        updateDoc(doc(db, 'products', id), {
          showInQuoteTool: true,
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(promises);
      toast.success(`Enabled quote tool for ${selectedProducts.size} products`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      toast.error('Failed to enable quote tool');
    }
  };

  const bulkDisableQuoteTool = async () => {
    if (selectedProducts.size === 0) return;
    
    try {
      const promises = Array.from(selectedProducts).map(id =>
        updateDoc(doc(db, 'products', id), {
          showInQuoteTool: false,
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(promises);
      toast.success(`Disabled quote tool for ${selectedProducts.size} products`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      toast.error('Failed to disable quote tool');
    }
  };

  const bulkExport = () => {
    const selectedData = allProducts.filter(p => selectedProducts.has(p.id));
    const exportData = selectedData.map(p => ({
      'Product #': p.productNum,
      'Description': p.productDescription,
      'Category': p.category,
      'Type': p.productType,
      'Size': p.size,
      'UOM': p.uom,
      'Active': p.isActive ? 'Yes' : 'No',
      'Quarterly Bonus': p.quarterlyBonusEligible ? 'Yes' : 'No',
      'Quote Tool': p.showInQuoteTool ? 'Yes' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Selected Products');
    XLSX.writeFile(wb, `selected_products_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${selectedData.length} selected products!`);
  };

  const toggleExpandRow = (productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
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
      await deleteDoc(doc(db, 'products', productId));
      toast.success('Product deleted successfully!');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
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
    <div className="space-y-6">
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
              title="Download CSV template (Ctrl+Shift+D)"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </button>
            <label className="btn btn-secondary flex items-center cursor-pointer relative group">
              <Upload className="w-4 h-4 mr-2" />
              {importingProducts ? `Importing... ${importProgress}%` : 'Import CSV'}
              <Info className="w-4 h-4 ml-2 text-gray-500" />
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImportPreview}
                disabled={importingProducts}
                className="hidden"
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Upload a CSV file with product data. Download the template first if you need the correct format.
              </div>
            </label>
            <button
              onClick={() => setShowImportHistory(true)}
              className="btn btn-secondary flex items-center"
              title="View import history"
            >
              <Clock className="w-4 h-4 mr-2" />
              History
            </button>
            <button
              onClick={exportCurrentView}
              className="btn btn-secondary flex items-center"
              title="Export current filtered view"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export View
            </button>
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowAddProductModal(true);
              }}
              className="btn btn-primary flex items-center"
              title="Add new product (Ctrl+N)"
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
            ref={searchInputRef}
            type="text"
            placeholder="Search by product number, description, or category... (Ctrl+K)"
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
            className="input flex-1"
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn btn-secondary flex items-center"
              title="Clear all filters"
            >
              <X className="w-4 h-4 mr-1" />
              Clear Filters
            </button>
          )}
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
              <Filter className="w-3 h-3 inline mr-1" />
              Quote Tool
            </label>
            <select
              value={selectedQuoteToolStatus}
              onChange={(e) => setSelectedQuoteToolStatus(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="all">All Products</option>
              <option value="enabled">Quote Tool Enabled</option>
              <option value="disabled">Quote Tool Disabled</option>
            </select>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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

        {/* Product count and bulk actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <strong>{filteredProducts.length}</strong> of <strong>{allProducts.length}</strong> products
            {productSearchTerm && ` matching "${productSearchTerm}"`}
            {selectedCategory !== 'all' && ` • Category: ${selectedCategory}`}
            {selectedProductType !== 'all' && ` • Type: ${selectedProductType}`}
            {selectedProductStatus !== 'all' && ` • Status: ${selectedProductStatus}`}
            {selectedQuoteToolStatus !== 'all' && ` • Quote Tool: ${selectedQuoteToolStatus}`}
          </div>
          
          {selectedProducts.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedProducts.size} selected
              </span>
              <button
                onClick={bulkActivate}
                className="btn btn-sm btn-secondary"
                title="Activate selected products"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Activate
              </button>
              <button
                onClick={bulkDeactivate}
                className="btn btn-sm btn-secondary"
                title="Deactivate selected products"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Deactivate
              </button>
              <button
                onClick={bulkToggleBonus}
                className="btn btn-sm btn-secondary"
                title="Toggle quarterly bonus for selected"
              >
                <Star className="w-4 h-4 mr-1" />
                Toggle Bonus
              </button>
              <button
                onClick={bulkEnableQuoteTool}
                className="btn btn-sm btn-secondary"
                title="Enable quote tool for selected"
              >
                <Package className="w-4 h-4 mr-1" />
                Enable Quote
              </button>
              <button
                onClick={bulkDisableQuoteTool}
                className="btn btn-sm btn-secondary"
                title="Disable quote tool for selected"
              >
                <Package className="w-4 h-4 mr-1" />
                Disable Quote
              </button>
              <button
                onClick={bulkExport}
                className="btn btn-sm btn-secondary"
                title="Export selected products"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>
              <button
                onClick={bulkDelete}
                className="btn btn-sm btn-danger"
                title="Delete selected products"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th>Image</th>
                <th>Status</th>
                <th>Product #</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Size</th>
                <th>UOM</th>
                <th>Bonus</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center text-gray-500 py-8">
                    {productSearchTerm ? 'No products found matching your search.' : 'No products yet. Import from CSV or add manually.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <Fragment key={product.id}>
                  <tr 
                    className={`cursor-pointer hover:bg-gray-50 ${selectedProducts.has(product.id) ? 'bg-blue-50' : ''} ${expandedRows.has(product.id) ? 'border-b-0' : ''}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input, button, a')) return;
                      toggleExpandRow(product.id);
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td>
                      <div
                        onMouseEnter={() => setHoveredImage(product.imageUrl)}
                        onMouseLeave={() => setHoveredImage(null)}
                        onMouseMove={handleMouseMove}
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.productDescription}
                            className="w-12 h-12 object-cover rounded border cursor-pointer"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium inline-flex items-center ${
                        product.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {product.isActive ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                        ) : (
                          <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                        )}
                      </span>
                    </td>
                    <td className="font-mono font-semibold text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandRow(product.id);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expandedRows.has(product.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {product.productNum}
                        </Link>
                      </div>
                    </td>
                    <td className="max-w-xs">
                      <div className="truncate" title={product.productDescription}>
                        {product.productDescription}
                      </div>
                    </td>
                    <td>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {product.category || 'N/A'}
                      </span>
                    </td>
                    <td className="text-sm">{product.productType || 'N/A'}</td>
                    <td className="text-sm">{product.size || 'N/A'}</td>
                    <td className="text-sm font-mono">{product.uom || 'Each'}</td>
                    <td>
                      {product.quarterlyBonusEligible && (
                        <span title="Quarterly Bonus Eligible">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="relative">
                        <button
                          onClick={() => setShowQuickActions(showQuickActions === product.id ? null : product.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Quick actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {showQuickActions === product.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              onClick={() => {
                                setEditingProduct(product);
                                setShowAddProductModal(true);
                                setShowQuickActions(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Product
                            </button>
                            <button
                              onClick={() => {
                                handleToggleProductActive(product.id, product.isActive);
                                setShowQuickActions(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                            >
                              {product.isActive ? (
                                <><XCircle className="w-4 h-4 mr-2" /> Deactivate</>
                              ) : (
                                <><CheckCircle className="w-4 h-4 mr-2" /> Activate</>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteProduct(product.id);
                                setShowQuickActions(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded Row Details */}
                  {expandedRows.has(product.id) && (
                    <tr key={`${product.id}-details`} className="bg-gray-50 border-t-0">
                      <td colSpan={11} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <Package className="w-4 h-4 mr-2" />
                              Product Information
                            </h4>
                            <div className="space-y-2">
                              <div><span className="text-gray-500">Product #:</span> <span className="font-mono">{product.productNum}</span></div>
                              <div><span className="text-gray-500">Description:</span> {product.productDescription}</div>
                              <div><span className="text-gray-500">Category:</span> {product.category || 'N/A'}</div>
                              <div><span className="text-gray-500">Type:</span> {product.productType || 'N/A'}</div>
                              <div><span className="text-gray-500">Size:</span> {product.size || 'N/A'}</div>
                              <div><span className="text-gray-500">UOM:</span> {product.uom || 'Each'}</div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <DollarSign className="w-4 h-4 mr-2" />
                              Pricing & Units
                            </h4>
                            <div className="space-y-2">
                              <div><span className="text-gray-500">Unit Price:</span> <span className="font-semibold text-green-700">{product.price ? `$${product.price.toFixed(2)}` : 'N/A'}</span></div>
                              <div><span className="text-gray-500">Retail Price:</span> {product.retailPrice ? `$${product.retailPrice.toFixed(2)}` : 'N/A'}</div>
                              <div><span className="text-gray-500">MSRP:</span> {product.msrp ? `$${product.msrp.toFixed(2)}` : 'N/A'}</div>
                              <div><span className="text-gray-500">Units Per Case:</span> {product.unitsPerCase || 'N/A'}</div>
                              <div><span className="text-gray-500">Display Boxes/Case:</span> {product.displayBoxesPerCase || 'N/A'}</div>
                              <div><span className="text-gray-500">Units/Display Box:</span> {product.unitsPerDisplayBox || 'N/A'}</div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <Barcode className="w-4 h-4 mr-2" />
                              UPC & Status
                            </h4>
                            <div className="space-y-2">
                              <div><span className="text-gray-500">Unit UPC:</span> <span className="font-mono text-xs">{product.upc?.unit || 'N/A'}</span></div>
                              <div><span className="text-gray-500">Display Box UPC:</span> <span className="font-mono text-xs">{product.upc?.displayBox || 'N/A'}</span></div>
                              <div><span className="text-gray-500">Master Case UPC:</span> <span className="font-mono text-xs">{product.upc?.masterCase || 'N/A'}</span></div>
                              <div className="pt-2 border-t border-gray-200">
                                <span className="text-gray-500">Status:</span> 
                                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                  {product.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Quarterly Bonus:</span> 
                                <span className="ml-2">{product.quarterlyBonusEligible ? '✓ Yes' : '✗ No'}</span>
                              </div>
                              {product.notes && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <span className="text-gray-500 block mb-1">Notes:</span>
                                  <p className="text-gray-700 text-xs">{product.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Image Hover Preview Portal */}
      {hoveredImage && (
        <div 
          className="fixed z-[100] pointer-events-none"
          style={{
            left: `${mousePosition.x + 20}px`,
            top: `${mousePosition.y - 130}px`
          }}
        >
          <img
            src={hoveredImage}
            alt="Product preview"
            className="w-64 h-64 object-contain rounded-lg border-4 border-[#93D500] bg-white shadow-2xl"
          />
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Import Preview</h3>
              <p className="text-sm text-gray-600 mt-1">
                Review the first 5 rows before importing
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {validationErrors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Validation Errors:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationErrors.slice(0, 10).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="font-semibold">... and {validationErrors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>Product #</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i}>
                        <td className="font-mono">{row.productNum}</td>
                        <td>{row.productDescription}</td>
                        <td>{row.category}</td>
                        <td>{row.productType}</td>
                        <td>{row.isActive}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowImportPreview(false);
                  setPendingImportFile(null);
                  setPreviewData([]);
                  setValidationErrors([]);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={validationErrors.length > 0}
                className="btn btn-primary"
              >
                {validationErrors.length > 0 ? 'Fix Errors First' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import History Modal */}
      {showImportHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Import History</h3>
                <p className="text-sm text-gray-600 mt-1">Last 10 imports</p>
              </div>
              <button
                onClick={() => setShowImportHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {importHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No import history yet</p>
              ) : (
                <div className="space-y-3">
                  {importHistory.map((entry) => (
                    <div key={entry.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{entry.filename}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            <span className="text-green-600 font-semibold">{entry.imported}</span> imported
                          </p>
                          <p className="text-xs text-gray-500">
                            {entry.skipped} skipped • {entry.errors} errors
                          </p>
                        </div>
                      </div>
                      {entry.errorDetails && entry.errorDetails.length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                          <p className="font-semibold mb-1">Errors:</p>
                          <ul className="space-y-1">
                            {entry.errorDetails.map((error: string, i: number) => (
                              <li key={i}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal - Keeping existing modal code */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
            </div>
            
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product # *
                  </label>
                  <input
                    type="text"
                    name="productNum"
                    defaultValue={editingProduct?.productNum}
                    required
                    className="input w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UOM
                  </label>
                  <input
                    type="text"
                    name="uom"
                    defaultValue={editingProduct?.uom || 'Each'}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  name="productDescription"
                  defaultValue={editingProduct?.productDescription}
                  required
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    defaultValue={editingProduct?.category}
                    className="input w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <input
                    type="text"
                    name="productType"
                    defaultValue={editingProduct?.productType}
                    className="input w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Size
                  </label>
                  <input
                    type="text"
                    name="size"
                    defaultValue={editingProduct?.size}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  defaultValue={editingProduct?.notes}
                  rows={3}
                  className="input w-full"
                />
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editingProduct?.isActive ?? true}
                    className="rounded border-gray-300 mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="quarterlyBonusEligible"
                    defaultChecked={editingProduct?.quarterlyBonusEligible ?? false}
                    className="rounded border-gray-300 mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Quarterly Bonus Eligible</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
