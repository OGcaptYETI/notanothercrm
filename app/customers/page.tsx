'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Users } from 'lucide-react';
import Image from 'next/image';
import CustomersTab from '@/app/settings/CustomersTab';

export default function CustomersPage() {
  const router = useRouter();
  const { user, userProfile, isAdmin, loading: authLoading } = useAuth();
  const [reps, setReps] = useState<any[]>([]);
  const [loadingReps, setLoadingReps] = useState(true);

  // Load reps for the CustomersTab component
  useEffect(() => {
    const loadReps = async () => {
      if (!user) return;
      
      try {
        const usersQuery = query(
          collection(db, 'users'),
          where('isCommissioned', '==', true)
        );
        const snapshot = await getDocs(usersQuery);
        const repsData: any[] = [];
        snapshot.forEach((doc) => {
          repsData.push({ id: doc.id, ...doc.data() });
        });
        setReps(repsData);
      } catch (error) {
        console.error('Error loading reps:', error);
      } finally {
        setLoadingReps(false);
      }
    };

    if (user) {
      loadReps();
    }
  }, [user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading || loadingReps) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Image 
            src="/images/kanva_logo_rotate.gif" 
            alt="Loading..." 
            width={64}
            height={64}
            className="mx-auto"
            unoptimized
          />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
            <p className="text-gray-600">Manage customer data and visualize geographic distribution</p>
          </div>
        </div>
      </div>

      {/* CustomersTab Component */}
      <CustomersTab isAdmin={isAdmin} reps={reps} />
    </>
  );
}
