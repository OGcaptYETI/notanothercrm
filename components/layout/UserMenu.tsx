'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface UserMenuProps {
  query?: string;
}

export default function UserMenu({ query = '' }: UserMenuProps) {
  const { user, userProfile, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    try {
      const { auth } = await import('@/lib/firebase/config');
      const { signOut } = await import('firebase/auth');
      if (auth) {
        await signOut(auth);
        toast.success('Signed out successfully');
        window.location.href = '/';
      }
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const userPhotoURL = user.photoURL;
  const userName = userProfile?.name || user.displayName || user.email?.split('@')[0] || 'User';
  const userRole = isAdmin ? 'Admin' : userProfile?.role || 'Sales Rep';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
      >
        {/* User Photo */}
        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {userPhotoURL ? (
            <Image
              src={userPhotoURL}
              alt={userName}
              width={36}
              height={36}
              className="object-cover"
            />
          ) : (
            <Image
              src="/images/favicon.ico"
              alt={userName}
              width={36}
              height={36}
              className="object-cover"
            />
          )}
        </div>

        {/* User Info */}
        <div className="text-left hidden md:block">
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs text-gray-500">{userRole}</p>
        </div>

        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>

          {isAdmin && (
            <Link
              href={`/admin${query}`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Admin
            </Link>
          )}

          <Link
            href={`/settings${query}`}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>

          <button
            onClick={() => {
              setIsOpen(false);
              handleSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
