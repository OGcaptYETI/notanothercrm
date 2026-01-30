'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import {
  Users,
  Filter,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  AlertCircle,
  Upload,
  Download,
  MapIcon,
  Store,
  X,
  RefreshCw,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  UserX
} from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerMap from './CustomerMap';
import RepRallyMap from './RepRallyMap';

interface CustomersTabProps {
  isAdmin: boolean;
  reps: any[];
  adminListOnly?: boolean; // When true, only show Customer List (for Settings page)
}

export default function CustomersTab({ isAdmin, reps, adminListOnly = false }: CustomersTabProps) {
  // Customer Management state
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [savingCustomer, setSavingCustomer] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'originalOwner' | 'shippingCity' | 'shippingState' | 'region' | 'orderCount' | 'lifetimeValue'>('customerName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [confirmAdminChange, setConfirmAdminChange] = useState<{ customerId: string; newRep: string; customerName: string } | null>(null);

  // Sub-tabs
  const [customerSubTab, setCustomerSubTab] = useState<'list' | 'map' | '3rdparty'>('list');
  const [thirdPartySubTab, setThirdPartySubTab] = useState<'overview' | 'switchers' | 'map' | 'data'>('overview');

  // Batch edit state
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [batchAccountType, setBatchAccountType] = useState('');
  const [batchSalesRep, setBatchSalesRep] = useState('');
  const [batchTransferStatus, setBatchTransferStatus] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  // CSV Bulk Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [committingCsv, setCommittingCsv] = useState(false);

  // 3rd Party Analysis state
  const [thirdPartyData, setThirdPartyData] = useState<any>(null);
  const [thirdPartyLoading, setThirdPartyLoading] = useState(false);
  const [reprallyAnalytics, setReprallyAnalytics] = useState<any>(null);
  const [reprallyAnalyticsLoading, setReprallyAnalyticsLoading] = useState(false);
  const [reprallySwitchers, setReprallySwitchers] = useState<any>(null);
  const [reprallySwitchersLoading, setReprallySwitchersLoading] = useState(false);
  const [matchCustomersLoading, setMatchCustomersLoading] = useState(false);
  const [matchCustomersResult, setMatchCustomersResult] = useState<any>(null);
  const [extractRepRallyLoading, setExtractRepRallyLoading] = useState(false);
  const [extractRepRallyResult, setExtractRepRallyResult] = useState<any>(null);
  const [buildRepRallyLoading, setbuildRepRallyLoading] = useState(false);
  const [buildRepRallyResult, setBuildRepRallyResult] = useState<any>(null);

  // Switcher detail view state
  const [selectedSwitcher, setSelectedSwitcher] = useState<any>(null);
  const [switcherOrdersLoading, setSwitcherOrdersLoading] = useState(false);
  const [switcherOrders, setSwitcherOrders] = useState<any>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Enhanced analytics state
  const [enhancedAnalytics, setEnhancedAnalytics] = useState<any>(null);
  const [enhancedAnalyticsLoading, setEnhancedAnalyticsLoading] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedCustomerOrders, setExpandedCustomerOrders] = useState<Set<string>>(new Set());
  
  // Customer type filter for 3rd party view
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'reprally' | 'retail'>('all');

  // Comprehensive switchers state
  const [comprehensiveSwitchers, setComprehensiveSwitchers] = useState<any>(null);
  const [comprehensiveSwitchersLoading, setComprehensiveSwitchersLoading] = useState(false);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);
  
  // Auto-load analytics when 3rd party tab is selected
  useEffect(() => {
    if (customerSubTab === '3rdparty' && !reprallyAnalytics && !reprallyAnalyticsLoading) {
      loadReprallyAnalytics();
    }
  }, [customerSubTab]);

  const loadCustomers = async () => {
    console.log('Loading customers...');
    try {
      // Load reps first to map salesPerson to rep names
      const usersQuery = query(
        collection(db, 'users'),
        where('isCommissioned', '==', true)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const repsMap = new Map();
      const repsByName = new Map<string, string>();
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.salesPerson) {
          repsMap.set(data.salesPerson, data.name);
          if (data.name) {
            repsByName.set(String(data.name), String(data.salesPerson));
          }
        }
      });
      console.log(`Loaded ${repsMap.size} reps for mapping`);

      // Load customer sales summary for metrics
      const summarySnapshot = await getDocs(collection(db, 'customer_sales_summary'));
      const summaryMap = new Map();
      summarySnapshot.forEach((doc) => {
        const data = doc.data();
        summaryMap.set(doc.id, {
          orderCount: data.orderCount || 0,
          totalSales: data.totalSales || 0,
          region: data.region || '',
          regionColor: data.regionColor || '#808080'
        });
      });
      console.log(`Loaded ${summaryMap.size} customer sales summaries`);

      // Load line items to calculate lifetime value (revenue is in line items, not order docs)
      const lineItemsSnapshot = await getDocs(collection(db, 'fishbowl_soitems'));
      const customerOrdersMap = new Map<string, { count: number; totalRevenue: number; orders: Set<string> }>();
      const customerSalesRepMap = new Map();
      
      console.log(`Loading ${lineItemsSnapshot.size} line items to calculate customer lifetime values...`);
      
      lineItemsSnapshot.forEach((doc) => {
        const item = doc.data();
        const customerId = item.customerId;
        const salesOrderId = item.salesOrderId;
        
        if (customerId && salesOrderId) {
          const existing = customerOrdersMap.get(customerId) || { 
            count: 0, 
            totalRevenue: 0, 
            orders: new Set<string>() 
          };
          
          // Track unique orders for count
          if (!existing.orders.has(salesOrderId)) {
            existing.orders.add(salesOrderId);
            existing.count++;
          }
          
          // Calculate revenue from line item
          const itemRevenue = Number(item.totalPrice || 0);
          existing.totalRevenue += itemRevenue;
          
          customerOrdersMap.set(customerId, existing);
        }
        
        // Get sales rep from line items
        if (item.customerId && item.salesPerson) {
          customerSalesRepMap.set(item.customerId, item.salesPerson);
        }
      });
      
      console.log(`Calculated lifetime value for ${customerOrdersMap.size} customers from ${lineItemsSnapshot.size} line items`);
      console.log(`Mapped ${customerSalesRepMap.size} customers to sales reps`);

      // Get customers
      const snapshot = await getDocs(collection(db, 'fishbowl_customers'));
      console.log(`Found ${snapshot.size} customers in Firestore`);

      const customersData: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const customerId = data.id || data.customerNum || doc.id;

        // Get sales summary metrics - use fallback from orders if summary doesn't exist
        const summaryData = summaryMap.get(customerId);
        const ordersData = customerOrdersMap.get(customerId);
        
        const summary = {
          orderCount: summaryData?.orderCount || ordersData?.count || 0,
          totalSales: summaryData?.totalSales || ordersData?.totalRevenue || 0,
          region: summaryData?.region || '',
          regionColor: summaryData?.regionColor || '#808080'
        };

        // Get CURRENT account owner for display/Copper sync
        // Priority: manual override > currentOwner > salesRep > salesPerson (from Fishbowl import)
        // NOTE: This is for account ownership management, NOT commission originator (which comes from orders)
        const currentOwnerRaw = data.fishbowlUsername ||        // Manual admin assignment
                                data.currentOwner ||           // New field for current owner
                                data.salesRep ||               // Fishbowl "Sales Rep" (account owner)
                                data.salesPerson ||            // From Fishbowl import (account owner name)
                                '';
        // Normalize owner value so dropdowns (which key by salesPerson code) render correctly.
        // Some older docs store a rep display name (e.g. "Ben Wallner") instead of a code (e.g. "BenW").
        const currentOwner = repsMap.has(currentOwnerRaw)
          ? String(currentOwnerRaw)
          : (repsByName.get(String(currentOwnerRaw)) || String(currentOwnerRaw || ''));
        const currentOwnerName = repsMap.get(currentOwner) || currentOwner || 'Unassigned';

        // Get the original owner from Fishbowl orders (for reference only)
        const originalOwner = customerSalesRepMap.get(customerId) || data.salesRep || 'Unassigned';

        // Normalize accountType to handle Copper array format
        let accountType = data.accountType || 'Retail';
        if (Array.isArray(accountType) && accountType.length > 0) {
          const typeId = accountType[0];
          if (typeId === 2063862 || typeId === '2063862') accountType = 'Wholesale';
          else if (typeId === 1981470 || typeId === '1981470') accountType = 'Distributor';
          else if (typeId === 2066840 || typeId === '2066840') accountType = 'Retail';
          else accountType = 'Retail';
        } else if (typeof accountType !== 'string') {
          accountType = 'Retail';
        }

        customersData.push({
          id: doc.id,
          customerNum: data.id || data.accountNumber?.toString() || doc.id,
          customerName: data.name || data.customerContact || 'Unknown',
          accountType: accountType,
          salesPerson: currentOwnerName,                    // Display name of CURRENT owner
          fishbowlUsername: currentOwner,                   // Fishbowl username for filtering
          currentOwner: currentOwner,                       // New: current account owner
          originalOwner: originalOwner,                     // Original from Fishbowl orders
          shippingCity: data.shippingCity || '',
          shippingState: data.shippingState || '',
          lat: data.lat,
          lng: data.lng,
          transferStatus: data.transferStatus,
          copperId: data.copperId,
          // Sales metrics from customer_sales_summary
          orderCount: summary.orderCount,
          lifetimeValue: summary.totalSales,
          region: summary.region,
          regionColor: summary.regionColor
        });
      });

      // Sort by customer name
      customersData.sort((a, b) => a.customerName.localeCompare(b.customerName));

      console.log('Loaded customers:', customersData.length);
      console.log('Sample customer:', customersData[0]);
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    }
  };

  const updateTransferStatus = async (customerId: string, newStatus: string) => {
    setSavingCustomer(customerId);
    try {
      const customerRef = doc(db, 'fishbowl_customers', customerId);
      await updateDoc(customerRef, {
        transferStatus: newStatus === 'auto' ? null : newStatus
      });

      // Update local state
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, transferStatus: newStatus === 'auto' ? null : newStatus } : c
      ));
      setFilteredCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, transferStatus: newStatus === 'auto' ? null : newStatus } : c
      ));

      toast.success('Transfer status updated');
    } catch (error) {
      console.error('Error updating transfer status:', error);
      toast.error('Failed to update transfer status');
    } finally {
      setSavingCustomer(null);
    }
  };

  const updateAccountType = async (customerId: string, newAccountType: string) => {
    setSavingCustomer(customerId);
    try {
      const customerRef = doc(db, 'fishbowl_customers', customerId);

      // Get customer data to find Copper ID
      const customerSnapshot = await getDoc(customerRef);
      const customerData = customerSnapshot.data();
      const copperId = customerData?.copperId;
      const customerName = customerData?.name || customerData?.customerName || 'Unknown';

      // Update Fishbowl
      await updateDoc(customerRef, {
        accountType: newAccountType
      });

      // Update local state
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, accountType: newAccountType } : c
      ));
      setFilteredCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, accountType: newAccountType } : c
      ));

      // Sync to Copper if we have a Copper ID
      if (copperId) {
        console.log(`🔄 Syncing account type change to Copper for ${customerName}...`);

        try {
          const copperResponse = await fetch('/api/copper/update-account-type', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              copperId,
              accountType: newAccountType,
              customerName
            })
          });

          const copperResult = await copperResponse.json();

          if (copperResult.success) {
            console.log(`✅ Copper updated successfully for ${customerName}`);
            toast.success('Account type updated in Fishbowl and Copper!');
          } else if (copperResult.warning) {
            console.warn(`⚠️ ${copperResult.warning}`);
            toast.success('Account type updated in Fishbowl (Copper sync skipped)');
          }
        } catch (copperError) {
          console.error('Error syncing to Copper:', copperError);
          toast.success('Account type updated in Fishbowl (Copper sync failed)');
        }
      } else {
        // No Copper ID, just update Fishbowl
        toast.success('Account type updated!');
      }

    } catch (error) {
      console.error('Error updating account type:', error);
      toast.error('Failed to update account type');
    } finally {
      setSavingCustomer(null);
    }
  };

  // Check if a customer's sales rep should be locked (protected system accounts)
  const isRepLocked = (originalOwner: string): { locked: boolean; reason: string } => {
    const owner = originalOwner.toLowerCase();

    if (owner === 'shopify') {
      return { locked: true, reason: 'SHOPIFY accounts are retail customers - do not modify' };
    }
    if (owner === 'shipstation') {
      return { locked: true, reason: 'ShipStation system account - do not modify' };
    }
    // admin can be changed if needed, so not locked
    return { locked: false, reason: '' };
  };

  const handleSalesRepChange = (customerId: string, newFishbowlUsername: string, originalOwner: string, customerName: string) => {
    // If changing from admin, show confirmation
    if (originalOwner.toLowerCase() === 'admin' && newFishbowlUsername.toLowerCase() !== 'admin') {
      setConfirmAdminChange({ customerId, newRep: newFishbowlUsername, customerName });
    } else {
      // Proceed with update
      updateSalesRep(customerId, newFishbowlUsername);
    }
  };

  const confirmAdminRepChange = () => {
    if (confirmAdminChange) {
      updateSalesRep(confirmAdminChange.customerId, confirmAdminChange.newRep);
      setConfirmAdminChange(null);
    }
  };

  const updateSalesRep = async (customerId: string, newFishbowlUsername: string) => {
    setSavingCustomer(customerId);
    try {
      const customerRef = doc(db, 'fishbowl_customers', customerId);
      const normalizedUsername = newFishbowlUsername === 'UNASSIGNED' ? '' : (newFishbowlUsername || '');
      const repName = reps.find(r => r.salesPerson === normalizedUsername)?.name || normalizedUsername || 'Unassigned';

      // Get customer data to find Copper ID
      const customerSnapshot = await getDoc(customerRef);
      const customerData = customerSnapshot.data();
      const copperId = customerData?.copperId;
      const customerName = customerData?.name || customerData?.customerName || 'Unknown';

      // Update both fishbowlUsername (manual assignment) and salesPerson (display name)
      await updateDoc(customerRef, {
        fishbowlUsername: normalizedUsername,  // manual override
        salesPerson: repName
      });

      // Update local state
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, salesPerson: repName, fishbowlUsername: normalizedUsername } : c
      ));
      setFilteredCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, salesPerson: repName, fishbowlUsername: normalizedUsername } : c
      ));

      // Sync to Copper only when assigning to a real rep (non-empty)
      if (copperId && normalizedUsername) {
        console.log(`🔄 Syncing sales rep change to Copper for ${customerName}...`);
        try {
          const copperResponse = await fetch('/api/copper/update-owner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              copperId,
              newSalesPerson: normalizedUsername,
              customerName
            })
          });

          const copperResult = await copperResponse.json();
          if (copperResult.success) {
            console.log(`✅ Copper updated successfully for ${customerName}`);
            toast.success('Sales rep updated in Fishbowl and Copper!');
          } else if (copperResult.warning) {
            console.warn(`⚠️ ${copperResult.warning}`);
            toast.success('Sales rep updated in Fishbowl (Copper sync skipped)');
          } else {
            toast.success('Sales rep updated in Fishbowl');
          }
        } catch (copperError) {
          console.error('Error syncing to Copper:', copperError);
          toast.success('Sales rep updated in Fishbowl (Copper sync failed)');
        }
      } else {
        toast.success('Sales rep updated!');
      }

    } catch (error) {
      console.error('Error updating sales rep:', error);
      toast.error('Failed to update sales rep');
    } finally {
      setSavingCustomer(null);
    }
  };

  const handleSort = (field: 'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'originalOwner' | 'shippingCity' | 'shippingState' | 'region' | 'orderCount' | 'lifetimeValue') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Batch edit functions
  const toggleCustomerSelection = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedCustomers.size === 0) {
      toast.error('No customers selected');
      return;
    }

    if (!batchAccountType && !batchSalesRep && !batchTransferStatus) {
      toast.error('Please select at least one field to update');
      return;
    }

    setSavingBatch(true);
    const loadingToast = toast.loading(`Updating ${selectedCustomers.size} customers...`);

    try {
      let successCount = 0;
      let failCount = 0;
      let copperSyncCount = 0;

      console.log(`🔄 Starting batch update for ${selectedCustomers.size} customers`);
      console.log(`   Account Type: ${batchAccountType || 'none'}`);
      console.log(`   Sales Rep: ${batchSalesRep || 'none'}`);
      console.log(`   Transfer Status: ${batchTransferStatus || 'none'}`);

      // Process each customer individually to trigger Copper sync
      for (const customerId of Array.from(selectedCustomers)) {
        console.log(`\n📝 Processing customer: ${customerId}`);
        try {
          const customerRef = doc(db, 'fishbowl_customers', customerId);
          const customerSnapshot = await getDoc(customerRef);
          const customerData = customerSnapshot.data();
          const copperId = customerData?.copperId;
          const customerName = customerData?.name || customerData?.customerName || 'Unknown';

          const updates: any = {};
          console.log(`   Customer: ${customerName}, Copper ID: ${copperId || 'none'}`);

          // Update Account Type
          if (batchAccountType) {
            console.log(`   → Setting accountType to: ${batchAccountType}`);
            updates.accountType = batchAccountType;

            // Sync to Copper if available
            if (copperId) {
              console.log(`   → Syncing account type to Copper...`);
              try {
                const copperResponse = await fetch('/api/copper/update-account-type', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ copperId, accountType: batchAccountType, customerName })
                });
                const copperResult = await copperResponse.json();
                if (copperResult.success) {
                  console.log(`   ✅ Copper account type synced`);
                  copperSyncCount++;
                } else {
                  console.log(`   ⚠️ Copper sync skipped: ${copperResult.warning || copperResult.error}`);
                }
              } catch (copperError) {
                console.error(`   ❌ Copper sync failed:`, copperError);
              }
            } else {
              console.log(`   ⚠️ No Copper ID, skipping sync`);
            }
          }

          // Update Sales Rep
          if (batchSalesRep) {
            console.log(`   → Looking for rep with salesPerson: ${batchSalesRep}`);
            if (batchSalesRep === 'UNASSIGNED') {
              updates.salesPerson = 'Unassigned';
              updates.fishbowlUsername = '';
              console.log(`   → Clearing sales rep assignment (Unassigned)`);
            } else {
            const selectedRep = reps.find(r => r.salesPerson === batchSalesRep);
            console.log(`   → Found rep:`, selectedRep);
            if (selectedRep) {
              updates.salesPerson = selectedRep.name;
              updates.fishbowlUsername = selectedRep.salesPerson;
              console.log(`   → Setting salesPerson to: ${selectedRep.name} (${selectedRep.salesPerson})`);

              // Sync to Copper if available
              if (copperId && selectedRep.salesPerson) {
                console.log(`   → Syncing sales rep to Copper...`);
                try {
                  const copperResponse = await fetch('/api/copper/update-owner', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ copperId, newSalesPerson: selectedRep.salesPerson, customerName })
                  });
                  const copperResult = await copperResponse.json();
                  if (copperResult.success) {
                    console.log(`   ✅ Copper owner synced`);
                    copperSyncCount++;
                  } else {
                    console.log(`   ⚠️ Copper sync skipped: ${copperResult.warning || copperResult.error}`);
                  }
                } catch (copperError) {
                  console.error(`   ❌ Copper sync failed:`, copperError);
                }
              } else {
                console.log(`   ⚠️ No Copper ID or salesPerson, skipping sync`);
              }
            } else {
              console.error(`   ❌ Rep not found with ID: ${batchSalesRep}`);
            }
            }
          }

          // Update Transfer Status
          if (batchTransferStatus) {
            const statusValue = batchTransferStatus === 'auto' ? null : batchTransferStatus;
            console.log(`   → Setting transferStatus to: ${statusValue}`);
            updates.transferStatus = statusValue;
          }

          console.log(`   → Updating Firestore with:`, updates);
          // Update Firestore
          await updateDoc(customerRef, updates);

          // Update local state for this customer
          setCustomers(prev => prev.map(c =>
            c.id === customerId ? { ...c, ...updates } : c
          ));
          setFilteredCustomers(prev => prev.map(c =>
            c.id === customerId ? { ...c, ...updates } : c
          ));

          console.log(`   ✅ Customer updated successfully`);
          successCount++;
        } catch (error) {
          console.error(`   ❌ Failed to update customer ${customerId}:`, error);
          failCount++;
        }
      }

      console.log(`\n📊 Batch update complete:`);
      console.log(`   Success: ${successCount}`);
      console.log(`   Failed: ${failCount}`);
      console.log(`   Copper Synced: ${copperSyncCount}`);

      const message = copperSyncCount > 0
        ? `✅ Updated ${successCount} customers (${copperSyncCount} synced to Copper)!`
        : `✅ Updated ${successCount} customers!`;

      if (failCount > 0) {
        toast.error(`⚠️ ${failCount} customers failed to update`, { id: loadingToast });
      } else {
        toast.success(message, { id: loadingToast });
      }

      // Reset batch state
      setSelectedCustomers(new Set());
      setBatchAccountType('');
      setBatchSalesRep('');
      setBatchTransferStatus('');
      setBatchEditMode(false);
    } catch (error: any) {
      console.error('Error batch updating customers:', error);
      toast.error(error.message || 'Failed to update customers', { id: loadingToast });
    } finally {
      setSavingBatch(false);
    }
  };

  // CSV Bulk Import handlers
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setCsvFile(file);
    setImportingCsv(true);

    try {
      // Read file content
      const text = await file.text();

      // Send to preview API
      const response = await fetch('/api/customers/bulk-import-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: text })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to preview import');
      }

      setCsvPreview(result);
      setShowCsvPreview(true);

      toast.success(`📊 Preview ready: ${result.stats.new} new, ${result.stats.updated} updates`);
    } catch (error: any) {
      console.error('Error previewing CSV:', error);
      toast.error(error.message || 'Failed to preview CSV');
      setCsvFile(null);
    } finally {
      setImportingCsv(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleCommitCsvImport = async () => {
    if (!csvPreview || !csvPreview.updates) {
      toast.error('No preview data available');
      return;
    }

    setCommittingCsv(true);
    const loadingToast = toast.loading('Committing changes to database...');

    try {
      const response = await fetch('/api/customers/bulk-import-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: csvPreview.updates })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to commit import');
      }

      toast.success(
        `✅ Import complete! ${result.stats.created} created, ${result.stats.updated} updated`,
        { id: loadingToast }
      );

      // Reload customers
      await loadCustomers();

      // Reset state
      setCsvFile(null);
      setCsvPreview(null);
      setShowCsvPreview(false);

    } catch (error: any) {
      console.error('Error committing CSV:', error);
      toast.error(error.message || 'Failed to commit import', { id: loadingToast });
    } finally {
      setCommittingCsv(false);
    }
  };

  const handleCancelCsvImport = () => {
    setCsvFile(null);
    setCsvPreview(null);
    setShowCsvPreview(false);
  };

  // 3rd Party / RepRally Analytics Functions
  const loadThirdPartyAnalysis = async () => {
    setThirdPartyLoading(true);
    const loadingToast = toast.loading('🔍 Analyzing 3rd party sales data...');

    try {
      const response = await fetch('/api/analyze-third-party?type=switchers');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setThirdPartyData(data);
      setThirdPartyLoading(false);

      toast.success(
        `✅ Found ${data.summary.switchers} customers who switched to RepRally`,
        { id: loadingToast, duration: 5000 }
      );

    } catch (error: any) {
      console.error('3rd party analysis error:', error);
      toast.error(error.message || 'Failed to analyze 3rd party data', { id: loadingToast });
      setThirdPartyLoading(false);
    }
  };

  const loadReprallyAnalytics = async () => {
    setReprallyAnalyticsLoading(true);
    const loadingToast = toast.loading('📊 Loading RepRally analytics from cache...');

    try {
      // Try cached data first (fast)
      const response = await fetch('/api/cache/reprally-analytics?type=all');
      const data = await response.json();

      if (!response.ok || !data.cached) {
        // Cache doesn't exist, show message to rebuild
        toast.error('Cache not built. Please rebuild cache in Data & Sync tab.', { id: loadingToast });
        setReprallyAnalyticsLoading(false);
        return;
      }

      // Transform cached data to match expected format (JSX expects .summary.X)
      setReprallyAnalytics({
        summary: {
          customers: data.summary?.totalCustomers || 0,
          orders: (data.summary?.reprallyOrders || 0) + (data.summary?.retailOrders || 0),
          revenue: data.summary?.totalRevenue || 0,
          avgOrderValue: data.summary?.avgOrderValue || 0,
          topStates: data.summary?.topStates || [],
          // Breakdown by type
          reprallyCustomers: data.summary?.reprallyCustomers || 0,
          reprallyOrders: data.summary?.reprallyOrders || 0,
          reprallyRevenue: data.summary?.reprallyRevenue || 0,
          retailCustomers: data.summary?.retailCustomers || 0,
          retailOrders: data.summary?.retailOrders || 0,
          retailRevenue: data.summary?.retailRevenue || 0,
          switcherCount: data.summary?.switcherCount || 0
        },
        topCustomers: data.topCustomers || [],
        cacheAge: data.cacheAgeMs,
        updatedAt: data.updatedAt
      });
      setReprallyAnalyticsLoading(false);
      
      const cacheAgeHours = data.cacheAgeMs ? Math.round(data.cacheAgeMs / 1000 / 60 / 60) : 0;
      toast.success(`✅ Analytics loaded from cache (${cacheAgeHours}h old)`, { id: loadingToast, duration: 4000 });
    } catch (error: any) {
      console.error('RepRally analytics error:', error);
      toast.error(error.message || 'Failed to load RepRally analytics', { id: loadingToast });
      setReprallyAnalyticsLoading(false);
    }
  };

  const loadReprallySwitchers = async (write = false) => {
    setReprallySwitchersLoading(true);
    const loadingToast = toast.loading('🔁 Loading switchers from cache...');

    try {
      // Try cached data first (fast)
      const response = await fetch('/api/cache/reprally-analytics?type=switchers');
      const data = await response.json();

      if (!response.ok || !data.cached) {
        toast.error('Cache not built. Please rebuild cache in Data & Sync tab.', { id: loadingToast });
        setReprallySwitchersLoading(false);
        return;
      }

      setReprallySwitchers({
        switchers: data.switchers || [],
        stats: { switchersFound: data.count || 0 }
      });
      setReprallySwitchersLoading(false);
      
      const cacheAgeHours = data.cacheAgeMs ? Math.round(data.cacheAgeMs / 1000 / 60 / 60) : 0;
      toast.success(`✅ Found ${data.count || 0} switchers (cache ${cacheAgeHours}h old)`, { id: loadingToast, duration: 5000 });
    } catch (error: any) {
      console.error('RepRally switcher analysis error:', error);
      toast.error(error.message || 'Failed to analyze switchers', { id: loadingToast });
      setReprallySwitchersLoading(false);
    }
  };

  const loadSwitcherOrders = async (switcher: any) => {
    setSelectedSwitcher(switcher);
    setSwitcherOrdersLoading(true);
    setSwitcherOrders(null);
    setExpandedOrders(new Set());

    try {
      const params = new URLSearchParams();
      if (switcher.fbCustomerId) params.append('customerId', switcher.fbCustomerId);
      if (switcher.rrCustomerId) params.append('rrCustomerId', switcher.rrCustomerId);

      const response = await fetch(`/api/reprally/customer-orders?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load orders');
      }

      setSwitcherOrders(data);
      setSwitcherOrdersLoading(false);
    } catch (error: any) {
      console.error('Error loading switcher orders:', error);
      toast.error(error.message || 'Failed to load order details');
      setSwitcherOrdersLoading(false);
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const loadEnhancedAnalytics = async () => {
    setEnhancedAnalyticsLoading(true);
    const loadingToast = toast.loading('📊 Loading enhanced RepRally analytics...');

    try {
      const response = await fetch('/api/reprally/enhanced-analytics');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load enhanced analytics');
      }

      setEnhancedAnalytics(data);
      setEnhancedAnalyticsLoading(false);
      toast.success(
        `✅ Loaded ${data.summary?.totalCustomers || 0} customers, ${data.summary?.totalOrders || 0} orders`,
        { id: loadingToast, duration: 4000 }
      );
    } catch (error: any) {
      console.error('Enhanced analytics error:', error);
      toast.error(error.message || 'Failed to load enhanced analytics', { id: loadingToast });
      setEnhancedAnalyticsLoading(false);
    }
  };

  const toggleCustomerExpand = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const toggleCustomerOrderExpand = (orderNum: string) => {
    const newExpanded = new Set(expandedCustomerOrders);
    if (newExpanded.has(orderNum)) {
      newExpanded.delete(orderNum);
    } else {
      newExpanded.add(orderNum);
    }
    setExpandedCustomerOrders(newExpanded);
  };

  const loadComprehensiveSwitchers = async () => {
    setComprehensiveSwitchersLoading(true);
    const loadingToast = toast.loading('🔄 Running comprehensive switcher analysis...');

    try {
      const response = await fetch('/api/reprally/comprehensive-switchers?limit=200');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load comprehensive switchers');
      }

      setComprehensiveSwitchers(data);
      setComprehensiveSwitchersLoading(false);
      toast.success(
        `✅ Found ${data.summary?.anyToRepRally?.count || 0} switchers, ${data.summary?.retailBusinessOpportunities?.count || 0} business opportunities`,
        { id: loadingToast, duration: 5000 }
      );
    } catch (error: any) {
      console.error('Comprehensive switchers error:', error);
      toast.error(error.message || 'Failed to analyze switchers', { id: loadingToast });
      setComprehensiveSwitchersLoading(false);
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
          ? `✅ Found ${data.stats.uniqueCustomersFound} unique RepRally customers`
          : `✅ Created ${data.stats.customersCreated} RepRally customer records`,
        { id: loadingToast, duration: 5000 }
      );

    } catch (error: any) {
      console.error('RepRally extraction error:', error);
      toast.error(error.message || 'Failed to extract customers', { id: loadingToast });
      setExtractRepRallyLoading(false);
    }
  };

  const buildRepRallyCollection = async (dryRun = true) => {
    setbuildRepRallyLoading(true);
    setBuildRepRallyResult(null);
    const loadingToast = toast.loading(dryRun ? '🟢 Analyzing RepRally data...' : '🔴 Building RepRally collection...');

    try {
      const response = await fetch('/api/reprally/build-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Build failed');
      }

      setBuildRepRallyResult(data);
      setbuildRepRallyLoading(false);

      toast.success(
        dryRun
          ? `✅ Found ${data.stats.repRallyCustomersCreated} RepRally customers`
          : `✅ Created reprally_customers collection with ${data.stats.repRallyCustomersCreated} customers`,
        { id: loadingToast, duration: 5000 }
      );

    } catch (error: any) {
      console.error('RepRally build error:', error);
      toast.error(error.message || 'Failed to build RepRally collection', { id: loadingToast });
      setbuildRepRallyLoading(false);
    }
  };

  // Filter and sort customers
  useEffect(() => {
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerNum.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedRep !== 'all') {
      filtered = filtered.filter(c => c.fishbowlUsername === selectedRep);
    }

    if (selectedAccountType !== 'all') {
      filtered = filtered.filter(c => c.accountType === selectedAccountType);
    }

    if (selectedCity !== 'all') {
      filtered = filtered.filter(c => c.shippingCity === selectedCity);
    }

    if (selectedState !== 'all') {
      filtered = filtered.filter(c => c.shippingState === selectedState);
    }

    if (selectedRegion !== 'all') {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal.toString().localeCompare(bVal.toString());
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredCustomers(filtered);
  }, [searchTerm, selectedRep, selectedAccountType, selectedCity, selectedState, selectedRegion, customers, sortField, sortDirection]);

  return (
    <div className="space-y-8">
      {/* Header with Sub-Tabs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">📊 Customer Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage customer data and visualize geographic distribution
            </p>
          </div>
          <div className="flex items-center gap-3">
            {customerSubTab === 'map' && (
              <span className="text-sm text-gray-600">
                {customers.filter(c => c.lat && c.lng).length} / {customers.length} geocoded
              </span>
            )}
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={importingCsv}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className={`btn btn-secondary flex items-center cursor-pointer ${importingCsv ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="w-4 h-4 mr-2" />
              {importingCsv ? 'Processing...' : 'Import CSV'}
            </label>
            <button
              onClick={() => {
                const csv = [
                  [
                    'Customer #',
                    'Name',
                    'Account Number',
                    'Sales Rep',
                    'Account Type',
                    'Transfer Status',
                    'Original Owner',
                    'Copper ID'
                  ],
                  ...filteredCustomers.map(c => [
                    c.customerNum || '',
                    c.customerName || '',
                    c.accountNumber || '',
                    c.salesPerson || '',
                    c.accountType || '',
                    c.transferStatus || '',
                    c.originalOwner || '',
                    c.copperId || ''
                  ])
                ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success(`✅ Exported ${filteredCustomers.length} customers!`);
              }}
              className="btn btn-primary flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </button>
          </div>
        </div>

        {/* Sub-Tabs - Only show if not adminListOnly */}
        {!adminListOnly && (
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCustomerSubTab('list')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  customerSubTab === 'list'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Customer List
              </button>
              <button
                onClick={() => setCustomerSubTab('map')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  customerSubTab === 'map'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MapIcon className="w-4 h-4 inline mr-2" />
                Customer Map
              </button>
              <button
                onClick={() => {
                  setCustomerSubTab('3rdparty');
                  if (!thirdPartyData) loadThirdPartyAnalysis();
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  customerSubTab === '3rdparty'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Store className="w-4 h-4 inline mr-2" />
                3rd Party (RepRally)
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Regional Stats Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Customers Card */}
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-900">Total Customers</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">{customers.length}</p>
          <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700">
            <div className="flex justify-between">
              <span>Wholesale:</span>
              <span className="font-semibold">{customers.filter(c => c.accountType === 'Wholesale').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Distributor:</span>
              <span className="font-semibold">{customers.filter(c => c.accountType === 'Distributor').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Retail:</span>
              <span className="font-semibold">{customers.filter(c => c.accountType === 'Retail').length}</span>
            </div>
          </div>
        </div>

        {/* Regional Cards */}
        {Array.from(new Set(customers.map(c => c.region).filter(Boolean))).sort().map(region => {
          const regionCustomers = customers.filter(c => c.region === region);
          const regionColor = regionCustomers[0]?.regionColor || '#808080';
          const wholesale = regionCustomers.filter(c => c.accountType === 'Wholesale').length;
          const distributor = regionCustomers.filter(c => c.accountType === 'Distributor').length;
          const retail = regionCustomers.filter(c => c.accountType === 'Retail').length;
          // Count unassigned based on actual displayed salesPerson, not just manual override field
          const unassigned = regionCustomers.filter(c => !c.salesPerson || c.salesPerson === 'Unassigned' || c.salesPerson === '').length;
          
          return (
            <div key={region} className="card hover:shadow-lg transition-shadow cursor-pointer" 
                 onClick={() => setSelectedRegion(region)}
                 style={{ borderLeftWidth: '4px', borderLeftColor: regionColor }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{region}</h3>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: regionColor }}></div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{regionCustomers.length}</p>
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Wholesale:</span>
                  <span className="font-semibold text-green-600">{wholesale}</span>
                </div>
                <div className="flex justify-between">
                  <span>Distributor:</span>
                  <span className="font-semibold text-green-600">{distributor}</span>
                </div>
                <div className="flex justify-between">
                  <span>Retail:</span>
                  <span className="font-semibold text-yellow-600">{retail}</span>
                </div>
                {unassigned > 0 && (
                  <div className="flex justify-between mt-1 pt-1 border-t border-gray-200">
                    <span className="text-orange-600">⚠ Unassigned:</span>
                    <span className="font-semibold text-orange-600">{unassigned}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Unassigned Region Card */}
        {customers.filter(c => !c.region).length > 0 && (
          <div className="card bg-gray-50 border-gray-300" 
               onClick={() => setSelectedRegion('')}
               style={{ borderLeftWidth: '4px', borderLeftColor: '#808080' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Unassigned</h3>
              <AlertCircle className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-3xl font-bold text-gray-700">{customers.filter(c => !c.region).length}</p>
            <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Wholesale:</span>
                <span className="font-semibold">{customers.filter(c => !c.region && c.accountType === 'Wholesale').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Distributor:</span>
                <span className="font-semibold">{customers.filter(c => !c.region && c.accountType === 'Distributor').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Retail:</span>
                <span className="font-semibold">{customers.filter(c => !c.region && c.accountType === 'Retail').length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer List Tab */}
      {customerSubTab === 'list' && (
        <div>
          {/* Filters */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
            <div className="grid md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Search className="w-4 h-4 inline mr-1" />
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Customer name or #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sales Rep</label>
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">All Reps</option>
                  {reps
                    .filter(r => r.active !== false)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(rep => (
                      <option key={rep.id} value={rep.salesPerson}>
                        {rep.name} ({rep.salesPerson})
                      </option>
                    ))}
                  <option value="">Unassigned</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
                <select
                  value={selectedAccountType}
                  onChange={(e) => setSelectedAccountType(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">All Types</option>
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Distributor">Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">All Regions</option>
                  {Array.from(new Set(customers.map(c => c.region).filter(Boolean))).sort().map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                  <option value="">Unassigned</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">All Cities</option>
                  {Array.from(new Set(customers.map(c => c.shippingCity).filter(Boolean))).sort().map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">All States</option>
                  {['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'].map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Batch Edit Actions */}
          {batchEditMode && (
            <div className="card bg-blue-50 border-2 border-blue-300">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">
                    📝 Batch Edit Mode ({selectedCustomers.size} selected)
                  </h3>
                  <p className="text-sm text-blue-700">Select customers and update their account type or sales rep</p>
                </div>
                <button
                  onClick={() => {
                    setBatchEditMode(false);
                    setSelectedCustomers(new Set());
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Update Account Type
                  </label>
                  <select
                    value={batchAccountType}
                    onChange={(e) => setBatchAccountType(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Don&apos;t Change</option>
                    <option value="Retail">Retail</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Distributor">Distributor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Sales Rep
                  </label>
                  <select
                    value={batchSalesRep}
                    onChange={(e) => setBatchSalesRep(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Don&apos;t Change</option>
                    <option value="UNASSIGNED">⚠️ Unassigned (Remove Rep)</option>
                    {reps.filter(r => r.active !== false).map(rep => (
                      <option key={rep.id} value={rep.salesPerson}>
                        {rep.name} ({rep.salesPerson})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transfer Status
                  </label>
                  <select
                    value={batchTransferStatus}
                    onChange={(e) => setBatchTransferStatus(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Don&apos;t Change</option>
                    <option value="auto">🤖 Auto (Calculate)</option>
                    <option value="own">👤 Own (8%)</option>
                    <option value="transferred">🔄 Transferred (2%)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleBatchUpdate}
                    disabled={savingBatch || selectedCustomers.size === 0}
                    className="btn btn-primary w-full"
                  >
                    {savingBatch ? '⏳ Saving...' : `💾 Update ${selectedCustomers.size} Customers`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Customers Table */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Customers ({filteredCustomers.length})
              </h3>
              <button
                onClick={() => setBatchEditMode(!batchEditMode)}
                className={`btn ${batchEditMode ? 'btn-secondary' : 'btn-primary'}`}
              >
                {batchEditMode ? '❌ Cancel Batch Edit' : '📝 Batch Edit'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {batchEditMode && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('customerNum')}
                      >
                        <span>Customer #</span>
                        {sortField === 'customerNum' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('customerName')}
                      >
                        <span>Customer Name</span>
                        {sortField === 'customerName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('accountType')}
                      >
                        <span>Account Type</span>
                        {sortField === 'accountType' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('originalOwner')}
                      >
                        <span>Current Owner</span>
                        <span className="ml-1 text-xs text-gray-400">(Fishbowl)</span>
                        {sortField === 'originalOwner' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-56">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('salesPerson')}
                      >
                        <span>Assign Sales Rep</span>
                        {sortField === 'salesPerson' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      Transfer Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('shippingCity')}
                      >
                        <span>City</span>
                        {sortField === 'shippingCity' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('shippingState')}
                      >
                        <span>State</span>
                        {sortField === 'shippingState' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('region')}
                      >
                        <span>Region</span>
                        {sortField === 'region' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('orderCount')}
                      >
                        <span>Orders</span>
                        {sortField === 'orderCount' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                        onClick={() => handleSort('lifetimeValue')}
                      >
                        <span>Lifetime Value</span>
                        {sortField === 'lifetimeValue' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={batchEditMode ? 13 : 12} className="px-4 py-8 text-center text-gray-500">
                        No customers found
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        {batchEditMode && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedCustomers.has(customer.id)}
                              onChange={() => toggleCustomerSelection(customer.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.customerNum}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <a 
                            href={`/customers/${customer.id}`}
                            className="text-kanva-green hover:underline font-medium"
                          >
                            {customer.customerName}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          {savingCustomer === customer.id ? (
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                              <span className="text-sm text-gray-600">Saving...</span>
                            </div>
                          ) : (
                            <select
                              value={customer.accountType}
                              onChange={(e) => updateAccountType(customer.id, e.target.value)}
                              className={`input text-sm ${
                                customer.accountType === 'Retail'
                                  ? 'bg-yellow-50 border-yellow-300'
                                  : customer.accountType === 'Wholesale'
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-green-50 border-green-300'
                              }`}
                            >
                              <option value="Retail">Retail</option>
                              <option value="Wholesale">Wholesale</option>
                              <option value="Distributor">Distributor</option>
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono ${
                            customer.originalOwner === 'Unassigned' ||
                            customer.originalOwner === 'admin' ||
                            customer.originalOwner === 'shopify' ||
                            customer.originalOwner === 'house'
                              ? 'text-gray-400 italic'
                              : 'text-gray-700'
                          }`}>
                            {customer.originalOwner}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const lockStatus = isRepLocked(customer.originalOwner);

                            if (savingCustomer === customer.id) {
                              return (
                                <div className="flex items-center space-x-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                </div>
                              );
                            }

                            if (lockStatus.locked) {
                              return (
                                <div className="flex items-center space-x-2">
                                  <Lock className="w-4 h-4 text-red-500" />
                                  <span className="text-sm text-gray-500 italic">
                                    Protected
                                  </span>
                                  <div className="group relative">
                                    <AlertCircle className="w-4 h-4 text-gray-400 cursor-help" />
                                    <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-6">
                                      {lockStatus.reason}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <select
                                value={customer.fishbowlUsername || ''}
                                onChange={(e) => handleSalesRepChange(customer.id, e.target.value, customer.originalOwner, customer.customerName)}
                                className="input text-sm w-full"
                              >
                                <option value="">Unassigned</option>
                                {reps.filter(r => r.active !== false).map(rep => (
                                  <option key={rep.id} value={rep.salesPerson}>
                                    {rep.name} ({rep.salesPerson})
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={customer.transferStatus || 'auto'}
                            onChange={(e) => updateTransferStatus(customer.id, e.target.value)}
                            className={`input text-sm ${
                              !customer.transferStatus || customer.transferStatus === 'auto'
                                ? 'bg-gray-50 border-gray-300'
                                : customer.transferStatus === 'own'
                                ? 'bg-purple-50 border-purple-300'
                                : 'bg-blue-50 border-blue-300'
                            }`}
                          >
                            <option value="auto">🤖 Auto</option>
                            <option value="own">👤 Own (8%)</option>
                            <option value="transferred">🔄 Transferred (2%)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.shippingCity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.shippingState}</td>
                        <td className="px-4 py-3">
                          {customer.region ? (
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: customer.regionColor }}
                              ></div>
                              <span className="text-sm font-medium text-gray-900">{customer.region}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                          {customer.orderCount || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          ${(customer.lifetimeValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          {customer.accountType === 'Retail' ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                              ⚠ No Commission
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                              ✓ Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer Map Tab - Only show if not adminListOnly */}
      {!adminListOnly && customerSubTab === 'map' && (
        <CustomerMap />
      )}

      {/* 3rd Party Analysis Tab - Only show if not adminListOnly */}
      {!adminListOnly && customerSubTab === '3rdparty' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Store className="w-6 h-6 text-purple-600" />
                RepRally / 3rd Party Analytics
              </h2>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setThirdPartySubTab('overview');
                    if (!reprallyAnalytics) loadReprallyAnalytics();
                  }}
                  className={`btn text-sm ${thirdPartySubTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => {
                    setThirdPartySubTab('switchers');
                    if (!reprallySwitchers) loadReprallySwitchers(false);
                  }}
                  className={`btn text-sm ${thirdPartySubTab === 'switchers' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Switchers
                </button>
                <button
                  onClick={() => setThirdPartySubTab('map')}
                  className={`btn text-sm ${thirdPartySubTab === 'map' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Map
                </button>
                <button
                  onClick={() => setThirdPartySubTab('data')}
                  className={`btn text-sm ${thirdPartySubTab === 'data' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Data Tools
                </button>
              </div>
            </div>
          </div>

          {/* Overview Sub-Tab */}
          {thirdPartySubTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Shopify Analytics</h3>
                <div className="flex items-center gap-2">
                  {/* Customer Type Toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setCustomerTypeFilter('all')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        customerTypeFilter === 'all' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCustomerTypeFilter('reprally')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        customerTypeFilter === 'reprally' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      RepRally B2B
                    </button>
                    <button
                      onClick={() => setCustomerTypeFilter('retail')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        customerTypeFilter === 'retail' 
                          ? 'bg-pink-600 text-white shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Retail Shopify
                    </button>
                  </div>
                  <button onClick={loadReprallyAnalytics} className="btn btn-secondary text-sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>

              {reprallyAnalyticsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  <span className="ml-4 text-gray-600">Loading analytics from cache...</span>
                </div>
              ) : reprallyAnalytics ? (
                <>
                  {/* Summary Cards - show based on filter */}
                  <div className="grid md:grid-cols-4 gap-6">
                    {customerTypeFilter === 'all' && (
                      <>
                        <div className="card bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-purple-700">Total Customers</h3>
                            <Store className="w-5 h-5 text-purple-600" />
                          </div>
                          <p className="text-3xl font-bold text-purple-900">{reprallyAnalytics.summary?.customers?.toLocaleString() || 0}</p>
                          <p className="text-xs text-purple-600 mt-1">All Shopify channels</p>
                        </div>
                        <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-blue-700">Total Orders</h3>
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                          <p className="text-3xl font-bold text-blue-900">{reprallyAnalytics.summary?.orders?.toLocaleString() || 0}</p>
                          <p className="text-xs text-blue-600 mt-1">RepRally + Retail</p>
                        </div>
                        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-green-700">Total Revenue</h3>
                            <DollarSign className="w-5 h-5 text-green-600" />
                          </div>
                          <p className="text-3xl font-bold text-green-900">
                            ${reprallyAnalytics.summary?.revenue?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}
                          </p>
                          <p className="text-xs text-green-600 mt-1">All channels</p>
                        </div>
                        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-orange-700">Avg Order</h3>
                            <TrendingUp className="w-5 h-5 text-orange-600" />
                          </div>
                          <p className="text-3xl font-bold text-orange-900">
                            ${reprallyAnalytics.summary?.avgOrderValue?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}
                          </p>
                          <p className="text-xs text-orange-600 mt-1">Average order value</p>
                        </div>
                      </>
                    )}
                    {customerTypeFilter === 'reprally' && (
                      <>
                        <div className="card bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-indigo-700">RepRally Customers</h3>
                            <Store className="w-5 h-5 text-indigo-600" />
                          </div>
                          <p className="text-3xl font-bold text-indigo-900">{reprallyAnalytics.summary?.reprallyCustomers?.toLocaleString() || 0}</p>
                          <p className="text-xs text-indigo-600 mt-1">B2B wholesale orders</p>
                        </div>
                        <div className="card bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-indigo-700">RepRally Orders</h3>
                            <Package className="w-5 h-5 text-indigo-600" />
                          </div>
                          <p className="text-3xl font-bold text-indigo-900">{reprallyAnalytics.summary?.reprallyOrders?.toLocaleString() || 0}</p>
                          <p className="text-xs text-indigo-600 mt-1">Orders starting with #</p>
                        </div>
                        <div className="card bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-indigo-700">RepRally Revenue</h3>
                            <DollarSign className="w-5 h-5 text-indigo-600" />
                          </div>
                          <p className="text-3xl font-bold text-indigo-900">
                            ${reprallyAnalytics.summary?.reprallyRevenue?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}
                          </p>
                          <p className="text-xs text-indigo-600 mt-1">B2B revenue</p>
                        </div>
                        <div className="card bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-indigo-700">Avg B2B Order</h3>
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                          </div>
                          <p className="text-3xl font-bold text-indigo-900">
                            ${((reprallyAnalytics.summary?.reprallyRevenue || 0) / Math.max(1, reprallyAnalytics.summary?.reprallyOrders || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-indigo-600 mt-1">Per RepRally order</p>
                        </div>
                      </>
                    )}
                    {customerTypeFilter === 'retail' && (
                      <>
                        <div className="card bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-pink-700">Retail Customers</h3>
                            <Store className="w-5 h-5 text-pink-600" />
                          </div>
                          <p className="text-3xl font-bold text-pink-900">{reprallyAnalytics.summary?.retailCustomers?.toLocaleString() || 0}</p>
                          <p className="text-xs text-pink-600 mt-1">Direct Shopify orders</p>
                        </div>
                        <div className="card bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-pink-700">Retail Orders</h3>
                            <Package className="w-5 h-5 text-pink-600" />
                          </div>
                          <p className="text-3xl font-bold text-pink-900">{reprallyAnalytics.summary?.retailOrders?.toLocaleString() || 0}</p>
                          <p className="text-xs text-pink-600 mt-1">Orders starting with Sh</p>
                        </div>
                        <div className="card bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-pink-700">Retail Revenue</h3>
                            <DollarSign className="w-5 h-5 text-pink-600" />
                          </div>
                          <p className="text-3xl font-bold text-pink-900">
                            ${reprallyAnalytics.summary?.retailRevenue?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}
                          </p>
                          <p className="text-xs text-pink-600 mt-1">Consumer revenue</p>
                        </div>
                        <div className="card bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-pink-700">Avg Retail Order</h3>
                            <TrendingUp className="w-5 h-5 text-pink-600" />
                          </div>
                          <p className="text-3xl font-bold text-pink-900">
                            ${((reprallyAnalytics.summary?.retailRevenue || 0) / Math.max(1, reprallyAnalytics.summary?.retailOrders || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-pink-600 mt-1">Per retail order</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Top Customers List - Filtered by type */}
                  {reprallyAnalytics.topCustomers?.length > 0 && (
                    <div className="card">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Top Customers 
                          <span className="text-sm font-normal text-gray-500 ml-2">
                            ({customerTypeFilter === 'all' ? 'All' : customerTypeFilter === 'reprally' ? 'RepRally B2B' : 'Retail Shopify'})
                          </span>
                        </h3>
                        <span className="text-sm text-gray-500">
                          Showing {reprallyAnalytics.topCustomers.filter((c: any) => {
                            if (customerTypeFilter === 'all') return true;
                            if (customerTypeFilter === 'reprally') return c.reprallyOrders > 0;
                            if (customerTypeFilter === 'retail') return c.retailOrders > 0;
                            return true;
                          }).length} customers
                        </span>
                      </div>
                      <div className="divide-y max-h-[600px] overflow-y-auto">
                        {reprallyAnalytics.topCustomers
                          .filter((c: any) => {
                            if (customerTypeFilter === 'all') return true;
                            if (customerTypeFilter === 'reprally') return c.reprallyOrders > 0;
                            if (customerTypeFilter === 'retail') return c.retailOrders > 0;
                            return true;
                          })
                          .slice(0, 50)
                          .map((customer: any, idx: number) => (
                            <div key={idx} className="py-3 hover:bg-gray-50">
                              <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleCustomerExpand(customer.customerId)}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`text-gray-400 transform transition-transform ${expandedCustomers.has(customer.customerId) ? 'rotate-90' : ''}`}>▶</span>
                                  <div>
                                    <div className="font-semibold text-gray-900">{customer.businessName}</div>
                                    <div className="text-sm text-gray-500">{customer.billingCity}, {customer.billingState}</div>
                                  </div>
                                  {customer.isSwitcher && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Switcher</span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-red-600">
                                    ${(customerTypeFilter === 'reprally' ? customer.reprallyRevenue : 
                                       customerTypeFilter === 'retail' ? customer.retailRevenue : 
                                       customer.totalRevenue)?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {customerTypeFilter === 'reprally' ? customer.reprallyOrders : 
                                     customerTypeFilter === 'retail' ? customer.retailOrders : 
                                     customer.totalOrders} orders
                                  </div>
                                </div>
                              </div>
                              
                              {/* Expanded Customer Details */}
                              {expandedCustomers.has(customer.customerId) && (
                                <div className="mt-3 ml-8 bg-gray-50 rounded-lg p-4 space-y-3">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-500">Address:</span>
                                      <div className="text-gray-900">{customer.billingAddress}</div>
                                      <div className="text-gray-900">{customer.billingCity}, {customer.billingState} {customer.billingZip}</div>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Order Breakdown:</span>
                                      <div className="text-indigo-600">RepRally B2B: {customer.reprallyOrders} orders (${customer.reprallyRevenue?.toLocaleString()})</div>
                                      <div className="text-pink-600">Retail: {customer.retailOrders} orders (${customer.retailRevenue?.toLocaleString()})</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-500">First Order:</span>
                                      <div className="text-gray-900">{customer.firstOrderDate ? new Date(customer.firstOrderDate).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Last Order:</span>
                                      <div className="text-gray-900">{customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                  </div>
                                  {customer.topSkus?.length > 0 && (
                                    <div>
                                      <span className="text-gray-500 text-sm">Top Products:</span>
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        {customer.topSkus.slice(0, 5).map((sku: any, skuIdx: number) => (
                                          <span key={skuIdx} className="text-xs bg-white border px-2 py-1 rounded">
                                            {sku.sku}: ${sku.revenue?.toLocaleString()} ({sku.qty} units)
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Additional analytics sections can be added here */}
                  {reprallyAnalytics.geo?.byState?.length > 0 && (
                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top States</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customers</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {reprallyAnalytics.geo.byState.slice(0, 10).map((row: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.state}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{row.customers}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{row.orders}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">${row.revenue?.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Analytics Section */}
                  <div className="card border-2 border-purple-200 bg-purple-50/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">📊 Enhanced Analytics (Excludes Shipping/CC Processing)</h3>
                      <button 
                        onClick={loadEnhancedAnalytics} 
                        disabled={enhancedAnalyticsLoading}
                        className="btn btn-primary text-sm"
                      >
                        {enhancedAnalyticsLoading ? 'Loading...' : 'Load Enhanced'}
                      </button>
                    </div>

                    {enhancedAnalytics && (
                      <div className="space-y-4">
                        {/* Order Type Breakdown */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-700 mb-2">RepRally B2B Orders</h4>
                            <div className="text-2xl font-bold text-blue-900">
                              ${enhancedAnalytics.summary?.byOrderType?.reprally?.revenue?.toLocaleString() || 0}
                            </div>
                            <div className="text-sm text-blue-600">
                              {enhancedAnalytics.summary?.byOrderType?.reprally?.orders || 0} orders • {enhancedAnalytics.summary?.byOrderType?.reprally?.customers || 0} customers
                            </div>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-orange-700 mb-2">Retail Shopify (Sh*)</h4>
                            <div className="text-2xl font-bold text-orange-900">
                              ${enhancedAnalytics.summary?.byOrderType?.retail_shopify?.revenue?.toLocaleString() || 0}
                            </div>
                            <div className="text-sm text-orange-600">
                              {enhancedAnalytics.summary?.byOrderType?.retail_shopify?.orders || 0} orders • {enhancedAnalytics.summary?.byOrderType?.retail_shopify?.customers || 0} customers
                            </div>
                          </div>
                        </div>

                        {/* Top SKUs */}
                        {enhancedAnalytics.topSkus?.length > 0 && (
                          <div className="bg-white rounded-lg border p-4">
                            <h4 className="font-semibold text-gray-900 mb-3">Top SKUs (Revenue)</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2 px-2">SKU</th>
                                    <th className="text-left py-2 px-2">Product</th>
                                    <th className="text-right py-2 px-2">Qty</th>
                                    <th className="text-right py-2 px-2">Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {enhancedAnalytics.topSkus.slice(0, 10).map((sku: any, idx: number) => (
                                    <tr key={idx} className="border-b last:border-0">
                                      <td className="py-2 px-2 font-mono text-xs">{sku.sku}</td>
                                      <td className="py-2 px-2 truncate max-w-[200px]">{sku.productName}</td>
                                      <td className="py-2 px-2 text-right">{sku.qty?.toLocaleString()}</td>
                                      <td className="py-2 px-2 text-right font-medium text-green-600">${sku.revenue?.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Expandable Customers with Orders */}
                        {enhancedAnalytics.topCustomers?.length > 0 && (
                          <div className="bg-white rounded-lg border">
                            <h4 className="font-semibold text-gray-900 p-4 border-b">Top Customers (Click to expand orders)</h4>
                            <div className="divide-y">
                              {enhancedAnalytics.topCustomers.slice(0, 20).map((customer: any, idx: number) => (
                                <div key={idx}>
                                  <div 
                                    className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => toggleCustomerExpand(customer.customerId)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className={`transform transition-transform ${expandedCustomers.has(customer.customerId) ? 'rotate-90' : ''}`}>▶</span>
                                      <div>
                                        <div className="font-medium text-gray-900">{customer.businessName}</div>
                                        <div className="text-sm text-gray-500">{customer.billingCity}, {customer.billingState}</div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-red-600">${customer.totalRevenue?.toLocaleString()}</div>
                                      <div className="text-sm text-gray-500">{customer.totalOrders} orders</div>
                                    </div>
                                  </div>

                                  {/* Expanded Orders */}
                                  {expandedCustomers.has(customer.customerId) && (
                                    <div className="bg-gray-50 px-4 pb-4">
                                      <div className="ml-6 space-y-2">
                                        {customer.orders?.map((order: any) => (
                                          <div key={order.orderNum} className="bg-white rounded border">
                                            <div 
                                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                                              onClick={(e) => { e.stopPropagation(); toggleCustomerOrderExpand(order.orderNum); }}
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className={`text-xs transform transition-transform ${expandedCustomerOrders.has(order.orderNum) ? 'rotate-90' : ''}`}>▶</span>
                                                <span className="font-mono text-sm">{order.orderNum}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                  order.orderType === 'reprally' ? 'bg-blue-100 text-blue-700' :
                                                  order.orderType === 'retail_shopify' ? 'bg-orange-100 text-orange-700' :
                                                  'bg-gray-100 text-gray-700'
                                                }`}>
                                                  {order.orderType === 'reprally' ? 'RepRally B2B' : order.orderType === 'retail_shopify' ? 'Retail' : order.orderType}
                                                </span>
                                                <span className="text-xs text-gray-500">{formatDate(order.postingDate)}</span>
                                              </div>
                                              <div className="text-right">
                                                <span className="font-medium text-green-600">${order.revenue?.toLocaleString()}</span>
                                                <span className="text-gray-400 text-sm ml-2">({order.lineItems?.length || 0} items)</span>
                                              </div>
                                            </div>

                                            {/* Line Items */}
                                            {expandedCustomerOrders.has(order.orderNum) && order.lineItems?.length > 0 && (
                                              <div className="border-t bg-gray-50 p-3">
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="text-gray-500">
                                                      <th className="text-left py-1">SKU</th>
                                                      <th className="text-left py-1">Product</th>
                                                      <th className="text-right py-1">Qty</th>
                                                      <th className="text-right py-1">Revenue</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {order.lineItems.map((item: any, itemIdx: number) => (
                                                      <tr key={itemIdx} className={item.excluded ? 'text-gray-400 line-through' : ''}>
                                                        <td className="py-1 font-mono">{item.sku}</td>
                                                        <td className="py-1 truncate max-w-[150px]">{item.productName}</td>
                                                        <td className="py-1 text-right">{item.qty}</td>
                                                        <td className="py-1 text-right">${item.revenue?.toLocaleString()}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="card text-center py-12">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">RepRally Analytics</h3>
                  <p className="text-gray-600 mb-6">
                    Load analytics data for RepRally customers and orders
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button onClick={loadReprallyAnalytics} className="btn btn-secondary">Load Basic Overview</button>
                    <button onClick={loadEnhancedAnalytics} className="btn btn-primary">Load Enhanced Analytics</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Switchers Sub-Tab */}
          {thirdPartySubTab === 'switchers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Customer Switchers & Opportunities</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={loadComprehensiveSwitchers} 
                    disabled={comprehensiveSwitchersLoading}
                    className="btn btn-primary text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${comprehensiveSwitchersLoading ? 'animate-spin' : ''}`} />
                    {comprehensiveSwitchersLoading ? 'Analyzing...' : 'Run Comprehensive Analysis'}
                  </button>
                </div>
              </div>

              {/* Comprehensive Switchers Results */}
              {comprehensiveSwitchers && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="card bg-red-50 border-red-200">
                      <h4 className="text-sm font-medium text-red-700">Direct → RepRally</h4>
                      <p className="text-2xl font-bold text-red-900">{comprehensiveSwitchers.summary?.directToRepRally?.count || 0}</p>
                      <p className="text-xs text-red-600">Lost ${comprehensiveSwitchers.summary?.directToRepRally?.totalLostDirectRevenue?.toLocaleString() || 0}</p>
                    </div>
                    <div className="card bg-orange-50 border-orange-200">
                      <h4 className="text-sm font-medium text-orange-700">Retail → RepRally</h4>
                      <p className="text-2xl font-bold text-orange-900">{comprehensiveSwitchers.summary?.retailToRepRally?.count || 0}</p>
                      <p className="text-xs text-orange-600">${comprehensiveSwitchers.summary?.retailToRepRally?.totalRetailSpend?.toLocaleString() || 0} retail</p>
                    </div>
                    <div className="card bg-purple-50 border-purple-200">
                      <h4 className="text-sm font-medium text-purple-700">Total Switchers</h4>
                      <p className="text-2xl font-bold text-purple-900">{comprehensiveSwitchers.summary?.anyToRepRally?.count || 0}</p>
                      <p className="text-xs text-purple-600">${comprehensiveSwitchers.summary?.anyToRepRally?.totalRepRallyRevenue?.toLocaleString() || 0} on RepRally</p>
                    </div>
                    <div className="card bg-green-50 border-green-200">
                      <h4 className="text-sm font-medium text-green-700">Business Opportunities</h4>
                      <p className="text-2xl font-bold text-green-900">{comprehensiveSwitchers.summary?.retailBusinessOpportunities?.count || 0}</p>
                      <p className="text-xs text-green-600">${comprehensiveSwitchers.summary?.retailBusinessOpportunities?.totalRetailSpend?.toLocaleString() || 0} potential</p>
                    </div>
                  </div>

                  {/* Channel Breakdown */}
                  <div className="card">
                    <h4 className="font-semibold text-gray-900 mb-3">Channel Distribution</h4>
                    <div className="grid md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center p-3 bg-blue-50 rounded">
                        <div className="font-bold text-blue-900">{comprehensiveSwitchers.summary?.channelBreakdown?.repRallyOnly || 0}</div>
                        <div className="text-blue-600">RepRally Only</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded">
                        <div className="font-bold text-orange-900">{comprehensiveSwitchers.summary?.channelBreakdown?.retailOnly || 0}</div>
                        <div className="text-orange-600">Retail Shopify Only</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="font-bold text-gray-900">{comprehensiveSwitchers.summary?.channelBreakdown?.directOnly || 0}</div>
                        <div className="text-gray-600">Direct Only</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded">
                        <div className="font-bold text-purple-900">{comprehensiveSwitchers.summary?.channelBreakdown?.multiChannel || 0}</div>
                        <div className="text-purple-600">Multi-Channel</div>
                      </div>
                    </div>
                  </div>

                  {/* All Switchers Table */}
                  {comprehensiveSwitchers.anyToRepRally?.length > 0 && (
                    <div className="card">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                        All Switchers to RepRally ({comprehensiveSwitchers.anyToRepRally.length})
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Previous Channels</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Previous $</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">RepRally $</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">First RepRally</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {comprehensiveSwitchers.anyToRepRally.slice(0, 50).map((c: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{c.businessName}</div>
                                  <div className="text-xs text-gray-500">{c.billingCity}, {c.billingState}</div>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`text-xs px-2 py-0.5 rounded ${c.isBusinessName ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                    {c.isBusinessName ? 'Business' : 'Individual'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs">{c.previousChannels?.join(', ') || '-'}</td>
                                <td className="px-3 py-2 text-right text-gray-600">${c.totalPreviousRevenue?.toLocaleString() || 0}</td>
                                <td className="px-3 py-2 text-right font-medium text-red-600">${c.repRallyRevenue?.toLocaleString() || 0}</td>
                                <td className="px-3 py-2 text-xs">{formatDate(c.firstRepRallyDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Business Opportunities */}
                  {comprehensiveSwitchers.retailBusinessOpportunities?.length > 0 && (
                    <div className="card border-green-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Store className="w-5 h-5 text-green-600" />
                        Business Opportunities - Retail Shopify Businesses NOT on RepRally ({comprehensiveSwitchers.retailBusinessOpportunities.length})
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        These customers have business names and order via retail Shopify (Sh* orders). They could be offered wholesale pricing via RepRally.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Business Name</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Retail Orders</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Spend</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">First Order</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {comprehensiveSwitchers.retailBusinessOpportunities.slice(0, 50).map((c: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium">{c.businessName}</td>
                                <td className="px-3 py-2 text-gray-600">{c.billingCity}, {c.billingState}</td>
                                <td className="px-3 py-2 text-right">{c.orderCount}</td>
                                <td className="px-3 py-2 text-right font-medium text-green-600">${c.totalRetailSpend?.toLocaleString() || 0}</td>
                                <td className="px-3 py-2 text-xs">{formatDate(c.firstOrder)}</td>
                                <td className="px-3 py-2 text-xs">{formatDate(c.lastOrder)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback to old switchers if comprehensive not loaded */}
              {!comprehensiveSwitchers && (
                <div className="card text-center py-8">
                  <p className="text-gray-600 mb-4">Run the comprehensive analysis to identify all switchers and business opportunities</p>
                  <button onClick={loadComprehensiveSwitchers} className="btn btn-primary">
                    Run Comprehensive Analysis
                  </button>
                </div>
              )}

              <hr className="my-6" />
              <h4 className="text-md font-semibold text-gray-700">Legacy Address-Based Switcher Analysis</h4>
              <div className="flex gap-2 mb-4">
                <button onClick={() => loadReprallySwitchers(false)} className="btn btn-secondary text-sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Analyze (Address Match)
                </button>
              </div>

              {reprallySwitchersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  <span className="ml-4 text-gray-600">Analyzing switchers...</span>
                </div>
              ) : reprallySwitchers ? (
                <>
                <div className="card">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    Customer Switcher Details ({reprallySwitchers.switchers?.length || 0})
                  </h3>

                  {reprallySwitchers.switchers?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Rep</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Direct</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First RepRally</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gap</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direct $</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RepRally $</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reprallySwitchers.switchers.map((switcher: any, idx: number) => (
                            <tr 
                              key={idx} 
                              className={`hover:bg-gray-50 cursor-pointer ${selectedSwitcher?.fbCustomerId === switcher.fbCustomerId ? 'bg-primary-50' : ''}`}
                              onClick={() => loadSwitcherOrders(switcher)}
                            >
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                <div>{switcher.fbBusinessName || switcher.rrBusinessName}</div>
                                <div className="text-xs text-gray-500">{switcher.fbBillingCity}, {switcher.fbBillingState}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{switcher.fbOriginalSalesRep || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(switcher.fbLastOrder)}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(switcher.rrFirstOrder)}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{switcher.daysBetween} days</td>
                              <td className="px-4 py-3 text-sm text-gray-600">${(switcher.fbDirectRevenue || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-red-600 font-medium">${(switcher.rrRevenue || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm">
                                <button 
                                  className="text-primary-600 hover:text-primary-800 font-medium"
                                  onClick={(e) => { e.stopPropagation(); loadSwitcherOrders(switcher); }}
                                >
                                  View Orders
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-600 text-center py-8">No switchers found</p>
                  )}
                </div>

                {/* Switcher Order Detail Panel */}
                {selectedSwitcher && (
                  <div className="card mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">
                        📋 Order History: {selectedSwitcher.fbBusinessName || selectedSwitcher.rrBusinessName}
                      </h3>
                      <button 
                        onClick={() => { setSelectedSwitcher(null); setSwitcherOrders(null); }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {switcherOrdersLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        <span className="ml-4 text-gray-600">Loading order history...</span>
                      </div>
                    ) : switcherOrders ? (
                      <div className="space-y-6">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">{switcherOrders.stats.directOrderCount}</div>
                            <div className="text-xs text-gray-600">Direct Orders</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">${switcherOrders.stats.directRevenue.toLocaleString()}</div>
                            <div className="text-xs text-gray-600">Direct Revenue</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-red-600">{switcherOrders.stats.reprallyOrderCount}</div>
                            <div className="text-xs text-gray-600">RepRally Orders</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-red-600">${switcherOrders.stats.reprallyRevenue.toLocaleString()}</div>
                            <div className="text-xs text-gray-600">RepRally Revenue</div>
                          </div>
                        </div>

                        {/* Direct Orders Section */}
                        <div>
                          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            Direct Orders ({switcherOrders.directOrders.length})
                          </h4>
                          {switcherOrders.directOrders.length > 0 ? (
                            <div className="border rounded-lg overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-blue-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Order #</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Sales Rep</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Revenue</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Items</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {switcherOrders.directOrders.map((order: any) => (
                                    <React.Fragment key={order.id}>
                                      <tr 
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => toggleOrderExpand(order.id)}
                                      >
                                        <td className="px-4 py-2 text-sm font-mono">{order.orderNum}</td>
                                        <td className="px-4 py-2 text-sm">{formatDate(order.postingDate)}</td>
                                        <td className="px-4 py-2 text-sm">{order.salesRep || '-'}</td>
                                        <td className="px-4 py-2 text-sm font-medium">${order.revenue?.toLocaleString() || '0'}</td>
                                        <td className="px-4 py-2 text-sm text-primary-600">
                                          {order.lineItemCount} items {expandedOrders.has(order.id) ? '▼' : '▶'}
                                        </td>
                                      </tr>
                                      {expandedOrders.has(order.id) && order.lineItems?.length > 0 && (
                                        <tr key={`${order.id}-items`}>
                                          <td colSpan={5} className="px-4 py-2 bg-gray-50">
                                            <table className="min-w-full text-xs">
                                              <thead>
                                                <tr className="text-gray-500">
                                                  <th className="px-2 py-1 text-left">Product</th>
                                                  <th className="px-2 py-1 text-left">Description</th>
                                                  <th className="px-2 py-1 text-right">Qty</th>
                                                  <th className="px-2 py-1 text-right">Price</th>
                                                  <th className="px-2 py-1 text-right">Total</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {order.lineItems.map((item: any, idx: number) => (
                                                  <tr key={idx} className="border-t border-gray-100">
                                                    <td className="px-2 py-1 font-mono">{item.productNum || item.partNum || '-'}</td>
                                                    <td className="px-2 py-1">{item.description || item.productDescription || '-'}</td>
                                                    <td className="px-2 py-1 text-right">{item.qtyToFulfill || item.qty || '-'}</td>
                                                    <td className="px-2 py-1 text-right">${(item.unitPrice || item.price || 0).toFixed(2)}</td>
                                                    <td className="px-2 py-1 text-right font-medium">${(item.totalPrice || item.lineTotal || 0).toFixed(2)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm py-4">No direct orders found</p>
                          )}
                        </div>

                        {/* RepRally Orders Section */}
                        <div>
                          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Store className="w-4 h-4 text-red-600" />
                            RepRally Orders ({switcherOrders.reprallyOrders.length})
                          </h4>
                          {switcherOrders.reprallyOrders.length > 0 ? (
                            <div className="border border-red-200 rounded-lg overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-red-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Order #</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Sales Rep</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Revenue</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Items</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {switcherOrders.reprallyOrders.map((order: any) => (
                                    <React.Fragment key={order.id}>
                                      <tr 
                                        className="hover:bg-red-50 cursor-pointer"
                                        onClick={() => toggleOrderExpand(`rr-${order.id}`)}
                                      >
                                        <td className="px-4 py-2 text-sm font-mono">{order.orderNum}</td>
                                        <td className="px-4 py-2 text-sm">{formatDate(order.postingDate)}</td>
                                        <td className="px-4 py-2 text-sm">{order.salesRep || '-'}</td>
                                        <td className="px-4 py-2 text-sm font-medium text-red-600">${order.revenue?.toLocaleString() || '0'}</td>
                                        <td className="px-4 py-2 text-sm text-primary-600">
                                          {order.lineItemCount} items {expandedOrders.has(`rr-${order.id}`) ? '▼' : '▶'}
                                        </td>
                                      </tr>
                                      {expandedOrders.has(`rr-${order.id}`) && order.lineItems?.length > 0 && (
                                        <tr key={`rr-${order.id}-items`}>
                                          <td colSpan={5} className="px-4 py-2 bg-red-50">
                                            <table className="min-w-full text-xs">
                                              <thead>
                                                <tr className="text-gray-500">
                                                  <th className="px-2 py-1 text-left">Product</th>
                                                  <th className="px-2 py-1 text-left">Description</th>
                                                  <th className="px-2 py-1 text-right">Qty</th>
                                                  <th className="px-2 py-1 text-right">Price</th>
                                                  <th className="px-2 py-1 text-right">Total</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {order.lineItems.map((item: any, idx: number) => (
                                                  <tr key={idx} className="border-t border-red-100">
                                                    <td className="px-2 py-1 font-mono">{item.productNum || item.partNum || '-'}</td>
                                                    <td className="px-2 py-1">{item.description || item.productDescription || '-'}</td>
                                                    <td className="px-2 py-1 text-right">{item.qtyToFulfill || item.qty || '-'}</td>
                                                    <td className="px-2 py-1 text-right">${(item.unitPrice || item.price || 0).toFixed(2)}</td>
                                                    <td className="px-2 py-1 text-right font-medium">${(item.totalPrice || item.lineTotal || 0).toFixed(2)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm py-4">No RepRally orders found</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                </>
              ) : (
                <div className="card text-center py-12">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Switcher Analysis</h3>
                  <p className="text-gray-600 mb-6">
                    Find customers who switched from direct orders to RepRally
                  </p>
                  <button onClick={() => loadReprallySwitchers(false)} className="btn btn-primary">Run Analysis</button>
                </div>
              )}
            </div>
          )}

          {/* Map Sub-Tab */}
          {thirdPartySubTab === 'map' && (
            <RepRallyMap />
          )}

          {/* Data Tools Sub-Tab */}
          {thirdPartySubTab === 'data' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">RepRally Data Tools</h3>
                <p className="text-gray-600 mb-6">
                  Utilities for managing RepRally customer data and analysis
                </p>

                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Build RepRally Collection</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Create reprally_customers collection from billing data
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => buildRepRallyCollection(true)}
                        disabled={buildRepRallyLoading}
                        className="btn btn-secondary text-sm"
                      >
                        {buildRepRallyLoading ? 'Analyzing...' : 'Dry Run'}
                      </button>
                      <button
                        onClick={() => buildRepRallyCollection(false)}
                        disabled={buildRepRallyLoading}
                        className="btn btn-primary text-sm"
                      >
                        {buildRepRallyLoading ? 'Building...' : 'Build Collection'}
                      </button>
                    </div>
                    {buildRepRallyResult && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
                        <p className="text-green-800">
                          ✓ {buildRepRallyResult.stats.repRallyCustomersCreated} customers processed
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Extract Customers</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Extract unique customer records from RepRally billing data
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => extractRepRallyCustomers(true)}
                        disabled={extractRepRallyLoading}
                        className="btn btn-secondary text-sm"
                      >
                        {extractRepRallyLoading ? 'Analyzing...' : 'Dry Run'}
                      </button>
                      <button
                        onClick={() => extractRepRallyCustomers(false)}
                        disabled={extractRepRallyLoading}
                        className="btn btn-primary text-sm"
                      >
                        {extractRepRallyLoading ? 'Extracting...' : 'Extract'}
                      </button>
                    </div>
                    {extractRepRallyResult && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
                        <p className="text-green-800">
                          ✓ {extractRepRallyResult.stats.uniqueCustomersFound} unique customers found
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Match Customers</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Match RepRally locations with Fishbowl customers
                    </p>
                    <button
                      onClick={matchRepRallyCustomers}
                      disabled={matchCustomersLoading}
                      className="btn btn-primary text-sm"
                    >
                      {matchCustomersLoading ? 'Matching...' : 'Match Customers'}
                    </button>
                    {matchCustomersResult && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
                        <p className="text-green-800">
                          ✓ {matchCustomersResult.stats.potentialSwitchers} potential switchers found
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSV Import Preview Modal */}
      {showCsvPreview && csvPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">📋 CSV Import Preview</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Review changes before committing to database
                  </p>
                </div>
                <button
                  onClick={handleCancelCsvImport}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-600 font-medium">New Customers</p>
                  <p className="text-2xl font-bold text-blue-900">{csvPreview.stats.new}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm text-green-600 font-medium">Updates</p>
                  <p className="text-2xl font-bold text-green-900">{csvPreview.stats.updated}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600 font-medium">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{csvPreview.stats.total}</p>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-auto p-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Rep</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvPreview.updates.map((update: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          update.action === 'create'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {update.action === 'create' ? '+ New' : '↻ Update'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{update.customerNum}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{update.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{update.accountType}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{update.salesRep || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCancelCsvImport}
                className="btn btn-secondary"
                disabled={committingCsv}
              >
                Cancel
              </button>
              <button
                onClick={handleCommitCsvImport}
                className="btn btn-primary"
                disabled={committingCsv}
              >
                {committingCsv ? '⏳ Committing...' : '✓ Commit Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Change Confirmation Modal */}
      {confirmAdminChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Confirm Admin Change</h3>
            <p className="text-gray-600 mb-6">
              You are changing <strong>{confirmAdminChange.customerName}</strong> from <strong>admin</strong> to a sales rep.
              This customer was originally owned by admin. Are you sure?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAdminChange(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdminRepChange}
                className="btn btn-primary"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
