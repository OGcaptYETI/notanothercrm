// Firebase Configuration and Initialization
// Kanva Quotes - Firebase Backend Integration (CDN Version)

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwU2sUVjnT-ZqxhBaIWp18DRJzHnTxf9Q",
  authDomain: "kanvaportal.firebaseapp.com",
  projectId: "kanvaportal",
  storageBucket: "kanvaportal.firebasestorage.app",
  messagingSenderId: "829835149823",
  appId: "1:829835149823:web:500d938c7c6ed3addf67ca",
  measurementId: "G-TBJY8JPTTN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services using compat API (v8 style)
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

// Development environment detection
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.port === '5000' ||
                     window.location.port === '8080' ||
                     window.location.port === '3000';

// Connect to emulators in development (DISABLED - USING PRODUCTION)
// if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
//     console.log('🔧 Connecting to Firebase emulators...');
//     db.useEmulator('localhost', 9090);
//     storage.useEmulator('localhost', 9191);
//     auth.useEmulator('http://localhost:9099');
//     console.log('✅ Connected to Firebase emulators');
// }
console.log('🚀 Using PRODUCTION Firebase environment');

// Anonymous authentication for public access
let authInitialized = false;

const initializeAuth = async () => {
  if (authInitialized) return;
  
  try {
    console.log('🔐 Initializing Firebase authentication...');
    
    // Production environment - try anonymous auth, fallback to no auth
    console.log('🚀 Attempting production Firebase authentication...');
    
    // Check if anonymous auth is enabled by attempting to sign in
    await auth.signInAnonymously();
    authInitialized = true;
    console.log('✅ Firebase anonymous authentication successful');
  } catch (error) {
    console.warn('⚠️ Anonymous authentication not available:', error.message);
    console.log('🔓 Continuing with public access (no authentication)');
    authInitialized = true; // Continue without auth - rules allow public access
  }
};

// Auto-initialize auth
initializeAuth().catch(console.error);

// Global Firebase instance for legacy compatibility
window.firebase = {
  db,
  storage,
  auth,
  initializeAuth,
  isDevelopment
};

console.log('🔥 Firebase configuration loaded successfully');
