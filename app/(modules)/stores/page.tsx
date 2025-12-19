"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Search,
  ArrowUpDown,
  MapPin,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ImportResult {
  success: boolean;
  message: string;
  details: {
    total: number;
    processed: number;
    updated: number;
    created: number;
    skipped: number;
    errorCount: number;
    sampleErrors: Array<{row: number, error: string, storeName?: string}>;
    hasMoreErrors: number;
  };
}

interface Store {
  id: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  phone?: string;
  website?: string;
  email?: string;
  fishbowl_id?: string;
  copper_id?: string;
  onStoreLocator: boolean;
  activeCustomer: boolean;
  copper_company_id?: number;
}

type SortKey = 'name' | 'city' | 'state' | 'postal_code' | 'onStoreLocator' | 'activeCustomer';

export default function StoresPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list');
  
  // Import tab state
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // List tab state
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'on_locator' | 'active_only'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
    key: 'name', 
    direction: 'asc' 
  });

  // Define fetchStores before useEffect
  const fetchStores = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      console.log('Fetching stores...');
      const idToken = await user.getIdToken(true);
      
      const response = await fetch('/api/stores', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        console.log(`Setting ${data.data?.length || 0} stores`);
        setStores(data.data || []);
        toast.success(`Loaded ${data.data?.length || 0} stores`);
      } else {
        console.error('API error:', data);
        toast.error(data.error || data.message || 'Failed to fetch stores');
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  // useEffect hooks
  useEffect(() => {
    if (activeTab === 'list' && user) {
      fetchStores();
    }
  }, [activeTab, user]);

  useEffect(() => {
    // Filter stores based on status filter
    let filtered = stores.filter(store => {
      if (filterStatus === 'on_locator') {
        return store.onStoreLocator;
      } else if (filterStatus === 'active_only') {
        return store.activeCustomer && !store.onStoreLocator;
      }
      return true; // 'all'
    });

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(store => (
        store.name?.toLowerCase().includes(searchLower) ||
        store.address_line_1?.toLowerCase().includes(searchLower) ||
        store.city?.toLowerCase().includes(searchLower) ||
        store.state?.toLowerCase().includes(searchLower) ||
        store.postal_code?.includes(searchTerm) ||
        store.fishbowl_id?.toLowerCase().includes(searchLower) ||
        store.copper_id?.toLowerCase().includes(searchLower)
      ));
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredStores(sorted);
  }, [searchTerm, stores, sortConfig, filterStatus]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-kanva-green mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Early return for non-admin users
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only admins can access store management.</p>
        </div>
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const handleToggleStoreLocator = async (store: Store) => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    if (!store.copper_company_id) {
      toast.error('No Copper company ID found for this store');
      return;
    }

    try {
      const idToken = await user.getIdToken(true);
      const newValue = !store.onStoreLocator;

      const response = await fetch('/api/stores/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          copper_company_id: store.copper_company_id,
          value: newValue
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle store locator');
      }

      // Update local state
      setStores(prev => prev.map(s => 
        s.id === store.id ? { ...s, onStoreLocator: newValue } : s
      ));

      toast.success(newValue ? 'Added to store locator' : 'Removed from store locator');
    } catch (error) {
      console.error('Error toggling store locator:', error);
      toast.error('Failed to update store locator status');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setImportResult(null);
    } else {
      toast.error('Please select a CSV file');
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setImporting(true);

    try {
      console.log('Getting auth token...');
      const idToken = await user.getIdToken(true);
      console.log('Token retrieved successfully');

      const csvText = await file.text();
      console.log('CSV loaded, making API request...');

      const response = await fetch('/api/import/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ csvText }),
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Import failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log out and log back in.';
          } else {
            errorMessage = `Server error (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setImportResult(data);
      
      if (data.success && data.details.processed > 0) {
        toast.success(`Successfully processed ${data.details.processed} stores!`);
        // Switch to list tab to show results
        setTimeout(() => {
          setActiveTab('list');
          fetchStores();
        }, 2000);
      } else {
        toast.error(data.message || 'No stores were processed');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import stores');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Store Management
          </h1>
          <p className="text-gray-600">
            Import and manage store locations for the store locator
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'list'
                  ? 'border-kanva-green text-kanva-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Store List
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'import'
                  ? 'border-kanva-green text-kanva-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Import Stores
            </button>
          </nav>
        </div>

        {/* Store List Tab */}
        {activeTab === 'list' && (
          <div>
            {/* Filter Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                }`}
              >
                All Active Customers
              </button>
              <button
                onClick={() => setFilterStatus('on_locator')}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'on_locator'
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                }`}
              >
                On Store Locator
              </button>
              <button
                onClick={() => setFilterStatus('active_only')}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'active_only'
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                }`}
              >
                Active but Not on Locator
              </button>
            </div>

            <div className="flex justify-between items-center mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, address, city, state, ZIP, or IDs..."
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kanva-green focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={fetchStores}
                disabled={loading}
                className="ml-4 btn-kanva flex items-center"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-kanva-green" />
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th 
                          className="text-left p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">
                            Name
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                            {getSortIndicator('name') && <span className="ml-1">{getSortIndicator('name')}</span>}
                          </div>
                        </th>
                        <th className="text-left p-3 font-medium text-gray-700">Address</th>
                        <th 
                          className="text-left p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('city')}
                        >
                          <div className="flex items-center">
                            City
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                            {getSortIndicator('city') && <span className="ml-1">{getSortIndicator('city')}</span>}
                          </div>
                        </th>
                        <th 
                          className="text-left p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('state')}
                        >
                          <div className="flex items-center">
                            State
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                            {getSortIndicator('state') && <span className="ml-1">{getSortIndicator('state')}</span>}
                          </div>
                        </th>
                        <th 
                          className="text-left p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('postal_code')}
                        >
                          <div className="flex items-center">
                            ZIP
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                            {getSortIndicator('postal_code') && <span className="ml-1">{getSortIndicator('postal_code')}</span>}
                          </div>
                        </th>
                        <th className="text-left p-3 font-medium text-gray-700">Fishbowl ID</th>
                        <th className="text-left p-3 font-medium text-gray-700">Copper ID</th>
                        <th 
                          className="text-center p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('activeCustomer')}
                        >
                          <div className="flex items-center justify-center">
                            Active
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                            {getSortIndicator('activeCustomer') && <span className="ml-1">{getSortIndicator('activeCustomer')}</span>}
                          </div>
                        </th>
                        <th 
                          className="text-center p-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('onStoreLocator')}
                        >
                          <div className="flex items-center justify-center">
                            On Locator
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                            {getSortIndicator('onStoreLocator') && <span className="ml-1">{getSortIndicator('onStoreLocator')}</span>}
                          </div>
                        </th>
                        <th className="text-center p-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStores.length > 0 ? (
                        filteredStores.map((store, index) => (
                          <tr key={index} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="p-3 font-medium">{store.name}</td>
                            <td className="p-3">
                              <div>{store.address_line_1}</div>
                              {store.address_line_2 && (
                                <div className="text-gray-500">{store.address_line_2}</div>
                              )}
                            </td>
                            <td className="p-3">{store.city}</td>
                            <td className="p-3">{store.state}</td>
                            <td className="p-3">{store.postal_code}</td>
                            <td className="p-3 text-xs text-gray-600">{store.fishbowl_id || '-'}</td>
                            <td className="p-3 text-xs text-gray-600">{store.copper_id || '-'}</td>
                            <td className="p-3 text-center">
                              {store.activeCustomer && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => isAdmin && handleToggleStoreLocator(store)}
                                  disabled={!isAdmin}
                                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all shadow-sm ${
                                    isAdmin ? 'focus:outline-none focus:ring-2 focus:ring-kanva-green focus:ring-offset-2 cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-50'
                                  } ${
                                    store.onStoreLocator ? 'bg-kanva-green' : 'bg-gray-400'
                                  }`}
                                  title={
                                    !isAdmin 
                                      ? 'Admin only' 
                                      : store.onStoreLocator 
                                        ? 'ON - Click to remove from store locator' 
                                        : 'OFF - Click to add to store locator'
                                  }
                                >
                                  <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                      store.onStoreLocator ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className={`text-xs font-semibold ${store.onStoreLocator ? 'text-kanva-green' : 'text-gray-500'}`}>
                                  {store.onStoreLocator ? 'ON' : 'OFF'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {store.copper_company_id && (
                                <a
                                  href={`https://app.copper.com/companies/562111/app#/organization/${store.copper_company_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-kanva-green hover:text-kanva-green-dark"
                                  title="View in Copper"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="text-center py-12 text-gray-500">
                            {searchTerm ? (
                              <>No stores found matching "{searchTerm}"</>
                            ) : (
                              <>No stores found. Import stores to get started.</>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {filteredStores.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                    Showing {filteredStores.length} of {stores.length} stores
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="max-w-4xl">
            {/* Upload Section */}
            <div className="card mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV</h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-kanva-green transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer text-kanva-green hover:text-kanva-green-dark font-medium"
                >
                  Choose CSV file
                </label>
                
                {file && (
                  <div className="mt-4 text-sm text-gray-600">
                    Selected: <span className="font-medium">{file.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">CSV Format:</h3>
                <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
{`Stockist ,Name,Address line 1,Address line 2,City,State/Province,Postal code,Country,...
loc_xxx,Store Name,123 Main St,,Seattle,WA,98101,United States,...`}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  The import will match stores by name and address to existing Copper companies.
                </p>
              </div>

              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="w-full mt-6 btn-kanva disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import & Update Copper'}
              </button>
            </div>

            {/* Results Section */}
            {importResult && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Results</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{importResult.details.total}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{importResult.details.processed}</div>
                    <div className="text-sm text-gray-600">Processed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{importResult.details.updated}</div>
                    <div className="text-sm text-gray-600">Updated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{importResult.details.skipped}</div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{importResult.details.errorCount}</div>
                    <div className="text-sm text-gray-600">Errors</div>
                  </div>
                </div>

                {importResult.details.sampleErrors.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-sm font-medium text-red-900 mb-2">
                      Sample Errors {importResult.details.hasMoreErrors > 0 && `(showing 10 of ${importResult.details.errorCount})`}:
                    </h3>
                    <ul className="text-sm text-red-700 space-y-1">
                      {importResult.details.sampleErrors.map((error, index) => (
                        <li key={index}>
                          • Row {error.row}{error.storeName && ` (${error.storeName})`}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {importResult.success && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ {importResult.message}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
