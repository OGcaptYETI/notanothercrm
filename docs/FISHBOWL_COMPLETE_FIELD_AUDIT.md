# Complete Fishbowl Field Audit - All System Dependencies

## Audit Completed: Jan 29, 2026

This document lists **EVERY** field used across the entire system.

---

## 📊 Firebase Collections Schema

### `fishbowl_sales_orders` Collection
```typescript
{
  soNumber: string,              // FROM: Sales order Number
  salesOrderId: string,          // FROM: Sales Order ID
  customerId: string,            // FROM: Account ID
  customerName: string,          // FROM: Customer Name
  accountType: string,           // FROM: Copper Sync or defaulted
  salesPerson: string,           // FROM: Sales Rep (CRITICAL for commissions)
  salesRep: string,              // FROM: Sales Rep Initials (reporting only)
  postingDate: Timestamp,        // FROM: Issued date
  commissionMonth: string,       // CALCULATED from Issued date
  commissionYear: number,        // CALCULATED from Issued date
  commissionDate: Timestamp,     // CALCULATED from Issued date
  manuallyLinked: boolean,       // FLAG: manual customer correction
  excludeFromCommission: boolean, // FLAG: manual exclusion
  commissionNote: string,        // NOTE: why excluded
  updatedAt: Timestamp
}
```

### `fishbowl_soitems` Collection
```typescript
{
  soNumber: string,              // FROM: Sales order Number
  salesOrderId: string,          // FROM: Sales Order ID
  soItemId: string,              // FROM: SO Item ID (deduplication key)
  customerId: string,            // FROM: Account ID
  customerName: string,          // FROM: Customer Name
  product: string,               // FROM: SO Item Product Number
  productNum: string,            // FROM: SO Item Product Number
  partNumber: string,            // FROM: SO Item Product Number
  productName: string,           // FROM: Product Description (CRITICAL: shipping/CC exclusion)
  description: string,           // FROM: Product Description
  quantity: number,              // FROM: Qty fulfilled (CRITICAL: commission skip if 0)
  unitPrice: number,             // FROM: Unit price
  totalPrice: number,            // FROM: Total Price (CRITICAL: revenue base)
  totalCost: number,             // FROM: Total cost (margins)
  postingDate: Timestamp,        // FROM: Issued date
  commissionMonth: string,       // CALCULATED from Issued date
  commissionYear: number,        // CALCULATED from Issued date
  commissionDate: Timestamp,     // CALCULATED from Issued date
  salesPerson: string,           // FROM: Sales Rep (inherited from order)
  updatedAt: Timestamp
}
```

### `fishbowl_customers` Collection
```typescript
{
  id: string,                    // FROM: Account ID
  name: string,                  // FROM: Customer Name
  accountType: string,           // FROM: Copper Sync
  updatedAt: Timestamp,
  
  // Subcollection: sales_order_history
  // Stores copy of order data per customer
}
```

---

## 🔍 Fields Used By System Components

### Import Process (`import-unified/route.ts`)

**REQUIRED (causes skip if missing):**
1. ✅ `Sales order Number` → soNumber
2. ✅ `Sales Order ID` → salesOrderId
3. ✅ `SO Item ID` → soItemId
4. ✅ `Account ID` → customerId
5. ✅ `Customer Name` → customerName
6. ✅ `Sales Rep` → salesPerson
7. ✅ `Issued date` → commissionMonth/Year/Date

**USED WITH FALLBACKS:**
8. ⚠️ `Qty fulfilled` → quantity (defaults to 1 if missing)
9. ⚠️ `Unit price` → unitPrice (used to calculate totalPrice)
10. ✅ `Total Price` → totalPrice (or calculated from unit × qty)
11. ⚠️ `Total cost` → totalCost (optional)
12. ✅ `SO Item Product Number` → product, productNum, partNumber
   - Fallbacks: Sku, Product, Product ID
13. ⚠️ `Product Description` → productName, description
   - Fallbacks: SO Item Description, Description

**OPTIONAL REPORTING FIELDS:**
14. ⚠️ `Sales Rep Initials` → salesRep
   - Fallbacks: Sales man initials
15. ⚠️ `Default Sales Rep` → used as fallback for line item salesPerson
16. ⚠️ `Year-month` → fallback date parsing if Issued date fails
   - Format: "December 2025"
   
---

### Commission Calculation (`calculate-monthly-commissions/route.ts`)

**FROM ORDERS (fishbowl_sales_orders):**
- ✅ `salesOrderId` - CRITICAL (joins to line items)
- ✅ `salesPerson` - CRITICAL (determines commission recipient)
- ✅ `soNumber` or `num` - display/logging
- ✅ `customerId`, `customerNum`, `accountNumber` - customer lookup
- ✅ `customerName` - display
- ✅ `postingDate` - customer status calculation
- ⚠️ `excludeFromCommission` - manual skip flag
- ⚠️ `commissionNote` - exclusion reason

**FROM LINE ITEMS (fishbowl_soitems):**
- ✅ `soItemId` - CRITICAL (deduplication)
- ✅ `quantity` - CRITICAL (skip if all 0)
- ✅ `totalPrice` - CRITICAL (revenue)
- ⚠️ `unitPrice` - fallback revenue calculation
- ✅ `productName` - CRITICAL (shipping/CC exclusion)
- ✅ `productNum`, `partNumber` - spiff matching
- ⚠️ `product` - spiff matching fallback
- ⚠️ `description` - spiff matching fallback

---

### Validation API (`validate-commission-data/route.ts`)

**FROM ORDERS:**
- ✅ `salesOrderId`
- ✅ `salesPerson`
- ✅ `soNumber` or `num`
- ✅ `customerId`, `customerNum`, `accountNumber`
- ✅ `customerName`
- ⚠️ `manuallyLinked` - skip validation if manually fixed

**FROM LINE ITEMS:**
- ✅ `soItemId`, `soItemID`, `lineItemId`, `id` - deduplication
- ✅ `totalPrice` - revenue
- ✅ `unitPrice` - validation
- ✅ `quantity` - validation
- ⚠️ `productNum`, `partNumber` - display

---

### Commission Orders API (`commission-orders/route.ts`)

**LINE ITEM DISPLAY:**
- ⚠️ `productNum` or `partNumber` → productCode
- ⚠️ `productName` or `description` → productName
- ✅ `quantity`
- ✅ `unitPrice`
- ✅ `totalPrice` → lineTotal
- ⚠️ `image` - product image (optional)

---

## ❌ MISSING FIELDS NOT IN CURRENT SPEC

After comprehensive audit, I found **3 additional fields** being used:

### 1. **Year-month** (Date Fallback)
- **Purpose:** Fallback date parsing when Issued date fails
- **Format:** "December 2025", "January 2026"
- **Used By:** import-unified for commission month calculation
- **Priority:** MEDIUM (fallback only, but prevents import failures)

### 2. **Default Sales Rep** (Sales Rep Fallback)
- **Purpose:** Line item sales rep when main Sales Rep is empty
- **Used By:** import-unified line item processing
- **Priority:** LOW (rare fallback case)

### 3. **Sales man initials** (Sales Rep Initials Fallback)
- **Purpose:** Alternative field name for Sales Rep Initials
- **Used By:** import-unified order processing
- **Priority:** LOW (alternative field name)

### 4. **Sku** (Product Number Fallback)
- **Purpose:** Alternative field for SO Item Product Number
- **Already in spec as fallback**
- **Priority:** Already covered

### 5. **Product** (Product Number Fallback)
- **Purpose:** Another alternative for SO Item Product Number
- **Already in spec as fallback**
- **Priority:** Already covered

---

## 📋 RECOMMENDED ADDITIONS TO COLUMN SPEC

Add these to the optional section:

**19. Year-month** - Date fallback (format: "December 2025")
   - Used when Issued date parsing fails
   - Prevents order skips due to date issues
   
**20. Default Sales Rep** - Sales rep fallback for line items
   - Used when line item has empty Sales Rep
   - Inherits from order-level sales rep

**21. Sales man initials** - Alternative to Sales Rep Initials
   - Legacy field name support
   - Reporting only

---

## 🎯 COMPLETE FINAL COLUMN LIST (21 Fields)

### Required (9):
1. Sales order Number
2. Sales Order ID
3. SO Item ID
4. Account ID
5. Customer Name
6. Sales Rep
7. Issued date
8. SO Item Product Number
9. Total Price

### Critical (3):
10. Qty fulfilled
11. Unit price
12. Product Description

### Optional (9):
13. Total cost
14. Sales Rep Initials
15. Billing Address
16. Billing City
17. Billing State
18. Billing Zip
19. **Year-month** ← NEW
20. **Default Sales Rep** ← NEW
21. **Sales man initials** ← NEW

---

## 🔄 Alternative Field Names (Already Documented)

All fallback field names are already in the spec:
- Sku, Product, Product ID → SO Item Product Number
- Product desc, Description → Product Description
- Quantity, Qty → Qty fulfilled
- etc.

---

## ✅ AUDIT CONCLUSION

**Current spec covers:**
- ✅ All 9 required fields
- ✅ All 3 critical fields
- ✅ 6 of 9 optional fields

**Missing from spec:**
- ⚠️ Year-month (date fallback)
- ⚠️ Default Sales Rep (sales rep fallback)
- ⚠️ Sales man initials (alternative field name)

**Impact:** LOW
- These are fallback fields only
- Not required for normal operation
- User should include if available for robustness

---

## 🚀 RECOMMENDATION

**For your new Fishbowl report:**

1. **MUST INCLUDE (9):** All required fields
2. **STRONGLY RECOMMENDED (3):** Qty fulfilled, Unit price, Product Description
3. **RECOMMENDED (6):** Total cost, Sales Rep Initials, Billing fields
4. **OPTIONAL BUT HELPFUL (3):** Year-month, Default Sales Rep, Sales man initials

**Best Practice:** Include all 21 fields if possible for maximum robustness and fallback support.
