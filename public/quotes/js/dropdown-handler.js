/**
 * Dropdown Field Handler for Kanva Quotes
 * Handles synchronization between dropdown fields and their corresponding input fields
 */
const DropdownHandler = {
    /**
     * Initialize dropdown handlers
     */
    init() {
        console.log('🔄 Initializing dropdown field handlers');
        // Allow DOM to fully load first
        setTimeout(() => {
            this.setupEmailDropdown();
            this.setupPhoneDropdown();
            this.setupStateVisibility();
            this.observeFieldUpdates();
        }, 500);
    },
    
    /**
     * Set up mutation observer to detect changes to field values
     * This helps catch when fields are populated programmatically
     */
    observeFieldUpdates() {
        const config = { attributes: true, attributeFilter: ['value'], childList: false, subtree: false };
        
        // Watch input fields for value changes
        const emailInput = document.getElementById('customerEmail');
        const phoneInput = document.getElementById('customerPhone');
        
        if (emailInput) {
            const emailObserver = new MutationObserver(() => this.checkEmailOptions());
            emailObserver.observe(emailInput, config);
        }
        
        if (phoneInput) {
            const phoneObserver = new MutationObserver(() => this.checkPhoneOptions());
            phoneObserver.observe(phoneInput, config);
        }
        
        console.log('👁️ Field update observers initialized');
    },
    
    /**
     * Setup email dropdown interaction
     */
    setupEmailDropdown() {
        const emailInput = document.getElementById('customerEmail');
        const emailDropdown = document.getElementById('customerEmail_dropdown');
        
        if (!emailInput || !emailDropdown) return;
        
        // When dropdown changes, update input field
        emailDropdown.addEventListener('change', () => {
            if (emailDropdown.value) {
                emailInput.value = emailDropdown.value;
                emailInput.classList.add('auto-populated');
                console.log(`📧 Selected email: ${emailDropdown.value}`);
                
                // Also trigger change event on the input
                emailInput.dispatchEvent(new Event('change'));
            }
        });
        
        this.checkEmailOptions();
    },
    
    /**
     * Check if there are multiple email options and show dropdown if needed
     */
    checkEmailOptions() {
        const emailInput = document.getElementById('customerEmail');
        const emailDropdown = document.getElementById('customerEmail_dropdown');
        
        if (!emailInput || !emailDropdown) return;
        
        // Check if we have data attribute with options
        const emailOptions = emailInput.dataset.options;
        if (emailOptions) {
            try {
                // Parse options from JSON data attribute
                const options = JSON.parse(emailOptions);
                if (Array.isArray(options) && options.length > 1) {
                    // Clear existing options except first one
                    while (emailDropdown.options.length > 1) {
                        emailDropdown.remove(1);
                    }
                    
                    // Add options to dropdown
                    options.forEach(option => {
                        const opt = document.createElement('option');
                        opt.value = option.value || option;
                        opt.textContent = option.label || option;
                        emailDropdown.appendChild(opt);
                    });
                    
                    // Show dropdown
                    emailDropdown.style.display = 'block';
                    emailInput.classList.add('has-dropdown');
                    console.log(`📧 Email dropdown enabled with ${options.length} options`);
                    return;
                }
            } catch (error) {
                console.warn('Error parsing email options:', error);
            }
        }
        
        // If we get here, check simply if dropdown has options
        if (emailDropdown.options.length > 1) {
            emailDropdown.style.display = 'block';
            emailInput.classList.add('has-dropdown');
            console.log(`📧 Email dropdown enabled with ${emailDropdown.options.length - 1} options`);
        }
    },
    
    /**
     * Setup phone dropdown interaction
     */
    setupPhoneDropdown() {
        const phoneInput = document.getElementById('customerPhone');
        const phoneDropdown = document.getElementById('customerPhone_dropdown');
        
        if (!phoneInput || !phoneDropdown) return;
        
        // When dropdown changes, update input field
        phoneDropdown.addEventListener('change', () => {
            if (phoneDropdown.value) {
                phoneInput.value = phoneDropdown.value;
                phoneInput.classList.add('auto-populated');
                console.log(`☎️ Selected phone: ${phoneDropdown.value}`);
                
                // Also trigger change event on the input
                phoneInput.dispatchEvent(new Event('change'));
            }
        });
        
        this.checkPhoneOptions();
    },
    
    /**
     * Check if there are multiple phone options and show dropdown if needed
     */
    checkPhoneOptions() {
        const phoneInput = document.getElementById('customerPhone');
        const phoneDropdown = document.getElementById('customerPhone_dropdown');
        
        if (!phoneInput || !phoneDropdown) return;
        
        // Check if we have data attribute with options
        const phoneOptions = phoneInput.dataset.options;
        if (phoneOptions) {
            try {
                // Parse options from JSON data attribute
                const options = JSON.parse(phoneOptions);
                if (Array.isArray(options) && options.length > 1) {
                    // Clear existing options except first one
                    while (phoneDropdown.options.length > 1) {
                        phoneDropdown.remove(1);
                    }
                    
                    // Add options to dropdown
                    options.forEach(option => {
                        const opt = document.createElement('option');
                        opt.value = option.value || option;
                        opt.textContent = option.label || option;
                        phoneDropdown.appendChild(opt);
                    });
                    
                    // Show dropdown
                    phoneDropdown.style.display = 'block';
                    phoneInput.classList.add('has-dropdown');
                    console.log(`☎️ Phone dropdown enabled with ${options.length} options`);
                    return;
                }
            } catch (error) {
                console.warn('Error parsing phone options:', error);
            }
        }
        
        // If we get here, check simply if dropdown has options
        if (phoneDropdown.options.length > 1) {
            phoneDropdown.style.display = 'block';
            phoneInput.classList.add('has-dropdown');
            console.log(`☎️ Phone dropdown enabled with ${phoneDropdown.options.length - 1} options`);
        }
    },
    
    /**
     * Setup state field dropdown visibility
     */
    setupStateVisibility() {
        const stateField = document.getElementById('customerState');
        if (!stateField) return;
        
        // Make sure the dropdown has options
        if (stateField.options.length <= 1) {
            console.log('🏙️ Populating state dropdown with default options');
            this.populateStateOptions(stateField);
        }
    },
    
    /**
     * Populate state dropdown with options
     */
    populateStateOptions(stateField) {
        const stateOptions = [
            { value: 'AL', label: 'Alabama' },
            { value: 'AK', label: 'Alaska' },
            { value: 'AZ', label: 'Arizona' },
            { value: 'AR', label: 'Arkansas' },
            { value: 'CA', label: 'California' },
            { value: 'CO', label: 'Colorado' },
            { value: 'CT', label: 'Connecticut' },
            { value: 'DE', label: 'Delaware' },
            { value: 'FL', label: 'Florida' },
            { value: 'GA', label: 'Georgia' },
            { value: 'HI', label: 'Hawaii' },
            { value: 'ID', label: 'Idaho' },
            { value: 'IL', label: 'Illinois' },
            { value: 'IN', label: 'Indiana' },
            { value: 'IA', label: 'Iowa' },
            { value: 'KS', label: 'Kansas' },
            { value: 'KY', label: 'Kentucky' },
            { value: 'LA', label: 'Louisiana' },
            { value: 'ME', label: 'Maine' },
            { value: 'MD', label: 'Maryland' },
            { value: 'MA', label: 'Massachusetts' },
            { value: 'MI', label: 'Michigan' },
            { value: 'MN', label: 'Minnesota' },
            { value: 'MS', label: 'Mississippi' },
            { value: 'MO', label: 'Missouri' },
            { value: 'MT', label: 'Montana' },
            { value: 'NE', label: 'Nebraska' },
            { value: 'NV', label: 'Nevada' },
            { value: 'NH', label: 'New Hampshire' },
            { value: 'NJ', label: 'New Jersey' },
            { value: 'NM', label: 'New Mexico' },
            { value: 'NY', label: 'New York' },
            { value: 'NC', label: 'North Carolina' },
            { value: 'ND', label: 'North Dakota' },
            { value: 'OH', label: 'Ohio' },
            { value: 'OK', label: 'Oklahoma' },
            { value: 'OR', label: 'Oregon' },
            { value: 'PA', label: 'Pennsylvania' },
            { value: 'RI', label: 'Rhode Island' },
            { value: 'SC', label: 'South Carolina' },
            { value: 'SD', label: 'South Dakota' },
            { value: 'TN', label: 'Tennessee' },
            { value: 'TX', label: 'Texas' },
            { value: 'UT', label: 'Utah' },
            { value: 'VT', label: 'Vermont' },
            { value: 'VA', label: 'Virginia' },
            { value: 'WA', label: 'Washington' },
            { value: 'WV', label: 'West Virginia' },
            { value: 'WI', label: 'Wisconsin' },
            { value: 'WY', label: 'Wyoming' }
        ];
        
        // Clear existing options except first one
        while (stateField.options.length > 1) {
            stateField.remove(1);
        }
        
        // Add state options
        stateOptions.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            stateField.appendChild(opt);
        });
    }
};

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    DropdownHandler.init();
});
