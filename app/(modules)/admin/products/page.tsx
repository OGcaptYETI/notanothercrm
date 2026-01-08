'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import ProductsTab from '@/app/settings/ProductsTab';

export default function AdminProductsPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  useEffect(() => {
    if (user && userProfile?.role !== 'admin') {
      router.push('/');
    }
  }, [user, userProfile, router]);

  if (!user || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (userProfile.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs currentPage="Product Management" />
      <ProductsTab isAdmin={true} />
    </div>
  );
}
