# Commission Calculation Fix Plan - January 2026

## 🚨 Critical Issue Identified

**Problem:** Commission calculations are missing ~$1.2M in revenue (65% of orders) due to customer account type misclassification and missing customer records.

### Expected vs Actual (December 2025)

**Fishbowl Source (Ground Truth):**
- admin: $556,943.48
- Zalak: $426,664.40
- BenW: $363,940.70
- DerekW: $321,294.95
- BrandonG: $296,714.52
- Commerce: $261,480.94
- Jared: $192,940.70
- **Total: ~$2.42M**

**Current Calculation (Validation Shows):**
- Total Revenue: $613,497.18
- BrandonG: $108,555.46
- BenW: $145,654.33
- DerekW: $118,136.65
- Jared: $70,081.11
- Zalak: $171,069.63
- **Total: ~$613K**

**Missing: ~$1.8M (74% of revenue)**

---

## 🔍 Root Causes

### 1. **Retail Account Exclusion (Lines 476-480)**
```typescript
// Skip Retail accounts (no commission)
if (accountType === 'Retail') {
  skippedCounts.retail++;
  continue;
}
```

**Impact:** ALL orders from customers marked as "Retail" are excluded from commission calculations.

### 2. **Missing Customer Records (Lines 464-474)**
```typescript
const customer = customersMap.get(order.customerId) || 
                customersMap.get(order.customerNum) ||
                customersMap.get(order.accountNumber) ||
                customersMap.get(order.customerName);

// CRITICAL: Log ALL orders where customer is NOT found (defaults to Retail)
if (!customer) {
  console.log(`⚠️ CUSTOMER NOT FOUND - Defaulting to Retail:`);
  // ... logs details ...
  console.log(`   → Will be SKIPPED (Retail)`);
}

// Skip Retail accounts (no commission)
if (accountType === 'Retail') {
  skippedCounts.retail++;
  continue;
}
```

**Impact:** Orders with missing customer records default to "Retail" and are then skipped.

### 3. **No Orphaned Order Tracking**
The system doesn't track or report:
- How many orders are being excluded
- Which sales reps are affected
- Total revenue being lost
- Specific customer/order combinations causing issues

---

## ✅ Solution Implemented

### Enhanced Validation Endpoint (`/api/validate-commission-data`)

**New Features:**
1. **Orphaned Order Tracking** - Identifies orders excluded from commissions
2. **Customer Not Found Alerts** - Lists orders with missing customer records
3. **Retail Exclusion Tracking** - Shows orders from retail customers
4. **Rep-Level Breakdown** - Shows impact per sales rep
5. **Revenue Impact** - Calculates total lost commissions

**New Warning Types:**
- `customerNotFound` - Orders with missing customer records (severity: error)
- `retailExcluded` - Orders from retail customers (severity: warning)
- `orphanedOrders` - Summary of all excluded orders by rep (severity: error)

**Response Format:**
```json
{
  "warnings": [
    {
      "type": "customerNotFound",
      "severity": "error",
      "count": 150,
      "totalRevenue": 850000.00,
      "affectedReps": ["BenW", "DerekW", "BrandonG"],
      "message": "🚨 150 orders with MISSING CUSTOMER records",
      "details": ["Order 5811 | Customer ABC | $5000 | Rep: BenW", ...],
      "orderNumbers": ["5811", "5812", ...]
    },
    {
      "type": "retailExcluded",
      "severity": "warning",
      "count": 75,
      "totalRevenue": 350000.00,
      "affectedReps": ["Jared", "Zalak"],
      "message": "⚠️ 75 orders from RETAIL customers",
      "details": ["Order 5900 | Customer XYZ | $3000 | Rep: Jared", ...]
    },
    {
      "type": "orphanedOrders",
      "severity": "error",
      "count": 225,
      "totalRevenue": 1200000.00,
      "message": "🚨 ORPHANED COMMISSIONS: 225 orders ($1.2M) NOT being calculated",
      "details": [
        "BenW: 80 orders | $450000.00",
        "DerekW: 60 orders | $320000.00",
        "BrandonG: 50 orders | $280000.00",
        "Jared: 35 orders | $150000.00"
      ],
      "affectedReps": ["BenW", "DerekW", "BrandonG", "Jared"]
    }
  ]
}
```

---

## 🔧 Action Plan

### Step 1: Run Enhanced Validation (IMMEDIATE)

```bash
# In Commission Settings → Data & Sync tab
# Click "Calculate Commissions" button
# Select December 2025
# Review validation warnings
```

**Expected Output:**
- Total orders: 194
- Matched orders: ~50-60 (current)
- Orphaned orders: ~130-140
- Missing customer records: ~100+
- Retail excluded: ~30-40

### Step 2: Identify Customer Data Issues

The validation will show you:

**A. Missing Customer Records:**
```
🚨 150 orders with MISSING CUSTOMER records
- Order 5811 | ABC Company (ID: 270) | $5,000 | Rep: BenW
- Order 5812 | XYZ Corp (ID: 393) | $3,500 | Rep: DerekW
...
```

**Action:** These customers need to be imported into `fishbowl_customers` collection.

**B. Retail Misclassification:**
```
⚠️ 75 orders from RETAIL customers (EXCLUDED)
- Order 5900 | Honest Inc | $14,112 | Rep: DerekW
- Order 5901 | Raw Distribution | $3,600 | Rep: DerekW
...
```

**Action:** These customers should be Wholesale/Distributor, not Retail.

### Step 3: Fix Customer Data

**Option A: Re-import Fishbowl Customer Data**
1. Export customers from Fishbowl with correct account types
2. Import via Commission Settings → Data & Sync → Import Customers
3. Ensure account types are set correctly:
   - **Distributor** - Gets commissions
   - **Wholesale** - Gets commissions
   - **Retail** - NO commissions (house accounts only)

**Option B: Manual Customer Correction**
1. Go to Commission Settings → Customers tab
2. Filter by sales rep (e.g., "BenW")
3. Review customers marked as "Retail"
4. Change account type to "Wholesale" or "Distributor" as appropriate
5. Save changes

**Option C: Bulk Update via API** (Fastest for large datasets)
```typescript
// Create a script to update customer account types
const customersToFix = [
  { customerId: '270', accountType: 'Wholesale' },
  { customerId: '393', accountType: 'Distributor' },
  // ... more customers
];

for (const customer of customersToFix) {
  await adminDb.collection('fishbowl_customers')
    .doc(customer.customerId)
    .update({ accountType: customer.accountType });
}
```

### Step 4: Re-run Commission Calculation

After fixing customer data:
1. Go to Commission Settings → Calculate Commissions
2. Select December 2025
3. Click "Calculate Commissions"
4. Review validation - should show:
   - ✅ Orphaned orders: 0 (or minimal)
   - ✅ Total revenue matches Fishbowl source
   - ✅ Rep breakdown matches Fishbowl chart

### Step 5: Verify Results

**Expected Results After Fix:**
- BenW: ~$363,940 (currently $145,654) ✅
- DerekW: ~$321,294 (currently $118,136) ✅
- BrandonG: ~$296,714 (currently $108,555) ✅
- Jared: ~$192,940 (currently $70,081) ✅
- Zalak: ~$426,664 (currently $171,069) ✅

---

## 📊 Understanding the Data Flow

### Fishbowl CSV Import (Conversite Format)

**Key Fields:**
- **Column T: "Sales person"** - Who gets the commission (e.g., "Jared", "BenW", "DerekW")
- **Account type** - Customer classification (Distributor, Wholesale, Retail)
- **Customer id** - Links orders to customer records

### Commission Calculation Logic

```
FOR EACH ORDER:
  1. Get salesPerson from order (Column T)
  2. Get customer record by customerId
  3. IF customer NOT found:
       → Default to accountType = "Retail"
       → SKIP order (no commission)
  4. IF customer.accountType === "Retail":
       → SKIP order (no commission)
  5. ELSE:
       → Calculate commission
       → Save to monthly_commissions
```

**The Problem:**
- Step 3: Missing customers → Default to Retail → Skipped
- Step 4: Misclassified Retail → Skipped

---

## 🎯 Quick Reference

### Customer Account Types

| Account Type | Commission? | Use Case |
|--------------|-------------|----------|
| **Distributor** | ✅ YES | Wholesale distributors (higher volume) |
| **Wholesale** | ✅ YES | Wholesale accounts (standard volume) |
| **Retail** | ❌ NO | House accounts, internal orders, retail stores |

### Order Exclusions (Expected)

These orders SHOULD be excluded:
- ✅ Admin orders (`salesPerson: "admin"`)
- ✅ Shopify orders (`salesPerson: "SHOPIFY"` or `soNumber` starts with "Sh")
- ✅ Inactive rep orders (rep not in active users list)
- ✅ True retail customers (mom & pop shops, not wholesale)

These orders should NOT be excluded:
- ❌ Orders with missing customer records (need to import customers)
- ❌ Wholesale/distributor accounts marked as "Retail" (need to fix account type)

---

## 🚀 Testing Checklist

After implementing fixes:

- [ ] Run validation - 0 orphaned orders (or <5%)
- [ ] Total revenue matches Fishbowl source (±1%)
- [ ] BenW revenue: ~$363,940
- [ ] DerekW revenue: ~$321,294
- [ ] BrandonG revenue: ~$296,714
- [ ] Jared revenue: ~$192,940
- [ ] Zalak revenue: ~$426,664
- [ ] Admin orders excluded (expected)
- [ ] Shopify orders excluded (expected)
- [ ] All active reps have correct order counts
- [ ] Commission rates applied correctly per customer segment

---

## 📞 Next Steps

1. **Run the enhanced validation** (already deployed)
2. **Review the orphaned orders report** in the UI
3. **Identify which customers need fixing** (missing vs misclassified)
4. **Fix customer data** (re-import or manual update)
5. **Re-calculate commissions** for December 2025
6. **Verify totals match Fishbowl** source data

The validation endpoint will now give you the exact orders and customers causing issues, making it easy to identify and fix the data problems.
