# Fishbowl Import - Complete Field Dependency Audit

## CRITICAL FINDING: Qty fulfilled Dependency

**⚠️ PROBLEM:** Commission calculation SKIPS all orders where `quantity = 0` on ALL line items.

```typescript
// From calculate-monthly-commissions/route.ts:
const qty = lineItem.quantity || 0;
if (qty > 0) {
  hasFulfilledItems = true;
}

// Skip orders with no fulfilled items (all qty = 0)
if (!hasFulfilledItems || totalFulfilledQty === 0) {
  console.log(`⚠️ ZERO QUANTITY ORDER DETECTED`);
  continue; // ← ENTIRE ORDER SKIPPED FROM COMMISSION
}
```

**If v2 CSV has no Qty fulfilled column:**
- Import writes `quantity: 0` to all line items
- Commission calculation skips EVERY order
- Result: **$0 commissions calculated**

---

## Complete Field Requirements by Stage

### Stage 1: Import (import-unified/route.ts)

**HARD REQUIRED (causes skip if missing):**
```typescript
if (!soNum || !salesOrderId || !lineItemId) {
  stats.skipped++;
  continue;
}
if (!customerId) {
  stats.skipped++;
  continue;
}
if (!commissionMonth || !commissionYear) {
  stats.skipped++;
  continue;
}
```

**Fields:**
1. ✅ `Sales order Number` → `soNumber`
2. ✅ `Sales Order ID` → `salesOrderId` (CRITICAL: joins orders to line items)
3. ✅ `SO Item ID` → `soItemId` (CRITICAL: deduplication key)
4. ✅ `Account ID` → `customerId`
5. ✅ `Issued date` → `commissionMonth`, `commissionYear`, `postingDate`
6. ✅ `Customer Name` → `customerName` (has fallback to `Customer`)
7. ✅ `Sales Rep` → `salesPerson` (CRITICAL: determines who gets commission)

**USED but with defaults/fallbacks:**
8. ⚠️ `Qty fulfilled` → `quantity` (defaults to 0 if missing - **BREAKS COMMISSIONS**)
9. ⚠️ `Unit price` → `unitPrice` (used to calculate totalPrice if missing)
10. ✅ `Total Price` → `totalPrice` (CRITICAL: revenue, can be calculated from unitPrice × qty)
11. ⚠️ `Total cost` → `totalCost` (optional - margins)
12. ✅ `SO Item Product Number` → `product`, `productNum`, `partNumber`
13. ⚠️ `Product Description` → `productName`, `description`

**Written to DB Collections:**
- `fishbowl_customers`: id, name, accountType
- `fishbowl_sales_orders`: soNumber, salesOrderId, customerId, salesPerson, commissionMonth, etc.
- `fishbowl_soitems`: soItemId, salesOrderId, product, quantity, unitPrice, totalPrice, etc.

---

### Stage 2: Validation (validate-commission-data/route.ts)

**READS from DB:**

From `fishbowl_sales_orders`:
- `salesOrderId` - CRITICAL (joins to line items)
- `salesPerson` - CRITICAL (rep matching)
- `soNumber` or `num` - display
- `customerId`, `customerNum`, `accountNumber` - customer lookup
- `customerName` - display
- `manuallyLinked` - skip flag

From `fishbowl_soitems`:
- `soItemId`, `soItemID`, `lineItemId`, `id` - deduplication
- `totalPrice` - CRITICAL (revenue calculation)
- `unitPrice` - fallback revenue calculation
- `quantity` - revenue validation
- `productNum`, `partNumber` - display

**Logic:**
```typescript
let itemPrice = item.totalPrice || 0;
const calculatedPrice = (item.unitPrice || 0) * (item.quantity || 0);

// Calculate total revenue for validation
orderRevenue += itemPrice;
```

---

### Stage 3: Commission Calculation (calculate-monthly-commissions/route.ts)

**CRITICAL DEPENDENCIES:**

From `fishbowl_sales_orders`:
- `salesOrderId` - CRITICAL (joins to line items)
- `salesPerson` - CRITICAL (determines commission recipient)
- `customerId` - customer lookup for segment/rate
- `postingDate` - customer status calculation
- `excludeFromCommission` - manual skip flag

From `fishbowl_soitems`:
- `soItemId` - CRITICAL (deduplication - prevents double-counting)
- **`quantity`** - **CRITICAL (skip order if all qty=0, required for spiffs)**
- `totalPrice` - CRITICAL (revenue for commission base)
- `unitPrice` - fallback for revenue calculation
- `productName` - shipping/CC fee exclusion logic
- `productNum`, `product` - spiff matching

**Critical Logic:**
```typescript
// 1. Check for fulfilled items
const qty = lineItem.quantity || 0;
if (qty > 0) hasFulfilledItems = true;

if (!hasFulfilledItems || totalFulfilledQty === 0) {
  continue; // ← SKIP ENTIRE ORDER
}

// 2. Calculate revenue
let itemPrice = lineItem.totalPrice || 0;
if (itemPrice === 0 && lineItem.unitPrice && lineItem.quantity) {
  itemPrice = (lineItem.unitPrice || 0) * (lineItem.quantity || 0);
}

// 3. Spiff calculation
if (spiff.incentiveType === 'flat') {
  spiffAmount = quantity * spiff.incentiveValue; // ← qty REQUIRED
}
```

---

## REQUIRED vs OPTIONAL Fields

### ✅ ABSOLUTELY REQUIRED (cannot function without):
1. `Sales order Number`
2. `Sales Order ID` 
3. `SO Item ID`
4. `Account ID`
5. `Customer Name`
6. `Sales Rep`
7. `Issued date`
8. `Total Price`
9. `SO Item Product Number`

### ⚠️ CRITICAL but has fallback logic:
10. **`Qty fulfilled`** - Defaults to 0, but **breaks commissions if all 0**
11. `Unit price` - Can calculate Total Price if missing

### ⚠️ IMPORTANT for features:
12. `Total cost` - Needed for margin reports
13. `Product Description` - Needed for shipping/CC exclusion
14. `Sales Rep Initials` - Reporting only

---

## v2 CSV Analysis

From normalization log:
```
✅ "Customer id" → "Account ID"
✅ "Sales order Number" → "Sales order Number"
✅ "Sales Order ID" → "Sales Order ID"
✅ "Sales Order Product ID" → "SO Item ID"
✅ "Product ID" → "SO Item Product Number"
✅ "Sales person" → "Sales Rep"
✅ "Posting Date" → "Issued date"
✅ "Revenue" → "Total Price"
✅ "Unit price" → "Unit price"
✅ "Invoiced cost" → "Total cost"

❌ MISSING: "Qty fulfilled" or any quantity column
```

---

## RECOMMENDATION

### Option 1: Find Quantity in v2 CSV
Check if v2 CSV has quantity under a different name:
- "Quantity"
- "Qty"
- "Amount"
- "Units"
- "Line Quantity"

Add alias to normalize-csv if found.

### Option 2: Default to Quantity = 1
If v2 CSV truly has no quantity, modify import to default:
```typescript
const quantity = safeParseNumber(row['Qty fulfilled']) || 1; // Default to 1
```

This assumes:
- Revenue is already in Total Price (not calculated from qty × unitPrice)
- One unit sold per line item (safe assumption for most orders)

### Option 3: Make Optional but Warn
Keep `Qty fulfilled` optional but log warning:
```typescript
if (!row['Qty fulfilled']) {
  console.warn(`⚠️ No quantity for order ${soNum} - defaulting to 1`);
}
```

---

## FINAL REQUIRED FIELDS LIST

For normalize-csv `REQUIRED_FIELDS`:

```typescript
const REQUIRED_FIELDS = {
  // Order identification
  'Sales order Number': { required: true },
  'Sales Order ID': { required: true },
  'Account ID': { required: true },
  'Customer Name': { required: true },
  
  // Commission calculation
  'Sales Rep': { required: true },
  'Issued date': { required: true },
  
  // Line item identification
  'SO Item ID': { required: true },
  'SO Item Product Number': { required: true },
  
  // Revenue calculation
  'Total Price': { required: true },
  
  // CRITICAL but can default
  'Qty fulfilled': { required: false }, // ⚠️ WARN IF MISSING
  'Unit price': { required: false },
  
  // Optional
  'Total cost': { required: false },
  'Product Description': { required: false },
};
```

---

## ACTION REQUIRED

**Question for User:** Does v2 CSV have a quantity field under ANY name?

If NO → We must default `quantity = 1` in import, otherwise:
- ✅ Orders will import successfully
- ❌ Commission calculation will skip ALL orders (qty=0)
- ❌ Spiffs won't calculate
- Result: **Complete commission system failure**
