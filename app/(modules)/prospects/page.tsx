'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useProspects, useRefreshCRMData } from '@/lib/crm/hooks';
import { DataTable } from '@/components/crm/DataTable';
import type { UnifiedProspect } from '@/lib/crm/dataService';
import { 
  Plus,
  RefreshCw,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Thermometer,
  Calendar,
} from 'lucide-react';

export default function ProspectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: prospectsData, isLoading, isFetching } = useProspects();
  const prospects = prospectsData?.data || [];
  const { refreshProspects } = useRefreshCRMData();

  // Define table columns
  const columns = useMemo<ColumnDef<UnifiedProspect, any>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{row.original.name}</span>
          </div>
        ),
      },
      {
        id: 'companyName',
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1 text-gray-700">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            {getValue() || '-'}
          </div>
        ),
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const colors: Record<string, string> = {
            new: 'bg-blue-100 text-blue-700',
            contacted: 'bg-yellow-100 text-yellow-700',
            qualified: 'bg-green-100 text-green-700',
            unqualified: 'bg-gray-100 text-gray-600',
            converted: 'bg-purple-100 text-purple-700',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: 'leadTemperature',
        accessorKey: 'leadTemperature',
        header: 'Temperature',
        cell: ({ getValue }) => {
          const temp = getValue() as string;
          if (!temp) return <span className="text-gray-400">-</span>;
          const colors: Record<string, string> = {
            Hot: 'bg-red-100 text-red-700',
            Warm: 'bg-orange-100 text-orange-700',
            Cold: 'bg-blue-100 text-blue-700',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${colors[temp] || 'bg-gray-100'}`}>
              <Thermometer className="w-3 h-3" />
              {temp}
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
            copper_lead: 'bg-orange-100 text-orange-700',
            manual: 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[source] || 'bg-gray-100'}`}>
              {source === 'copper_lead' ? 'Copper' : source}
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
        accessorFn: (row) => `${row.city || ''} ${row.state || ''}`.trim(),
        header: 'Location',
        cell: ({ row }) => {
          const city = row.original.city;
          const state = row.original.state;
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
        id: 'followUpDate',
        accessorKey: 'followUpDate',
        header: 'Follow-up',
        cell: ({ getValue }) => {
          const date = getValue() as Date | undefined;
          if (!date) return <span className="text-gray-400">-</span>;
          const d = new Date(date);
          const isPast = d < new Date();
          return (
            <div className={`flex items-center gap-1 ${isPast ? 'text-red-600' : 'text-gray-600'}`}>
              <Calendar className="w-3.5 h-3.5" />
              {d.toLocaleDateString()}
            </div>
          );
        },
      },
      {
        id: 'tradeShowName',
        accessorKey: 'tradeShowName',
        header: 'Trade Show',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
    ],
    []
  );

  // Handle row click - navigate to prospect detail
  const handleRowClick = (prospect: UnifiedProspect) => {
    router.push(`/prospects/${prospect.id}`);
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
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your sales leads from Copper and manual entries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshProspects()}
            disabled={isFetching}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => router.push('/prospects/new')}
            className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Prospect
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Prospects</div>
          <div className="text-2xl font-bold text-gray-900">{prospects.length.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">New</div>
          <div className="text-2xl font-bold text-blue-600">
            {prospects.filter(p => p.status === 'new').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Qualified</div>
          <div className="text-2xl font-bold text-green-600">
            {prospects.filter(p => p.status === 'qualified').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Hot Leads</div>
          <div className="text-2xl font-bold text-red-600">
            {prospects.filter(p => p.leadTemperature === 'Hot').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Converted</div>
          <div className="text-2xl font-bold text-purple-600">
            {prospects.filter(p => p.status === 'converted').length}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={prospects}
        columns={columns}
        loading={isLoading}
        onRowClick={handleRowClick}
        tableId="prospects"
        searchPlaceholder="Search prospects by name, company, email, phone..."
        pageSize={50}
      />
    </div>
  );
}
