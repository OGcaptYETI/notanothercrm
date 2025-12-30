'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { 
  ChevronLeft, Package, DollarSign, Box, Ruler, Barcode, 
  Calendar, FileText, Image as ImageIcon, CheckCircle, XCircle, Star, Truck
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const data = { id: productDoc.id, ...productDoc.data() };
        setProduct(data);
      } else {
        toast.error('Product not found');
        router.push('/products');
      }
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#93D500] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product details...</p>
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
        <div className="mb-6">
          <Link
            href="/products"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Product Catalog
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {product.productNum}
                </h1>
                <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                  product.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {product.isActive ? (
                    <><CheckCircle className="w-4 h-4 inline mr-1" /> Active</>
                  ) : (
                    <><XCircle className="w-4 h-4 inline mr-1" /> Inactive</>
                  )}
                </span>
                {product.quarterlyBonusEligible && (
                  <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800 font-medium">
                    <Star className="w-4 h-4 inline mr-1 fill-yellow-500" />
                    Quarterly Bonus Eligible
                  </span>
                )}
              </div>
              <p className="text-lg text-gray-600">{product.productDescription}</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Image & Basic Info */}
          <div className="space-y-6">
            {/* Product Image */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <ImageIcon className="w-5 h-5 mr-2" />
                Product Image
              </h3>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.productDescription}
                  className="w-full h-auto rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No image available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Basic Information */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Basic Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Product Number
                  </label>
                  <p className="text-gray-900 font-mono font-semibold">{product.productNum}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Description
                  </label>
                  <p className="text-gray-900">{product.productDescription}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Category
                    </label>
                    <p className="text-gray-900">{product.category || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Type
                    </label>
                    <p className="text-gray-900">{product.productType || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Size
                    </label>
                    <p className="text-gray-900">{product.size || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      UOM
                    </label>
                    <p className="text-gray-900">{product.uom || 'Each'}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Status</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium text-gray-500">Quarterly Bonus</span>
                    <span className="text-sm">
                      {product.quarterlyBonusEligible ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Pricing & Units */}
          <div className="space-y-6">
            {/* Pricing Information */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Pricing
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Unit Price
                  </label>
                  <p className="text-gray-900 text-2xl font-bold text-green-700">
                    {product.price ? `$${product.price.toFixed(2)}` : 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Retail Price
                  </label>
                  <p className="text-gray-900 text-lg">
                    {product.retailPrice ? `$${product.retailPrice.toFixed(2)}` : 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    MSRP
                  </label>
                  <p className="text-gray-900 text-lg">
                    {product.msrp ? `$${product.msrp.toFixed(2)}` : 'N/A'}
                  </p>
                </div>

                {product.price && product.retailPrice && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Margin:</span>
                      <span className="font-semibold text-green-600">
                        {(((product.retailPrice - product.price) / product.retailPrice) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Unit Configuration */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Box className="w-5 h-5 mr-2" />
                Unit Configuration
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Units Per Case:</span>
                  <span className="font-semibold">{product.unitsPerCase || 'N/A'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Display Boxes Per Case:</span>
                  <span className="font-semibold">{product.displayBoxesPerCase || 'N/A'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Units Per Display Box:</span>
                  <span className="font-semibold">{product.unitsPerDisplayBox || 'N/A'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Cases Per Pallet:</span>
                  <span className="font-semibold">{product.casesPerPallet || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* UPC Codes */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Barcode className="w-5 h-5 mr-2" />
                UPC Codes
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Unit UPC
                  </label>
                  <p className="text-gray-900 font-mono text-xs">{product.upc?.unit || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Display Box UPC
                  </label>
                  <p className="text-gray-900 font-mono text-xs">{product.upc?.displayBox || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Master Case UPC
                  </label>
                  <p className="text-gray-900 font-mono text-xs">{product.upc?.masterCase || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Dimensions & Metadata */}
          <div className="space-y-6">
            {/* Master Case Dimensions */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Ruler className="w-5 h-5 mr-2" />
                Master Case Dimensions
              </h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Length (in)
                    </label>
                    <p className="text-gray-900">{product.masterCaseDimensions?.length || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Width (in)
                    </label>
                    <p className="text-gray-900">{product.masterCaseDimensions?.width || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Height (in)
                    </label>
                    <p className="text-gray-900">{product.masterCaseDimensions?.height || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Weight (lbs)
                    </label>
                    <p className="text-gray-900">{product.masterCaseDimensions?.weight || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Display Box Dimensions */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Truck className="w-5 h-5 mr-2" />
                Display Box Dimensions
              </h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Length (in)
                    </label>
                    <p className="text-gray-900">{product.displayBoxDimensions?.length || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Width (in)
                    </label>
                    <p className="text-gray-900">{product.displayBoxDimensions?.width || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Height (in)
                    </label>
                    <p className="text-gray-900">{product.displayBoxDimensions?.height || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Weight (lbs)
                    </label>
                    <p className="text-gray-900">{product.displayBoxDimensions?.weight || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes & Metadata */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Notes & Metadata
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Notes
                  </label>
                  <p className="text-gray-900">{product.notes || 'No notes'}</p>
                </div>

                <div className="pt-3 border-t border-gray-200 space-y-2 text-xs">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Created: {product.createdAt ? new Date(product.createdAt).toLocaleString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Updated: {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
