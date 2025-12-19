// Email generation module for Kanva Botanicals Quote Calculator
// Handles email template generation, formatting, and export functionality

const EmailGenerator = {
    // Initialize email generator
    initialize: function() {
        console.log('📧 Initializing email generator...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('✅ Email generator initialized');
    },

    // Set up event listeners
    setupEventListeners: function() {
        // Listen for product changes to update quote names
        document.addEventListener('change', (event) => {
            if (event.target.id === 'primaryProduct') {
                this.updateQuoteNameFromProduct();
            }
        });
    },

    // Generate professional quote email
    generateEmail: function() {
        console.log('📧 Generating professional quote email...');
        
        const calc = Calculator.calculateOrder();
        if (!calc.product) {
            NotificationManager.showError('Please calculate a quote first');
            return;
        }

        // Get form data with new field names
        const formData = this.getFormData();
        
        // Generate email content
        const emailContent = this.formatEmailContent(calc, formData);
        
        // Display email
        this.displayEmail(emailContent);
        
        console.log('✅ Email generated successfully');
    },

    // Get form data with updated field names
    getFormData: function() {
        return {
            quoteName: document.getElementById('quoteName')?.value || 'Product Quote',
            companyName: document.getElementById('companyName')?.value || '[COMPANY NAME]',
            segment: document.getElementById('segment')?.value || '[CUSTOMER SEGMENT]',
            emailDomain: document.getElementById('emailDomain')?.value || 'company.com',
            phone: document.getElementById('phone')?.value || '[PHONE NUMBER]',
            maxRetail: document.getElementById('maxRetail')?.value || '5.00'
        };
    },

    // Format email content with multiple products support
    formatEmailContent: function(calc, formData) {
        const timestamp = new Date().toLocaleString();
        const userEmail = appState.currentUser?.email || '[YOUR EMAIL]';
        const userName = appState.currentUser?.name || '[YOUR NAME]';
        const quoteId = this.generateQuoteId();
        
        // Get the base template
        const template = this.getEmailTemplate('quote');
        
        // Handle multiple products or single product
        const isMultipleProducts = Array.isArray(calc);
        const calculations = isMultipleProducts ? calc : [calc];
        
        // Prepare product details
        const productDetails = this.formatProductDetails(calculations, isMultipleProducts);
        
        // Calculate payment info
        const grandTotal = isMultipleProducts 
            ? appState.lastMultiProductCalculation?.summary?.grandTotal || 0
            : calculations[0]?.raw?.total || 0;
            
        const requiresACH = grandTotal >= adminConfig.payment.achThreshold;
        const paymentInfo = this.getPaymentInfo(grandTotal, requiresACH);

        if (isMultipleProducts) {
            // Multiple products
            calculations.forEach((item, index) => {
                productDetails += `
**Product ${index + 1}: ${item.product.name}**
- Quantity: ${item.masterCases} Master Cases
- Display Boxes: ${item.displayBoxes}
- Individual Units: ${this.formatNumber(item.totalUnits)}
- Unit Price: ${item.unitPrice} (${item.tierInfo.name})
- Line Total: ${item.total}
`;
                grandTotal += item.raw.total;
                totalUnits += item.totalUnits;
                totalDisplayBoxes += item.displayBoxes;
            });
            
            // Add order-level totals for multi-product
            const multiResult = appState.lastMultiProductCalculation;
            if (multiResult && multiResult.summary) {
                productDetails += `
**Order Summary:**
- Subtotal: ${this.formatCurrency(multiResult.summary.subtotal)}
- Shipping: ${this.formatCurrency(multiResult.summary.shipping)}
- Credit Card Fee (3%): ${this.formatCurrency(multiResult.summary.creditCardFee)}
- **Grand Total: ${this.formatCurrency(multiResult.summary.grandTotal)}**
`;
                grandTotal = multiResult.summary.grandTotal;
            }
        } else {
            // Single product
            const item = calculations[0];
            productDetails = `
**${item.product.name}**
- Quantity: ${item.masterCases} Master Cases
- Display Boxes: ${item.displayBoxes}
- Individual Units: ${this.formatNumber(item.totalUnits)}
- Unit Price: ${item.unitPrice} (${item.tierInfo.name})
- Case Price: ${item.casePrice}
- Subtotal: ${item.subtotal}
- Shipping: ${item.shipping}
- Credit Card Fee (3%): ${item.creditCardFee}
- **Total: ${item.total}**
`;
            grandTotal = item.raw.total;
            totalUnits = item.totalUnits;
            totalDisplayBoxes = item.displayBoxes;
        }

        return `Subject: ${formData.quoteName} - Partnership Proposal

Hi there,

Thank you for your interest in partnering with Kanva Botanicals! We're excited about the opportunity to work with ${formData.companyName}.

## Partnership Overview

We'd like to move forward with the following quote for your ${formData.segment} customer base:

${productDetails}

${isMultipleProducts ? `
**Order Summary:**
- Total Display Boxes: ${this.formatNumber(totalDisplayBoxes)}
- Total Individual Units: ${this.formatNumber(totalUnits)}
- **Grand Total: ${this.formatCurrency(grandTotal)}**
` : ''}

### Pricing Guidelines
To maintain market stability and ensure fair margins for all partners in your area, we ask that your retail price to customers not exceed **$${formData.maxRetail}** per unit.

## Payment Information

${paymentInfo}

## Additional Product Opportunities

Our complete product line includes high-margin kratom capsules and powders (49-58% margins) that could be excellent additions for your experienced customers. Full catalog available upon request.

## Support Included
✅ **Retail Support** - In-store displays, POS materials, promotional strategies  
✅ **Sales Training** - Staff education and product knowledge support  
✅ **Marketing Assets** - Digital materials, window clings, branded displays  
✅ **Exclusive Offers** - Introductory pricing and promotional bundles  

## Next Steps

1. Review this proposal
2. Complete payment setup ${requiresACH ? '(DocuSign/ACH)' : ''}
3. Schedule delivery once payment is processed

We're excited about building a successful partnership with you and supporting your business growth in the functional beverage market.

Please contact us at ${formData.emailDomain} or ${formData.phone} if you have any questions.

Best regards,

${userName}  
Kanva Botanicals  
${userEmail}  
${formData.phone}

---
Generated on: ${timestamp}
Quote ID: ${this.generateQuoteId()}`;
    },

    // Get payment information based on total
    getPaymentInfo: function(total, requiresACH) {
        try {
            const templates = JSON.parse(localStorage.getItem('emailTemplates')) || {};
            const paymentTemplate = templates.payment || {};
            
            if (requiresACH) {
                return (paymentTemplate.ach_required || 'Since this order exceeds ${{achThreshold}}, payment will need to be processed via **ACH transfer**. I\'ll send over a DocuSign agreement that includes the ACH transfer details. Please provide a voided blank check for account verification.')
                    .replace('{{achThreshold}}', adminConfig.payment.achThreshold);
            } else {
                return paymentTemplate.standard_options || 'Payment options: ACH transfer, wire transfer, or company check.';
            }
        } catch (error) {
            console.error('Error loading payment info template:', error);
            return requiresACH 
                ? `Since this order exceeds $${adminConfig.payment.achThreshold}, payment will need to be processed via **ACH transfer**. I'll send over a DocuSign agreement that includes the ACH transfer details. Please provide a voided blank check for account verification.`
                : 'Payment options: ACH transfer, wire transfer, or company check.';
        }
    },
    
    // Helper method to get email template
    getEmailTemplate: function(templateName) {
        try {
            // Try to load from localStorage first
            const savedTemplates = localStorage.getItem('emailTemplates');
            if (savedTemplates) {
                const templates = JSON.parse(savedTemplates);
                if (templates[templateName]) {
                    return templates[templateName];
                }
            }
            
            // Fallback to default templates
            const defaultTemplates = {
                quote: {
                    subject: "{{quoteName}} - Partnership Proposal",
                    body: "Hi there,\n\nThank you for your interest in partnering with Kanva Botanicals! We're excited about the opportunity to work with {{companyName}}.\n\n## Partnership Overview\n\nWe'd like to move forward with the following quote for your {{segment}} customer base:\n\n{{productDetails}}\n\n{{orderSummary}}\n\n### Pricing Guidelines\nTo maintain market stability and ensure fair margins for all partners in your area, we ask that your retail price to customers not exceed **${{maxRetail}}** per unit.\n\n## Payment Information\n\n{{paymentInfo}}\n\n## Additional Product Opportunities\n\nOur complete product line includes high-margin kratom capsules and powders (49-58% margins) that could be excellent additions for your experienced customers. Full catalog available upon request.\n\n## Support Included\n✅ **Retail Support** - In-store displays, POS materials, promotional strategies  \n✅ **Sales Training** - Staff education and product knowledge support  \n✅ **Marketing Assets** - Digital materials, window clings, branded displays  \n✅ **Exclusive Offers** - Introductory pricing and promotional bundles  \n\n## Next Steps\n\n1. Review this proposal\n2. Complete payment setup {{achRequired}}\n3. Schedule delivery once payment is processed\n\nWe're excited about building a successful partnership with you and supporting your business growth in the functional beverage market.\n\nPlease contact us at {{emailDomain}} or {{phone}} if you have any questions.\n\nBest regards,\n\n{{userName}}  \nKanva Botanicals  \n{{userEmail}}  \n{{phone}}\n\n---\nGenerated on: {{timestamp}}\nQuote ID: {{quoteId}}"
                }
            };
            
            return defaultTemplates[templateName] || { subject: '', body: '' };
        } catch (error) {
            console.error('Error loading email template:', error);
            return { subject: '', body: '' };
        }
    },
    
    // Helper method to format product details
    formatProductDetails: function(calculations, isMultipleProducts) {
        let details = '';
        let summary = '';
        let totalUnits = 0;
        let totalDisplayBoxes = 0;
        let grandTotal = 0;

        if (isMultipleProducts) {
            // Multiple products
            calculations.forEach((item, index) => {
                details += `**Product ${index + 1}: ${item.product.name}**\n` +
                          `- Quantity: ${item.masterCases} Master Cases\n` +
                          `- Display Boxes: ${item.displayBoxes}\n` +
                          `- Individual Units: ${this.formatNumber(item.totalUnits)}\n` +
                          `- Unit Price: ${item.unitPrice} (${item.tierInfo.name})\n` +
                          `- Line Total: ${item.total}\n\n`;
                
                totalUnits += item.totalUnits;
                totalDisplayBoxes += item.displayBoxes;
            });

            // Add order summary for multiple products
            const multiResult = appState.lastMultiProductCalculation;
            if (multiResult?.summary) {
                summary = `**Order Summary:**\n` +
                         `- Total Display Boxes: ${this.formatNumber(totalDisplayBoxes)}\n` +
                         `- Total Individual Units: ${this.formatNumber(totalUnits)}\n` +
                         `- Subtotal: ${this.formatCurrency(multiResult.summary.subtotal)}\n` +
                         `- Shipping: ${this.formatCurrency(multiResult.summary.shipping)}\n` +
                         `- Credit Card Fee (3%): ${this.formatCurrency(multiResult.summary.creditCardFee)}\n` +
                         `- **Grand Total: ${this.formatCurrency(multiResult.summary.grandTotal)}**\n`;
                
                grandTotal = multiResult.summary.grandTotal;
            }
        } else {
            // Single product
            const item = calculations[0];
            details = `**${item.product.name}**\n` +
                     `- Quantity: ${item.masterCases} Master Cases\n` +
                     `- Display Boxes: ${item.displayBoxes}\n` +
                     `- Individual Units: ${this.formatNumber(item.totalUnits)}\n` +
                     `- Unit Price: ${item.unitPrice} (${item.tierInfo.name})\n` +
                     `- Case Price: ${item.casePrice}\n` +
                     `- Subtotal: ${item.subtotal}\n` +
                     `- Shipping: ${item.shipping}\n` +
                     `- Credit Card Fee (3%): ${item.creditCardFee}\n` +
                     `- **Total: ${item.total}**\n`;
            
            totalUnits = item.totalUnits;
            totalDisplayBoxes = item.displayBoxes;
            grandTotal = item.raw.total;
        }

        return {
            details: details,
            summary: summary,
            totalUnits: totalUnits,
            totalDisplayBoxes: totalDisplayBoxes,
            grandTotal: grandTotal
        };
    },
    
    // Load email templates from Firebase
    loadEmailTemplates: async function() {
        try {
            // Ensure Firebase Data Service is available
            if (!window.firebaseDataService) {
                console.error('❌ Firebase Data Service not available');
                throw new Error('Firebase Data Service not initialized');
            }
            
            // Load templates from Firebase
            const templates = await window.firebaseDataService.fetchData('/data/email-templates.json');
            
            // Cache in Firebase for offline use (replaces localStorage)
            await window.firebaseDataService.setLocalStorage('emailTemplates', templates);
            
            console.log('✅ Email templates loaded from Firebase');
            return templates;
        } catch (error) {
            console.error('❌ Error loading email templates from Firebase:', error);
            
            // Try to use cached version from Firebase storage
            try {
                const cached = await window.firebaseDataService.getLocalStorage('emailTemplates');
                if (cached) {
                    console.log('📋 Using cached email templates from Firebase');
                    return cached;
                }
            } catch (cacheError) {
                console.error('❌ Error loading cached email templates:', cacheError);
            }
            
            // Return null if all attempts fail
            return null;
        }
    },

    // Display email in the interface
    displayEmail: function(content) {
        const emailTemplate = document.getElementById('emailTemplate');
        const emailOutput = document.getElementById('emailOutput');
        
        if (emailTemplate && emailOutput) {
            emailOutput.textContent = content;
            emailTemplate.style.display = 'block';
            emailTemplate.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Fallback: show in new window
            const newWindow = window.open('', '_blank', 'width=800,height=600');
            newWindow.document.write(`
                <html>
                    <head><title>Kanva Quote Email</title></head>
                    <body class="p-5 whitespace-pre-wrap">
                        ${content.replace(/\n/g, '<br>')}
                    </body>
                </html>
            `);
        }
    },

    // Copy email to clipboard
    copyEmail: function() {
        const emailOutput = document.getElementById('emailOutput');
        if (!emailOutput) {
            NotificationManager.showError('No email content found');
            return;
        }

        const emailText = emailOutput.textContent;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(emailText).then(() => {
                this.showCopySuccess();
                NotificationManager.showSuccess('Email copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy email:', err);
                this.fallbackCopyEmail(emailText);
            });
        } else {
            this.fallbackCopyEmail(emailText);
        }
    },

    // Fallback copy method
    fallbackCopyEmail: function(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showCopySuccess();
                NotificationManager.showSuccess('Email copied to clipboard!');
            } else {
                NotificationManager.showError('Failed to copy email');
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            NotificationManager.showError('Copy failed - please select and copy manually');
        }
        
        document.body.removeChild(textArea);
    },

    // Show copy success visual feedback
    showCopySuccess: function() {
        const copyBtn = document.querySelector('button[onclick="copyEmail()"]');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            copyBtn.style.background = '#4caf50';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        }
    },

    // Export email as file
    exportEmail: function(format = 'text') {
        const emailOutput = document.getElementById('emailOutput');
        if (!emailOutput) {
            NotificationManager.showError('No email content found');
            return;
        }

        const content = emailOutput.textContent;
        const quoteName = document.getElementById('quoteName')?.value || 'quote';
        const timestamp = new Date().toISOString().split('T')[0];
        
        let filename, mimeType, fileContent;
        
        if (format === 'html') {
            filename = `${quoteName}-${timestamp}.html`;
            mimeType = 'text/html';
            fileContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Kanva Botanicals Quote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Keep any custom styles that can't be handled by Tailwind */
        body { max-width: 800px; }
    </style>
</head>
<body class="mx-auto my-8 px-5">
    <div class="bg-gray-50 p-4 rounded-lg mb-5">
        <h1 class="text-2xl font-bold text-kanva-dark mb-2">Kanva Botanicals Quote</h1>
        <p class="text-gray-600">Generated: ${new Date().toLocaleString()}</p>
    </div>
    <div class="whitespace-pre-wrap">${content.replace(/\n/g, '<br>')}</div>
</body>
</html>`;
        } else {
            filename = `${quoteName}-${timestamp}.txt`;
            mimeType = 'text/plain';
            fileContent = content;
        }

        try {
            const blob = new Blob([fileContent], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
            
            NotificationManager.showSuccess(`Email exported as ${filename}`);
        } catch (error) {
            console.error('Export failed:', error);
            NotificationManager.showError('Failed to export email');
        }
    },

    // Generate follow-up email
    generateFollowUpEmail: function() {
        const formData = this.getFormData();
        const followUpContent = `Subject: Following up on ${formData.quoteName}

Hi there,

I wanted to follow up on the quote I sent for ${formData.companyName}. 

Have you had a chance to review the proposal? I'm here to answer any questions you might have about:

- Product specifications and benefits
- Pricing and payment terms
- Implementation timeline
- Marketing support and materials

I'd love to schedule a brief call to discuss how Kanva Botanicals can support your business goals in the functional beverage market.

Please let me know what works best for your schedule.

Best regards,

${appState.currentUser?.name || '[YOUR NAME]'}
Kanva Botanicals
${appState.currentUser?.email || '[YOUR EMAIL]'}`;

        this.displayEmail(followUpContent);
    },

    // Generate negotiation email
    generateNegotiationEmail: function() {
        const calc = Calculator.calculateOrder();
        if (!calc.product) {
            NotificationManager.showError('Please calculate a quote first');
            return;
        }

        const formData = this.getFormData();
        const negotiationContent = `Subject: Flexible Options for ${formData.quoteName}

Hi there,

Thank you for your interest in our ${calc.product.name} products for ${formData.companyName}.

I understand that every business has unique needs and budget considerations. I'd love to work with you to find a solution that makes sense for your operation.

Here are some flexible options we can explore:

📦 **Volume Adjustments**: Different case quantities to meet your budget
💰 **Payment Terms**: Extended payment options for qualified partners
📈 **Growth Partnership**: Scaled pricing as your business grows
🎯 **Product Mix**: Alternative product combinations for different margins

Our goal is to build a long-term partnership that drives success for both of our businesses.

Would you be open to a brief conversation to discuss what would work best for ${formData.companyName}?

Best regards,

${appState.currentUser?.name || '[YOUR NAME]'}
Kanva Botanicals`;

        this.displayEmail(negotiationContent);
    },

    // Generate closing email
    generateClosingEmail: function() {
        const formData = this.getFormData();
        const closingContent = `Subject: Ready to Move Forward - ${formData.quoteName}

Hi there,

I hope this email finds you well! I wanted to reach out regarding the quote for ${formData.companyName}.

Based on our previous conversations, it seems like Kanva Botanicals would be a great fit for your ${formData.segment} customer base.

To move forward, I just need:

✅ Final confirmation on the order quantities
✅ Preferred delivery timeline  
✅ Payment method setup (ACH details if applicable)

Once we have these details, I can:
- Process your order immediately
- Schedule delivery within 5-7 business days
- Send you all the marketing materials and displays
- Set up your account for future orders

Is there anything else you need from me to move forward with this partnership?

Looking forward to working together!

Best regards,

${appState.currentUser?.name || '[YOUR NAME]'}
Kanva Botanicals
${appState.currentUser?.email || '[YOUR EMAIL]'}`;

        this.displayEmail(closingContent);
    },

    // Update quote name based on product selection
    updateQuoteNameFromProduct: function() {
        const productSelect = document.getElementById('primaryProduct');
        const companyNameInput = document.getElementById('companyName');
        const quoteNameInput = document.getElementById('quoteName');
        
        if (productSelect && companyNameInput && quoteNameInput && !quoteNameInput.value) {
            const productText = productSelect.selectedOptions[0]?.text || '';
            const productName = productText.split(' (')[0] || 'Product';
            const companyName = companyNameInput.value.trim();
            
            if (companyName) {
                quoteNameInput.value = `${productName} Quote for ${companyName}`;
            }
        }
    },

    // Send email via CRM
    sendEmailViaCRM: function() {
        const emailOutput = document.getElementById('emailOutput');
        if (!emailOutput) {
            NotificationManager.showError('No email content found');
            return;
        }

        const emailContent = emailOutput.textContent;
        
        if (appState.sdk && appState.sdk.logActivity) {
            try {
                const activityData = {
                    type: 1, // Email activity type
                    details: `KANVA QUOTE EMAIL SENT\n\n${emailContent}`,
                    subject: document.getElementById('quoteName')?.value || 'Kanva Quote'
                };
                
                appState.sdk.logActivity(activityData.type, activityData.details);
                NotificationManager.showSuccess('Email logged in CRM!');
                
                if (CopperIntegration.refreshCopperUI) {
                    CopperIntegration.refreshCopperUI();
                }
            } catch (error) {
                console.error('❌ Error logging email to CRM:', error);
                NotificationManager.showError('Failed to log email in CRM');
            }
        } else {
            NotificationManager.showInfo('CRM integration not available - email content ready to copy');
        }
    },

    // Utility functions
    formatNumber: function(number) {
        return new Intl.NumberFormat('en-US').format(number);
    },

    formatCurrency: function(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    },

    generateQuoteId: function() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `KB-${timestamp}-${random}`.toUpperCase();
    }
};

// Global functions for HTML onclick handlers
function generateEmail() {
    EmailGenerator.generateEmail();
}

function copyEmail() {
    EmailGenerator.copyEmail();
}

function exportEmail(format) {
    EmailGenerator.exportEmail(format);
}

function generateFollowUpEmail() {
    EmailGenerator.generateFollowUpEmail();
}

function generateNegotiationEmail() {
    EmailGenerator.generateNegotiationEmail();
}

function generateClosingEmail() {
    EmailGenerator.generateClosingEmail();
}

function sendEmailViaCRM() {
    EmailGenerator.sendEmailViaCRM();
}

console.log('✅ Email generator module loaded successfully');
