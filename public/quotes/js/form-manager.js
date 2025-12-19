/**
 * Enhanced Form Manager for Kanva Quotes
 * Handles complex form operations, validation, and data management
 * Converted from kanva-portal ES6 modules to vanilla JavaScript
 */

class FormManager {
    constructor(options = {}) {
        this.calculator = options.calculator || window.calculator;
        this.adminManager = options.adminManager || window.AdminManager;
        this.forms = new Map();
        this.validators = new Map();
        this.eventListeners = new Map();
        
        console.log('📋 FormManager initialized');
        this.initializeDefaultValidators();
    }

    /**
     * Initialize default validators
     */
    initializeDefaultValidators() {
        // Email validator
        this.addValidator('email', (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return {
                isValid: emailRegex.test(value),
                message: 'Please enter a valid email address'
            };
        });

        // Phone validator
        this.addValidator('phone', (value) => {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            const cleaned = value.replace(/[\s\-\(\)]/g, '');
            return {
                isValid: phoneRegex.test(cleaned) && cleaned.length >= 10,
                message: 'Please enter a valid phone number (at least 10 digits)'
            };
        });

        // Required field validator
        this.addValidator('required', (value) => {
            return {
                isValid: value && value.toString().trim().length > 0,
                message: 'This field is required'
            };
        });

        // Numeric validator
        this.addValidator('numeric', (value) => {
            const num = parseFloat(value);
            return {
                isValid: !isNaN(num) && isFinite(num),
                message: 'Please enter a valid number'
            };
        });

        // Positive number validator
        this.addValidator('positive', (value) => {
            const num = parseFloat(value);
            return {
                isValid: !isNaN(num) && num > 0,
                message: 'Please enter a positive number'
            };
        });

        // GitHub token validator
        this.addValidator('github-token', (value) => {
            const tokenRegex = /^gh[ps]_[A-Za-z0-9_]{36,}$/;
            return {
                isValid: tokenRegex.test(value),
                message: 'Please enter a valid GitHub personal access token (starts with ghp_ or ghs_)'
            };
        });
    }

    /**
     * Register a form with validation rules
     * @param {string} formId - Form element ID
     * @param {Object} config - Form configuration
     */
    registerForm(formId, config = {}) {
        const formElement = document.getElementById(formId);
        if (!formElement) {
            console.error(`❌ Form element not found: ${formId}`);
            return false;
        }

        const formData = {
            element: formElement,
            config: config,
            fields: new Map(),
            isValid: false,
            data: {}
        };

        // Register field validators
        if (config.fields) {
            Object.entries(config.fields).forEach(([fieldName, fieldConfig]) => {
                this.registerField(formId, fieldName, fieldConfig);
            });
        }

        // Add form submit handler
        formElement.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit(formId);
        });

        this.forms.set(formId, formData);
        console.log(`✅ Form registered: ${formId}`);
        return true;
    }

    /**
     * Register a field with validation rules
     * @param {string} formId - Form ID
     * @param {string} fieldName - Field name
     * @param {Object} fieldConfig - Field configuration
     */
    registerField(formId, fieldName, fieldConfig) {
        const formData = this.forms.get(formId);
        if (!formData) {
            console.error(`❌ Form not found: ${formId}`);
            return false;
        }

        const fieldElement = formData.element.querySelector(`[name="${fieldName}"]`);
        if (!fieldElement) {
            console.error(`❌ Field element not found: ${fieldName}`);
            return false;
        }

        const fieldData = {
            element: fieldElement,
            config: fieldConfig,
            validators: fieldConfig.validators || [],
            isValid: false,
            errors: []
        };

        // Add real-time validation
        fieldElement.addEventListener('blur', () => {
            this.validateField(formId, fieldName);
        });

        // Add input event for real-time feedback
        fieldElement.addEventListener('input', () => {
            if (fieldData.errors.length > 0) {
                this.validateField(formId, fieldName);
            }
        });

        formData.fields.set(fieldName, fieldData);
        return true;
    }

    /**
     * Add a custom validator
     * @param {string} name - Validator name
     * @param {Function} validatorFn - Validator function
     */
    addValidator(name, validatorFn) {
        this.validators.set(name, validatorFn);
    }

    /**
     * Validate a specific field
     * @param {string} formId - Form ID
     * @param {string} fieldName - Field name
     * @returns {boolean} - Validation result
     */
    validateField(formId, fieldName) {
        const formData = this.forms.get(formId);
        const fieldData = formData?.fields.get(fieldName);
        
        if (!fieldData) {
            console.error(`❌ Field not found: ${fieldName} in form ${formId}`);
            return false;
        }

        const value = fieldData.element.value;
        const errors = [];

        // Run all validators for this field
        fieldData.validators.forEach(validatorName => {
            const validator = this.validators.get(validatorName);
            if (validator) {
                const result = validator(value);
                if (!result.isValid) {
                    errors.push(result.message);
                }
            }
        });

        fieldData.errors = errors;
        fieldData.isValid = errors.length === 0;

        // Update UI
        this.updateFieldUI(fieldData.element, fieldData.isValid, errors);

        return fieldData.isValid;
    }

    /**
     * Validate entire form
     * @param {string} formId - Form ID
     * @returns {boolean} - Validation result
     */
    validateForm(formId) {
        const formData = this.forms.get(formId);
        if (!formData) {
            console.error(`❌ Form not found: ${formId}`);
            return false;
        }

        let isFormValid = true;

        // Validate all fields
        formData.fields.forEach((fieldData, fieldName) => {
            const isFieldValid = this.validateField(formId, fieldName);
            if (!isFieldValid) {
                isFormValid = false;
            }
        });

        formData.isValid = isFormValid;
        return isFormValid;
    }

    /**
     * Update field UI based on validation state
     * @param {HTMLElement} element - Field element
     * @param {boolean} isValid - Validation state
     * @param {Array} errors - Error messages
     */
    updateFieldUI(element, isValid, errors) {
        // Remove existing validation classes
        element.classList.remove('field-valid', 'field-invalid');
        
        // Add appropriate class
        if (isValid) {
            element.classList.add('field-valid');
        } else {
            element.classList.add('field-invalid');
        }

        // Update or create error message display
        let errorContainer = element.parentNode.querySelector('.field-error');
        
        if (errors.length > 0) {
            if (!errorContainer) {
                errorContainer = document.createElement('div');
                errorContainer.className = 'field-error';
                element.parentNode.appendChild(errorContainer);
            }
            errorContainer.textContent = errors[0]; // Show first error
            errorContainer.style.display = 'block';
        } else if (errorContainer) {
            errorContainer.style.display = 'none';
        }
    }

    /**
     * Handle form submission
     * @param {string} formId - Form ID
     */
    async handleFormSubmit(formId) {
        const formData = this.forms.get(formId);
        if (!formData) {
            console.error(`❌ Form not found: ${formId}`);
            return;
        }

        console.log(`📋 Handling form submission: ${formId}`);

        // Validate form
        const isValid = this.validateForm(formId);
        if (!isValid) {
            console.warn('⚠️ Form validation failed');
            this.showFormError(formId, 'Please correct the errors above');
            return;
        }

        // Collect form data
        const data = this.getFormData(formId);
        formData.data = data;

        // Call form-specific handler
        if (formData.config.onSubmit) {
            try {
                await formData.config.onSubmit(data);
                this.showFormSuccess(formId, 'Changes saved successfully');
            } catch (error) {
                console.error('❌ Form submission error:', error);
                this.showFormError(formId, error.message || 'An error occurred while saving');
            }
        }
    }

    /**
     * Get form data as object
     * @param {string} formId - Form ID
     * @returns {Object} - Form data
     */
    getFormData(formId) {
        const formData = this.forms.get(formId);
        if (!formData) {
            return {};
        }

        const data = {};
        formData.fields.forEach((fieldData, fieldName) => {
            let value = fieldData.element.value;
            
            // Type conversion based on field type
            if (fieldData.element.type === 'number') {
                value = parseFloat(value) || 0;
            } else if (fieldData.element.type === 'checkbox') {
                value = fieldData.element.checked;
            }
            
            data[fieldName] = value;
        });

        return data;
    }

    /**
     * Set form data
     * @param {string} formId - Form ID
     * @param {Object} data - Data to set
     */
    setFormData(formId, data) {
        const formData = this.forms.get(formId);
        if (!formData) {
            console.error(`❌ Form not found: ${formId}`);
            return;
        }

        Object.entries(data).forEach(([fieldName, value]) => {
            const fieldData = formData.fields.get(fieldName);
            if (fieldData) {
                if (fieldData.element.type === 'checkbox') {
                    fieldData.element.checked = !!value;
                } else {
                    fieldData.element.value = value || '';
                }
            }
        });
    }

    /**
     * Show form success message
     * @param {string} formId - Form ID
     * @param {string} message - Success message
     */
    showFormSuccess(formId, message) {
        this.showFormMessage(formId, message, 'success');
    }

    /**
     * Show form error message
     * @param {string} formId - Form ID
     * @param {string} message - Error message
     */
    showFormError(formId, message) {
        this.showFormMessage(formId, message, 'error');
    }

    /**
     * Show form message
     * @param {string} formId - Form ID
     * @param {string} message - Message text
     * @param {string} type - Message type (success, error, info)
     */
    showFormMessage(formId, message, type = 'info') {
        const formData = this.forms.get(formId);
        if (!formData) {
            return;
        }

        // Remove existing message
        const existingMessage = formData.element.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageElement = document.createElement('div');
        messageElement.className = `form-message form-message-${type}`;
        messageElement.textContent = message;
        messageElement.style.cssText = `
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            font-weight: 500;
            ${type === 'success' ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
            ${type === 'error' ? 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
            ${type === 'info' ? 'background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
        `;

        // Insert at top of form
        formData.element.insertBefore(messageElement, formData.element.firstChild);

        // Auto-remove success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 3000);
        }
    }

    /**
     * Create a dynamic form for editing data
     * @param {string} title - Form title
     * @param {Object} fields - Field definitions
     * @param {Object} data - Initial data
     * @param {Function} onSave - Save callback
     * @returns {HTMLElement} - Form element
     */
    createDynamicForm(title, fields, data = {}, onSave = null) {
        const formId = `dynamic-form-${Date.now()}`;
        
        const formHTML = `
            <div class="dynamic-form-container" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
            ">
                <div class="dynamic-form-modal" style="
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                ">
                    <div class="form-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    ">
                        <h3 style="margin: 0;">${title}</h3>
                        <button type="button" class="close-form" style="
                            background: #dc3545;
                            color: white;
                            border: none;
                            padding: 5px 10px;
                            border-radius: 4px;
                            cursor: pointer;
                        ">&times;</button>
                    </div>
                    
                    <form id="${formId}" class="dynamic-form">
                        ${Object.entries(fields).map(([fieldName, fieldConfig]) => `
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="${fieldName}" style="
                                    display: block;
                                    margin-bottom: 5px;
                                    font-weight: 500;
                                ">${fieldConfig.label || fieldName}:</label>
                                ${this.createFieldElement(fieldName, fieldConfig, data[fieldName])}
                            </div>
                        `).join('')}
                        
                        <div class="form-actions" style="
                            display: flex;
                            gap: 10px;
                            justify-content: flex-end;
                            margin-top: 20px;
                            padding-top: 15px;
                            border-top: 1px solid #eee;
                        ">
                            <button type="button" class="btn btn-secondary cancel-form">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add to DOM
        const container = document.createElement('div');
        container.innerHTML = formHTML;
        const formContainer = container.firstElementChild;
        document.body.appendChild(formContainer);

        // Register form
        const formConfig = {
            fields: fields,
            onSubmit: async (formData) => {
                if (onSave) {
                    await onSave(formData);
                }
                formContainer.remove();
            }
        };
        
        // Wait for DOM insertion then register
        setTimeout(() => {
            this.registerForm(formId, formConfig);
            this.setFormData(formId, data);
        }, 0);

        // Handle close buttons
        formContainer.querySelector('.close-form').addEventListener('click', () => {
            formContainer.remove();
        });
        
        formContainer.querySelector('.cancel-form').addEventListener('click', () => {
            formContainer.remove();
        });

        // Close on outside click
        formContainer.addEventListener('click', (e) => {
            if (e.target === formContainer) {
                formContainer.remove();
            }
        });

        return formContainer;
    }

    /**
     * Create field element HTML
     * @param {string} fieldName - Field name
     * @param {Object} fieldConfig - Field configuration
     * @param {*} value - Field value
     * @returns {string} - HTML string
     */
    createFieldElement(fieldName, fieldConfig, value = '') {
        const inputId = `field-${fieldName}`;
        
        switch (fieldConfig.type) {
            case 'textarea':
                return `<textarea id="${inputId}" name="${fieldName}" rows="${fieldConfig.rows || 3}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">${value || ''}</textarea>`;
            
            case 'select':
                const options = fieldConfig.options || [];
                return `
                    <select id="${inputId}" name="${fieldName}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        ${options.map(option => `
                            <option value="${option.value}" ${option.value === value ? 'selected' : ''}>
                                ${option.label || option.value}
                            </option>
                        `).join('')}
                    </select>
                `;
            
            case 'checkbox':
                return `
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="${inputId}" name="${fieldName}" ${value ? 'checked' : ''}>
                        ${fieldConfig.checkboxLabel || 'Enable'}
                    </label>
                `;
            
            default:
                return `<input type="${fieldConfig.type || 'text'}" id="${inputId}" name="${fieldName}" value="${value || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">`;
        }
    }

    /**
     * Clear form data
     * @param {string} formId - Form ID
     */
    clearForm(formId) {
        const formData = this.forms.get(formId);
        if (!formData) {
            return;
        }

        formData.fields.forEach((fieldData) => {
            if (fieldData.element.type === 'checkbox') {
                fieldData.element.checked = false;
            } else {
                fieldData.element.value = '';
            }
            
            // Clear validation state
            fieldData.element.classList.remove('field-valid', 'field-invalid');
            const errorContainer = fieldData.element.parentNode.querySelector('.field-error');
            if (errorContainer) {
                errorContainer.style.display = 'none';
            }
        });
    }

    /**
     * Destroy form and clean up
     * @param {string} formId - Form ID
     */
    destroyForm(formId) {
        const formData = this.forms.get(formId);
        if (formData) {
            // Remove event listeners
            // (In a real implementation, you'd track and remove all listeners)
            
            this.forms.delete(formId);
            console.log(`🗑️ Form destroyed: ${formId}`);
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.FormManager = FormManager;
    
    // Create global instance
    window.formManager = new FormManager();
}

console.log('✅ Enhanced FormManager loaded successfully');
