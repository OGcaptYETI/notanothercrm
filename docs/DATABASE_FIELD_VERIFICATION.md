# Database Field Verification - Reports Page

**CRITICAL VERIFICATION: All field mappings between database and UI code**  
Last Updated: January 15, 2026

---

## 🔴 CRITICAL BUGS FIXED

### **Bug 1: Wrong Query Field Name**
```typescript
// ❌ BEFORE - RETURNED ZERO RESULTS
where('salesOrderNum', '==', detail.orderNum)

// ✅ AFTER - CORRECT FIELD NAME
where('soNumber', '==', detail.orderNum)
```

### **Bug 2: Wrong Revenue Field Name**
```typescript
// ❌ BEFORE - FIELD DOESN'T EXIST
const lineTotal = data.revenue || 0;

// ✅ AFTER - CORRECT FIELD NAME
const lineTotal = data.totalPrice || 0;
```

### **Bug 3: Wrong Product Name Field**
```typescript
// ❌ BEFORE - USED WRONG FIELD FOR EXCLUSIONS
const productName = (data.product || data.description || '').toLowerCase();

// ✅ AFTER - CORRECT FIELD NAME
const productName = (data.productName || '').toLowerCase();
```

---

## 📊 Collection Structure & Field Mappings

### **1. `fishbowl_soitems` Collection**

**Document ID Format:** `{salesOrderId}_{soItemId}`  
**Example:** `12598_41368`

#### **Database Fields → Code Usage:**

| Database Field | Type | Code Reference | Used For |
|---------------|------|----------------|----------|
| `soNumber` | string | `where('soNumber', '==', orderNum)` | **Query key** |
| `salesOrderId` | string | Document ID (first part) | Composite key |
| `soItemId` | string | Document ID (second part) | Composite key |
| `customerId` | string | `data.customerId` | Customer linking |
| `customerName` | string | `data.customerName` | Display |
| `productNum` | string | `data.productNum` | Spiff matching (fallback) |
| `partNumber` | string | `data.partNumber` | **Spiff matching (primary)** |
| `product` | string | `data.product` | Display |
| `productName` | string | `data.productName` | **Exclusion logic** |
| `description` | string | `data.description` | Display |
| `quantity` | number | `data.quantity` | Commission calc |
| `unitPrice` | number | `data.unitPrice` | Display |
| `totalPrice` | number | `data.totalPrice` | **Commission base** |
| `salesPerson` | string | `data.salesPerson` | Rep matching |
| `commissionMonth` | string | `data.commissionMonth` | Period filter |
| `commissionYear` | number | `data.commissionYear` | Period filter |
| `commissionDate` | timestamp | `data.commissionDate` | Sorting |
| `postingDate` | timestamp | `data.postingDate` | Display |

#### **Fields That DON'T Exist (removed from code):**
- ❌ `salesOrderNum` - Use `soNumber` instead
- ❌ `revenue` - Use `totalPrice` instead
- ❌ `productDesc` - Use `description` instead

---

### **2. `fishbowl_sales_orders` Collection**

**Document ID Format:** `{soNumber}`  
**Example:** `6447`

#### **Database Fields:**

| Database Field | Type | Purpose |
|---------------|------|---------|
| `soNumber` | string | **Document ID** (order number) |
| `salesOrderId` | string | Internal Fishbowl ID |
| `customerId` | string | Links to `fishbowl_customers` |
| `customerName` | string | Display name |
| `accountType` | string | Distributor/Wholesale/Retail |
| `salesPerson` | string | Rep name |
| `salesRep` | string | Rep name (duplicate) |
| `commissionMonth` | string | Period (YYYY-MM) |
| `commissionYear` | number | Year |
| `commissionDate` | timestamp | Date for period |
| `postingDate` | timestamp | Order date |

---

### **3. `fishbowl_customers` Collection**

**Document ID Format:** `{accountNumber}`  
**Example:** `1439` (Fishbowl Account ID)

#### **Database Fields:**

| Database Field | Type | Purpose |
|---------------|------|---------|
| `id` | string | Account number (same as doc ID) |
| `accountId` | string | Copper account ID |
| `accountNumber` | string | Fishbowl account number |
| `copperId` | number | Copper numeric ID |
| `name` | string | Customer name |
| `accountType` | string | Distributor/Wholesale/Retail |
| `accountTypeSource` | string | copper_companies/copper_people |
| `salesPerson` | string | Assigned rep initials |
| `salesRepName` | string | Full rep name |
| `salesRepEmail` | string | Rep email |
| `salesRepRegion` | string | Territory |
| `region` | number | Copper region ID |
| `billingAddress` | string | Address |
| `billingCity` | string | City |
| `billingState` | string | State |
| `billingZip` | string | ZIP |
| `shippingAddress` | string | Shipping address |
| `shippingCity` | string | Shipping city |
| `shippingState` | string | Shipping state |
| `shipToZip` | string | Shipping ZIP |
| `lastOrderDate` | timestamp | Most recent order |
| `lastOrderNum` | string | Most recent order number |
| `lastSalesPerson` | string | Last rep |
| `source` | string | copper_sync |
| `syncedFromCopperAt` | timestamp | Last sync time |
| `createdAt` | timestamp | Created |
| `updatedAt` | timestamp | Updated |

---

### **4. `fishbowl_customers/{customerId}/sales_order_history` Subcollection**

**Document ID Format:** `{soNumber}`  
**Example:** `9879`

#### **Database Fields:**

| Database Field | Type | Purpose |
|---------------|------|---------|
| `soNumber` | string | **Document ID** (order number) |
| `salesOrderId` | string | Internal Fishbowl ID |
| `customerId` | string | Parent customer ID |
| `customerName` | string | Customer name |
| `accountType` | string | Account type at time of order |
| `salesPerson` | string | Rep name |
| `salesRep` | string | Rep name (duplicate) |
| `commissionMonth` | string | Period (YYYY-MM) |
| `commissionYear` | number | Year |
| `commissionDate` | timestamp | Date for period |
| `postingDate` | timestamp | Order date |
| `writtenAt` | timestamp | When written to subcollection |
| `updatedAt` | timestamp | Last update |

---

## 🔍 Reports Page Query Logic

### **Query 1: Load Line Items for Order**
```typescript
// Location: Line 192-195
const itemsQuery = query(
  collection(db, 'fishbowl_soitems'),
  where('soNumber', '==', detail.orderNum) // ✅ CORRECT
);
```

**What this does:**
- Queries `fishbowl_soitems` collection
- Filters by `soNumber` field (matches order number from `monthly_commissions`)
- Returns all line items for that order

**Example:**
- Order number: `6447`
- Query: `where('soNumber', '==', '6447')`
- Returns: All documents where `soNumber = '6447'`

---

### **Query 2: Load Line Items for Detailed View**
```typescript
// Location: Line 404-407
const itemsQuery = query(
  collection(db, 'fishbowl_soitems'),
  where('soNumber', '==', orderNum) // ✅ CORRECT
);
```

**What this does:**
- Same as Query 1
- Used when user expands an order to see line item details

---

## 📋 Field Usage in Line Item Processing

### **Commission Calculation Fields:**
```typescript
const lineTotal = data.totalPrice || 0;        // ✅ Revenue for this line
const quantity = data.quantity || 0;           // ✅ Quantity sold
const productNumber = data.partNumber || data.productNum || ''; // ✅ For spiff matching
const productName = data.productName || '';    // ✅ For exclusions
```

### **Exclusion Logic:**
```typescript
const isShipping = productName.includes('shipping') || 
                   productNum.includes('shipping') ||
                   productName === 'shipping';

const isCCProcessing = productName.includes('cc processing') ||
                       productName.includes('credit card processing') ||
                       productNum.includes('cc processing');
```

### **Display Fields:**
```typescript
items.push({
  id: doc.id,                          // Document ID (salesOrderId_soItemId)
  orderNum: orderNum,                  // Order number
  productNum: productNumber,           // Product number for display
  product: data.product || '',         // Product code
  description: data.description || '', // ✅ Product description
  quantity: quantity,                  // Quantity
  unitPrice: data.unitPrice || 0,      // Unit price
  lineTotal: lineTotal,                // Total price
  commissionAmount: commissionAmount,  // Calculated commission
});
```

---

## ✅ Verification Checklist

### **Database Structure:**
- ✅ `fishbowl_soitems` document IDs are `{salesOrderId}_{soItemId}`
- ✅ `fishbowl_sales_orders` document IDs are `{soNumber}`
- ✅ `fishbowl_customers` document IDs are `{accountNumber}`
- ✅ `sales_order_history` subcollection document IDs are `{soNumber}`

### **Query Fields:**
- ✅ Query uses `soNumber` (not `salesOrderNum`)
- ✅ Revenue uses `totalPrice` (not `revenue`)
- ✅ Product name uses `productName` (not `product`)
- ✅ Description uses `description` (not `productDesc`)

### **Field Mappings:**
- ✅ `partNumber` used for spiff matching (primary)
- ✅ `productNum` used for spiff matching (fallback)
- ✅ `productName` used for exclusion logic
- ✅ `totalPrice` used for commission base
- ✅ `quantity` used for spiff calculations
- ✅ `description` used for display

### **Relationships:**
- ✅ `fishbowl_soitems.soNumber` → `fishbowl_sales_orders.soNumber`
- ✅ `fishbowl_soitems.salesOrderId` → `fishbowl_sales_orders.salesOrderId`
- ✅ `fishbowl_soitems.customerId` → `fishbowl_customers.id`
- ✅ `fishbowl_sales_orders.customerId` → `fishbowl_customers.id`
- ✅ `sales_order_history.soNumber` → `fishbowl_sales_orders.soNumber`

---

## 🎯 Expected Behavior

### **When User Opens Reports Page:**
1. Loads `monthly_commissions` for selected month
2. Groups by customer using `customerName`
3. When customer expanded:
   - Shows all orders for that customer
4. When order expanded:
   - Queries `fishbowl_soitems` using `soNumber`
   - Displays line items with product details
   - Shows commission per line item
   - Calculates total commission from line items

### **Line Item Display:**
- ✅ Product thumbnail (from `products` collection)
- ✅ Product number (`productNum`)
- ✅ Description (`description`)
- ✅ Quantity (`quantity`)
- ✅ Unit price (`unitPrice`)
- ✅ Line total (`totalPrice`)
- ✅ Commission amount (calculated)

---

## 🚨 Critical Notes

1. **Document IDs are NOT the same across collections:**
   - `fishbowl_soitems`: `12598_41368` (salesOrderId_soItemId)
   - `fishbowl_sales_orders`: `6447` (soNumber)
   - `fishbowl_customers`: `1439` (accountNumber)

2. **Query by `soNumber`, NOT by document ID:**
   - ✅ `where('soNumber', '==', '6447')`
   - ❌ `doc('6447')` won't work for `fishbowl_soitems`

3. **Field names are case-sensitive:**
   - ✅ `soNumber` (lowercase 's', lowercase 'o')
   - ❌ `SONumber` or `SoNumber` won't match

4. **All fixes are now in place:**
   - Reports page will correctly load line items
   - Commission calculations will use correct fields
   - Product exclusions will work properly
   - Display will show all data correctly

---

**End of Verification Document**
