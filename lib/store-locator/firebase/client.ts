"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, signOut as signOutFn, setPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { db, doc, getDoc, setDoc, serverTimestamp } from './db';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log('🔥 Firebase Config:', {
  hasApiKey: !!firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  hasAppId: !!firebaseConfig.appId
});

// Initialize Firebase App
let app: FirebaseApp;
if (!getApps().length) {
  console.log('🚀 Initializing Firebase app...');
  app = initializeApp(firebaseConfig);
} else {
  console.log('♻️ Reusing existing Firebase app');
  app = getApp();
}

// Initialize Auth
const auth = getAuth(app);

// Configure persistence
try {
  setPersistence(auth, browserLocalPersistence).catch(() => 
    setPersistence(auth, inMemoryPersistence)
  );
} catch {}

// Email/Password Sign In
export async function emailPasswordSignIn(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  
  // Ensure user doc exists
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: user.uid,
        email: user.email,
        name: user.displayName || null,
        photoUrl: user.photoURL || null,
        role: 'sales',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('[auth] failed to ensure user profile', e);
  }
  
  return user;
}

// Send password reset email
export async function sendResetEmail(email: string) {
  await sendPasswordResetEmail(auth, email);
}

// Sign out
export const signOut = async () => {
  try {
    await signOutFn(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Firestore Collections
export const collections = {
  users: 'users',
  retailerApplications: 'retailer_applications',
  approvalLogs: 'approval_logs',
  integrationLogs: 'integration_logs',
  settings: 'settings',
} as const;

export { auth, db, serverTimestamp };
