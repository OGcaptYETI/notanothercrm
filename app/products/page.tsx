'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import {
  Search, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle, XCircle, Star, Eye,
  Image as ImageIcon, X, ChevronRight, ChevronDown,
  Package, DollarSign, Barcode
} from 'lucide-react';

export default function ProductCatalogPage() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Products state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductType, setSelectedProductType] = useState('all');
  const [selectedProductStatus, setSelectedProductStatus] = useState('active'); // Default to active only
  const [productSortField, setProductSortField] = useState<'productNum' | 'productDescription' | 'category' | 'productType' | 'price'>('productNum');
  const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setAllProducts(productsData);
      setFilteredProducts(productsData.filter(p => p.isActive)); // Default to active only
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
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

    filtered.sort((a, b) => {
      let aVal = a[productSortField];
      let bVal = b[productSortField];

      if (productSortField === 'price') {
        aVal = aVal || 0;
        bVal = bVal || 0;
        return productSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
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
  }, [productSearchTerm, allProducts, selectedCategory, selectedProductType, selectedProductStatus, productSortField, productSortDirection]);

  const clearFilters = () => {
    setProductSearchTerm('');
    setSelectedCategory('all');
    setSelectedProductType('all');
    setSelectedProductStatus('active');
  };

  const hasActiveFilters = productSearchTerm || selectedCategory !== 'all' || 
    selectedProductType !== 'all' || selectedProductStatus !== 'active';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#93D500] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                📦 Product Catalog
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Browse our complete product lineup with pricing and specifications
              </p>
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
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Filter className="w-4 h-4 inline mr-1" />
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input w-full"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Filter className="w-4 h-4 inline mr-1" />
                Product Type
              </label>
              <select
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
                className="input w-full"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Filter className="w-4 h-4 inline mr-1" />
                Status
              </label>
              <select
                value={selectedProductStatus}
                onChange={(e) => setSelectedProductStatus(e.target.value)}
                className="input w-full"
              >
                <option value="active">Active Products</option>
                <option value="all">All Status</option>
                <option value="inactive">Inactive Only</option>
                <option value="quarterlyBonus">Quarterly Bonus Eligible</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ArrowUpDown className="w-4 h-4 inline mr-1" />
                Sort By
              </label>
              <div className="flex space-x-2">
                <select
                  value={productSortField}
                  onChange={(e) => setProductSortField(e.target.value as any)}
                  className="input w-full"
                >
                  <option value="productNum">Product #</option>
                  <option value="productDescription">Description</option>
                  <option value="category">Category</option>
                  <option value="productType">Type</option>
                  <option value="price">Price</option>
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

          {/* Product count */}
          <div className="text-sm text-gray-600">
            Showing <strong>{filteredProducts.length}</strong> of <strong>{allProducts.length}</strong> products
            {productSearchTerm && ` matching "${productSearchTerm}"`}
            {selectedCategory !== 'all' && ` • Category: ${selectedCategory}`}
            {selectedProductType !== 'all' && ` • Type: ${selectedProductType}`}
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
                  <th>Price</th>
                  <th>UOM</th>
                  <th>Bonus</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-gray-500 py-8">
                      {productSearchTerm ? 'No products found matching your search.' : 'No products available.'}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <>
                    <tr 
                      key={product.id} 
                      className={`cursor-pointer hover:bg-gray-50 ${expandedRows.has(product.id) ? 'bg-gray-50 border-b-0' : ''}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a')) return;
                        toggleExpandRow(product.id);
                      }}
                    >
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
                      <td className="font-mono font-semibold">
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
                            href={`/products/${product.id}`}
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
                      <td className="font-semibold text-green-700">
                        {product.price ? `$${product.price.toFixed(2)}` : '-'}
                      </td>
                      <td className="text-sm font-mono">{product.uom || 'Each'}</td>
                      <td>
                        {product.quarterlyBonusEligible && (
                          <span title="Quarterly Bonus Eligible">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          </span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/products/${product.id}`}
                          className="btn btn-sm btn-secondary flex items-center"
                          title="View product details"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Link>
                      </td>
                    </tr>
                    
                    {/* Expanded Row Details */}
                    {expandedRows.has(product.id) && (
                      <tr key={`${product.id}-details`} className="bg-gray-50 border-t-0">
                        <td colSpan={10} className="px-6 py-4">
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
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
