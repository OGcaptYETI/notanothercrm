'use client';

import { useState, useRef } from 'react';

export default function FishbowlImportPage() {
  const [error, setError] = useState<string | null>(null);
  const [unifiedFile, setUnifiedFile] = useState<File | null>(null);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedResult, setUnifiedResult] = useState<any>(null);
  
  const unifiedInputRef = useRef<HTMLInputElement>(null);


  const handleUnifiedImport = async () => {
    if (!unifiedFile) {
      setError('Please select the unified Conversight export file');
      return;
    }

    setUnifiedLoading(true);
    setUnifiedResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', unifiedFile);

      const response = await fetch('/api/fishbowl/import-unified', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unified import failed');
      }

      setUnifiedResult(data);
      setUnifiedFile(null);
      if (unifiedInputRef.current) {
        unifiedInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUnifiedLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            🐟 Fishbowl Data Import
          </h1>
          <a
            href="/admin"
            className="text-sm text-kanva-green hover:underline"
          >
            ← Back to Admin
          </a>
        </div>

        {/* UNIFIED IMPORT - NEW! */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🚀</span>
            <div>
              <h2 className="text-2xl font-bold text-purple-900">Unified Fishbowl Import (RECOMMENDED)</h2>
              <p className="text-sm text-purple-700">Import Conversight report - Creates Customers, Orders, AND Line Items in one go!</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900 font-semibold">
                ✨ <strong>ONE UPLOAD = EVERYTHING!</strong>
              </p>
              <ul className="mt-2 text-sm text-green-800 space-y-1">
                <li>✅ Creates/updates Customers (deduplicated by Customer id)</li>
                <li>✅ Creates/updates Sales Orders (with Customer link)</li>
                <li>✅ Creates Line Items (with Product, Revenue, Cost data)</li>
                <li>✅ All properly linked together!</li>
                <li>✅ ~60K rows in 2-3 minutes</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Conversight Export (Fishbowl_SalesOrder_export_10.8.2025.csv)
              </label>
              <input
                ref={unifiedInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setUnifiedFile(e.target.files?.[0] || null)}
                disabled={unifiedLoading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50"
              />
              {unifiedFile && (
                <p className="mt-2 text-sm text-green-600">
                  ✅ Selected: {unifiedFile.name} ({(unifiedFile.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>

            <button
              onClick={handleUnifiedImport}
              disabled={unifiedLoading || !unifiedFile}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
            >
              {unifiedLoading ? '⏳ Importing All Data...' : '🚀 Import Everything (Unified)'}
            </button>

            {unifiedLoading && (
              <div className="mt-4 space-y-2">
                <div className="w-full bg-purple-100 rounded-full h-3 overflow-hidden">
                  <div className="h-3 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-[progress_1.5s_ease-in-out_infinite]" />
                </div>
                <p className="text-xs text-purple-800">
                  Import in progress… This unified file usually takes 3–5 minutes to process. You can leave this tab open and we’ll show the results here when it’s done.
                </p>
              </div>
            )}
          </div>

          {unifiedResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-3">
                ✅ Unified Import Complete!
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Customers</p>
                  <p className="text-xl font-bold text-blue-600">
                    {((unifiedResult.stats.customersCreated || 0) + (unifiedResult.stats.customersUpdated || 0)).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {unifiedResult.stats.customersCreated || 0} new, {unifiedResult.stats.customersUpdated || 0} updated
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Sales Orders</p>
                  <p className="text-xl font-bold text-green-600">
                    {(unifiedResult.stats.ordersCreated + unifiedResult.stats.ordersUpdated).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {unifiedResult.stats.ordersCreated} new, {unifiedResult.stats.ordersUpdated} updated
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Line Items</p>
                  <p className="text-xl font-bold text-purple-600">
                    {unifiedResult.stats.itemsCreated.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Product-level data</p>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              ❌ Import Failed
            </h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-4 text-sm text-red-600 hover:text-red-900"
            >
              Clear Error
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📚 How It Works
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Upload your Conversight export CSV file (Fishbowl_SalesOrder_export_XX.X.XXXX.csv)</li>
            <li>Click "🚀 Import Everything (Unified)" to start the process</li>
            <li>The system parses and validates all data (dates, numbers, custom fields)</li>
            <li>Data is stored in Firestore collections:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><code className="bg-blue-100 px-1 rounded">fishbowl_customers</code></li>
                <li><code className="bg-blue-100 px-1 rounded">fishbowl_so</code> (sales orders)</li>
                <li><code className="bg-blue-100 px-1 rounded">fishbowl_soitems</code> (line items)</li>
              </ul>
            </li>
            <li>Creates new records or updates existing ones (upsert by Customer ID and SO Number)</li>
            <li>All data properly linked: Customers → Orders → Line Items</li>
          </ol>
          
          <div className="mt-4 p-3 bg-white rounded border border-blue-300">
            <p className="text-sm text-blue-900 font-medium">
              ✨ <strong>Benefits of Unified Import:</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-blue-800 mt-1 ml-2">
              <li>One file imports everything - no multiple uploads needed</li>
              <li>Handles ~60K rows in 2-3 minutes</li>
              <li>Automatic deduplication by Customer ID</li>
              <li>All relationships maintained (Customer → Order → Items)</li>
              <li>Secure - files processed in memory</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
