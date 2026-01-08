'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { QuoteLineItem, QuoteProduct, PricingMode } from '@/types/quote';
import { db, storage } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

interface ProductSelectorProps {
  pricingMode: PricingMode;
  selectedTier?: number;
  onAddProduct: (lineItem: QuoteLineItem) => void;
}

export default function ProductSelector({ pricingMode, selectedTier = 1, onAddProduct }: ProductSelectorProps) {
  const [products, setProducts] = useState<QuoteProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<QuoteProduct[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<Map<string, QuoteProduct[]>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadPricingTiers();
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  async function loadPricingTiers() {
    try {
      const tiersRef = collection(db, 'pricing_tiers');
      const snapshot = await getDocs(tiersRef);
      const tiers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPricingTiers(tiers);
    } catch (error) {
      console.error('Error loading pricing tiers:', error);
    }
  }

  async function loadProducts() {
    try {
      // Load from Firestore products collection
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      
      const productsArray: QuoteProduct[] = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          // Only show active products that are enabled for quote tool
          return data.isActive === true && data.showInQuoteTool === true;
        })
        .map(doc => {
          const data = doc.data();
          
          // Get the main image URL (use imageUrl or first image from images array)
          const imageUrl = data.imageUrl || (data.images && data.images.length > 0 ? data.images[0] : '');
          
          return {
            id: doc.id,
            productId: data.productNum || doc.id,
            name: data.productDescription || '',
            category: data.category || 'Other',
            unitsPerCase: data.unitsPerCase || 12,
            price: 0, // Will be set from pricing tiers
            msrp: 0, // Will be set from pricing tiers
            image: imageUrl,
            parentSku: data.parentSku || '',
            variantType: data.variantType || '',
          };
        });

      setProducts(productsArray);
      
      // Extract unique categories
      const uniqueCategories = Array.from(new Set(productsArray.map(p => p.category)));
      setCategories(uniqueCategories);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading products:', error);
      setLoading(false);
    }
  }

  function getProductPrice(product: QuoteProduct): number {
    if (pricingTiers.length === 0) return 0;
    
    // Find the tier based on selectedTier
    const tier = pricingTiers.find(t => t.tierId === selectedTier);
    if (!tier || !tier.prices) return 0;
    
    // Try multiple keys to find the price:
    // 1. productNum (e.g., "KB-2000")
    // 2. Firestore document ID
    // 3. Extract numeric part from productNum (e.g., "2000" from "KB-2000")
    const keys = [
      product.productId,
      product.id,
      product.productId.replace(/[^0-9]/g, ''), // Extract numbers only
    ];
    
    for (const key of keys) {
      if (tier.prices[key]) {
        return tier.prices[key];
      }
    }
    
    return 0;
  }

  function groupProductsByFamily(productList: QuoteProduct[]) {
    const groups = new Map<string, QuoteProduct[]>();
    
    productList.forEach(product => {
      // Group by product description (main product name)
      // Products with same description are variants (Master Case, Box, Unit)
      const groupKey = product.name;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(product);
    });
    
    return groups;
  }

  function filterProducts() {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.productId.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(filtered);
    
    // Group the filtered products
    const grouped = groupProductsByFamily(filtered);
    setGroupedProducts(grouped);
    
    // Initialize selected variants (default to first variant of each group)
    const variants = new Map<string, string>();
    grouped.forEach((variantList, groupKey) => {
      if (variantList.length > 0 && !selectedVariants.has(groupKey)) {
        variants.set(groupKey, variantList[0].id);
      }
    });
    if (variants.size > 0) {
      setSelectedVariants(new Map([...selectedVariants, ...variants]));
    }
  }

  function handleVariantChange(groupKey: string, variantId: string) {
    setSelectedVariants(new Map(selectedVariants.set(groupKey, variantId)));
  }

  function handleAddProduct(groupKey: string) {
    const variantId = selectedVariants.get(groupKey);
    const variants = groupedProducts.get(groupKey);
    if (!variants || !variantId) return;
    
    const product = variants.find(v => v.id === variantId);
    if (!product) return;
    
    const price = getProductPrice(product);
    
    const lineItem: QuoteLineItem = {
      id: `${Date.now()}-${Math.random()}`,
      productId: product.productId,
      product: {
        ...product,
        price: price,
        msrp: price
      },
      masterCases: 1,
      displayBoxes: product.unitsPerCase,
      unitPrice: price,
      lineTotal: price * product.unitsPerCase,
    };

    onAddProduct(lineItem);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
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

      {/* Product Grid - Grouped by Product Family */}
      {groupedProducts.size === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No products found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(groupedProducts.entries()).map(([groupKey, variants]) => {
            const selectedVariantId = selectedVariants.get(groupKey) || variants[0].id;
            const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
            const mainImage = variants.find(v => v.image)?.image || '';

            return (
              <div
                key={groupKey}
                className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-sm transition-all bg-white"
              >
                <div className="flex items-center gap-4">
                  {/* Product Image */}
                  {mainImage && (
                    <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={mainImage.startsWith('http') ? mainImage : `https://${mainImage.replace(/^https?:\/\//, '')}`}
                        alt={groupKey}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-base mb-2">{groupKey}</h3>
                    
                    {/* Variant Buttons */}
                    {variants.length > 1 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {variants.map(variant => {
                          const isSelected = variant.id === selectedVariantId;
                          // Determine variant type from SKU or product description
                          let variantLabel = variant.productId;
                          if (variant.productId.includes('MC') || variant.productId.includes('4')) {
                            variantLabel = 'Master Case';
                          } else if (variant.productId.includes('3')) {
                            variantLabel = 'Box';
                          } else if (variant.productId.includes('2')) {
                            variantLabel = 'Unit';
                          }
                          
                          return (
                            <button
                              key={variant.id}
                              onClick={() => handleVariantChange(groupKey, variant.id)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-primary-600 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {variantLabel}
                              <span className="ml-1 text-[10px] opacity-75">
                                ({variant.unitsPerCase})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      SKU: {selectedVariant.productId} • {selectedVariant.category}
                    </p>
                  </div>

                  {/* Pricing & Add Button */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {pricingMode === 'wholesale' ? 'Wholesale' : 'Distribution'}
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        ${getProductPrice(selectedVariant).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">per unit</p>
                    </div>
                    <button
                      onClick={() => handleAddProduct(groupKey)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Quote
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
