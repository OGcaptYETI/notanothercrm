# Commission Revenue Discrepancy - Issue & Resolution
**Date:** January 12, 2026  
**Status:** FIXED - Ready for Testing

---

## 🔴 THE PROBLEM

### Symptoms
- **Test Engine V2** shows: $582,599.67 total revenue
- **CSV File** shows: $1,638,823.27 total (or $1,622,617.80 excluding shipping/CC)
- **Missing Revenue:** ~$1,040,018 (63% of actual sales!)

### Example Order Discrepancy
**Order 9613 (Ben Wallner - CK Import and Distributing):**
- **CSV Shows:** KB-4000 product, 112 units, $68,544 total price
- **Firestore Had:** KB-4000 product, 0 units, $26,482.82 (COST, not PRICE!)
- **Error:** Using `totalCost` instead of `totalPrice`, and `quantity = 0`

---

## 🔍 ROOT CAUSE ANALYSIS

### Issue #1: Wrong CSV Column Names
The import code was looking for:
- `'Total Price'` (capital P) 
- `'Qty fulfilled'`

But Conversite CSV exports use:
- `'Total price'` (lowercase p)
- `'Fulfilled Quantity'`

**Result:** Import defaulted to 0 for quantities, and stored COST values in PRICE fields.

### Issue #2: Multiple Import Endpoints
There are THREE different import endpoints:
1. `/api/fishbowl/import-soitems` - **DOESN'T EXIST** (404 error)
2. `/api/fishbowl-goals/import-soitems` - Line items only (I fixed this one)
3. `/api/fishbowl-goals/import-unified` - **RECOMMENDED** (creates customers, orders, AND line items)

The UI was calling the wrong endpoint (#1), so my fixes weren't being used.

### Issue #3: Two Different Calculation Engines
1. **Test Engine V2** (`/api/calculate-commissions-v2`) - Uses `fishbowl_soitems` collection
2. **Main Calculator** (`/api/calculate-monthly-commissions`) - Uses `fishbowl_sales_orders` collection

The main calculator needs order-level data with aggregated totals, not just line items.

---

## ✅ FIXES APPLIED

### Fix #1: Updated Import UI
**File:** `c:\Projects\KanvaPortal\app\admin\tools\fishbowl-import\page.tsx`
- Changed endpoint from `/api/fishbowl/import-soitems` → `/api/fishbowl-goals/import-soitems`

### Fix #2: Fixed Unified Import CSV Column Names
**File:** `c:\Projects\KanvaPortal\app\api\fishbowl-goals\import-unified\route.ts`

**Changed:**
```typescript
// OLD (wrong):
revenue: parseFloat(row['Total Price'] || 0)
quantity: parseFloat(row['Qty fulfilled'] || 0)
totalPrice: parseFloat(row['Total Price'] || 0)

// NEW (correct):
revenue: parseFloat(row['Total price'] || row['Total Price'] || 0)
quantity: parseFloat(row['Fulfilled Quantity'] || row['Qty fulfilled'] || 0)
totalPrice: parseFloat(row['Total price'] || row['Total Price'] || 0)
```

**Also fixed in line items section:**
- `unitPrice`: Now reads `row['Unit price']`
- `qtyFulfilled`: Now reads `row['Fulfilled Quantity']`
- `margin`: Calculation updated to use correct fields

### Fix #3: Fixed Line Items Import
**File:** `c:\Projects\KanvaPortal\app\api\fishbowl-goals\import-soitems\route.ts`
- Added proper field priority: `row['Total price']` before `row['totalPrice']`
- Added proper field priority: `row['Fulfilled Quantity']` before `row['qtyFullfilled']`
- Added debug logging to verify correct values are being parsed

### Fix #4: Added Debug Logging to Test Engine V2
**File:** `c:\Projects\KanvaPortal\app\api\calculate-commissions-v2\route.ts`
- Added logging to show first 5 line items with all field values
- Helps verify what's actually stored in Firestore

---

## 📋 NEXT STEPS (TOMORROW MORNING)

### Step 1: Delete Old Data
Delete all documents from Firestore where `commissionMonth = '2025-12'`:
- Collection: `fishbowl_soitems`
- Collection: `fishbowl_sales_orders` (if exists)
- Collection: `fishbowl_customers` (optional - will be updated by import)

### Step 2: Re-Import Using Unified Import
1. Go to: **Admin → Tools → Fishbowl Import**
2. Use the **"Unified Fishbowl Import (RECOMMENDED)"** section
3. Upload: `C:\Projects\KanvaPortal\docs\image\december_2025.csv`
4. Click: **"🚀 Import Unified Report"**

This will create:
- ✅ Customers in `fishbowl_customers`
- ✅ Orders in `fishbowl_sales_orders` (with aggregated totals)
- ✅ Line items in `fishbowl_soitems` (with correct prices and quantities)

### Step 3: Run Main Calculator
1. Go to: **Commission Settings → Calculate Commissions**
2. Select: **December 2025** (or 2025-12)
3. Click: **"Calculate Commissions"**

**Expected Results:**
- Total Revenue: **~$1,622,617.80** (not $582,599.67)
- All 194 orders processed (not skipped due to zero quantity)
- Correct revenue by rep:
  - Zalak: ~$455,989
  - BenW: ~$364,436
  - DerekW: ~$317,437
  - BrandonG: ~$294,142
  - Jared: ~$190,613

### Step 4: Verify Test Engine V2
1. Go to: **Commission Settings → Test Engine V2**
2. Enter: **2025-12**
3. Click: **"Calculate"**

**Expected Debug Output:**
```
🔍 DEBUG Line Item 4:
   Doc ID: 23651_71100
   soNumber: 9613
   Product: KB-4000
   product: KB-4000
   quantity: 112          ← Should be 112, not 0
   totalPrice: 68544      ← Should be 68544, not 26482.82
   totalCost: 26482.82    ← Cost should be separate
```

---

## 📊 VALIDATION CHECKLIST

After re-import and calculation, verify:

- [ ] Total revenue matches CSV (~$1.6M, not $582k)
- [ ] Order 9613 shows $68,544 (not $26,482.82)
- [ ] Order 9620 shows $37,368 (not $12,668.90)
- [ ] All quantities are correct (not 0)
- [ ] No "ZERO QUANTITY ORDER DETECTED" warnings
- [ ] Revenue by rep matches CSV totals
- [ ] Commission rates are correct per rep's title

---

## 🔧 TECHNICAL DETAILS

### CSV Column Mapping (Conversite Export)
```
Conversite CSV          → Firestore Field
─────────────────────────────────────────
"Total price"           → totalPrice, revenue
"Fulfilled Quantity"    → quantity, qtyFulfilled
"Unit price"            → unitPrice
"Total cost"            → totalCost, invoicedCost
"Sales order Number"    → soNumber, salesOrderNum
"Sales Order ID"        → salesOrderId
"SO Item ID"            → lineItemId
"Product"               → product
"Sales person"          → salesPerson
"Customer Name"         → customerName
"Account ID"            → customerId
```

### Data Collections Structure
```
fishbowl_customers/
  └─ {customerId}/
      ├─ name
      ├─ accountType (Wholesale/Distributor/Retail)
      ├─ salesPerson
      └─ salesRep

fishbowl_sales_orders/
  └─ fb_so_{soNumber}/
      ├─ num (order number)
      ├─ revenue (aggregated total)
      ├─ commissionMonth
      ├─ salesPerson
      └─ customerId

fishbowl_soitems/
  └─ soitem_{lineItemId}/
      ├─ salesOrderNum
      ├─ product
      ├─ quantity
      ├─ totalPrice
      ├─ commissionMonth
      └─ salesPerson
```

---

## 🎯 SUCCESS CRITERIA

The fix is successful when:
1. ✅ Import completes with 615 line items created
2. ✅ Test Engine V2 shows ~$1,622,617.80 total revenue
3. ✅ Main Calculator shows ~$1,622,617.80 total revenue
4. ✅ No zero quantity warnings
5. ✅ Revenue by rep matches CSV totals
6. ✅ Individual order amounts match CSV (e.g., Order 9613 = $68,544)

---

## 📝 FILES MODIFIED

1. `c:\Projects\KanvaPortal\app\admin\tools\fishbowl-import\page.tsx`
   - Fixed import endpoint path

2. `c:\Projects\KanvaPortal\app\api\fishbowl-goals\import-unified\route.ts`
   - Fixed CSV column name mappings for Conversite format
   - Lines 263-264: Order revenue/orderValue
   - Lines 384-391: Line item financial data

3. `c:\Projects\KanvaPortal\app\api\fishbowl-goals\import-soitems\route.ts`
   - Fixed CSV column name mappings
   - Added debug logging
   - Lines 111-130: Field parsing and logging

4. `c:\Projects\KanvaPortal\app\api\calculate-commissions-v2\route.ts`
   - Added debug logging for first 5 line items
   - Lines 116-134: Debug output

---

## 💡 LESSONS LEARNED

1. **Always verify CSV column names** - Case sensitivity matters!
2. **Use the Unified Import** - It creates all three collections properly
3. **Check which endpoint the UI is calling** - Multiple endpoints can be confusing
4. **Add debug logging** - Helps verify what's actually in the database
5. **Test with real data** - The CSV totals were the key to finding the issue

---

**Status:** Ready for testing tomorrow morning. All code changes committed and ready to use.
