'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  Users,
  UserPlus,
  Settings as SettingsIcon,
  Database as DatabaseIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import RegionManager from './RegionManager';
import RegionMap from './RegionMap';
import UserModal from './modals/UserModal';

interface OrgChartTabProps {
  isAdmin: boolean;
}

export default function OrgChartTab({ isAdmin }: OrgChartTabProps) {
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [selectedOrgLevel, setSelectedOrgLevel] = useState<'all' | 'executive' | 'director' | 'regional' | 'division' | 'territory' | 'rep'>('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [orgChartSubTab, setOrgChartSubTab] = useState<'team' | 'regions' | 'regionManager'>('team');

  useEffect(() => {
    loadOrgUsers();
  }, []);

  const loadOrgUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: any[] = [];
      usersSnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setOrgUsers(usersData);
    } catch (error) {
      console.error('Error loading org users:', error);
      toast.error('Failed to load organization users');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Sub-Tabs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">🏢 Organizational Structure</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage your sales organization hierarchy and territory assignments
            </p>
          </div>
          {orgChartSubTab === 'team' && (
            <button
              onClick={() => {
                setEditingUser(null);
                setShowAddUserModal(true);
              }}
              className="btn btn-primary flex items-center"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </button>
          )}
        </div>

        {/* Sub-Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setOrgChartSubTab('team')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                orgChartSubTab === 'team'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Team Members
            </button>
            <button
              onClick={() => setOrgChartSubTab('regionManager')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                orgChartSubTab === 'regionManager'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SettingsIcon className="w-4 h-4 inline mr-2" />
              Manage Regions
            </button>
            <button
              onClick={() => setOrgChartSubTab('regions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                orgChartSubTab === 'regions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DatabaseIcon className="w-4 h-4 inline mr-2" />
              Region Stats
            </button>
          </nav>
        </div>

        {/* Filter by Org Level - Only show on Team tab */}
        {orgChartSubTab === 'team' && (
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filter by Level:</label>
            <select
              value={selectedOrgLevel}
              onChange={(e) => setSelectedOrgLevel(e.target.value as any)}
              className="input"
            >
              <option value="all">All Levels</option>
              <option value="executive">Executive</option>
              <option value="director">Directors</option>
              <option value="regional">Regional Managers</option>
              <option value="division">Division Managers</option>
              <option value="territory">Territory Managers</option>
              <option value="rep">Sales Reps</option>
            </select>
          </div>
        )}
      </div>

      {/* Region Manager Sub-Tab */}
      {orgChartSubTab === 'regionManager' && (
        <RegionManager />
      )}

      {/* Regional Stats Sub-Tab */}
      {orgChartSubTab === 'regions' && (
        <RegionMap />
      )}

      {/* Users Table - Only show on Team tab */}
      {orgChartSubTab === 'team' && (
        <>
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Team Members ({orgUsers.filter(u => selectedOrgLevel === 'all' || u.orgRole === selectedOrgLevel).length})
            </h3>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Org Level</th>
                    <th>Region/Territory</th>
                    <th>Fishbowl Username</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgUsers.filter(u => selectedOrgLevel === 'all' || u.orgRole === selectedOrgLevel).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-gray-500 py-8">
                        No users found. Click &quot;Add User&quot; to get started.
                      </td>
                    </tr>
                  ) : (
                    orgUsers
                      .filter(u => selectedOrgLevel === 'all' || u.orgRole === selectedOrgLevel)
                      .map((user) => (
                        <tr key={user.id}>
                          <td className="font-medium">{user.name}</td>
                          <td className="text-sm text-gray-600">{user.email}</td>
                          <td className="text-sm">{user.title || user.role}</td>
                          <td>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.orgRole === 'executive' ? 'bg-purple-100 text-purple-800' :
                              user.orgRole === 'director' ? 'bg-blue-100 text-blue-800' :
                              user.orgRole === 'regional' ? 'bg-green-100 text-green-800' :
                              user.orgRole === 'division' ? 'bg-yellow-100 text-yellow-800' :
                              user.orgRole === 'territory' ? 'bg-orange-100 text-orange-800' :
                              user.orgRole === 'rep' ? 'bg-gray-100 text-gray-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.orgRole === 'executive' ? 'Executive' :
                               user.orgRole === 'director' ? 'Director' :
                               user.orgRole === 'regional' ? 'Regional Mgr' :
                               user.orgRole === 'division' ? 'Division Mgr' :
                               user.orgRole === 'territory' ? 'Territory Mgr' :
                               user.orgRole === 'rep' ? 'Sales Rep' : 'Unknown'}
                            </span>
                          </td>
                          <td className="text-sm text-gray-600">
                            {user.region || user.territory || user.division || '-'}
                          </td>
                          <td className="text-sm font-mono">{user.salesPerson || '-'}</td>
                          <td>
                            {user.isActive ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setShowAddUserModal(true);
                              }}
                              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-6 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold text-purple-600">{orgUsers.filter(u => u.orgRole === 'executive').length}</div>
              <div className="text-xs text-gray-600">Executive</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-blue-600">{orgUsers.filter(u => u.orgRole === 'director').length}</div>
              <div className="text-xs text-gray-600">Directors</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">{orgUsers.filter(u => u.orgRole === 'regional').length}</div>
              <div className="text-xs text-gray-600">Regional</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-yellow-600">{orgUsers.filter(u => u.orgRole === 'division').length}</div>
              <div className="text-xs text-gray-600">Division</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-orange-600">{orgUsers.filter(u => u.orgRole === 'territory').length}</div>
              <div className="text-xs text-gray-600">Territory</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-gray-600">{orgUsers.filter(u => u.orgRole === 'rep' || !u.orgRole).length}</div>
              <div className="text-xs text-gray-600">Sales Reps</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
