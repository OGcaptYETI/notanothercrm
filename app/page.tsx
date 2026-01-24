'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import Image from 'next/image';
import { BarChart3, Users, Package, FileText, TrendingUp, ShoppingCart } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      if (user) {
        // Keep loading true while redirecting
        router.push('/dashboard');
      } else {
        // Only set loading false if no user (show login page)
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#93D500]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#17351A]/30 rounded-full blur-3xl"></div>
        <div className="text-center relative z-10">
          <Image 
            src="/images/kanva_logo_rotate.gif" 
            alt="Loading..." 
            width={64}
            height={64}
            className="mx-auto mb-4"
            priority
            unoptimized
          />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#93D500]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#17351A]/30 rounded-full blur-3xl"></div>
      
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 relative z-10">
        {/* Logo - Large and Centered */}
        <div className="mb-10 text-center">
          <Image 
            src="/images/kanva-logo.png" 
            alt="Kanva Botanicals" 
            width={400} 
            height={150}
            className="h-36 w-auto mx-auto drop-shadow-[0_0_30px_rgba(147,213,0,0.4)]"
            priority
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Login Card - Dark glass morphism */}
        <div className="bg-[#17351A]/40 backdrop-blur-xl rounded-2xl p-8 w-full max-w-md border border-[#93D500]/20 shadow-[0_0_50px_rgba(147,213,0,0.1)]">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
            <p className="text-gray-400 mt-2">Sign in to access your portal</p>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 mb-4 shadow-lg hover:shadow-xl hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-gray-500">or</span>
            </div>
          </div>

          {/* Email Sign-In Button */}
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-[#93D500] hover:bg-[#a4e600] text-black font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(147,213,0,0.3)] hover:shadow-[0_0_30px_rgba(147,213,0,0.5)] hover:scale-[1.02]"
          >
            Sign In with Email
          </button>

          <div className="mt-6 text-center text-sm text-gray-500">
            Authorized for <span className="text-[#93D500]">@kanvabotanicals.com</span> and <span className="text-[#93D500]">@cwlbrands.com</span>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl">
          <div className="bg-[#17351A]/30 backdrop-blur border border-[#93D500]/10 rounded-xl p-4 text-center hover:border-[#93D500]/30 transition-all hover:scale-105">
            <BarChart3 className="w-8 h-8 text-[#93D500] mx-auto mb-2" />
            <span className="text-xs text-gray-400">Dashboard</span>
          </div>
          <div className="bg-[#17351A]/30 backdrop-blur border border-[#93D500]/10 rounded-xl p-4 text-center hover:border-[#93D500]/30 transition-all hover:scale-105">
            <Users className="w-8 h-8 text-[#93D500] mx-auto mb-2" />
            <span className="text-xs text-gray-400">Customers</span>
          </div>
          <div className="bg-[#17351A]/30 backdrop-blur border border-[#93D500]/10 rounded-xl p-4 text-center hover:border-[#93D500]/30 transition-all hover:scale-105">
            <TrendingUp className="w-8 h-8 text-[#93D500] mx-auto mb-2" />
            <span className="text-xs text-gray-400">Goals</span>
          </div>
          <div className="bg-[#17351A]/30 backdrop-blur border border-[#93D500]/10 rounded-xl p-4 text-center hover:border-[#93D500]/30 transition-all hover:scale-105">
            <FileText className="w-8 h-8 text-[#93D500] mx-auto mb-2" />
            <span className="text-xs text-gray-400">Quotes</span>
          </div>
          <div className="bg-[#17351A]/30 backdrop-blur border border-[#93D500]/10 rounded-xl p-4 text-center hover:border-[#93D500]/30 transition-all hover:scale-105">
            <Package className="w-8 h-8 text-[#93D500] mx-auto mb-2" />
            <span className="text-xs text-gray-400">Shipments</span>
          </div>
          <div className="bg-[#17351A]/30 backdrop-blur border border-[#93D500]/10 rounded-xl p-4 text-center hover:border-[#93D500]/30 transition-all hover:scale-105">
            <ShoppingCart className="w-8 h-8 text-[#93D500] mx-auto mb-2" />
            <span className="text-xs text-gray-400">Stores</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-600">
          © 2025 Kanva Botanicals / CWL Brands
        </div>
      </div>
    </div>
  );
}
