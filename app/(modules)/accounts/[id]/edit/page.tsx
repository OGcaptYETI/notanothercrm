'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useAccount } from '@/lib/crm/hooks';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  ArrowLeft,
  Building2,
  Save,
  X,
} from 'lucide-react';

export default function AccountEditPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const accountId = params.id as string;
  
  const { data: account, isLoading: loadingAccount } = useAccount(accountId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    accountNumber: '',
    phone: '',
    email: '',
    website: '',
    shippingStreet: '',
    shippingCity: '',
    shippingState: '',
    shippingZip: '',
    region: '',
    segment: '',
    customerPriority: '',
    accountType: [] as string[],
    businessModel: '',
    organizationLevel: '',
    paymentTerms: '',
    shippingTerms: '',
    carrierName: '',
    salesPerson: '',
    status: 'active' as 'active' | 'inactive' | 'prospect' | 'churned',
    notes: '',
  });

  // Load account data into form
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        accountNumber: account.accountNumber || '',
        phone: account.phone || '',
        email: account.email || '',
        website: account.website || '',
        shippingStreet: account.shippingStreet || '',
        shippingCity: account.shippingCity || '',
        shippingState: account.shippingState || '',
        shippingZip: account.shippingZip || '',
        region: account.region || '',
        segment: account.segment || '',
        customerPriority: account.customerPriority || '',
        accountType: account.accountType || [],
        businessModel: account.businessModel || '',
        organizationLevel: account.organizationLevel || '',
        paymentTerms: account.paymentTerms || '',
        shippingTerms: account.shippingTerms || '',
        carrierName: account.carrierName || '',
        salesPerson: account.salesPerson || '',
        status: account.status || 'active',
        notes: account.notes || '',
      });
    }
  }, [account]);

  if (authLoading || loadingAccount) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!account) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Account Not Found</h2>
          <p className="text-gray-500 mt-2">This account may have been deleted or does not exist.</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      accountType: prev.accountType.includes(type)
        ? prev.accountType.filter(t => t !== type)
        : [...prev.accountType, type]
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Account name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Determine which collection to update based on account source
      const collection = account.source === 'copper' ? 'copper_companies' : 'fishbowl_customers';
      const accountRef = doc(db, collection, accountId);
      
      // Prepare update data based on collection type
      let updateData: any = {
        updatedAt: new Date(),
      };
      
      if (account.source === 'copper') {
        // Update Copper fields
        updateData = {
          ...updateData,
          name: formData.name,
          phone_numbers: formData.phone ? [{ number: formData.phone, category: 'work' }] : [],
          email: formData.email,
          websites: formData.website ? [{ url: formData.website, category: 'work' }] : [],
          address: {
            street: formData.shippingStreet,
            city: formData.shippingCity,
            state: formData.shippingState,
            postal_code: formData.shippingZip,
          },
          // Custom fields - store as both raw ID and readable value
          'Region cf_680701': formData.region,
          'Segment cf_680704': formData.segment,
          'Account Type cf_675914': formData.accountType,
          'Payment Terms cf_680706': formData.paymentTerms,
          'Shipping Terms cf_680707': formData.shippingTerms,
          'Carrier cf_680708': formData.carrierName,
          'Sales Person cf_680709': formData.salesPerson,
        };
      } else {
        // Update Fishbowl fields
        updateData = {
          ...updateData,
          name: formData.name,
          accountNumber: formData.accountNumber,
          phone: formData.phone,
          email: formData.email,
          website: formData.website,
          shippingAddress: formData.shippingStreet,
          shippingCity: formData.shippingCity,
          shippingState: formData.shippingState,
          shippingZip: formData.shippingZip,
          region: formData.region,
          segment: formData.segment,
          customerPriority: formData.customerPriority,
          accountType: formData.accountType,
          businessModel: formData.businessModel,
          organizationLevel: formData.organizationLevel,
          paymentTerms: formData.paymentTerms,
          shippingTerms: formData.shippingTerms,
          carrierName: formData.carrierName,
          salesPerson: formData.salesPerson,
          notes: formData.notes,
        };
      }
      
      await updateDoc(accountRef, updateData);

      // Navigate back to account details
      router.push(`/accounts/${accountId}`);
    } catch (err) {
      console.error('Error updating account:', err);
      setError('Failed to save account. Please try again.');
      setSaving(false);
    }
  };

  const accountTypes = ['Wholesale', 'Retail', 'Distributor', 'Independent'];
  const regions = ['Pacific Northwest', 'South Central', 'Southeast', 'Northeast', 'Mountain', 'Southwest'];
  const segments = ['Smoke & Vape', 'Convenience Store', 'Grocery', 'Specialty Retail'];
  const statuses: Array<'active' | 'inactive' | 'prospect' | 'churned'> = ['active', 'inactive', 'prospect', 'churned'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Edit Account</h1>
              <p className="text-sm text-gray-500 mt-1">{account.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-5xl mx-auto p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                  placeholder="https://"
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  name="shippingStreet"
                  value={formData.shippingStreet}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="shippingCity"
                  value={formData.shippingCity}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="shippingState"
                  value={formData.shippingState}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                  maxLength={2}
                  placeholder="CA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input
                  type="text"
                  name="shippingZip"
                  value={formData.shippingZip}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Account Classification */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Classification</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  name="region"
                  value={formData.region}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                >
                  <option value="">Select Region</option>
                  {regions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segment</label>
                <select
                  name="segment"
                  value={formData.segment}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                >
                  <option value="">Select Segment</option>
                  {segments.map(segment => (
                    <option key={segment} value={segment}>{segment}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Priority</label>
                <select
                  name="customerPriority"
                  value={formData.customerPriority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                >
                  <option value="">Select Priority</option>
                  <option value="1">P1 - High</option>
                  <option value="2">P2 - Medium</option>
                  <option value="3">P3 - Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Model</label>
                <input
                  type="text"
                  name="businessModel"
                  value={formData.businessModel}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Level</label>
                <input
                  type="text"
                  name="organizationLevel"
                  value={formData.organizationLevel}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
                <div className="flex flex-wrap gap-2">
                  {accountTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAccountTypeChange(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.accountType.includes(type)
                          ? 'bg-[#93D500] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Shipping */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Terms & Shipping</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <input
                  type="text"
                  name="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                  placeholder="Net 30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Terms</label>
                <input
                  type="text"
                  name="shippingTerms"
                  value={formData.shippingTerms}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                  placeholder="FOB"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name</label>
                <input
                  type="text"
                  name="carrierName"
                  value={formData.carrierName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Person</label>
                <input
                  type="text"
                  name="salesPerson"
                  value={formData.salesPerson}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none resize-none"
              placeholder="Add any additional notes about this account..."
            />
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 mt-6 -mx-6 flex items-center justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
