'use client';

import { useState, useRef } from 'react';

export default function CopperImportPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [companiesFile, setCompaniesFile] = useState<File | null>(null);
  const [peopleFile, setPeopleFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [processed, setProcessed] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [matched, setMatched] = useState<number>(0);
  const [percent, setPercent] = useState<string>('0');
  
  const companiesInputRef = useRef<HTMLInputElement>(null);
  const peopleInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleImport = async () => {
    if (!companiesFile) {
      setError('Please select the Copper companies file to import');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress('📤 Uploading file...');
    setProcessed(0);
    setTotal(0);
    setMatched(0);
    setPercent('0');
    const start = Date.now();
    setStartTime(start);
    setElapsedTime(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append('companiesFile', companiesFile);

      // Use streaming endpoint for real-time updates
      const response = await fetch('/api/copper/import-companies-stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start import');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      // Read stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            
            if (data.type === 'status') {
              setProgress(data.message);
            } else if (data.type === 'total') {
              setTotal(data.total);
              setProgress(data.message);
            } else if (data.type === 'progress') {
              setProcessed(data.processed);
              setTotal(data.total);
              setMatched(data.matched);
              setPercent(data.percent);
              setProgress(`Processing: ${data.processed.toLocaleString()} / ${data.total.toLocaleString()} (${data.percent}%)`);
            } else if (data.type === 'complete') {
              setProgress('✅ Complete!');
              setResult(data);
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }

      // Clear file selection after successful import
      setCompaniesFile(null);
      if (companiesInputRef.current) companiesInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Import failed');
      setProgress('');
    } finally {
      setLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePeopleImport = async () => {
    if (!peopleFile) {
      setError('Please select the Copper people file to import');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress('📤 Uploading people file...');
    setProcessed(0);
    setTotal(0);
    setMatched(0);
    setPercent('0');
    const start = Date.now();
    setStartTime(start);
    setElapsedTime(0);

    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append('peopleFile', peopleFile);

      const response = await fetch('/api/copper-goals/import-people-stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start people import');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            
            if (data.type === 'status') {
              setProgress(data.message);
            } else if (data.type === 'total') {
              setTotal(data.total);
              setProgress(data.message);
            } else if (data.type === 'progress') {
              setProcessed(data.processed);
              setTotal(data.total);
              const created = data.created || 0;
              const updated = data.updated || 0;
              setMatched(created + updated);
              setPercent(data.percent);
              setProgress(`Processing: ${data.processed.toLocaleString()} / ${data.total.toLocaleString()} (${data.percent}%)`);
            } else if (data.type === 'complete') {
              setProgress('✅ Complete!');
              setResult(data);
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }

      setPeopleFile(null);
      if (peopleInputRef.current) peopleInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'People import failed');
      setProgress('');
    } finally {
      setLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            🔗 Copper Company Matching
          </h1>
          <a
            href="/admin"
            className="text-sm text-kanva-green hover:underline"
          >
            ← Back to Admin
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Import Copper Companies to Firestore</h2>
          <p className="text-sm text-gray-600 mb-4">
            First, load the Copper companies data into Firestore. This only needs to be done once.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏢 Copper Companies File (companies_10.2.xlsx)
              </label>
              <input
                ref={companiesInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setCompaniesFile(e.target.files?.[0] || null)}
                disabled={loading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
              />
              {companiesFile && (
                <p className="mt-2 text-sm text-green-600">
                  ✅ Selected: {companiesFile.name} ({(companiesFile.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={loading || !companiesFile}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
            >
              {loading ? '⏳ Importing to Firestore...' : '📥 Import Copper Companies'}
            </button>
          </div>

          {/* Progress Display */}
          {loading && (
            <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-900">Processing...</h3>
                <span className="text-sm text-blue-600 font-mono">
                  {elapsedTime}s elapsed
                </span>
              </div>
              
              {/* Real Progress Bar */}
              <div className="w-full bg-blue-200 rounded-full h-4 mb-4 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300" 
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
              
              {/* Progress Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{processed.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Processed</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{matched.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Matched</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{total.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
              </div>
              
              <p className="text-sm text-blue-800 font-medium mb-2">{progress}</p>
              
              {total > 0 && (
                <div className="text-xs text-blue-700">
                  <p className="font-semibold">{percent}% complete</p>
                  <p className="mt-1">Match rate: {total > 0 ? ((matched / processed * 100) || 0).toFixed(1) : 0}%</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 What this does:</strong> Matches Copper companies to your Firestore customers using Account Number, Order ID, or company name similarity.
            </p>
          </div>
        </div>

        {/* Step 2: Import Copper People */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 2: Import Copper People (Contacts) to Firestore</h2>
          <p className="text-sm text-gray-600 mb-4">
            Import contacts from Copper CRM to enable the Contacts page.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👥 Copper People File (people_export.xlsx)
              </label>
              <input
                ref={peopleInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setPeopleFile(e.target.files?.[0] || null)}
                disabled={loading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              {peopleFile && (
                <p className="mt-2 text-sm text-blue-600">
                  ✅ Selected: {peopleFile.name} ({(peopleFile.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>

            <button
              onClick={handlePeopleImport}
              disabled={loading || !peopleFile}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
            >
              {loading ? '⏳ Importing People...' : '👥 Import Copper People'}
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 What this does:</strong> Imports all Copper contacts with their company relationships, custom fields, and contact information to the copper_people collection.
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              ❌ Error
            </h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">
              ✅ Matching Complete!
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4">
                <div className="text-sm text-gray-600">Duration</div>
                <div className="text-2xl font-bold text-gray-900">{result.duration}</div>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <div className="text-sm text-gray-600">Match Rate</div>
                <div className="text-2xl font-bold text-green-600">{result.stats.matchRate}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Total Copper Companies</span>
                <span className="text-lg font-bold text-gray-900">{result.stats.totalCompanies.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">✅ Total Matched</span>
                <span className="text-lg font-bold text-green-600">{result.stats.matched.total.toLocaleString()}</span>
              </div>

              <div className="ml-4 space-y-2">
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-xs text-gray-600">By Account Number</span>
                  <span className="text-sm font-semibold text-gray-700">{result.stats.matched.byAccountNumber.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-xs text-gray-600">By Account Order ID</span>
                  <span className="text-sm font-semibold text-gray-700">{result.stats.matched.byAccountOrderId.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-xs text-gray-600">By Name (Fuzzy)</span>
                  <span className="text-sm font-semibold text-gray-700">{result.stats.matched.byName.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">⚠️ Unmatched</span>
                <span className="text-lg font-bold text-yellow-600">{result.stats.unmatched.toLocaleString()}</span>
              </div>

              {result.stats.errors > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-red-700">❌ Errors</span>
                    <span className="text-lg font-bold text-red-600">{result.stats.errors}</span>
                  </div>
                  {result.stats.errorSamples && result.stats.errorSamples.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      <p className="font-semibold mb-1">Sample errors:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {result.stats.errorSamples.map((err: any, i: number) => (
                          <li key={i}>{err.company}: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setResult(null)}
              className="mt-4 w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              Clear Results
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📚 How It Works
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Upload your Copper companies export (companies_10.2.xlsx)</li>
            <li>The system reads all Copper companies from the file</li>
            <li>Matches each company to Firestore customers using:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><strong>Account Number</strong> (most reliable)</li>
                <li><strong>Account Order ID</strong> (Fishbowl customer ID)</li>
                <li><strong>Company Name</strong> (fuzzy matching, 85%+ similarity)</li>
              </ul>
            </li>
            <li>Updates matched customers in Firestore with:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><code className="bg-blue-100 px-1 rounded">copperCompanyId</code></li>
                <li><code className="bg-blue-100 px-1 rounded">syncStatus: 'matched'</code></li>
                <li><code className="bg-blue-100 px-1 rounded">copperMatchMethod</code></li>
              </ul>
            </li>
            <li>Shows detailed statistics and match rate</li>
          </ol>
          
          <div className="mt-4 p-3 bg-white rounded border border-blue-300">
            <p className="text-sm text-blue-900 font-medium">
              ✨ <strong>After Matching:</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-blue-800 mt-1 ml-2">
              <li>Matched customers are ready for Copper sync</li>
              <li>Unmatched customers can be imported via CSV</li>
              <li>You can re-run this anytime with updated exports</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
