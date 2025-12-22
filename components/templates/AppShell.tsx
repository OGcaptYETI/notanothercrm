'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  Settings, 
  Home, 
  Users,
  LayoutGrid,
  Building2,
  UserPlus,
  Kanban,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import UserMenu from '@/components/layout/UserMenu';

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
  const { user } = useAuth();
  const [query, setQuery] = useState('');

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Search params handler with Suspense */}
      <Suspense fallback={null}>
        <SearchParamsProvider onQueryChange={setQuery} />
      </Suspense>
      
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Brand */}
            <Link href={`/${query}`} className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-primary-600 text-white grid place-items-center group-hover:scale-105 transition-transform shadow-md">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-gray-900">KanvaPortal</p>
                <p className="text-xs text-gray-500">Kanva Botanicals</p>
              </div>
            </Link>

            {/* CRM Navigation */}
            {user && (
              <nav className="flex items-center gap-1">
                <Link
                  href={`/dashboard${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/dashboard')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Home className="w-4 h-4" /> Feed
                </Link>

                <Link
                  href={`/accounts${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname?.startsWith('/accounts')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Building2 className="w-4 h-4" /> Accounts
                </Link>

                <Link
                  href={`/contacts${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname?.startsWith('/contacts')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-4 h-4" /> Contacts
                </Link>

                <Link
                  href={`/prospects${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname?.startsWith('/prospects')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> Prospects
                </Link>

                <Link
                  href={`/pipelines${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname?.startsWith('/pipelines')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Kanban className="w-4 h-4" /> Pipeline
                </Link>

                <Link
                  href={`/stores${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname?.startsWith('/stores')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MapPin className="w-4 h-4" /> Stores
                </Link>
              </nav>
            )}

            {/* User Menu */}
            {user && (
              <div className="ml-auto">
                <UserMenu query={query} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      {user && <Sidebar query={query} />}

      {/* Main Content */}
      <main className={`${user ? 'ml-64 pl-8' : ''} py-8 transition-all duration-300`}>
        <div className="px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
