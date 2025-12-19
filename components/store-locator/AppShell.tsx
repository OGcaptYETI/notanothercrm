'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  Store, 
  Settings, 
  Database, 
  FileText, 
  Home,
  LogOut,
  Upload,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AppShellProps {
  children: React.ReactNode;
}

// Separate component for search params to use with Suspense
function SearchParamsProvider({ onQueryChange }: { onQueryChange: (query: string) => void }) {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Preserve query params for Copper iframe
    let query = '';
    try {
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      const hasParams = searchParams && Array.from(searchParams.keys()).length > 0;
      if (inIframe && hasParams) {
        const qs = searchParams.toString();
        query = qs ? `?${qs}` : '';
      }
    } catch {
      // ignore cross-origin checks
    }
    onQueryChange(query);
  }, [searchParams, onQueryChange]);
  
  return null;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userData, isAdmin } = useAuth();
  const [query, setQuery] = useState('');

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/login');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const isActive = (path: string) => pathname === path;

  // Don't show AppShell on login page
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Search params handler with Suspense */}
      <Suspense fallback={null}>
        <SearchParamsProvider onQueryChange={setQuery} />
      </Suspense>
      
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Brand */}
            <Link href={`/${query}`} className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-primary-600 text-white grid place-items-center group-hover:scale-105 transition-transform shadow-md">
                <Store className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-gray-900">Retailer Onboarding</p>
                <p className="text-xs text-gray-500">KanvaPortal</p>
              </div>
            </Link>

            {/* Navigation */}
            {user && (
              <nav className="flex items-center gap-2">
                <Link
                  href={`/${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive('/')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Home className="w-4 h-4" /> Dashboard
                </Link>

                {isAdmin && (
                  <Link
                    href={`/stores${query}`}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive('/stores')
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <MapPin className="w-4 h-4" /> Stores
                  </Link>
                )}

                {/* User Menu */}
                <div className="ml-4 pl-4 border-l border-gray-200 flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">
                      {userData?.name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isAdmin ? 'Admin' : 'Sales Rep'}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Kanva Botanicals / CWL Brands</span>
          <span className="text-gray-400">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
