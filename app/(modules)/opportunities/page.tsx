'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSupabaseOpportunities, useSupabaseOpportunityCounts } from '@/lib/crm/hooks-crm';
import { DataTable } from '@/components/crm/DataTable';
import type { Opportunity } from '@/lib/crm/types-crm';
import Image from 'next/image';
import { 
  Plus,
  DollarSign,
  Building2,
  User,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

export default function OpportunitiesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useSupabaseOpportunities({ pageSize: 50 });
  const { data: counts } = useSupabaseOpportunityCounts();
  
  const opportunities = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  const totalOpportunities = counts?.total || 0;
  const wonOpportunities = counts?.won || 0;
  const openOpportunities = counts?.open || 0;

  // Define table columns
  const columns = useMemo<ColumnDef<Opportunity, any>[]>(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const colors: Record<string, { bg: string; icon: any }> = {
            Won: { bg: 'bg-green-100 text-green-700', icon: CheckCircle2 },
            Lost: { bg: 'bg-red-100 text-red-700', icon: XCircle },
            Open: { bg: 'bg-blue-100 text-blue-700', icon: Clock },
          };
          const config = colors[status] || { bg: 'bg-gray-100 text-gray-600', icon: Clock };
          const Icon = config.icon;
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${config.bg}`}>
              <Icon className="w-3 h-3" />
              {status}
            </span>
          );
        },
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Opportunity',
        cell: ({ row }) => (
          <div className="font-medium text-gray-900 max-w-md truncate">
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'company_name',
        accessorKey: 'company_name',
        header: 'Company',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1 text-gray-700">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            {getValue() || '-'}
          </div>
        ),
      },
      {
        id: 'value',
        accessorKey: 'value',
        header: 'Value',
        cell: ({ getValue }) => {
          const value = getValue() as number | null;
          return value ? (
            <div className="flex items-center gap-1 text-gray-900 font-medium">
              <DollarSign className="w-3.5 h-3.5 text-green-600" />
              {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'stage',
        accessorKey: 'stage',
        header: 'Stage',
        cell: ({ getValue }) => {
          const stage = getValue() as string;
          return stage ? (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {stage}
            </span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'win_probability',
        accessorKey: 'win_probability',
        header: 'Probability',
        cell: ({ getValue }) => {
          const prob = getValue() as number | null;
          if (!prob) return <span className="text-gray-400">-</span>;
          const color = prob >= 75 ? 'text-green-600' : prob >= 50 ? 'text-yellow-600' : 'text-gray-600';
          return (
            <div className={`flex items-center gap-1 ${color} font-medium`}>
              <TrendingUp className="w-3.5 h-3.5" />
              {prob}%
            </div>
          );
        },
      },
      {
        id: 'owner',
        accessorKey: 'owner',
        header: 'Owner',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1 text-gray-600">
            <User className="w-3.5 h-3.5" />
            {getValue() || '-'}
          </div>
        ),
      },
      {
        id: 'close_date',
        accessorKey: 'close_date',
        header: 'Close Date',
        cell: ({ getValue }) => {
          const date = getValue() as string | null;
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
        id: 'primary_contact',
        accessorKey: 'primary_contact',
        header: 'Contact',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
    ],
    []
  );

  // Handle row click
  const handleRowClick = (opportunity: Opportunity) => {
    console.log('Opportunity clicked:', opportunity.id);
  };

  // Auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <Image 
            src="/images/kanva_logo_rotate.gif" 
            alt="Loading..." 
            width={64}
            height={64}
            className="mx-auto mb-4"
            priority
            unoptimized
          />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage your sales opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/opportunities/new')}
            className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Opportunity
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Opportunities</div>
          <div className="text-2xl font-bold text-gray-900">{totalOpportunities.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Won</div>
          <div className="text-2xl font-bold text-green-600">
            {wonOpportunities.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Open</div>
          <div className="text-2xl font-bold text-blue-600">
            {openOpportunities.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={opportunities}
        columns={columns}
        loading={isLoading}
        onRowClick={handleRowClick}
        tableId="opportunities"
        searchPlaceholder="Search opportunities by name, company, owner..."
      />
    </div>
  );
}
