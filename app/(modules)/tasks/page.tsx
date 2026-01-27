'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSupabaseTasks, useSupabaseTaskCounts } from '@/lib/crm/hooks-crm';
import { DataTable } from '@/components/crm/DataTable';
import type { Task } from '@/lib/crm/types-crm';
import Image from 'next/image';
import { 
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  User,
  Building2,
} from 'lucide-react';

export default function TasksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useSupabaseTasks({ pageSize: 50 });
  const { data: counts } = useSupabaseTaskCounts();
  
  const tasks = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  const totalTasks = counts?.total || 0;
  const completedTasks = counts?.completed || 0;
  const pendingTasks = counts?.pending || 0;

  // Define table columns
  const columns = useMemo<ColumnDef<Task, any>[]>(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          if (status === 'completed' || getValue() === 'Completed') {
            return (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">Complete</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1 text-orange-600">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Pending</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Task',
        cell: ({ row }) => (
          <div className="font-medium text-gray-900 max-w-md truncate">
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'priority',
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ getValue }) => {
          const priority = getValue() as string;
          const colors: Record<string, string> = {
            high: 'bg-red-100 text-red-700',
            medium: 'bg-yellow-100 text-yellow-700',
            low: 'bg-blue-100 text-blue-700',
            urgent: 'bg-purple-100 text-purple-700',
          };
          return priority ? (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority.toLowerCase()] || 'bg-gray-100'}`}>
              {priority}
            </span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'related_to_type',
        accessorKey: 'related_to_type',
        header: 'Related To',
        cell: ({ row }) => {
          const type = row.original.related_to_type;
          const icons: Record<string, any> = {
            account: Building2,
            person: User,
            opportunity: AlertCircle,
          };
          const Icon = type ? icons[type] : null;
          return type ? (
            <div className="flex items-center gap-1 text-gray-600">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span className="capitalize">{type}</span>
            </div>
          ) : <span className="text-gray-400">-</span>;
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
        id: 'due_date',
        accessorKey: 'due_date',
        header: 'Due Date',
        cell: ({ getValue }) => {
          const date = getValue() as string | null;
          if (!date) return <span className="text-gray-400">-</span>;
          const d = new Date(date);
          const isPast = d < new Date();
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div className={`flex items-center gap-1 ${isPast ? 'text-red-600 font-medium' : isToday ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
              <Calendar className="w-3.5 h-3.5" />
              {d.toLocaleDateString()}
            </div>
          );
        },
      },
      {
        id: 'completed_at',
        accessorKey: 'completed_at',
        header: 'Completed',
        cell: ({ getValue }) => {
          const date = getValue() as string | null;
          if (!date) return <span className="text-gray-400">-</span>;
          return (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {new Date(date).toLocaleDateString()}
            </div>
          );
        },
      },
    ],
    []
  );

  // Handle row click
  const handleRowClick = (task: Task) => {
    // Navigate to task detail or open modal
    console.log('Task clicked:', task.id);
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
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your team's tasks and activities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/tasks/new')}
            className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Tasks</div>
          <div className="text-2xl font-bold text-gray-900">{totalTasks.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {completedTasks.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-orange-600">
            {pendingTasks.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={tasks}
        columns={columns}
        loading={isLoading}
        onRowClick={handleRowClick}
        tableId="tasks"
        searchPlaceholder="Search tasks by name, owner, priority..."
      />
    </div>
  );
}
