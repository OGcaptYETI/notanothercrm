'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useContacts, useAccount } from '@/lib/crm/hooks';
import { 
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  Edit,
  ExternalLink,
  Calendar,
  FileText,
} from 'lucide-react';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const contactId = params.id as string;
  
  const { data: contactsData } = useContacts();
  const contact = contactsData?.data?.find((c: any) => c.id === contactId);
  const { data: account } = useAccount(contact?.accountId || null);

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

  if (!contact) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </button>
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Contact Not Found</h2>
          <p className="text-gray-500 mt-2">This contact may have been deleted or does not exist.</p>
        </div>
      </div>
    );
  }

  const sourceColors: Record<string, string> = {
    copper_person: 'bg-orange-100 text-orange-700',
    manual: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-500" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {contact.firstName} {contact.lastName}
                </h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${sourceColors[contact.source] || 'bg-gray-100'}`}>
                  {contact.source === 'copper_person' ? 'Copper' : contact.source}
                </span>
              </div>
              {contact.title && (
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                  <Briefcase className="w-4 h-4" />
                  {contact.title}
                </p>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/contacts/${contactId}/edit`)}
          className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Edit Contact
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Contact Info */}
        <div className="col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[#93D500]" />
              Contact Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-gray-700 hover:text-[#93D500]">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-gray-700 hover:text-[#93D500]">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {contact.email}
                </a>
              )}
              {(contact.city || contact.state) && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {contact.street && <span>{contact.street}, </span>}
                  {contact.city && <span>{contact.city}, </span>}
                  {contact.state}
                </div>
              )}
            </div>
          </div>

          {/* Associated Account(s) */}
          {(account || contact.accountId) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#93D500]" />
                Associated Account
              </h2>
              {account ? (
                <div
                  onClick={() => router.push(`/accounts/${account.id}`)}
                  className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                        <Building2 className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{account.name || 'Unknown Account'}</p>
                        {account.accountNumber && (
                          <p className="text-sm text-gray-500">Account #{account.accountNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Orders</p>
                        <p className="font-semibold text-gray-900">{account.totalOrders || 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Spent</p>
                        <p className="font-semibold text-gray-900">
                          ${(account.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <ExternalLink className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  {(account.shippingCity || account.shippingState) && (
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {account.shippingCity && `${account.shippingCity}, `}{account.shippingState}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">Loading account data...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700"
                >
                  <Phone className="w-4 h-4 text-[#93D500]" />
                  Call Contact
                </a>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700"
                >
                  <Mail className="w-4 h-4 text-[#93D500]" />
                  Send Email
                </a>
              )}
              <button className="w-full flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700">
                <Calendar className="w-4 h-4 text-[#93D500]" />
                Schedule Meeting
              </button>
              <button className="w-full flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700">
                <FileText className="w-4 h-4 text-[#93D500]" />
                Add Note
              </button>
            </div>
          </div>

          {/* Copper Info */}
          {contact.copperId && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Copper Info</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Copper ID</span>
                  <p className="font-mono text-gray-900">{contact.copperId}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
