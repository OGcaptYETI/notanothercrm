'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Plus, ChevronDown, ChevronRight, Edit, Trash2, 
  Image as ImageIcon, Package, Search, Filter, Eye, EyeOff
} from 'lucide-react';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import { db, storage } from '@/lib/firebase/config';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ProductStyle, ProductSKU, ProductHierarchyView } from '@/types/product-hierarchy';
import toast from 'react-hot-toast';

export default function ProductHierarchyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hierarchies, setHierarchies] = useState<ProductHierarchyView[]>([]);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadHierarchies();
  }, []);

  async function loadHierarchies() {
    try {
      setLoading(true);
      
      // Load all products from the existing products collection
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      
      // Group products by style (using productDescription as style name for now)
      const styleMap = new Map<string, ProductHierarchyView>();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Use productDescription as the style name
        // In the future, we'll have a separate styles collection
        const styleName = data.productDescription?.split(' - ')[0] || data.productDescription || 'Unnamed Style';
        const brand = data.brand || 'Kanva Botanicals';
        
        if (!styleMap.has(styleName)) {
          // Create a new style entry
          styleMap.set(styleName, {
            style: {
              id: styleName.replace(/\s+/g, '-').toLowerCase(),
              styleId: styleName.replace(/\s+/g, '-').toLowerCase(),
              styleName: styleName,
              brand: brand,
              category: data.category || 'Other',
              productType: data.productType || '',
              description: data.productDescription || '',
              notes: data.notes || '',
              images: data.images || [],
              mainImage: data.imageUrl || (data.images && data.images[0]) || '',
              isActive: data.isActive || false,
              showInQuoteTool: data.showInQuoteTool || false,
              quarterlyBonusEligible: data.quarterlyBonusEligible || false,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
            },
            skus: []
          });
        }
        
        // Add this product as a SKU
        const hierarchy = styleMap.get(styleName)!;
        hierarchy.skus.push({
          id: doc.id,
          skuId: data.productNum || doc.id,
          styleId: styleName.replace(/\s+/g, '-').toLowerCase(),
          skuName: data.productDescription || '',
          variantType: data.variantType || data.productType || '',
          size: data.size || '',
          uom: data.uom || '',
          skuImage: data.imageUrl || '',
          baseDistributionPrice: data.baseDistributionPrice,
          baseWholesalePrice: data.baseWholesalePrice,
          msrp: data.msrp,
          unitsPerCase: data.unitsPerCase || 1,
          displayBoxesPerCase: data.displayBoxesPerCase,
          unitsPerDisplayBox: data.unitsPerDisplayBox,
          casesPerPallet: data.casesPerPallet,
          upc: data.upc,
          masterCaseDimensions: data.masterCaseDimensions,
          displayBoxDimensions: data.displayBoxDimensions,
          isActive: data.isActive || false,
          showInQuoteTool: data.showInQuoteTool || false,
          quarterlyBonusEligible: data.quarterlyBonusEligible || false,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });
      
      const hierarchyArray = Array.from(styleMap.values());
      setHierarchies(hierarchyArray);
      
      // Extract unique brands and categories
      const uniqueBrands = Array.from(new Set(hierarchyArray.map(h => h.style.brand)));
      const uniqueCategories = Array.from(new Set(hierarchyArray.map(h => h.style.category)));
      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading hierarchies:', error);
      toast.error('Failed to load product hierarchies');
      setLoading(false);
    }
  }

  function toggleStyle(styleId: string) {
    const newExpanded = new Set(expandedStyles);
    if (newExpanded.has(styleId)) {
      newExpanded.delete(styleId);
    } else {
      newExpanded.add(styleId);
    }
    setExpandedStyles(newExpanded);
  }

  function handleCreateStyle() {
    router.push('/admin/product-hierarchy/create-style');
  }

  function handleEditStyle(styleId: string) {
    router.push(`/admin/product-hierarchy/style/${styleId}`);
  }

  function handleCreateSKU(styleId: string) {
    router.push(`/admin/product-hierarchy/create-sku?styleId=${styleId}`);
  }

  function handleEditSKU(skuId: string) {
    router.push(`/admin/products/${skuId}`);
  }

  const filteredHierarchies = hierarchies.filter(h => {
    const matchesSearch = searchTerm === '' || 
      h.style.styleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.skus.some(sku => sku.skuId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesBrand = selectedBrand === 'all' || h.style.brand === selectedBrand;
    const matchesCategory = selectedCategory === 'all' || h.style.category === selectedCategory;
    
    return matchesSearch && matchesBrand && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#93D500] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product hierarchies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <AdminBreadcrumbs currentPage="Product Hierarchy" />

        <button
          onClick={() => router.push('/admin')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </button>

        <div className="card mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-[#93D500]" />
              <h1 className="text-2xl font-bold text-gray-900">Product Hierarchy</h1>
            </div>
            <button
              onClick={handleCreateStyle}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Style
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Product Hierarchy Structure:</h3>
            <p className="text-sm text-blue-800">
              <strong>Brand</strong> → <strong>Style</strong> → <strong>SKU</strong>
            </p>
            <p className="text-sm text-blue-700 mt-2">
              Styles contain shared images and information. SKUs are individual product variants (Master Case, Box, Unit) with optional unique images.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search styles or SKUs..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Brands</option>
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Hierarchy Table */}
          <div className="space-y-2">
            {filteredHierarchies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No product hierarchies found</p>
              </div>
            ) : (
              filteredHierarchies.map(hierarchy => {
                const isExpanded = expandedStyles.has(hierarchy.style.styleId);
                
                return (
                  <div key={hierarchy.style.styleId} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Style Row */}
                    <div className="bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4 p-4">
                        <button
                          onClick={() => toggleStyle(hierarchy.style.styleId)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        
                        {hierarchy.style.mainImage && (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img
                              src={hierarchy.style.mainImage.startsWith('http') ? hierarchy.style.mainImage : `https://${hierarchy.style.mainImage.replace(/^https?:\/\//, '')}`}
                              alt={hierarchy.style.styleName}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{hierarchy.style.styleName}</h3>
                            {!hierarchy.style.isActive && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                Inactive
                              </span>
                            )}
                            {hierarchy.style.showInQuoteTool && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                Quote Tool
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>{hierarchy.style.brand}</span>
                            <span>•</span>
                            <span>{hierarchy.style.category}</span>
                            <span>•</span>
                            <span className="font-medium">{hierarchy.skus.length} SKU{hierarchy.skus.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCreateSKU(hierarchy.style.styleId)}
                            className="btn btn-sm btn-secondary"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add SKU
                          </button>
                          <button
                            onClick={() => handleEditStyle(hierarchy.style.styleId)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* SKU Rows (Expanded) */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-200">
                        {hierarchy.skus.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <p className="mb-3">No SKUs for this style yet</p>
                            <button
                              onClick={() => handleCreateSKU(hierarchy.style.styleId)}
                              className="btn btn-sm btn-primary"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add First SKU
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200">
                            {hierarchy.skus.map(sku => (
                              <div key={sku.id} className="flex items-center gap-4 p-4 pl-16 hover:bg-gray-100 transition-colors">
                                {sku.skuImage && (
                                  <div className="w-12 h-12 bg-white rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                    <img
                                      src={sku.skuImage.startsWith('http') ? sku.skuImage : `https://${sku.skuImage.replace(/^https?:\/\//, '')}`}
                                      alt={sku.skuName}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                )}
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-sm font-medium text-gray-900">{sku.skuId}</span>
                                    {!sku.isActive && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <span>{sku.variantType}</span>
                                    {sku.size && (
                                      <>
                                        <span>•</span>
                                        <span>{sku.size}</span>
                                      </>
                                    )}
                                    {sku.unitsPerCase && (
                                      <>
                                        <span>•</span>
                                        <span>{sku.unitsPerCase} units/case</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                <button
                                  onClick={() => handleEditSKU(sku.id)}
                                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
