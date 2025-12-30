'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import {
  Save,
  UserPlus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SalesTeamTabProps {
  isAdmin: boolean;
}

export default function SalesTeamTab({ isAdmin }: SalesTeamTabProps) {
  const [reps, setReps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReps();
  }, []);

  const loadReps = async () => {
    try {
      const repsQuery = query(
        collection(db, 'users'),
        where('isCommissioned', '==', true)
      );
      const repsSnapshot = await getDocs(repsQuery);
      const repsData: any[] = [];
      repsSnapshot.forEach((doc) => {
        repsData.push({ id: doc.id, ...doc.data() });
      });
      setReps(repsData.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
      console.error('Error loading reps:', error);
      toast.error('Failed to load sales reps');
    }
  };

  const addRep = () => {
    const newRep = {
      id: `new_${Date.now()}`,
      name: '',
      email: '',
      title: 'Account Executive',
      salesPerson: '',
      startDate: new Date().toISOString().split('T')[0],
      active: true,
      isCommissioned: true,
      notes: '',
    };
    setReps([...reps, newRep]);
  };

  const removeRep = (repId: string) => {
    if (confirm('Are you sure you want to remove this rep?')) {
      setReps(reps.filter(r => r.id !== repId));
    }
  };

  const handleSaveReps = async () => {
    console.log('🔵 Save Reps button clicked!');
    console.log('📊 Current reps data:', reps);
    
    setSaving(true);
    const loadingToast = toast.loading('Saving sales team...');

    try {
      console.log(`📝 Starting to save ${reps.length} reps...`);
      
      for (const rep of reps) {
        console.log(`Processing rep: ${rep.name} (ID: ${rep.id})`);
        
        if (!rep.name || !rep.email) {
          console.error('❌ Validation failed: Missing name or email', rep);
          toast.error('All reps must have a name and email', { id: loadingToast });
          setSaving(false);
          return;
        }

        const repData = {
          name: rep.name,
          email: rep.email,
          title: rep.title,
          salesPerson: rep.salesPerson || '',
          startDate: rep.startDate || new Date().toISOString().split('T')[0],
          active: rep.active ?? true,
          isCommissioned: true,
          notes: rep.notes || '',
          updatedAt: new Date().toISOString(),
        };

        console.log('📤 Saving rep data:', repData);

        if (rep.id.startsWith('new_')) {
          // Create new rep
          console.log('🆕 Creating new rep...');
          const newDocRef = doc(collection(db, 'users'));
          await setDoc(newDocRef, { ...repData, createdAt: new Date().toISOString() });
          console.log('✅ New rep created with ID:', newDocRef.id);
        } else {
          // Update existing rep
          console.log('📝 Updating existing rep:', rep.id);
          await setDoc(doc(db, 'users', rep.id), repData, { merge: true });
          console.log('✅ Rep updated successfully');
        }
      }

      console.log('✅ All reps saved successfully!');
      toast.success('Sales team saved!', { id: loadingToast });
      loadReps(); // Reload to get proper IDs
    } catch (error) {
      console.error('❌ Error saving reps:', error);
      console.error('Error details:', error);
      toast.error('Failed to save sales team', { id: loadingToast });
    } finally {
      setSaving(false);
      console.log('🔵 Save operation completed');
    }
  };

  return (
    <div className="space-y-8">
      {/* Sales Team Roster */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Sales Team Roster</h2>
          <div className="flex space-x-2">
            <button
              onClick={addRep}
              className="btn btn-secondary flex items-center"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Rep
            </button>
            <button
              onClick={handleSaveReps}
              disabled={saving}
              className="btn btn-primary flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Reps
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <strong>Fishbowl Username</strong> is used for quarterly bonus calculations. 
          Must match the <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">salesPerson</code> field in Fishbowl (e.g., BenW, JaredM, BrandonG).
        </p>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title (Bonus Tier)</th>
                <th>Email</th>
                <th>
                  Fishbowl Username
                  <span className="block text-xs font-normal text-gray-500">For Bonus Calc</span>
                </th>
                <th>Start Date</th>
                <th>Active</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reps.map((rep, index) => (
                <tr key={rep.id}>
                  <td className="min-w-[150px]">
                    <input
                      type="text"
                      value={rep.name}
                      onChange={(e) => {
                        const newReps = [...reps];
                        newReps[index].name = e.target.value;
                        setReps(newReps);
                      }}
                      className="input w-full"
                      placeholder="Rep Name"
                    />
                  </td>
                  <td className="min-w-[180px]">
                    <select
                      value={rep.title}
                      onChange={(e) => {
                        const newReps = [...reps];
                        newReps[index].title = e.target.value;
                        setReps(newReps);
                      }}
                      className="input w-full"
                    >
                      <option value="Account Executive">Account Executive</option>
                      <option value="Jr. Account Executive">Jr. Account Executive</option>
                      <option value="Sr. Account Executive">Sr. Account Executive</option>
                      <option value="Account Manager">Account Manager</option>
                      <option value="Sales Manager">Sales Manager</option>
                    </select>
                  </td>
                  <td className="min-w-[200px]">
                    <input
                      type="email"
                      value={rep.email}
                      onChange={(e) => {
                        const newReps = [...reps];
                        newReps[index].email = e.target.value;
                        setReps(newReps);
                      }}
                      className="input w-full"
                      placeholder="email@kanvabotanicals.com"
                    />
                  </td>
                  <td className="min-w-[140px]">
                    <input
                      type="text"
                      value={rep.salesPerson || ''}
                      onChange={(e) => {
                        const newReps = [...reps];
                        newReps[index].salesPerson = e.target.value;
                        setReps(newReps);
                      }}
                      className="input w-full"
                      placeholder="BenW"
                    />
                  </td>
                  <td className="min-w-[140px]">
                    <input
                      type="date"
                      value={rep.startDate || ''}
                      onChange={(e) => {
                        const newReps = [...reps];
                        newReps[index].startDate = e.target.value;
                        setReps(newReps);
                      }}
                      className="input w-full"
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={rep.active ?? true}
                      onChange={(e) => {
                        const newReps = [...reps];
                        newReps[index].active = e.target.checked;
                        setReps(newReps);
                      }}
                      className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                  </td>
                  <td className="min-w-[150px]">
                    <input
                      type="text"
                      value={rep.notes || ''}
                      onChange={(e) => {
                        const newReps = [...reps];
                        newReps[index].notes = e.target.value;
                        setReps(newReps);
                      }}
                      className="input"
                      placeholder="Optional notes"
                    />
                  </td>
                  <td>
                    <button
                      onClick={() => removeRep(rep.id)}
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
          <span className="text-sm font-medium text-gray-700">Active Reps:</span>
          <span className="text-lg font-bold text-primary-600">
            {reps.filter(r => r.active).length}
          </span>
        </div>
      </div>
    </div>
  );
}
