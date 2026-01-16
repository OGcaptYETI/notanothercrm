# Copper Import System Enhancements

## Overview
Enhanced the Copper CRM import system with real-time progress tracking, field name resolution, value decoding, and field protection system.

## ✅ Completed Features

### 1. Real-Time Progress Bar
**Location:** `app/api/sync-copper-api-fresh/route.ts` + `app/admin/tools/copper-import/page.tsx`

**Features:**
- Live progress tracking during API sync (fetching + processing phases)
- Visual progress bar with percentage display
- Status badges showing current operation
- Polls every 1 second for updates
- Shows: "Fetching page X", "Processing: X / Y companies"

**UI Components:**
- Orange gradient progress bar
- Real-time percentage display
- Status badges (Fetching from API, Processing Companies)
- Message updates showing current operation

### 2. Custom Field Name Resolution
**Location:** `app/api/copper-fields-metadata/route.ts`

**Features:**
- Fetches custom field definitions from Copper API
- Maps field IDs (cf_675914) to real names ("Account Type")
- Shows both display name and technical ID in UI
- Includes field data types (Dropdown, MultiSelect, Text, etc.)
- Displays field options for dropdown/multiselect fields

**Example:**
```
Before: cf_675914
After:  Account Type
        cf_675914
        Type: MultiSelect
```

### 3. Custom Field Value Decoding
**Location:** `app/api/copper-fields-metadata/route.ts` (lines 111-132)

**Features:**
- Decodes dropdown values: `2063862` → `"Wholesale (2063862)"`
- Decodes multiselect arrays: `[2063862, 1981470]` → `["Wholesale (2063862)", "Distributor (1981470)"]`
- Shows human-readable names with IDs in parentheses
- Works for all custom fields with options

**Sample Values Display:**
```
Before: [2063862][1981470][1981470]
After:  ["Wholesale (2063862)", "Distributor (1981470)", "Distributor (1981470)"]
```

### 4. Field Protection System
**Location:** `app/api/copper-field-protection/route.ts`

**Protected Fields:**
1. **cf_675914** - Account Type (CRITICAL)
   - Used in: Commission Calculations, Customer Filtering, Order Processing
   
2. **cf_698467** - Account Order ID (CRITICAL)
   - Used in: Fishbowl Integration, Order Matching
   
3. **cf_680701** - Region (CRITICAL)
   - Used in: Sales Rep Assignment, Territory Management
   
4. **cf_708027** - Sales Rep (CRITICAL)
   - Used in: Commission Calculations, Sales Rep Dashboard
   
5. **cf_712751** - Active Customer
   - Used in: Customer Filtering, Data Sync
   
6. **cf_713477** - Account ID
   - Used in: Customer Identification

**Validation Features:**
- GET endpoint: Returns list of protected fields with usage info
- POST endpoint: Validates field mappings before saving
- Checks for:
  - Missing critical field mappings
  - Changed field names (breaks code expectations)
  - Disabled critical fields
- Returns errors/warnings with severity levels
- Prevents saving if critical conflicts detected

### 5. Enhanced Field Mapping UI
**Location:** `app/admin/tools/copper-import/page.tsx`

**Features:**
- Editable database field names (inline text inputs)
- Add new field mappings from dropdown selector
- Delete unwanted mappings (✕ button)
- Enable/disable toggles for each mapping
- Organized dropdown with Standard vs Custom field groups
- Auto-suggests snake_case field names
- Shows both display name and technical ID in dropdown

**Workflow:**
1. Pull API → 2. Review Fields → 3. Map Fields → 4. Verify → 5. Update → 6. Done

## 🔧 Technical Implementation

### Progress Tracking
```typescript
// Global state in API route
let syncProgress = {
  inProgress: boolean,
  currentPage: number,
  totalFetched: number,
  totalProcessed: number,
  totalToProcess: number,
  status: 'idle' | 'fetching' | 'processing' | 'complete' | 'error',
  message: string,
};

// Frontend polls via GET request
const pollSyncProgress = async () => {
  const response = await fetch('/api/sync-copper-api-fresh');
  const progressData = await response.json();
  setSyncProgress(progressData);
  if (progressData.inProgress) {
    setTimeout(pollSyncProgress, 1000);
  }
};
```

### Field Value Decoding
```typescript
if (fieldDef?.options && Array.isArray(value)) {
  // MultiSelect: decode array of IDs to names
  decodedValue = value.map(id => {
    const option = fieldDef.options?.find(opt => opt.id === id);
    return option ? `${option.name} (${id})` : String(id);
  });
} else if (fieldDef?.options && typeof value === 'number') {
  // Dropdown: decode single ID to name
  const option = fieldDef.options.find(opt => opt.id === value);
  decodedValue = option ? `${option.name} (${value})` : value;
}
```

### Field Protection Validation
```typescript
// Before saving mappings
const validationResponse = await fetch('/api/copper-field-protection', {
  method: 'POST',
  body: JSON.stringify({ mappings: fieldMappings }),
});

const validation = await validationResponse.json();
if (!validation.canProceed) {
  setError(validation.message);
  return; // Prevent saving
}
```

## 📊 API Endpoints

### `/api/sync-copper-api-fresh`
- **POST**: Start sync operation
- **GET**: Get current sync progress

### `/api/copper-fields-metadata`
- **GET**: Analyze all Copper fields, fetch definitions, decode values

### `/api/copper-field-mappings`
- **GET**: Retrieve current field mappings
- **POST**: Save field mappings

### `/api/copper-field-protection`
- **GET**: Get protected fields list with usage info
- **POST**: Validate mappings against protected fields

## 🎯 User Benefits

1. **Visibility**: See exactly what's happening during long sync operations
2. **Understanding**: Know what each custom field actually means
3. **Safety**: Prevented from breaking critical application features
4. **Flexibility**: Can add new field mappings as needed
5. **Clarity**: Sample values show real data with human-readable names

## 🚀 Next Steps (Recommended)

1. **Add Protected Field UI Section** - Show protected fields table in mapping step
2. **Validation Warnings Display** - Show conflicts/warnings before save
3. **Field Usage Tracking** - Track which code files use each field
4. **Mapping Templates** - Save/load mapping configurations
5. **Preview Transformation** - Test mappings with sample data
6. **Conflict Detection** - Warn about duplicate mappings
7. **Transformation Functions** - Add data transformation options

## 📝 Notes

- Progress bar updates every second during sync
- Field definitions cached for performance
- Protected fields list is hardcoded but can be moved to Firestore
- Validation happens before saving to prevent breaking changes
- All custom field values now show human-readable names + IDs
