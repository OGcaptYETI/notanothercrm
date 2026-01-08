'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChange } from '@/lib/firebase/client';
import { userService } from '@/lib/firebase/services';
import Link from 'next/link';
import { Settings, Users, Target, Database, Phone, FileText, DollarSign, Sliders, Plug, BarChart3, Wrench, Package } from 'lucide-react';


export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication and authorization
  useEffect(() => {
    const unsub = onAuthStateChange(async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const userData = await userService.getUser(firebaseUser.uid);
      if (userData && (userData.role === 'admin' || userData.role === 'manager')) {
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kanva-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white shadow-sm rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600 mb-6">You need admin or manager privileges to access this page.</p>
          <Link href="/" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 transition-colors">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Overview Dashboard Component
  const OverviewDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Management Card */}
        <Link href="/admin/users" className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-orange-500 p-3 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-orange-900 mb-2">User Management</h3>
          <p className="text-sm text-orange-700 mb-4">Manage users, sales team roster, and organizational structure.</p>
          <div className="flex items-center text-orange-600 text-sm font-medium">
            Manage Users →
          </div>
        </Link>

        {/* Sales Insights Card */}
        <Link href="/admin/sales-insights" className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-blue-500 p-3 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Sales Insights</h3>
          <p className="text-sm text-blue-700 mb-4">View team performance, metrics, and analytics.</p>
          <div className="flex items-center text-blue-600 text-sm font-medium">
            View Insights →
          </div>
        </Link>

        {/* Products Card */}
        <Link href="/admin/products" className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-6 border border-teal-200 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-teal-500 p-3 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-teal-900 mb-2">Product Management</h3>
          <p className="text-sm text-teal-700 mb-4">Manage products, pricing tiers, and inventory settings.</p>
          <div className="flex items-center text-teal-600 text-sm font-medium">
            Manage Products →
          </div>
        </Link>

        {/* Goals Card */}
        <Link href="/admin/goals" className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-green-500 p-3 rounded-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">Team Goals</h3>
          <p className="text-sm text-green-700 mb-4">Set and track team goals and targets.</p>
          <div className="flex items-center text-green-600 text-sm font-medium">
            Manage Goals →
          </div>
        </Link>

        {/* Import Tools Card */}
        <Link href="/admin/tools" className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Wrench className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-purple-900 mb-2">Import Tools</h3>
          <p className="text-sm text-purple-700 mb-4">Import data from Copper CRM, Fishbowl ERP, and other sources.</p>
          <div className="flex items-center text-purple-600 text-sm font-medium">
            Open Tools →
          </div>
        </Link>

        {/* JustCall Card */}
        <Link href="/admin/justcall" className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border border-indigo-200 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-indigo-500 p-3 rounded-lg">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-indigo-900 mb-2">JustCall Integration</h3>
          <p className="text-sm text-indigo-700 mb-4">Sync call data and manage phone integrations.</p>
          <div className="flex items-center text-indigo-600 text-sm font-medium">
            Configure JustCall →
          </div>
        </Link>
      </div>

      {/* Commission Settings Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Commission Settings
        </h4>
        <p className="text-sm text-amber-700">
          <strong>Commission-specific settings</strong> (commission rates, rules, customers, products) 
          are managed in the <Link href="/settings" className="underline font-medium hover:text-amber-900">Commission Settings page</Link>.
          User management is centralized here in Admin.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-1">Portal-wide administration, integrations, and system settings</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-200">
              Commission Settings →
            </Link>
            <Link href="/" className="text-sm text-kanva-green hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <OverviewDashboard />
    </div>
  );
}
