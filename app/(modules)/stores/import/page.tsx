"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ImportResult {
  total: number;
  matched: number;
  updated: number;
  failed: number;
  errors: string[];
  matches: Array<{
    csvName: string;
    copperCompanyId?: number;
    copperCompanyName?: string;
    status: 'matched' | 'not_found' | 'updated' | 'failed';
    error?: string;
  }>;
}

export default function ImportPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only admins can import store data.</p>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setResult(null);
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
      // Get Firebase Auth token with error handling
      console.log('Getting auth token...');
      let idToken;
      
      try {
        idToken = await user.getIdToken(true);
        console.log('Token retrieved successfully');
      } catch (tokenError) {
        console.error('Failed to get auth token:', tokenError);
        toast.error('Authentication failed. Please try logging out and back in.');
        return;
      }

      if (!idToken) {
        toast.error('Could not retrieve authentication token');
        return;
      }

      // Read CSV file as text
      const csvText = await file.text();
      console.log('CSV loaded, making API request...');

      // Call Next.js API route (works in both dev and production)
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
          const textResponse = await response.text();
          console.error('Received non-JSON response:', textResponse.substring(0, 200));
          
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log out and log back in.';
          } else {
            errorMessage = `Server error (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setResult(data);
      
      if (data.updated > 0) {
        toast.success(`Successfully updated ${data.updated} companies!`);
      } else {
        toast.error('No companies were updated');
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Import Store Locator Data
          </h1>
          <p className="text-gray-600">
            Upload your CSV file to mark companies as "On Store Locator" in Copper
          </p>
        </div>

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
        {result && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Results</h2>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{result.total}</div>
                <div className="text-sm text-gray-600">Total Stores</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{result.matched}</div>
                <div className="text-sm text-gray-600">Matched</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{result.updated}</div>
                <div className="text-sm text-gray-600">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{result.failed}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-medium text-red-900 mb-2">Errors:</h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {result.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-red-600">... and {result.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-700">CSV Store Name</th>
                    <th className="text-left p-2 font-medium text-gray-700">Copper Company</th>
                    <th className="text-center p-2 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matches.map((match, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="p-2">{match.csvName}</td>
                      <td className="p-2">
                        {match.copperCompanyName || (
                          <span className="text-gray-400">Not found</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {match.status === 'updated' && (
                          <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                        )}
                        {match.status === 'matched' && (
                          <AlertCircle className="w-5 h-5 text-blue-600 mx-auto" />
                        )}
                        {match.status === 'not_found' && (
                          <XCircle className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                        {match.status === 'failed' && (
                          <XCircle className="w-5 h-5 text-red-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
