# Copper Sync & Field Mapping Analysis

## 🔍 Copper Sync Process

### **1. Company Sync** (`/api/sync-copper-api-fresh`)

**What it does:**
- Fetches ALL active companies from Copper API
- Stores in `copper_companies` collection
- Uses Copper company ID as Firestore document ID

**Custom Field Storage (Lines 211-228):**
```typescript
company.custom_fields.forEach(cf => {
  const fieldId = cf.custom_field_definition_id;
  
  // Stores ONLY with cf_ prefix
  customFieldsMap[`cf_${fieldId}`] = cf.value;
});
```

**Result:** Fields stored as `cf_680701`, `cf_675914`, etc.

**NO readable names stored** - only numeric IDs!

---

### **2. Contact Sync** (`/api/sync-copper-people`)

**What it does:**
- Fetches ALL people (contacts) from Copper API
- Stores in `copper_people` collection
- Links to companies via `companyId` field

**Company Linking (Line 167):**
```typescript
companyId: person.company_id || null,
companyName: person.company_name || '',
```

**Result:** Contact has `companyId: 70961229` linking to company

---

## 🔗 Contact Linking Flow

### **Your Example: #1 Tobacco**

**Account (copper_companies):**
- Document ID: `"70961229"` (string)
- `copperId: 70961229` (number)
- `primary_contact_id: 169974992` (from Copper raw data)

**Contact (copper_people):**
- Document ID: `"169974992"` (string)
- `companyId: 70961229` (number)
- `name: "KEVIN LASTNAME"`

**Mapping in dataService.ts (lines 709-711):**
```typescript
accountId: data.companyId?.toString(),      // "70961229"
copperId_company: data.companyId,           // 70961229
```

**Matching in useAccountContacts (lines 130-138):**
```typescript
// Match 1: c.accountId === "70961229" ✅
if (c.accountId === accountId) return true;

// Match 2: c.copperId_company === 70961229 ✅
if (account?.copperId && c.copperId_company === account.copperId) return true;
```

**This SHOULD work!** Both conditions should match.

---

## 🐛 Why Contacts Might Not Show

### **Possible Issues:**

1. **Contact not synced yet**
   - Run `/api/sync-copper-people` to sync contacts

2. **Contact query not loading all contacts**
   - Check `useContacts()` pagination
   - Default page size might be too small

3. **Contact data mapping issue**
   - `companyId` might be null or wrong type
   - Check Firestore console for contact 169974992

4. **Primary contact ID mismatch**
   - Account has `primary_contact_id` in raw data
   - But might not be mapped to `primaryContactId` field

---

## 📊 Custom Field Name Mapping

### **Current State:**

**Copper stores fields with names:**
- "Region" → ID: 680701
- "Segment" → ID: 680704  
- "Account Type" → ID: 675914
- "Payment Terms" → ID: 680706
- etc.

**Firestore stores only IDs:**
- `cf_680701` (no name)
- `cf_680704` (no name)
- `cf_675914` (no name)

### **Where Names ARE Stored:**

Some code uses **hybrid format** like:
- `"Region cf_680701"` (name + ID)
- `"Segment cf_680704"` (name + ID)

**Found in:**
- `app/admin/tools/copper-import/page.tsx` (line 12)
- `app/(modules)/accounts/[id]/edit/page.tsx` (line 160)

### **Impact of Renaming in Copper:**

If you rename a custom field in Copper:
- **Before:** "Region" (ID: 680701)
- **After:** "Sales Region" (ID: 680701)

**Next sync will:**
- Still store as `cf_680701` (ID unchanged)
- Field name in Copper changes, but Firestore key stays same
- **No breaking changes!** ✅

**Code using hybrid format will:**
- Still work if it checks `cf_680701`
- Display wrong name if it shows "Region cf_680701"
- Need to update hardcoded names in code

---

## ✅ Recommendations

### **1. Contact Linking Fix:**

Check if contact exists in Firestore:
```
1. Open Firestore console
2. Go to copper_people collection
3. Search for document ID: 169974992
4. Verify companyId: 70961229
```

If missing, run contact sync:
```
POST /api/sync-copper-people
```

### **2. Custom Field Naming:**

**Safe to rename in Copper** - won't break sync!

But you'll need to:
1. Update hardcoded field names in code
2. Create a mapping reference document
3. Update UI labels to match new names

### **3. Create Field Mapping Reference:**

Document all custom field IDs and their current names:
```
cf_675914 = Account Type
cf_680701 = Region
cf_680702 = Segment
cf_680704 = Segment (duplicate?)
cf_680706 = Payment Terms
cf_680707 = Shipping Terms
cf_680708 = Carrier
cf_680709 = Sales Person
cf_698396 = Customer Priority
cf_698403 = Total Orders
cf_698404 = Total Spent
cf_698467 = Account Order ID
cf_712751 = Active Customer
cf_713477 = Account ID
```

---

## 🔧 Next Steps

1. **Verify contact sync** - Check if contact 169974992 exists
2. **Test contact linking** - Visit account page, check Contacts section
3. **Document all custom fields** - Create complete mapping
4. **Plan field renaming** - If needed, update code references

---

**Status:** Contact linking logic is correct, likely just needs data sync.
