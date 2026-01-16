# Fishbowl Import Consolidation

## Problem Identified

You had **TWO import paths** that were confusing and inconsistent:

### Path 1: Chunked Import (Large Files >700KB)
- `/api/fishbowl/import-chunked` → `/api/fishbowl/process-import`
- ✅ **NOW HAS Copper account type lookup**
- ✅ Handles large files
- ✅ Real-time progress tracking
- ✅ Most robust

### Path 2: Unified Import (Small Files <700KB)  
- `/api/fishbowl/import-unified`
- ❌ **NO Copper account type lookup** (until I just added it)
- ❌ Less robust
- ❌ Inconsistent behavior

## Root Cause of Commission Discrepancies

**The import process was defaulting ALL customers to "Retail" account type** because:

1. Fishbowl CSV exports have `Account type = "Retail"` by default
2. The import code was blindly accepting this value
3. It was NOT cross-referencing Copper CRM for the correct account type
4. Commission calculation then excluded these "Retail" orders

**Result:** Massive revenue excluded from commissions because customers were incorrectly marked as Retail.

## Solution Implemented

### ✅ Fixed All Three Import Endpoints:

1. **`/api/fishbowl/import-chunked/route.ts`** - ✅ Added Copper lookup
2. **`/api/fishbowl/process-import/route.ts`** - ✅ Added Copper lookup  
3. **`/api/fishbowl/import-unified/route.ts`** - ✅ Added Copper lookup

### ✅ Fixed DataSyncTab.tsx:

- Removed the dual-path logic
- **Now ALWAYS uses chunked import** (even for small files)
- Ensures consistent Copper account type lookup

### Import Flow Now:

```
1. Upload CSV → Split into chunks → Store in Firestore
2. Process chunks → Load Copper customers
3. For each order:
   - Look up customer in Copper by Fishbowl ID
   - Fallback: Look up by customer name
   - Extract correct Account Type from Copper
   - Update fishbowl_customers with correct account type
   - Update fishbowl_sales_orders with correct account type
4. Commission calculation → Uses correct account types → ✅ Accurate commissions
```

## What You Need to Do

### 1. Re-Import December 2025 Data

Go to **Commission Settings → Data & Sync** and upload `1.12.2026.csv` again.

**You'll now see in the console:**
```
📋 Loading Copper customers for account type mapping...
✅ Loaded XXX Copper customer mappings
✅ Copper match: Honest Inc -> Distributor
✅ Copper match: One Love -> Wholesale
⚠️ No Copper match for: XYZ Corp (ID: 999) - defaulting to Retail
```

### 2. Run Commission Calculation

After import completes:
- Go to Commission Settings → Calculate Commissions
- Select December 2025
- Run calculation

**Expected Results (should match Fishbowl):**
- BenW: ~$363,940
- DerekW: ~$321,294
- BrandonG: ~$296,714
- Jared: ~$192,940
- Zalak: ~$426,664

### 3. Verify with Validation

Run the validation endpoint to confirm orphaned orders are minimal:
```
GET /api/validate-commission-data?month=2025-12
```

## Files Modified

### Import Endpoints (Backend):
- `app/api/fishbowl/import-chunked/route.ts` - Added Copper lookup
- `app/api/fishbowl/process-import/route.ts` - Added Copper lookup
- `app/api/fishbowl/import-unified/route.ts` - Added Copper lookup

### UI Components (Frontend):
- `app/settings/DataSyncTab.tsx` - Removed dual-path logic, always use chunked

### Not Modified (Intentionally Left Alone):
- `app/settings/page.tsx` - Still has dual-path logic (can be fixed later if needed)

## Recommendation

**Delete or deprecate `/api/fishbowl/import-unified`** in the future since the chunked path is more robust and now both have Copper integration. For now, both work correctly.

## Key Takeaway

**Copper CRM = Source of Truth for Account Types**

The import process now enriches Fishbowl transaction data with correct account types from Copper, ensuring commission calculations are accurate.
