# Copper CRM Custom Field Decoder Reference

**Date:** January 22, 2026  
**Status:** ✅ Implemented and Active

---

## 🎯 Problem Solved

**Issue:** Accounts table was displaying **Copper custom field IDs** (like `2063731`, `2063862`) instead of **human-readable names** (like "Pacific Northwest", "Wholesale").

**Root Cause:** Copper CRM stores dropdown selections as numeric IDs, not display names. The data service was storing these raw IDs without decoding them.

**Solution:** Created decoder functions in `customFields.ts` that map Copper IDs to display names throughout the application.

---

## 📊 Copper Custom Field Mappings

### **Region (cf_680701)**
Copper stores region as numeric ID, we decode to name:

| Copper ID | Display Name |
|-----------|--------------|
| 2024067 | Midwest |
| 2024070 | Mountain |
| 2017104 | Northeast |
| 2063731 | Pacific Northwest |
| 2024068 | South Central |
| 2017114 | Southeast |
| 2067847 | Southern California |
| 2066273 | AE Team |
| 2066272 | House |

**Decoder:** `decodeRegion(regionId)`

---

### **Account Type (cf_675914)** - Multi-Select
Copper stores account type as array of IDs, we decode to array of names:

| Copper ID | Display Name |
|-----------|--------------|
| 1981470 | Distributor |
| 2063862 | Wholesale |
| 2066840 | Retail |

**Decoder:** `decodeAccountType(typeIds)` → Returns `string[]`

---

### **Segment (cf_698149)**
| Copper ID | Display Name |
|-----------|--------------|
| 2063871 | Convenience |
| 2063875 | Smoke & Vape |
| 2063874 | Smoke |
| 2063869 | Vape |
| 2063867 | Liquor |
| 2063873 | Club |
| 2063866 | Grocery |
| 2063870 | Wellness |
| 2067805 | Cannabis |

**Decoder:** `decodeSegment(segmentId)`

---

### **Customer Priority (cf_698121)**
| Copper ID | Display Name |
|-----------|--------------|
| 2063748 | 1 |
| 2063749 | 2 |
| 2063750 | 3 |
| 2063751 | 4 |
| 2063752 | 5 |

**Decoder:** `decodeCustomerPriority(priorityId)`

---

### **Payment Terms (cf_698434)**
| Copper ID | Display Name |
|-----------|--------------|
| 2066218 | ACH |
| 2066261 | COD |
| 2066215 | Credit Card |
| 2066260 | Due on Receipt |
| 2066262 | Net 15 |
| 2066212 | Net 30 |
| 2066263 | Net 60 |

**Decoder:** `decodePaymentTerms(termsId)`

---

### **Shipping Terms (cf_698462)**
| Copper ID | Display Name |
|-----------|--------------|
| 2066264 | Prepaid |
| 2066265 | Prepaid & Billed |

**Decoder:** `decodeShippingTerms(termsId)`

---

### **Carrier (cf_698464)**
| Copper ID | Display Name |
|-----------|--------------|
| 2066266 | LTL Freight Carrier |
| 2066267 | UPS |
| 2066268 | Will Call |

**Decoder:** `decodeCarrier(carrierId)`

---

### **Business Model (cf_698356)**
| Copper ID | Display Name |
|-----------|--------------|
| 2107481 | Direct Store Delivery (DSD) |
| 2065273 | Retail Only |
| 2065272 | Wholesale Only |

**Decoder:** `decodeBusinessModel(modelId)`

---

### **Organization Level (cf_698362)**
| Copper ID | Display Name |
|-----------|--------------|
| 2065275 | Corp HQ |
| 2065276 | Chain HQ |
| 2065277 | Chain RA |
| 2065282 | Independent |

**Decoder:** `decodeOrganizationLevel(levelId)`

---

### **Lead Temperature (cf_698148)** - For Prospects
| Copper ID | Display Name |
|-----------|--------------|
| 2063859 | Cold |
| 2063860 | Warm |
| 2063861 | Hot |

**Decoder:** `decodeLeadTemperature(tempId)`

---

### **Account Opportunity (cf_698259)** - For Prospects
| Copper ID | Display Name |
|-----------|--------------|
| 2064434 | Premium |
| 2064435 | High-Value |
| 2064436 | Core |
| 2064437 | Standard |
| 2064438 | Basic |

**Decoder:** `decodeAccountOpportunity(oppId)`

---

### **Order Frequency (cf_698409)**
| Copper ID | Display Name |
|-----------|--------------|
| 2066207 | Weekly |
| 2066208 | Bi-Weekly |
| 2066209 | Monthly |
| 2066210 | Quarterly |
| 2066211 | Annually |

**Decoder:** `decodeOrderFrequency(freqId)`

---

## 🔧 Implementation Details

### Files Modified:

**1. `lib/crm/customFields.ts`**
- Added decoder functions for all Copper custom fields
- Generic `decodeCustomFieldId()` for single values
- Generic `decodeCustomFieldIds()` for multi-select values
- Exported decoder functions for each field type

**2. `lib/crm/dataService.ts`**
- Imported all decoder functions
- Updated `buildAccountFromCopper()` to decode all fields
- Updated `loadAccountFromCopper()` to decode all fields
- Updated `loadUnifiedProspects()` to decode lead fields
- Updated `parseAccountType()` to use decoder

---

## 📝 Usage Examples

### Before (Raw Copper IDs):
```typescript
// Firestore data
{
  cf_680701: 2063731,
  cf_675914: [2063862],
  cf_698149: 2063875
}

// Displayed in UI
Region: 2063731
Type: 2063862
Segment: 2063875
```

### After (Decoded Names):
```typescript
// Firestore data (same)
{
  cf_680701: 2063731,
  cf_675914: [2063862],
  cf_698149: 2063875
}

// Decoded by dataService
{
  region: "Pacific Northwest",
  accountType: ["Wholesale"],
  segment: "Smoke & Vape"
}

// Displayed in UI
Region: Pacific Northwest
Type: Wholesale
Segment: Smoke & Vape
```

---

## 🔄 Data Flow

```
Firestore (copper_companies)
  ↓
  Raw Copper IDs (2063731, 2063862, etc.)
  ↓
dataService.ts (buildAccountFromCopper)
  ↓
  Decoder Functions (decodeRegion, decodeAccountType, etc.)
  ↓
  Human-Readable Names ("Pacific Northwest", "Wholesale", etc.)
  ↓
React Query Hooks (useAccounts, useAccount)
  ↓
UI Components (Accounts Table, Detail Page, Edit Page)
  ↓
Display: "Pacific Northwest" instead of "2063731"
```

---

## ✅ Fields Now Decoded

### Accounts:
- ✅ Region (cf_680701)
- ✅ Account Type (cf_675914) - Multi-select
- ✅ Segment (cf_698149)
- ✅ Customer Priority (cf_698121)
- ✅ Payment Terms (cf_698434)
- ✅ Shipping Terms (cf_698462)
- ✅ Carrier (cf_698464)
- ✅ Business Model (cf_698356)
- ✅ Organization Level (cf_698362)

### Prospects/Leads:
- ✅ Region (cf_698278)
- ✅ Account Type (cf_698259)
- ✅ Segment (cf_698498)
- ✅ Lead Temperature (cf_698273)
- ✅ Account Opportunity (cf_698257)

---

## 🧪 Testing Checklist

### Accounts Page:
- [ ] Region column shows names (not IDs)
- [ ] Type column shows names (not IDs)
- [ ] Segment column shows names (not IDs)
- [ ] Payment Terms column shows names (not IDs)
- [ ] Priority column shows P1-P5 (not IDs)

### Account Detail Page:
- [ ] Right sidebar shows decoded Region
- [ ] Right sidebar shows decoded Segment
- [ ] Right sidebar shows decoded Account Type
- [ ] Right sidebar shows decoded Payment/Shipping Terms
- [ ] Right sidebar shows decoded Carrier

### Account Edit Page:
- [ ] Form pre-populates with decoded names
- [ ] Dropdowns show correct selected values
- [ ] Multi-select Account Type shows correct values

### Prospects Page:
- [ ] Region column shows names
- [ ] Lead Temperature shows Cold/Warm/Hot
- [ ] Account Opportunity shows Premium/High-Value/etc.

---

## 🚀 Deployment Status

**Status:** ✅ Ready to Test

All decoder functions are implemented and integrated throughout the CRM data service. The Accounts table and all CRM pages should now display human-readable names instead of Copper IDs.

**Next Steps:**
1. Test Accounts page - verify all columns show names
2. Test Account detail page - verify right sidebar shows names
3. Test Account edit page - verify form pre-populates correctly
4. Test Prospects page - verify lead fields show names
5. Verify search/filter functionality still works

---

## 📚 Reference Files

- **Copper Field Definitions:** `lib/crm/customFields.ts`
- **Data Service:** `lib/crm/dataService.ts`
- **Copper Fields Raw Data:** `docs/copper_fields_raw.json`
- **Data Schema:** `docs/data_schema.md`
- **CRM Status:** `docs/CRM_ACCOUNTS_CONTACTS_STATUS.md`

---

## 🔑 Key Takeaways

1. **Copper stores dropdown selections as numeric IDs**
2. **We must decode these IDs to display names in the UI**
3. **All decoding happens in the data service layer**
4. **React components receive human-readable names**
5. **Decoder functions handle null/undefined gracefully**
6. **Multi-select fields return arrays of names**
7. **Single-select fields return single name or null**

This ensures consistent, readable data throughout the CRM application.
