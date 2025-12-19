import { ApplicationStats } from '@/types';
import { Clock, CheckCircle, XCircle, TrendingUp, MapPin } from 'lucide-react';

interface StoreStats {
  totalOnLocator: number;
  recentStores: number;
  previousStores: number;
  percentageChange: number;
}

interface Props {
  stats: ApplicationStats;
  storeStats?: StoreStats | null;
}

export default function StatsBar({ stats, storeStats }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Pending</h3>
          <Clock className="w-5 h-5 text-yellow-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
        <p className="text-xs text-gray-600 mt-1">Awaiting review</p>
      </div>

      <div className="card bg-gradient-to-br from-green-50 to-green-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Approved</h3>
          <CheckCircle className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.approved}</p>
        <p className="text-xs text-gray-600 mt-1">Ready to onboard</p>
      </div>

      <div className="card bg-gradient-to-br from-red-50 to-red-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Denied</h3>
          <XCircle className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.denied}</p>
        <p className="text-xs text-gray-600 mt-1">Not qualified</p>
      </div>

      <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Total</h3>
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        <p className="text-xs text-gray-600 mt-1">All applications</p>
      </div>

      <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Store Locator</h3>
          <MapPin className="w-5 h-5 text-purple-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{storeStats?.totalOnLocator || 0}</p>
        <div className="flex items-center gap-1 mt-1">
          <p className="text-xs text-gray-600">Active locations</p>
          {storeStats && storeStats.percentageChange !== 0 && (
            <span className={`text-xs font-medium ${storeStats.percentageChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {storeStats.percentageChange > 0 ? '+' : ''}{storeStats.percentageChange}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
