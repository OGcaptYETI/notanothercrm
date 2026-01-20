# Data Access Migration Guide

**Purpose:** Step-by-step guide to migrate from scattered data access to centralized relationships layer

---

## Overview

This guide helps you migrate existing code from direct Firestore queries to the centralized `lib/data/relationships.ts` system.

**Benefits:**
- ✅ Single source of truth for relationships
- ✅ Type-safe data access
- ✅ Consistent patterns across codebase
- ✅ Easy to maintain and update
- ✅ Self-documenting code

---

## Migration Strategy

### Phase 1: Run Analysis (DONE)
```bash
npm run analyze-data-access
```

This generates:
- `docs/migration-report.md` - Human-readable report
- `docs/migration-report.json` - Programmatic access

### Phase 2: Migrate High-Priority Files
Start with files that have the most data access patterns.

### Phase 3: Test Each Migration
Test thoroughly before moving to next file.

### Phase 4: Remove Old Code
Once confident, remove old patterns.

---

## Common Migration Patterns

### Pattern 1: Get Company with Orders

**BEFORE:**
```typescript
// Scattered across components
const companyRef = doc(db, 'copper_companies', companyId);
const companySnap = await getDoc(companyRef);
const company = { id: companySnap.id, ...companySnap.data() };

const ordersQuery = query(
  collection(db, 'fishbowl_sales_orders'),
  where('customerId', '==', company.cf_698467)
);
const ordersSnap = await getDocs(ordersQuery);
const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**AFTER:**
```typescript
import { getCompanyWithOrders } from '@/lib/data/relationships';

const company = await getCompanyWithOrders(companyId);
// company.orders is automatically populated
```

---

### Pattern 2: Get Company with Contacts

**BEFORE:**
```typescript
const contactsQuery = query(
  collection(db, 'copper_people'),
  where('company_id', '==', companyId)
);
const contactsSnap = await getDocs(contactsQuery);
const contacts = contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**AFTER:**
```typescript
import { getCompanyWithContacts } from '@/lib/data/relationships';

const company = await getCompanyWithContacts(companyId);
// company.contacts is automatically populated
```

---

### Pattern 3: Get Order with Line Items

**BEFORE:**
```typescript
const orderRef = doc(db, 'fishbowl_sales_orders', orderId);
const orderSnap = await getDoc(orderRef);
const order = { id: orderSnap.id, ...orderSnap.data() };

const itemsQuery = query(
  collection(db, 'fishbowl_sales_order_items'),
  where('orderId', '==', orderId)
);
const itemsSnap = await getDocs(itemsQuery);
const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**AFTER:**
```typescript
import { getOrderWithLineItems } from '@/lib/data/relationships';

const order = await getOrderWithLineItems(orderId);
// order.lineItems is automatically populated
```

---

### Pattern 4: Custom Relationships

**BEFORE:**
```typescript
// Complex manual query
const q = query(
  collection(db, 'some_collection'),
  where('someField', '==', someValue)
);
const snap = await getDocs(q);
```

**AFTER:**
```typescript
import { getRelated, getDocumentWithRelations } from '@/lib/data/relationships';

// Option 1: Use getRelated
const related = await getRelated('source_collection', sourceDoc, 'relationshipName');

// Option 2: Use getDocumentWithRelations
const doc = await getDocumentWithRelations('collection', docId, ['relationship1', 'relationship2']);
```

---

## Step-by-Step Migration Example

### Example: Account Detail Page

**File:** `app/(modules)/accounts/[id]/page.tsx`

#### Step 1: Import New Functions
```typescript
import { getCompanyWithAllRelations } from '@/lib/data/relationships';
```

#### Step 2: Replace Data Fetching
```typescript
// OLD:
const companyRef = doc(db, 'copper_companies', accountId);
const companySnap = await getDoc(companyRef);
const company = { id: companySnap.id, ...companySnap.data() };

const ordersQuery = query(
  collection(db, 'fishbowl_sales_orders'),
  where('customerId', '==', company.cf_698467)
);
const ordersSnap = await getDocs(ordersQuery);
const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

// NEW:
const company = await getCompanyWithAllRelations(accountId);
// company.orders, company.contacts, company.opportunities, company.assignedTo all populated
```

#### Step 3: Update Component Logic
```typescript
// OLD:
{orders.map(order => (
  <OrderCard key={order.id} order={order} />
))}

// NEW (same, but data comes from company.orders):
{company.orders?.map(order => (
  <OrderCard key={order.id} order={order} />
))}
```

#### Step 4: Test Thoroughly
- Verify data loads correctly
- Check all relationships work
- Test edge cases (no data, etc.)

#### Step 5: Remove Old Code
Once confident, remove old query code.

---

## React Hook Migration

### Pattern: Custom Hooks

**BEFORE:**
```typescript
export function useAccountOrders(accountId: string) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadOrders() {
      const q = query(
        collection(db, 'fishbowl_sales_orders'),
        where('customerId', '==', accountId)
      );
      const snap = await getDocs(q);
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }
    loadOrders();
  }, [accountId]);
  
  return { orders, loading };
}
```

**AFTER:**
```typescript
import { getCompanyWithOrders } from '@/lib/data/relationships';

export function useAccountOrders(accountId: string) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadOrders() {
      const company = await getCompanyWithOrders(accountId);
      setOrders(company?.orders || []);
      setLoading(false);
    }
    loadOrders();
  }, [accountId]);
  
  return { orders, loading };
}
```

---

## Testing Checklist

After each migration:

- [ ] Data loads correctly
- [ ] All relationships populate
- [ ] Loading states work
- [ ] Error handling works
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Edge cases handled (no data, null values, etc.)

---

## Common Issues & Solutions

### Issue 1: Field Name Mismatch
**Problem:** Old code uses different field name than schema
**Solution:** Update to use correct field from `data_schema.md`

### Issue 2: Missing Relationship
**Problem:** Relationship not defined in `relationships.ts`
**Solution:** Add relationship to `RELATIONSHIPS` object

### Issue 3: Type Errors
**Problem:** TypeScript errors after migration
**Solution:** Ensure proper typing, use `Record<string, any>` if needed

### Issue 4: Performance Concerns
**Problem:** Loading too much data
**Solution:** Only include needed relationships, use pagination

---

## Adding New Relationships

If you need a relationship not in `relationships.ts`:

1. **Add to RELATIONSHIPS object:**
```typescript
export const RELATIONSHIPS = {
  your_collection: {
    newRelationship: {
      collection: 'target_collection',
      localField: 'your_field',
      foreignField: 'target_field',
      type: '1:many',
      description: 'Description',
    },
  },
};
```

2. **Add helper function (optional):**
```typescript
export async function getYourCollectionWithRelation(id: string) {
  return getDocumentWithRelations('your_collection', id, ['newRelationship']);
}
```

3. **Update `data_schema.md`** to document the relationship

---

## Progress Tracking

Use this checklist to track migration progress:

### High Priority (Account/Order Pages)
- [ ] `app/(modules)/accounts/[id]/page.tsx`
- [ ] `app/(modules)/accounts/page.tsx`
- [ ] `lib/crm/dataService.ts`
- [ ] `lib/crm/hooks.ts`

### Medium Priority (Components)
- [ ] Components using account data
- [ ] Components using order data
- [ ] Dashboard components

### Low Priority (Admin/Tools)
- [ ] Admin pages
- [ ] Tool pages
- [ ] Settings pages

---

## Getting Help

1. **Check migration report:** `docs/migration-report.md`
2. **Review data schema:** `docs/data_schema.md`
3. **Check relationships:** `lib/data/relationships.ts`
4. **Test incrementally:** One file at a time

---

## Success Metrics

You'll know migration is successful when:

✅ All data access goes through `relationships.ts`
✅ No direct Firestore queries in components
✅ Consistent patterns across codebase
✅ Easy to add new relationships
✅ Self-documenting code

---

*Last Updated: January 20, 2026*
