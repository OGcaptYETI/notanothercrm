import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Try to get config from environment variables first
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                 process.env.FIREBASE_PROJECT_ID ||
                 (() => {
                   try {
                     return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
                   } catch {
                     return null;
                   }
                 })();

if (!projectId) {
  throw new Error('Missing Firebase project configuration');
}

// Try to initialize with available credentials
let app;
if (!getApps().length) {
  try {
    // For Cloud Functions environment
    if (process.env.FUNCTION_TARGET) {
      console.log('Initializing Firebase Admin in Cloud Functions environment');
      app = initializeApp({
        projectId,
        databaseURL: `https://${projectId}.firebaseio.com`
      });
    } 
    // For local development with service account
    else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      console.log('Initializing Firebase Admin with service account credentials');
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: `https://${projectId}.firebaseio.com`
      });
    } 
    // Fallback to application default credentials
    else {
      console.log('Initializing Firebase Admin with application default credentials');
      app = initializeApp({
        projectId,
        databaseURL: `https://${projectId}.firebaseio.com`
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
} else {
  app = getApps()[0];
  console.log('Using existing Firebase Admin instance');
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

export async function verifyIdToken(token: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    console.log('Token verified for user:', decodedToken.email);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw new Error('Invalid or expired token');
  }
}
