"use client";

import { RetailerApplication } from '@/types';
import { MapPin, Mail, Phone, Store, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  application: RetailerApplication;
  onViewDetails: (id: string) => void;
  onRefresh: () => void;
}

export default function ApplicationCard({ application, onViewDetails, onRefresh }: Props) {
  const statusBadge = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    denied: 'badge-denied',
    more_info_needed: 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium',
  };

  const statusLabel = {
    pending: 'Pending Review',
    approved: 'Approved',
    denied: 'Denied',
    more_info_needed: 'More Info Needed',
  };

  const createdAt = application.createdAt?.toDate?.() || new Date();
  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });

  return (
    <div 
      className="card hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onViewDetails(application.id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-5 h-5 text-kanva-green" />
            <h3 className="text-lg font-semibold text-gray-900">{application.businessName}</h3>
          </div>
          {application.dba && (
            <p className="text-sm text-gray-600 mb-2">DBA: {application.dba}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {application.city}, {application.state}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-4 h-4" />
              {application.email}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="w-4 h-4" />
              {application.phone}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={statusBadge[application.status]}>
            {statusLabel[application.status]}
          </span>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
      </div>

      {application.preferredProducts && application.preferredProducts.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Interested Products:</p>
          <div className="flex flex-wrap gap-2">
            {application.preferredProducts.map((product, idx) => (
              <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                {product}
              </span>
            ))}
          </div>
        </div>
      )}

      {application.status === 'pending' && (
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(application.id);
            }}
            className="flex-1 btn-kanva-outline text-sm"
          >
            📄 View Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Will open approval modal in detail page
              onViewDetails(application.id);
            }}
            className="btn-kanva text-sm flex items-center gap-1"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
