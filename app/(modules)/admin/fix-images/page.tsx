'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import toast from 'react-hot-toast';

export default function FixImagesPage() {
  const router = useRouter();
  const [fixing, setFixing] = useState(false);
  const [fixingQuotes, setFixingQuotes] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [quoteResult, setQuoteResult] = useState<any>(null);

  const handleFixProducts = async () => {
    if (!confirm('This will fix all product image URLs in Firestore to ensure they have the https:// protocol. Continue?')) {
      return;
    }

    setFixing(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/fix-product-images', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        toast.success(`Fixed ${data.fixed} products, skipped ${data.skipped}`);
      } else {
        toast.error(data.error || 'Failed to fix images');
      }
    } catch (error) {
      console.error('Error fixing images:', error);
      toast.error('Failed to fix images');
    } finally {
      setFixing(false);
    }
  };

  const handleFixQuotes = async () => {
    if (!confirm('This will fix image URLs in all existing quote line items. Continue?')) {
      return;
    }

    setFixingQuotes(true);
    setQuoteResult(null);

    try {
      const response = await fetch('/api/admin/fix-quote-images', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setQuoteResult(data);
        toast.success(`Fixed ${data.fixed} quotes, skipped ${data.skipped}`);
      } else {
        toast.error(data.error || 'Failed to fix quote images');
      }
    } catch (error) {
      console.error('Error fixing quote images:', error);
      toast.error('Failed to fix quote images');
    } finally {
      setFixingQuotes(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <AdminBreadcrumbs
          currentPage="Fix Product Images"
        />

        <button
          onClick={() => router.push('/admin')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </button>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon className="w-6 h-6 text-[#93D500]" />
            <h1 className="text-2xl font-bold text-gray-900">Fix Product Images</h1>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">What this does:</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Scans all products in Firestore</li>
                <li>Fixes image URLs missing the <code className="bg-blue-100 px-1 rounded">https://</code> protocol</li>
                <li>Updates both <code className="bg-blue-100 px-1 rounded">imageUrl</code> and <code className="bg-blue-100 px-1 rounded">images</code> array</li>
                <li>Ensures Firebase Storage URLs load correctly</li>
              </ul>
            </div>

            <button
              onClick={handleFixProducts}
              disabled={fixing}
              className="btn btn-primary w-full mb-3"
            >
              {fixing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Fixing Product Images...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Fix All Product Images
                </>
              )}
            </button>

            <button
              onClick={handleFixQuotes}
              disabled={fixingQuotes}
              className="btn btn-secondary w-full"
            >
              {fixingQuotes ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Fixing Quote Images...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Fix Existing Quote Images
                </>
              )}
            </button>

            {result && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <h3 className="font-semibold text-green-900 mb-2">Product Results:</h3>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>Total Products:</strong> {result.total}</p>
                  <p><strong>Fixed:</strong> {result.fixed}</p>
                  <p><strong>Skipped (already correct):</strong> {result.skipped}</p>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold text-red-900">Errors:</p>
                      <ul className="list-disc list-inside">
                        {result.errors.map((error: string, i: number) => (
                          <li key={i} className="text-red-800">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {quoteResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <h3 className="font-semibold text-green-900 mb-2">Quote Results:</h3>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>Total Quotes:</strong> {quoteResult.total}</p>
                  <p><strong>Fixed:</strong> {quoteResult.fixed}</p>
                  <p><strong>Skipped (already correct):</strong> {quoteResult.skipped}</p>
                  {quoteResult.errors && quoteResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold text-red-900">Errors:</p>
                      <ul className="list-disc list-inside">
                        {quoteResult.errors.map((error: string, i: number) => (
                          <li key={i} className="text-red-800">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
