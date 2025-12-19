/**
 * Firebase Services Diagnostic
 * Checks if Firebase services are available and provides debugging info
 */

console.log('🔍 Firebase Diagnostic Script Starting...');

// Check if Firebase services are available
console.log('📊 Firebase Services Status:');
console.log('  - window.firebaseStorageService:', typeof window.firebaseStorageService);
console.log('  - window.firebaseDataService:', typeof window.firebaseDataService);
console.log('  - window.firebase:', typeof window.firebase);

// Check if Firebase modules loaded
console.log('📦 Firebase Module Status:');
console.log('  - Firebase config loaded:', typeof window.firebase !== 'undefined');

// Check network requests for Firebase modules
console.log('🌐 Check Network tab for these requests:');
console.log('  - js/firebase-config.js');
console.log('  - js/firebase-data-service.js'); 
console.log('  - js/firebase-storage-service.js');

// Try to manually load and test a Firebase module
console.log('🧪 Testing manual module import...');
try {
    import('./firebase-config.js')
        .then(module => {
            console.log('✅ firebase-config.js imported successfully:', module);
        })
        .catch(error => {
            console.error('❌ Error importing firebase-config.js:', error);
        });
} catch (error) {
    console.error('❌ Error in dynamic import:', error);
}

// Check for any unhandled errors
window.addEventListener('error', (event) => {
    if (event.filename && event.filename.includes('firebase')) {
        console.error('❌ Firebase module error detected:', {
            filename: event.filename,
            message: event.message,
            lineno: event.lineno,
            colno: event.colno
        });
    }
});

// Wait 2 seconds then check again
setTimeout(() => {
    console.log('🔍 Firebase Services Status (after 2s delay):');
    console.log('  - window.firebaseStorageService:', typeof window.firebaseStorageService);
    console.log('  - window.firebaseDataService:', typeof window.firebaseDataService);
}, 2000);

// Wait 5 seconds then check again
setTimeout(() => {
    console.log('🔍 Firebase Services Status (after 5s delay):');
    console.log('  - window.firebaseStorageService:', typeof window.firebaseStorageService);
    console.log('  - window.firebaseDataService:', typeof window.firebaseDataService);
    
    // Final diagnosis
    if (typeof window.firebaseStorageService === 'undefined' && typeof window.firebaseDataService === 'undefined') {
        console.error('🚨 DIAGNOSIS: Firebase ES modules are not loading or executing properly');
        console.error('   Possible causes:');
        console.error('   1. Network errors - Check Network tab for failed requests');
        console.error('   2. Syntax errors in Firebase modules - Check Console for import/syntax errors');
        console.error('   3. Firebase SDK import errors - Check if Firebase packages are available');
        console.error('   4. Module type mismatch - ES modules may not be supported');
    }
}, 5000);
