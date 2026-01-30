# Fishbowl Import - Interactive Field Mapping Implementation

## Problem Solved

**Issue:** Import showing only 227 orders instead of thousands - most orders being skipped due to field mapping mismatches.

**Root Cause:** Auto-detected field mappings were incorrect, causing import to skip rows with missing required fields like `Sales order Number`, `SO Item ID`, etc.

## Solution Implemented

### 1. **Interactive Field Mapping (Step 2)**

Users can now manually select which CSV column maps to each system field using dropdown selectors.

**Features:**
- ✅ Dropdown for each required field
- ✅ Shows all CSV columns as options
- ✅ Prevents duplicate mappings - already-used columns disabled
- ✅ Highlights unmapped fields in red
- ✅ Shows auto-detection confidence (exact/alias/fuzzy)
- ✅ Warning if required fields not mapped

### 2. **Custom Mapping Flow**

```
Step 1: Upload CSV
  ↓
System auto-detects field mappings
  ↓
Step 2: Review & Edit Mappings
  ↓
User changes any incorrect mappings via dropdowns
  ↓
Step 3: Preview with Custom Mappings
  ↓
Step 4: Import with Custom Mappings
```

### 3. **Debug Logging Added**

Import now logs detailed info about skipped rows:

```typescript
// In import-unified route:
console.log('🔍 DEBUG: First normalized row keys:', Object.keys(normalizedData[0]));
console.log('🔍 DEBUG: Sample values from first row:');
console.log(`  Sales order Number: "${firstRow['Sales order Number']}"`);
console.log(`  Sales Order ID: "${firstRow['Sales Order ID']}"`);
console.log(`  SO Item ID: "${firstRow['SO Item ID']}"`);

// When skipping rows:
console.warn(`⚠️ Skipping row ${i + 1} - missing fields:`);
console.warn(`  soNum: "${soNum}" | salesOrderId: "${salesOrderId}" | lineItemId: "${lineItemId}"`);
console.warn(`  Available keys:`, Object.keys(row).slice(0, 10));
```

## Files Modified

### Frontend
**`c:\Projects\KanvaPortal\app\admin\tools\fishbowl-import\components\FishbowlWorkflowPage.tsx`**
- Added `fieldMappings` state for manual overrides
- Added `handleFieldMappingChange` function
- Replaced static table with interactive dropdown table
- Shows duplicate prevention and validation warnings

### Backend APIs
**`c:\Projects\KanvaPortal\app\api\fishbowl\preview-import\route.ts`**
- Accepts `fieldMappings` from FormData
- Re-maps CSV data with custom mappings if provided
- Falls back to auto-detected mappings

**`c:\Projects\KanvaPortal\app\api\fishbowl\import-unified\route.ts`**
- Accepts `fieldMappings` from FormData
- Re-maps CSV data with custom mappings
- Added detailed skip logging (first 5 skipped rows)
- Logs field names and values for debugging

## Required Fields

These must all be mapped for import to succeed:

1. **Sales order Number** - Unique order identifier
2. **Sales Order ID** - System order ID
3. **Account ID** - Customer ID
4. **Customer Name** - Customer display name
5. **Sales Rep** - Sales person full name
6. **Issued date** - Order date
7. **SO Item ID** - Line item identifier
8. **SO Item Product Number** - Product SKU
9. **Qty fulfilled** - Quantity sold
10. **Unit price** - Price per unit
11. **Total Price** - Line total revenue

## Skip Logic (3 Conditions)

Orders are skipped if:

### 1. Missing Required Fields
```typescript
if (!soNum || !salesOrderId || !lineItemId) {
  stats.skipped++;
  continue;
}
```

### 2. Invalid Customer ID
```typescript
if (!customerId) {
  console.warn(`⚠️ Skipping order ${soNum} - invalid customer ID: "${rawCustomerId}"`);
  stats.skipped++;
  continue;
}
```

### 3. Invalid Commission Date
```typescript
if (!commissionMonth || !commissionYear) {
  console.warn(`⚠️ Skipping order ${soNum} - no valid date`);
  stats.skipped++;
  continue;
}
```

## Manual Correction Preservation

The import respects manually-linked orders from validation:

```typescript
if (existingOrderDoc.exists) {
  const existingData = existingOrderDoc.data();
  if (existingData?.manuallyLinked === true) {
    // Preserve only the customer linkage, but update everything else
    preservedCustomerId = existingData.customerId;
    preservedAccountType = existingData.accountType;
    isManuallyLinked = true;
    console.log(`🔒 Order ${soNum} - preserving manual customer linkage`);
  }
}
```

## Testing Steps

### 1. Check Console Logs

Upload v2 CSV and check browser console/server logs for:

```
🔍 DEBUG: First normalized row keys: [...]
🔍 DEBUG: Sample values from first row:
  Sales order Number: "10076"
  Sales Order ID: "12345"
  SO Item ID: "76188"
  Account ID: "1422"
  Sales Rep: "DerekW"
```

If any field shows `undefined` or empty string, that field isn't mapped correctly.

### 2. Verify Field Mappings

In Step 2, check that dropdowns show:
- All CSV column names as options
- Current selection highlighted
- Already-used columns disabled with "(already mapped)" text
- Unmapped fields show red "⚠️ Not mapped" warning

### 3. Test Manual Mapping

1. Change a dropdown selection
2. Click "Continue to Preview"
3. Verify preview uses your custom mapping
4. Check import logs confirm: `🔧 Using custom field mappings from user`

### 4. Verify Import Counts

Expected results for v2 CSV:
- **~1,000+ orders** (not 227)
- **~15,000+ line items** (not 778)
- **179 customers** (this might be correct)

If still getting low counts, check logs for skip warnings.

## Common Issues & Fixes

### Issue: Still Only 227 Orders Imported

**Cause:** Field mappings still incorrect

**Fix:**
1. Check server logs for skip warnings
2. Look at "Available keys" in skip warnings
3. Manually map those keys in Step 2 dropdowns

### Issue: "⚠️ Not mapped" Warnings

**Cause:** Required field not selected in dropdown

**Fix:** Select the correct CSV column from dropdown for each red field

### Issue: Preview Shows Wrong Revenue

**Cause:** "Total Price" mapped to wrong CSV column

**Fix:** In Step 2, change "Total Price" mapping to correct column (e.g., "Revenue" or "Order value")

### Issue: Dates Not Parsing

**Cause:** "Issued date" mapped to column with wrong format

**Fix:** 
- Map to column like "Posting Date" that has MM-DD-YYYY format
- Check logs for date parse warnings

## Expected Workflow

### Happy Path (v1 CSV)
1. Upload CSV
2. Auto-mapping succeeds with all exact matches
3. Step 2 shows all green confidence badges
4. Continue → Preview shows ~$2.9M revenue
5. Import → 1,000+ orders imported
6. Validation → Totals match

### Manual Path (v2 CSV)
1. Upload CSV
2. Auto-mapping partial (some alias/fuzzy matches)
3. Step 2 shows some yellow/red confidence badges
4. **User manually fixes incorrect mappings**
5. Continue → Preview shows correct revenue
6. Import → All orders imported
7. Validation → Totals match

## Next Steps

1. **Upload v2 CSV** and check console logs for field mapping issues
2. **Manually adjust mappings** in Step 2 if auto-detection fails
3. **Verify preview** shows correct order counts before importing
4. **Check import results** - should see 1,000+ orders not 227
5. **Run validation** - revenue should be $3.6M+ not $2.9M

## Success Criteria

✅ Step 2 shows all required fields mapped
✅ No red "⚠️ Not mapped" warnings
✅ Preview shows expected order count (1,000+)
✅ Import completes with minimal skipped rows (< 10)
✅ Validation shows correct revenue total ($3.6M+)
✅ All sales reps have expected order counts
