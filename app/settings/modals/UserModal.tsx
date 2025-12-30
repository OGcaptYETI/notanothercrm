'use client';

import { db } from '@/lib/firebase/config';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: any | null;
  onSaved: () => void;
}

export default function UserModal({
  isOpen,
  onClose,
  editingUser,
  onSaved
}: UserModalProps) {
  if (!isOpen) return null;

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('🔵 User Modal: Save button clicked!');
    console.log('📝 Editing user:', editingUser);
    
    const formData = new FormData(e.currentTarget);
    const userData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
      orgRole: formData.get('orgRole') as string,
      title: formData.get('title') as string,
      salesPerson: formData.get('salesPerson') as string,
      region: formData.get('region') as string,
      regionalTerritory: formData.get('regionalTerritory') as string,
      division: formData.get('division') as string,
      territory: formData.get('territory') as string,
      isActive: formData.get('isActive') === 'true',
      isCommissioned: formData.get('isCommissioned') === 'true',
      updatedAt: new Date(),
    };

    console.log('📤 User data to save:', userData);

    try {
      if (editingUser) {
        console.log('📝 Updating existing user:', editingUser.id);
        await updateDoc(doc(db, 'users', editingUser.id), userData);
        console.log('✅ User updated successfully in Firestore');
        toast.success('User updated successfully!');
      } else {
        console.log('🆕 Creating new user...');
        const newDoc = await addDoc(collection(db, 'users'), {
          ...userData,
          createdAt: new Date(),
        });
        console.log('✅ New user created with ID:', newDoc.id);
        toast.success('User added successfully!');
      }
      console.log('🔄 Calling onSaved callback...');
      onSaved();
      console.log('🚪 Closing modal...');
      onClose();
    } catch (error) {
      console.error('❌ Error saving user:', error);
      console.error('Error details:', error);
      toast.error('Failed to save user');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveUser}>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingUser?.name || ''}
                    required
                    className="input w-full"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingUser?.email || ''}
                    required
                    className="input w-full"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organizational Level *
                  </label>
                  <select
                    name="orgRole"
                    defaultValue={editingUser?.orgRole || 'rep'}
                    required
                    className="input w-full"
                  >
                    <option value="executive">Executive</option>
                    <option value="director">Director</option>
                    <option value="regional">Regional Manager</option>
                    <option value="division">Division Manager</option>
                    <option value="territory">Territory Manager</option>
                    <option value="rep">Sales Rep</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    defaultValue={editingUser?.title || ''}
                    className="input w-full"
                    placeholder="Account Executive"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fishbowl Username
                </label>
                <input
                  type="text"
                  name="salesPerson"
                  defaultValue={editingUser?.salesPerson || ''}
                  className="input w-full"
                  placeholder="BenW"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must match the salesPerson field in Fishbowl for commission calculations
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Geographic Assignment</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Region
                    </label>
                    <select name="region" defaultValue={editingUser?.region || ''} className="input w-full">
                      <option value="">None</option>
                      <option value="HQ">HQ (Home Office)</option>
                      <option value="West">West</option>
                      <option value="East">East</option>
                      <option value="Central">Central</option>
                      <option value="South East">South East</option>
                      <option value="South West">South West</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Regional Territory
                    </label>
                    <input
                      type="text"
                      name="regionalTerritory"
                      defaultValue={editingUser?.regionalTerritory || ''}
                      className="input w-full"
                      placeholder="Pacific Northwest"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Division
                    </label>
                    <input
                      type="text"
                      name="division"
                      defaultValue={editingUser?.division || ''}
                      className="input w-full"
                      placeholder="Boise"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Territory Number
                    </label>
                    <input
                      type="text"
                      name="territory"
                      defaultValue={editingUser?.territory || ''}
                      className="input w-full"
                      placeholder="01"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Role
                </label>
                <select
                  name="role"
                  defaultValue={editingUser?.role || 'sales'}
                  className="input w-full"
                >
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={editingUser?.isActive !== false}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Active User
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isCommissioned"
                    value="true"
                    defaultChecked={editingUser?.isCommissioned !== false}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Eligible for Commissions
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingUser ? 'Update User' : 'Add User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
