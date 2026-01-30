# Fishbowl Import Field Mapping - Implementation Plan

## Problem Statement

**Current Issue:** 
- Users export CSVs from Fishbowl/Conversite with varying column names
- Our import code has hardcoded field mappings that break when columns change
- Example: v1 has "Total Price", v2 has "Revenue" and "Order value"
- This causes import failures or incorrect data imports

**User's Goal:**
> "That where we come in and look at the columns, associate them to OUR FIELDS in the system then do a cleanse and import!!!!! So that requires data matching and user input for the headers to what our code wants."

## Solution: Multi-Step Import Workflow (Like Copper Import)

### Workflow Steps (Modeled after Copper Import)

```
Step 1: Upload CSV & Parse Headers
  ↓
Step 2: Analyze Fields & Show Preview
  ↓  
Step 3: Map CSV Columns to System Fields (USER INTERACTION)
  ↓
Step 4: Preview Import with Mappings Applied
  ↓
Step 5: Confirm & Execute Import
  ↓
Step 6: Validation Results
```

---

## Current State Analysis

### Existing Fishbowl Import Files
1. **`/app/admin/tools/fishbowl-import/page.tsx`** - Main UI (simple file upload)
2. **`/app/api/fishbowl/preview-import/route.ts`** - Preview logic (hardcoded fields)
3. **`/app/api/fishbowl/import-unified/route.ts`** - Import logic (hardcoded fields)
4. **`/app/settings/components/ImportPreviewModal.tsx`** - Preview modal

### Existing Copper Import Files (Reference)
1. **`/app/admin/tools/copper-import/page.tsx`** - Step-by-step wizard UI
2. **`/api/copper-fields-metadata`** - Field analysis endpoint
3. **`/api/copper-field-mappings`** - Mapping storage endpoint

---

## CSV Field Comparison

### v1 CSV (1.29.2026.csv)
```
Issued Date, Account id, Billing Name, Customer, Sales Rep, 
SO ID, SO Item ID, SO Item Product Number, Product description,
Unit price, Total Price, Total cost, Qty fulfilled, etc.
```

### v2 CSV (1.29.2026_v2.csv)
```
Customer id, Sales order Number, Posting Date, Customer, Billing Name,
Sales Order ID, Product ID, Product, Product desc, Sales person,
Unit price, Revenue, Order value, Invoiced cost, Invoiced margin, etc.
```

**Key Differences:**
- Account ID: "Account id" → "Customer id"
- Order Number: "Sales order Number" (same in both)
- Date: "Issued Date" → "Posting Date"
- Revenue: "Total Price" → "Revenue" OR "Order value"
- Sales Rep: "Sales Rep" → "Sales person"

---

## System Fields (What We Need)

### Order Fields
| System Field | Required | Type | Description |
|--------------|----------|------|-------------|
| `soNumber` | Yes | string | Sales Order Number |
| `salesOrderId` | Yes | string | Sales Order ID |
| `customerId` | Yes | string | Customer/Account ID |
| `customerName` | Yes | string | Customer Name |
| `salesPerson` | Yes | string | Sales Rep Name |
| `postingDate` | Yes | Date | Order Date |
| `accountType` | No | string | From customer record |

### Line Item Fields
| System Field | Required | Type | Description |
|--------------|----------|------|-------------|
| `soItemId` | Yes | string | Line Item ID |
| `productNum` | Yes | string | Product/SKU number |
| `productName` | No | string | Product description |
| `quantity` | Yes | number | Qty fulfilled |
| `unitPrice` | Yes | number | Unit price |
| `totalPrice` | Yes | number | Total revenue |
| `totalCost` | No | number | Total cost |

---

## Implementation Plan

### Phase 1: Backend - Field Mapping Infrastructure

#### 1.1 Create Field Metadata Endpoint
**File:** `/app/api/fishbowl/analyze-csv/route.ts`

**Purpose:** Parse CSV headers and analyze field characteristics

**Input:** FormData with CSV file
**Output:**
```typescript
{
  totalRows: number;
  totalOrders: number;
  headers: string[];
  fieldAnalysis: {
    fieldName: string;
    sampleValues: any[];
    detectedType: 'string' | 'number' | 'date';
    frequency: string; // e.g., "100%" or "85%"
    uniqueValues: number;
  }[];
  suggestedMappings: {
    csvField: string;
    systemField: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  }[];
}
```

**Auto-Detection Logic:**
- Detect dates: Check for MM/DD/YYYY, MM-DD-YYYY patterns
- Detect IDs: Look for "id", "number", numeric-only values
- Detect currency: Look for $, decimals
- Suggest mappings based on field name similarity

#### 1.2 Create Field Mapping Storage
**File:** `/app/api/fishbowl/field-mappings/route.ts`

**Purpose:** Store user's mapping preferences for reuse

**Storage:** Firestore collection `fishbowl_field_mappings`
```typescript
{
  id: string; // auto-generated
  mappingName: string; // e.g., "Conversite Standard Export"
  createdAt: Timestamp;
  updatedAt: Timestamp;
  mappings: [
    {
      csvField: string;
      systemField: string;
      transform?: 'trim' | 'uppercase' | 'sanitize_id' | 'parse_date';
      enabled: boolean;
    }
  ]
}
```

**Endpoints:**
- GET `/api/fishbowl/field-mappings` - List saved mappings
- GET `/api/fishbowl/field-mappings/[id]` - Get specific mapping
- POST `/api/fishbowl/field-mappings` - Save new mapping
- PUT `/api/fishbowl/field-mappings/[id]` - Update mapping
- DELETE `/api/fishbowl/field-mappings/[id]` - Delete mapping

#### 1.3 Update Preview Import
**File:** `/app/api/fishbowl/preview-import/route.ts`

**Changes:**
- Accept `fieldMappings` parameter in request body
- Use mappings to extract fields instead of hardcoded names
- Return validation warnings for unmapped required fields

**New Request Format:**
```typescript
POST /api/fishbowl/preview-import
FormData:
  - file: CSV file
  - mappings: JSON string of field mappings
```

#### 1.4 Update Import Unified
**File:** `/app/api/fishbowl/import-unified/route.ts`

**Changes:**
- Accept `fieldMappings` parameter
- Use dynamic field extraction based on mappings
- Add validation for required fields before import starts

---

### Phase 2: Frontend - Field Mapping UI

#### 2.1 Create Field Mapping Modal Component
**File:** `/app/admin/tools/fishbowl-import/components/FieldMappingModal.tsx`

**Features:**
- Display CSV headers in left column
- Display system fields in right column (dropdowns)
- Show sample values from CSV for each field
- Highlight required fields
- Show confidence badges for auto-detected mappings
- Allow saving mapping as template
- Load existing mapping templates

**UI Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Field Mapping Configuration                        │
├─────────────────────────────────────────────────────┤
│  Template: [Load Saved Mapping ▼] [Save As...]     │
├─────────────────────────────────────────────────────┤
│  CSV Field          Sample Values    →  System Field│
│  ─────────────────────────────────────────────────  │
│  Customer id        1422, 1359, 293  →  customerId ✓│
│  Sales order Number 10076, 10106     →  soNumber  ✓│
│  Posting Date       01-05-2026       →  postingDate✓│
│  Revenue            $240.00, $720    →  totalPrice ✓│
│  Sales person       DerekW, Jared    →  salesPerson✓│
│  ...                                                 │
├─────────────────────────────────────────────────────┤
│  Required Fields: 7/7 Mapped ✓                      │
│  Optional Fields: 5/12 Mapped                       │
│                                                      │
│  [Cancel]                        [Continue Preview] │
└─────────────────────────────────────────────────────┘
```

#### 2.2 Update Fishbowl Import Page
**File:** `/app/admin/tools/fishbowl-import/page.tsx`

**New State:**
```typescript
const [step, setStep] = useState<'upload' | 'analyze' | 'mapping' | 'preview' | 'importing' | 'validation'>('upload');
const [csvMetadata, setCsvMetadata] = useState<any>(null);
const [fieldMappings, setFieldMappings] = useState<any[]>([]);
const [savedMappings, setSavedMappings] = useState<any[]>([]);
```

**New Flow:**
1. Upload CSV → Parse & Analyze
2. Show field mapping modal
3. User maps fields (or loads template)
4. Preview import with mapped data
5. Confirm & import
6. Show validation results

#### 2.3 Create Field Mapping Template Selector
**File:** `/app/admin/tools/fishbowl-import/components/MappingTemplateSelector.tsx`

**Features:**
- Dropdown of saved mappings
- Preview of what fields each template maps
- "Create New" option
- Edit/Delete options for existing templates

---

### Phase 3: Smart Mapping Logic

#### 3.1 Field Name Similarity Matching

**Algorithm:**
```typescript
function suggestMapping(csvField: string, systemFields: string[]): {
  field: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const csvLower = csvField.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Exact aliases
  const aliases = {
    'customerid': 'customerId',
    'accountid': 'customerId',
    'salesordernumber': 'soNumber',
    'sonumber': 'soNumber',
    'salesorderid': 'salesOrderId',
    'soid': 'salesOrderId',
    'salesrep': 'salesPerson',
    'salesperson': 'salesPerson',
    'postingdate': 'postingDate',
    'issueddate': 'postingDate',
    'totalprice': 'totalPrice',
    'revenue': 'totalPrice',
    'ordervalue': 'totalPrice',
    // ... more aliases
  };
  
  if (aliases[csvLower]) {
    return { field: aliases[csvLower], confidence: 'high' };
  }
  
  // Fuzzy matching (Levenshtein distance, etc.)
  // ...
}
```

#### 3.2 Data Type Validation

**Validate mapped fields:**
- Date fields: Check if values parse as dates
- Numeric fields: Check if values are numbers
- ID fields: Check if not empty, reasonable length

---

### Phase 4: Migration & Testing

#### 4.1 Default Mapping Template

Create a default "Conversite Standard Export" mapping that matches current hardcoded logic:

```json
{
  "mappingName": "Conversite Standard Export (Legacy)",
  "mappings": [
    { "csvField": "Account id", "systemField": "customerId" },
    { "csvField": "Sales order Number", "systemField": "soNumber" },
    { "csvField": "SO ID", "systemField": "salesOrderId" },
    { "csvField": "Customer", "systemField": "customerName" },
    { "csvField": "Sales Rep", "systemField": "salesPerson" },
    { "csvField": "Issued Date", "systemField": "postingDate" },
    { "csvField": "SO Item ID", "systemField": "soItemId" },
    { "csvField": "SO Item Product Number", "systemField": "productNum" },
    { "csvField": "Product description", "systemField": "productName" },
    { "csvField": "Qty fulfilled", "systemField": "quantity" },
    { "csvField": "Unit price", "systemField": "unitPrice" },
    { "csvField": "Total Price", "systemField": "totalPrice" },
    { "csvField": "Total cost", "systemField": "totalCost" }
  ]
}
```

#### 4.2 Test Cases

**Test with v1 CSV:**
1. Auto-detect should suggest legacy mapping
2. All fields should map correctly
3. Import should succeed with same results as before

**Test with v2 CSV:**
1. Auto-detect should suggest new mappings
2. User should be able to map "Revenue" → "totalPrice"
3. Import should succeed with correct revenue values

**Test with Custom CSV:**
1. User uploads CSV with completely different headers
2. Manual mapping required
3. Save as template for reuse
4. Re-upload with same format → auto-loads template

---

## Development Sequence

### Week 1: Backend Foundation
- [ ] Create `/api/fishbowl/analyze-csv` endpoint
- [ ] Create field mapping storage schema
- [ ] Create `/api/fishbowl/field-mappings` CRUD endpoints
- [ ] Update preview-import to accept mappings
- [ ] Update import-unified to accept mappings

### Week 2: Frontend Components  
- [ ] Create `FieldMappingModal` component
- [ ] Create `MappingTemplateSelector` component
- [ ] Update fishbowl-import page with new workflow
- [ ] Add progress indicators for each step

### Week 3: Smart Mapping & Polish
- [ ] Implement auto-detection algorithm
- [ ] Add field validation logic
- [ ] Create default mapping templates
- [ ] Add mapping template management UI

### Week 4: Testing & Documentation
- [ ] Test with v1, v2, and custom CSVs
- [ ] Create user documentation
- [ ] Add error handling and validation messages
- [ ] Performance optimization

---

## Questions to Address

1. **Should we maintain backward compatibility?**
   - Option A: Keep old hardcoded import as fallback
   - Option B: Force all imports through new mapping workflow
   - **Recommendation:** Option B - cleaner, forces users to validate mappings

2. **Where to store mapping templates?**
   - Option A: Firestore (shared across users)
   - Option B: LocalStorage (per-user)
   - Option C: Both (Firestore + LocalStorage cache)
   - **Recommendation:** Option C - best of both worlds

3. **How to handle field transforms?**
   - Example: "Account id" has commas → need sanitization
   - Solution: Add transform options in mapping config
   - Common transforms: trim, sanitize_id, parse_date, parse_currency

4. **Should we support multi-file imports?**
   - Current: Single CSV with orders + line items
   - Future: Separate orders.csv and items.csv
   - **Recommendation:** Start with single file, add multi-file later

---

## Success Criteria

✅ User can upload ANY Fishbowl CSV export
✅ System analyzes headers and suggests mappings
✅ User can review and adjust mappings
✅ Mappings can be saved as reusable templates
✅ Preview shows data with mappings applied
✅ Import uses dynamic field extraction
✅ Validation totals match source data exactly
✅ No hardcoded field names in import logic

---

## Revenue Calculation Fix (Immediate Priority)

**Bug Found:** Validation was excluding unmatched/inactive reps from `repBreakdown`

**Fixed:** Lines 244-329 in `validate-commission-data/route.ts`
- Removed early `continue` statements
- Now ALL orders are added to `repBreakdown` 
- Unmatched reps shown with 'inactive' status
- Total revenue now matches sum of rep revenues

**Expected Result:**
- Excel: $3,656,601.41
- Validation: $3,656,601.41 ✓
- Individual reps match Excel pivot exactly

---

## Next Steps (User Decision Required)

1. **Immediate:** Test validation fix with current import
2. **Short-term:** Build field mapping workflow (this plan)
3. **Medium-term:** Data cleansing and customer ID standardization
4. **Long-term:** Multi-source import support (Fishbowl, Shopify, etc.)

---

## Notes & Considerations

- **User Experience:** Must be as simple as Copper import (step-by-step wizard)
- **Performance:** CSV parsing should be fast (< 5 seconds for 1000 rows)
- **Error Handling:** Clear messages for missing required fields
- **Validation:** Preview should catch data issues before import
- **Flexibility:** Support any CSV structure, not just Fishbowl
