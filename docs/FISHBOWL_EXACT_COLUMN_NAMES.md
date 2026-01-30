# Fishbowl CSV - EXACT Column Names for Report

## Instructions for Building Your Report

Use these **EXACT** column names in your Fishbowl report (case-sensitive).
Order them in your report exactly as shown below for best compatibility.

---

## ✅ REQUIRED COLUMNS (Must Have)

These fields are absolutely required for the import to work:

1. **Sales order Number** - Order number (e.g., "50001")
2. **Sales Order ID** - Internal Fishbowl order ID (numeric, unique per order)
3. **SO Item ID** - Line item ID (unique per line item within order)
4. **Account ID** - Customer ID/Account number
5. **Customer Name** - Customer/company name
6. **Sales Rep** - Full sales rep name (e.g., "Ben Wallner", "Jared Leuzinger")
7. **Issued date** - Order date (MM/DD/YYYY or any standard date format)
8. **SO Item Product Number** - Product SKU/Part number
9. **Total Price** - Line item total revenue/price

---

## ⚠️ CRITICAL COLUMNS (Strongly Recommended)

These are technically optional but cause major issues if missing:

10. **Qty fulfilled** - Quantity shipped/fulfilled (numeric)
    - If missing, system defaults to 1
    - Commission calculation skips orders with qty=0
    
11. **Unit price** - Unit price per item
    - Used to calculate Total Price if missing
    - Used for validation

12. **Product Description** - Product name/description
    - **CRITICAL** for excluding "Shipping" and "Credit Card Processing Fee" from commissions
    - If missing, shipping/CC fees will be included in commission calculations

---

## 📊 OPTIONAL COLUMNS (Nice to Have)

These fields are used for reporting, margins, and fallback logic:

13. **Total cost** - Line item cost/COGS (for margin reports)
14. **Sales Rep Initials** - Rep initials (e.g., "BW", "JL", "DW", "BG")
15. **Billing Address** - Customer billing street address
16. **Billing City** - Customer billing city
17. **Billing State** - Customer billing state
18. **Billing Zip** - Customer billing zip code
19. **Year-month** - Date fallback when Issued date parsing fails (e.g., "December 2025")
20. **Default Sales Rep** - Sales rep fallback for line items when Sales Rep is empty
21. **Sales man initials** - Alternative field name for Sales Rep Initials (legacy support)

---

## 🔄 FALLBACK COLUMNS (Alternative Names)

If you can't use the exact names above, the system will also accept these alternatives:

**For Sales Rep:**
- "Sales person"
- "Salesperson"
- "SalesRep"
- "Default Sales Rep"

**For Account ID:**
- "Customer id"
- "CustomerId"
- "accountNumber"

**For Issued date:**
- "Posting Date"
- "Issue Date"
- "Order Date"

**For SO Item Product Number:**
- "Product"
- "Product ID"
- "SKU"
- "Sku"

**For Total Price:**
- "Revenue"
- "Order value"
- "Line Total"

**For Product Description:**
- "Product desc"
- "Description"
- "Item Description"
- "SO Item Description"

**For Qty fulfilled:**
- "Quantity"
- "Qty"
- "Quantity Fulfilled"

**For Unit price:**
- "Unit Price"
- "UnitPrice"
- "Price"

**For Total cost:**
- "Invoiced cost"
- "Cost"
- "Total Cost"
- "COGS"

---

## 📋 COMPLETE RECOMMENDED COLUMN ORDER

Here's the complete list in recommended order for your report:

```
1.  Sales order Number
2.  Sales Order ID
3.  SO Item ID
4.  Account ID
5.  Customer Name
6.  Sales Rep
7.  Sales Rep Initials
8.  Issued date
9.  SO Item Product Number
10. Product Description
11. Qty fulfilled
12. Unit price
13. Total Price
14. Total cost
15. Billing Address
16. Billing City
17. Billing State
18. Billing Zip
19. Year-month
20. Default Sales Rep
21. Sales man initials
```

---

## CRITICAL SUCCESS FACTORS

**For commission calculations to work correctly:**

1. ✅ **Sales Rep** must be full name (not initials)
   - Good: "Ben Wallner"
   - Bad: "BW"

2. ✅ **Product Description** must include shipping/CC fee names
   - System looks for "Shipping" or "Credit Card Processing Fee"
   - These will be automatically excluded from commissions

3. ✅ **Qty fulfilled** should be actual quantity
   - If missing or 0 on ALL line items, order is skipped from commissions
   - System now defaults to 1 if column is missing

4. ✅ **Total Price** is the line item total
   - If missing, system calculates: Unit price × Qty fulfilled
   - This is the base for commission calculations

5. ✅ **Sales Order ID** must be unique per order
   - Used to join orders to line items
   - Critical for deduplication

6. ✅ **SO Item ID** must be unique per line item
   - Used to prevent double-counting in commissions
   - Critical for accurate revenue totals

---

## 💾 DATA TYPE EXPECTATIONS

- **Dates**: Any standard format (MM/DD/YYYY, YYYY-MM-DD, etc.)
- **Numbers**: Can include commas (e.g., "1,234.56") - system strips them
- **Text**: Standard text, system trims whitespace
- **IDs**: Can be text or numeric, commas will be removed

---

## 🚀 TESTING CHECKLIST

After building your report with these column names:

- [ ] Export sample CSV with a few orders
- [ ] Check all 9 required columns are present
- [ ] Verify Qty fulfilled has values (not all zeros)
- [ ] Confirm Product Description shows "Shipping" and "Credit Card Processing Fee" for those line items
- [ ] Check Sales Rep shows full names
- [ ] Upload to Fishbowl import page
- [ ] Verify normalization shows all fields mapped with "exact" confidence
- [ ] Import and check commission calculation includes correct order counts

---

## 📞 NOTES

- Column order doesn't matter functionally, but recommended order above is logical
- Extra columns in your report won't cause issues (they'll be ignored)
- Case-sensitive: Use exact capitalization shown
- Spaces matter: "Sales Rep" ≠ "SalesRep" (though system has fallbacks)

**Best Practice:** Use the exact names from "COMPLETE RECOMMENDED COLUMN ORDER" section above for zero issues.
