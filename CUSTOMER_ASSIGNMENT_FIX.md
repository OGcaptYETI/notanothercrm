# Customer Assignment Fix - salesPerson vs salesRep

## Problem Summary

Customer filtering in Commission Settings shows incorrect customers when filtering by sales rep. The issue is field confusion between:

1. **`salesPerson`** - Person who ORIGINATED the sale (from Fishbowl "Sales person" column)
2. **`salesRep`** - CURRENT account owner/assigned rep (from Fishbowl "Sales Rep" column or Copper assignee)

## Current Behavior (BROKEN)

When Ben filters customers by his name:
- Shows customers from wrong regions ❌
- Shows customers not assigned to him ❌  
- Shows Shopify/protected customers incorrectly ❌
- Shows 0 customers (filtering not working) ❌

## Root Cause Analysis

### 1. Fishbowl Import (`import-unified/route.ts`)
```typescript
// Line 342-343 - Customer creation
salesPerson: row['Sales person'] || salesRep,  // Originator
salesRep: salesRep,                             // Current owner
```
**Issue:** Customers get `salesPerson` set to originator, but this should be for ORDERS only.

### 2. Copper Sync (`sync-copper-customers/route.ts`)
```typescript
// Line 401 - Sets salesPerson from Copper assignee
salesPerson: salesRepData.salesPerson
```
**Issue:** Overwrites Fishbowl originator with current owner, mixing concepts.

### 3. Customer Tab (`CustomersTab.tsx`)
```typescript
// Line 156 - Loading customers
const assignedRep = data.fishbowlUsername || data.salesPerson || 
                    customerSalesRepMap.get(customerId) || data.salesRep || '';

// Line 997 - Filtering
filtered = filtered.filter(c => c.fishbowlUsername === selectedRep);
```
**Issue:** Priority order mixes originator and current owner. `fishbowlUsername` is manual override but falls back to wrong fields.

## Correct Data Model

### For Customer Records (`fishbowl_customers`)
```typescript
{
  // CURRENT OWNERSHIP (for filtering/assignment)
  currentOwner: string,        // Current account owner (Fishbowl username: "BenW")
  currentOwnerName: string,    // Display name ("Ben Wallner")
  currentOwnerSource: 'fishbowl' | 'copper' | 'manual',
  
  // MANUAL OVERRIDE (admin can reassign)
  fishbowlUsername: string,    // Manual assignment override
  
  // LEGACY FIELDS (keep for compatibility)
  salesPerson: string,         // Deprecated - use currentOwner
  salesRep: string,            // Deprecated - use currentOwner
}
```

### For Order Records (`fishbowl_sales_orders`)
```typescript
{
  // ORIGINATOR (for commissions)
  salesPerson: string,         // Who originated THIS sale
  
  // CURRENT OWNER (for reference)
  salesRep: string,            // Account owner at time of order
}
```

## Fix Implementation

### Step 1: Update Fishbowl Import
Set `currentOwner` on customers based on Fishbowl "Sales Rep" (account owner):
```typescript
const newCustomerData = {
  currentOwner: salesRep,                    // Current account owner
  currentOwnerName: repsMap.get(salesRep),  // Display name
  currentOwnerSource: 'fishbowl',
  salesRep: salesRep,                        // Keep for compatibility
};
```

### Step 2: Update Copper Sync
Update `currentOwner` when Copper assignee changes:
```typescript
if (salesRepData) {
  newCustomerData.currentOwner = salesRepData.salesPerson;
  newCustomerData.currentOwnerName = salesRepData.name;
  newCustomerData.currentOwnerSource = 'copper';
}
```

### Step 3: Update Customer Tab Loading
Use `currentOwner` with proper fallback:
```typescript
const assignedRep = data.fishbowlUsername ||     // Manual override first
                    data.currentOwner ||          // Then current owner
                    data.salesRep ||              // Legacy fallback
                    '';
```

### Step 4: Update Customer Tab Filtering
Filter by the correct field:
```typescript
if (selectedRep !== 'all') {
  filtered = filtered.filter(c => 
    c.fishbowlUsername === selectedRep ||  // Manual override
    c.currentOwner === selectedRep         // Or current owner
  );
}
```

## Migration Strategy

1. **Add new field** - `currentOwner` to all customer records
2. **Populate from existing data** - Use `salesRep` or Copper assignee
3. **Update all queries** - Use `currentOwner` instead of `salesPerson`
4. **Keep legacy fields** - For backward compatibility during transition
5. **Update documentation** - Clear field usage guidelines

## Testing Checklist

- [ ] Filter by Ben → Shows only Ben's assigned customers
- [ ] Filter by Brandon → Shows only Brandon's assigned customers  
- [ ] Shopify customers → Don't appear in wrong rep's list
- [ ] Manual reassignment → Updates `fishbowlUsername` and filters correctly
- [ ] Copper sync → Updates `currentOwner` when assignee changes
- [ ] Commission calc → Still uses `salesPerson` from ORDERS (not affected)

## Key Principle

**CUSTOMERS = Current Owner | ORDERS = Originator**

- Customer filtering/assignment uses CURRENT owner
- Commission calculation uses ORIGINATOR from each order
- Never mix the two concepts
