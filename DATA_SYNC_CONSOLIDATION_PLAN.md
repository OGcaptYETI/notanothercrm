# Data Sync Consolidation Plan
**Date:** January 13, 2026  
**Status:** 🔧 Planning Phase

---

## 🎯 OBJECTIVE

Consolidate scattered sync tools into ONE unified "Data Sync" system with robust validation to prevent data issues.

---

## 📊 CURRENT STATE

### Import Results (All-Time Data)
- ✅ **12,785 line items** imported
- ✅ **3,093 orders** created
- ✅ **765 customers** created in `fishbowl_customers`
- ⚠️ **724 customers** defaulting to "Retail" (no Copper match)

### The Problem
```
Copper CRM (Source of Truth)
  ├─ 1,529 ACTIVE accounts
  └─ Only 41 loaded in Firestore ❌

Fishbowl Import
  ├─ 765 unique customers
  └─ 724 unmatched → default to "Retail" → NO COMMISSION ❌
```

**Impact:** Reps won't get paid for 724 customers worth of sales!

---

## 🔍 EXISTING TOOLS AUDIT

### Tool 1: `/api/sync-copper-api-fresh`
**Purpose:** Pull ALL active companies directly from Copper API  
**What it does:**
- Fetches companies with `Active Customer cf_712751 = true`
- Pulls ALL custom fields from Copper
- Stores in `copper_companies` collection
- Handles pagination (200 per page)
- Rate limiting (10 req/sec)

**Custom Fields Mapped:**
- `675914` → Account Type cf_675914
- `698467` → Account Order ID cf_698467
- `713477` → Account ID cf_713477
- `680701` → Region cf_680701
- `712751` → Active Customer cf_712751

**Status:** ✅ Working, pulls from API directly

---

### Tool 2: `/api/sync-copper-customers`
**Purpose:** Sync Copper → Fishbowl customers (enrich existing)  
**What it does:**
- Loads ACTIVE companies from `copper_companies` (already in Firestore)
- Matches to existing `fishbowl_customers`
- Updates account types, addresses, sales rep assignments
- **Does NOT create new customers** (only enriches existing)

**Matching Logic:**
1. Try `copperId` match
2. Try `Account Order ID` match
3. Try `Account ID` match

**Account Type Normalization:**
- Handles multiple formats: string, array, number, object
- Maps Copper option IDs:
  - `1981470` → Distributor
  - `2063862` → Wholesale
  - `2066840` → Retail

**Preservation:**
- Preserves `transferStatus`, `originalOwner`, `fishbowlUsername`
- Only updates fields where Copper has data (no overwrites with blanks)

**Status:** ✅ Working, but only enriches existing customers

---

### Tool 3: `/api/fishbowl/import-unified`
**Purpose:** Import Conversite CSV → Firestore  
**What it does:**
- Creates/updates `fishbowl_customers`
- Creates/updates `fishbowl_sales_orders`
- Creates/updates `fishbowl_soitems`
- Auto-sets `commissionMonth` from order date

**Copper Matching During Import:**
- Loads 41 ACTIVE Copper customers ❌ (should be 1,529)
- Tries to match by Account Order ID
- Defaults to "Retail" if no match

**Status:** ✅ Working, but Copper matching is broken (only 41 accounts loaded)

---

### Other Tools Found:
- `/api/sync-copper-to-fishbowl` - Similar to sync-copper-customers
- `/api/copper-goals/match-fishbowl` - Matching logic
- `/api/sync-fishbowl-customer-types` - Type syncing
- `/api/fishbowl-goals/sync-to-copper` - Push metrics back to Copper

**Problem:** Too many overlapping tools doing similar things!

---

## 🎯 CONSOLIDATED SOLUTION

### NEW: Unified Data Sync Page

**Location:** `/admin/tools/data-sync`

**Tab 1: Copper → Firestore** (Pull from CRM)
```
┌─────────────────────────────────────────────┐
│ 🔄 Sync Copper CRM → Firestore              │
├─────────────────────────────────────────────┤
│                                             │
│ [Pull All Active Customers]  (1,529 accts) │
│   ↳ Fetches from Copper API                │
│   ↳ Stores in copper_companies             │
│   ↳ Includes: Account Type, Region, etc.   │
│                                             │
│ [Pull All Opportunities]                    │
│   ↳ Fetches from Sales Pipeline            │
│   ↳ Stores in copper_opportunities         │
│                                             │
│ Status: Last synced 2 hours ago             │
│ Next sync: Manual or scheduled              │
└─────────────────────────────────────────────┘
```

**Tab 2: Fishbowl → Firestore** (Import Sales Data)
```
┌─────────────────────────────────────────────┐
│ 📊 Import Fishbowl Sales Data               │
├─────────────────────────────────────────────┤
│                                             │
│ Upload Conversite CSV:                      │
│ [Choose File] all_time_main.csv             │
│                                             │
│ [Import & Sync]                             │
│   ↳ Creates fishbowl_customers             │
│   ↳ Creates fishbowl_sales_orders          │
│   ↳ Creates fishbowl_soitems               │
│   ↳ Auto-matches to Copper (1,529 accts)   │
│   ↳ Sets account types from Copper         │
│                                             │
│ ⚠️ Ensure Copper sync is current first!     │
└─────────────────────────────────────────────┘
```

**Tab 3: Validation & Matching** (Quality Control)
```
┌─────────────────────────────────────────────┐
│ 🔍 Data Validation & Field Mapping          │
├─────────────────────────────────────────────┤
│                                             │
│ [Run Validation Check]                      │
│                                             │
│ Results:                                    │
│ ✅ 765 customers matched to Copper          │
│ ⚠️ 0 customers defaulting to Retail         │
│ ✅ All account types set correctly          │
│                                             │
│ Field Mapping Status:                       │
│ ✅ Account Order ID → accountNumber         │
│ ✅ Account ID → customerId                  │
│ ✅ Account Type → accountType               │
│ ✅ Region → region                          │
│                                             │
│ [Download Unmatched Customers CSV]          │
│ [Download Field Mapping Report]             │
└─────────────────────────────────────────────┘
```

**Tab 4: Metrics → Copper** (Push Back to CRM)
```
┌─────────────────────────────────────────────┐
│ 📈 Push Metrics to Copper CRM               │
├─────────────────────────────────────────────┤
│                                             │
│ Calculate & Push for ACTIVE customers only  │
│                                             │
│ Metrics to sync:                            │
│ ☑ Total Orders (Lifetime)                  │
│ ☑ Lifetime Value                           │
│ ☑ Last Order Date                          │
│ ☑ Order Frequency                          │
│                                             │
│ [Calculate Metrics]                         │
│ [Preview Changes] (Dry Run)                 │
│ [Push to Copper] (Live)                     │
│                                             │
│ Status: 1,529 active customers              │
└─────────────────────────────────────────────┘
```

---

## 🔧 TECHNICAL IMPLEMENTATION

### Step 1: Fix Copper Sync in Import
**File:** `c:\Projects\KanvaPortal\app\api\fishbowl\import-unified\route.ts`  
**Lines:** ~100-149 (Copper loading section)

**Current Code:**
```typescript
// ❌ WRONG: Only loads 41 active customers
const copperSnapshot = await adminDb.collection('copper_companies')
  .where('Active Customer cf_712751', '==', 'checked')
  .get();
```

**Fixed Code:**
```typescript
// ✅ CORRECT: Load ALL active customers (1,529)
const copperSnapshot = await adminDb.collection('copper_companies')
  .where('Active Customer cf_712751', 'in', ['checked', 'Checked', true, 'true'])
  .get();

// OR better: Load all and filter in memory
const copperSnapshot = await adminDb.collection('copper_companies').get();
const activeCopperCompanies = [];
copperSnapshot.forEach(doc => {
  const data = doc.data();
  const isActive = data['Active Customer cf_712751'];
  if (isActive === 'checked' || isActive === 'Checked' || isActive === true || isActive === 'true') {
    activeCopperCompanies.push({ id: doc.id, ...data });
  }
});
```

---

### Step 2: Robust Account Type Matching

**Account Type Field in Copper:** `Account Type cf_675914`

**Possible Formats:**
1. String: `"Wholesale"`, `"Distributor"`, `"Retail"`
2. Array of strings: `["Wholesale"]`
3. Array of numbers: `[2063862]` (Copper option IDs)
4. Array of objects: `[{ id: 2063862, name: "Wholesale" }]`
5. Number: `2063862`
6. Object: `{ id: 2063862, name: "Wholesale" }`

**Normalization Function:** (Already exists in `sync-copper-customers`)
```typescript
function normalizeAccountType(copperType: any): string {
  // Handles all formats above
  // Maps option IDs:
  //   1981470 → Distributor
  //   2063862 → Wholesale
  //   2066840 → Retail
  // Returns: "Wholesale" | "Distributor" | "Retail"
}
```

---

### Step 3: Validation System

**New API:** `/api/validate-data-sync`

**Checks:**
1. ✅ All `fishbowl_customers` have `accountType` set
2. ✅ No customers defaulting to "Retail" incorrectly
3. ✅ All Copper matches are valid
4. ✅ Field mappings are consistent
5. ✅ No orphaned records

**Output:**
- JSON report with issues
- CSV export of unmatched customers
- Field mapping validation report

---

## 📋 EXECUTION PLAN

### Phase 1: Immediate Fix (Today)
1. ✅ Run `/api/sync-copper-api-fresh` to pull ALL 1,529 active Copper accounts
2. ✅ Verify `copper_companies` has 1,529 records
3. ✅ Run `/api/sync-copper-customers?live=true` to update existing fishbowl_customers
4. ✅ Verify 765 customers now have correct account types
5. ✅ Re-run commission calculation for December 2025

### Phase 2: Build Unified UI (This Week)
1. Create `/admin/tools/data-sync` page
2. Consolidate all sync tools into tabs
3. Add validation tab with robust checks
4. Test with sample data

### Phase 3: Cleanup (Next Week)
1. Deprecate old scattered tools
2. Update documentation
3. Train team on new unified system

---

## 🚨 CRITICAL ACTIONS NEEDED NOW

### Action 1: Pull All Copper Customers
```bash
POST /api/sync-copper-api-fresh
```
**Expected Result:** 1,529 active customers in `copper_companies`

### Action 2: Update Fishbowl Customers with Account Types
```bash
POST /api/sync-copper-customers?live=true
```
**Expected Result:** 765 customers updated with correct account types from Copper

### Action 3: Validate Results
```bash
GET /api/verify-account-types
```
**Expected Result:** 
- 0 customers defaulting to "Retail" incorrectly
- All 765 customers have proper account types

### Action 4: Re-calculate Commissions
```bash
POST /api/calculate-monthly-commissions
Body: { month: "12", year: 2025 }
```
**Expected Result:** Correct commission totals with proper rates applied

---

## 📊 SUCCESS METRICS

**Before Fix:**
- Copper accounts loaded: 41 ❌
- Customers matched: 41 (5%)
- Customers defaulting to Retail: 724 (95%)
- Commission accuracy: LOW

**After Fix:**
- Copper accounts loaded: 1,529 ✅
- Customers matched: 765 (100%)
- Customers defaulting to Retail: 0 (0%)
- Commission accuracy: HIGH

---

## 🔍 FIELD MAPPING REFERENCE

### Copper → Firestore Mapping

| Copper Field | Field ID | Firestore Field | Collection |
|--------------|----------|-----------------|------------|
| Account Type | cf_675914 | accountType | fishbowl_customers |
| Account Order ID | cf_698467 | accountNumber | fishbowl_customers |
| Account ID | cf_713477 | customerId | fishbowl_customers |
| Region | cf_680701 | region | fishbowl_customers |
| Active Customer | cf_712751 | (filter only) | copper_companies |
| Assignee ID | assignee_id | salesPerson | fishbowl_customers |

### Conversite CSV → Firestore Mapping

| CSV Column | Firestore Field | Collection |
|------------|-----------------|------------|
| Account ID | customerId | fishbowl_customers |
| Sales order Number | soNumber | fishbowl_sales_orders |
| Sales Order ID | salesOrderId | fishbowl_sales_orders |
| SO Item ID | productLineId | fishbowl_soitems |
| Total price | totalPrice | fishbowl_soitems |
| Fulfilled Quantity | quantity | fishbowl_soitems |
| Unit price | unitPrice | fishbowl_soitems |
| Sales Order Date | postingDate | fishbowl_sales_orders |

---

## 🎯 NEXT STEPS

**Immediate (User Action Required):**
1. Approve running `/api/sync-copper-api-fresh` to pull all 1,529 Copper accounts
2. Approve running `/api/sync-copper-customers?live=true` to update account types
3. Verify results before re-running commissions

**Development (This Week):**
1. Build unified Data Sync UI page
2. Consolidate scattered tools
3. Add robust validation system

**Testing:**
1. Verify all 765 customers have correct account types
2. Spot-check 10-20 customers manually
3. Re-run December 2025 commissions
4. Compare before/after commission totals

---

**Status:** Ready to execute Phase 1 - awaiting user approval to run sync tools.
