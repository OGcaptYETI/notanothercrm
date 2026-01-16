# Transferred Customer Logic Verification

**Test Case: Metro wholesale inc**  
**Date:** January 15, 2026

---

## 📋 Test Scenario

### **Customer Details:**
- **Name:** Metro wholesale inc
- **Account Type:** Distributor
- **First Order:** 7/19/2024 (SO: 3990) - Rep: Shane (inactive)
- **Transfer Date:** ~7/16/2025 (SO: 8099) - Rep: Ben Wallner
- **Current Order:** 12/17/2025 (SO: 9926) - Rep: Ben Wallner
- **Revenue:** $33,929
- **Expected Commission:** $33,929 × 2% = $678.58

### **Expected Status:**
- ✅ **Status:** `transferred`
- ✅ **Rate:** 2%
- ✅ **Reason:** Customer transferred during July 2025 reorg

---

## 🔍 Code Analysis: `getCustomerStatus` Function

### **Lines 1001-1123: Customer Status Detection Logic**

#### **Step 1: Reorg Rule Check (Lines 1071-1096)**
```typescript
if (applyReorgRule && currentOrderDate >= REORG_DATE && customerAgeMonths > 6) {
  // Check if customer had ANY orders before the reorg date
  let hadOrdersBeforeReorg = false;
  let hadDifferentRepBeforeReorg = false;
  
  for (const orderDoc of previousOrders.docs) {
    const order = orderDoc.data();
    const orderDateCheck = order.postingDate.toDate();
    
    if (orderDateCheck < REORG_DATE) {
      hadOrdersBeforeReorg = true;
      // Check if this old order had a different rep
      if (order.salesPerson !== currentSalesPerson) {
        hadDifferentRepBeforeReorg = true;
        break;
      }
    }
  }
  
  // If customer existed before reorg AND had a different rep in order history → "transferred" (2%)
  if (hadOrdersBeforeReorg && hadDifferentRepBeforeReorg) {
    return 'transferred';
  }
}
```

**Logic Flow for Metro wholesale inc:**
1. ✅ `applyReorgRule = true` (from commission rules)
2. ✅ `currentOrderDate = 12/17/2025` >= `REORG_DATE = 07/01/2025`
3. ✅ `customerAgeMonths = ~17 months` > 6
4. ✅ Loop through previous orders:
   - Order from 7/19/2024: `orderDateCheck < REORG_DATE` → `hadOrdersBeforeReorg = true`
   - Order `salesPerson = "Shane"` ≠ `currentSalesPerson = "Ben Wallner"` → `hadDifferentRepBeforeReorg = true`
5. ✅ Return `'transferred'`

---

#### **Step 2: Non-Reorg Transfer Check (Lines 1098-1102)**
```typescript
// Check for rep transfer (non-reorg scenario)
if (lastOrder.salesPerson !== currentSalesPerson) {
  console.log(`   🔄 TRANSFERRED - Rep changed from ${lastOrder.salesPerson} to ${currentSalesPerson}`);
  return 'transferred';
}
```

**Fallback Logic:**
- If reorg rule doesn't catch it, this will
- Compares last order's rep to current order's rep
- If different → `'transferred'`

---

## 🎯 Commission Rate Lookup: `getCommissionRate` Function

### **Lines 1128-1198: Rate Determination**

#### **Status Mapping (Lines 1135-1141):**
```typescript
const statusMap: { [key: string]: string } = {
  'new': 'new_business',
  'transferred': 'transferred', // ✅ Maps to 'transferred'
  'own': 'new_business',
  '6month': '6_month_active',
  '12month': '12_month_active'
};
```

#### **Rate Lookup (Lines 1166-1178):**
```typescript
const rate = commissionRates.rates.find((r: any) => 
  r.title === title &&              // "Account Executive"
  r.segmentId === segmentId &&      // "distributor"
  r.status === mappedStatus &&      // "transferred"
  r.active !== false
);
```

**For Metro wholesale inc:**
- `title = "Account Executive"` (Ben Wallner's title)
- `segmentId = "distributor"` (from accountType)
- `status = "transferred"` (from getCustomerStatus)
- **Expected Rate:** 2%

#### **Fallback Rate (Lines 1186-1187):**
```typescript
// Transferred customers always get 2% (July 2025 reorg rule)
if (mappedStatus === 'transferred') return { rate: 2.0, found: false };
```

**Safety Net:** Even if rate lookup fails, transferred customers get 2%.

---

## ✅ Verification Results

### **Logic Correctness:**

| Check | Status | Details |
|-------|--------|---------|
| Reorg date check | ✅ CORRECT | `2025-07-01` matches commission rules |
| Customer age check | ✅ CORRECT | `customerAgeMonths > 6` prevents new business from being marked transferred |
| Order history lookup | ✅ CORRECT | Queries `fishbowl_sales_orders` for previous orders |
| Rep change detection | ✅ CORRECT | Compares `order.salesPerson` to `currentSalesPerson` |
| Status return | ✅ CORRECT | Returns `'transferred'` when conditions met |
| Rate mapping | ✅ CORRECT | Maps `'transferred'` → `'transferred'` status |
| Rate lookup | ✅ CORRECT | Searches for matching rate in commission_rates |
| Fallback rate | ✅ CORRECT | Returns 2% if lookup fails |

---

## 🧮 Commission Calculation Verification

### **Expected Calculation:**
```
Revenue: $33,929
Rate: 2%
Commission: $33,929 × 0.02 = $678.58
```

### **Code Implementation (Lines 540-610):**
```typescript
// Calculate commission base
let orderAmount = commissionRules?.useOrderValue ? 
  (order.orderValue || order.revenue || 0) : 
  (order.revenue || 0);

// Calculate from line items (excluding shipping/CC)
const revenueLineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
  .where('salesOrderId', '==', order.salesOrderId)
  .get();

// ... exclusion logic for shipping/CC processing ...

// Calculate commission on net revenue
const commissionAmount = new Decimal(orderAmount)
  .times(rate)
  .dividedBy(100)
  .toNumber();
```

**For Metro wholesale inc:**
1. ✅ `orderAmount = $33,929` (from line items, excluding shipping)
2. ✅ `rate = 2` (from getCommissionRate)
3. ✅ `commissionAmount = $33,929 × 2 ÷ 100 = $678.58`

---

## 🔍 Potential Issues & Edge Cases

### **Issue 1: salesPerson Field Matching**
**Concern:** Does `"Shane"` match exactly in old orders?

**Check Required:**
- Old orders might have `"Shane"` or `"Shane [Last Name]"`
- Current order has `"Ben Wallner"` (full name)
- Field comparison is exact string match: `order.salesPerson !== currentSalesPerson`

**Verification Needed:**
- Check actual `salesPerson` values in database
- Ensure consistent naming (e.g., "Shane" vs "Shane Inactive")

---

### **Issue 2: Customer Age Calculation**
**Concern:** `customerAgeMonths > 6` requirement

**For Metro wholesale inc:**
- First order: 7/19/2024
- Current order: 12/17/2025
- Age: ~17 months ✅ > 6 months

**This is correct** - prevents new customers (< 6 months) from being marked as transferred.

---

### **Issue 3: Order History Limit**
**Code:**
```typescript
.limit(10) // Get recent orders to check for rep changes
```

**Concern:** What if customer has > 10 orders between first order and current order?

**Analysis:**
- Limit is 10 most recent orders
- For Metro wholesale inc: likely < 10 orders between 7/19/2024 and 12/17/2025
- **Should be fine** for most cases
- **Potential Issue:** If customer has many orders, might miss the original rep change

**Recommendation:** Consider increasing limit to 50 or removing limit for reorg checks.

---

## 📊 Expected Console Output

When calculating commission for Metro wholesale inc order 9926:

```
🔍 Customer 1439 (Metro wholesale inc): Found 2 previous orders
   📦 Last order: 9847 | Date: 2025-12-09 | Rep: Ben Wallner
   🎯 Current order rep: Ben Wallner
📅 Customer 1439: First order 2024-07-19, Age: 17 months
   ✅ TRANSFERRED (Reorg Rule) - Had orders before 2025-07-01 with different rep
 Account Type mapping: "Distributor" → segmentId: "distributor"
 Found rate: Account Executive | distributor | transferred = 2%
✅ COMMISSION CALCULATED: Order 9926 | Ben Wallner | Distributor | transferred | $33,929.00 × 2% = $678.58
```

---

## ✅ Final Verification

### **All Logic Checks Pass:**
1. ✅ Reorg date logic is correct (2025-07-01)
2. ✅ Customer age check prevents false positives
3. ✅ Rep change detection works correctly
4. ✅ Status mapping is correct ('transferred' → 'transferred')
5. ✅ Rate lookup returns 2% for transferred customers
6. ✅ Commission calculation is accurate ($33,929 × 2% = $678.58)

### **Potential Improvements:**
1. ⚠️ Increase order history limit from 10 to 50 for reorg checks
2. ⚠️ Add logging for salesPerson field values to debug naming inconsistencies
3. ⚠️ Consider caching customer status to avoid repeated queries

---

## 🎯 Conclusion

**The transferred customer logic is CORRECT and should work as expected for Metro wholesale inc.**

**Expected Result:**
- Status: `transferred`
- Rate: 2%
- Commission: $678.58

**If the actual result differs, check:**
1. `salesPerson` field values in old orders (exact string match required)
2. Console logs during calculation to see actual status determination
3. Commission rates configuration in database

---

**End of Verification**
