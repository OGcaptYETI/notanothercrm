'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function CopperMetadataTab() {
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [defaults, setDefaults] = useState<any>({
    copperUserEmail: '',
    emailActivityId: '',
    emailActivityCategory: '',
    phoneCallActivityId: '',
    phoneCallActivityCategory: '',
    smsActivityId: '2160513',
    smsActivityCategory: 'user',
    SALES_PIPELINE_ID: '',
    CLOSED_WON_STAGES: '',
    STAGE_MAPPING: '{"Fact Finding":"lead_progression_a","Contact Stage":"lead_progression_b","Closing Stage":"lead_progression_c"}',
  });
  const [actTypes, setActTypes] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [apiUser, setApiUser] = useState<any>(null);
  const [selectedEmailType, setSelectedEmailType] = useState<{id:string, category:string}>({ id: '', category: 'system' });
  const [selectedCallType, setSelectedCallType] = useState<{id:string, category:string}>({ id: '', category: 'user' });
  const [selectedSmsType, setSelectedSmsType] = useState<{id:string, category:string}>({ id: '2160513', category: 'user' });
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedStages, setSelectedStages] = useState<{[key: string]: string}>({
    lead_progression_a: '',
    lead_progression_b: '',
    lead_progression_c: '',
  });
  const [selectedWonStage, setSelectedWonStage] = useState<string>('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [diagUserEmail, setDiagUserEmail] = useState('');
  const [copperUsers, setCopperUsers] = useState<any[]>([]);

  const fetchMetadata = async () => {
    setMetaLoading(true);
    try {
      const res = await fetch('/api/copper/metadata');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch metadata');
      setMeta(data);
      toast.success('Metadata loaded');
    } catch (e: any) {
      toast.error(e.message || 'Failed to load metadata');
    } finally {
      setMetaLoading(false);
    }
  };

  const loadDefaults = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/copper/defaults');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load defaults');
      const d = data.defaults || {};
      setDefaults({
        copperUserEmail: d.copperUserEmail || '',
        emailActivityId: d.emailActivityId || '',
        emailActivityCategory: d.emailActivityCategory || '',
        phoneCallActivityId: d.phoneCallActivityId || '',
        phoneCallActivityCategory: d.phoneCallActivityCategory || '',
        smsActivityId: d.smsActivityId || '2160513',
        smsActivityCategory: d.smsActivityCategory || 'user',
        SALES_PIPELINE_ID: d.SALES_PIPELINE_ID || '',
        CLOSED_WON_STAGES: Array.isArray(d.CLOSED_WON_STAGES) ? d.CLOSED_WON_STAGES.join(', ') : (d.CLOSED_WON_STAGES || ''),
        STAGE_MAPPING: d.STAGE_MAPPING ? JSON.stringify(d.STAGE_MAPPING) : defaults.STAGE_MAPPING,
      });
      toast.success('Org defaults loaded');
    } catch (e: any) {
      toast.error(e.message || 'Failed to load defaults');
    } finally {
      setLoading(false);
    }
  };

  const saveDefaults = async () => {
    setLoading(true);
    try {
      const payload: any = {
        copperUserEmail: defaults.copperUserEmail,
        emailActivityId: defaults.emailActivityId,
        emailActivityCategory: defaults.emailActivityCategory,
        phoneCallActivityId: defaults.phoneCallActivityId,
        phoneCallActivityCategory: defaults.phoneCallActivityCategory,
        SALES_PIPELINE_ID: defaults.SALES_PIPELINE_ID,
        CLOSED_WON_STAGES: defaults.CLOSED_WON_STAGES.split(',').map((s: string) => s.trim()).filter(Boolean),
      };
      try {
        payload.STAGE_MAPPING = JSON.parse(defaults.STAGE_MAPPING);
      } catch {
        throw new Error('Invalid STAGE_MAPPING JSON');
      }
      const res = await fetch('/api/copper/defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaults: payload })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save defaults');
      toast.success('Org defaults saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save defaults');
    } finally {
      setLoading(false);
    }
  };

  const discoverAll = async () => {
    setLoading(true);
    try {
      // First, load existing defaults from Firestore
      const defaultsRes = await fetch('/api/copper/defaults');
      const defaultsData = await defaultsRes.json();
      const existingDefaults = defaultsData.defaults || {};
      
      // Fetch activity types
      const actTypesRes = await fetch('/api/copper/activity-types');
      const actTypesData = await actTypesRes.json();
      if (actTypesRes.ok) {
        const types = actTypesData.activityTypes || [];
        setActTypes(types);
        
        // Auto-populate from existing Firestore defaults
        if (existingDefaults.emailActivityId) {
          setSelectedEmailType({ 
            id: existingDefaults.emailActivityId, 
            category: existingDefaults.emailActivityCategory || 'system' 
          });
        }
        
        if (existingDefaults.phoneCallActivityId) {
          setSelectedCallType({ 
            id: existingDefaults.phoneCallActivityId, 
            category: existingDefaults.phoneCallActivityCategory || 'user' 
          });
        }
        
        if (existingDefaults.smsActivityId) {
          setSelectedSmsType({ 
            id: existingDefaults.smsActivityId, 
            category: existingDefaults.smsActivityCategory || 'user' 
          });
        }
      }

      // Fetch pipelines
      const pipelinesRes = await fetch('/api/copper/pipelines');
      const pipelinesData = await pipelinesRes.json();
      if (pipelinesRes.ok) {
        const pipes = pipelinesData.pipelines || [];
        setPipelines(pipes);
        
        // Auto-populate pipeline from Firestore
        if (existingDefaults.SALES_PIPELINE_ID) {
          setSelectedPipeline(existingDefaults.SALES_PIPELINE_ID);
          
          // Find the pipeline and populate stages
          const selectedPipe = pipes.find((p: any) => String(p.id) === String(existingDefaults.SALES_PIPELINE_ID));
          if (selectedPipe?.stages && existingDefaults.STAGE_MAPPING) {
            try {
              const stageMap = typeof existingDefaults.STAGE_MAPPING === 'string' 
                ? JSON.parse(existingDefaults.STAGE_MAPPING) 
                : existingDefaults.STAGE_MAPPING;
              
              // Reverse the mapping (from {stageName: metricType} to {metricType: stageName})
              const reversedMap: any = {};
              Object.entries(stageMap).forEach(([stageName, metricType]) => {
                reversedMap[metricType as string] = stageName;
              });
              
              setSelectedStages(reversedMap);
            } catch (e) {
              console.error('Failed to parse stage mapping:', e);
            }
          }
        }
        
        // Auto-populate won stage
        if (existingDefaults.CLOSED_WON_STAGES) {
          const wonStage = Array.isArray(existingDefaults.CLOSED_WON_STAGES) 
            ? existingDefaults.CLOSED_WON_STAGES[0] 
            : existingDefaults.CLOSED_WON_STAGES;
          setSelectedWonStage(wonStage);
        }
      }

      // Validate API user
      const userRes = await fetch('/api/copper/validate-user');
      const userData = await userRes.json();
      if (userRes.ok) {
        setApiUser(userData.user);
      }

      toast.success(`Found ${actTypesData.activityTypes?.length || 0} activity types, ${pipelinesData.pipelines?.length || 0} pipelines. Existing mappings loaded.`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to discover Copper data');
    } finally {
      setLoading(false);
    }
  };

  const applyMappings = () => {
    const updates: any = {};
    if (selectedEmailType.id) {
      updates.emailActivityId = selectedEmailType.id;
      updates.emailActivityCategory = selectedEmailType.category;
    }
    if (selectedCallType.id) {
      updates.phoneCallActivityId = selectedCallType.id;
      updates.phoneCallActivityCategory = selectedCallType.category;
    }
    if (selectedSmsType.id) {
      updates.smsActivityId = selectedSmsType.id;
      updates.smsActivityCategory = selectedSmsType.category;
    }
    if (selectedPipeline) {
      updates.SALES_PIPELINE_ID = selectedPipeline;
    }
    if (selectedWonStage) {
      updates.CLOSED_WON_STAGES = selectedWonStage;
    }
    
    // Build stage mapping from selections
    const stageMapping: any = {};
    Object.entries(selectedStages).forEach(([metricType, stageName]) => {
      if (stageName) {
        stageMapping[stageName] = metricType;
      }
    });
    if (Object.keys(stageMapping).length > 0) {
      updates.STAGE_MAPPING = JSON.stringify(stageMapping);
    }
    
    setDefaults({ ...defaults, ...updates });
    toast.success('Mappings applied to form');
  };

  const loadUsers = async () => {
    try {
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        toast.error('Not authenticated - please refresh and try again');
        return;
      }
      
      console.log('[Load Users] Current user email:', user.email);
      
      const token = await user.getIdToken();
      console.log('[Load Users] Got auth token, length:', token.length);
      
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('[Load Users] Response status:', res.status);
      
      const data = await res.json();
      console.log('[Load Users] Response data:', data);
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(`Unauthorized - you must be an admin. Your email: ${user.email}. Error: ${data?.error || 'Unknown'}`);
        }
        throw new Error(data?.error || 'Failed to load users');
      }
      
      // Filter to active sales users (including admins who are also sales reps) and sort by name
      const salesUsers = (data.users || [])
        .filter((u: any) => (u.role === 'sales' || u.role === 'admin') && u.isActive !== false && u.isCommissioned === true)
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      
      setCopperUsers(salesUsers);
      toast.success(`Loaded ${salesUsers.length} sales users`);
    } catch (e: any) {
      console.error('[Load Users] Error:', e);
      toast.error(e.message || 'Failed to load users');
    }
  };

  const diagnoseEmail = async () => {
    if (!diagUserEmail) {
      toast.error('Enter user email to diagnose');
      return;
    }
    setDiagnosing(true);
    setDiagnosticResults(null);
    try {
      // Call diagnostic endpoint directly with email
      const res = await fetch('/api/admin/diagnose-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: diagUserEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Diagnostic failed');
      setDiagnosticResults(data);
      toast.success(data.summary || 'Diagnostic complete');
    } catch (e: any) {
      toast.error(e.message || 'Diagnostic failed');
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Copper Metadata</h2>
        <p className="text-sm text-gray-600">Discover activity type IDs and custom field definitions, and store org-wide defaults used by the sync.</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={loadDefaults}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50"
        >
          Load Current Defaults
        </button>
        <button
          onClick={fetchMetadata}
          disabled={metaLoading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {metaLoading ? 'Loading...' : 'Fetch Metadata'}
        </button>
      </div>

      {/* Org Defaults Form */}
      <div className="border-t pt-6">
        <h3 className="text-md font-medium mb-4">Organization Defaults</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Copper Org User Email (for Copper API)
            </label>
            <input
              type="email"
              value={defaults.copperUserEmail}
              onChange={(e) => setDefaults({ ...defaults, copperUserEmail: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="integrations@kanvabotanicals.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Email Activity Type ID
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={defaults.emailActivityId}
              onChange={(e) => setDefaults({ ...defaults, emailActivityId: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="e.g. 1"
            />
            <p className="text-xs text-gray-500 mt-1">Required for email sync</p>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Phone Call Activity Type ID</label>
            <input
              type="text"
              value={defaults.phoneCallActivityId}
              onChange={(e) => setDefaults({ ...defaults, phoneCallActivityId: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="e.g. 0"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">SMS Activity Type ID</label>
            <input
              type="text"
              value={defaults.smsActivityId || '2160513'}
              onChange={(e) => setDefaults({ ...defaults, smsActivityId: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="2160513"
            />
            <p className="text-xs text-gray-500 mt-1">Default: 2160513 (SMS activity type)</p>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Sales Pipeline ID</label>
            <input
              type="text"
              value={defaults.SALES_PIPELINE_ID}
              onChange={(e) => setDefaults({ ...defaults, SALES_PIPELINE_ID: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="e.g. 1084986"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Closed Won Stage</label>
            <input
              type="text"
              value={defaults.CLOSED_WON_STAGES}
              onChange={(e) => setDefaults({ ...defaults, CLOSED_WON_STAGES: e.target.value })}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Payment Received"
            />
            <p className="text-xs text-gray-500 mt-1">Stage name that indicates a won deal. Sales are categorized by "Sale Type" field (Wholesale, Distribution, Direct to Consumer)</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Stage Mapping (JSON)</label>
            <textarea
              value={defaults.STAGE_MAPPING}
              onChange={(e) => setDefaults({ ...defaults, STAGE_MAPPING: e.target.value })}
              className="w-full border rounded-md px-3 py-2 font-mono text-sm"
              rows={3}
              placeholder='{"Fact Finding":"lead_progression_a","Contact Stage":"lead_progression_b","Closing Stage":"lead_progression_c"}'
            />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={saveDefaults}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Org Defaults'}
          </button>
        </div>
      </div>

      {/* API User Validation */}
      {apiUser && (
        <div className="border-t pt-6">
          <h3 className="text-md font-medium mb-2">✅ Copper API Connection</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600 font-medium">Connected as:</span>
              <span className="font-semibold">{apiUser.name}</span>
            </div>
            <div className="text-sm text-gray-600">
              <div>Email: {apiUser.email}</div>
              <div>Status: {apiUser.active ? 'Active' : 'Inactive'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Discover Copper Mappings */}
      <div className="border-t pt-6">
        <h3 className="text-md font-medium mb-4">🔍 Discover Copper Field Mappings</h3>
        <p className="text-sm text-gray-600 mb-4">
          Fetch activity types, pipelines, and validate API user. Then select the correct mappings for your organization.
        </p>
        <button
          onClick={discoverAll}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 mb-4"
        >
          {loading ? 'Discovering...' : 'Discover All Mappings'}
        </button>

        {actTypes.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email Activity Type</label>
                <select
                  value={selectedEmailType.id}
                  onChange={(e) => {
                    const type = actTypes.find(t => t.id === e.target.value);
                    setSelectedEmailType({ id: e.target.value, category: type?.category || 'system' });
                  }}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Select email type...</option>
                  {actTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} (ID: {type.id}, {type.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone Call Activity Type</label>
                <select
                  value={selectedCallType.id}
                  onChange={(e) => {
                    const type = actTypes.find(t => t.id === e.target.value);
                    setSelectedCallType({ id: e.target.value, category: type?.category || 'user' });
                  }}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Select call type...</option>
                  {actTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} (ID: {type.id}, {type.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">SMS Activity Type</label>
                <select
                  value={selectedSmsType.id}
                  onChange={(e) => {
                    const type = actTypes.find(t => t.id === e.target.value);
                    setSelectedSmsType({ id: e.target.value, category: type?.category || 'user' });
                  }}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Select SMS type...</option>
                  {actTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} (ID: {type.id}, {type.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sales Pipeline</label>
                <select
                  value={selectedPipeline}
                  onChange={(e) => setSelectedPipeline(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Select pipeline...</option>
                  {pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name} (ID: {pipeline.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stage Mapping */}
            {selectedPipeline && pipelines.find(p => p.id === selectedPipeline)?.stages && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium mb-3">Map Pipeline Stages to Lead Progression</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Fact Finding Stage (A)</label>
                    <select
                      value={selectedStages.lead_progression_a}
                      onChange={(e) => setSelectedStages({...selectedStages, lead_progression_a: e.target.value})}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select stage...</option>
                      {pipelines.find(p => p.id === selectedPipeline)?.stages.map((stage: any) => (
                        <option key={stage.id} value={stage.name}>{stage.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Contact Stage (B)</label>
                    <select
                      value={selectedStages.lead_progression_b}
                      onChange={(e) => setSelectedStages({...selectedStages, lead_progression_b: e.target.value})}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select stage...</option>
                      {pipelines.find(p => p.id === selectedPipeline)?.stages.map((stage: any) => (
                        <option key={stage.id} value={stage.name}>{stage.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Closing Stage (C)</label>
                    <select
                      value={selectedStages.lead_progression_c}
                      onChange={(e) => setSelectedStages({...selectedStages, lead_progression_c: e.target.value})}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select stage...</option>
                      {pipelines.find(p => p.id === selectedPipeline)?.stages.map((stage: any) => (
                        <option key={stage.id} value={stage.name}>{stage.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Closed Won Stage</label>
                    <select
                      value={selectedWonStage}
                      onChange={(e) => setSelectedWonStage(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select stage...</option>
                      {pipelines.find(p => p.id === selectedPipeline)?.stages.map((stage: any) => (
                        <option key={stage.id} value={stage.name}>{stage.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">e.g., "Payment Received"</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={applyMappings}
              className="px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 mt-4"
            >
              Apply Mappings to Form Above
            </button>
          </div>
        )}
      </div>

      {/* Email Diagnostics */}
      <div className="border-t pt-6">
        <h3 className="text-md font-medium mb-4">🩺 Email Sync Diagnostics</h3>
        <p className="text-sm text-gray-600 mb-4">
          Diagnose why emails aren't syncing for a specific user. Checks Copper API connection, activity type mapping, and recent email data.
        </p>
        
        {copperUsers.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-800">💡 Load sales users to select from dropdown</span>
              <button
                onClick={loadUsers}
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Load Users
              </button>
            </div>
          </div>
        )}
        
        <div className="flex gap-3 mb-4">
          <select
            value={diagUserEmail}
            onChange={(e) => setDiagUserEmail(e.target.value)}
            className="flex-1 border rounded-md px-3 py-2 text-sm"
            disabled={copperUsers.length === 0}
          >
            <option value="">Select sales user...</option>
            {copperUsers.map((user: any) => (
              <option key={user.id} value={user.email}>
                {user.name} - {user.title || user.role} ({user.email})
              </option>
            ))}
          </select>
          {copperUsers.length > 0 && (
            <button
              onClick={loadUsers}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
              title="Refresh user list"
            >
              🔄
            </button>
          )}
          <button
            onClick={diagnoseEmail}
            disabled={diagnosing || !diagUserEmail}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400"
          >
            {diagnosing ? 'Diagnosing...' : 'Run Diagnostic'}
          </button>
        </div>

        {diagnosticResults && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${
              diagnosticResults.summary.startsWith('✅') ? 'bg-green-50 border border-green-200' :
              diagnosticResults.summary.startsWith('⚠️') ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <h4 className="font-medium mb-2">{diagnosticResults.summary}</h4>
              <div className="text-sm space-y-2">
                {diagnosticResults.checks.map((check: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-lg">
                      {check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'}
                    </span>
                    <div>
                      <div className="font-medium">{check.name}</div>
                      <div className="text-gray-600">{check.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {diagnosticResults.recommendations && diagnosticResults.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">💡 Recommendations:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  {diagnosticResults.recommendations.map((rec: string, i: number) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <details className="bg-gray-50 rounded-lg p-4">
              <summary className="cursor-pointer text-sm font-medium">View Full Diagnostic Report</summary>
              <pre className="text-xs font-mono mt-3 overflow-x-auto">{JSON.stringify(diagnosticResults, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>

      {/* Metadata Display */}
      {meta && (
        <div className="border-t pt-6">
          <h3 className="text-md font-medium mb-4">Fetched Metadata</h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-xs font-mono">{JSON.stringify(meta, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
