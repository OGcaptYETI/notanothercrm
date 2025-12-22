'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useAccount, useAccountContacts, useAccountOrders, useAccountSales } from '@/lib/crm/hooks';
import { 
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  DollarSign,
  ShoppingCart,
  Calendar,
  User,
  FileText,
  Package,
  TrendingUp,
  Edit,
  ExternalLink,
  Users,
  Briefcase,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Activity,
  Plus,
} from 'lucide-react';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const accountId = params.id as string;
  
  const account = useAccount(accountId);
  const contacts = useAccountContacts(accountId);
  const { data: orders = [], isLoading: loadingOrders } = useAccountOrders(accountId);
  const { data: salesSummary, isLoading: loadingSales } = useAccountSales(accountId);
  
  // Collapsible sections state
  const [sectionsOpen, setSectionsOpen] = useState({
    info: true,
    contacts: true,
    orders: true,
    tasks: false,
    files: false,
  });
  
  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (authLoading) {
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
          Back to Accounts
        </button>
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Account Not Found</h2>
          <p className="text-gray-500 mt-2">This account may have been deleted or does not exist.</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    prospect: 'bg-blue-100 text-blue-700',
    churned: 'bg-red-100 text-red-700',
  };

  const sourceColors: Record<string, string> = {
    fishbowl: 'bg-purple-100 text-purple-700',
    copper: 'bg-orange-100 text-orange-700',
    manual: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
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
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-gray-400" />
                <h1 className="text-xl font-bold text-gray-900">{account.name}</h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[account.status] || 'bg-gray-100'}`}>
                  {account.status}
                </span>
              </div>
              {account.accountNumber && (
                <p className="text-xs text-gray-500 ml-10 mt-1">Account #{account.accountNumber}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/accounts/${accountId}/edit`)}
            className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2 text-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Collapsible Sections */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          {/* Account Info Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('info')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <span className="text-sm font-semibold text-gray-700">Account Info</span>
              {sectionsOpen.info ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {sectionsOpen.info && (
              <div className="px-4 pb-4 space-y-3 text-sm">
                {account.phone && (
                  <div>
                    <span className="text-gray-500 text-xs">Phone</span>
                    <a href={`tel:${account.phone}`} className="block text-gray-900 hover:text-[#93D500]">
                      {account.phone}
                    </a>
                  </div>
                )}
                {account.email && (
                  <div>
                    <span className="text-gray-500 text-xs">Email</span>
                    <a href={`mailto:${account.email}`} className="block text-gray-900 hover:text-[#93D500] truncate">
                      {account.email}
                    </a>
                  </div>
                )}
                {account.website && (
                  <div>
                    <span className="text-gray-500 text-xs">Website</span>
                    <a href={account.website} target="_blank" rel="noopener noreferrer" className="block text-gray-900 hover:text-[#93D500] truncate">
                      {account.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {(account.shippingStreet || account.shippingCity) && (
                  <div>
                    <span className="text-gray-500 text-xs">Address</span>
                    <div className="text-gray-900">
                      {account.shippingStreet && <div>{account.shippingStreet}</div>}
                      <div>
                        {account.shippingCity && `${account.shippingCity}, `}
                        {account.shippingState} {account.shippingZip}
                      </div>
                    </div>
                  </div>
                )}
                {account.salesPerson && (
                  <div>
                    <span className="text-gray-500 text-xs">Sales Rep</span>
                    <div className="text-gray-900">{account.salesPerson}</div>
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Contacts Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('contacts')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <span className="text-sm font-semibold text-gray-700">Contacts ({contacts.length})</span>
              {sectionsOpen.contacts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {sectionsOpen.contacts && (
              <div className="pb-2">
                {contacts.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-gray-500">No contacts</p>
                ) : (
                  <>
                    {/* Primary Contact First */}
                    {contacts.filter((c: any) => c.isPrimaryContact).map((contact: any) => (
                      <div
                        key={contact.id}
                        onClick={() => router.push(`/contacts/${contact.id}`)}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer bg-blue-50/50 border-l-2 border-blue-500"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {contact.firstName} {contact.lastName}
                              </p>
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                                Primary
                              </span>
                            </div>
                            {contact.title && (
                              <p className="text-xs text-gray-600 truncate">{contact.title}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Other Contacts */}
                    {contacts.filter((c: any) => !c.isPrimaryContact).map((contact: any) => (
                      <div
                        key={contact.id}
                        onClick={() => router.push(`/contacts/${contact.id}`)}
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.title && (
                              <p className="text-xs text-gray-500 truncate">{contact.title}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <button className="w-full px-4 py-2 text-xs text-[#93D500] hover:bg-gray-50 text-left flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Add Contact
                </button>
              </div>
            )}
          </div>

          {/* Sales Orders Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('orders')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <span className="text-sm font-semibold text-gray-700">Sales Orders ({orders.length})</span>
              {sectionsOpen.orders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {sectionsOpen.orders && (
              <div className="pb-2">
                {loadingOrders ? (
                  <div className="px-4 py-4 flex justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#93D500]"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-gray-500">No orders</p>
                ) : (
                  orders.slice(0, 5).map((order) => (
                    <div key={order.orderId} className="px-4 py-2 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{order.orderNumber}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          ${order.total.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {orders.length > 5 && (
                  <p className="px-4 py-2 text-xs text-gray-500">+{orders.length - 5} more</p>
                )}
              </div>
            )}
          </div>
          
          {/* Tasks Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('tasks')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <span className="text-sm font-semibold text-gray-700">Tasks (0)</span>
              {sectionsOpen.tasks ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {sectionsOpen.tasks && (
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-500 py-2">No tasks</p>
                <button className="text-xs text-[#93D500] hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Add Task
                </button>
              </div>
            )}
          </div>
          
          {/* Files Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('files')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <span className="text-sm font-semibold text-gray-700">Files (0)</span>
              {sectionsOpen.files ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {sectionsOpen.files && (
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-500 py-2">No files</p>
                <button className="text-xs text-[#93D500] hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Add File
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center Column - Activity Feed */}
        <div className="flex-1 bg-white overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Activity</h2>
              <button className="px-3 py-1.5 text-sm text-[#93D500] border border-[#93D500] rounded-lg hover:bg-[#93D500]/10">
                Create Note
              </button>
            </div>
            
            {/* Activity Timeline */}
            <div className="space-y-4">
              {orders.slice(0, 10).map((order, idx) => (
                <div key={order.orderId} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-4 h-4 text-green-600" />
                    </div>
                    {idx < orders.slice(0, 10).length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order {order.orderNumber}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(order.orderDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          ${order.total.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">Status: {order.status}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {orders.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No activity yet</p>
                  <p className="text-xs text-gray-400 mt-1">Activity will appear here as you interact with this account</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Account Fields */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Sales Metrics */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Metrics</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-500">Total Revenue</span>
                  <p className="text-lg font-bold text-gray-900">
                    ${(account.totalSpent || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Total Orders</span>
                  <p className="text-lg font-bold text-gray-900">
                    {account.totalOrders || 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Avg Order Value</span>
                  <p className="text-lg font-bold text-gray-900">
                    ${account.totalOrders && account.totalSpent
                      ? (account.totalSpent / account.totalOrders).toLocaleString(undefined, { maximumFractionDigits: 0 })
                      : '0'}
                  </p>
                </div>
                {account.lastOrderDate && (
                  <div>
                    <span className="text-xs text-gray-500">Last Order</span>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(account.lastOrderDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Account Fields */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Account Details</h3>
              <div className="space-y-3 text-sm">
                {account.region && (
                  <div>
                    <span className="text-xs text-gray-500">Region</span>
                    <p className="text-gray-900">{account.region}</p>
                  </div>
                )}
                {account.segment && (
                  <div>
                    <span className="text-xs text-gray-500">Segment</span>
                    <p className="text-gray-900">{account.segment}</p>
                  </div>
                )}
                {account.accountType && account.accountType.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">Account Type</span>
                    <p className="text-gray-900">{account.accountType.join(', ')}</p>
                  </div>
                )}
                {account.paymentTerms && (
                  <div>
                    <span className="text-xs text-gray-500">Payment Terms</span>
                    <p className="text-gray-900">{account.paymentTerms}</p>
                  </div>
                )}
                {account.shippingTerms && (
                  <div>
                    <span className="text-xs text-gray-500">Shipping Terms</span>
                    <p className="text-gray-900">{account.shippingTerms}</p>
                  </div>
                )}
                {account.carrierName && (
                  <div>
                    <span className="text-xs text-gray-500">Carrier</span>
                    <p className="text-gray-900">{account.carrierName}</p>
                  </div>
                )}
              </div>
            </div>

            
            {/* Notes */}
            {account.notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
                <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{account.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
