/**
 * Firebase Anonymous Auth Hook
 * Auto-signs in users anonymously to access Firestore with permissive rules
 * Users are authenticated via Supabase, not Firebase - this is just for data access
 */

import { useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './config';

export function useFirebaseAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !auth) {
      setIsLoading(false);
      return;
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        // Auto-sign in anonymously if not authenticated
        try {
          await signInAnonymously(auth);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Firebase anonymous auth failed:', error);
          setIsAuthenticated(false);
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return { isAuthenticated, isLoading };
}
