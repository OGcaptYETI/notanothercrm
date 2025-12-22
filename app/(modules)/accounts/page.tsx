'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useAccounts, useRefreshCRMData, useAccountCounts } from '@/lib/crm/hooks';
import { DataTable } from '@/components/crm/DataTable';
import type { UnifiedAccount } from '@/lib/crm/dataService';
import { 
  Plus,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';

export default function AccountsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, isFetching } = useAccounts({ pageSize: 50 });
  const { data: counts } = useAccountCounts();
  const { refreshAccounts } = useRefreshCRMData();
  
  const accounts = data?.data || [];
  const totalAccounts = counts?.total || 0;
  const activeAccounts = counts?.active || 0;
  const fishbowlAccounts = counts?.fishbowl || 0;

  // Define table columns
  const columns = useMemo<ColumnDef<UnifiedAccount, any>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Account Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/accounts/${row.original.id}`);
              }}
              className="font-medium text-primary-600 hover:text-primary-700 hover:underline text-left truncate"
            >
              {row.original.name}
            </button>
          </div>
        ),
      },
      {
        id: 'accountNumber',
        accessorKey: 'accountNumber',
        header: 'Account #',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const colors: Record<string, string> = {
            active: 'bg-green-100 text-green-700',
            inactive: 'bg-gray-100 text-gray-600',
            prospect: 'bg-blue-100 text-blue-700',
            churned: 'bg-red-100 text-red-700',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: 'Source',
        cell: ({ getValue }) => {
          const source = getValue() as string;
          const colors: Record<string, string> = {
            fishbowl: 'bg-purple-100 text-purple-700',
            copper: 'bg-orange-100 text-orange-700',
            manual: 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[source] || 'bg-gray-100'}`}>
              {source}
            </span>
          );
        },
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ getValue }) => {
          const phone = getValue() as string;
          return phone ? (
            <a href={`tel:${phone}`} className="flex items-center gap-1 text-gray-600 hover:text-[#93D500]">
              <Phone className="w-3.5 h-3.5" />
              {phone}
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => {
          const email = getValue() as string;
          return email ? (
            <a href={`mailto:${email}`} className="flex items-center gap-1 text-gray-600 hover:text-[#93D500] truncate max-w-[200px]">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'location',
        accessorFn: (row) => `${row.shippingCity || ''} ${row.shippingState || ''}`.trim(),
        header: 'Location',
        cell: ({ row }) => {
          const city = row.original.shippingCity;
          const state = row.original.shippingState;
          return city || state ? (
            <div className="flex items-center gap-1 text-gray-600">
              <MapPin className="w-3.5 h-3.5" />
              {city && `${city}, `}{state}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'region',
        accessorKey: 'region',
        header: 'Region',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'segment',
        accessorKey: 'segment',
        header: 'Segment',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'accountType',
        accessorKey: 'accountType',
        header: 'Type',
        cell: ({ getValue }) => {
          const types = getValue() as string[] | undefined;
          return types?.length ? (
            <div className="flex flex-wrap gap-1">
              {types.slice(0, 2).map((t, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{t}</span>
              ))}
              {types.length > 2 && (
                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">+{types.length - 2}</span>
              )}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'salesPerson',
        accessorKey: 'salesPerson',
        header: 'Sales Rep',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'totalOrders',
        accessorKey: 'totalOrders',
        header: 'Orders',
        cell: ({ getValue }) => {
          const orders = getValue() as number | undefined;
          return orders !== undefined ? (
            <div className="flex items-center gap-1 text-gray-600">
              <ShoppingCart className="w-3.5 h-3.5" />
              {orders.toLocaleString()}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'totalSpent',
        accessorKey: 'totalSpent',
        header: 'Total Spent',
        cell: ({ getValue }) => {
          const spent = getValue() as number | undefined;
          return spent !== undefined ? (
            <div className="flex items-center gap-1 text-gray-700 font-medium">
              <DollarSign className="w-3.5 h-3.5" />
              {spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'paymentTerms',
        accessorKey: 'paymentTerms',
        header: 'Payment Terms',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'customerPriority',
        accessorKey: 'customerPriority',
        header: 'Priority',
        cell: ({ getValue }) => {
          const priority = getValue() as string;
          if (!priority) return <span className="text-gray-400">-</span>;
          const colors: Record<string, string> = {
            '1': 'bg-red-100 text-red-700',
            '2': 'bg-orange-100 text-orange-700',
            '3': 'bg-yellow-100 text-yellow-700',
            '4': 'bg-blue-100 text-blue-700',
            '5': 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || 'bg-gray-100'}`}>
              P{priority}
            </span>
          );
        },
      },
    ],
    []
  );

  // Handle row click - navigate to account detail
  const handleRowClick = (account: UnifiedAccount) => {
    router.push(`/accounts/${account.id}`);
  };

  // Auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your customer accounts from Fishbowl and Copper
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshAccounts()}
            disabled={isFetching}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => router.push('/accounts/new')}
            className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Accounts</div>
          <div className="text-2xl font-bold text-gray-900">{totalAccounts.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-bold text-green-600">
            {activeAccounts.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">From Fishbowl</div>
          <div className="text-2xl font-bold text-purple-600">
            {fishbowlAccounts.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={accounts}
        columns={columns}
        loading={isLoading}
        onRowClick={handleRowClick}
        tableId="accounts"
        searchPlaceholder="Search accounts by name, email, phone, location..."
        pageSize={50}
      />
    </div>
  );
}
