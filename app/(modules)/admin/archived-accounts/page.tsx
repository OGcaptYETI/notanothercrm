'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Archive, RotateCcw, Search, AlertCircle } from 'lucide-react';
import { DataTable } from '@/components/crm/DataTable';
import { ColumnDef } from '@tanstack/react-table';

interface ArchivedAccount {
  id: string;
  name: string;
  accountNumber?: string;
  mergedInto?: string;
  archivedAt?: Date;
  archivedBy?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  totalOrders?: number;
  totalSpent?: number;
}

export default function ArchivedAccountsPage() {
  const [accounts, setAccounts] = useState<ArchivedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArchivedAccounts();
  }, []);

  const loadArchivedAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const q = query(
        collection(db, 'copper_companies'),
        where('isArchived', '==', true)
      );

      const snapshot = await getDocs(q);
      
      const archivedAccounts: ArchivedAccount[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          accountNumber: data.accountNumber || data.cf_713477,
          mergedInto: data.mergedInto,
          archivedAt: data.archivedAt?.toDate(),
          archivedBy: data.archivedBy,
          phone: data.phone,
          email: data.email,
          city: data.city || data.shippingCity,
          state: data.state || data.shippingState,
          totalOrders: data.cf_698403,
          totalSpent: data.cf_698404,
        };
      });

      setAccounts(archivedAccounts);
    } catch (err) {
      console.error('Error loading archived accounts:', err);
      setError('Failed to load archived accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (accountId: string) => {
    if (!confirm('Are you sure you want to restore this account? It will become active again.')) {
      return;
    }

    try {
      setRestoring(accountId);
      setError(null);

      const accountRef = doc(db, 'copper_companies', accountId);
      
      await updateDoc(accountRef, {
        cf_712751: true, // Active Customer flag
        isArchived: false,
        mergedInto: null,
        archivedAt: null,
        archivedBy: null,
        restoredAt: new Date(),
      });

      // Remove from list
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      
      alert('Account restored successfully!');
    } catch (err) {
      console.error('Error restoring account:', err);
      setError('Failed to restore account');
    } finally {
      setRestoring(null);
    }
  };

  const columns: ColumnDef<ArchivedAccount>[] = [
    {
      accessorKey: 'name',
      header: 'Account Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'accountNumber',
      header: 'Account #',
      cell: ({ row }) => (
        <span className="text-gray-600">{row.original.accountNumber || '-'}</span>
      ),
    },
    {
      accessorKey: 'mergedInto',
      header: 'Merged Into',
      cell: ({ row }) => (
        row.original.mergedInto ? (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            Account {row.original.mergedInto}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location',
      cell: ({ row }) => {
        const location = [row.original.city, row.original.state].filter(Boolean).join(', ');
        return <span className="text-gray-600">{location || '-'}</span>;
      },
    },
    {
      accessorKey: 'totalOrders',
      header: 'Orders',
      cell: ({ row }) => (
        <span className="text-gray-600">{row.original.totalOrders || 0}</span>
      ),
    },
    {
      accessorKey: 'totalSpent',
      header: 'Total Spent',
      cell: ({ row }) => (
        <span className="text-gray-600">
          {row.original.totalSpent ? `$${row.original.totalSpent.toLocaleString()}` : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'archivedAt',
      header: 'Archived',
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {row.original.archivedAt?.toLocaleDateString() || '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          onClick={() => handleRestore(row.original.id)}
          disabled={restoring === row.original.id}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {restoring === row.original.id ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              Restoring...
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              Restore
            </>
          )}
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Archive className="w-8 h-8 text-gray-600" />
            <h1 className="text-3xl font-bold text-gray-900">Archived Accounts</h1>
          </div>
          <p className="text-gray-600">
            View and restore accounts that have been archived or merged into other accounts
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Archived</p>
                <p className="text-3xl font-bold text-gray-900">{accounts.length}</p>
              </div>
              <Archive className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Merged Accounts</p>
                <p className="text-3xl font-bold text-gray-900">
                  {accounts.filter(a => a.mergedInto).length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-sm">M</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Other Archived</p>
                <p className="text-3xl font-bold text-gray-900">
                  {accounts.filter(a => !a.mergedInto).length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Archive className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <DataTable
            data={accounts}
            columns={columns}
            loading={loading}
            pageSize={50}
            tableId="archived-accounts"
            searchPlaceholder="Search archived accounts..."
          />
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">About Archived Accounts</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Archived accounts are hidden from the main accounts list</li>
                <li>Accounts marked as &quot;Merged Into&quot; were combined with another account</li>
                <li>Restoring an account will make it active again and visible in the accounts list</li>
                <li>All original data (orders, contacts, deals) is preserved when archived</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
