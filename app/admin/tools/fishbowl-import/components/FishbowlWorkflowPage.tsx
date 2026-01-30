'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, Database, BarChart3, RefreshCw } from 'lucide-react';

interface NormalizationMapping {
  csvHeader: string;
  normalizedHeader: string;
  confidence: 'exact' | 'alias' | 'fuzzy';
}

interface PreviewData {
  totalRows: number;
  totalOrders: number;
  previewOrders: any[];
  summaryByRep: any[];
  globalIssues: any;
  readyToImport: boolean;
}

export default function FishbowlWorkflowPage() {
  // Step management (like Copper import)
  const [step, setStep] = useState<'idle' | 'normalizing' | 'preview' | 'importing' | 'validating' | 'complete'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  // File upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Step results
  const [normalizationResult, setNormalizationResult] = useState<any>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  // Manual field mapping overrides
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});

  // Step 1: Upload and Normalize CSV
  const handleUploadAndNormalize = async () => {
    if (!csvFile) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('🔄 Analyzing CSV headers...');

    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch('/api/fishbowl/normalize-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Normalization failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'CSV normalization failed');
      }

      setNormalizationResult(data);
      
      // Initialize field mappings from auto-detected mappings
      const initialMappings: Record<string, string> = {};
      data.mappings.forEach((m: NormalizationMapping) => {
        initialMappings[m.normalizedHeader] = m.csvHeader;
      });
      setFieldMappings(initialMappings);
      
      setStep('normalizing');
      setProgress(`✅ Successfully mapped ${data.mappings.length} fields`);
    } catch (err: any) {
      setError(err.message);
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  // Update a field mapping
  const handleFieldMappingChange = (systemField: string, csvColumn: string) => {
    setFieldMappings(prev => ({
      ...prev,
      [systemField]: csvColumn
    }));
  };

  // Step 2: Preview Data (with custom mappings)
  const handlePreviewData = async () => {
    if (!csvFile) {
      setError('CSV file missing');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('🔍 Analyzing data quality...');

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('fieldMappings', JSON.stringify(fieldMappings));

      const response = await fetch('/api/fishbowl/preview-import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Preview failed');
      }

      setPreviewData(data.preview);
      setStep('preview');
      setProgress('✅ Data preview ready');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Import to Firestore
  const handleImport = async () => {
    if (!csvFile) {
      setError('CSV file missing');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('📦 Importing to Firestore...');
    setStep('importing');

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('fieldMappings', JSON.stringify(fieldMappings));

      const response = await fetch('/api/fishbowl/import-unified', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportResult(data);
      setProgress('✅ Import complete');
      
      // Automatically move to validation
      setTimeout(() => handleValidation(), 1000);
    } catch (err: any) {
      setError(err.message);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Validate Commission Data
  const handleValidation = async () => {
    setLoading(true);
    setError(null);
    setProgress('📊 Validating commission data...');
    setStep('validating');

    try {
      const currentDate = new Date();
      const commissionMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      const response = await fetch('/api/validate-commission-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionMonth }),
      });

      const data = await response.json();

      if (response.ok) {
        setValidationResult(data);
        setStep('complete');
        setProgress('✅ Validation complete!');
      } else {
        throw new Error(data.error || 'Validation failed');
      }
    } catch (err: any) {
      console.error('Validation failed:', err);
      setError(`Validation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('idle');
    setCsvFile(null);
    setNormalizationResult(null);
    setPreviewData(null);
    setImportResult(null);
    setValidationResult(null);
    setError(null);
    setProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600" />
              Fishbowl Data Import
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Import sales data from Fishbowl → Validate → Calculate Commissions
            </p>
          </div>
          <a
            href="/admin/tools"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Tools
          </a>
        </div>

        {/* Workflow Steps Indicator */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Workflow Steps</h3>
          <div className="flex items-center justify-between">
            {[
              { id: 'idle', label: '1. Upload CSV', icon: Upload },
              { id: 'normalizing', label: '2. Review Fields', icon: FileText },
              { id: 'preview', label: '3. Preview Data', icon: CheckCircle },
              { id: 'importing', label: '4. Import', icon: Database },
              { id: 'validating', label: '5. Validate', icon: BarChart3 },
              { id: 'complete', label: '6. Done', icon: CheckCircle },
            ].map((s, idx, arr) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`flex flex-col items-center ${
                  step === s.id ? 'text-blue-600' : 
                  arr.findIndex(x => x.id === step) > idx ? 'text-green-600' : 
                  'text-gray-400'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    step === s.id ? 'border-blue-600 bg-blue-50' :
                    arr.findIndex(x => x.id === step) > idx ? 'border-green-600 bg-green-50' :
                    'border-gray-300 bg-white'
                  }`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <p className="text-xs mt-2 text-center whitespace-nowrap">{s.label}</p>
                </div>
                {idx < arr.length - 1 && (
                  <ArrowRight className={`w-4 h-4 mx-2 ${
                    arr.findIndex(x => x.id === step) > idx ? 'text-green-600' : 'text-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {progress && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 font-medium">{progress}</p>
          </div>
        )}

        {/* Step 1: Upload CSV */}
        {step === 'idle' && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Upload Fishbowl CSV Export</h2>
            <p className="text-sm text-gray-600 mb-6">
              Upload your Fishbowl/Conversite CSV export file. The system will automatically detect and normalize column headers.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 What gets processed:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Customers</strong> - Account IDs, names, and account types</li>
                <li>• <strong>Sales Orders</strong> - Order numbers, dates, sales reps</li>
                <li>• <strong>Line Items</strong> - Products, quantities, revenue, costs</li>
                <li>• <strong>Auto-mapping</strong> - Flexible column names (works with any export format)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    setCsvFile(e.target.files?.[0] || null);
                    setError(null);
                  }}
                  disabled={loading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                />
                {csvFile && (
                  <p className="mt-2 text-sm text-green-600">
                    ✅ Selected: {csvFile.name} ({(csvFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <button
                onClick={handleUploadAndNormalize}
                disabled={!csvFile || loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Analyzing CSV...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Analyze CSV Headers
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review Field Mappings */}
        {step === 'normalizing' && normalizationResult && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Review Field Mappings</h2>
            <p className="text-sm text-gray-600 mb-6">
              CSV headers have been automatically mapped to system fields. Review the mappings below.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700 font-medium">CSV Fields Detected</div>
                <div className="text-3xl font-bold text-blue-900">{normalizationResult.originalHeaders.length}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-700 font-medium">Fields Mapped</div>
                <div className="text-3xl font-bold text-green-900">{normalizationResult.mappings.length}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-700 font-medium">Rows to Import</div>
                <div className="text-3xl font-bold text-purple-900">{normalizationResult.stats.totalRows.toLocaleString()}</div>
              </div>
            </div>

            {/* Interactive Field Mappings Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <div className="bg-blue-50 px-4 py-3 border-b border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900">🔧 Configure Field Mappings</h3>
                <p className="text-xs text-blue-700 mt-1">Select which CSV column maps to each system field. Change any incorrect mappings.</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System Field (Required)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CSV Column</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Auto-Detected</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Required Fields */}
                    {[
                      'Sales order Number',
                      'Sales Order ID',
                      'Account ID',
                      'Customer Name',
                      'Sales Rep',
                      'Issued date',
                      'SO Item ID',
                      'SO Item Product Number',
                      'Total Price'
                    ].map((systemField) => {
                      const currentMapping = fieldMappings[systemField];
                      const autoMapping = normalizationResult.mappings.find((m: NormalizationMapping) => m.normalizedHeader === systemField);
                      const usedColumns = Object.values(fieldMappings).filter(col => col && col !== currentMapping);
                      
                      return (
                        <tr key={systemField} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {systemField}
                            {!currentMapping && (
                              <span className="ml-2 text-red-600 text-xs">⚠️ Not mapped</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={currentMapping || ''}
                              onChange={(e) => handleFieldMappingChange(systemField, e.target.value)}
                              className={`w-full px-3 py-2 border rounded text-sm ${
                                !currentMapping ? 'border-red-300 bg-red-50' : 'border-gray-300'
                              }`}
                            >
                              <option value="">-- Select CSV Column --</option>
                              {normalizationResult.originalHeaders.map((header: string) => (
                                <option 
                                  key={header} 
                                  value={header}
                                  disabled={usedColumns.includes(header)}
                                >
                                  {header} {usedColumns.includes(header) ? '(already mapped)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {autoMapping && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                autoMapping.confidence === 'exact' ? 'bg-green-100 text-green-800' :
                                autoMapping.confidence === 'alias' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {autoMapping.confidence}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Validation Warning */}
            {Object.keys(fieldMappings).filter(k => !fieldMappings[k]).length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-900 font-semibold">
                  ⚠️ Warning: {Object.keys(fieldMappings).filter(k => !fieldMappings[k]).length} required fields are not mapped
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  You must map all required fields before continuing to preview.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePreviewData}
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Analyzing Data...
                  </>
                ) : (
                  <>
                    Continue to Preview
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview Data */}
        {step === 'preview' && previewData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 3: Preview Import Data</h2>
            <p className="text-sm text-gray-600 mb-6">
              Review the data summary and quality checks before importing.
            </p>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700 font-medium">Total Orders</div>
                <div className="text-3xl font-bold text-blue-900">{previewData.totalOrders}</div>
                <div className="text-xs text-blue-600 mt-1">{previewData.totalRows} line items</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-700 font-medium">Data Quality</div>
                <div className="text-3xl font-bold text-green-900">
                  {previewData.readyToImport ? '✅' : '⚠️'}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {previewData.readyToImport ? 'Ready to import' : 'Issues detected'}
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-700 font-medium">Total Revenue</div>
                <div className="text-2xl font-bold text-purple-900">
                  ${previewData.summaryByRep.reduce((sum: number, rep: any) => sum + rep.revenue, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Revenue by Rep */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue by Sales Rep</h3>
              <div className="grid grid-cols-2 gap-3">
                {previewData.summaryByRep.slice(0, 8).map((rep: any) => (
                  <div key={rep.rep} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-900">{rep.rep}</div>
                        <div className="text-xs text-gray-500">{rep.orders} orders</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{rep.formatted}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    Confirm & Import
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4/5: Import & Validation Progress */}
        {(step === 'importing' || step === 'validating') && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {step === 'importing' ? 'Step 4: Importing to Firestore' : 'Step 5: Validating Commission Data'}
            </h2>
            <div className="space-y-4">
              <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
              </div>
              <p className="text-sm text-gray-600 text-center">{progress}</p>
            </div>
          </div>
        )}

        {/* Step 6: Complete with Validation Results */}
        {step === 'complete' && validationResult && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-green-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Import Complete!
            </h2>
            
            {/* Import Stats */}
            {importResult && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-700 font-medium">Customers</div>
                  <div className="text-2xl font-bold text-blue-900">{importResult.stats.customersCreated}</div>
                  <div className="text-xs text-blue-600">created/updated</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-700 font-medium">Orders</div>
                  <div className="text-2xl font-bold text-green-900">{importResult.stats.ordersCreated}</div>
                  <div className="text-xs text-green-600">imported</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-sm text-purple-700 font-medium">Line Items</div>
                  <div className="text-2xl font-bold text-purple-900">{importResult.stats.itemsCreated}</div>
                  <div className="text-xs text-purple-600">product records</div>
                </div>
              </div>
            )}

            {/* Validation Results */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4">📊 Data Validation Summary</h3>
              
              {/* Revenue Total */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600">Total Estimated Revenue (2026-01)</div>
                <div className="text-4xl font-bold text-green-700">
                  ${validationResult.totalEstimatedRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Revenue by Rep */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {validationResult.repBreakdown?.slice(0, 10).map((rep: any) => (
                  <div key={rep.repId} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-900">{rep.repName}</div>
                        <div className="text-xs text-gray-500">{rep.orderCount} orders</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          ${rep.estimatedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        {rep.status === 'inactive' && (
                          <div className="text-xs text-yellow-600">Inactive</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleReset}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
