# Array Schema Implementation for Multiple Contacts/Accounts

## ✅ Schema Updated - System Now Accepts Arrays

### **What Changed:**

Updated TypeScript interfaces in `lib/crm/dataService.ts` to support arrays for multiple associations while maintaining backward compatibility with Copper sync.

---

## **UnifiedAccount Interface**

### **Existing Fields (Copper Sync):**
```typescript
primaryContactId?: string;        // Single primary contact from Copper
primaryContactName?: string;
primaryContactEmail?: string;
primaryContactPhone?: string;
```

### **NEW Array Fields (Kanva Portal):**
```typescript
secondaryContactIds?: string[];   // Array of contact IDs
secondaryContacts?: Array<{       // Full contact details
  id: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  role?: string;                  // e.g., "Purchasing Manager"
}>;
```

**How it works:**
- Copper sync populates `primaryContactId` (single contact)
- Kanva Portal UI can add to `secondaryContacts` array
- Both coexist without conflict

---

## **UnifiedContact Interface**

### **Existing Fields (Copper Sync):**
```typescript
accountId?: string;               // Single account from Copper
accountName?: string;
copperId_company?: number;
```

### **NEW Array Fields (Kanva Portal):**
```typescript
accountIds?: string[];            // Array of account IDs
accounts?: Array<{                // Full account details
  id: string;
  name: string;
  copperId?: number;
  isPrimary: boolean;             // Mark which is primary
  role?: string;                  // Contact's role at this account
}>;
```

**How it works:**
- Copper sync populates `accountId` (single account)
- Kanva Portal UI can add to `accounts` array
- `isPrimary` flag identifies which account is primary

---

## **Firestore Compatibility**

### **Arrays in Firestore:**
✅ Firestore natively supports arrays
✅ Can store arrays of primitives (strings, numbers)
✅ Can store arrays of objects (nested data)
✅ No schema enforcement - fields are optional

### **Example Document Structure:**

**Contact Document (copper_people collection):**
```json
{
  "id": "169974992",
  "firstName": "KEVIN",
  "lastName": "LASTNAME",
  "accountId": "70961229",
  "accountName": "#1 Tobacco",
  "accountIds": ["70961229", "71520784"],
  "accounts": [
    {
      "id": "70961229",
      "name": "#1 Tobacco",
      "isPrimary": true,
      "role": "Owner"
    },
    {
      "id": "71520784",
      "name": "Vape City",
      "isPrimary": false,
      "role": "Purchasing Manager"
    }
  ]
}
```

**Account Document (copper_companies collection):**
```json
{
  "id": "70961229",
  "name": "#1 Tobacco",
  "primaryContactId": "169974992",
  "primaryContactName": "KEVIN LASTNAME",
  "secondaryContactIds": ["169974993", "169974994"],
  "secondaryContacts": [
    {
      "id": "169974993",
      "name": "JANE DOE",
      "email": "jane@example.com",
      "role": "Purchasing Manager"
    },
    {
      "id": "169974994",
      "name": "JOHN SMITH",
      "email": "john@example.com",
      "role": "Store Manager"
    }
  ]
}
```

---

## **Backward Compatibility**

### **Existing Data:**
- All existing contacts with `accountId` continue to work
- All existing accounts with `primaryContactId` continue to work
- No migration required for basic functionality

### **Copper Sync:**
- Continues to populate single fields (`accountId`, `primaryContactId`)
- Does NOT populate array fields (that's manual in Kanva Portal)
- No conflicts between sync and manual additions

### **UI Compatibility:**
- Existing UI reads `accountId` and `primaryContactId` (works as before)
- New UI can read arrays when available
- Graceful fallback if arrays are empty/undefined

---

## **How to Use Arrays Going Forward**

### **Adding Secondary Contacts to Account:**

**In Account Edit Page:**
```typescript
// User adds secondary contact
const updatedAccount = {
  ...account,
  secondaryContactIds: [...(account.secondaryContactIds || []), newContactId],
  secondaryContacts: [
    ...(account.secondaryContacts || []),
    {
      id: newContactId,
      name: "JANE DOE",
      email: "jane@example.com",
      role: "Purchasing Manager"
    }
  ]
};

// Save to Firestore
await updateDoc(doc(db, 'copper_companies', accountId), {
  secondaryContactIds: updatedAccount.secondaryContactIds,
  secondaryContacts: updatedAccount.secondaryContacts
});
```

### **Adding Multiple Accounts to Contact:**

**In Contact Edit Page:**
```typescript
// User adds second account
const updatedContact = {
  ...contact,
  accountIds: [...(contact.accountIds || [contact.accountId]), newAccountId],
  accounts: [
    ...(contact.accounts || []),
    {
      id: newAccountId,
      name: "Vape City",
      isPrimary: false,
      role: "Purchasing Manager"
    }
  ]
};

// Save to Firestore
await updateDoc(doc(db, 'copper_people', contactId), {
  accountIds: updatedContact.accountIds,
  accounts: updatedContact.accounts
});
```

---

## **Testing the Arrays**

### **Test 1: Add Secondary Contact to Account**
1. Open account edit page
2. Add secondary contact via UI
3. Save
4. Verify `secondaryContacts` array in Firestore
5. Verify contact displays on account detail page

### **Test 2: Add Multiple Accounts to Contact**
1. Open contact edit page
2. Add second account via UI
3. Mark one as primary
4. Save
5. Verify `accounts` array in Firestore
6. Verify multiple accounts display on contact detail page

### **Test 3: Copper Sync Compatibility**
1. Run Copper sync
2. Verify `accountId` and `primaryContactId` still populate
3. Verify arrays remain intact (not overwritten)
4. Verify no conflicts between single fields and arrays

---

## **Next Steps for Full Implementation**

### **Phase 1: UI Updates (Contact Pages)**
- Update contact detail page to display multiple accounts
- Update contact edit page to manage multiple accounts
- Add "Add Account" button and search functionality

### **Phase 2: UI Updates (Account Pages)**
- Update account detail page to display secondary contacts
- Update account edit page to manage secondary contacts
- Add "Add Contact" button and search functionality

### **Phase 3: Data Initialization**
- Create migration script to populate arrays from existing single fields
- For contacts: `accounts = [{ id: accountId, isPrimary: true }]`
- For accounts: Keep `secondaryContacts` empty (manual additions only)

### **Phase 4: Testing**
- Test adding/removing contacts from accounts
- Test adding/removing accounts from contacts
- Test Copper sync doesn't break arrays
- Test UI displays arrays correctly

---

## **Summary**

✅ **Schema Updated** - Arrays now supported in TypeScript interfaces
✅ **Firestore Compatible** - No schema changes needed, arrays work natively
✅ **Backward Compatible** - Existing single fields remain functional
✅ **Copper Sync Safe** - Sync continues to work with single fields
✅ **Ready for UI** - Can now implement UI to manage arrays

**Status:** Schema is ready. System will accept arrays when UI saves them.

**Next:** Implement UI components to add/remove items from arrays.
