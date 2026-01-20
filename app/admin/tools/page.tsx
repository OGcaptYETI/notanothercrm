'use client';

import Link from 'next/link';
import { 
  Building2, 
  Database, 
  RefreshCw, 
  Upload,
  Users,
  ArrowRightLeft,
  FileSpreadsheet,
  Map
} from 'lucide-react';

const tools = [
  {
    name: 'Copper Import',
    description: 'Import customer data from Copper CRM into KanvaPortal',
    href: '/admin/tools/copper-import',
    icon: Building2,
    color: 'bg-orange-100 text-orange-600'
  },
  {
    name: 'Copper Import All',
    description: 'Bulk import all Copper CRM data at once',
    href: '/admin/tools/copper-import-all',
    icon: Upload,
    color: 'bg-orange-100 text-orange-600'
  },
  {
    name: 'Copper Import Simple',
    description: 'Simplified Copper import for basic data sync',
    href: '/admin/tools/copper-import-simple',
    icon: FileSpreadsheet,
    color: 'bg-orange-100 text-orange-600'
  },
  {
    name: 'Fishbowl Import',
    description: 'Import inventory and sales data from Fishbowl ERP',
    href: '/admin/tools/fishbowl-import',
    icon: Database,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    name: 'Sync Fishbowl ↔ Copper',
    description: 'Synchronize data between Fishbowl and Copper CRM',
    href: '/admin/tools/sync-fishbowl-copper',
    icon: ArrowRightLeft,
    color: 'bg-green-100 text-green-600'
  },
  {
    name: 'Copper-Fishbowl Match',
    description: 'Match and link records between Copper and Fishbowl',
    href: '/admin/tools/copper-fishbowl-match',
    icon: Users,
    color: 'bg-purple-100 text-purple-600'
  },
  {
    name: 'Create Missing in Copper',
    description: 'Create missing Copper records from Fishbowl data',
    href: '/admin/tools/copper-create-missing',
    icon: RefreshCw,
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    name: 'Firebase DB Mapper',
    description: 'Map Firestore collections to understand data structure and relationships',
    href: '/admin/tools/firebase-db-mapper',
    icon: Map,
    color: 'bg-indigo-100 text-indigo-600'
  }
];

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h1 className="text-2xl font-bold text-gray-900">Admin Tools</h1>
        <p className="text-sm text-gray-500 mt-1">
          Data import, sync, and maintenance utilities for KanvaPortal
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow border border-gray-100 group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${tool.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {tool.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/tools/sync-fishbowl-copper"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Run Full Sync
          </Link>
          <Link
            href="/admin/tools/copper-import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Building2 className="w-4 h-4" />
            Import from Copper
          </Link>
          <Link
            href="/admin/tools/fishbowl-import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Database className="w-4 h-4" />
            Import from Fishbowl
          </Link>
        </div>
      </div>
    </div>
  );
}
