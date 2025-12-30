'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  Settings as SettingsIcon, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  UserPlus,
  Download,
  Calendar,
  Calculator,
  Upload,
  Database as DatabaseIcon,
  Search,
  Filter,
  Users,
  Package,
  Link2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Map as MapIcon,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Store,
  Clock,
  UserX,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import RegionMap from './RegionMap';
import RegionManager from './RegionManager';
import CustomerMap from './CustomerMap';
import CustomersTab from './CustomersTab';
import RulesTab from './RulesTab';
import ProductsTab from './ProductsTab';
import DataSyncTab from './DataSyncTab';
import { CommissionConfig, CommissionBucket, ProductSubGoal, ActivitySubGoal, RoleCommissionScale, RepRole, CommissionEntry } from '@/types';
import { validateWeightsSum, calculatePayout, formatCurrency, formatAttainment } from '@/lib/commission/calculator';
import MonthYearModal from '@/components/MonthYearModal';
import ProcessingModal from './modals/ProcessingModal';
import SpiffModal from './modals/SpiffModal';
import UserModal from './modals/UserModal';
import ProductModal from './modals/ProductModal';

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState('Q4 2025');
  const [quarters, setQuarters] = useState<string[]>(['Q4 2025', 'Q1 2026']);
  const [activeTab, setActiveTab] = useState<'rules' | 'datasync' | 'customers' | 'products' | 'orgchart'>('rules');
  const [rulesSubTab, setRulesSubTab] = useState<'quarterly' | 'monthly'>('quarterly');

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['rules', 'datasync', 'customers', 'products', 'orgchart'].includes(tabParam)) {
      setActiveTab(tabParam as 'rules' | 'datasync' | 'customers' | 'products' | 'orgchart');
    }
  }, [searchParams]);

  const currentTab = activeTab;
  const isRulesTab = activeTab === 'rules';
  const isDataSyncTab = activeTab === 'datasync';
  const isCustomersTab = activeTab === 'customers';
  const isProductsTab = activeTab === 'products';

  // Configuration state
  const [config, setConfig] = useState<CommissionConfig>({
    quarter: 'Q4 2025',
    maxBonusPerRep: 25000,
    overPerfCap: 125,
    minAttainment: 75,
    buckets: [],
    roleScales: [
      { role: 'Sr. Account Executive', percentage: 1.0 },
      { role: 'Account Executive', percentage: 0.85 },
      { role: 'Jr. Account Executive', percentage: 0.70 },
      { role: 'Account Manager', percentage: 0.60 },
    ],
    budgets: [
      { title: 'Sr. Account Executive', bucketA: 500000, bucketB: 100000, bucketC: 300000, bucketD: 50 },
      { title: 'Account Executive', bucketA: 400000, bucketB: 80000, bucketC: 250000, bucketD: 40 },
      { title: 'Jr. Account Executive', bucketA: 300000, bucketB: 60000, bucketC: 200000, bucketD: 30 },
      { title: 'Account Manager', bucketA: 250000, bucketB: 50000, bucketC: 150000, bucketD: 25 },
    ],
  });

  const [products, setProducts] = useState<ProductSubGoal[]>([]);
  const [activities, setActivities] = useState<ActivitySubGoal[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  
  // Monthly commission rates state
  const [commissionRates, setCommissionRates] = useState<any>({
    rates: [],
    specialRules: {
      repTransfer: {
        enabled: true,
        flatFee: 0,
        percentFallback: 2.0,
        useGreater: true,
        segmentRates: {
          wholesale: 4.0,
          distributor: 2.0
        }
      },
      inactivityThreshold: 12
    },
    titles: [
      "Account Executive",
      "Jr. Account Executive",
      "Account Manager",
      "Sr. Account Executive"
    ],
    segments: [
      { id: "distributor", name: "Distributor" },
      { id: "wholesale", name: "Wholesale" }
    ]
  });
  const [selectedTitle, setSelectedTitle] = useState<string>("Account Executive");
  const [showMonthYearModal, setShowMonthYearModal] = useState(false);
  
  // Commission calculation rules
  const [commissionRules, setCommissionRules] = useState({
    excludeShipping: true,
    excludeCCProcessing: true, // Exclude credit card processing fees
    useOrderValue: true,
    applyReorgRule: true, // July 2025 reorg - transferred customers get 2%
    reorgDate: '2025-07-01', // Date of the reorg
  });

  // Org Chart state
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [selectedOrgLevel, setSelectedOrgLevel] = useState<'all' | 'executive' | 'director' | 'regional' | 'division' | 'territory' | 'rep'>('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [orgChartSubTab, setOrgChartSubTab] = useState<'team' | 'regions' | 'regionManager'>('team');
  const [customerSubTab, setCustomerSubTab] = useState<'list' | 'map' | '3rdparty'>('list');
  const [thirdPartySubTab, setThirdPartySubTab] = useState<'overview' | 'switchers' | 'map' | 'data'>('overview');

  // Customer Management state
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [savingCustomer, setSavingCustomer] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'originalOwner' | 'shippingCity' | 'shippingState'>('customerName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const [confirmAdminChange, setConfirmAdminChange] = useState<{ customerId: string; newRep: string; customerName: string } | null>(null);
  
  // Spiffs/Kickers state
  const [spiffs, setSpiffs] = useState<any[]>([]);
  const [showAddSpiffModal, setShowAddSpiffModal] = useState(false);
  const [editingSpiff, setEditingSpiff] = useState<any>(null);
  const [selectedSpiffProducts, setSelectedSpiffProducts] = useState<string[]>([]);
  
  // Products state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductType, setSelectedProductType] = useState('all');
  const [selectedProductStatus, setSelectedProductStatus] = useState('all');
  const [productSortField, setProductSortField] = useState<'productNum' | 'productDescription' | 'category' | 'productType' | 'isActive'>('productNum');
  const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [showAddBonusProductModal, setShowAddBonusProductModal] = useState(false);
  const [editingBonusProduct, setEditingBonusProduct] = useState<any>(null);
  
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
  
  // Mark Active in Copper state
  const [markActiveLoading, setMarkActiveLoading] = useState(false);
  const [markActiveResult, setMarkActiveResult] = useState<any>(null);
  
  // Fix Custom Fields state
  const [fixFieldsLoading, setFixFieldsLoading] = useState(false);
  const [fixFieldsResult, setFixFieldsResult] = useState<any>(null);
  
  // 3rd Party Analysis state
  const [thirdPartyData, setThirdPartyData] = useState<any>(null);
  const [thirdPartyLoading, setThirdPartyLoading] = useState(false);
  const [buildRepRallyLoading, setbuildRepRallyLoading] = useState(false);
  const [buildRepRallyResult, setBuildRepRallyResult] = useState<any>(null);
  const [extractRepRallyLoading, setExtractRepRallyLoading] = useState(false);
  const [extractRepRallyResult, setExtractRepRallyResult] = useState<any>(null);
  const [matchCustomersLoading, setMatchCustomersLoading] = useState(false);
  const [matchCustomersResult, setMatchCustomersResult] = useState<any>(null);
  const [reprallyAnalytics, setReprallyAnalytics] = useState<any>(null);
  const [reprallyAnalyticsLoading, setReprallyAnalyticsLoading] = useState(false);
  const [reprallySwitchers, setReprallySwitchers] = useState<any>(null);
  const [reprallySwitchersLoading, setReprallySwitchersLoading] = useState(false);

  // Commission Summary state
  const [commissionSummary, setCommissionSummary] = useState<any>(null);
  
  // Processing modal state
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [showConfetti, setShowConfetti] = useState(false);

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
  const [customerSyncLiveMode, setCustomerSyncLiveMode] = useState(false);
  
  // Copper API Fresh Sync state
  const [copperApiSyncLoading, setCopperApiSyncLoading] = useState(false);
  const [copperApiSyncResult, setCopperApiSyncResult] = useState<any>(null);

  const loadQuarters = async () => {
    try {
      const quartersSnapshot = await getDocs(collection(db, 'quarters'));
      const quartersList: string[] = [];
      quartersSnapshot.forEach((doc) => {
        quartersList.push(doc.data().code);
      });
      setQuarters(quartersList.sort());
    } catch (error) {
      console.error('Error loading quarters:', error);
    }
  };

  const loadOrgUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: any[] = [];
      usersSnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setOrgUsers(usersData);
      console.log('Loaded org users:', usersData.length);
    } catch (error) {
      console.error('Error loading org users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      // Load commission config for selected quarter
      const configDoc = await getDoc(doc(db, 'settings', `commission_config_${selectedQuarter.replace(/ /g, '_')}`));
      if (configDoc.exists()) {
        const loadedConfig = configDoc.data() as CommissionConfig;
        // Ensure roleScales exists
        if (!loadedConfig.roleScales) {
          loadedConfig.roleScales = [
            { role: 'Sr. Account Executive', percentage: 1.00 },
            { role: 'Account Executive', percentage: 0.85 },
            { role: 'Jr. Account Executive', percentage: 0.70 },
            { role: 'Account Manager', percentage: 0.60 },
          ];
        }
        // Ensure budgets exists
        if (!loadedConfig.budgets) {
          loadedConfig.budgets = [
            { title: 'Sr. Account Executive', bucketA: 500000, bucketB: 100000, bucketC: 300000, bucketD: 50 },
            { title: 'Account Executive', bucketA: 400000, bucketB: 80000, bucketC: 250000, bucketD: 40 },
            { title: 'Jr. Account Executive', bucketA: 300000, bucketB: 60000, bucketC: 200000, bucketD: 30 },
            { title: 'Account Manager', bucketA: 250000, bucketB: 50000, bucketC: 150000, bucketD: 25 },
          ];
        }
        setConfig(loadedConfig);
      } else {
        // Load default config if quarter-specific doesn't exist
        const defaultConfigDoc = await getDoc(doc(db, 'settings', 'commission_config'));
        if (defaultConfigDoc.exists()) {
          const defaultConfig = defaultConfigDoc.data() as CommissionConfig;
          // Ensure roleScales exists
          if (!defaultConfig.roleScales) {
            defaultConfig.roleScales = [
              { role: 'Sr. Account Executive', percentage: 1.00 },
              { role: 'Account Executive', percentage: 0.85 },
              { role: 'Jr. Account Executive', percentage: 0.70 },
              { role: 'Account Manager', percentage: 0.60 },
            ];
          }
          // Ensure budgets exists
          if (!defaultConfig.budgets) {
            defaultConfig.budgets = [
              { title: 'Sr. Account Executive', bucketA: 500000, bucketB: 100000, bucketC: 300000, bucketD: 50 },
              { title: 'Account Executive', bucketA: 400000, bucketB: 80000, bucketC: 250000, bucketD: 40 },
              { title: 'Jr. Account Executive', bucketA: 300000, bucketB: 60000, bucketC: 200000, bucketD: 30 },
              { title: 'Account Manager', bucketA: 250000, bucketB: 50000, bucketC: 150000, bucketD: 25 },
            ];
          }
          setConfig({ ...defaultConfig, quarter: selectedQuarter });
        }
      }

      // Load products (only quarterly bonus eligible or legacy products with targetPercent)
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData: ProductSubGoal[] = [];
      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include products that are quarterly bonus eligible OR have targetPercent (legacy data)
        if (data.quarterlyBonusEligible === true || data.targetPercent !== undefined) {
          productsData.push({ id: doc.id, ...data } as ProductSubGoal);
        }
      });
      setProducts(productsData);

      // Load activities
      const activitiesSnapshot = await getDocs(collection(db, 'activities'));
      const activitiesData: ActivitySubGoal[] = [];
      activitiesSnapshot.forEach((doc) => {
        activitiesData.push({ id: doc.id, ...doc.data() } as ActivitySubGoal);
      });
      setActivities(activitiesData);

      // Load reps from users collection (commissioned users only)
      const usersQuery = query(
        collection(db, 'users'),
        where('isCommissioned', '==', true)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const repsData: any[] = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        repsData.push({
          id: doc.id,
          name: userData.name,
          email: userData.email,
          title: userData.title,
          salesPerson: userData.salesPerson, // This is the Fishbowl username
          fishbowlUsername: userData.salesPerson, // Alias for compatibility
          active: userData.isActive,
          startDate: userData.createdAt,
          notes: userData.notes || ''
        });
      });
      setReps(repsData);

      // Load commission rates for selected title
      const titleKey = selectedTitle.replace(/\s+/g, '_');
      const ratesDoc = await getDoc(doc(db, 'settings', `commission_rates_${titleKey}`));
      if (ratesDoc.exists()) {
        const ratesData = ratesDoc.data();
        
        // Ensure all rate combinations exist for the selected title
        const allStatuses = ['new_business', '6_month_active', '12_month_active', 'transferred'];
        const allSegments = ['distributor', 'wholesale'];
        
        const existingRates = ratesData.rates || [];
        const completeRates = [...existingRates];
        
        // Add missing rate combinations
        allSegments.forEach(segmentId => {
          allStatuses.forEach(status => {
            const exists = existingRates.find((r: any) => 
              r.title === selectedTitle && r.segmentId === segmentId && r.status === status
            );
            
            if (!exists) {
              // Add missing rate with default values
              let defaultPercentage = '';
              if (status === 'new_business') {
                defaultPercentage = segmentId === 'distributor' ? '8.0' : '10.0';
              } else if (status === '6_month_active') {
                defaultPercentage = segmentId === 'distributor' ? '5.0' : '7.0';
              } else if (status === '12_month_active') {
                defaultPercentage = segmentId === 'distributor' ? '3.0' : '5.0';
              } else if (status === 'transferred') {
                defaultPercentage = '2.0';
              }
              
              completeRates.push({
                title: selectedTitle,
                segmentId,
                status,
                percentage: defaultPercentage,
                active: true
              });
            }
          });
        });
        
        setCommissionRates({
          ...ratesData,
          rates: completeRates
        });
        console.log(`Loaded commission rates for ${selectedTitle} from Firestore (${completeRates.length} rates total)`);
      } else {
        console.log(`No commission rates found for ${selectedTitle}, using defaults`);
      }

      // Load commission rules with defaults
      const rulesDoc = await getDoc(doc(db, 'settings', 'commission_rules'));
      if (rulesDoc.exists()) {
        const loadedRules = rulesDoc.data();
        setCommissionRules({
          excludeShipping: loadedRules?.excludeShipping ?? true,
          excludeCCProcessing: loadedRules?.excludeCCProcessing ?? true,
          useOrderValue: loadedRules?.useOrderValue ?? true,
          applyReorgRule: loadedRules?.applyReorgRule ?? true,
          reorgDate: loadedRules?.reorgDate ?? '2025-07-01',
        });
        console.log('Loaded commission rules from Firestore');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    }
  }, [selectedQuarter, selectedTitle]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!isAdmin) {
      toast.error('Admin access required');
      router.push('/dashboard');
      return;
    }

    loadQuarters();
    loadSettings();
    if (activeTab === 'orgchart') {
      loadOrgUsers();
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, router]);

  useEffect(() => {
    if (selectedQuarter) {
      loadSettings();
    }
  }, [selectedQuarter, loadSettings]);

  useEffect(() => {
    if (activeTab === 'orgchart') {
      loadOrgUsers();
    }
  }, [activeTab, user, isAdmin]);

  // Load customers when customers tab is active
  useEffect(() => {
    if (activeTab === 'customers' && isAdmin) {
      console.log('Loading customers for Customers tab...');
      loadCustomers();
    }
  }, [activeTab, isAdmin]);


  // Load commission rates when title changes
  useEffect(() => {
    const loadRatesForTitle = async () => {
      try {
        const titleKey = selectedTitle.replace(/\s+/g, '_');
        const ratesDoc = await getDoc(doc(db, 'settings', `commission_rates_${titleKey}`));
        if (ratesDoc.exists()) {
          const ratesData = ratesDoc.data();
          setCommissionRates(ratesData);
          console.log(`Loaded commission rates for ${selectedTitle}`);
        } else {
          // Reset to defaults if no rates found for this title
          setCommissionRates({
            rates: [],
            specialRules: {
              repTransfer: {
                enabled: true,
                flatFee: 0,
                percentFallback: 2,
                useGreater: true
              },
              inactivityThreshold: 12
            },
            titles: commissionRates.titles || [],
            segments: commissionRates.segments || [
              { id: "distributor", name: "Distributor" },
              { id: "wholesale", name: "Wholesale" }
            ]
          });
          console.log(`No rates found for ${selectedTitle}, using defaults`);
        }
      } catch (error) {
        console.error('Error loading rates for title:', error);
      }
    };

    if (selectedTitle && activeTab === 'rules' && rulesSubTab === 'monthly') {
      loadRatesForTitle();
    }
  }, [selectedTitle, activeTab, rulesSubTab, commissionRates.segments, commissionRates.titles]);

  // Load spiffs/kickers and products for spiff dropdown
  useEffect(() => {
    if (activeTab === 'rules' && rulesSubTab === 'monthly' && isAdmin) {
      loadSpiffs();
      // Load products for spiff dropdown
      if (allProducts.length === 0) {
        loadProducts();
      }
    }
  }, [activeTab, rulesSubTab, isAdmin, allProducts.length]);

  const loadSpiffs = async () => {
    try {
      const spiffsSnapshot = await getDocs(collection(db, 'spiffs'));
      const spiffsData = spiffsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSpiffs(spiffsData);
    } catch (error) {
      console.error('Error loading spiffs:', error);
      toast.error('Failed to load spiffs');
    }
  };

  const handleSaveSpiff = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    if (selectedSpiffProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    
    try {
      const baseSpiffData = {
        name: formData.get('name'),
        incentiveType: formData.get('incentiveType'),
        incentiveValue: parseFloat(formData.get('incentiveValue') as string),
        isActive: formData.get('isActive') === 'on',
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate') || null,
        notes: formData.get('notes') || '',
        updatedAt: new Date().toISOString(),
      };

      if (editingSpiff) {
        // When editing, update the single spiff
        const product = allProducts.find(p => p.productNum === selectedSpiffProducts[0]);
        await updateDoc(doc(db, 'spiffs', editingSpiff.id), {
          ...baseSpiffData,
          productNum: selectedSpiffProducts[0],
          productDescription: product?.productDescription || '',
        });
        toast.success('Spiff updated successfully!');
      } else {
        // When creating, create one spiff per selected product
        const batch = [];
        for (const productNum of selectedSpiffProducts) {
          const product = allProducts.find(p => p.productNum === productNum);
          batch.push(
            addDoc(collection(db, 'spiffs'), {
              ...baseSpiffData,
              productNum: productNum,
              productDescription: product?.productDescription || '',
              createdAt: new Date().toISOString(),
            })
          );
        }
        await Promise.all(batch);
        toast.success(`${selectedSpiffProducts.length} spiff(s) added successfully!`);
      }

      setShowAddSpiffModal(false);
      setEditingSpiff(null);
      setSelectedSpiffProducts([]);
      loadSpiffs();
    } catch (error) {
      console.error('Error saving spiff:', error);
      toast.error('Failed to save spiff');
    }
  };

  const handleDeleteSpiff = async (spiffId: string) => {
    if (!confirm('Are you sure you want to delete this spiff/kicker?')) return;
    
    try {
      await deleteDoc(doc(db, 'spiffs', spiffId));
      toast.success('Spiff deleted successfully!');
      loadSpiffs();
    } catch (error) {
      console.error('Error deleting spiff:', error);
      toast.error('Failed to delete spiff');
    }
  };

  const handleToggleSpiffActive = async (spiffId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'spiffs', spiffId), {
        isActive: !currentStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Spiff ${!currentStatus ? 'activated' : 'deactivated'}!`);
      loadSpiffs();
    } catch (error) {
      console.error('Error toggling spiff:', error);
      toast.error('Failed to update spiff status');
    }
  };

  // Load products
  useEffect(() => {
    if (activeTab === 'products' && isAdmin) {
      loadProducts();
    }
  }, [activeTab, isAdmin]);

  const loadProducts = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  // Filter and sort products
  useEffect(() => {
    let filtered = [...allProducts];

    // Apply search filter
    if (productSearchTerm) {
      const term = productSearchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.productNum?.toLowerCase().includes(term) ||
        product.productDescription?.toLowerCase().includes(term) ||
        product.category?.toLowerCase().includes(term)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Apply product type filter
    if (selectedProductType !== 'all') {
      filtered = filtered.filter(product => product.productType === selectedProductType);
    }

    // Apply status filter
    if (selectedProductStatus !== 'all') {
      if (selectedProductStatus === 'active') {
        filtered = filtered.filter(product => product.isActive === true);
      } else if (selectedProductStatus === 'inactive') {
        filtered = filtered.filter(product => product.isActive === false);
      } else if (selectedProductStatus === 'quarterlyBonus') {
        filtered = filtered.filter(product => product.quarterlyBonusEligible === true);
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[productSortField];
      let bVal = b[productSortField];
      
      // Special handling for isActive (boolean) - Active first when ascending
      if (productSortField === 'isActive') {
        const aActive = aVal === true ? 1 : 0;
        const bActive = bVal === true ? 1 : 0;
        return productSortDirection === 'asc' ? bActive - aActive : aActive - bActive;
      }
      
      // Handle null/undefined
      aVal = aVal || '';
      bVal = bVal || '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return productSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return productSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredProducts(filtered);
  }, [productSearchTerm, allProducts, selectedCategory, selectedProductType, selectedProductStatus, productSortField, productSortDirection]);

  const handleImportProducts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingProducts(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/products/import-csv', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Imported ${result.stats.total} products!`);
        loadProducts();
      } else {
        toast.error(result.error || 'Failed to import products');
      }
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('Failed to import products');
    } finally {
      setImportingProducts(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    try {
      const productData = {
        productNum: formData.get('productNum'),
        productDescription: formData.get('productDescription'),
        category: formData.get('category'),
        productType: formData.get('productType'),
        size: formData.get('size'),
        uom: formData.get('uom'),
        notes: formData.get('notes') || '',
        isActive: formData.get('isActive') === 'on',
        quarterlyBonusEligible: formData.get('quarterlyBonusEligible') === 'on',
        updatedAt: new Date().toISOString(),
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success('Product updated successfully!');
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString(),
          imageUrl: null,
          imagePath: null,
        });
        toast.success('Product added successfully!');
      }

      setShowAddProductModal(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const product = allProducts.find(p => p.id === productId);
      
      // Delete image if exists
      if (product?.imagePath) {
        await fetch(`/api/products/upload-image?productId=${productId}&imagePath=${encodeURIComponent(product.imagePath)}`, {
          method: 'DELETE',
        });
      }

      await deleteDoc(doc(db, 'products', productId));
      toast.success('Product deleted successfully!');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleUploadProductImage = async (productId: string, productNum: string, file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productId', productId);
      formData.append('productNum', productNum);

      const response = await fetch('/api/products/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Image uploaded successfully!');
        loadProducts();
      } else {
        toast.error(result.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProductImage = async (productId: string, imagePath: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const response = await fetch(`/api/products/upload-image?productId=${productId}&imagePath=${encodeURIComponent(imagePath)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Image deleted successfully!');
        loadProducts();
      } else {
        toast.error(result.error || 'Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleToggleProductActive = async (productId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        isActive: !currentStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Product ${!currentStatus ? 'activated' : 'deactivated'}!`);
      loadProducts();
    } catch (error) {
      console.error('Error toggling product status:', error);
      toast.error('Failed to update product status');
    }
  };

  const addBucket = () => {
    const newBucket: CommissionBucket = {
      id: `bucket_${Date.now()}`,
      code: String.fromCharCode(65 + config.buckets.length), // A, B, C, D, E, etc.
      name: 'New Bucket',
      weight: 0,
      hasSubGoals: false,
      active: true,
    };
    setConfig({ ...config, buckets: [...config.buckets, newBucket] });
  };

  const removeBucket = (bucketId: string) => {
    setConfig({ ...config, buckets: config.buckets.filter(b => b.id !== bucketId) });
  };

  const addRoleScale = () => {
    const newRole: RoleCommissionScale = {
      role: 'Account Executive',
      percentage: 0.80,
    };
    setConfig({ ...config, roleScales: [...config.roleScales, newRole] });
  };

  const removeRoleScale = (index: number) => {
    const newScales = config.roleScales.filter((_, i) => i !== index);
    setConfig({ ...config, roleScales: newScales });
  };

  const suggestNextQuarter = (): string => {
    if (quarters.length === 0) return 'Q1 2025';
    
    // Parse the latest quarter
    const sorted = [...quarters].sort().reverse();
    const latest = sorted[0];
    const match = latest.match(/Q(\d) (\d{4})/);
    
    if (match) {
      let quarter = parseInt(match[1]);
      let year = parseInt(match[2]);
      
      quarter++;
      if (quarter > 4) {
        quarter = 1;
        year++;
      }
      
      return `Q${quarter} ${year}`;
    }
    
    return 'Q1 2025';
  };

  const addQuarter = async () => {
    const newQuarter = prompt('Enter new quarter (e.g., Q1 2026):', suggestNextQuarter());
    
    if (!newQuarter) return;
    
    // Validate format
    if (!/^Q[1-4] \d{4}$/.test(newQuarter)) {
      toast.error('Invalid format. Use: Q1 2025, Q2 2025, etc.');
      return;
    }
    
    if (quarters.includes(newQuarter)) {
      toast.error('This quarter already exists');
      return;
    }
    
    try {
      // Calculate start and end dates
      const match = newQuarter.match(/Q(\d) (\d{4})/);
      if (!match) return;
      
      const quarter = parseInt(match[1]);
      const year = parseInt(match[2]);
      
      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;
      
      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, endMonth + 1, 0); // Last day of month
      
      await setDoc(doc(db, 'quarters', newQuarter), {
        code: newQuarter,
        startDate,
        endDate,
      });
      
      setQuarters([...quarters, newQuarter].sort());
      setSelectedQuarter(newQuarter);
      toast.success(`Quarter ${newQuarter} added successfully`);
    } catch (error) {
      console.error('Error adding quarter:', error);
      toast.error('Failed to add quarter');
    }
  };

  const exportToCSV = async () => {
    try {
      toast.loading('Generating export...');
      
      // Fetch all commission entries for selected quarter
      const entriesSnapshot = await getDocs(collection(db, 'commission_entries'));
      const entries: any[] = [];
      
      entriesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.quarter === selectedQuarter) {
          entries.push({ id: doc.id, ...data });
        }
      });
      
      // Build CSV
      const headers = [
        'Quarter',
        'Rep Name',
        'Rep Email',
        'Rep Title',
        'Bucket Code',
        'Bucket Name',
        'Goal Value',
        'Actual Value',
        'Attainment %',
        'Bucket Weight',
        'Weighted Score',
        'Total Commission',
        'Max Bonus',
        'Date Created'
      ];
      
      const rows = entries.map(entry => {
        const rep = reps.find(r => r.id === entry.repId);
        return [
          entry.quarter || selectedQuarter,
          rep?.name || 'Unknown',
          rep?.email || '',
          rep?.title || '',
          entry.bucketCode || '',
          entry.bucketName || '',
          entry.goalValue || 0,
          entry.actualValue || 0,
          ((entry.attainment || 0) * 100).toFixed(2) + '%',
          ((entry.bucketWeight || 0) * 100).toFixed(2) + '%',
          ((entry.weightedScore || 0) * 100).toFixed(2) + '%',
          '$' + (entry.commission || 0).toFixed(2),
          '$' + (entry.maxBonus || config.maxBonusPerRep).toFixed(2),
          entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString() : ''
        ];
      });
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commission_data_${selectedQuarter.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('Export downloaded successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.dismiss();
      toast.error('Failed to export data');
    }
  };

  const handleSaveConfig = async () => {
    // Validate bucket weights sum to 100%
    const weights = config.buckets.filter(b => b.active).map(b => b.weight);
    if (!validateWeightsSum(weights)) {
      toast.error('Bucket weights must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      // Save quarter-specific config
      await setDoc(doc(db, 'settings', `commission_config_${selectedQuarter.replace(/ /g, '_')}`), config);
      
      // Save role-based bonus scales (global, not quarter-specific)
      await setDoc(doc(db, 'settings', 'bonus_scales'), {
        scales: config.roleScales.map(scale => ({
          role: scale.role,
          percentage: scale.percentage,
          maxBonus: config.maxBonusPerRep * scale.percentage
        })),
        maxBonusPerRep: config.maxBonusPerRep,
        updatedAt: new Date(),
        updatedBy: user?.uid || 'unknown'
      });
      
      toast.success(`Bonus configuration saved for ${selectedQuarter}`);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProducts = async () => {
    // Validate product sub-weights sum to 100%
    const activeProducts = products.filter(p => p.active);
    const subWeights = activeProducts.map(p => p.subWeight);
    if (!validateWeightsSum(subWeights)) {
      toast.error('Product sub-weights must sum to 100%');
      return;
    }

    // Validate target percentages sum to 100%
    const targetPercents = activeProducts.map(p => p.targetPercent);
    if (!validateWeightsSum(targetPercents)) {
      toast.error('Product target percentages must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      // Save each product
      for (const product of products) {
        if (product.id.startsWith('new_')) {
          // New product - add to collection
          const { id, ...data } = product;
          await addDoc(collection(db, 'products'), data);
        } else {
          // Existing product - update
          const { id, ...data } = product;
          await updateDoc(doc(db, 'products', id), data);
        }
      }
      toast.success('Products saved successfully');
      await loadSettings(); // Reload to get new IDs
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error('Failed to save products');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveActivities = async () => {
    // Validate activity sub-weights sum to 100%
    const activeActivities = activities.filter(a => a.active);
    const subWeights = activeActivities.map(a => a.subWeight);
    if (!validateWeightsSum(subWeights)) {
      toast.error('Activity sub-weights must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      // Save each activity
      for (const activity of activities) {
        if (activity.id.startsWith('new_')) {
          // New activity - add to collection
          const { id, ...data } = activity;
          await addDoc(collection(db, 'activities'), data);
        } else {
          // Existing activity - update
          const { id, ...data } = activity;
          await updateDoc(doc(db, 'activities', id), data);
        }
      }
      toast.success('Activities saved successfully');
      await loadSettings(); // Reload to get new IDs
    } catch (error) {
      console.error('Error saving activities:', error);
      toast.error('Failed to save activities');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: `new_${Date.now()}`,
        sku: '',
        targetPercent: 0,
        subWeight: 0,
        active: true,
      },
    ]);
  };

  const handleSaveBonusProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      const productNum = formData.get('productNum') as string;
      const selectedProduct = allProducts.find(p => p.productNum === productNum);
      
      if (!selectedProduct) {
        toast.error('Please select a product');
        return;
      }

      const bonusProductData = {
        sku: productNum,
        productNum: productNum,
        productDescription: selectedProduct.productDescription,
        targetPercent: Number(formData.get('targetPercent')) / 100,
        subWeight: Number(formData.get('subWeight')) / 100,
        msrp: Number(formData.get('msrp')) || undefined,
        active: formData.get('active') === 'on',
        notes: formData.get('notes') || '',
        quarterlyBonusEligible: true,
        updatedAt: new Date().toISOString(),
      };

      if (editingBonusProduct) {
        await updateDoc(doc(db, 'products', editingBonusProduct.id), bonusProductData);
        toast.success('Bonus product updated successfully!');
      } else {
        await addDoc(collection(db, 'products'), {
          ...bonusProductData,
          createdAt: new Date().toISOString(),
        });
        toast.success('Bonus product added successfully!');
      }

      setShowAddBonusProductModal(false);
      setEditingBonusProduct(null);
      loadSettings();
    } catch (error) {
      console.error('Error saving bonus product:', error);
      toast.error('Failed to save bonus product');
    }
  };

  const removeProduct = async (id: string) => {
    if (id.startsWith('new_')) {
      setProducts(products.filter(p => p.id !== id));
    } else {
      try {
        await deleteDoc(doc(db, 'products', id));
        setProducts(products.filter(p => p.id !== id));
        toast.success('Product removed');
      } catch (error) {
        toast.error('Failed to remove product');
      }
    }
  };

  const addActivity = () => {
    setActivities([
      ...activities,
      {
        id: `new_${Date.now()}`,
        activity: '',
        goal: 0,
        subWeight: 0,
        dataSource: '',
        active: true,
      },
    ]);
  };

  const removeActivity = async (id: string) => {
    if (id.startsWith('new_')) {
      setActivities(activities.filter(a => a.id !== id));
    } else {
      try {
        await deleteDoc(doc(db, 'activities', id));
        setActivities(activities.filter(a => a.id !== id));
        toast.success('Activity removed');
      } catch (error) {
        toast.error('Failed to remove activity');
      }
    }
  };

  const getBucketWeightSum = () => {
    return config.buckets.filter(b => b.active).reduce((sum, b) => sum + b.weight, 0);
  };

  const getProductSubWeightSum = () => {
    return products.filter(p => p.active).reduce((sum, p) => sum + p.subWeight, 0);
  };

  const getProductTargetSum = () => {
    return products.filter(p => p.active).reduce((sum, p) => sum + p.targetPercent, 0);
  };

  const getActivitySubWeightSum = () => {
    return activities.filter(a => a.active).reduce((sum, a) => sum + a.subWeight, 0);
  };

  const addRep = () => {
    setReps([
      ...reps,
      {
        id: `new_${Date.now()}`,
        name: '',
        title: 'Account Executive',
        email: '',
        active: true,
        startDate: new Date(),
      },
    ]);
  };

  const removeRep = async (id: string) => {
    if (id.startsWith('new_')) {
      setReps(reps.filter(r => r.id !== id));
    } else {
      try {
        await deleteDoc(doc(db, 'reps', id));
        setReps(reps.filter(r => r.id !== id));
        toast.success('Rep removed');
      } catch (error) {
        toast.error('Failed to remove rep');
      }
    }
  };

  // NOTE: handleSaveReps removed - SalesTeamTab component has its own save handler

  // Helper to get rate value
  const getRateValue = (segmentId: string, status: string): number | string => {
    const rate = commissionRates.rates.find(
      (r: any) => r.title === selectedTitle && r.segmentId === segmentId && r.status === status
    );
    // Return saved value or default
    if (rate) return rate.percentage;
    
    // Default values
    if (status === 'new_business') {
      return segmentId === 'distributor' ? 8.0 : 10.0;
    } else if (status === '6_month_active') {
      return segmentId === 'distributor' ? 5.0 : 7.0;
    } else if (status === '12_month_active') {
      return segmentId === 'distributor' ? 3.0 : 5.0;
    } else if (status === 'transferred') {
      return 2.0; // Transferred customers get 2% when reorg rule is active
    }
    return '';
  };

  // Helper to update rate value
  const updateRateValue = (segmentId: string, status: string, percentage: number | string, active: boolean = true) => {
    const existingRateIndex = commissionRates.rates.findIndex(
      (r: any) => r.title === selectedTitle && r.segmentId === segmentId && r.status === status
    );

    // Convert to number, but allow empty string to stay as empty
    const percentageValue = percentage === '' ? '' : (typeof percentage === 'string' ? parseFloat(percentage) : percentage);

    const newRate = {
      title: selectedTitle,
      segmentId,
      status,
      percentage: percentageValue,
      active
    };

    let updatedRates;
    if (existingRateIndex >= 0) {
      updatedRates = [...commissionRates.rates];
      updatedRates[existingRateIndex] = newRate;
    } else {
      updatedRates = [...commissionRates.rates, newRate];
    }

    setCommissionRates({
      ...commissionRates,
      rates: updatedRates
    });
  };

  const handleSaveCommissionRates = async () => {
    setSaving(true);
    try {
      const titleKey = selectedTitle.replace(/\s+/g, '_');
      await setDoc(doc(db, 'settings', `commission_rates_${titleKey}`), commissionRates);
      toast.success(`Commission rates saved for ${selectedTitle}!`);
      console.log(`Saved commission rates for ${selectedTitle} to Firestore:`, commissionRates);
    } catch (error) {
      console.error('Error saving commission rates:', error);
      toast.error('Failed to save commission rates');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCommissionRules = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'commission_rules'), commissionRules);
      toast.success('Commission rules saved successfully!');
      console.log('Saved commission rules to Firestore:', commissionRules);
    } catch (error) {
      console.error('Error saving commission rules:', error);
      toast.error('Failed to save commission rules');
    } finally {
      setSaving(false);
    }
  };


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
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.salesPerson) {
          repsMap.set(data.salesPerson, data.name);
        }
      });
      console.log(`Loaded ${repsMap.size} reps for mapping`);

      // Get customers and their sales rep from most recent order
      const snapshot = await getDocs(collection(db, 'fishbowl_customers'));
      console.log(`Found ${snapshot.size} customers in Firestore`);
      
      // Get sales rep for each customer from their orders
      const ordersSnapshot = await getDocs(collection(db, 'fishbowl_sales_orders'));
      const customerSalesRepMap = new Map();
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        if (order.customerId && order.salesPerson) {
          customerSalesRepMap.set(order.customerId, order.salesPerson);
        }
      });
      console.log(`Mapped ${customerSalesRepMap.size} customers to sales reps from orders`);
      
      const customersData: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const customerId = data.id || data.customerNum || doc.id;
        
        // Get the assigned rep (PRIORITY: manual fishbowlUsername first, then orders)
        const assignedRep = data.fishbowlUsername || data.salesPerson || customerSalesRepMap.get(customerId) || data.salesRep || '';
        const repName = repsMap.get(assignedRep) || assignedRep || 'Unassigned';
        
        // Get the original owner from Fishbowl orders
        const originalOwner = customerSalesRepMap.get(customerId) || data.salesRep || 'Unassigned';
        
        customersData.push({
          id: doc.id,
          customerNum: data.id || data.accountNumber?.toString() || doc.id,
          customerName: data.name || data.customerContact || 'Unknown',
          accountType: data.accountType || 'Retail',
          salesPerson: repName,
          fishbowlUsername: assignedRep, // This is what the dropdown binds to
          originalOwner: originalOwner, // Original from Fishbowl
          shippingCity: data.shippingCity || '',
          shippingState: data.shippingState || ''
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
      const repName = reps.find(r => r.salesPerson === newFishbowlUsername)?.name || newFishbowlUsername || 'Unassigned';
      
      // Get customer data to find Copper ID
      const customerSnapshot = await getDoc(customerRef);
      const customerData = customerSnapshot.data();
      const copperId = customerData?.copperId;
      const customerName = customerData?.name || customerData?.customerName || 'Unknown';
      
      // Update both fishbowlUsername (manual assignment) and salesPerson (display name)
      await updateDoc(customerRef, {
        fishbowlUsername: newFishbowlUsername,  // This is the manual override
        salesPerson: repName  // Display name for UI
      });
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, salesPerson: repName, fishbowlUsername: newFishbowlUsername } : c
      ));
      setFilteredCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, salesPerson: repName, fishbowlUsername: newFishbowlUsername } : c
      ));
      
      // Sync to Copper if we have a Copper ID
      if (copperId && newFishbowlUsername && newFishbowlUsername !== '') {
        console.log(`🔄 Syncing sales rep change to Copper for ${customerName}...`);
        
        try {
          const copperResponse = await fetch('/api/copper/update-owner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              copperId,
              newSalesPerson: newFishbowlUsername,
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
          }
        } catch (copperError) {
          console.error('Error syncing to Copper:', copperError);
          toast.success('Sales rep updated in Fishbowl (Copper sync failed)');
        }
      } else {
        // No Copper ID, just update Fishbowl
        toast.success('Sales rep updated!');
      }
      
    } catch (error) {
      console.error('Error updating sales rep:', error);
      toast.error('Failed to update sales rep');
    } finally {
      setSavingCustomer(null);
    }
  };

  const handleSort = (field: 'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'originalOwner' | 'shippingCity' | 'shippingState') => {
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

  // Filter and sort customers
  useEffect(() => {
    if (activeTab !== 'customers') return;
    
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

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal.toString().localeCompare(bVal.toString());
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredCustomers(filtered);
  }, [searchTerm, selectedRep, selectedAccountType, selectedCity, selectedState, customers, activeTab, sortField, sortDirection]);


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
      
      // Use chunked upload for files larger than 700KB
      // Chunk size must stay under ~750KB so base64 encoded data fits in Firestore's 1MB field limit
      const CHUNK_SIZE = 700 * 1024; // 700KB chunks
      const useChunkedUpload = fileSize > CHUNK_SIZE;
      
      if (useChunkedUpload) {
        // CHUNKED UPLOAD with progress tracking
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        const fileId = `file_${Date.now()}`;
        
        console.log(`📦 Splitting into ${totalChunks} chunks...`);
        toast.loading(`Uploading in ${totalChunks} chunks...`, { id: loadingToast });
        
        let uploadedChunks = 0;
        let currentImportId: string | null = null;
        
        // Upload each chunk
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
          
          uploadedChunks++;
          console.log(`✅ Uploaded chunk ${i + 1}/${totalChunks}`);
          
          // If this was the last chunk, we'll get an importId
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
        toast.loading('Processing import...', { id: loadingToast });
        
        // Start polling for progress
        pollImportProgress(currentImportId, loadingToast);
        
      } else {
        // SMALL FILE: Use unified import (no chunking needed)
        console.log(`📦 File is small (${fileSizeMB.toFixed(2)} MB), using direct upload`);
        
        const formData = new FormData();
        formData.append('file', fishbowlFile);
        
        toast.loading('Uploading and processing...', { id: loadingToast });
        
        const response = await fetch('/api/fishbowl/import-unified', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Import failed');
        }
        
        console.log('✅ Import completed!', data.stats);
        
        // Set result with stats
        setFishbowlResult({
          success: true,
          complete: true,
          stats: data.stats
        });
        
        setFishbowlFile(null);
        setFishbowlLoading(false);
        
        const totalWrites = (data.stats.ordersCreated || 0) + (data.stats.ordersUpdated || 0) + (data.stats.itemsCreated || 0) + (data.stats.itemsUpdated || 0);
        const totalSkipped = (data.stats.ordersUnchanged || 0) + (data.stats.itemsUnchanged || 0);
        const savedPercentage = totalWrites + totalSkipped > 0 ? ((totalSkipped / (totalWrites + totalSkipped)) * 100).toFixed(1) : '0.0';
        
        toast.success(
          `✅ Import Complete! ${totalWrites.toLocaleString()} writes (saved ${totalSkipped.toLocaleString()} - ${savedPercentage}% reduction)`,
          { id: loadingToast, duration: 5000 }
        );
        
        // Reload customers if on that tab
        if (activeTab === 'customers') {
          loadCustomers();
        }
      }
      
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
        
        console.log('Import progress update:', progressData);
        
        if (progressData.success && progressData.progress) {
          const progress = progressData.progress;
          const percent = progress.percentage || 0;
          const current = progress.currentRow || 0;
          const total = progress.totalRows || 0;
          const currentCustomer = progress.currentCustomer || '';
          
          // Update state
          setImportProgress({
            percentage: percent,
            currentRow: current,
            totalRows: total,
            status: progress.status
          });
          
          // Update toast
          if (currentCustomer) {
            toast.loading(`Processing: ${current} / ${total} (${percent.toFixed(1)}%) - ${currentCustomer}`, { id: toastId });
          } else {
            toast.loading(`Processing: ${current} / ${total} (${percent.toFixed(1)}%)`, { id: toastId });
          }
          
          // Check if complete
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
            
            // Reload customers if on that tab
            if (activeTab === 'customers') {
              loadCustomers();
            }
          }
        }
      } catch (err) {
        console.error('Import progress polling error:', err);
      }
    }, 2000); // Poll every 2 seconds
    
    // Safety timeout after 10 minutes
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
      } else {
        toast.success(
          `✅ DRY RUN: Would create ${data.wouldCreate} + update ${data.wouldUpdate} customers`,
          { id: loadingToast, duration: 5000 }
        );
      }
      
      // Reload customers if on that tab
      if (activeTab === 'customers') {
        loadCustomers();
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
    const loadingToast = toast.loading('📊 Loading RepRally analytics...');

    try {
      const response = await fetch('/api/reprally/analytics');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analytics failed');
      }

      setReprallyAnalytics(data);
      setReprallyAnalyticsLoading(false);
      toast.success('✅ RepRally analytics loaded', { id: loadingToast, duration: 4000 });
    } catch (error: any) {
      console.error('RepRally analytics error:', error);
      toast.error(error.message || 'Failed to load RepRally analytics', { id: loadingToast });
      setReprallyAnalyticsLoading(false);
    }
  };

  const loadReprallySwitchers = async (write = false) => {
    setReprallySwitchersLoading(true);
    const loadingToast = toast.loading(write ? '✍️ Persisting switchers to Firestore...' : '🔁 Finding RepRally switchers...');

    try {
      const response = await fetch(`/api/reprally/switchers?mode=strict&limit=500${write ? '&write=1' : ''}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Switcher analysis failed');
      }

      setReprallySwitchers(data);
      setReprallySwitchersLoading(false);
      toast.success(
        write
          ? `✅ Persisted ${data.switchers?.length || 0} switchers to reprally_customers`
          : `✅ Found ${data.stats?.switchersFound || 0} switchers`,
        { id: loadingToast, duration: 5000 }
      );
    } catch (error: any) {
      console.error('RepRally switcher analysis error:', error);
      toast.error(error.message || 'Failed to analyze switchers', { id: loadingToast });
      setReprallySwitchersLoading(false);
    }
  };

  const handleMarkActiveInCopper = async (dryRun = true) => {
    setMarkActiveLoading(true);
    setMarkActiveResult(null);
    const loadingToast = toast.loading(dryRun ? '🟢 Analyzing active flags...' : '🔴 Updating Copper active flags...');
    
    try {
      const response = await fetch('/api/copper/mark-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });
      
      // Read response as stream for progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: any = null;
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const progressData = JSON.parse(line.slice(6));
                
                // Update toast with progress
                if (progressData.stage) {
                  let msg = progressData.stage;
                  if (progressData.current && progressData.total) {
                    const pct = Math.round((progressData.current / progressData.total) * 100);
                    msg += ` (${progressData.current}/${progressData.total} - ${pct}%)`;
                  }
                  toast.loading(msg, { id: loadingToast });
                }
                
                // Store final result
                if (progressData.complete) {
                  finalData = progressData;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
      
      // Fallback if no streaming
      if (!finalData) {
        const data = await response.json();
        finalData = data;
      }
      
      if (!response.ok) {
        throw new Error(finalData.error || 'Mark active sync failed');
      }
      
      setMarkActiveResult(finalData);
      setMarkActiveLoading(false);
      
      if (dryRun) {
        toast.success(
          `✅ DRY RUN: ${finalData.stats.withCopperId} customers have Copper ID, ${finalData.updates?.length || 0} need activation`,
          { id: loadingToast, duration: 5000 }
        );
      } else {
        const msg = [
          `✅ LIVE MODE Complete:`,
          finalData.stats.duplicatesFound > 0 ? `${finalData.stats.duplicatesFound} duplicates linked` : null,
          finalData.stats.namesUpdated > 0 ? `${finalData.stats.namesUpdated} names updated` : null,
          `${finalData.stats.copperCreated} created`,
          `${finalData.stats.copperUpdated} activated`,
        ].filter(Boolean).join(', ');
        
        toast.success(msg, { id: loadingToast, duration: 8000 });
      }
      
    } catch (error: any) {
      console.error('Mark active error:', error);
      toast.error(error.message || 'Failed to mark customers active', { id: loadingToast });
      setMarkActiveLoading(false);
    }
  };

  const handleCopperSync = async () => {
    setCopperSyncLoading(true);
    setCopperSyncResult(null);
    const loadingToast = toast.loading('Syncing Copper → Fishbowl...');
    
    try {
      const response = await fetch('/api/sync-copper-to-fishbowl', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }
      
      console.log('✅ Copper sync completed!', data.stats);
      
      setCopperSyncResult(data);
      setCopperSyncLoading(false);
      
      toast.success(
        `✅ Synced ${data.stats.matched} customers! Updated ${data.stats.updated} with Copper accountType.`,
        { id: loadingToast, duration: 5000 }
      );
      
      // Reload customers if on that tab
      if (activeTab === 'customers') {
        loadCustomers();
      }
      
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Failed to sync Copper data', { id: loadingToast });
      setCopperSyncLoading(false);
    }
  };

  const handleCalculateMonthlyCommissions = async (month: string, year: number) => {
    setSaving(true);
    setShowProcessingModal(true);
    setProcessingStatus('Starting calculation...');
    setProcessingProgress(0);
    setShowConfetti(false);
    
    const loadingToast = toast.loading('Calculating monthly commissions...');
    
    try {
      // Start the calculation
      const response = await fetch('/api/calculate-monthly-commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Calculation failed');
      }
      
      console.log('✅ Calculation started:', data.calcId);
      toast.loading('Processing commissions...', { id: loadingToast });
      
      // Start polling for progress
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/commission-progress?calcId=${data.calcId}`);
          const progressData = await progressResponse.json();
          
          console.log('Progress update:', progressData);
          
          if (progressData.success) {
            const progress = progressData.progress;
            const percent = progress.percentage || 0;
            const current = progress.currentOrder || 0;
            const total = progress.totalOrders || 0;
            
            // Update modal
            setProcessingProgress(percent);
            setProcessingStatus(`Processing order ${current} of ${total}...`);
            
            // Update toast
            toast.loading(`Processing: ${current} / ${total} (${percent.toFixed(1)}%)`, { id: loadingToast });
            
            // Check if complete
            if (progress.status === 'complete') {
              clearInterval(pollInterval);
              
              setProcessingProgress(100);
              setProcessingStatus('Complete! 🎉💰');
              setShowConfetti(true);
              
              // Store summary data
              setCommissionSummary({
                month,
                year,
                commissionsCalculated: progress.stats.commissionsCalculated,
                totalCommission: progress.stats.totalCommission,
                ordersProcessed: total,
                repBreakdown: {},
                skippedCounts: {
                  admin: progress.stats.adminSkipped,
                  shopify: progress.stats.shopifySkipped,
                  retail: progress.stats.retailSkipped,
                  inactiveRep: progress.stats.inactiveRepSkipped
                },
                calculatedAt: new Date().toISOString()
              });
              
              toast.success(
                `✅ Calculated ${progress.stats.commissionsCalculated} commissions! Total: $${progress.stats.totalCommission.toFixed(2)}`,
                { id: loadingToast, duration: 8000 }
              );
              
              setSaving(false);
              
              // Close modal after 3 seconds
              setTimeout(() => {
                setShowProcessingModal(false);
              }, 3000);
            }
          }
        } catch (err) {
          console.error('Progress polling error:', err);
        }
      }, 1000); // Poll every second
      
      // Safety timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (saving) {
          toast.error('Calculation timeout - please check console for status', { id: loadingToast });
          setSaving(false);
          setShowProcessingModal(false);
        }
      }, 10 * 60 * 1000);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to calculate commissions', { id: loadingToast });
      setShowProcessingModal(false);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <SettingsIcon className="w-8 h-8 text-primary-600 mr-3" />
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Commission Settings</h1>
                  <p className="text-sm text-gray-600">Configure buckets, weights, and goals</p>
                </div>
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                  Commission Calculator
                </span>
              </div>
            </div>
            
            {/* Quarter Selector & Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMonthYearModal(true)}
                className="btn btn-primary flex items-center"
                title="Calculate commissions for a month"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Calculate Commissions
              </button>
              
              <button
                onClick={addQuarter}
                className="btn btn-secondary flex items-center"
                title="Add new quarter for forecasting"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Add Quarter
              </button>
              
              <div className="flex items-center">
                <label className="text-sm font-medium text-gray-700 mr-2">Quarter:</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="input w-40"
                >
                  {quarters.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'rules'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calculator className="w-4 h-4 inline mr-1" />
              Commission Rules
            </button>
            <button
              onClick={() => setActiveTab('datasync')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'datasync'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DatabaseIcon className="w-4 h-4 inline mr-1" />
              Data & Sync
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'customers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Customers
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'products'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Products
            </button>
          </nav>
        </div>
      </div>
    

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Commission Rules Tab */}
        {isRulesTab && (
          <RulesTab selectedQuarter={selectedQuarter} isAdmin={isAdmin} />
        )}

        {/* Data & Sync Tab */}
        {isDataSyncTab && (
          <DataSyncTab isAdmin={isAdmin} onCustomersUpdated={loadCustomers} />
        )}

        {/* Customers Tab - Admin editing only (list view) */}
        {isCustomersTab && (
          <CustomersTab isAdmin={isAdmin} reps={reps} adminListOnly={true} />
        )}

        {/* Products Tab */}
        {isProductsTab && (
          <ProductsTab isAdmin={isAdmin} />
        )}

      {/* Modals that should appear outside tabs */}
      {/* Month/Year Selection Modal */}
      <MonthYearModal
        isOpen={showMonthYearModal}
        onClose={() => setShowMonthYearModal(false)}
        onSubmit={handleCalculateMonthlyCommissions}
        title="Calculate Monthly Commissions"
        description="Select the month and year to process Fishbowl sales orders"
      />

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={showProcessingModal}
        status={processingStatus}
        progress={processingProgress}
        onClose={() => setShowProcessingModal(false)}
        showConfetti={showConfetti}
      />

      {/* Add/Edit Spiff Modal */}
      <SpiffModal
        isOpen={showAddSpiffModal}
        onClose={() => { setShowAddSpiffModal(false); setEditingSpiff(null); }}
        editingSpiff={editingSpiff}
        allProducts={allProducts}
        onSaved={loadSpiffs}
      />

      {/* Add/Edit Product Modal */}
      <ProductModal
        isOpen={showAddProductModal}
        onClose={() => { setShowAddProductModal(false); setEditingProduct(null); }}
        editingProduct={editingProduct}
        onSaved={loadProducts}
      />

      {/* Add/Edit User Modal */}
      <UserModal
        isOpen={showAddUserModal}
        onClose={() => { setShowAddUserModal(false); setEditingUser(null); }}
        editingUser={editingUser}
        onSaved={loadOrgUsers}
      />

      {/* Admin Change Confirmation Modal */}
      {confirmAdminChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <h2 className="text-xl font-bold text-gray-900">Confirm Admin Account Change</h2>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                You are about to change the sales rep for an <strong>admin</strong> account:
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                <p className="text-sm font-medium text-gray-900">{confirmAdminChange.customerName}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Current Owner: <span className="font-mono">admin</span>
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Are you sure you want to assign this account to a sales rep?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmAdminChange(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdminRepChange}
                className="btn bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Yes, Change Rep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Bonus Product Modal */}
      {showAddBonusProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingBonusProduct ? 'Edit' : 'Add'} Quarterly Bonus Product
                </h2>
                <button
                  onClick={() => {
                    setShowAddBonusProductModal(false);
                    setEditingBonusProduct(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveBonusProduct} className="space-y-6">
                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product *
                  </label>
                  <select
                    name="productNum"
                    defaultValue={editingBonusProduct?.productNum || editingBonusProduct?.sku || ''}
                    required
                    className="input w-full"
                  >
                    <option value="">Select a product...</option>
                    {allProducts
                      .filter(p => p.isActive)
                      .sort((a, b) => a.productNum.localeCompare(b.productNum))
                      .map(product => (
                        <option key={product.id} value={product.productNum}>
                          {product.productNum} - {product.productDescription}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select from active products. Use the Products tab to manage quarterly bonus eligibility.
                  </p>
                </div>

                {/* Target % and Sub-Weight % */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target % *
                    </label>
                    <input
                      type="number"
                      name="targetPercent"
                      defaultValue={editingBonusProduct ? (editingBonusProduct.targetPercent * 100) : ''}
                      required
                      step="0.1"
                      min="0"
                      max="100"
                      className="input w-full"
                      placeholder="10.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Target percentage for this product
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sub-Weight % *
                    </label>
                    <input
                      type="number"
                      name="subWeight"
                      defaultValue={editingBonusProduct ? (editingBonusProduct.subWeight * 100) : ''}
                      required
                      step="0.1"
                      min="0"
                      max="100"
                      className="input w-full"
                      placeholder="15.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Weight percentage in Bucket B
                    </p>
                  </div>
                </div>

                {/* MSRP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MSRP (Optional)
                  </label>
                  <input
                    type="number"
                    name="msrp"
                    defaultValue={editingBonusProduct?.msrp || ''}
                    step="0.01"
                    min="0"
                    className="input w-full"
                    placeholder="99.99"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Manufacturer&apos;s suggested retail price
                  </p>
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="active"
                    id="bonusProductActive"
                    defaultChecked={editingBonusProduct?.active !== false}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="bonusProductActive" className="ml-2 block text-sm text-gray-900">
                    Active (include in quarterly bonus calculations)
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    name="notes"
                    defaultValue={editingBonusProduct?.notes || ''}
                    rows={3}
                    className="input w-full"
                    placeholder="Additional notes about this product goal..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBonusProductModal(false);
                      setEditingBonusProduct(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editingBonusProduct ? 'Update' : 'Add'} Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#93D500] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
