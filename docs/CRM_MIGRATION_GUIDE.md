# CRM Migration Guide: Enterprise-Grade Architecture

## 🎯 Overview

This guide documents the **enterprise-grade CRM architecture** for migrating Copper people, tasks, opportunities, and leads from Firebase to Supabase. The architecture is built to be **100% reusable** across all entity types.

---

## 📊 What Was Built

### **1. Database Schema (Supabase SQL)**

All schemas use exact snake_case column names matching your Firebase data:

- ✅ **`people`** - 75,716 contacts from Copper
- ✅ **`tasks`** - 1,328 tasks 
- ✅ **`opportunities`** - 357 opportunities
- ✅ **`leads`** - 4,328 leads

**Files:**
- `lib/supabase/schema-people.sql`
- `lib/supabase/schema-tasks.sql`
- `lib/supabase/schema-opportunities.sql`
- `lib/supabase/schema-leads.sql`
- `lib/supabase/schema-crm-complete.sql` ← **Run this one**

### **2. TypeScript Types**

Strong typing for all entities:

**File:** `lib/crm/types-crm.ts`

```typescript
import type { Person, Task, Opportunity, Lead } from '@/lib/crm/types-crm';
```

### **3. Generic Data Service Layer**

One service handles all CRUD operations for all entities:

**File:** `lib/crm/supabaseCRMService.ts`

```typescript
import { 
  getPeople, 
  getTasks, 
  getOpportunities, 
  getLeads,
  getPeopleCounts,
  getTaskCounts,
  // ... etc
} from '@/lib/crm/supabaseCRMService';
```

### **4. React Hooks**

Reusable hooks with React Query:

**File:** `lib/crm/hooks-crm.ts`

```typescript
import { 
  usePeople, 
  usePeopleCounts,
  useTasks,
  useTaskCounts,
  useOpportunities,
  useLeads 
} from '@/lib/crm/hooks-crm';
```

### **5. Filter Definitions**

Pre-configured filter fields for each entity:

**File:** `lib/crm/filterFields-people.ts`

---

## 🚀 Migration Steps

### **Step 1: Run SQL Migration**

1. Open Supabase SQL Editor
2. Run the complete schema:

```sql
-- Copy contents from: lib/supabase/schema-crm-complete.sql
```

This creates all 4 tables with indexes and full-text search.

### **Step 2: Verify Tables**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('people', 'tasks', 'opportunities', 'leads');
```

You should see all 4 tables.

### **Step 3: Get Schema for Each Table**

Run this query **4 times** (once per table):

```sql
-- For people
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'people'
ORDER BY ordinal_position;

-- Repeat for: tasks, opportunities, leads
```

This ensures filter fields match exactly.

---

## 🏗️ Architecture Pattern

### **The Reusable Pattern:**

```
1. SQL Schema (snake_case columns)
   ↓
2. TypeScript Type (exact match)
   ↓
3. Filter Fields Definition (exact column names)
   ↓
4. Generic Data Service (one service, all entities)
   ↓
5. React Hooks (useEntity pattern)
   ↓
6. Page Component (accounts pattern)
```

### **Example: Building Contacts Page**

**File:** `app/(modules)/contacts/page.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import { usePeople, usePeopleCounts } from '@/lib/crm/hooks-crm';
import { DataTable } from '@/components/crm/DataTable';
import { FilterSidebar } from '@/components/crm/FilterSidebar';
import { PEOPLE_FILTER_FIELDS } from '@/lib/crm/filterFields-people';
import type { Person } from '@/lib/crm/types-crm';
import type { FilterCondition } from '@/lib/crm/types';

export default function ContactsPage() {
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [activeFilterConditions, setActiveFilterConditions] = useState<FilterCondition[]>([]);
  const [sortBy, setSortBy] = useState({ field: 'name', direction: 'asc' as const });

  // Fetch people with infinite scroll
  const { data, fetchNextPage, hasNextPage, isLoading } = usePeople({
    filterConditions: activeFilterConditions,
    sortBy: sortBy.field,
    sortDirection: sortBy.direction,
  });

  // Get counts
  const { data: counts } = usePeopleCounts(activeFilterConditions);

  // Flatten pages
  const people = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  // Column definitions (same pattern as accounts)
  const columns = [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>
    },
    {
      id: 'email',
      header: 'Email',
      accessorKey: 'email',
    },
    {
      id: 'company_name',
      header: 'Company',
      accessorKey: 'company_name',
    },
    {
      id: 'title',
      header: 'Title',
      accessorKey: 'title',
    },
    // ... add more columns
  ];

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Header with counts */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold">Contacts</h1>
          <div className="flex gap-4 mt-4">
            <div className="stat">
              <span>Total: {counts?.total || 0}</span>
            </div>
            <div className="stat">
              <span>With Accounts: {counts?.with_accounts || 0}</span>
            </div>
          </div>
        </div>

        {/* DataTable - fully reusable */}
        <DataTable
          data={people}
          columns={columns}
          tableId="contacts-table"
          onRowClick={(person) => console.log('View person:', person.id)}
        />
      </div>

      {/* FilterSidebar - fully reusable */}
      <FilterSidebar
        isOpen={filterSidebarOpen}
        onClose={() => setFilterSidebarOpen(false)}
        onSave={(filter) => {
          setActiveFilterConditions(filter.conditions);
          setFilterSidebarOpen(false);
        }}
        filterFields={PEOPLE_FILTER_FIELDS}
      />
    </div>
  );
}
```

---

## 📋 Implementation Checklist

### **Phase 1: Data Migration** ⬅️ **YOU ARE HERE**

- [x] Create SQL schemas
- [x] Create TypeScript types  
- [x] Build data service layer
- [x] Build React hooks
- [ ] **RUN SQL MIGRATION IN SUPABASE**
- [ ] **MIGRATE DATA** from Firebase → Supabase

### **Phase 2: Build Pages**

- [ ] Contacts page (people)
- [ ] Tasks page
- [ ] Opportunities page  
- [ ] Leads page

### **Phase 3: Testing**

- [ ] Test filters on each page
- [ ] Test sorting
- [ ] Test infinite scroll
- [ ] Test column reordering
- [ ] Test saved filters

---

## 🔄 Data Migration Script

You'll need a script to copy Firebase → Supabase:

```typescript
// scripts/migrate-crm-data.ts

import { getPeople as getFirebasePeople } from '@/lib/firebase/...';
import { createEntity } from '@/lib/crm/supabaseCRMService';

async function migratePeople() {
  const firebasePeople = await getFirebasePeople();
  
  for (const person of firebasePeople) {
    await createEntity('people', {
      id: person.id,
      company_id: 'YOUR_COMPANY_ID',
      source: 'copper',
      name: person.name,
      first_name: person.firstName,
      last_name: person.lastName,
      email: person.email,
      // ... map all fields
    });
  }
}
```

---

## 🎨 Exact Accounts Pattern

Every new entity page follows this structure:

1. **Same imports**
2. **Same state management** (filters, sort, search)
3. **Same hooks** (useEntity, useEntityCounts)
4. **Same components** (DataTable, FilterSidebar)
5. **Different columns** (entity-specific)
6. **Different filter fields** (entity-specific)

**It's truly enterprise-grade: Build once, reuse forever.**

---

## 🚨 Next Steps

1. **Run the SQL migration** in Supabase SQL Editor
2. **Verify tables** were created
3. **Get actual schemas** for each table (run the query)
4. **Send me the schemas** so I can:
   - Complete filter fields for tasks, opportunities, leads
   - Verify field names match exactly
5. **Migrate the data** from Firebase
6. **Build the first page** (Contacts) together
7. **Replicate** for tasks, opportunities, leads

---

## ✅ What Makes This Enterprise-Grade?

- ✅ **Exact schema matching** - no guessing
- ✅ **Type-safe** - TypeScript throughout
- ✅ **Generic & reusable** - one pattern for all entities
- ✅ **Scalable** - add new entities easily
- ✅ **Maintainable** - change once, update everywhere
- ✅ **Performant** - Supabase indexes, React Query caching
- ✅ **Filter-ready** - pre-built filter system
- ✅ **Sort-ready** - pre-built sorting
- ✅ **Search-ready** - full-text search built-in

**You can copy-paste the accounts page and change 5 lines to create any other CRM page.**
