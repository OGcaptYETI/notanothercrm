'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Database } from 'lucide-react';
import { auth } from '@/lib/firebase/client';

export default function AdminUtilitiesTab() {
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMetricsLoading, setBackfillMetricsLoading] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [migrateLoading, setMigrateLoading] = useState(false);

  const backfillUsers = async () => {
    setBackfillLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      
      const res = await fetch('/api/admin/backfill-users', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Backfill failed');
      toast.success(`Backfilled ${data.count || 0} users`);
    } catch (e: any) {
      toast.error(e.message || 'Backfill failed');
    } finally {
      setBackfillLoading(false);
    }
  };

  const backfillMetrics = async () => {
    if (!confirm('This will backfill 90 days of sales metrics for ALL sales reps from Copper. Continue?')) return;
    setBackfillMetricsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      
      const res = await fetch('/api/admin/backfill-sales-metrics', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Backfill failed');
      
      const msg = `✅ Backfilled ${data.processed || 0} users: ${data.ok || 0} success, ${data.failed || 0} failed`;
      toast.success(msg, { duration: 5000 });
      console.log('Backfill details:', data.details);
    } catch (e: any) {
      toast.error(e.message || 'Backfill failed');
    } finally {
      setBackfillMetricsLoading(false);
    }
  };

  const wipeMetrics = async () => {
    if (wipeConfirm !== 'DELETE ALL METRICS') {
      toast.error('Type "DELETE ALL METRICS" to confirm');
      return;
    }
    setWipeLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      
      const res = await fetch('/api/admin/wipe-metrics', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Wipe failed');
      toast.success(`Deleted ${data.count || 0} metrics`);
      setWipeConfirm('');
    } catch (e: any) {
      toast.error(e.message || 'Wipe failed');
    } finally {
      setWipeLoading(false);
    }
  };

  const migrateCopperIds = async () => {
    if (!confirm('Migrate Copper User IDs from settings/copper_users_map to user documents?')) return;
    setMigrateLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      
      const res = await fetch('/api/admin/migrate-copper-ids', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Migration failed');
      
      const msg = `✅ Migrated: ${data.summary.updated} updated, ${data.summary.skipped} skipped, ${data.summary.notFound} not found`;
      toast.success(msg, { duration: 5000 });
      console.log('Migration details:', data.details);
    } catch (e: any) {
      toast.error(e.message || 'Migration failed');
    } finally {
      setMigrateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Admin Utilities</h2>
        <p className="text-sm text-gray-600">System maintenance and data management tools.</p>
      </div>

      {/* Redirect to Fishbowl Sales */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-6">
        <h3 className="text-lg font-bold text-purple-900 mb-2">🐟 Looking for Fishbowl Tools?</h3>
        <p className="text-sm text-purple-700 mb-4">
          All Fishbowl import, matching, and sync tools have been consolidated into the <strong>Fishbowl Sales</strong> tab for easier access.
        </p>
        <Link
          href="/admin"
          onClick={() => {
            // This will trigger the parent component to switch tabs
            // You'll need to handle this in the parent if needed
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          <Database className="w-4 h-4" />
          Go to Fishbowl Sales Tab
        </Link>
      </div>


      {/* Backfill Users */}
      <div className="border rounded-lg p-4">
        <h3 className="text-md font-medium mb-2">Backfill Users</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create Firestore profiles for all Firebase Auth users who don't have one yet.
        </p>
        <button
          onClick={backfillUsers}
          disabled={backfillLoading}
          className="px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 disabled:bg-gray-400"
        >
          {backfillLoading ? 'Backfilling...' : 'Backfill Users'}
        </button>
      </div>

      {/* Migrate Copper IDs */}
      <div className="border border-cyan-200 rounded-lg p-4 bg-cyan-50">
        <h3 className="text-md font-medium text-cyan-900 mb-2">🔄 Migrate Copper User IDs</h3>
        <p className="text-sm text-cyan-700 mb-4">
          <strong>One-time migration:</strong> Copy Copper User IDs from <code className="bg-cyan-100 px-1 rounded">settings/copper_users_map</code> to individual user documents. 
          This centralizes user data and improves performance. Safe to run multiple times.
        </p>
        <button
          onClick={migrateCopperIds}
          disabled={migrateLoading}
          className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-gray-400"
        >
          {migrateLoading ? 'Migrating...' : 'Migrate Copper IDs'}
        </button>
      </div>


      {/* Wipe Metrics */}
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <h3 className="text-md font-medium text-red-800 mb-2">⚠️ Wipe All Metrics</h3>
        <p className="text-sm text-red-700 mb-4">
          <strong>DANGER:</strong> This will delete ALL metrics from Firestore. This action cannot be undone.
        </p>
        <input
          type="text"
          value={wipeConfirm}
          onChange={(e) => setWipeConfirm(e.target.value)}
          placeholder='Type "DELETE ALL METRICS" to confirm'
          className="w-full border border-red-300 rounded-md px-3 py-2 mb-3"
        />
        <button
          onClick={wipeMetrics}
          disabled={wipeLoading || wipeConfirm !== 'DELETE ALL METRICS'}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400"
        >
          {wipeLoading ? 'Wiping...' : 'Wipe All Metrics'}
        </button>
      </div>

    </div>
  );
}
