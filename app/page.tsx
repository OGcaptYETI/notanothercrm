'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let redirected = false;
    
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!redirected) {
          redirected = true;
          if (session) {
            router.replace('/dashboard');
          } else {
            router.replace('/login');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (!redirected) {
          redirected = true;
          router.replace('/login');
        }
      }
    };

    // Fallback timeout - if auth check takes too long, redirect to login
    const timeout = setTimeout(() => {
      if (!redirected) {
        console.warn('Auth check timeout - redirecting to login');
        redirected = true;
        router.replace('/login');
      }
    }, 3000);

    checkAuth();

    return () => clearTimeout(timeout);
  }, [router]);

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
