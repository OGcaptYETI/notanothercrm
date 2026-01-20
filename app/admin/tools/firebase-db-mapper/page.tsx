'use client';

import { useState } from 'react';
import { Database, Search, Download, AlertCircle, CheckCircle, Copy } from 'lucide-react';

interface CollectionMetadata {
  success: boolean;
  collectionName: string;
  totalDocumentsAnalyzed: number;
  summary: {
    totalFields: number;
    idFieldsCount: number;
    referenceFieldsCount: number;
    timestampFieldsCount: number;
    standardFieldsCount: number;
    relationshipsDetected: number;
  };
  fields: {
    all: any[];
    idFields: any[];
    referenceFields: any[];
    timestampFields: any[];
    standardFields: any[];
  };
  relationships: Array<{
    field: string;
    type: string;
    targetCollection?: string;
    confidence: string;
  }>;
  metadata: {
    analyzedAt: string;
    sampleSize: number;
  };
}

export default function FirebaseDBMapperPage() {
  const [collectionName, setCollectionName] = useState('');
  const [sampleSize, setSampleSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<CollectionMetadata | null>(null);
  const [metadataOutput, setMetadataOutput] = useState<string>('');

  // Common Firestore collections
  const commonCollections = [
    'copper_companies',
    'copper_people',
    'fishbowl_customers',
    'fishbowl_sales_orders',
    'fishbowl_sales_order_items',
    'customer_sales_summary',
    'users',
    'monthly_commissions',
    'commission_details',
    'justcall_calls',
  ];

  const handleAnalyze = async () => {
    if (!collectionName.trim()) {
      setError('Please enter a collection name');
      return;
    }

    setLoading(true);
    setError(null);
    setMetadata(null);

    try {
      const response = await fetch('/api/firestore-collection-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: collectionName.trim(),
          sampleSize,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze collection');
      }

      const data = await response.json();
      setMetadata(data);
      setMetadataOutput(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setError(err.message || 'Failed to analyze collection');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Firebase DB Collection Mapper</h1>
          </div>
          <p className="text-gray-600">
            Analyze Firestore collections to understand data structure, field types, and relationships
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Collection to Analyze</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Collection Name
              </label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Enter collection name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sample Size
              </label>
              <input
                type="number"
                value={sampleSize}
                onChange={(e) => setSampleSize(parseInt(e.target.value) || 100)}
                min="10"
                max="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Select Common Collections
            </label>
            <div className="flex flex-wrap gap-2">
              {commonCollections.map((collection) => (
                <button
                  key={collection}
                  onClick={() => setCollectionName(collection)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  {collection}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !collectionName.trim()}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyzing Collection...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Analyze Collection
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {metadata && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">Total Fields</p>
                <p className="text-2xl font-bold text-gray-900">{metadata.summary.totalFields}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">ID Fields</p>
                <p className="text-2xl font-bold text-blue-600">{metadata.summary.idFieldsCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">References</p>
                <p className="text-2xl font-bold text-purple-600">{metadata.summary.referenceFieldsCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">Timestamps</p>
                <p className="text-2xl font-bold text-green-600">{metadata.summary.timestampFieldsCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">Relationships</p>
                <p className="text-2xl font-bold text-orange-600">{metadata.summary.relationshipsDetected}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">Docs Analyzed</p>
                <p className="text-2xl font-bold text-gray-900">{metadata.totalDocumentsAnalyzed}</p>
              </div>
            </div>

            {/* Relationships */}
            {metadata.relationships.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔗 Detected Relationships</h3>
                <div className="space-y-2">
                  {metadata.relationships.map((rel, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-blue-600">{rel.field}</code>
                          <span className="text-gray-400">→</span>
                          {rel.targetCollection && (
                            <code className="text-sm font-mono text-purple-600">{rel.targetCollection}</code>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {rel.type} • Confidence: {rel.confidence}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        rel.confidence === 'high' ? 'bg-green-100 text-green-700' :
                        rel.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {rel.confidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Field Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ID Fields */}
              {metadata.fields.idFields.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🔑 ID & Key Fields</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {metadata.fields.idFields.map((field, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-sm font-mono text-blue-700">{field.fieldName}</code>
                          <span className="text-xs text-gray-500">{field.frequency}</span>
                        </div>
                        {field.sampleValues.length > 0 && (
                          <p className="text-xs text-gray-600 truncate">
                            Sample: {field.sampleValues[0]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp Fields */}
              {metadata.fields.timestampFields.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Date & Time Fields</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {metadata.fields.timestampFields.map((field, idx) => (
                      <div key={idx} className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-sm font-mono text-green-700">{field.fieldName}</code>
                          <span className="text-xs text-gray-500">{field.frequency}</span>
                        </div>
                        {field.sampleValues.length > 0 && (
                          <p className="text-xs text-gray-600 truncate">
                            Sample: {String(field.sampleValues[0])}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Complete JSON Output */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">📋 Complete Metadata (Copy This)</h3>
                <button
                  onClick={() => copyToClipboard(metadataOutput)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-auto">
                <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap">
                  {metadataOutput}
                </pre>
              </div>
            </div>

            {/* What's Included Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">📊 What's Included:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>All Fields</strong> - Complete list with types and sample values</li>
                <li>• <strong>ID Fields</strong> - Fields that likely reference other collections</li>
                <li>• <strong>References</strong> - Direct Firestore document references</li>
                <li>• <strong>Timestamps</strong> - Date and time fields for tracking</li>
                <li>• <strong>Relationships</strong> - Detected associations between collections</li>
                <li>• <strong>Field Frequency</strong> - How many documents have each field populated</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
