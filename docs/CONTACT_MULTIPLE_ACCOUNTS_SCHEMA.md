# Contact Multiple Accounts Support

## Current Schema (Single Account)

```typescript
export interface UnifiedContact {
  accountId?: string;           // Single account ID
  accountName?: string;         // Single account name
  copperId_company?: number;    // Single Copper company ID
}
```

## Proposed Schema (Multiple Accounts)

### Option 1: Array Fields (Backward Compatible)
```typescript
export interface UnifiedContact {
  // Legacy single account (keep for backward compatibility)
  accountId?: string;
  accountName?: string;
  copperId_company?: number;
  
  // New multiple accounts support
  accountIds?: string[];        // Array of account IDs
  accounts?: Array<{            // Array of account references
    id: string;
    name: string;
    copperId?: number;
    isPrimary?: boolean;
  }>;
}
```

### Option 2: Copper Native (Recommended)

Copper CRM already supports multiple companies per contact via the `company_id` field and related companies. The sync should capture this:

```typescript
export interface UnifiedContact {
  // Primary company
  companyId?: number;           // Primary Copper company ID
  companyName?: string;         // Primary company name
  accountId?: string;           // Primary account Firestore ID
  
  // Related companies (from Copper)
  relatedCompanies?: Array<{
    id: number;
    name: string;
    accountId?: string;         // Mapped Firestore ID
  }>;
}
```

## Implementation Plan

### 1. Update Copper People Sync
- Capture related companies from Copper API
- Map Copper company IDs to Firestore account IDs
- Store in `relatedCompanies` array

### 2. Update Contact Detail Page
- Load all related accounts
- Display multiple account tiles
- Mark primary account
- Make each tile clickable

### 3. Update Contact Edit Page
- Allow selecting primary account
- Allow adding/removing related accounts
- Dropdown to search and add accounts

### 4. Database Migration
- Add `relatedCompanies` field to existing contacts
- Migrate existing `accountId` to primary company
- No breaking changes to existing data

## Current Status

**Copper Data Structure:**
- Contact has `company_id` (primary company)
- Contact has `company_name` (primary company name)
- Copper API may provide related companies

**Our Current Mapping:**
- `companyId` → `accountId` (string)
- `companyId` → `copperId_company` (number)
- Single account only

**Next Steps:**
1. Check if Copper API provides related companies
2. Update sync to capture related companies
3. Update UI to display multiple accounts
4. Add account management to contact edit page
