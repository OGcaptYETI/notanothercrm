/**
 * Order Details Manager
 * Handles line item display, PDF generation, and email integration
 */
class OrderDetailsManager {
    constructor(calculator) {
        this.calculator = calculator;
        this.logoPath = 'assets/logo/kanva-logo.png'; // Default logo path
    }

    /**
     * Render detailed line items display
     */
    renderLineItemDetails() {
        const container = document.getElementById('lineItemDetails');
        
        // Robust safety checks
        if (!container) return;
        
        if (!this.calculator || 
            !this.calculator.quote || 
            !this.calculator.quote.lineItems || 
            !this.calculator.quote.lineItems.length) {
            container.innerHTML = `
                <div class="empty-line-items">
                    <p class="text-muted">Add products to see detailed line items...</p>
                </div>
            `;
            return;
        }
        
        // Log current pricing mode for debugging
        console.log(`📜 Rendering order details with pricing mode: ${this.calculator.isRetailMode ? 'Retail' : 'Distribution'}`);
        
        // Ensure line items have the latest pricing information
        this.updateLineItemPricing();

        let html = `
            <div class="line-items-table-container">
                <table class="line-items-table">
                    <thead>
                        <tr>
                            <th class="col-thumbnail">Image</th>
                            <th class="col-item">Item</th>
                            <th class="col-item-number">Item Number</th>
                            <th class="col-description">Description</th>
                            <th class="col-quantity">Quantity</th>
                            <th class="col-unit-price">Unit Price</th>
                            <th class="col-line-total">Line Total</th>
                            <th class="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.calculator.quote.lineItems.forEach((item, index) => {
            const product = item.productData || {};
            const productImage = product.image || 'assets/logo/kanva-logo.png';
            const itemNumber = product.sku || product.id || `ITEM-${index + 1}`;
            const description = product.description || 'No description available';
            
            // Check if we have base prices for comparison (tier pricing)
            const hasTierPricing = this.calculator.quote.tierInfo && 
                                this.calculator.quote.tierInfo.discount > 0 && 
                                item.baseUnitPrice !== undefined &&
                                item.baseLineTotal !== undefined;
            
            const showOriginalPrice = hasTierPricing && 
                                  Math.abs(item.baseUnitPrice - item.unitPrice) > 0.01;
            
            html += `
                <tr class="line-item-row" data-line-id="${item.id}">
                    <td class="col-thumbnail">
                        <img src="${productImage}" alt="${product.name}" class="product-thumbnail" 
                             onerror="this.src='assets/logo/kanva-logo.png'">
                    </td>
                    <td class="col-item">
                        <strong>${product.name || 'Unknown Product'}</strong>
                    </td>
                    <td class="col-item-number">
                        ${itemNumber}
                    </td>
                    <td class="col-description">
                        ${description}
                    </td>
                    <td class="col-quantity">
                        <div class="quantity-info">
                            <div><strong>${item.cases}</strong> Master Cases</div>
                            <div class="text-muted">${item.displayBoxes} Display Boxes</div>
                            <div class="text-muted">${item.cases * item.unitsPerCase} Units</div>
                        </div>
                    </td>
                    <td class="col-unit-price">
                        ${showOriginalPrice ? `
                            <div class="original-price">$${item.baseUnitPrice.toFixed(2)}</div>
                            <div class="discounted-price">$${item.unitPrice.toFixed(2)}</div>
                        ` : `
                            $${item.unitPrice.toFixed(2)}
                        `}
                    </td>
                    <td class="col-line-total">
                        ${showOriginalPrice ? `
                            <div class="original-price">$${item.baseLineTotal.toFixed(2)}</div>
                            <div class="discounted-price"><strong>$${item.lineTotal.toFixed(2)}</strong></div>
                        ` : `
                            <strong>$${item.lineTotal.toFixed(2)}</strong>
                        `}
                    </td>
                    <td class="col-actions">
                        <button class="btn-delete-line" onclick="calculator.deleteLineItem('${item.id}')" 
                                title="Delete this line item">
                            ×
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        // Add tier information if available
        if (this.calculator.quote.tierInfo) {
            const tierInfo = this.calculator.quote.tierInfo;
            const subtotalBeforeDiscount = tierInfo.subtotalBeforeDiscount || this.calculator.quote.subtotal;
            const totalDiscount = tierInfo.totalDiscount || 0;
            
            // Add tier discount row to the table
            html += `
                <tfoot>
                    <tr class="subtotal-row">
                        <td colspan="5" class="text-right"><strong>Subtotal Before Discount:</strong></td>
                        <td colspan="3" class="text-right"><strong>$${subtotalBeforeDiscount.toFixed(2)}</strong></td>
                    </tr>
                    <tr class="discount-row">
                        <td colspan="5" class="text-right">
                            <strong>Tier Discount (${tierInfo.discount}%):</strong>
                            <div class="tier-badge">
                                <span class="tier-label">${tierInfo.tier.toUpperCase()}</span>
                                <span class="tier-volume">${tierInfo.totalCases} Master Cases</span>
                            </div>
                        </td>
                        <td colspan="3" class="text-right">
                            <strong>-$${totalDiscount.toFixed(2)}</strong>
                        </td>
                    </tr>
                    <tr class="subtotal-row">
                        <td colspan="5" class="text-right"><strong>Subtotal After Discount:</strong></td>
                        <td colspan="3" class="text-right"><strong>$${this.calculator.quote.subtotal.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Generate professional PDF quote
     */
    async generatePDF() {
        try {
            // Check if jsPDF is available
            if (typeof window.jsPDF === 'undefined') {
                console.warn('jsPDF not loaded, loading from CDN...');
                await this.loadJsPDF();
            }

            const { jsPDF } = window;
            const doc = new jsPDF();

            // Add logo if available
            await this.addLogo(doc);

            // Add header
            this.addPDFHeader(doc);

            // Add customer info
            this.addCustomerInfo(doc);

            // Add line items
            this.addLineItems(doc);

            // Add totals
            this.addTotals(doc);

            // Add footer
            this.addPDFFooter(doc);

            // Generate filename
            const companyName = document.getElementById('companyName')?.value || 'Customer';
            const date = new Date().toISOString().split('T')[0];
            const filename = `Kanva_Quote_${companyName.replace(/\s+/g, '_')}_${date}.pdf`;

            // Save PDF
            doc.save(filename);

            console.log('✅ PDF generated successfully:', filename);
            return doc;

        } catch (error) {
            console.error('❌ Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    /**
     * Load jsPDF from CDN if not available
     */
    async loadJsPDF() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Add logo to PDF
     */
    /**
     * Update line item pricing based on current pricing mode
     */
    updateLineItemPricing() {
        if (!this.calculator || !this.calculator.quote || !this.calculator.quote.lineItems) return;
        
        // Update each line item with the current pricing based on mode
        this.calculator.quote.lineItems.forEach(item => {
            if (!item.productData) return;
            
            // Get the product data
            const product = item.productData;
            
            // Skip if custom price is set
            if (item.customUnitPrice !== undefined) {
                console.log(`💳 Using custom price for ${product.name}: $${item.customUnitPrice.toFixed(2)}`);
                return;
            }
            
            // Get current price based on pricing mode
            const currentPrice = this.calculator.getCurrentPrice(product);
            
            // Update unit price
            item.unitPrice = currentPrice;
            
            // Calculate line total (don't double-count master cases and display boxes)
            // Master cases take precedence since display boxes are calculated from them
            let totalUnits;
            if (item.cases > 0) {
                // Use master cases calculation
                totalUnits = item.cases * (product.unitsPerCase || 144);
                console.log(`📦 Order details using master cases: ${item.cases} cases × ${product.unitsPerCase || 144} units = ${totalUnits} units`);
            } else {
                // Use display boxes calculation
                totalUnits = item.displayBoxes * 12;
                console.log(`📦 Order details using display boxes: ${item.displayBoxes} boxes × 12 units = ${totalUnits} units`);
            }
            item.lineTotal = currentPrice * totalUnits;
            
            console.log(`💸 Updated ${product.name} price to $${currentPrice.toFixed(2)} (${this.calculator.isRetailMode ? 'Retail' : 'Distribution'} mode)`);
        });
    }
    
    async addLogo(doc) {
        try {
            // Try to load logo image
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            return new Promise((resolve) => {
                img.onload = () => {
                    try {
                        doc.addImage(img, 'PNG', 20, 15, 40, 15);
                    } catch (e) {
                        console.warn('Could not add logo to PDF:', e);
                    }
                    resolve();
                };
                img.onerror = () => {
                    console.warn('Logo not found, continuing without logo');
                    resolve();
                };
                img.src = this.logoPath;
            });
        } catch (error) {
            console.warn('Error loading logo:', error);
        }
    }

    /**
     * Add PDF header
     */
    addPDFHeader(doc) {
        // Company info
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('KANVA BOTANICALS', 70, 25);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Premium Hemp Products', 70, 32);
        doc.text('www.kanvabotanicals.com', 70, 37);

        // Quote title
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('PRODUCT QUOTE', 20, 55);

        // Date and quote number
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const date = new Date().toLocaleDateString();
        const quoteNum = 'Q' + Date.now().toString().slice(-6);
        doc.text(`Date: ${date}`, 140, 55);
        doc.text(`Quote #: ${quoteNum}`, 140, 62);

        // Line separator
        doc.setLineWidth(0.5);
        doc.line(20, 70, 190, 70);
    }

    /**
     * Add customer information to PDF
     */
    addCustomerInfo(doc) {
        let yPos = 80;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('CUSTOMER INFORMATION', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        const fields = [
            { label: 'Company:', id: 'companyName' },
            { label: 'Segment:', id: 'customerSegment' },
            { label: 'State:', id: 'customerState' },
            { label: 'Email:', id: 'emailDomain' },
            { label: 'Phone:', id: 'phoneNumber' }
        ];

        fields.forEach(field => {
            const value = document.getElementById(field.id)?.value || 'Not specified';
            doc.text(`${field.label} ${value}`, 20, yPos);
            yPos += 6;
        });

        return yPos + 10;
    }

    /**
     * Add line items table to PDF
     */
    addLineItems(doc) {
        let yPos = 140;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('ORDER DETAILS', 20, yPos);
        
        yPos += 10;
        
        // Table headers
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Product', 20, yPos);
        doc.text('Cases', 80, yPos);
        doc.text('Display Boxes', 105, yPos);
        doc.text('Unit Price', 140, yPos);
        doc.text('Total', 170, yPos);
        
        yPos += 5;
        doc.setLineWidth(0.3);
        doc.line(20, yPos, 190, yPos);
        yPos += 8;

        // Robust safety checks
        if (!this.calculator || 
            !this.calculator.quote || 
            !this.calculator.quote.lineItems || 
            !this.calculator.quote.lineItems.length) {
            return yPos;
        }

        // Line items
        doc.setFont(undefined, 'normal');
        this.calculator.quote.lineItems.forEach(item => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 30;
            }
            
            doc.text(item.product.name, 20, yPos);
            doc.text(item.masterCases.toString(), 80, yPos);
            doc.text(item.displayBoxes.toString(), 105, yPos);
            doc.text(`$${item.unitPrice.toFixed(2)}`, 140, yPos);
            doc.text(`$${item.lineTotal.toFixed(2)}`, 170, yPos);
            yPos += 8;
        });

        return yPos + 10;
    }

    /**
     * Add totals section to PDF
     */
    addTotals(doc) {
        let yPos = 220;
        
        // Totals box
        doc.setLineWidth(0.5);
        doc.rect(130, yPos, 60, 40);
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        doc.text('Subtotal:', 135, yPos);
        doc.text(`$${this.calculator.quote.subtotal.toFixed(2)}`, 175, yPos);
        yPos += 8;
        
        doc.text('Shipping:', 135, yPos);
        doc.text(`$${this.calculator.quote.shipping.toFixed(2)}`, 175, yPos);
        yPos += 8;
        
        if (this.calculator.quote.creditCardFee > 0) {
            doc.text('Credit Card Fee:', 135, yPos);
            doc.text(`$${this.calculator.quote.creditCardFee.toFixed(2)}`, 175, yPos);
            yPos += 8;
        }
        
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL:', 135, yPos);
        doc.text(`$${this.calculator.quote.total.toFixed(2)}`, 175, yPos);
    }

    /**
     * Add footer to PDF
     */
    addPDFFooter(doc) {
        const pageHeight = doc.internal.pageSize.height;
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text('Thank you for your business! This quote is valid for 30 days.', 20, pageHeight - 20);
        doc.text('For questions, contact: sales@kanvabotanicals.com', 20, pageHeight - 15);
    }

    /**
     * Email quote with PDF attachment
     */
    async emailQuote() {
        try {
            // Generate PDF first
            const pdf = await this.generatePDF();
            if (!pdf) return;

            // Get PDF as blob
            const pdfBlob = pdf.output('blob');
            
            // Create email content
            const emailSubject = this.generateEmailSubject();
            const emailBody = this.generateEmailBody();
            
            // If Copper SDK is available, use it
            if (window.copperSDK) {
                await this.sendViaCopper(emailSubject, emailBody, pdfBlob);
            } else {
                // Fallback to mailto with body
                this.openMailtoLink(emailSubject, emailBody);
            }
            
        } catch (error) {
            console.error('❌ Error emailing quote:', error);
            alert('Error sending email. Please try again.');
        }
    }

    /**
     * Generate email subject
     */
    generateEmailSubject() {
        const companyName = document.getElementById('companyName')?.value || 'Your Company';
        return `Kanva Botanicals Product Quote - ${companyName}`;
    }

    /**
     * Generate email body
     */
    generateEmailBody() {
        const companyName = document.getElementById('companyName')?.value || 'Valued Customer';
        const total = this.calculator.quote.total.toFixed(2);
        
        return `Dear ${companyName},

Thank you for your interest in Kanva Botanicals premium hemp products!

Please find attached your personalized product quote totaling $${total}.

ORDER SUMMARY:
${this.calculator.quote.lineItems.map(item => 
    `• ${item.product.name}: ${item.masterCases} cases (${item.displayBoxes} display boxes) - $${item.lineTotal.toFixed(2)}`
).join('\n')}

Subtotal: $${this.calculator.quote.subtotal.toFixed(2)}
Shipping: $${this.calculator.quote.shipping.toFixed(2)}
${this.calculator.quote.creditCardFee > 0 ? `Credit Card Fee: $${this.calculator.quote.creditCardFee.toFixed(2)}\n` : ''}Total: $${this.calculator.quote.total.toFixed(2)}

NEXT STEPS:
• This quote is valid for 30 days
• Orders over $10,000 qualify for waived credit card fees
• Free shipping available on qualifying orders
• Net 30 payment terms available for approved accounts

We're here to help you succeed! Please don't hesitate to reach out with any questions.

Best regards,
The Kanva Botanicals Sales Team

📧 sales@kanvabotanicals.com
🌐 www.kanvabotanicals.com
📱 [Phone Number]

---
This email was generated by the Kanva Quote Calculator.`;
    }

    /**
     * Send email via Copper CRM
     */
    async sendViaCopper(subject, body, pdfBlob) {
        try {
            // Implementation would depend on Copper SDK
            console.log('📧 Sending via Copper CRM...');
            // await copperSDK.sendEmail({ subject, body, attachments: [pdfBlob] });
        } catch (error) {
            console.error('Error sending via Copper:', error);
            this.openMailtoLink(subject, body);
        }
    }

    /**
     * Open mailto link as fallback
     */
    openMailtoLink(subject, body) {
        const emailTo = document.getElementById('emailDomain')?.value || '';
        const mailto = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto);
    }
}

// Global instance
let orderDetails = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for calculator to be ready
    const initOrderDetails = () => {
        if (window.calculator && window.calculator.isReady) {
            orderDetails = new OrderDetailsManager(window.calculator);
            console.log('✅ Order Details Manager initialized');
        } else {
            setTimeout(initOrderDetails, 100);
        }
    };
    initOrderDetails();
});