'use client';

import { useState, useEffect } from 'react';
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
  TrendingDown,
  Clock,
  BarChart3,
} from 'lucide-react';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const accountId = params.id as string;
  
  const { data: account, isLoading: loadingAccount } = useAccount(accountId);
  const contacts = useAccountContacts(accountId);
  const { data: orders = [], isLoading: loadingOrders } = useAccountOrders(accountId);
  const { data: salesSummary, isLoading: loadingSales } = useAccountSales(accountId);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'activity' | 'insights'>('activity');
  
  // Main sidebar state
  const [mainSidebarCollapsed, setMainSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Listen for main sidebar toggle events
  useEffect(() => {
    const handleSidebarToggle = (e: CustomEvent) => {
      setMainSidebarCollapsed(e.detail.isCollapsed);
    };
    window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
    return () => window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
  }, []);
  
  // Customer sales summary data
  const [customerSummary, setCustomerSummary] = useState<any>(null);
  const [loadingCustomerSummary, setLoadingCustomerSummary] = useState(false);
  
  // Handle order click - navigate to order detail page
  const handleOrderClick = (orderNumber: string) => {
    router.push(`/orders/${orderNumber}`);
  };
  
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
  
  // Load customer sales summary when insights tab is active
  useEffect(() => {
    if (activeTab === 'insights' && !customerSummary && user) {
      loadCustomerSummary();
    }
  }, [activeTab, user]);
  
  const loadCustomerSummary = async () => {
    // Try multiple ID fields to find the Fishbowl customer ID
    const customerId = account?.accountOrderId || account?.accountNumber;
    
    if (!customerId) {
      console.log('No customerId available for customer summary');
      return;
    }
    
    setLoadingCustomerSummary(true);
    try {
      console.log('Loading customer summary for customerId:', customerId);
      const response = await fetch(`/api/customer-summary?customerId=${customerId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Customer summary API error:', response.status, errorText);
        throw new Error(`Failed to load customer summary: ${response.status}`);
      }
      const data = await response.json();
      console.log('Customer summary loaded:', data);
      setCustomerSummary(data);
    } catch (error) {
      console.error('Error loading customer summary:', error);
      setCustomerSummary(null);
    } finally {
      setLoadingCustomerSummary(false);
    }
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
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

  if (loadingAccount) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
      </div>
    );
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
    <div 
      className="fixed inset-0 bg-gray-50 transition-all duration-300"
      style={{ 
        top: '64px',
        left: mainSidebarCollapsed ? '64px' : '256px'
      }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
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
                  <div className="px-4 py-2">
                    <p className="text-xs text-gray-500">No orders</p>
                    {!account?.accountOrderId && (
                      <p className="text-xs text-gray-400 mt-1">Account Order ID (cf_698467) not set</p>
                    )}
                  </div>
                ) : (
                  orders.slice(0, 5).map((order) => (
                    <div 
                      key={order.orderId} 
                      onClick={() => handleOrderClick(order.orderNumber)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-blue-600 hover:text-blue-700">{order.orderNumber}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(order.orderDate).toLocaleDateString()}
                            </p>
                          </div>
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

        {/* Center Column - Tabbed Content */}
        <div className="flex-1 bg-white overflow-y-auto">
          {/* Tabs */}
          <div className="border-b border-gray-200 px-6 pt-4">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('activity')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'activity'
                    ? 'border-[#93D500] text-[#93D500]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Activity
                </div>
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'insights'
                    ? 'border-[#93D500] text-[#93D500]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Sales Insights
                </div>
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {activeTab === 'activity' && (
              <>
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
              </>
            )}
            
            {activeTab === 'insights' && (
              <>
                {loadingCustomerSummary ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
                  </div>
                ) : customerSummary ? (
                  <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-green-700">Lifetime Value</span>
                          <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <p className="text-2xl font-bold text-green-900">{formatCurrency(customerSummary.totalSales)}</p>
                        <p className="text-xs text-green-600 mt-1">
                          YTD: {formatCurrency(customerSummary.totalSalesYTD)}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">Total Orders</span>
                          <ShoppingCart className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{customerSummary.orderCount}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          YTD: {customerSummary.orderCountYTD}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-purple-700">Avg Order Value</span>
                          <BarChart3 className="w-5 h-5 text-purple-600" />
                        </div>
                        <p className="text-2xl font-bold text-purple-900">{formatCurrency(customerSummary.avgOrderValue)}</p>
                        <p className="text-xs text-purple-600 mt-1">
                          Last: {formatCurrency(customerSummary.lastOrderAmount)}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-orange-700">Velocity</span>
                          <Clock className="w-5 h-5 text-orange-600" />
                        </div>
                        <p className="text-2xl font-bold text-orange-900">{customerSummary.velocity.toFixed(1)}</p>
                        <p className="text-xs text-orange-600 mt-1">orders/month</p>
                      </div>
                    </div>

                    {/* Trend & Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          {customerSummary.trend >= 0 ? (
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          )}
                          Ordering Trend
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">Last 90 Days</span>
                              <span className="text-xl font-bold text-gray-900">
                                {formatCurrency(customerSummary.sales_90d)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {customerSummary.orders_90d} orders
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 p-3 rounded-lg ${
                            customerSummary.trend >= 0 ? 'bg-green-50' : 'bg-red-50'
                          }`}>
                            {customerSummary.trend >= 0 ? (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                            <span className={`font-semibold ${
                              customerSummary.trend >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {customerSummary.trend >= 0 ? '+' : ''}{customerSummary.trend.toFixed(1)}%
                            </span>
                            <span className="text-sm text-gray-600">vs previous 90 days</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-[#93D500]" />
                          Recent Activity
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Last Order</span>
                            <span className="font-medium text-gray-900">
                              {customerSummary.lastOrderDate ? new Date(customerSummary.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Days Since Last Order</span>
                            <span className={`font-medium ${
                              customerSummary.daysSinceLastOrder && customerSummary.daysSinceLastOrder > 90 
                                ? 'text-red-600' 
                                : 'text-gray-900'
                            }`}>
                              {customerSummary.daysSinceLastOrder || 'N/A'} days
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">First Order</span>
                            <span className="font-medium text-gray-900">
                              {customerSummary.firstOrderDate ? new Date(customerSummary.firstOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                          <div className="pt-3 border-t">
                            <div className="text-sm text-gray-600 mb-2">Last 30 Days</div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">{customerSummary.orders_30d} orders</span>
                              <span className="font-semibold text-gray-900">{formatCurrency(customerSummary.sales_30d)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Products */}
                    {customerSummary.skuMix && customerSummary.skuMix.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Package className="w-5 h-5 text-[#93D500]" />
                          Top Products
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {customerSummary.skuMix.slice(0, 10).map((product: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-900">{product.productName}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{product.quantity}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                    {formatCurrency(product.revenue)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{product.orderCount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No sales insights available</p>
                    <p className="text-xs text-gray-400 mt-1">Sales data is being processed and will appear here soon</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column - Account Fields */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Sales Metrics */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Metrics</h3>
              {loadingSales ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#93D500]"></div>
                </div>
              ) : salesSummary ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500">Total Revenue</span>
                    <p className="text-lg font-bold text-gray-900">
                      ${(salesSummary.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Total Orders</span>
                    <p className="text-lg font-bold text-gray-900">
                      {salesSummary.totalOrders || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Avg Order Value</span>
                    <p className="text-lg font-bold text-gray-900">
                      ${(salesSummary.averageOrderValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  {salesSummary.lastOrderDate && (
                    <div>
                      <span className="text-xs text-gray-500">Last Order</span>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(salesSummary.lastOrderDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ) : !account?.accountOrderId ? (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-500">No Account Order ID</p>
                  <p className="text-xs text-gray-400 mt-1">Link account to Fishbowl to see metrics</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-500">No sales data</p>
                </div>
              )}
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
