'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface AdminBreadcrumbsProps {
  currentPage: string;
  parentPage?: {
    name: string;
    path: string;
  };
}

export default function AdminBreadcrumbs({ currentPage, parentPage }: AdminBreadcrumbsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(parentPage?.path || '/admin')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {parentPage?.name || 'Admin'}
        </button>
        <div className="flex items-center text-sm text-gray-600">
          <button
            onClick={() => router.push('/admin')}
            className="hover:text-gray-900 transition-colors"
          >
            Admin Panel
          </button>
          {parentPage && (
            <>
              <ChevronRight className="w-4 h-4 mx-2" />
              <button
                onClick={() => router.push(parentPage.path)}
                className="hover:text-gray-900 transition-colors"
              >
                {parentPage.name}
              </button>
            </>
          )}
          <ChevronRight className="w-4 h-4 mx-2" />
          <span className="text-gray-900 font-medium">{currentPage}</span>
        </div>
      </div>
    </div>
  );
}
