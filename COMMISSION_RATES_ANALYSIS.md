# Commission Rates Analysis - December 2025
**Date:** January 13, 2026  
**Status:** ✅ Import Fixed | 🔍 Rates Under Review

---

## 🎉 SUCCESS: Revenue Import Fixed

**Total Revenue:** $1,638,823.27 ✅  
**Total Commissions:** $114,300.14  
**Effective Rate:** 6.98% (average across all orders)

**Orders Processed:**
- ✅ 179 commissioned orders
- ⚪ 15 retail (excluded)
- **194 total orders**

---

## 📊 Commission Results by Rep

| Rep | Orders | Revenue | Commission | Spiffs | Total | Avg Rate |
|-----|--------|---------|------------|--------|-------|----------|
| **Zalak Zaveri** | 25 | $460,936.40 | $36,874.91 | $0 | $36,874.91 | **8.00%** |
| **Ben Wallner** | 43 | $367,496.70 | $26,630.62 | $0 | $26,630.62 | **7.25%** |
| **Derek Whitworth** | 36 | $320,794.95 | $19,247.70 | $50 | $19,297.70 | **6.02%** |
| **Brandon Good** | 60 | $296,714.52 | $17,590.96 | $0 | $17,590.96 | **5.93%** |
| **Jared Leuzinger** | 30 | $192,880.70 | $13,955.96 | $0 | $13,955.96 | **7.24%** |

---

## 🔍 HOW COMMISSION RATES ARE DETERMINED

### Step 1: Load Commission Rate Collections

The calculation engine loads rates from **Firestore collections** based on job title:

```
settings/
  ├─ commission_rates_Account_Executive
  ├─ commission_rates_Account_Manager
  ├─ commission_rates_Jr._Account_Executive
  └─ commission_rates_Sr._Account_Executive
```

**Code Location:** `calculate-monthly-commissions/route.ts` lines 142-163

```typescript
const settingsSnapshot = await adminDb.collection('settings').get();
const commissionRatesByTitle = new Map();

settingsSnapshot.forEach(doc => {
  if (doc.id.startsWith('commission_rates_')) {
    const titleKey = doc.id.replace('commission_rates_', '').replace(/_/g, ' ');
    commissionRatesByTitle.set(titleKey, doc.data());
  }
});
```

### Step 2: Determine Customer Segment

**Source:** `fishbowl_customers.accountType` field

**Mapping:**
- `"Wholesale"` → `wholesale` segment
- `"Distributor"` → `distributor` segment  
- `"Retail"` → **EXCLUDED** (no commission)

**Code Location:** Lines 461-472

```typescript
let accountType = customer?.accountType || 'Retail';

// Normalize accountType to handle Copper array format
if (Array.isArray(accountType) && accountType.length > 0) {
  const typeId = accountType[0];
  if (typeId === 2063862) accountType = 'Wholesale';
  else if (typeId === 1981470) accountType = 'Distributor';
  else if (typeId === 2066840) accountType = 'Retail';
}
```

### Step 3: Determine Customer Status

**Logic:** Based on order history analysis

**Status Types:**
1. **`new`** (0-6 months old) → Maps to `new_business` → **8%**
2. **`6month`** (6-12 months old) → Maps to `6_month_active` → **4-7%**
3. **`12month`** (12+ months old) → Maps to `12_month_active` → **3-5%**
4. **`transferred`** (rep changed) → Maps to `transferred` → **2%**
5. **`own`** (dormant reactivated) → Maps to `new_business` → **8%**

**Code Location:** Lines 1004-1125 (`getCustomerStatus` function)

**Key Rules:**
- **Dormant Reactivation:** If customer hasn't ordered in 12+ months → `own` status → 8%
- **Rep Transfer:** If current rep ≠ previous rep → `transferred` → 2%
- **Reorg Rule:** Orders after July 1, 2025 with different historical rep → `transferred` → 2%
- **Customer Age:** Based on time since FIRST order (not last order)

### Step 4: Look Up Rate

**Code Location:** Lines 1131-1201 (`getCommissionRate` function)

```typescript
function getCommissionRate(
  commissionRates: any,
  title: string,        // e.g., "Account Executive"
  segment: string,      // e.g., "Distributor"
  status: string        // e.g., "new"
)
```

**Lookup Process:**
1. Map status: `new` → `new_business`, `6month` → `6_month_active`, etc.
2. Map segment: `Distributor` → `distributor`, `Wholesale` → `wholesale`
3. Search in `commissionRates.rates[]` array for matching:
   - `title` = rep's job title
   - `segmentId` = customer segment
   - `status` = customer status
   - `active` ≠ false

**Fallback Defaults** (if no rate found in Firestore):
- `new_business` → 8%
- `transferred` → 2%
- `distributor` + `6_month_active` → 5%
- `distributor` + `12_month_active` → 3%
- `wholesale` + `6_month_active` → 7%
- `wholesale` + `12_month_active` → 5%

---

## 🔧 WHAT TO CHECK

### 1. Verify Rate Collections Exist

Check Firestore `settings` collection for these documents:
- `commission_rates_Account_Executive`
- `commission_rates_Account_Manager`
- `commission_rates_Jr._Account_Executive`
- `commission_rates_Sr._Account_Executive`

Each should have a `rates` array with objects like:
```json
{
  "title": "Account Executive",
  "segmentId": "distributor",
  "status": "new_business",
  "percentage": 8,
  "active": true
}
```

### 2. Verify Rep Job Titles

Check `users` collection for each rep's `title` field:
- **Zalak Zaveri** → title = ?
- **Ben Wallner** → title = ?
- **Derek Whitworth** → title = ?
- **Brandon Good** → title = ?
- **Jared Leuzinger** → title = ?

**The title MUST match exactly** (case-sensitive) with the commission rate collection name.

### 3. Verify Customer Account Types

Check `fishbowl_customers` collection:
- Are customers properly marked as `Wholesale` vs `Distributor`?
- Are any customers incorrectly marked as `Retail`?

### 4. Check Calculation Logs

Review the exported Excel files:
- `commission-calculation-log-2025-12-Ben-Wallner.xlsx`
- `commission-calculation-log-2025-12-all-reps.xlsx`

Look for these columns:
- **Customer Segment** (should be Wholesale or Distributor)
- **Customer Status** (should be new, 6month, 12month, transferred, or own)
- **Commission Rate** (should match expected rate for that segment/status)
- **Commission Amount** (should be revenue × rate)

---

## 🎯 EXPECTED RATES BY TITLE

### Account Executive (Standard)
| Segment | New (0-6mo) | 6-Month Active | 12-Month Active | Transferred |
|---------|-------------|----------------|-----------------|-------------|
| Wholesale | 8% | 7% | 5% | 2% |
| Distributor | 8% | 5% | 3% | 2% |

### Sr. Account Executive
| Segment | New (0-6mo) | 6-Month Active | 12-Month Active | Transferred |
|---------|-------------|----------------|-----------------|-------------|
| Wholesale | 8% | 7% | 5% | 2% |
| Distributor | 8% | 5% | 3% | 2% |

### Account Manager
| Segment | New (0-6mo) | 6-Month Active | 12-Month Active | Transferred |
|---------|-------------|----------------|-----------------|-------------|
| Wholesale | 8% | 7% | 5% | 2% |
| Distributor | 8% | 4% | 2% | 2% |

---

## 🔍 ANALYSIS QUESTIONS

### Why is Zalak's rate so high (8.00%)?

**Possible Reasons:**
1. All her customers are marked as "new business" (0-6 months old)
2. Her customers are dormant accounts she reactivated (12+ months since last order)
3. Missing job title → using fallback default rates
4. All Wholesale customers (higher rates than Distributor)

**To Verify:**
- Check her job title in `users` collection
- Review her customer statuses in the calculation log
- Check customer segments (Wholesale vs Distributor mix)

### Why is Brandon's rate lower (5.93%)?

**Possible Reasons:**
1. More established customers (12+ months old) → lower rates (3-5%)
2. More Distributor customers (lower rates than Wholesale)
3. Some transferred customers (2% rate)

**To Verify:**
- Review customer age distribution in his calculation log
- Check Wholesale vs Distributor mix
- Look for transferred customers

---

## 📋 NEXT STEPS

1. **Export Firestore Data:**
   - Export all `commission_rates_*` documents from `settings` collection
   - Export all user records with `isCommissioned = true`
   - Compare actual rates vs expected rates

2. **Review Calculation Logs:**
   - Open `commission-calculation-log-2025-12-all-reps.xlsx`
   - Filter by each rep
   - Verify:
     - Customer segments are correct
     - Customer statuses make sense
     - Rates match expected values for segment/status
     - Commission = Revenue × Rate

3. **Spot Check Individual Orders:**
   - Pick 5-10 orders from Ben's export
   - Manually verify:
     - Customer exists in `fishbowl_customers`
     - `accountType` is correct
     - Customer age calculation is correct
     - Rate applied matches the commission rate table

4. **Check for Missing Rates:**
   - Look for console warnings: `"No rate found for [title] | [segment] | [status]"`
   - These indicate missing rate configurations
   - System falls back to hardcoded defaults

---

## 🚨 COMMON ISSUES

### Issue 1: Missing Commission Rate Collections
**Symptom:** All reps getting default fallback rates  
**Fix:** Create `commission_rates_[Title]` documents in `settings` collection

### Issue 2: Title Mismatch
**Symptom:** Rep's title doesn't match any rate collection  
**Example:** User has title "Sr Account Executive" but collection is "Sr._Account_Executive"  
**Fix:** Ensure exact match (including spaces, underscores, capitalization)

### Issue 3: Incorrect Customer Segments
**Symptom:** Wholesale customers getting Distributor rates  
**Fix:** Update `accountType` in `fishbowl_customers` collection

### Issue 4: Wrong Customer Status
**Symptom:** Old customers getting "new business" 8% rate  
**Fix:** Check order history - may be dormant reactivation (correct) or data issue

---

## 📊 FILES TO REVIEW

1. **Calculation Engine:**
   - `c:\Projects\KanvaPortal\app\api\calculate-monthly-commissions\route.ts`
   - Lines 142-163: Rate loading
   - Lines 518-538: Rate lookup
   - Lines 1004-1125: Customer status determination
   - Lines 1131-1201: Rate selection logic

2. **Firestore Collections:**
   - `settings/commission_rates_*` - Rate tables by title
   - `users` - Rep job titles
   - `fishbowl_customers` - Customer account types
   - `fishbowl_sales_orders` - Order history for status calculation

3. **Exported Data:**
   - `C:\Projects\KanvaPortal\docs\commission-calculation-log-2025-12-Ben-Wallner.xlsx`
   - `C:\Projects\KanvaPortal\docs\commission-calculation-log-2025-12-all-reps.xlsx`

---

**Status:** Ready for rate verification and manual spot-checking.
