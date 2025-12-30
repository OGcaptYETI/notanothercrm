# CSV Column Reference - SINGLE SOURCE OF TRUTH

**Last Updated:** December 30, 2025

This document defines the EXACT column names from the Fishbowl CSV export. ALL code must use these exact names (case-sensitive).

---

## 📋 **Official CSV Column Names**

These are the ONLY columns that exist in the Fishbowl export:

```
Issued date
Year-month
Year-quarter
Year-week
Year
Account ID
Account type
Billing Name
Billing Address
Billing City
Billing State
Billing Zip
Customer Name
Sales Rep
Product ID
Product
Sales Rep Initials
Sales order Number
SO Status
Sales person
So c1
So c2
Sales Order Custom Field 3
So c4
Sales Order Custom Field 5
Sales Order Custom Field 6
Sales Order ID
SO Item ID
SO Item Product Number
Customer id
Product description
Sales Order Item Description
Soitem type
BOL
Carrier name
Company id
Company name
SO ID
Ship status
SO Number
Status ID
Account id
Qty fulfilled
Last Unit Price
So ct
Unit price
Total Price
Total cost
Sales Order Line Item
```

---

## 🔑 **Key Field Mappings**

### **Customer Identification:**
- `Customer id` (lowercase 'id') - Primary customer identifier
- `Account ID` (uppercase 'ID') - Account number
- `Customer Name` - Customer name

### **Sales Rep Information:**
- `Sales person` (lowercase 'p') - Sales person field
- `Sales Rep` (uppercase 'R') - Sales rep field
- `Sales Rep Initials` - Sales rep initials

### **Order Identification:**
- `Sales order Number` (lowercase 'order') - Order number
- `Sales Order ID` (uppercase 'Order') - Sales order ID
- `SO ID` - SO ID
- `BOL` - Bill of lading

### **Date Fields:**
- `Issued date` - **PRIMARY DATE FIELD** (when order was issued/closed)
- `Year-month` - Year-month
- `Year-quarter` - Year-quarter
- `Year-week` - Year-week
- `Year` - Year

### **Line Item Fields:**
- `SO Item ID` (uppercase 'Item') - Line item ID
- `SO Item Product Number` - Product number
- `Product` - Product name
- `Product ID` - Product ID
- `Product description` - Product description
- `Sales Order Item Description` - Item description

### **Financial Fields:**
- `Total Price` (uppercase 'Price') - Total price
- `Total cost` (lowercase 'cost') - Total cost
- `Unit price` (lowercase 'price') - Unit price
- `Last Unit Price` (uppercase 'Price') - Last unit price
- `Qty fulfilled` (lowercase 'fulfilled') - Quantity fulfilled

### **Account Type:**
- `Account type` (lowercase 't') - Account type (Wholesale, Distributor, Retail)

---

## ❌ **Fields That DO NOT EXIST**

These fields are commonly referenced in old code but DO NOT exist in the CSV:

- ~~`Default Sales Rep`~~ - Does not exist
- ~~`Sales man initials`~~ - Does not exist
- ~~`Account Type`~~ (uppercase 'T') - Wrong case, use `Account type`
- ~~`Account id`~~ (lowercase 'id') - Wrong case for account number, use `Account ID`
- ~~`Customer ID`~~ (uppercase 'ID') - Wrong case, use `Customer id`
- ~~`Issued Date`~~ (uppercase 'D') - Wrong case, use `Issued date`
- ~~`Date fulfillment`~~ - Does not exist
- ~~`Date fulfilled`~~ - Does not exist
- ~~`Fulfilment Date`~~ - Does not exist

---

## 🔧 **Code Usage Rules**

### **1. Import Code (fishbowl/import-unified/route.ts)**

**MUST use exact column names:**
```typescript
const customerId = row['Customer id'];           // ✅ Correct
const accountId = row['Account ID'];             // ✅ Correct
const salesPerson = row['Sales person'];         // ✅ Correct
const salesRep = row['Sales Rep'];               // ✅ Correct
const issuedDate = row['Issued date'];           // ✅ Correct
const accountType = row['Account type'];         // ✅ Correct
const orderNumber = row['Sales order Number'];   // ✅ Correct
```

**DO NOT use fallbacks that don't exist:**
```typescript
// ❌ WRONG - These columns don't exist
const salesRep = row['Sales Rep'] || row['Default Sales Rep'];
const accountType = row['Account Type'] ?? row['Account type'];
const customerId = row['Customer ID'] || row['Customer id'];
```

### **2. Commission Calculation (calculate-monthly-commissions/route.ts)**

Reads from **Firestore collections** (not CSV), so uses the field names written by import:
```typescript
order.customerId      // Written by import from row['Customer id']
order.salesPerson     // Written by import from row['Sales person']
order.customerName    // Written by import from row['Customer Name']
order.postingDate     // Written by import from row['Issued date']
order.commissionMonth // Calculated from row['Issued date']
```

### **3. Customer Summary Migration (migrate-customer-summary/route.ts)**

Same as commission calculation - reads from Firestore collections.

---

## ✅ **Verification Checklist**

Before deploying any code that reads Fishbowl data:

- [ ] All column references use exact case-sensitive names from this document
- [ ] No fallback columns that don't exist in the CSV
- [ ] `Issued date` is the ONLY date field used
- [ ] `Customer id` (lowercase) for customer identifier
- [ ] `Account ID` (uppercase) for account number
- [ ] `Sales person` (lowercase 'p') for sales person
- [ ] `Sales Rep` (uppercase 'R') for sales rep
- [ ] `Account type` (lowercase 't') for account type

---

## 🚀 **Import → Firestore → Calculations Flow**

```
CSV Column Name          → Firestore Field Name    → Used By
─────────────────────────────────────────────────────────────
'Issued date'           → postingDate             → Commission calc
'Issued date'           → commissionMonth         → Commission calc
'Customer id'           → customerId              → Commission calc
'Sales person'          → salesPerson             → Commission calc
'Sales Rep'             → salesRep                → Commission calc
'Customer Name'         → customerName            → Commission calc
'Account type'          → accountType             → Commission calc
'Total Price'           → revenue                 → Commission calc
```

---

## 📝 **Notes**

- This is the **ONLY** dataset used going forward
- All code MUST match these exact column names
- Case sensitivity matters (e.g., `Customer id` ≠ `Customer ID`)
- No fallback columns - if a column doesn't exist in this list, don't use it
- Import code writes to Firestore using these column names
- Other processes read from Firestore (not CSV directly)
