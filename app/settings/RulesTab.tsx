'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import {
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CommissionConfig, CommissionBucket, ProductSubGoal, ActivitySubGoal, RoleCommissionScale, RepRole } from '@/types';
import { validateWeightsSum } from '@/lib/commission/calculator';

interface RulesTabProps {
  selectedQuarter: string;
  isAdmin: boolean;
}

export default function RulesTab({ selectedQuarter: initialQuarter, isAdmin }: RulesTabProps) {
  const [saving, setSaving] = useState(false);
  const [rulesSubTab, setRulesSubTab] = useState<'quarterly' | 'monthly'>('quarterly');
  const [selectedQuarter, setSelectedQuarter] = useState(initialQuarter);
  const [quarters, setQuarters] = useState<string[]>(['Q4 2025', 'Q1 2026']);

  // Configuration state
  const [config, setConfig] = useState<CommissionConfig>({
    quarter: selectedQuarter,
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

  // Commission calculation rules
  const [commissionRules, setCommissionRules] = useState({
    excludeShipping: true,
    excludeCCProcessing: true,
    useOrderValue: true,
    applyReorgRule: true,
    reorgDate: '2025-07-01',
  });

  // Spiffs/Kickers state
  const [spiffs, setSpiffs] = useState<any[]>([]);
  const [showAddSpiffModal, setShowAddSpiffModal] = useState(false);
  const [editingSpiff, setEditingSpiff] = useState<any>(null);
  const [selectedSpiffProducts, setSelectedSpiffProducts] = useState<string[]>([]);

  // Products state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showAddBonusProductModal, setShowAddBonusProductModal] = useState(false);
  const [editingBonusProduct, setEditingBonusProduct] = useState<any>(null);

  const loadSettings = useCallback(async () => {
    try {
      // Load commission config for selected quarter
      const configDoc = await getDoc(doc(db, 'settings', `commission_config_${selectedQuarter.replace(/ /g, '_')}`));
      if (configDoc.exists()) {
        const loadedConfig = configDoc.data() as CommissionConfig;
        if (!loadedConfig.roleScales) {
          loadedConfig.roleScales = [
            { role: 'Sr. Account Executive', percentage: 1.00 },
            { role: 'Account Executive', percentage: 0.85 },
            { role: 'Jr. Account Executive', percentage: 0.70 },
            { role: 'Account Manager', percentage: 0.60 },
          ];
        }
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
        const defaultConfigDoc = await getDoc(doc(db, 'settings', 'commission_config'));
        if (defaultConfigDoc.exists()) {
          const defaultConfig = defaultConfigDoc.data() as CommissionConfig;
          if (!defaultConfig.roleScales) {
            defaultConfig.roleScales = [
              { role: 'Sr. Account Executive', percentage: 1.00 },
              { role: 'Account Executive', percentage: 0.85 },
              { role: 'Jr. Account Executive', percentage: 0.70 },
              { role: 'Account Manager', percentage: 0.60 },
            ];
          }
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
          salesPerson: userData.salesPerson,
          fishbowlUsername: userData.salesPerson,
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

        const allStatuses = ['new_business', '6_month_active', '12_month_active', 'transferred'];
        const allSegments = ['distributor', 'wholesale'];

        const existingRates = ratesData.rates || [];
        const completeRates = [...existingRates];

        allSegments.forEach(segmentId => {
          allStatuses.forEach(status => {
            const exists = existingRates.find((r: any) =>
              r.title === selectedTitle && r.segmentId === segmentId && r.status === status
            );

            if (!exists) {
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
      }

      // Load commission rules
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
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    }
  }, [selectedQuarter, selectedTitle]);

  useEffect(() => {
    if (selectedQuarter) {
      loadSettings();
    }
  }, [selectedQuarter, loadSettings]);

  // Load commission rates when title changes
  useEffect(() => {
    const loadRatesForTitle = async () => {
      try {
        const titleKey = selectedTitle.replace(/\s+/g, '_');
        const ratesDoc = await getDoc(doc(db, 'settings', `commission_rates_${titleKey}`));
        if (ratesDoc.exists()) {
          const ratesData = ratesDoc.data();
          setCommissionRates(ratesData);
        } else {
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
        }
      } catch (error) {
        console.error('Error loading rates for title:', error);
      }
    };

    if (selectedTitle && rulesSubTab === 'monthly') {
      loadRatesForTitle();
    }
  }, [selectedTitle, rulesSubTab]);

  // Load spiffs and products
  useEffect(() => {
    if (rulesSubTab === 'monthly' && isAdmin) {
      loadSpiffs();
      if (allProducts.length === 0) {
        loadProducts();
      }
    }
  }, [rulesSubTab, isAdmin]);

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

  const loadProducts = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
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
        const product = allProducts.find(p => p.productNum === selectedSpiffProducts[0]);
        await updateDoc(doc(db, 'spiffs', editingSpiff.id), {
          ...baseSpiffData,
          productNum: selectedSpiffProducts[0],
          productDescription: product?.productDescription || '',
        });
        toast.success('Spiff updated successfully!');
      } else {
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
    if (!confirm('Are you sure you want to delete this spiff?')) return;

    try {
      await deleteDoc(doc(db, 'spiffs', spiffId));
      toast.success('Spiff deleted successfully');
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
        updatedAt: new Date().toISOString()
      });
      toast.success(`Spiff ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadSpiffs();
    } catch (error) {
      console.error('Error toggling spiff status:', error);
      toast.error('Failed to update spiff status');
    }
  };

  const addBucket = () => {
    const newBucket: CommissionBucket = {
      id: `bucket_${Date.now()}`,
      code: String.fromCharCode(65 + config.buckets.length),
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

  const handleAddQuarter = () => {
    const newQuarter = prompt('Enter new quarter (e.g., Q2 2026):');
    if (!newQuarter) return;
    
    const quarterPattern = /^Q[1-4]\s\d{4}$/;
    if (!quarterPattern.test(newQuarter)) {
      toast.error('Invalid quarter format. Use format: Q1 2026');
      return;
    }
    
    if (quarters.includes(newQuarter)) {
      toast.error('Quarter already exists');
      return;
    }
    
    setQuarters([...quarters, newQuarter]);
    toast.success(`Quarter ${newQuarter} added successfully`);
  };

  const handleQuarterChange = (newQuarter: string) => {
    setSelectedQuarter(newQuarter);
    setConfig({ ...config, quarter: newQuarter });
  };

  const handleSaveConfig = async () => {
    const weights = config.buckets.filter(b => b.active).map(b => b.weight);
    if (!validateWeightsSum(weights)) {
      toast.error('Bucket weights must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', `commission_config_${selectedQuarter.replace(/ /g, '_')}`), config);

      await setDoc(doc(db, 'settings', 'bonus_scales'), {
        scales: config.roleScales.map(scale => ({
          role: scale.role,
          percentage: scale.percentage,
          maxBonus: config.maxBonusPerRep * scale.percentage
        })),
        maxBonusPerRep: config.maxBonusPerRep,
        updatedAt: new Date(),
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
    const activeProducts = products.filter(p => p.active);
    const subWeights = activeProducts.map(p => p.subWeight);
    if (!validateWeightsSum(subWeights)) {
      toast.error('Product sub-weights must sum to 100%');
      return;
    }

    const targetPercents = activeProducts.map(p => p.targetPercent);
    if (!validateWeightsSum(targetPercents)) {
      toast.error('Product target percentages must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      for (const product of products) {
        if (product.id.startsWith('new_')) {
          const { id, ...data } = product;
          await addDoc(collection(db, 'products'), data);
        } else {
          const { id, ...data } = product;
          await updateDoc(doc(db, 'products', id), data);
        }
      }
      toast.success('Products saved successfully');
      await loadSettings();
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error('Failed to save products');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveActivities = async () => {
    const activeActivities = activities.filter(a => a.active);
    const subWeights = activeActivities.map(a => a.subWeight);
    if (!validateWeightsSum(subWeights)) {
      toast.error('Activity sub-weights must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      for (const activity of activities) {
        if (activity.id.startsWith('new_')) {
          const { id, ...data } = activity;
          await addDoc(collection(db, 'activities'), data);
        } else {
          const { id, ...data } = activity;
          await updateDoc(doc(db, 'activities', id), data);
        }
      }
      toast.success('Activities saved successfully');
      await loadSettings();
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

  const getRateValue = (segmentId: string, status: string): number | string => {
    const rate = commissionRates.rates.find(
      (r: any) => r.title === selectedTitle && r.segmentId === segmentId && r.status === status
    );
    if (rate) return rate.percentage;

    if (status === 'new_business') {
      return segmentId === 'distributor' ? 8.0 : 10.0;
    } else if (status === '6_month_active') {
      return segmentId === 'distributor' ? 5.0 : 7.0;
    } else if (status === '12_month_active') {
      return segmentId === 'distributor' ? 3.0 : 5.0;
    } else if (status === 'transferred') {
      return 2.0;
    }
    return '';
  };

  const updateRateValue = (segmentId: string, status: string, percentage: number | string, active: boolean = true) => {
    const existingRateIndex = commissionRates.rates.findIndex(
      (r: any) => r.title === selectedTitle && r.segmentId === segmentId && r.status === status
    );

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
    } catch (error) {
      console.error('Error saving commission rules:', error);
      toast.error('Failed to save commission rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Sub-Tab Navigation */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Commission Rules</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure commission calculation rules and rates
            </p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setRulesSubTab('quarterly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                rulesSubTab === 'quarterly'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Quarterly Bonus
            </button>
            <button
              onClick={() => setRulesSubTab('monthly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                rulesSubTab === 'monthly'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Monthly Rates
            </button>
          </nav>
        </div>
      </div>

      {/* Quarterly Bonus Sub-Tab */}
      {rulesSubTab === 'quarterly' && (
        <>
          {/* Global Settings */}
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Global Settings</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddQuarter}
                  className="btn btn-secondary flex items-center"
                  title="Add new quarter for forecasting"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Quarter
                </button>
                
                <div className="flex items-center">
                  <label className="text-sm font-medium text-gray-700 mr-2">Quarter:</label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => handleQuarterChange(e.target.value)}
                    className="input w-40"
                  >
                    {quarters.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="btn btn-primary flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Config'}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Bonus Per Rep ($)
                </label>
                <input
                  type="number"
                  value={config.maxBonusPerRep}
                  onChange={(e) => setConfig({ ...config, maxBonusPerRep: Number(e.target.value) })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Over-Performance Cap (%)
                </label>
                <input
                  type="number"
                  value={config.overPerfCap * 100}
                  onChange={(e) => setConfig({ ...config, overPerfCap: Number(e.target.value) / 100 })}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">Default: 125%</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Attainment (%)
                </label>
                <input
                  type="number"
                  value={config.minAttainment * 100}
                  onChange={(e) => setConfig({ ...config, minAttainment: Number(e.target.value) / 100 })}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">Default: 75%</p>
              </div>
            </div>

            {/* Total Quarterly Bonus Budget */}
            <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Total Quarterly Bonus Budget</span>
                <p className="text-xs text-gray-500 mt-1">
                  {reps.filter(r => r.active).length} active reps × ${config.maxBonusPerRep.toLocaleString()} max bonus
                </p>
              </div>
              <span className="text-2xl font-bold text-primary-600">
                ${(config.maxBonusPerRep * reps.filter(r => r.active).length).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Role-Based Bonus Scales */}
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Role-Based Bonus Scales</h2>
              <button
                onClick={addRoleScale}
                className="btn btn-secondary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Role
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Set different bonus percentages based on rep role. Max Bonus Per Rep (${config.maxBonusPerRep.toLocaleString()}) is for Sr. Account Executive (100%).
            </p>

            <div className="space-y-3">
              {config.roleScales.map((scale, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={scale.role}
                      onChange={(e) => {
                        const newScales = [...config.roleScales];
                        newScales[index].role = e.target.value as RepRole;
                        setConfig({ ...config, roleScales: newScales });
                      }}
                      className="input"
                    >
                      <option value="Sr. Account Executive">Sr. Account Executive</option>
                      <option value="Account Executive">Account Executive</option>
                      <option value="Jr. Account Executive">Jr. Account Executive</option>
                      <option value="Account Manager">Account Manager</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Percentage of Max</label>
                    <input
                      type="number"
                      value={scale.percentage * 100}
                      onChange={(e) => {
                        const newScales = [...config.roleScales];
                        newScales[index].percentage = Number(e.target.value) / 100;
                        setConfig({ ...config, roleScales: newScales });
                      }}
                      className="input"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Bonus</label>
                    <div className="text-lg font-semibold text-primary-600">
                      ${(config.maxBonusPerRep * scale.percentage).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  <button
                    onClick={() => removeRoleScale(index)}
                    className="text-red-600 hover:text-red-800 mt-6"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quarterly Goals by Title */}
          <div className="card mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quarterly Goals by Title</h2>
            <p className="text-sm text-gray-600 mb-4">
              Set revenue and activity goals for each bucket based on rep title. These are used when calculating bonuses.
            </p>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Bucket A Goal ($)<br/><span className="text-xs font-normal text-gray-500">New Business Revenue</span></th>
                    <th>Bucket B Goal ($)<br/><span className="text-xs font-normal text-gray-500">Product Mix Revenue</span></th>
                    <th>Bucket C Goal ($)<br/><span className="text-xs font-normal text-gray-500">Maintain Business Revenue</span></th>
                    <th>Bucket D Goal (#)<br/><span className="text-xs font-normal text-gray-500">Activities Count</span></th>
                  </tr>
                </thead>
                <tbody>
                  {config.budgets?.map((budget, index) => (
                    <tr key={budget.title}>
                      <td className="font-medium">{budget.title}</td>
                      <td>
                        <input
                          type="number"
                          value={budget.bucketA}
                          onChange={(e) => {
                            const newBudgets = [...(config.budgets || [])];
                            newBudgets[index].bucketA = Number(e.target.value);
                            setConfig({ ...config, budgets: newBudgets });
                          }}
                          className="input w-full"
                          placeholder="500000"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={budget.bucketB}
                          onChange={(e) => {
                            const newBudgets = [...(config.budgets || [])];
                            newBudgets[index].bucketB = Number(e.target.value);
                            setConfig({ ...config, budgets: newBudgets });
                          }}
                          className="input w-full"
                          placeholder="100000"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={budget.bucketC}
                          onChange={(e) => {
                            const newBudgets = [...(config.budgets || [])];
                            newBudgets[index].bucketC = Number(e.target.value);
                            setConfig({ ...config, budgets: newBudgets });
                          }}
                          className="input w-full"
                          placeholder="300000"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={budget.bucketD}
                          onChange={(e) => {
                            const newBudgets = [...(config.budgets || [])];
                            newBudgets[index].bucketD = Number(e.target.value);
                            setConfig({ ...config, budgets: newBudgets });
                          }}
                          className="input w-full"
                          placeholder="50"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bonus Buckets */}
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Bonus Buckets</h2>
              <button
                onClick={addBucket}
                className="btn btn-secondary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Bucket
              </button>
            </div>

            <div className="space-y-4">
              {config.buckets.map((bucket, index) => (
                <div key={bucket.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Code
                      </label>
                      <input
                        type="text"
                        value={bucket.code}
                        onChange={(e) => {
                          const newBuckets = [...config.buckets];
                          newBuckets[index].code = e.target.value;
                          setConfig({ ...config, buckets: newBuckets });
                        }}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={bucket.name}
                        onChange={(e) => {
                          const newBuckets = [...config.buckets];
                          newBuckets[index].name = e.target.value;
                          setConfig({ ...config, buckets: newBuckets });
                        }}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (%)
                      </label>
                      <input
                        type="number"
                        value={bucket.weight * 100}
                        onChange={(e) => {
                          const newBuckets = [...config.buckets];
                          newBuckets[index].weight = Number(e.target.value) / 100;
                          setConfig({ ...config, buckets: newBuckets });
                        }}
                        className="input"
                        step="0.1"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={bucket.hasSubGoals}
                          onChange={(e) => {
                            const newBuckets = [...config.buckets];
                            newBuckets[index].hasSubGoals = e.target.checked;
                            setConfig({ ...config, buckets: newBuckets });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Has Sub-Goals</span>
                      </label>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => removeBucket(bucket.id)}
                        className="btn btn-danger w-full"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total Weight:</span>
              <span className={`text-lg font-bold ${
                Math.abs(getBucketWeightSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(getBucketWeightSum() * 100).toFixed(1)}%
              </span>
            </div>

            {Math.abs(getBucketWeightSum() - 1.0) >= 0.001 && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">Bucket weights must sum to 100%</p>
              </div>
            )}
          </div>

          {/* Product Mix Sub-Goals (Bucket B) */}
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Product Mix Sub-Goals (Bucket B)</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingBonusProduct(null);
                    setShowAddBonusProductModal(true);
                  }}
                  className="btn btn-secondary flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </button>
                <button
                  onClick={handleSaveProducts}
                  disabled={saving}
                  className="btn btn-primary flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Products
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Target %</th>
                    <th>Sub-Weight %</th>
                    <th>MSRP</th>
                    <th>Active</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr key={product.id}>
                      <td>
                        <select
                          value={product.sku || product.productNum || ''}
                          onChange={(e) => {
                            const newProducts = [...products];
                            const selectedProduct = allProducts.find(p => p.productNum === e.target.value);
                            newProducts[index].sku = e.target.value;
                            newProducts[index].productNum = e.target.value;
                            newProducts[index].productDescription = selectedProduct?.productDescription || '';
                            setProducts(newProducts);
                          }}
                          className="input"
                        >
                          <option value="">Select a product...</option>
                          {allProducts
                            .filter(p => p.isActive && p.quarterlyBonusEligible)
                            .sort((a, b) => a.productNum.localeCompare(b.productNum))
                            .map(p => (
                              <option key={p.id} value={p.productNum}>
                                {p.productNum} - {p.productDescription}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={isNaN(product.targetPercent) ? '' : (product.targetPercent || 0) * 100}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].targetPercent = Number(e.target.value) / 100;
                            setProducts(newProducts);
                          }}
                          className="input"
                          step="0.1"
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={isNaN(product.subWeight) ? '' : (product.subWeight || 0) * 100}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].subWeight = Number(e.target.value) / 100;
                            setProducts(newProducts);
                          }}
                          className="input"
                          step="0.1"
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={product.msrp || ''}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].msrp = Number(e.target.value) || undefined;
                            setProducts(newProducts);
                          }}
                          className="input"
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={product.active}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].active = e.target.checked;
                            setProducts(newProducts);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={product.notes || ''}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].notes = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="input"
                          placeholder="Optional notes"
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-md flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Target % Sum:</span>
                <span className={`text-lg font-bold ${
                  Math.abs(getProductTargetSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(getProductTargetSum() * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-md flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Sub-Weight Sum:</span>
                <span className={`text-lg font-bold ${
                  Math.abs(getProductSubWeightSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(getProductSubWeightSum() * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Effort Sub-Goals (Bucket D) */}
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Effort Sub-Goals (Bucket D)</h2>
              <div className="flex space-x-2">
                <button
                  onClick={addActivity}
                  className="btn btn-secondary flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Activity
                </button>
                <button
                  onClick={handleSaveActivities}
                  disabled={saving}
                  className="btn btn-primary flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Activities
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Goal</th>
                    <th>Sub-Weight %</th>
                    <th>Data Source</th>
                    <th>Active</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity, index) => (
                    <tr key={activity.id}>
                      <td>
                        <input
                          type="text"
                          value={activity.activity}
                          onChange={(e) => {
                            const newActivities = [...activities];
                            newActivities[index].activity = e.target.value;
                            setActivities(newActivities);
                          }}
                          className="input"
                          placeholder="Phone Calls"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={activity.goal}
                          onChange={(e) => {
                            const newActivities = [...activities];
                            newActivities[index].goal = Number(e.target.value);
                            setActivities(newActivities);
                          }}
                          className="input"
                          placeholder="100"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={activity.subWeight * 100}
                          onChange={(e) => {
                            const newActivities = [...activities];
                            newActivities[index].subWeight = Number(e.target.value) / 100;
                            setActivities(newActivities);
                          }}
                          className="input"
                          step="0.1"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={activity.dataSource}
                          onChange={(e) => {
                            const newActivities = [...activities];
                            newActivities[index].dataSource = e.target.value;
                            setActivities(newActivities);
                          }}
                          className="input"
                          placeholder="Copper/JustCall"
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={activity.active}
                          onChange={(e) => {
                            const newActivities = [...activities];
                            newActivities[index].active = e.target.checked;
                            setActivities(newActivities);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={activity.notes || ''}
                          onChange={(e) => {
                            const newActivities = [...activities];
                            newActivities[index].notes = e.target.value;
                            setActivities(newActivities);
                          }}
                          className="input"
                          placeholder="Optional notes"
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removeActivity(activity.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Sub-Weight Sum:</span>
              <span className={`text-lg font-bold ${
                Math.abs(getActivitySubWeightSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(getActivitySubWeightSum() * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Validation Summary */}
          <div className="card bg-primary-50 border-primary-200">
            <h3 className="font-semibold text-gray-900 mb-3">Validation Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                {Math.abs(getBucketWeightSum() - 1.0) < 0.001 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                )}
                <span className="text-sm">Bucket weights sum to 100%</span>
              </div>
              <div className="flex items-center">
                {Math.abs(getProductTargetSum() - 1.0) < 0.001 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                )}
                <span className="text-sm">Product target % sum to 100%</span>
              </div>
              <div className="flex items-center">
                {Math.abs(getProductSubWeightSum() - 1.0) < 0.001 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                )}
                <span className="text-sm">Product sub-weights sum to 100%</span>
              </div>
              <div className="flex items-center">
                {Math.abs(getActivitySubWeightSum() - 1.0) < 0.001 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                )}
                <span className="text-sm">Activity sub-weights sum to 100%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Monthly Rates Sub-Tab */}
      {rulesSubTab === 'monthly' && (
        <>
          {/* Commission Rate Matrix */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Monthly Commission Rates</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure commission percentages based on rep title, customer segment, and customer status
                </p>
              </div>
              <button
                onClick={handleSaveCommissionRates}
                disabled={saving}
                className="btn btn-primary flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Rates'}
              </button>
            </div>

            {/* Title Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Title to Configure
              </label>
              <select
                value={selectedTitle}
                onChange={(e) => setSelectedTitle(e.target.value)}
                className="input max-w-xs"
              >
                {commissionRates.titles.map((title: string) => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Commission rates can be configured per title. Currently showing rates for all titles.
              </p>
            </div>

            {/* Rate Matrix for Each Segment */}
            {commissionRates.segments.map((segment: any) => (
              <div key={segment.id} className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  {segment.name} Segment
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({segment.description || 'Customer segment'})
                  </span>
                </h3>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Customer Status
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Commission %
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                          Active
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          New Business
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          No orders in last 12 months
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center max-w-xs">
                            <input
                              type="number"
                              value={getRateValue(segment.id, 'new_business')}
                              onChange={(e) => updateRateValue(segment.id, 'new_business', e.target.value)}
                              step="0.1"
                              min="0"
                              max="100"
                              className="input"
                              placeholder="0.0"
                            />
                            <span className="ml-2 text-gray-600">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={commissionRates.rates.find((r: any) => r.title === selectedTitle && r.segmentId === segment.id && r.status === 'new_business')?.active ?? true}
                            onChange={(e) => updateRateValue(segment.id, 'new_business', getRateValue(segment.id, 'new_business'), e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          6-Month Active
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Ordered within last 6 months
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center max-w-xs">
                            <input
                              type="number"
                              value={getRateValue(segment.id, '6_month_active')}
                              onChange={(e) => updateRateValue(segment.id, '6_month_active', e.target.value)}
                              step="0.1"
                              min="0"
                              max="100"
                              className="input"
                              placeholder="0.0"
                            />
                            <span className="ml-2 text-gray-600">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={commissionRates.rates.find((r: any) => r.title === selectedTitle && r.segmentId === segment.id && r.status === '6_month_active')?.active ?? true}
                            onChange={(e) => updateRateValue(segment.id, '6_month_active', getRateValue(segment.id, '6_month_active'), e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          12-Month Active
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Ordered 6-12 months ago
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center max-w-xs">
                            <input
                              type="number"
                              value={getRateValue(segment.id, '12_month_active')}
                              onChange={(e) => updateRateValue(segment.id, '12_month_active', e.target.value)}
                              step="0.1"
                              min="0"
                              max="100"
                              className="input"
                              placeholder="0.0"
                            />
                            <span className="ml-2 text-gray-600">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={commissionRates.rates.find((r: any) => r.title === selectedTitle && r.segmentId === segment.id && r.status === '12_month_active')?.active ?? true}
                            onChange={(e) => updateRateValue(segment.id, '12_month_active', getRateValue(segment.id, '12_month_active'), e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 bg-orange-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          Transferred (Reorg)
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          Customer transferred during July 2025 reorg (when reorg rule is active)
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center max-w-xs">
                            <input
                              type="number"
                              value={getRateValue(segment.id, 'transferred')}
                              onChange={(e) => updateRateValue(segment.id, 'transferred', e.target.value)}
                              step="0.1"
                              min="0"
                              max="100"
                              className="input"
                              placeholder="2.0"
                            />
                            <span className="ml-2 text-gray-600">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={commissionRates.rates.find((r: any) => r.title === selectedTitle && r.segmentId === segment.id && r.status === 'transferred')?.active ?? true}
                            onChange={(e) => updateRateValue(segment.id, 'transferred', getRateValue(segment.id, 'transferred'), e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Customer Inactivity Threshold */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Customer Inactivity Threshold</h4>
              <p className="text-sm text-gray-600 mb-4">
                Customer reverts to &quot;New Business&quot; status after this many months of no orders
              </p>
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Months of Inactivity
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={commissionRates.specialRules.inactivityThreshold}
                    onChange={(e) => setCommissionRates({
                      ...commissionRates,
                      specialRules: {
                        ...commissionRates.specialRules,
                        inactivityThreshold: Number(e.target.value)
                      }
                    })}
                    min="1"
                    max="24"
                    className="input"
                    placeholder="12"
                  />
                  <span className="ml-2 text-gray-600">months</span>
                </div>
              </div>
            </div>
          </div>

          {/* Spiffs & Kickers Management */}
          <div className="card bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                  Spiffs & Kickers
                </h3>
                <p className="text-sm text-gray-600">
                  Special sales incentives for specific products
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSpiff(null);
                  setSelectedSpiffProducts([]);
                  setShowAddSpiffModal(true);
                }}
                className="btn btn-primary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Spiff
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Active</th>
                    <th>Name</th>
                    <th>Product #</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {spiffs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-gray-500 py-8">
                        No spiffs/kickers configured. Click &ldquo;Add Spiff&rdquo; to create one.
                      </td>
                    </tr>
                  ) : (
                    spiffs.map((spiff) => (
                      <tr key={spiff.id} className={!spiff.isActive ? 'opacity-50' : ''}>
                        <td>
                          <button
                            onClick={() => handleToggleSpiffActive(spiff.id, spiff.isActive)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              spiff.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {spiff.isActive ? '✓ Active' : '○ Inactive'}
                          </button>
                        </td>
                        <td className="font-medium">{spiff.name}</td>
                        <td className="text-sm font-mono">{spiff.productNum}</td>
                        <td className="text-sm">{spiff.productDescription}</td>
                        <td>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            spiff.incentiveType === 'flat'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {spiff.incentiveType === 'flat' ? 'Flat $' : 'Percentage %'}
                          </span>
                        </td>
                        <td className="font-semibold text-green-600">
                          {spiff.incentiveType === 'flat'
                            ? `$${spiff.incentiveValue.toFixed(2)}`
                            : `${spiff.incentiveValue}%`}
                        </td>
                        <td className="text-sm">{spiff.startDate}</td>
                        <td className="text-sm">{spiff.endDate || 'Ongoing'}</td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setEditingSpiff(spiff);
                                setSelectedSpiffProducts([spiff.productNum]);
                                setShowAddSpiffModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSpiff(spiff.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commission Calculation Rules */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Commission Calculation Rules</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure how commissions are calculated from Fishbowl data
                </p>
              </div>
              <button
                onClick={handleSaveCommissionRules}
                disabled={saving}
                className="btn btn-primary flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Rules'}
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="excludeShipping"
                  checked={commissionRules.excludeShipping}
                  onChange={(e) => setCommissionRules({...commissionRules, excludeShipping: e.target.checked})}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="excludeShipping" className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">Exclude Shipping from Commissions</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Line items with Product = &quot;Shipping&quot; will not count toward commission calculations
                  </p>
                </label>
              </div>

              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="excludeCCProcessing"
                  checked={commissionRules.excludeCCProcessing}
                  onChange={(e) => setCommissionRules({...commissionRules, excludeCCProcessing: e.target.checked})}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="excludeCCProcessing" className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">Exclude Credit Card Processing Fees from Commissions</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Line items with Product = &quot;CC Processing&quot; or &quot;Credit Card Processing Fee&quot; will not count toward commission calculations
                  </p>
                </label>
              </div>

              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="useOrderValue"
                  checked={commissionRules.useOrderValue}
                  onChange={(e) => setCommissionRules({...commissionRules, useOrderValue: e.target.checked})}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="useOrderValue" className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">Use Order Value (not Revenue)</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Calculate commissions based on orderValue field instead of revenue field from Fishbowl data
                  </p>
                </label>
              </div>

              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="applyReorgRule"
                  checked={commissionRules.applyReorgRule}
                  onChange={(e) => setCommissionRules({...commissionRules, applyReorgRule: e.target.checked})}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="applyReorgRule" className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">Apply July 2025 Reorg Rule (Transferred Customers = 2%)</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Customers transferred to a rep after <strong>{commissionRules.reorgDate}</strong> automatically receive 2% commission rate.
                    This rule expires January 1, 2026.
                  </p>
                  {commissionRules.applyReorgRule && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Reorg Effective Date</label>
                      <input
                        type="date"
                        value={commissionRules.reorgDate}
                        onChange={(e) => setCommissionRules({...commissionRules, reorgDate: e.target.value})}
                        className="input text-sm max-w-xs"
                      />
                    </div>
                  )}
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  These settings control how monthly commissions are calculated from imported Fishbowl data.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
