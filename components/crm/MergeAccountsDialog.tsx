'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import type { UnifiedAccount } from '@/lib/crm/dataService';
import { detectMergeConflicts, mergeAccounts, type MergeConflict, type MergeResolution } from '@/lib/crm/mergeService';

interface MergeAccountsDialogProps {
  accounts: UnifiedAccount[];
  onClose: () => void;
  onMergeComplete: () => void;
  userId: string;
}

export function MergeAccountsDialog({ accounts, onClose, onMergeComplete, userId }: MergeAccountsDialogProps) {
  const [primaryAccountId, setPrimaryAccountId] = useState<string>(accounts[0]?.id || '');
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, 'primary' | 'secondary'>>({});
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Detect conflicts when accounts or primary selection changes
  useEffect(() => {
    if (accounts.length >= 2) {
      const primary = accounts.find(a => a.id === primaryAccountId);
      const secondaryAccounts = accounts.filter(a => a.id !== primaryAccountId);
      
      if (primary && secondaryAccounts.length > 0) {
        // Merge conflicts from all secondary accounts
        let allConflicts: MergeConflict[] = [];
        
        // For each secondary account, detect conflicts with primary
        secondaryAccounts.forEach(secondary => {
          const conflicts = detectMergeConflicts(primary, secondary);
          
          // Merge conflicts - if a field already has a conflict, keep the existing one
          conflicts.forEach(conflict => {
            const existing = allConflicts.find(c => c.fieldName === conflict.fieldName);
            if (!existing) {
              allConflicts.push(conflict);
            } else if (conflict.isDifferent && !existing.isDifferent) {
              // Replace if this one has a difference and existing doesn't
              allConflicts = allConflicts.map(c => 
                c.fieldName === conflict.fieldName ? conflict : c
              );
            }
          });
        });
        
        setConflicts(allConflicts);
        
        // Initialize resolutions with auto-resolve or primary by default
        const initialResolutions: Record<string, 'primary' | 'secondary'> = {};
        allConflicts.forEach(conflict => {
          if (conflict.autoResolve === 'primary' || conflict.autoResolve === 'merge') {
            initialResolutions[conflict.fieldName] = 'primary';
          } else if (conflict.autoResolve === 'secondary') {
            initialResolutions[conflict.fieldName] = 'secondary';
          } else {
            // Default to primary for conflicts
            initialResolutions[conflict.fieldName] = 'primary';
          }
        });
        setResolutions(initialResolutions);
      }
    }
  }, [accounts, primaryAccountId]);

  const handleMerge = async () => {
    if (accounts.length < 2) return;
    
    setMerging(true);
    setError(null);
    
    const primary = accounts.find(a => a.id === primaryAccountId);
    const secondaryAccounts = accounts.filter(a => a.id !== primaryAccountId);
    
    if (!primary || secondaryAccounts.length === 0) {
      setError('Invalid account selection');
      setMerging(false);
      return;
    }
    
    // Build resolution array
    const mergeResolutions: MergeResolution[] = conflicts.map(conflict => ({
      fieldName: conflict.fieldName,
      chosenValue: resolutions[conflict.fieldName] === 'primary' 
        ? conflict.primaryValue 
        : conflict.secondaryValue,
      source: resolutions[conflict.fieldName],
      rejectedValue: resolutions[conflict.fieldName] === 'primary'
        ? conflict.secondaryValue
        : conflict.primaryValue,
    }));
    
    // Execute merge with all secondary account IDs
    const result = await mergeAccounts(
      primary.id,
      secondaryAccounts.map(a => a.id),
      mergeResolutions,
      userId
    );
    
    if (result.success) {
      setSuccess(true);
      setMerging(false);
      
      // Show success message for 2 seconds, then close
      setTimeout(() => {
        onMergeComplete();
        onClose();
      }, 2000);
    } else {
      setError(result.error || 'Failed to merge accounts');
      setMerging(false);
    }
  };

  if (accounts.length < 2) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Merge Accounts</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600">Please select at least 2 accounts to merge.</p>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const primary = accounts.find(a => a.id === primaryAccountId);
  const secondary = accounts.find(a => a.id !== primaryAccountId);
  const conflictingFields = conflicts.filter(c => c.isDifferent);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Merge Accounts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-600 mb-4">
            You are merging {accounts.length} accounts.
          </p>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Warning: This action cannot be undone</p>
              <p className="text-xs text-yellow-700 mt-1">
                The secondary account will be archived and all related contacts and deals will be moved to the primary account.
              </p>
            </div>
          </div>

          {/* Primary Account Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Account (will be kept):
            </label>
            <div className="space-y-2">
              {accounts.map(account => (
                <label key={account.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="primary"
                    value={account.id}
                    checked={primaryAccountId === account.id}
                    onChange={(e) => setPrimaryAccountId(e.target.value)}
                    className="w-4 h-4 text-[#93D500] focus:ring-[#93D500]"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{account.name}</div>
                    <div className="text-xs text-gray-500">
                      ID: {account.copperId} • {account.email || 'No email'} • {account.phone || 'No phone'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Conflicts */}
          {conflictingFields.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Conflicts found ({conflictingFields.length}):
              </h3>
              <p className="text-xs text-gray-500 mb-4">Select which information to use.</p>

              <div className="space-y-4">
                {conflictingFields.map(conflict => (
                  <div key={conflict.fieldName} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-medium text-sm text-gray-900 mb-3">{conflict.fieldLabel}</div>
                    <div className="space-y-2">
                      {/* Primary option */}
                      <label className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name={conflict.fieldName}
                          value="primary"
                          checked={resolutions[conflict.fieldName] === 'primary'}
                          onChange={() => setResolutions(prev => ({ ...prev, [conflict.fieldName]: 'primary' }))}
                          className="mt-1 w-4 h-4 text-[#93D500] focus:ring-[#93D500]"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">
                            {formatValue(conflict.primaryValue) || <span className="text-gray-400 italic">Empty</span>}
                          </div>
                          <div className="text-xs text-gray-500">From: {primary?.name}</div>
                        </div>
                      </label>

                      {/* Secondary option */}
                      <label className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name={conflict.fieldName}
                          value="secondary"
                          checked={resolutions[conflict.fieldName] === 'secondary'}
                          onChange={() => setResolutions(prev => ({ ...prev, [conflict.fieldName]: 'secondary' }))}
                          className="mt-1 w-4 h-4 text-[#93D500] focus:ring-[#93D500]"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">
                            {formatValue(conflict.secondaryValue) || <span className="text-gray-400 italic">Empty</span>}
                          </div>
                          <div className="text-xs text-gray-500">From: {secondary?.name}</div>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {conflictingFields.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-900">No conflicts found. Accounts can be merged directly.</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Merge completed successfully!</p>
                <p className="text-xs text-green-700 mt-1">Refreshing account list...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={merging || success}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={merging || success}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {success ? (
              <>
                <Check className="w-4 h-4" />
                Completed
              </>
            ) : merging ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Merging...
              </>
            ) : (
              'Finish Merge'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatValue(value: any): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
