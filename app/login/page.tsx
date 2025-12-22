'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, fetchSignInMethodsForEmail, linkWithCredential, EmailAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    const allowedDomains = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS?.split(',') || [
      'kanvabotanicals.com',
      'cwlbrands.com'
    ];
    const emailDomain = email.toLowerCase().split('@')[1];
    return allowedDomains.some(domain => emailDomain === domain.trim().toLowerCase());
  };

  const validatePassword = (password: string): boolean => {
    // Min 8 chars, at least one number, one special char
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasMinLength && hasNumber && hasSpecial;
  };

  // Process Google sign-in result (used by both popup and redirect)
  const processGoogleSignIn = async (result: any) => {
    const userEmail = result.user.email || '';

    // Verify domain after sign-in (double-check)
    if (!validateEmail(userEmail)) {
      await auth.signOut();
      setError('Access denied. Please use a @kanvabotanicals.com or @cwlbrands.com email.');
      return;
    }

    // Update user document with Google profile info (if exists)
    const userDocRef = doc(db, 'users', result.user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      // User exists - update with Google profile data
      const updates: any = {
        updatedAt: new Date().toISOString(),
      };
      if (result.user.photoURL) {
        updates.photoURL = result.user.photoURL;
      }
      if (result.user.displayName && !userDocSnap.data().name) {
        updates.name = result.user.displayName;
      }
      await setDoc(userDocRef, updates, { merge: true });
      console.log('✅ Existing user signed in via Google:', userEmail);
    } else {
      // Create new user document
      const userDoc = {
        id: result.user.uid,
        email: userEmail,
        name: result.user.displayName || userEmail.split('@')[0],
        photoURL: result.user.photoURL || null,
        role: 'sales',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, userDoc);
      console.log('✅ User document created via Google Sign-In:', userDoc);
    }

    toast.success('Signed in with Google!');
    router.push('/dashboard');
  };

  // Handle Google Sign-In with popup, fallback to redirect if blocked
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        hd: 'kanvabotanicals.com',
        prompt: 'select_account'
      });

      // Try popup first
      try {
        const result = await signInWithPopup(auth, provider);
        await processGoogleSignIn(result);
      } catch (popupError: any) {
        // If popup was blocked, use redirect instead
        if (popupError.code === 'auth/popup-blocked') {
          console.log('Popup blocked, using redirect instead');
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupError;
      }
    } catch (err: any) {
      console.error('Google auth error:', err);
      
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email. Please sign in with your email/password first.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for sign-in');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Redirecting...');
      } else {
        setError(err.message || 'Google sign-in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle redirect result on page load
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          setGoogleLoading(true);
          await processGoogleSignIn(result);
        }
      } catch (err: any) {
        console.error('Redirect result error:', err);
        if (err.code === 'auth/account-exists-with-different-credential') {
          setError('An account already exists with this email. Please sign in with your email/password first.');
        } else {
          setError(err.message || 'Sign-in failed');
        }
      } finally {
        setGoogleLoading(false);
      }
    };

    handleRedirectResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please use a @kanvabotanicals.com or @cwlbrands.com email address');
      return;
    }

    if (isSignUp && !validatePassword(password)) {
      setError('Password must be at least 8 characters with a number and special character');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create user document in Firestore
        const userDoc = {
          id: userCredential.user.uid,
          email: email,
          name: email.split('@')[0], // Use email prefix as default name
          role: 'sales', // Default role
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
        console.log('✅ User document created:', userDoc);
        
        toast.success('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Signed in successfully!');
      }
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#93D500]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#17351A]/30 rounded-full blur-3xl"></div>
      
      <div className="max-w-md w-full relative z-10">
        {/* Logo - Large and Centered */}
        <div className="text-center mb-10">
          <Image 
            src="/images/kanva-logo.png" 
            alt="Kanva Botanicals" 
            width={320} 
            height={120}
            className="h-32 w-auto mx-auto drop-shadow-[0_0_25px_rgba(147,213,0,0.3)]"
            priority
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Login Card - Dark glass morphism */}
        <div className="bg-[#17351A]/40 backdrop-blur-xl rounded-2xl p-8 border border-[#93D500]/20 shadow-[0_0_50px_rgba(147,213,0,0.1)]">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-white">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {isSignUp 
                ? 'Register with your organization email' 
                : 'Sign in to access your portal'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 mb-4 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-[1.02]"
          >
            {googleLoading ? (
              <span className="flex items-center">
                <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></span>
                Signing in...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-gray-500">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative w-full">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-3 pl-10 bg-black/40 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#93D500]/50 focus:border-[#93D500]/50 transition-all"
                  placeholder="you@kanvabotanicals.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative w-full">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-3 pl-10 bg-black/40 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#93D500]/50 focus:border-[#93D500]/50 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              {isSignUp && (
                <p className="text-xs text-gray-500 mt-1">
                  Min 8 characters, include a number and special character
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full bg-[#93D500] hover:bg-[#a4e600] text-black font-bold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-[0_0_20px_rgba(147,213,0,0.3)] hover:shadow-[0_0_30px_rgba(147,213,0,0.5)] hover:scale-[1.02]"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></span>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </span>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In with Email'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-sm text-[#93D500] hover:text-[#a4e600] font-medium transition-colors"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-600/30">
            <p className="text-xs text-gray-500 text-center">
              Authorized for <span className="text-[#93D500]">@kanvabotanicals.com</span> and <span className="text-[#93D500]">@cwlbrands.com</span>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-600">© 2025 Kanva Botanicals / CWL Brands</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
