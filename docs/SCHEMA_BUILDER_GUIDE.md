# Firebase Schema Builder - Complete Usage Guide

## 🎯 What Problem Does This Solve?

**Current Problem:**
Your codebase has hardcoded database queries scattered everywhere:
```typescript
// ❌ Hardcoded (current state)
const orderDoc = await getDoc(doc(db, 'fishbowl_sales_orders', orderId));
const order = orderDoc.data();
const customerDoc = await getDoc(doc(db, 'copper_companies', order.customerId));
const customer = customerDoc.data();
```

**Problems with this approach:**
- No type safety
- Magic strings (`'fishbowl_sales_orders'`, `'copper_companies'`)
- Can't change field names without finding all references
- Impossible to open-source (customers would need different schema)
- No autocomplete for field names

---

## ✅ Solution: Schema-Driven Code Generation

**What You'll Build:**
1. Define your schema once in the Schema Builder UI
2. Generate TypeScript code
3. Import generated code into your project
4. Replace hardcoded queries with type-safe helpers

---

## 📋 Step-by-Step Implementation

### **Phase 1: Define Your Schema (Schema Builder UI)**

#### 1. Open Schema Builder
Navigate to: `/admin/tools/schema-mapper`

#### 2. Define Field Types for Each Collection
Click any collection → Right panel opens

**Example: `fishbowl_sales_orders` collection**
- Click `fishbowl_sales_orders` in sidebar
- In right panel, for each field:
  - `customerId`: Type = **reference**, References = `copper_companies`
  - `salesRepId`: Type = **reference**, References = `users`
  - `totalAmount`: Type = **number**, Required = ✓
  - `commissionMonth`: Type = **string**
  - `createdAt`: Type = **timestamp**

**Example: `copper_companies` collection**
- `id`: Type = **string**, Required = ✓
- `name`: Type = **string**, Required = ✓
- `salesRepId`: Type = **reference**, References = `users`
- Primary Key = `id`

#### 3. Create Relationships
- Add collections to canvas (click + next to collection)
- Click a field → click another field → "Create Relationship"
- Define:
  - Relationship Type: `1:many` (many orders → one customer)
  - From Field: `customerId`
  - To Field: `id`
  - Relationship Name: `customer` (this becomes the method name)

---

### **Phase 2: Generate TypeScript Code**

#### 1. Click "Generate Code" Button
Downloads 2 files:
- `schema-types.ts` - TypeScript interfaces
- `schema-helpers.ts` - Relationship query functions

#### 2. Place Files in Your Project
```
c:\Projects\KanvaPortal\
  lib\
    schema\
      types.ts         ← Rename schema-types.ts to this
      helpers.ts       ← Rename schema-helpers.ts to this
```

**File Structure:**
```typescript
// lib/schema/types.ts (AUTO-GENERATED)
export interface FishbowlSalesOrder {
  id: string;
  customerId: string;
  salesRepId?: string;
  totalAmount: number;
  commissionMonth?: string;
  createdAt: Date;
}

export interface CopperCompany {
  id: string;
  name: string;
  salesRepId?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}
```

```typescript
// lib/schema/helpers.ts (AUTO-GENERATED)
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { FishbowlSalesOrder, CopperCompany, User } from './types';

export class SchemaHelper {
  /**
   * Get related customer for order
   * Relationship: fishbowl_sales_orders.customerId → copper_companies.id
   */
  static async getCustomerForOrder(orderId: string) {
    const orderDoc = await getDoc(doc(db, 'fishbowl_sales_orders', orderId));
    if (!orderDoc.exists()) return null;
    
    const order = orderDoc.data() as FishbowlSalesOrder;
    const customerId = order.customerId;
    if (!customerId) return null;
    
    const customerDoc = await getDoc(doc(db, 'copper_companies', customerId));
    return customerDoc.exists() ? customerDoc.data() as CopperCompany : null;
  }
  
  // More helper methods...
}
```

---

### **Phase 3: Update Your Codebase**

#### Replace Hardcoded Queries (One Module at a Time)

**Before (Hardcoded):**
```typescript
// app/commissions/calculate.ts
async function calculateCommission(orderId: string) {
  const orderDoc = await getDoc(doc(db, 'fishbowl_sales_orders', orderId));
  const order = orderDoc.data();
  
  const customerDoc = await getDoc(doc(db, 'copper_companies', order.customerId));
  const customer = customerDoc.data();
  
  const salesRepDoc = await getDoc(doc(db, 'users', customer.salesRepId));
  const salesRep = salesRepDoc.data();
  
  // Calculate commission...
  const rate = salesRep.commissionRate;
}
```

**After (Schema-Driven):**
```typescript
// app/commissions/calculate.ts
import { SchemaHelper } from '@/lib/schema/helpers';
import type { FishbowlSalesOrder } from '@/lib/schema/types';

async function calculateCommission(orderId: string) {
  const customer = await SchemaHelper.getCustomerForOrder(orderId);
  
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  // TypeScript autocomplete works! ✓
  const rate = customer.salesRep?.commissionRate;
}
```

**Benefits:**
- ✅ Full TypeScript autocomplete
- ✅ Type safety - can't access wrong fields
- ✅ Centralized queries
- ✅ Easy to refactor

---

### **Phase 4: Incremental Migration Strategy**

**Don't Replace Everything at Once!**

1. **Pick One Module** (e.g., commission calculation)
2. **Find All DB Queries** in that module
3. **Replace with SchemaHelper** methods
4. **Test Thoroughly**
5. **Move to Next Module**

**Example Migration Checklist:**
- [ ] `app/commissions/calculate.ts`
- [ ] `app/api/orders/route.ts`
- [ ] `app/reports/sales-summary.tsx`
- [ ] `app/dashboard/overview.tsx`
- [ ] etc.

---

## 🚀 Advanced: When Schema Changes

### Scenario: You renamed a field
**Problem:** Renamed `customerId` → `customerRef` in Firestore

**Solution:**
1. Update field name in Schema Builder
2. Click "Generate Code" again
3. Replace old `schema/types.ts` and `schema/helpers.ts`
4. TypeScript will show errors everywhere the field is used
5. Fix all errors (autocomplete helps!)
6. Done!

---

## 🌐 Open Source / Multi-Tenant Use Case

**Goal:** Let customers use your CRM with their own schema

### Setup for Customer Onboarding:
1. Customer connects their Firestore
2. Run schema analyzer (existing tool)
3. Customer uses Schema Builder to define relationships
4. Customer clicks "Generate Code"
5. Customer downloads their custom `types.ts` and `helpers.ts`
6. They place it in their project → code works with their schema!

**No hardcoding needed!**

---

## 🎓 Key Concepts

### **1. Type Safety**
```typescript
// ❌ No autocomplete, no type checking
const name = customer.data().name;

// ✅ Full autocomplete, compile-time errors if wrong
const name: string = customer.name;
```

### **2. Centralized Schema**
- One source of truth (Schema Builder)
- Change once → regenerate → done
- No hunting through codebase for field names

### **3. Relationship Helpers**
Instead of writing join logic manually:
```typescript
// ❌ Manual joins (error-prone)
const order = await getOrder();
const customer = await getCustomer(order.customerId);
const salesRep = await getSalesRep(customer.salesRepId);

// ✅ Helper does it for you
const { customer, salesRep } = await SchemaHelper.getOrderWithRelations(orderId);
```

---

## 📁 File Organization

```
c:\Projects\KanvaPortal\
  lib\
    schema\              ← Your generated schema code
      types.ts           ← TypeScript interfaces (regenerate when schema changes)
      helpers.ts         ← Query helpers (regenerate when relationships change)
  
  app\
    commissions\
      calculate.ts       ← Uses SchemaHelper.getCustomerForOrder()
    
    api\
      orders\
        route.ts         ← Uses SchemaHelper methods
  
  docs\
    data_schema.md       ← Your documentation (manual)
    SCHEMA_BUILDER_GUIDE.md  ← This guide
```

---

## ⚡ Quick Reference

### Common Tasks

**1. Add a new relationship:**
- Schema Builder → Click field → Click another field → Create Relationship
- Generate Code → Replace files
- Import in your code: `SchemaHelper.getNewRelationship()`

**2. Change field type:**
- Schema Builder → Click collection → Edit field type
- Generate Code → Replace `types.ts`
- Fix TypeScript errors

**3. Add new collection:**
- Schema Builder → Collection appears automatically (from schema analyzer)
- Define field types
- Create relationships
- Generate Code

---

## 🐛 Troubleshooting

### "Fields not showing in dropdown"
→ Make sure collection is on the canvas (click + button)

### "Generated code has wrong field names"
→ Re-run schema analyzer to refresh field list

### "TypeScript errors after importing"
→ Make sure `@/lib/firebase` path is correct in your project

### "Relationship methods not working"
→ Check that you defined the field mapping in the modal (from/to fields)

---

## 🎯 Next Steps

1. **Start Small:** Define types for your 3 most-used collections
2. **Create Key Relationships:** orders → customers, orders → sales reps
3. **Generate First Code:** Download and test
4. **Replace One Module:** Pick commission calculation
5. **Expand:** Add more collections and relationships
6. **Maintain:** Regenerate when schema changes

---

## 💡 Pro Tips

- Name relationships descriptively (e.g., `customer`, `salesRep`, not `rel1`)
- Mark required fields to catch bugs early
- Use reference types for foreign keys
- Keep `types.ts` and `helpers.ts` in version control
- Regenerate after any schema changes
- Comment your relationships in the UI for documentation

---

**You now have a professional, maintainable, type-safe data access layer!** 🚀
