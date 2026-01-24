# Account Merge Impact Analysis

## 🎯 Executive Summary

**CRITICAL FINDING:** Account merging in `copper_companies` has **NO DIRECT IMPACT** on commissions calculation because:
1. Commissions are calculated from `fishbowl_sales_orders` using `customerId` field
2. `customerId` links to `fishbowl_customers`, NOT `copper_companies`
3. Account merge only affects `copper_companies` collection (CRM data)

**However**, there are **INDIRECT IMPACTS** that need safeguards.

---

## 📊 Data Architecture Review

### **Collections Involved:**

```
COPPER CRM (Master Database)
├─ copper_companies (~280k accounts)
│  ├─ Active (cf_712751=true): ~1,709
│  └─ Inactive (cf_712751=false): ~278k
│  └─ Links: contacts, deals, Account Order ID (cf_698467)
│
├─ copper_people (contacts)
│  └─ Links via: companyId → copper_companies.copperId
│
└─ copper_opportunities (deals)
   └─ Links via: company_id → copper_companies.copperId

FISHBOWL ERP (Order Processing)
├─ fishbowl_customers (~1,800 who have ordered)
│  └─ Links: customerId, customerNum, accountNumber
│
├─ fishbowl_sales_orders (order history)
│  └─ Links via: customerId → fishbowl_customers
│  └─ Used for: COMMISSION CALCULATION
│
└─ fishbowl_soitems (line items)
   └─ Links via: salesOrderId → fishbowl_sales_orders
```

### **Key Insight:**
- **Copper** = CRM (customer relationship management)
- **Fishbowl** = ERP (order processing & commissions)
- **Link between them**: `copper_companies.cf_698467` (Account Order ID) → `fishbowl_sales_orders.customerId`

---

## ⚠️ IMPACT ANALYSIS

### **1. Commissions Calculation** ✅ SAFE (with caveats)

**Direct Impact:** NONE
- Commission calculation reads from `fishbowl_sales_orders`
- Uses `customerId` field to link to `fishbowl_customers`
- Does NOT read from `copper_companies`

**Code Evidence:**
```typescript
// From calculate-monthly-commissions/route.ts
const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
  .where('commissionMonth', '==', commissionMonth)
  .get();

// Customer lookup uses fishbowl_customers
const customersMap = new Map();
customersSnapshot.forEach(doc => {
  const data = doc.data();
  customersMap.set(data.customerId, data);  // fishbowl_customers.customerId
});
```

**Indirect Impact:** ⚠️ POTENTIAL ISSUE
- If merged accounts have DIFFERENT `cf_698467` (Account Order ID) values
- Orders in `fishbowl_sales_orders` with the secondary account's Order ID will still exist
- BUT the secondary Copper account will be archived
- This creates a **data integrity gap**

**Example Scenario:**
```
Account A (Primary): cf_698467 = "494"
Account B (Secondary): cf_698467 = "495"

After Merge:
- Account A keeps cf_698467 = "494" (or user chooses "495")
- Account B archived
- fishbowl_sales_orders with customerId="495" still exist
- If user chose "494", orders with customerId="495" are now orphaned from CRM perspective
```

**Safeguard Required:** ✅ ALREADY IMPLEMENTED
- Merge dialog shows `Account Order ID` as a conflict field
- User MUST choose which Order ID to keep
- All contacts/deals migrate to primary account
- Audit trail preserves secondary account data

---

### **2. Data Imports** ⚠️ MODERATE RISK

**Import Process Flow:**
1. CSV import creates/updates `fishbowl_sales_orders`
2. Import creates/updates `fishbowl_customers` 
3. Separate sync process links Copper → Fishbowl via `cf_698467`

**Risk Scenarios:**

**Scenario A: Future imports with secondary account Order ID**
```
Before Merge:
- Account "ABC Corp" (ID: 123) has cf_698467 = "494"
- Account "#1 Tobacco" (ID: 456) has cf_698467 = "494" (duplicate!)

After Merge:
- Keep Account "ABC Corp" (primary)
- Archive "#1 Tobacco" (secondary)
- Both had same Order ID, so OK

Future Import:
- New order comes in with customerId="494"
- Creates entry in fishbowl_sales_orders ✅
- No issue because Order ID is same
```

**Scenario B: Different Order IDs**
```
Before Merge:
- Account "ABC Corp" (ID: 123) has cf_698467 = "494"
- Account "ABC Company" (ID: 456) has cf_698467 = "495"

After Merge (user chooses "494"):
- Keep Account "ABC Corp" with cf_698467 = "494"
- Archive "ABC Company"

Future Import:
- New order comes in with customerId="495"
- Creates entry in fishbowl_sales_orders ✅
- BUT no active Copper account has cf_698467 = "495"
- Order is "orphaned" from CRM perspective ⚠️
```

**Safeguard Required:** 
- **Option 1:** Update ALL `fishbowl_sales_orders` with secondary Order ID to primary Order ID
- **Option 2:** Store BOTH Order IDs in primary account (array field)
- **Option 3:** Warning in merge dialog if Order IDs differ

**Recommendation:** Implement Option 3 immediately, Option 2 for long-term

---

### **3. Account Type & Commission Rates** ✅ SAFE

**Commission Rate Lookup:**
```typescript
// From commission calculation
const customer = customersMap.get(order.customerId);
const accountType = customer?.accountType || 'Retail';
const rate = getRateForAccountType(rep, accountType);
```

**Impact:**
- Commission rates are based on `fishbowl_customers.accountType`
- NOT based on `copper_companies` account type
- Merge does NOT affect commission rates

**However:**
- If you later sync `accountType` from Copper → Fishbowl
- Merged account's type could affect future orders
- This is INTENTIONAL and CORRECT behavior

---

### **4. Contacts & Deals Migration** ✅ SAFE

**What Happens:**
```typescript
// Contacts migration
UPDATE copper_people 
SET companyId = primaryCopperId 
WHERE companyId = secondaryCopperId

// Deals migration
UPDATE copper_opportunities 
SET company_id = primaryCopperId 
WHERE company_id = secondaryCopperId
```

**Impact:**
- All contacts move to primary account ✅
- All deals move to primary account ✅
- No orphaned records ✅
- Audit trail preserves history ✅

---

### **5. Sales Orders Display** ⚠️ POTENTIAL CONFUSION

**Current Logic:**
```typescript
// Account Detail page loads orders via:
const customerId = account.cf_698467; // Account Order ID
const orders = query(
  collection(db, 'fishbowl_sales_orders'),
  where('customerId', '==', customerId)
);
```

**Risk:**
- If user merges accounts with DIFFERENT Order IDs
- And chooses secondary account's Order ID
- Primary account will now show DIFFERENT orders than before
- This could confuse users

**Example:**
```
Before Merge:
- Account A shows orders for customerId="494" (10 orders)
- Account B shows orders for customerId="495" (5 orders)

After Merge (user chooses "495"):
- Account A now shows orders for customerId="495" (5 orders)
- Original 10 orders are "lost" from UI perspective
- They still exist in database, just not linked to any active account
```

**Safeguard Required:**
- Show warning if Order IDs differ
- Display order counts for each Order ID before merge
- Allow user to see what they're choosing

---

## 🛡️ SAFEGUARDS IMPLEMENTED

### ✅ Already Built:
1. **Audit Trail** - Complete snapshot of secondary account stored
2. **Soft Delete** - Secondary accounts archived, not deleted
3. **Conflict Resolution** - User chooses which values to keep
4. **Related Records Migration** - Contacts and deals automatically moved
5. **Multi-Account Support** - Can merge 3, 4, 5+ accounts at once
6. **Batch Tracking** - Audit logs track batch merges

### ⚠️ Still Needed:
1. **Order ID Warning** - Alert if merging accounts with different `cf_698467`
2. **Order Count Display** - Show how many orders each Order ID has
3. **Dual Order ID Support** - Store multiple Order IDs in primary account
4. **Import Reconciliation** - Handle future imports with archived Order IDs

---

## 📋 RECOMMENDED SAFEGUARDS TO ADD

### **Priority 1: Order ID Conflict Warning**

Add to merge dialog:

```typescript
// Detect Order ID conflicts
const orderIds = accounts.map(a => a.accountOrderId).filter(Boolean);
const uniqueOrderIds = [...new Set(orderIds)];

if (uniqueOrderIds.length > 1) {
  // Show warning
  const orderCounts = await Promise.all(
    uniqueOrderIds.map(async (orderId) => {
      const count = await getOrderCount(orderId);
      return { orderId, count };
    })
  );
  
  // Display in dialog:
  // ⚠️ Warning: These accounts have different Order IDs
  // - Order ID 494: 10 orders
  // - Order ID 495: 5 orders
  // Choosing one will affect which orders appear in the account detail page
}
```

### **Priority 2: Store Multiple Order IDs**

Update merge logic:

```typescript
// Instead of single cf_698467
mergedData.cf_698467 = primaryOrderId;

// Add array of all Order IDs
mergedData.cf_698467_all = uniqueOrderIds; // ["494", "495"]

// Update order loading to check all IDs
const orders = query(
  collection(db, 'fishbowl_sales_orders'),
  where('customerId', 'in', account.cf_698467_all || [account.cf_698467])
);
```

### **Priority 3: Import Reconciliation**

Add to import process:

```typescript
// Check if customerId belongs to archived account
const archivedAccount = await checkArchivedAccounts(customerId);
if (archivedAccount?.mergedInto) {
  // Log warning
  console.warn(`Order for archived account ${customerId}, merged into ${archivedAccount.mergedInto}`);
  
  // Optionally update order to reference primary account
  // OR flag for manual review
}
```

---

## 🧪 TESTING CHECKLIST

Before using merge in production:

### **Test Scenario 1: Same Order ID**
- [ ] Merge 2 accounts with SAME `cf_698467`
- [ ] Verify all contacts migrated
- [ ] Verify all deals migrated
- [ ] Verify orders still display correctly
- [ ] Verify secondary account archived
- [ ] Verify audit trail created

### **Test Scenario 2: Different Order IDs**
- [ ] Merge 2 accounts with DIFFERENT `cf_698467`
- [ ] Choose primary Order ID
- [ ] Verify which orders now display
- [ ] Verify secondary orders still in database
- [ ] Check if future imports work correctly

### **Test Scenario 3: Multiple Accounts (3+)**
- [ ] Merge 3-5 accounts at once
- [ ] Verify all contacts/deals migrate
- [ ] Verify all secondary accounts archived
- [ ] Verify audit logs created for each

### **Test Scenario 4: Commission Impact**
- [ ] Run commission calculation BEFORE merge
- [ ] Execute merge
- [ ] Run commission calculation AFTER merge
- [ ] Verify commissions are IDENTICAL
- [ ] (They should be - merge doesn't affect fishbowl_sales_orders)

---

## 🎯 FINAL RECOMMENDATION

**SAFE TO USE** with these conditions:

1. ✅ **For accounts with SAME Order ID** - Merge freely
2. ⚠️ **For accounts with DIFFERENT Order IDs** - Use with caution
   - Understand which orders will be displayed
   - Consider implementing Priority 2 safeguard first
3. ✅ **Commissions are SAFE** - No direct impact
4. ⚠️ **Future imports** - May need manual reconciliation

**Best Practice:**
- Merge duplicates that represent the SAME customer
- Avoid merging unrelated accounts just because they have similar names
- Always review Order ID conflicts before merging
- Keep audit trail for at least 1 year

---

## 📞 SUPPORT SCENARIOS

**"I merged accounts and now orders are missing!"**
- Orders aren't deleted, just not linked to active account
- Check audit trail in `account_merges` collection
- Secondary account snapshot has original Order ID
- Can restore by un-archiving secondary account OR updating primary Order ID

**"Commission calculation is wrong after merge!"**
- Unlikely - commissions use `fishbowl_sales_orders.customerId`
- Merge only affects `copper_companies`
- Re-run calculation to verify
- Check if `fishbowl_customers.accountType` was changed

**"Future imports aren't showing up!"**
- Check if import uses archived account's Order ID
- Look for orders with `customerId` matching secondary Order ID
- Consider implementing dual Order ID support

---

## 🔄 UNDO PROCESS (If Needed)

To reverse a merge:

```typescript
// 1. Get audit log
const audit = await getDoc(doc(db, 'account_merges', auditId));

// 2. Restore secondary account
await updateDoc(doc(db, 'copper_companies', secondaryId), {
  ...audit.secondaryAccountSnapshot,
  cf_712751: true, // Re-activate
  isArchived: false,
  mergedInto: null,
});

// 3. Restore contacts
for (const contactId of audit.migratedRecords.contacts) {
  await updateDoc(doc(db, 'copper_people', contactId), {
    companyId: secondaryCopperId,
  });
}

// 4. Restore deals
for (const dealId of audit.migratedRecords.deals) {
  await updateDoc(doc(db, 'copper_opportunities', dealId), {
    company_id: secondaryCopperId,
  });
}

// 5. Mark audit as rolled back
await updateDoc(doc(db, 'account_merges', auditId), {
  status: 'rolled_back',
  rolledBackAt: new Date(),
});
```

---

**Document Version:** 1.0  
**Last Updated:** January 22, 2026  
**Author:** System Analysis
