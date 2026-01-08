'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, ArrowRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import toast from 'react-hot-toast';

export default function MigrateLegacyDataPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState<any>(null);

  if (userProfile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600">Admin access required</p>
        </div>
      </div>
    );
  }

  async function handleMigrate(dataType: 'tiers' | 'shipping' | 'all') {
    setMigrating(true);
    setResults(null);

    try {
      const response = await fetch('/api/admin/migrate-legacy-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataType })
      });

      const data = await response.json();
      setResults(data);

      if (data.success) {
        toast.success(`Successfully migrated: ${data.migrated.join(', ')}`);
      } else {
        toast.error('Migration completed with errors');
      }
    } catch (error: any) {
      toast.error('Migration failed: ' + error.message);
      setResults({ success: false, errors: [{ error: error.message }] });
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AdminBreadcrumbs currentPage="Migrate Legacy Data" />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Migrate Legacy Data</h1>
        </div>
        <p className="text-sm text-gray-600">
          Migrate data from legacy JSON files to Firestore collections
        </p>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Important</h3>
            <p className="text-sm text-amber-800">
              This will migrate data from <code className="bg-amber-100 px-1 rounded">/public/quotes/data/</code> JSON files 
              to Firestore collections. Existing Firestore data will be overwritten.
            </p>
          </div>
        </div>
      </div>

      {/* Migration Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleMigrate('tiers')}
          disabled={migrating}
          className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <h3 className="font-semibold text-gray-900 mb-2">Migrate Tiers</h3>
          <p className="text-sm text-gray-600 mb-4">
            Pricing tiers configuration
          </p>
          <div className="flex items-center text-primary-600 text-sm font-medium">
            Migrate <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </button>

        <button
          onClick={() => handleMigrate('shipping')}
          disabled={migrating}
          className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <h3 className="font-semibold text-gray-900 mb-2">Migrate Shipping</h3>
          <p className="text-sm text-gray-600 mb-4">
            Shipping zones and rates
          </p>
          <div className="flex items-center text-primary-600 text-sm font-medium">
            Migrate <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </button>

        <button
          onClick={() => handleMigrate('all')}
          disabled={migrating}
          className="bg-primary-600 text-white rounded-xl p-6 hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <h3 className="font-semibold mb-2">Migrate All</h3>
          <p className="text-sm text-primary-100 mb-4">
            All legacy data at once
          </p>
          <div className="flex items-center text-white text-sm font-medium">
            Migrate All <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className={`rounded-xl p-6 ${results.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start gap-3">
            {results.success ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${results.success ? 'text-green-900' : 'text-red-900'}`}>
                {results.success ? 'Migration Successful' : 'Migration Failed'}
              </h3>
              
              {results.migrated && results.migrated.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-green-800 mb-1">Migrated:</p>
                  <ul className="text-sm text-green-700 list-disc list-inside">
                    {results.migrated.map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {results.errors && results.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {results.errors.map((err: any, idx: number) => (
                      <li key={idx}>
                        <strong>{err.type}:</strong> {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className="flex justify-center">
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to Admin Panel
        </button>
      </div>
    </div>
  );
}
