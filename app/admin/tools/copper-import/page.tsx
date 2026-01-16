'use client';

import { useState } from 'react';
import { RefreshCw, Database, CheckCircle, AlertCircle, Eye, Download, Settings, ArrowRight } from 'lucide-react';

interface CopperCompany {
  id: number;
  name: string;
  'Account Type cf_675914'?: any;
  'Account Order ID cf_698467'?: string;
  'Account ID cf_713477'?: string;
  'Region cf_680701'?: string;
  'Active Customer cf_712751'?: any;
  assignee_id?: number;
  [key: string]: any; // Allow all Copper fields
}

interface FieldMetadata {
  fieldName: string;
  displayName: string;
  count: number;
  sampleValues: any[];
  type: string;
  isCustomField: boolean;
  fieldId?: number;
  dataType?: string;
  options?: Array<{ id: number; name: string }>;
  frequency: string;
}

interface FieldMapping {
  copperField: string;
  ourField: string;
  transform?: string;
  enabled: boolean;
}

interface StagingData {
  companies: CopperCompany[];
  stats: {
    totalFetched: number;
    activeFetched: number;
  };
}

interface SyncResult {
  updated: number;
  created: number;
  errors: number;
  errorDetails?: any[];
}

export default function CopperImportPage() {
  const [step, setStep] = useState<'idle' | 'fetching' | 'metadata' | 'mapping' | 'staging' | 'syncing' | 'updating' | 'complete'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stagingData, setStagingData] = useState<StagingData | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [progress, setProgress] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [showAddField, setShowAddField] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [customerSyncProgress, setCustomerSyncProgress] = useState<any>(null);
  const [protectedFields, setProtectedFields] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Poll for sync progress (Step 1)
  const pollSyncProgress = async () => {
    try {
      const response = await fetch('/api/sync-copper-api-fresh');
      if (response.ok) {
        const progressData = await response.json();
        console.log('📊 Progress Update:', progressData); // Debug log
        setSyncProgress(progressData);
        
        // Continue polling if still in progress
        if (progressData.inProgress) {
          setTimeout(pollSyncProgress, 1000); // Poll every second
        }
      }
    } catch (err) {
      console.error('Error polling progress:', err);
    }
  };

  // Poll for customer sync progress (Step 5)
  const pollCustomerSyncProgress = async () => {
    try {
      const response = await fetch('/api/sync-copper-customers');
      if (response.ok) {
        const progressData = await response.json();
        console.log('📊 Customer Sync Progress:', progressData); // Debug log
        setCustomerSyncProgress(progressData);
        
        // Continue polling if still in progress
        if (progressData.inProgress) {
          setTimeout(pollCustomerSyncProgress, 1000); // Poll every second
        }
      }
    } catch (err) {
      console.error('Error polling customer sync progress:', err);
    }
  };

  // Step 1: Pull from Copper API
  const handleFetchFromAPI = async () => {
    setLoading(true);
    setError(null);
    // Keep step as 'idle' so the UI stays visible during fetch
    setProgress('🔄 Fetching active customers from Copper API...');
    setSyncProgress({ inProgress: true, status: 'fetching', message: 'Starting...', totalProcessed: 0, totalToProcess: 0 });

    // Start polling for progress immediately
    pollSyncProgress();

    try {
      const response = await fetch('/api/sync-copper-api-fresh', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from Copper API');
      }

      const data = await response.json();
      
      // Store in staging (data is already in Firestore, but we'll fetch it for preview)
      setProgress('✅ Fetched from API! Loading preview...');
      
      // Fetch from Firestore for preview
      const previewResponse = await fetch('/api/copper-companies/preview');
      if (previewResponse.ok) {
        const previewData = await previewResponse.json();
        setStagingData({
          companies: previewData.companies || [],
          stats: {
            totalFetched: data.totalFetched || 0,
            activeFetched: data.activeFetched || 0,
          },
        });
      } else {
        // Fallback: show stats without preview
        setStagingData({
          companies: [],
          stats: {
            totalFetched: data.totalFetched || 0,
            activeFetched: data.activeFetched || 0,
          },
        });
      }
      
      setStep('metadata');
      setProgress(`✅ Ready to sync ${data.activeFetched} active customers`);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch from Copper API');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Update fishbowl_customers with account types from Copper
  const handleUpdateFishbowlCustomers = async () => {
    setLoading(true);
    setError(null);
    // Keep step as 'staging' so the UI stays visible during update
    setProgress('🔄 Updating fishbowl_customers with account types from Copper...');
    setCustomerSyncProgress({ inProgress: true, status: 'loading', message: 'Starting...', totalCompanies: 0, processedCompanies: 0 });

    // Start polling for progress immediately
    pollCustomerSyncProgress();

    try {
      const response = await fetch('/api/sync-copper-customers?live=true', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update fishbowl_customers');
      }

      const data = await response.json();
      setUpdateResult(data);
      setStep('complete');
      setProgress(`✅ Updated ${data.wouldUpdate} fishbowl_customers with account types!`);
    } catch (err: any) {
      setError(err.message || 'Failed to update fishbowl_customers');
      setStep('staging');
    } finally {
      setLoading(false);
    }
  };

  // Step 1.5: Fetch field metadata
  const handleFetchMetadata = async () => {
    setLoading(true);
    setError(null);
    setProgress('🔍 Analyzing available Copper fields...');

    try {
      const response = await fetch('/api/copper-fields-metadata');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch field metadata');
      }

      const data = await response.json();
      setMetadata(data);
      
      // Load existing mappings
      const mappingsResponse = await fetch('/api/copper-field-mappings');
      if (mappingsResponse.ok) {
        const mappingsData = await mappingsResponse.json();
        setFieldMappings(mappingsData.mappings || []);
      }
      
      // Load protected fields
      const protectedResponse = await fetch('/api/copper-field-protection');
      if (protectedResponse.ok) {
        const protectedData = await protectedResponse.json();
        setProtectedFields(protectedData);
      }
      
      setStep('mapping');
      setProgress(`✅ Found ${data.summary.standardFieldsCount} standard fields and ${data.summary.customFieldsCount} custom fields`);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch field metadata');
      setStep('metadata');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save field mappings and proceed
  const handleSaveMappings = async () => {
    setLoading(true);
    setError(null);
    setProgress('� Validating field mappings...');

    try {
      // Validate against protected fields first
      const validationResponse = await fetch('/api/copper-field-protection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: fieldMappings }),
      });

      if (validationResponse.ok) {
        const validation = await validationResponse.json();
        setValidationResult(validation);

        if (!validation.canProceed) {
          setError(validation.message);
          setLoading(false);
          return;
        }
      }

      setProgress('💾 Saving field mappings...');

      const response = await fetch('/api/copper-field-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: fieldMappings }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save field mappings');
      }

      setStep('staging');
      setProgress('✅ Field mappings saved! Ready to sync.');
    } catch (err: any) {
      setError(err.message || 'Failed to save field mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('idle');
    setLoading(false);
    setError(null);
    setStagingData(null);
    setSyncResult(null);
    setUpdateResult(null);
    setProgress('');
    setMetadata(null);
    setFieldMappings([]);
    setSyncProgress(null);
    setCustomerSyncProgress(null);
  };

  const normalizeAccountType = (type: any): string => {
    if (!type) return 'Unknown';
    if (Array.isArray(type) && type.length > 0) {
      const first = type[0];
      if (typeof first === 'number') {
        if (first === 2063862) return 'Wholesale';
        if (first === 1981470) return 'Distributor';
        if (first === 2066840) return 'Retail';
      }
      return String(first);
    }
    return String(type);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Database className="w-8 h-8 text-orange-600" />
              Copper CRM Data Sync
            </h1>
            <p className="text-gray-600 mt-2">
              Pull active customers from Copper API → Verify → Sync to Firestore → Update Account Types
            </p>
          </div>
          <a href="/admin/tools" className="text-sm text-kanva-green hover:underline">
            ← Back to Tools
          </a>
        </div>

        {/* Workflow Steps */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Steps</h2>
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
              step === 'idle' || step === 'fetching' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm font-medium">1. Pull API</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
              step === 'metadata' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">2. Review Fields</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
              step === 'mapping' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">3. Map Fields</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
              step === 'staging' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">4. Verify</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
              step === 'updating' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <Database className="w-4 h-4" />
              <span className="text-sm font-medium">5. Update</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
              step === 'complete' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">6. Done</span>
            </div>
          </div>
        </div>

        {/* Step 1: Pull from API */}
        {step === 'idle' && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Pull Active Customers from Copper API</h2>
            <p className="text-sm text-gray-600 mb-6">
              This will fetch ALL active customers directly from Copper CRM and store them in the <code className="bg-gray-100 px-2 py-1 rounded">copper_companies</code> collection.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">What gets pulled:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>ALL</strong> company fields from Copper CRM</li>
                <li>• Standard fields (name, address, phone, email, etc.)</li>
                <li>• ALL custom fields with their IDs</li>
                <li>• Complete raw data for field mapping</li>
                <li>• Metadata for review and configuration</li>
              </ul>
            </div>

            <button
              onClick={handleFetchFromAPI}
              disabled={loading}
              className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Fetching from Copper API...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Pull from Copper API
                </>
              )}
            </button>

            {/* Step 1 Progress - Simple visible indicator */}
            {loading && (
              <div className="mt-6 p-4 bg-orange-50 border-2 border-orange-500 rounded-lg">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-6 h-6 text-orange-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-900">
                      {syncProgress?.message || 'Fetching from Copper API...'}
                    </p>
                    {syncProgress?.totalToProcess > 0 && (
                      <p className="text-xs text-orange-700 mt-1">
                        Processing: {syncProgress.totalProcessed} / {syncProgress.totalToProcess} companies
                      </p>
                    )}
                  </div>
                  {syncProgress?.totalToProcess > 0 && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-orange-600">
                        {Math.round((syncProgress.totalProcessed / syncProgress.totalToProcess) * 100)}%
                      </p>
                      <p className="text-xs text-orange-700">Complete</p>
                    </div>
                  )}
                </div>
                {syncProgress?.totalToProcess > 0 && (
                  <div className="mt-3 w-full bg-orange-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-orange-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min((syncProgress.totalProcessed / syncProgress.totalToProcess) * 100, 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {progress && !syncProgress?.inProgress && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">{progress}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Field Metadata */}
        {step === 'metadata' && stagingData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Review Available Copper Fields</h2>
            <p className="text-sm text-gray-600 mb-6">
              Data has been pulled from Copper. Now let&apos;s analyze all available fields to understand what data we have.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">📊 What happens next:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Analyze all fields across {stagingData.stats.activeFetched} companies</li>
                <li>• Identify standard fields (name, address, phone, etc.)</li>
                <li>• Discover ALL custom fields with their IDs</li>
                <li>• See sample values for each field</li>
                <li>• Prepare for field mapping configuration</li>
              </ul>
            </div>

            <button
              onClick={handleFetchMetadata}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Analyzing Fields...
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5" />
                  Analyze All Copper Fields
                </>
              )}
            </button>

            {progress && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">{progress}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Field Mapping Configuration */}
        {step === 'mapping' && metadata && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 3: Configure Field Mappings</h2>
            <p className="text-sm text-gray-600 mb-6">
              Map Copper CRM fields to your database fields. This determines how data flows from Copper into your system.
            </p>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700 font-medium">Standard Fields</div>
                <div className="text-3xl font-bold text-blue-900">{metadata.summary.standardFieldsCount}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-700 font-medium">Custom Fields</div>
                <div className="text-3xl font-bold text-purple-900">{metadata.summary.customFieldsCount}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-700 font-medium">Companies Analyzed</div>
                <div className="text-3xl font-bold text-green-900">{metadata.totalCompaniesAnalyzed}</div>
              </div>
            </div>

            {/* Standard Fields */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Standard Copper Fields</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample Values</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metadata.fields.standard.slice(0, 15).map((field: FieldMetadata) => (
                        <tr key={field.fieldName} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            <div className="font-semibold">{field.displayName}</div>
                            <div className="text-xs text-gray-500">{field.fieldName}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{field.type}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{field.frequency}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                            {field.sampleValues.slice(0, 2).map((v, i) => (
                              <span key={i} className="mr-2">
                                {typeof v === 'object' ? JSON.stringify(v).substring(0, 50) : String(v).substring(0, 50)}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Custom Copper Fields</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-purple-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Field ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Frequency</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Sample Values</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metadata.fields.custom.map((field: FieldMetadata) => (
                        <tr key={field.fieldName} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            <div className="font-semibold text-purple-900">{field.displayName}</div>
                            <div className="text-xs text-gray-500 font-mono">{field.fieldName}</div>
                            {field.dataType && (
                              <div className="text-xs text-purple-600 mt-1">Type: {field.dataType}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{field.type}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{field.frequency}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                            {field.sampleValues.slice(0, 3).map((v, i) => (
                              <span key={i} className="mr-2 bg-purple-50 px-2 py-1 rounded">
                                {typeof v === 'object' ? JSON.stringify(v).substring(0, 40) : String(v).substring(0, 40)}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Field Mapping Configuration */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Configure Field Mappings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Current mappings are shown below. You can modify these to match your database schema.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Default mappings are loaded. Review and adjust as needed before proceeding.
                </p>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto p-4">
                  {fieldMappings.map((mapping, idx) => {
                    // Find the field metadata to get display name
                    const fieldMeta = metadata ? 
                      [...(metadata.fields?.standard || []), ...(metadata.fields?.custom || [])].find(
                        (f: FieldMetadata) => f.fieldName === mapping.copperField
                      ) : null;
                    
                    return (
                      <div key={idx} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                        <div className="flex-1">
                          {fieldMeta && fieldMeta.displayName !== fieldMeta.fieldName ? (
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{fieldMeta.displayName}</div>
                              <div className="text-xs font-mono text-blue-600">{mapping.copperField}</div>
                            </div>
                          ) : (
                            <div className="text-sm font-mono text-blue-600">{mapping.copperField}</div>
                          )}
                        </div>
                        <span className="text-gray-400">→</span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={mapping.ourField}
                          onChange={(e) => {
                            const newMappings = [...fieldMappings];
                            newMappings[idx].ourField = e.target.value;
                            setFieldMappings(newMappings);
                          }}
                          className="w-full px-3 py-1 text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Database field name"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={mapping.enabled}
                          onChange={(e) => {
                            const newMappings = [...fieldMappings];
                            newMappings[idx].enabled = e.target.checked;
                            setFieldMappings(newMappings);
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <button
                          onClick={() => {
                            const newMappings = fieldMappings.filter((_, i) => i !== idx);
                            setFieldMappings(newMappings);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
                
                {/* Add New Field Mapping */}
                <div className="bg-gray-50 p-4 border-t border-gray-200">
                  {!showAddField ? (
                    <button
                      onClick={() => setShowAddField(true)}
                      className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-2"
                    >
                      <span className="text-lg">+</span> Add New Field Mapping
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          onChange={(e) => {
                            if (e.target.value) {
                              const field = [...metadata.fields.standard, ...metadata.fields.custom].find(
                                (f: FieldMetadata) => f.fieldName === e.target.value
                              );
                              if (field) {
                                setFieldMappings([...fieldMappings, {
                                  copperField: field.fieldName,
                                  ourField: field.displayName.toLowerCase().replace(/\s+/g, '_'),
                                  enabled: true,
                                }]);
                                setShowAddField(false);
                                e.target.value = '';
                              }
                            }
                          }}
                        >
                          <option value="">Select a Copper field...</option>
                          <optgroup label="Standard Fields">
                            {metadata.fields.standard.map((field: FieldMetadata) => (
                              <option key={field.fieldName} value={field.fieldName}>
                                {field.displayName} ({field.fieldName})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Custom Fields">
                            {metadata.fields.custom.map((field: FieldMetadata) => (
                              <option key={field.fieldName} value={field.fieldName}>
                                {field.displayName} ({field.fieldName})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <button
                          onClick={() => setShowAddField(false)}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleSaveMappings}
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Saving Mappings...
                  </>
                ) : (
                  <>
                    <Settings className="w-5 h-5" />
                    Save Mappings & Continue
                  </>
                )}
              </button>
              <button
                onClick={() => setStep('metadata')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Back
              </button>
            </div>

            {progress && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">{progress}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Staging - Verify Data */}
        {step === 'staging' && stagingData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Verify Data from Copper</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700 font-medium">Total Fetched</div>
                <div className="text-3xl font-bold text-blue-900">{stagingData.stats.totalFetched.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-700 font-medium">Active Customers</div>
                <div className="text-3xl font-bold text-green-900">{stagingData.stats.activeFetched.toLocaleString()}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-sm text-orange-700 font-medium">Ready to Sync</div>
                <div className="text-3xl font-bold text-orange-900">{stagingData.stats.activeFetched.toLocaleString()}</div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Preview (First 20 Companies)</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Order ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stagingData.companies.slice(0, 20).map((company, idx) => (
                        <tr key={company.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{company.name}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              normalizeAccountType(company['Account Type cf_675914']) === 'Wholesale' ? 'bg-purple-100 text-purple-800' :
                              normalizeAccountType(company['Account Type cf_675914']) === 'Distributor' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {normalizeAccountType(company['Account Type cf_675914'])}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{company['Account Order ID cf_698467'] || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{company['Region cf_680701'] || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Showing first 20 of {stagingData.stats.activeFetched.toLocaleString()} companies
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleUpdateFishbowlCustomers}
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Updating Customers...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    Update fishbowl_customers with Account Types
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>

            {/* Step 5 Progress - Simple visible indicator */}
            {loading && (
              <div className="mt-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-6 h-6 text-green-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-900">
                      {customerSyncProgress?.message || 'Starting sync...'}
                    </p>
                    {customerSyncProgress?.totalCompanies > 0 && (
                      <p className="text-xs text-green-700 mt-1">
                        Processing: {customerSyncProgress.processedCompanies} / {customerSyncProgress.totalCompanies} companies
                      </p>
                    )}
                    {(customerSyncProgress?.created > 0 || customerSyncProgress?.updated > 0) && (
                      <div className="flex gap-3 text-xs mt-1">
                        {customerSyncProgress.created > 0 && (
                          <span className="text-green-700">✓ {customerSyncProgress.created} created</span>
                        )}
                        {customerSyncProgress.updated > 0 && (
                          <span className="text-blue-700">↻ {customerSyncProgress.updated} updated</span>
                        )}
                        {customerSyncProgress.errors > 0 && (
                          <span className="text-red-700">✗ {customerSyncProgress.errors} errors</span>
                        )}
                      </div>
                    )}
                  </div>
                  {customerSyncProgress?.totalCompanies > 0 && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        {Math.round((customerSyncProgress.processedCompanies / customerSyncProgress.totalCompanies) * 100)}%
                      </p>
                      <p className="text-xs text-green-700">Complete</p>
                    </div>
                  )}
                </div>
                {customerSyncProgress?.totalCompanies > 0 && (
                  <div className="mt-3 w-full bg-green-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min((customerSyncProgress.processedCompanies / customerSyncProgress.totalCompanies) * 100, 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {progress && !customerSyncProgress?.inProgress && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">{progress}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && updateResult && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-900">Sync Complete!</h2>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700">Active Copper Companies</div>
                <div className="text-2xl font-bold text-blue-900">{updateResult.activeCompanies?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-700">Customers Updated</div>
                <div className="text-2xl font-bold text-green-900">{updateResult.wouldUpdate?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-700">No Changes</div>
                <div className="text-2xl font-bold text-gray-900">{updateResult.noChanges?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-700">Unmatched</div>
                <div className="text-2xl font-bold text-yellow-900">{updateResult.wouldCreate?.toLocaleString() || 0}</div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-green-900 mb-3">✅ What Was Updated</h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• <strong>{updateResult.wouldUpdate || 0}</strong> fishbowl_customers updated with account types from Copper</li>
                <li>• Account types now correctly set (Wholesale/Distributor/Retail)</li>
                <li>• Commission calculations will now use correct rates</li>
                <li>• Sales rep assignments synced from Copper</li>
              </ul>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">📋 Next Steps</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Re-run commission calculations for December 2025</li>
                <li>Verify commission totals are now correct</li>
                <li>Check that no customers are defaulting to &ldquo;Retail&rdquo; incorrectly</li>
                <li>Review commission rates by account type</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Run Another Sync
              </button>
              <a
                href="/admin/tools"
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium text-center"
              >
                Back to Tools
              </a>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        {step === 'idle' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 How This Works</h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div>
                <strong>Step 1: Pull from Copper API</strong>
                <p className="mt-1">Fetches all active customers directly from Copper CRM with their account types, regions, and sales rep assignments.</p>
              </div>
              <div>
                <strong>Step 2: Verify Data</strong>
                <p className="mt-1">Preview the fetched data in a table to ensure everything looks correct before syncing to Firestore.</p>
              </div>
              <div>
                <strong>Step 3: Update Customers</strong>
                <p className="mt-1">Matches Copper companies to fishbowl_customers and updates their account types. This ensures commission calculations use the correct rates.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
