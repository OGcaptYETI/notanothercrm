'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import {
  Upload,
  Database as DatabaseIcon,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DataSyncTabProps {
  isAdmin: boolean;
  onCustomersUpdated?: () => void;
}

export default function DataSyncTab({ isAdmin, onCustomersUpdated }: DataSyncTabProps) {
  // Fishbowl Import state
  const [fishbowlFile, setFishbowlFile] = useState<File | null>(null);
  const [fishbowlLoading, setFishbowlLoading] = useState(false);
  const [fishbowlResult, setFishbowlResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<any>(null);
  const [importId, setImportId] = useState<string | null>(null);
  
  // Copper Sync state
  const [copperSyncLoading, setCopperSyncLoading] = useState(false);
  const [copperSyncResult, setCopperSyncResult] = useState<any>(null);
  
  // Customer Sync state (new architecture)
  const [customerSyncLoading, setCustomerSyncLoading] = useState(false);
  const [customerSyncResult, setCustomerSyncResult] = useState<any>(null);
  
  // Copper API Fresh Sync state
  const [copperApiSyncLoading, setCopperApiSyncLoading] = useState(false);
  const [copperApiSyncResult, setCopperApiSyncResult] = useState<any>(null);
  
  // Copper People Sync state
  const [copperPeopleSyncLoading, setCopperPeopleSyncLoading] = useState(false);
  const [copperPeopleSyncResult, setCopperPeopleSyncResult] = useState<any>(null);

  // Mark Active in Copper state
  const [markActiveLoading, setMarkActiveLoading] = useState(false);
  const [markActiveResult, setMarkActiveResult] = useState<any>(null);
  
  // Fix Custom Fields state
  const [fixFieldsLoading, setFixFieldsLoading] = useState(false);
  const [fixFieldsResult, setFixFieldsResult] = useState<any>(null);

  // RepRally state
  const [matchCustomersLoading, setMatchCustomersLoading] = useState(false);
  const [matchCustomersResult, setMatchCustomersResult] = useState<any>(null);
  
  // Cache state
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const [extractRepRallyLoading, setExtractRepRallyLoading] = useState(false);
  const [extractRepRallyResult, setExtractRepRallyResult] = useState<any>(null);
  const [buildRepRallyLoading, setBuildRepRallyLoading] = useState(false);
  const [buildRepRallyResult, setBuildRepRallyResult] = useState<any>(null);

  const handleFishbowlImport = async () => {
    if (!fishbowlFile) {
      toast.error('Please select a file to import');
      return;
    }

    setFishbowlLoading(true);
    setFishbowlResult(null);
    setImportProgress(null);
    setImportId(null);
    const loadingToast = toast.loading('Uploading file...');

    try {
      const fileSize = fishbowlFile.size;
      const fileSizeMB = fileSize / 1024 / 1024;
      console.log(`📦 Uploading ${fishbowlFile.name} (${fileSizeMB.toFixed(2)} MB)`);
      
      // ALWAYS use chunked upload for consistency (ensures Copper account type lookup)
      // Chunk size must stay under ~750KB so base64 encoded data fits in Firestore's 1MB field limit
      const CHUNK_SIZE = 700 * 1024; // 700KB chunks
      const useChunkedUpload = true; // Always use chunked path
      
      // Always use chunked upload (even for small files) for consistency
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      const fileId = `file_${Date.now()}`;
      
      console.log(`📦 Splitting into ${totalChunks} chunks...`);
      toast.loading(`Uploading in ${totalChunks} chunks...`, { id: loadingToast });
      
      let currentImportId: string | null = null;
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = fishbowlFile.slice(start, end);
        
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileId', fileId);
        formData.append('filename', fishbowlFile.name);
        
        const uploadProgress = ((i + 1) / totalChunks * 100).toFixed(0);
        toast.loading(`Uploading chunk ${i + 1}/${totalChunks} (${uploadProgress}%)`, { id: loadingToast });
        
        const response = await fetch('/api/fishbowl/import-chunked', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Chunk upload failed');
        }
        
        console.log(`✅ Uploaded chunk ${i + 1}/${totalChunks}`);
        
        if (data.complete && data.importId) {
          currentImportId = data.importId;
          console.log(`🎉 All chunks uploaded! Import ID: ${currentImportId}`);
          break;
        }
      }
      
      if (!currentImportId) {
        throw new Error('Failed to get import ID after upload');
      }
      
      setImportId(currentImportId);
      toast.loading('Starting processing...', { id: loadingToast });
      
      // Start processing in a separate request (fire and forget)
      console.log('🚀 Triggering processing...');
      const processResponse = await fetch('/api/fishbowl/process-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: currentImportId }),
      });
      
      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'Processing failed');
      }
      
      const processResult = await processResponse.json();
      console.log('🚀 Processing started:', processResult);
      
      // Poll for progress until complete
      toast.loading(`Processing ${processResult.totalRows?.toLocaleString() || '?'} rows...`, { id: loadingToast });
      setImportId(currentImportId);
      
      // Start polling
      const pollInterval = setInterval(async () => {
        try {
          const progressRes = await fetch(`/api/fishbowl/import-progress?importId=${currentImportId}`);
          const progressData = await progressRes.json();
          
          if (progressData.progress) {
            const p = progressData.progress;
            setImportProgress(p);
            
            if (p.status === 'complete') {
              clearInterval(pollInterval);
              console.log('✅ Import complete:', p.stats);
              
              setFishbowlResult({
                success: true,
                complete: true,
                stats: p.stats
              });
              
              setFishbowlFile(null);
              setFishbowlLoading(false);
              
              const stats = p.stats || {};
              const totalWrites = (stats.ordersCreated || 0) + (stats.ordersUpdated || 0) + (stats.itemsCreated || 0) + (stats.itemsUpdated || 0);
              const totalSkipped = (stats.ordersUnchanged || 0) + (stats.itemsUnchanged || 0);
              const savedPercentage = totalWrites + totalSkipped > 0 ? ((totalSkipped / (totalWrites + totalSkipped)) * 100).toFixed(1) : '0.0';
              
              toast.success(
                `✅ Import Complete! ${totalWrites.toLocaleString()} writes (saved ${totalSkipped.toLocaleString()} - ${savedPercentage}% reduction)`,
                { id: loadingToast, duration: 5000 }
              );
              
              onCustomersUpdated?.();
            } else if (p.status === 'error') {
              clearInterval(pollInterval);
              setFishbowlLoading(false);
              toast.error(p.error || 'Import failed', { id: loadingToast });
            }
          }
        } catch (pollError) {
          console.error('Poll error:', pollError);
        }
      }, 2000); // Poll every 2 seconds
      
      // Safety timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (fishbowlLoading) {
          setFishbowlLoading(false);
          toast.error('Import timed out - check import progress manually', { id: loadingToast });
        }
      }, 600000);
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import data', { id: loadingToast });
      setFishbowlLoading(false);
    }
  };

  const pollImportProgress = (importId: string, toastId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const progressResponse = await fetch(`/api/fishbowl/import-progress?importId=${importId}`);
        const progressData = await progressResponse.json();
        
        if (progressData.success && progressData.progress) {
          const progress = progressData.progress;
          const percent = progress.percentage || 0;
          const current = progress.currentRow || 0;
          const total = progress.totalRows || 0;
          const currentCustomer = progress.currentCustomer || '';
          
          setImportProgress({
            percentage: percent,
            currentRow: current,
            totalRows: total,
            status: progress.status
          });
          
          if (currentCustomer) {
            toast.loading(`Processing: ${current} / ${total} (${percent.toFixed(1)}%) - ${currentCustomer}`, { id: toastId });
          } else {
            toast.loading(`Processing: ${current} / ${total} (${percent.toFixed(1)}%)`, { id: toastId });
          }
          
          if (progress.status === 'complete') {
            clearInterval(pollInterval);
            
            const stats = progress.stats || {};
            
            setFishbowlResult({
              success: true,
              complete: true,
              stats: stats
            });
            
            setFishbowlFile(null);
            setFishbowlLoading(false);
            
            const totalWrites = (stats.ordersCreated || 0) + (stats.ordersUpdated || 0) + (stats.itemsCreated || 0) + (stats.itemsUpdated || 0);
            const totalSkipped = (stats.ordersUnchanged || 0) + (stats.itemsUnchanged || 0);
            const savedPercentage = totalWrites + totalSkipped > 0 ? ((totalSkipped / (totalWrites + totalSkipped)) * 100).toFixed(1) : '0.0';
            
            toast.success(
              `✅ Import Complete! ${totalWrites.toLocaleString()} writes (saved ${totalSkipped.toLocaleString()} - ${savedPercentage}% reduction)`,
              { id: toastId, duration: 5000 }
            );
            
            onCustomersUpdated?.();
          }
        }
      } catch (err) {
        console.error('Import progress polling error:', err);
      }
    }, 2000);
    
    setTimeout(() => {
      clearInterval(pollInterval);
      if (fishbowlLoading) {
        toast.error('Import timeout - please check Firestore for status', { id: toastId });
        setFishbowlLoading(false);
      }
    }, 10 * 60 * 1000);
  };

  const handleCopperApiSync = async () => {
    setCopperApiSyncLoading(true);
    setCopperApiSyncResult(null);
    const loadingToast = toast.loading('🔥 Fetching ALL fields from Copper API...');
    
    try {
      const response = await fetch('/api/sync-copper-api-fresh', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Copper API sync failed');
      }
      
      console.log('✅ Copper API sync completed!', data);
      
      setCopperApiSyncResult(data);
      setCopperApiSyncLoading(false);
      
      toast.success(
        `✅ Synced ${data.stats.activeFetched} ACTIVE companies! (${data.stats.created} new, ${data.stats.updated} updated)`,
        { id: loadingToast, duration: 5000 }
      );
      
    } catch (error: any) {
      console.error('Copper API sync error:', error);
      toast.error(error.message || 'Failed to sync from Copper API', { id: loadingToast });
      setCopperApiSyncLoading(false);
    }
  };

  const handleCopperPeopleSync = async () => {
    setCopperPeopleSyncLoading(true);
    setCopperPeopleSyncResult(null);
    const loadingToast = toast.loading('👥 Fetching contacts from Copper API...');
    
    try {
      const response = await fetch('/api/sync-copper-people', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Copper People sync failed');
      }
      
      console.log('✅ Copper People sync completed!', data);
      
      setCopperPeopleSyncResult(data);
      setCopperPeopleSyncLoading(false);
      
      toast.success(
        `✅ Synced ${data.stats.totalFetched} contacts! (${data.stats.created} new, ${data.stats.updated} updated)`,
        { id: loadingToast, duration: 5000 }
      );
      
    } catch (error: any) {
      console.error('Copper People sync error:', error);
      toast.error(error.message || 'Failed to sync contacts from Copper API', { id: loadingToast });
      setCopperPeopleSyncLoading(false);
    }
  };

  const handleCustomerSync = async (liveMode = false) => {
    setCustomerSyncLoading(true);
    setCustomerSyncResult(null);
    const loadingToast = toast.loading(liveMode ? '🔴 LIVE MODE: Syncing customers...' : '🟢 DRY RUN: Analyzing changes...');
    
    try {
      const response = await fetch(`/api/sync-copper-customers?live=${liveMode}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Customer sync failed');
      }
      
      console.log('✅ Customer sync completed!', data);
      
      setCustomerSyncResult(data);
      setCustomerSyncLoading(false);
      
      if (liveMode) {
        toast.success(
          `✅ LIVE: Created ${data.wouldCreate} + Updated ${data.wouldUpdate} customers!`,
          { id: loadingToast, duration: 5000 }
        );
        onCustomersUpdated?.();
      } else {
        toast.success(
          `✅ DRY RUN: Would create ${data.wouldCreate} + update ${data.wouldUpdate} customers`,
          { id: loadingToast, duration: 5000 }
        );
      }
      
    } catch (error: any) {
      console.error('Customer sync error:', error);
      toast.error(error.message || 'Failed to sync customer data', { id: loadingToast });
      setCustomerSyncLoading(false);
    }
  };

  const handleFixCustomFields = async (dryRun = true, startId = 74820794, endId = 74821021) => {
    setFixFieldsLoading(true);
    setFixFieldsResult(null);
    const loadingToast = toast.loading(dryRun ? '🟢 Analyzing custom fields...' : '🔴 Fixing custom fields...');
    
    try {
      const response = await fetch('/api/copper/fix-custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, startId, endId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fix custom fields failed');
      }
      
      setFixFieldsResult(data);
      setFixFieldsLoading(false);
      
      if (dryRun) {
        toast.success(
          `✅ DRY RUN: Found ${data.stats.processed} companies to update`,
          { id: loadingToast, duration: 5000 }
        );
      } else {
        toast.success(
          `✅ Updated ${data.stats.updated} companies with custom fields!`,
          { id: loadingToast, duration: 5000 }
        );
      }
      
    } catch (error: any) {
      console.error('Fix custom fields error:', error);
      toast.error(error.message || 'Failed to fix custom fields', { id: loadingToast });
      setFixFieldsLoading(false);
    }
  };

  const matchRepRallyCustomers = async () => {
    setMatchCustomersLoading(true);
    setMatchCustomersResult(null);
    const loadingToast = toast.loading('🔍 Matching RepRally locations with Fishbowl customers...');
    
    try {
      const response = await fetch('/api/reprally/match-customers');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Matching failed');
      }
      
      setMatchCustomersResult(data);
      setMatchCustomersLoading(false);
      
      toast.success(
        `✅ Found ${data.stats.potentialSwitchers} potential switchers!`,
        { id: loadingToast, duration: 5000 }
      );
      
    } catch (error: any) {
      console.error('Customer matching error:', error);
      toast.error(error.message || 'Failed to match customers', { id: loadingToast });
      setMatchCustomersLoading(false);
    }
  };

  const extractRepRallyCustomers = async (dryRun = true) => {
    setExtractRepRallyLoading(true);
    setExtractRepRallyResult(null);
    const loadingToast = toast.loading(dryRun ? '🔍 Extracting customers from billing data...' : '🔴 Creating customer records...');
    
    try {
      const response = await fetch('/api/reprally/extract-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed');
      }
      
      setExtractRepRallyResult(data);
      setExtractRepRallyLoading(false);
      
      toast.success(
        dryRun 
          ? `✅ Found ${data.stats.uniqueCustomers} unique customers to create`
          : `✅ Created ${data.stats.created} customer records!`,
        { id: loadingToast, duration: 5000 }
      );
      
    } catch (error: any) {
      console.error('Extract RepRally error:', error);
      toast.error(error.message || 'Failed to extract customers', { id: loadingToast });
      setExtractRepRallyLoading(false);
    }
  };

  const buildRepRallyOrders = async (dryRun = true) => {
    setBuildRepRallyLoading(true);
    setBuildRepRallyResult(null);
    const loadingToast = toast.loading(dryRun ? '🔍 Analyzing RepRally billing data...' : '🔴 Creating order records...');
    
    try {
      const response = await fetch('/api/reprally/build-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Build orders failed');
      }
      
      setBuildRepRallyResult(data);
      setBuildRepRallyLoading(false);
      
      toast.success(
        dryRun 
          ? `✅ Would create ${data.stats.ordersToCreate} orders from ${data.stats.billingRecords} billing records`
          : `✅ Created ${data.stats.ordersCreated} orders!`,
        { id: loadingToast, duration: 5000 }
      );
      
    } catch (error: any) {
      console.error('Build RepRally orders error:', error);
      toast.error(error.message || 'Failed to build orders', { id: loadingToast });
      setBuildRepRallyLoading(false);
    }
  };

  const handleMarkActiveInCopper = async () => {
    setMarkActiveLoading(true);
    setMarkActiveResult(null);
    const loadingToast = toast.loading('🏷️ Marking customers active in Copper...');
    
    try {
      const response = await fetch('/api/copper/mark-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Mark active failed');
      }
      
      setMarkActiveResult(data);
      setMarkActiveLoading(false);
      
      toast.success(
        `✅ Marked ${data.stats.updated} customers as active in Copper!`,
        { id: loadingToast, duration: 5000 }
      );
      
    } catch (error: any) {
      console.error('Mark active error:', error);
      toast.error(error.message || 'Failed to mark customers active', { id: loadingToast });
      setMarkActiveLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* INITIAL SETUP SECTION */}
      <div className="bg-gradient-to-r from-orange-100 to-amber-100 border-4 border-orange-500 rounded-xl shadow-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">🚀</span>
          <div>
            <h1 className="text-3xl font-black text-orange-900">Initial Setup (Do This First!)</h1>
            <p className="text-sm text-orange-700 font-semibold">⚡ Run these steps once when setting up the system or quarterly to refresh all data</p>
          </div>
        </div>
      </div>

      {/* Step 1: FRESH COPPER API SYNC */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-400 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🔥</span>
          <div>
            <h2 className="text-2xl font-bold text-orange-900">Step 1: Sync from Copper API</h2>
            <p className="text-sm text-orange-700">🔥 Pull ALL fields for ACTIVE companies directly from Copper CRM</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-orange-50 border border-orange-300 rounded-lg">
            <p className="text-sm text-orange-900 font-semibold mb-2">
              ⚡ <strong>WHEN TO RUN:</strong>
            </p>
            <ul className="mt-2 text-sm text-orange-800 space-y-1">
              <li>✅ Connects directly to Copper API (bypasses Goals App)</li>
              <li>✅ Pulls ALL custom fields (Account Type, Region, Address, etc.)</li>
              <li>✅ Updates copper_companies collection with fresh data</li>
              <li>✅ Only syncs ACTIVE companies (~1000 vs 268,000 total)</li>
              <li>⏱️ Takes 2-3 minutes for ~1000 companies</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-sm text-yellow-900">
              <strong>📌 Frequency:</strong> Initial setup, then quarterly or when Copper data changes significantly.
            </p>
          </div>

          <button
            onClick={handleCopperApiSync}
            disabled={copperApiSyncLoading}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-4 rounded-lg hover:from-orange-700 hover:to-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
          >
            {copperApiSyncLoading ? '⏳ Syncing from Copper API...' : '🔥 Refresh from Copper API'}
          </button>

          {copperApiSyncResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900 font-semibold">✅ Copper API Sync Complete!</p>
              <ul className="mt-2 text-sm text-green-800">
                <li>📊 Active companies fetched: {copperApiSyncResult.stats?.activeFetched || 0}</li>
                <li>➕ New records created: {copperApiSyncResult.stats?.created || 0}</li>
                <li>🔄 Records updated: {copperApiSyncResult.stats?.updated || 0}</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Step 1B: Copper People Sync */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">👥</span>
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Step 1B: Sync Contacts from Copper API</h2>
            <p className="text-sm text-blue-700">👥 Pull ALL contacts (people) directly from Copper CRM</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              ⚡ <strong>WHAT IT DOES:</strong>
            </p>
            <ul className="mt-2 text-sm text-blue-800 space-y-1">
              <li>✅ Connects directly to Copper API for contacts/people</li>
              <li>✅ Pulls ALL contact fields (name, email, phone, title, company)</li>
              <li>✅ Creates copper_people collection for Contacts page</li>
              <li>✅ Links contacts to companies via Company ID</li>
              <li>⏱️ Takes 2-3 minutes for all contacts</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-sm text-yellow-900">
              <strong>📌 Frequency:</strong> Initial setup, then quarterly or when contact data changes.
            </p>
          </div>

          <button
            onClick={handleCopperPeopleSync}
            disabled={copperPeopleSyncLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
          >
            {copperPeopleSyncLoading ? '⏳ Syncing contacts...' : '👥 Sync Contacts from Copper'}
          </button>

          {copperPeopleSyncResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900 font-semibold">✅ Copper People Sync Complete!</p>
              <ul className="mt-2 text-sm text-green-800">
                <li>📊 Total contacts fetched: {copperPeopleSyncResult.stats?.totalFetched || 0}</li>
                <li>➕ New records created: {copperPeopleSyncResult.stats?.created || 0}</li>
                <li>🔄 Records updated: {copperPeopleSyncResult.stats?.updated || 0}</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Customer Sync */}
      <div className="bg-gradient-to-r from-teal-50 to-green-50 border-2 border-teal-400 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">👥</span>
          <div>
            <h2 className="text-2xl font-bold text-teal-900">Step 2: Sync to Fishbowl Customers</h2>
            <p className="text-sm text-teal-700">📋 Push Copper data to fishbowl_customers collection</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-teal-50 border border-teal-300 rounded-lg">
            <p className="text-sm text-teal-900 font-semibold mb-2">
              ⚡ <strong>WHAT IT DOES:</strong>
            </p>
            <ul className="mt-2 text-sm text-teal-800 space-y-1">
              <li>✅ Creates/updates fishbowl_customers from copper_companies</li>
              <li>✅ Maps Account Type, Region, Address fields</li>
              <li>✅ DRY RUN first to preview changes</li>
              <li>✅ LIVE MODE to actually write changes</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleCustomerSync(false)}
              disabled={customerSyncLoading}
              className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-4 rounded-lg hover:from-green-700 hover:to-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
            >
              {customerSyncLoading ? '⏳ Running...' : '🟢 DRY RUN (Preview)'}
            </button>
            <button
              onClick={() => {
                if (confirm('⚠️ LIVE MODE will write changes to the database. Have you reviewed the dry-run report?')) {
                  handleCustomerSync(true);
                }
              }}
              disabled={customerSyncLoading || !customerSyncResult}
              className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 rounded-lg hover:from-red-700 hover:to-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
            >
              {customerSyncLoading ? '⏳ Running...' : '🔴 LIVE MODE (Write)'}
            </button>
          </div>

          {customerSyncResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900 font-semibold">✅ Customer Sync Analysis</p>
              <ul className="mt-2 text-sm text-green-800">
                <li>📊 Copper companies found: {customerSyncResult.copperCount || 0}</li>
                <li>➕ Would create: {customerSyncResult.wouldCreate || 0}</li>
                <li>🔄 Would update: {customerSyncResult.wouldUpdate || 0}</li>
                <li>⏭️ Would skip: {customerSyncResult.wouldSkip || 0}</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Fishbowl Import */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-400 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">📦</span>
          <div>
            <h2 className="text-2xl font-bold text-purple-900">Step 3: Import Fishbowl Sales Orders</h2>
            <p className="text-sm text-purple-700">📊 Import sales order data from Fishbowl CSV export</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-purple-50 border border-purple-300 rounded-lg">
            <p className="text-sm text-purple-900 font-semibold mb-2">
              ⚡ <strong>REQUIREMENTS:</strong>
            </p>
            <ul className="mt-2 text-sm text-purple-800 space-y-1">
              <li>✅ Export &quot;All Sales Order Items&quot; from Fishbowl</li>
              <li>✅ Include: SO Number, Customer, Product, Qty, Price, Date</li>
              <li>✅ Supports files up to 100MB (chunked upload)</li>
              <li>✅ Smart skip: Only writes changed records</li>
            </ul>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFishbowlFile(e.target.files?.[0] || null)}
              className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
            />
            {fishbowlFile && (
              <span className="text-sm text-purple-600">
                {fishbowlFile.name} ({(fishbowlFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            )}
          </div>

          <button
            onClick={handleFishbowlImport}
            disabled={fishbowlLoading || !fishbowlFile}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
          >
            {fishbowlLoading ? '⏳ Importing...' : '📦 Import Fishbowl Data'}
          </button>

          {importProgress && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-300 rounded-lg">
              <p className="text-sm text-blue-900 font-semibold">⏳ Import Progress</p>
              <div className="mt-2 w-full bg-blue-200 rounded-full h-4">
                <div 
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress.percentage || 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-blue-800">
                {importProgress.currentRow || 0} / {importProgress.totalRows || 0} rows ({(importProgress.percentage || 0).toFixed(1)}%)
              </p>
            </div>
          )}

          {fishbowlResult && fishbowlResult.complete && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900 font-semibold">✅ Fishbowl Import Complete!</p>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-green-800">
                <div>
                  <p className="font-semibold">Orders:</p>
                  <ul>
                    <li>➕ Created: {fishbowlResult.stats?.ordersCreated || 0}</li>
                    <li>🔄 Updated: {fishbowlResult.stats?.ordersUpdated || 0}</li>
                    <li>⏭️ Skipped: {fishbowlResult.stats?.ordersUnchanged || 0}</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Line Items:</p>
                  <ul>
                    <li>➕ Created: {fishbowlResult.stats?.itemsCreated || 0}</li>
                    <li>🔄 Updated: {fishbowlResult.stats?.itemsUpdated || 0}</li>
                    <li>⏭️ Skipped: {fishbowlResult.stats?.itemsUnchanged || 0}</li>
                  </ul>
                </div>
              </div>
              {(() => {
                const totalWrites = (fishbowlResult.stats?.ordersCreated || 0) + (fishbowlResult.stats?.ordersUpdated || 0) + (fishbowlResult.stats?.itemsCreated || 0) + (fishbowlResult.stats?.itemsUpdated || 0);
                const totalSkipped = (fishbowlResult.stats?.ordersUnchanged || 0) + (fishbowlResult.stats?.itemsUnchanged || 0);
                if (totalSkipped > 0) {
                  return (
                    <p className="mt-2 text-sm text-green-700">
                      💾 <span className="font-semibold">
                        {totalWrites.toLocaleString()} Firestore writes
                      </span>
                      {' '}(saved {totalSkipped.toLocaleString()} - {((totalSkipped / (totalWrites + totalSkipped)) * 100).toFixed(1)}% reduction)
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Advanced Tools Section */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🔧</span>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Advanced Tools</h2>
            <p className="text-sm text-gray-700">Additional utilities for data management</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleMarkActiveInCopper}
            disabled={markActiveLoading}
            className="bg-gradient-to-r from-gray-600 to-slate-600 text-white px-4 py-3 rounded-lg hover:from-gray-700 hover:to-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold shadow-lg"
          >
            {markActiveLoading ? '⏳ Working...' : '🏷️ Mark Active in Copper'}
          </button>
          
          <button
            onClick={() => handleFixCustomFields(true)}
            disabled={fixFieldsLoading}
            className="bg-gradient-to-r from-gray-600 to-slate-600 text-white px-4 py-3 rounded-lg hover:from-gray-700 hover:to-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold shadow-lg"
          >
            {fixFieldsLoading ? '⏳ Working...' : '🔧 Fix Custom Fields'}
          </button>
        </div>

        {markActiveResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
            <p className="text-sm text-green-900">✅ Marked {markActiveResult.stats?.updated || 0} customers as active</p>
          </div>
        )}

        {fixFieldsResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
            <p className="text-sm text-green-900">✅ Processed {fixFieldsResult.stats?.processed || 0} companies</p>
          </div>
        )}
      </div>

      {/* Step 4: Rebuild Cache */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-400 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">⚡</span>
          <div>
            <h2 className="text-2xl font-bold text-amber-900">Step 4: Rebuild Analytics Cache</h2>
            <p className="text-sm text-amber-700">🚀 Pre-compute RepRally analytics for fast loading</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <p className="text-sm text-amber-900 font-semibold mb-2">
              ⚡ <strong>WHY REBUILD CACHE?</strong>
            </p>
            <ul className="mt-2 text-sm text-amber-800 space-y-1">
              <li>✅ Pre-computes all RepRally analytics from line items</li>
              <li>✅ Makes Customers page load instantly (vs 30+ seconds)</li>
              <li>✅ Identifies switchers (Direct → RepRally customers)</li>
              <li>✅ Run after every Fishbowl import</li>
            </ul>
          </div>

          <button
            onClick={async () => {
              setCacheLoading(true);
              const loadingToast = toast.loading('🔄 Rebuilding RepRally cache... (this takes 1-2 minutes)');
              try {
                const response = await fetch('/api/cache/rebuild-reprally', { method: 'POST' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Cache rebuild failed');
                setCacheStatus(data);
                toast.success(`✅ Cache rebuilt: ${data.stats?.customers || 0} customers, ${data.stats?.switchers || 0} switchers`, { id: loadingToast, duration: 5000 });
              } catch (error: any) {
                console.error('Cache rebuild error:', error);
                toast.error(error.message || 'Cache rebuild failed', { id: loadingToast });
              } finally {
                setCacheLoading(false);
              }
            }}
            disabled={cacheLoading}
            className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 text-white px-6 py-4 rounded-lg hover:from-amber-700 hover:to-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
          >
            {cacheLoading ? '⏳ Rebuilding Cache...' : '⚡ Rebuild Analytics Cache'}
          </button>

          {cacheStatus && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900 font-semibold">✅ Cache Rebuild Complete!</p>
              <ul className="mt-2 text-sm text-green-800">
                <li>👥 Customers: {cacheStatus.stats?.customers?.toLocaleString() || 0}</li>
                <li>📦 Orders: {cacheStatus.stats?.orders?.toLocaleString() || 0}</li>
                <li>💰 Revenue: ${cacheStatus.stats?.revenue?.toLocaleString() || 0}</li>
                <li>🔁 Switchers: {cacheStatus.stats?.switchers || 0}</li>
                <li>⏱️ Duration: {((cacheStatus.stats?.durationMs || 0) / 1000).toFixed(1)}s</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* RepRally Integration */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border-2 border-indigo-400 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🏪</span>
          <div>
            <h2 className="text-2xl font-bold text-indigo-900">RepRally Integration</h2>
            <p className="text-sm text-indigo-700">Match and sync RepRally customer data</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={matchRepRallyCustomers}
              disabled={matchCustomersLoading}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold shadow-lg"
            >
              {matchCustomersLoading ? '⏳ Matching...' : '🔍 Match Customers'}
            </button>
            
            <button
              onClick={() => extractRepRallyCustomers(true)}
              disabled={extractRepRallyLoading}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold shadow-lg"
            >
              {extractRepRallyLoading ? '⏳ Extracting...' : '📤 Extract Customers'}
            </button>
            
            <button
              onClick={() => buildRepRallyOrders(true)}
              disabled={buildRepRallyLoading}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold shadow-lg"
            >
              {buildRepRallyLoading ? '⏳ Building...' : '📦 Build Orders'}
            </button>
          </div>

          {matchCustomersResult && (
            <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900">✅ Found {matchCustomersResult.stats?.potentialSwitchers || 0} potential switchers</p>
            </div>
          )}

          {extractRepRallyResult && (
            <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900">✅ Found {extractRepRallyResult.stats?.uniqueCustomers || 0} unique customers</p>
            </div>
          )}

          {buildRepRallyResult && (
            <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900">✅ Would create {buildRepRallyResult.stats?.ordersToCreate || 0} orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
