/**
 * Firebase Initialization Fix
 * Ensures proper loading order and event binding
 * Add this script AFTER admin-dashboard-firebase-patch.js
 */

(function() {
    'use strict';

    console.log('🔧 Running Firebase initialization fix...');

    // Wait for all Firebase services and AdminDashboard to be ready
    const waitForServices = async () => {
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
            if (window.firebaseDataService && 
                window.firebaseStorageService && 
                window.AdminDashboard && 
                window.adminDashboard) {
                
                console.log('✅ All services ready, applying final fixes...');
                return true;
            }
            
            attempts++;
            console.log(`⏳ Waiting for services... (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.warn('⚠️ Some services may not be ready, continuing anyway...');
        return false;
    };

    // Fix function bindings and ensure proper event handling
    const applyFinalFixes = async () => {
        try {
            await waitForServices();
            
            // Ensure adminDashboard is globally accessible
            if (typeof window.AdminDashboard !== 'undefined' && !window.adminDashboard) {
                console.log('🔧 Creating global adminDashboard instance...');
                window.adminDashboard = new window.AdminDashboard();
                
                // Initialize if not already done
                if (typeof window.adminDashboard.init === 'function') {
                    await window.adminDashboard.init();
                }
            }
            
            // Verify critical functions are bound
            if (window.adminDashboard) {
                const criticalFunctions = [
                    'deleteProduct',
                    'editProduct', 
                    'deleteTier',
                    'editTier',
                    'deleteShippingZone',
                    'editShippingZone',
                    'showNotification'
                ];
                
                criticalFunctions.forEach(funcName => {
                    if (typeof window.adminDashboard[funcName] !== 'function') {
                        console.warn(`⚠️ Missing function: ${funcName}`);
                    } else {
                        console.log(`✅ Function bound: ${funcName}`);
                    }
                });
                
                // Rebind events on any existing tables
                const tables = document.querySelectorAll('.admin-data-table, .data-table');
                tables.forEach(table => {
                    console.log('🔄 Rebinding events for table:', table.id);
                    
                    // Rebind delete buttons
                    const deleteButtons = table.querySelectorAll('[onclick*="deleteProduct"], [onclick*="deleteTier"], [onclick*="deleteShippingZone"]');
                    deleteButtons.forEach(button => {
                        const onclickText = button.getAttribute('onclick');
                        console.log('🔗 Found delete button with onclick:', onclickText);
                    });
                    
                    // Rebind edit buttons
                    const editButtons = table.querySelectorAll('[onclick*="editProduct"], [onclick*="editTier"], [onclick*="editShippingZone"]');
                    editButtons.forEach(button => {
                        const onclickText = button.getAttribute('onclick');
                        console.log('🔗 Found edit button with onclick:', onclickText);
                    });
                });
                
                console.log('✅ Final fixes applied successfully');
            } else {
                console.error('❌ AdminDashboard instance not found');
            }
            
        } catch (error) {
            console.error('❌ Error in final fixes:', error);
        }
    };

    // Run fixes when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyFinalFixes);
    } else {
        // DOM already loaded, run immediately
        applyFinalFixes();
    }

    // Also run fixes when window is fully loaded (fallback)
    window.addEventListener('load', () => {
        setTimeout(applyFinalFixes, 1000);
    });

    console.log('🔧 Firebase initialization fix registered');
})();