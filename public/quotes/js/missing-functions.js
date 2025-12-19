// Missing Functions for Kanva Quote Calculator
// This file contains all the missing global functions referenced in HTML onclick handlers

// =============================================================================
// TAX DETECTION FUNCTIONS
// =============================================================================

// Auto-detect tax rate based on customer location
function autoDetectTaxRate() {
    try {
        console.log('🏛️ Auto-detecting tax rate...');
        
        // Get customer state from form
        const stateField = document.getElementById('stateTaxRate') || 
                          document.querySelector('input[placeholder*="State"]') ||
                          document.querySelector('select[name*="state"]');
        
        if (!stateField) {
            console.warn('No state field found for tax detection');
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showWarning('Please enter customer state for accurate tax calculation');
            }
            return;
        }

        let state = '';
        
        // Try to get state from different possible fields
        if (stateField.value) {
            state = stateField.value.toUpperCase().substring(0, 2);
        } else {
            // Try to get from customer info fields
            const customerFields = ['customerState', 'companyState', 'billingState'];
            for (const fieldId of customerFields) {
                const field = document.getElementById(fieldId);
                if (field && field.value) {
                    state = field.value.toUpperCase().substring(0, 2);
                    break;
                }
            }
        }

        if (!state) {
            console.warn('No state information found');
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showInfo('Enter customer state to calculate tax automatically');
            }
            return;
        }

        // State tax rates (simplified - in production, use a tax API)
        const stateTaxRates = {
            'CA': 7.25,  // California
            'NY': 8.0,   // New York
            'TX': 6.25,  // Texas
            'FL': 6.0,   // Florida
            'WA': 6.5,   // Washington
            'IL': 6.25,  // Illinois
            'PA': 6.0,   // Pennsylvania
            'OH': 5.75,  // Ohio
            'GA': 4.0,   // Georgia
            'NC': 4.75,  // North Carolina
            'MI': 6.0,   // Michigan
            'NJ': 6.625, // New Jersey
            'VA': 5.3,   // Virginia
            'TN': 7.0,   // Tennessee
            'AZ': 5.6,   // Arizona
            'MA': 6.25,  // Massachusetts
            'IN': 7.0,   // Indiana
            'WI': 5.0,   // Wisconsin
            'CO': 2.9,   // Colorado
            'MN': 6.875, // Minnesota
            'MD': 6.0,   // Maryland
            'MO': 4.225, // Missouri
            'AL': 4.0,   // Alabama
            'LA': 4.45,  // Louisiana
            'KY': 6.0,   // Kentucky
            'SC': 6.0,   // South Carolina
            'OK': 4.5,   // Oklahoma
            'AR': 6.5,   // Arkansas
            'IA': 6.0,   // Iowa
            'KS': 6.5,   // Kansas
            'UT': 5.95,  // Utah
            'NV': 6.85,  // Nevada
            'NM': 5.125, // New Mexico
            'WV': 6.0,   // West Virginia
            'NE': 5.5,   // Nebraska
            'ID': 6.0,   // Idaho
            'HI': 4.0,   // Hawaii
            'ME': 5.5,   // Maine
            'RI': 7.0,   // Rhode Island
            'VT': 6.0,   // Vermont
            'CT': 6.35,  // Connecticut
            'AK': 0,     // Alaska - no state tax
            'DE': 0,     // Delaware - no state tax
            'MT': 0,     // Montana - no state tax
            'NH': 0,     // New Hampshire - no state tax
            'OR': 0      // Oregon - no state tax
        };

        const taxRate = stateTaxRates[state] || 0;
        
        // Update the state tax rate field
        const stateTaxInput = document.getElementById('stateTaxRate');
        if (stateTaxInput) {
            stateTaxInput.value = taxRate.toFixed(2);
        }

        // Log success
        console.log(`✅ Tax rate for ${state}: ${taxRate}%`);
        
        if (typeof NotificationManager !== 'undefined') {
            if (taxRate > 0) {
                NotificationManager.showSuccess(`Tax rate detected: ${taxRate}% for ${state}`);
            } else {
                NotificationManager.showInfo(`${state} has no state sales tax`);
            }
        }

        // Trigger calculation update if calculator is available
        if (typeof Calculator !== 'undefined' && Calculator.calculateQuote) {
            Calculator.calculateQuote();
        } else if (typeof calculateMultiProductTotal === 'function') {
            calculateMultiProductTotal();
        }

    } catch (error) {
        console.error('❌ Error auto-detecting tax rate:', error);
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showError('Failed to auto-detect tax rate: ' + error.message);
        }
    }
}

// =============================================================================
// MULTI-PRODUCT FUNCTIONS
// =============================================================================

// Multi-product functions are now in multi-product-calculator.js

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Renumber product lines after removal
function renumberProductLines() {
    const container = document.getElementById('productLines');
    if (!container) return;

    const lines = container.querySelectorAll('.product-line');
    lines.forEach((line, index) => {
        const header = line.querySelector('.product-line-header h4');
        if (header) {
            header.textContent = `Product Line ${index + 1}`;
        }
    });
}

// Update multi-product results display
function updateMultiProductResultsDisplay(results) {
    const resultsContainer = document.getElementById('multiProductResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
        <div class="multi-product-summary">
            <h4>Order Summary</h4>
            <div class="summary-line">
                <span>Total Cases:</span>
                <span><strong>${results.totalCases}</strong></span>
            </div>
            <div class="summary-line">
                <span>Subtotal:</span>
                <span>$${results.subtotal.toFixed(2)}</span>
            </div>
            ${results.discountedSubtotal !== results.subtotal ? `
                <div class="summary-line discount">
                    <span>After Volume Discount (${results.discountTier}):</span>
                    <span>$${results.discountedSubtotal.toFixed(2)}</span>
                </div>
            ` : ''}
            ${results.taxAmount > 0 ? `
                <div class="summary-line">
                    <span>Tax:</span>
                    <span>$${results.taxAmount.toFixed(2)}</span>
                </div>
            ` : ''}
            ${results.creditCardFee > 0 ? `
                <div class="summary-line">
                    <span>Credit Card Fee (3%):</span>
                    <span>$${results.creditCardFee.toFixed(2)}</span>
                </div>
            ` : ''}
            <div class="summary-line total">
                <span><strong>Grand Total:</strong></span>
                <span><strong>$${results.finalTotal.toFixed(2)}</strong></span>
            </div>
        </div>
    `;
}

// =============================================================================
// ADMIN PANEL FUNCTIONS
// =============================================================================

function showAdminPanel() {
    console.log('⚙️ Opening admin panel...');
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        adminPanel.style.display = 'block';
        populateAdminFields();
    } else {
        console.warn('Admin panel element not found');
    }
}

function hideAdminPanel() {
    console.log('⚙️ Closing admin panel...');
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        adminPanel.style.display = 'none';
    }
}

function populateAdminFields() {
    // Populate product pricing fields
    Object.keys(adminConfig.products).forEach(key => {
        const product = adminConfig.products[key];
        const priceField = document.getElementById(`admin_${key}_price`);
        const msrpField = document.getElementById(`admin_${key}_msrp`);
        const unitsField = document.getElementById(`admin_${key}_units`);
        
        if (priceField) priceField.value = product.price;
        if (msrpField) msrpField.value = product.msrp;
        if (unitsField) unitsField.value = product.unitsPerCase;
    });

    // Populate tier fields
    const tier2ThresholdField = document.getElementById('admin_tier2_threshold');
    const tier2DiscountField = document.getElementById('admin_tier2_discount');
    const tier3ThresholdField = document.getElementById('admin_tier3_threshold');
    const tier3DiscountField = document.getElementById('admin_tier3_discount');
    
    if (tier2ThresholdField) tier2ThresholdField.value = adminConfig.tiers.tier2.threshold;
    if (tier2DiscountField) tier2DiscountField.value = adminConfig.tiers.tier2.discount * 100;
    if (tier3ThresholdField) tier3ThresholdField.value = adminConfig.tiers.tier3.threshold;
    if (tier3DiscountField) tier3DiscountField.value = adminConfig.tiers.tier3.discount * 100;

    // Populate shipping and payment fields
    const shippingRateField = document.getElementById('admin_shipping_rate');
    const freeShippingField = document.getElementById('admin_free_shipping');
    const achThresholdField = document.getElementById('admin_ach_threshold');
    
    if (shippingRateField) shippingRateField.value = adminConfig.shipping.rate * 100;
    if (freeShippingField) freeShippingField.value = adminConfig.shipping.freeThreshold;
    if (achThresholdField) achThresholdField.value = adminConfig.payment.achThreshold;
}

function saveAdminSettings() {
    console.log('💾 Saving admin settings...');
    
    try {
        // Save product settings
        Object.keys(adminConfig.products).forEach(key => {
            const priceField = document.getElementById(`admin_${key}_price`);
            const msrpField = document.getElementById(`admin_${key}_msrp`);
            const unitsField = document.getElementById(`admin_${key}_units`);
            
            if (priceField && priceField.value) {
                adminConfig.products[key].price = parseFloat(priceField.value);
            }
            if (msrpField && msrpField.value) {
                adminConfig.products[key].msrp = parseFloat(msrpField.value);
            }
            if (unitsField && unitsField.value) {
                adminConfig.products[key].unitsPerCase = parseInt(unitsField.value);
            }
        });

        // Save tier settings
        const tier2ThresholdField = document.getElementById('admin_tier2_threshold');
        const tier2DiscountField = document.getElementById('admin_tier2_discount');
        const tier3ThresholdField = document.getElementById('admin_tier3_threshold');
        const tier3DiscountField = document.getElementById('admin_tier3_discount');
        
        if (tier2ThresholdField && tier2ThresholdField.value) {
            adminConfig.tiers.tier2.threshold = parseInt(tier2ThresholdField.value);
        }
        if (tier2DiscountField && tier2DiscountField.value) {
            adminConfig.tiers.tier2.discount = parseFloat(tier2DiscountField.value) / 100;
        }
        if (tier3ThresholdField && tier3ThresholdField.value) {
            adminConfig.tiers.tier3.threshold = parseInt(tier3ThresholdField.value);
        }
        if (tier3DiscountField && tier3DiscountField.value) {
            adminConfig.tiers.tier3.discount = parseFloat(tier3DiscountField.value) / 100;
        }

        // Save shipping and payment settings
        const shippingRateField = document.getElementById('admin_shipping_rate');
        const freeShippingField = document.getElementById('admin_free_shipping');
        const achThresholdField = document.getElementById('admin_ach_threshold');
        
        if (shippingRateField && shippingRateField.value) {
            adminConfig.shipping.rate = parseFloat(shippingRateField.value) / 100;
        }
        if (freeShippingField && freeShippingField.value) {
            adminConfig.shipping.freeThreshold = parseFloat(freeShippingField.value);
        }
        if (achThresholdField && achThresholdField.value) {
            adminConfig.payment.achThreshold = parseFloat(achThresholdField.value);
        }

        // Save to storage
        ConfigManager.save();
        
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showSuccess('Admin settings saved successfully!');
        }
        
        // Refresh product dropdowns
        if (typeof App !== 'undefined' && App.populateProductDropdowns) {
            App.populateProductDropdowns();
        }
        
        // Recalculate current quote
        if (typeof Calculator !== 'undefined' && Calculator.updateResults) {
            Calculator.updateResults();
        }
        
        hideAdminPanel();
        
    } catch (error) {
        console.error('❌ Error saving admin settings:', error);
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showError('Failed to save settings: ' + error.message);
        }
    }
}

function resetAdminSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
        console.log('🔄 Resetting admin settings to defaults...');
        
        ConfigManager.reset();
        populateAdminFields();
        
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showInfo('Settings reset to defaults');
        }
    }
}

function exportAdminConfig() {
    console.log('📤 Exporting admin configuration...');
    
    try {
        const config = adminConfig;
        const configJSON = JSON.stringify(config, null, 2);
        const blob = new Blob([configJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        
        link.href = url;
        link.download = `kanva-config-${timestamp}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showSuccess('Configuration exported successfully!');
        }
        
    } catch (error) {
        console.error('❌ Error exporting config:', error);
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showError('Failed to export configuration');
        }
    }
}

console.log('✅ Admin panel functions loaded successfully');

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize missing functions when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ Missing functions module initialized');
    });
} else {
    console.log('✅ Missing functions module loaded');
}

console.log('🔧 Missing functions module loaded successfully');
