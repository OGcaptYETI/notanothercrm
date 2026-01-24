// Custom Field Definitions matching Copper CRM structure
// Based on Copper_Metadata_10.10.md

export interface CustomFieldOption {
  id: number;
  name: string;
  rank: number;
}

export interface CustomFieldDefinition {
  id: number;
  name: string;
  key: string; // camelCase key for Firestore
  dataType: 'String' | 'Text' | 'Date' | 'Dropdown' | 'MultiSelect' | 'Float' | 'Currency' | 'Connect';
  availableOn: ('lead' | 'person' | 'company' | 'opportunity' | 'task')[];
  options?: CustomFieldOption[];
  currency?: string;
}

// Account Type Options
export const ACCOUNT_TYPE_OPTIONS: CustomFieldOption[] = [
  { id: 1981470, name: 'Distributor', rank: 0 },
  { id: 2063862, name: 'Wholesale', rank: 1 },
  { id: 2066840, name: 'Retail', rank: 2 },
];

// Region Options
export const REGION_OPTIONS: CustomFieldOption[] = [
  { id: 2024067, name: 'Midwest', rank: 0 },
  { id: 2024070, name: 'Mountain', rank: 1 },
  { id: 2017104, name: 'Northeast', rank: 2 },
  { id: 2063731, name: 'Pacific Northwest', rank: 3 },
  { id: 2024068, name: 'South Central', rank: 4 },
  { id: 2017114, name: 'Southeast', rank: 5 },
  { id: 2067847, name: 'Southern California', rank: 6 },
  { id: 2066273, name: 'AE Team', rank: 7 },
  { id: 2066272, name: 'House', rank: 8 },
];

// Customer Priority Options
export const CUSTOMER_PRIORITY_OPTIONS: CustomFieldOption[] = [
  { id: 2063748, name: '1', rank: 0 },
  { id: 2063749, name: '2', rank: 1 },
  { id: 2063750, name: '3', rank: 2 },
  { id: 2063751, name: '4', rank: 3 },
  { id: 2063752, name: '5', rank: 4 },
];

// Lead Temperature Options
export const LEAD_TEMPERATURE_OPTIONS: CustomFieldOption[] = [
  { id: 2063859, name: 'Cold', rank: 0 },
  { id: 2063860, name: 'Warm', rank: 1 },
  { id: 2063861, name: 'Hot', rank: 2 },
];

// Segment Options
export const SEGMENT_OPTIONS: CustomFieldOption[] = [
  { id: 2063871, name: 'Convenience', rank: 0 },
  { id: 2063875, name: 'Smoke & Vape', rank: 1 },
  { id: 2063874, name: 'Smoke', rank: 2 },
  { id: 2063869, name: 'Vape', rank: 3 },
  { id: 2063867, name: 'Liquor', rank: 4 },
  { id: 2063873, name: 'Club', rank: 5 },
  { id: 2063866, name: 'Grocery', rank: 6 },
  { id: 2063870, name: 'Wellness', rank: 7 },
  { id: 2067805, name: 'Cannabis', rank: 8 },
];

// Account Opportunity Options
export const ACCOUNT_OPPORTUNITY_OPTIONS: CustomFieldOption[] = [
  { id: 2064434, name: 'Premium', rank: 0 },
  { id: 2064435, name: 'High-Value', rank: 1 },
  { id: 2064436, name: 'Core', rank: 2 },
  { id: 2064437, name: 'Standard', rank: 3 },
  { id: 2064438, name: 'Basic', rank: 4 },
];

// Business Model Options
export const BUSINESS_MODEL_OPTIONS: CustomFieldOption[] = [
  { id: 2107481, name: 'Direct Store Delivery (DSD)', rank: 0 },
  { id: 2065273, name: 'Retail Only', rank: 1 },
  { id: 2065272, name: 'Wholesale Only', rank: 2 },
];

// Organization Level Options
export const ORGANIZATION_LEVEL_OPTIONS: CustomFieldOption[] = [
  { id: 2065275, name: 'Corp HQ', rank: 0 },
  { id: 2065276, name: 'Chain HQ', rank: 1 },
  { id: 2065277, name: 'Chain RA', rank: 2 },
  { id: 2065282, name: 'Independent', rank: 3 },
];

// Payment Terms Options
export const PAYMENT_TERMS_OPTIONS: CustomFieldOption[] = [
  { id: 2066218, name: 'ACH', rank: 0 },
  { id: 2066261, name: 'COD', rank: 1 },
  { id: 2066215, name: 'Credit Card', rank: 2 },
  { id: 2066260, name: 'Due on Receipt', rank: 3 },
  { id: 2066262, name: 'Net 15', rank: 4 },
  { id: 2066212, name: 'Net 30', rank: 5 },
  { id: 2066263, name: 'Net 60', rank: 6 },
];

// Order Frequency Options
export const ORDER_FREQUENCY_OPTIONS: CustomFieldOption[] = [
  { id: 2066207, name: 'Weekly', rank: 0 },
  { id: 2066208, name: 'Bi-Weekly', rank: 1 },
  { id: 2066209, name: 'Monthly', rank: 2 },
  { id: 2066210, name: 'Quarterly', rank: 3 },
  { id: 2066211, name: 'Annually', rank: 4 },
];

// Carrier Options
export const CARRIER_OPTIONS: CustomFieldOption[] = [
  { id: 2066266, name: 'LTL Freight Carrier', rank: 0 },
  { id: 2066267, name: 'UPS', rank: 1 },
  { id: 2066268, name: 'Will Call', rank: 2 },
];

// Shipping Terms Options
export const SHIPPING_TERMS_OPTIONS: CustomFieldOption[] = [
  { id: 2066264, name: 'Prepaid', rank: 0 },
  { id: 2066265, name: 'Prepaid & Billed', rank: 1 },
];

// Reseller Permit Options
export const RESELLER_PERMIT_OPTIONS: CustomFieldOption[] = [
  { id: 2066205, name: 'YES', rank: 0 },
  { id: 2066206, name: 'NO', rank: 1 },
];

// Product Categories of Interest
export const PRODUCT_CATEGORIES_OPTIONS: CustomFieldOption[] = [
  { id: 2066243, name: 'Focus+Flow Products', rank: 0 },
  { id: 2066244, name: 'Zoom Products', rank: 1 },
  { id: 2066245, name: 'Mango Extract Products', rank: 2 },
  { id: 2066246, name: 'Release+Relax Products', rank: 3 },
  { id: 2066247, name: 'Kratom Raw Materials', rank: 4 },
  { id: 2066248, name: 'Acrylics Displays', rank: 5 },
  { id: 2066249, name: 'Starter Kits', rank: 6 },
];

// Trade Show Options
export const TRADE_SHOW_OPTIONS: CustomFieldOption[] = [
  { id: 2070362, name: 'Champs Winter', rank: 0 },
  { id: 2070363, name: 'Champs Summer', rank: 1 },
  { id: 2070364, name: 'Champs Chicago', rank: 2 },
  { id: 2070365, name: 'Champs Atlantic City', rank: 3 },
  { id: 2070366, name: 'Champs Austin', rank: 4 },
  { id: 2070367, name: 'Champs FL', rank: 5 },
  { id: 2070368, name: 'TPE', rank: 6 },
  { id: 2089390, name: 'NACS', rank: 7 },
  { id: 2089391, name: 'Smoker Friendly Conference', rank: 8 },
];

// State abbreviations
export const STATE_OPTIONS: CustomFieldOption[] = [
  { id: 2063767, name: 'AL', rank: 0 },
  { id: 2063768, name: 'AK', rank: 1 },
  { id: 2063769, name: 'AZ', rank: 2 },
  { id: 2063770, name: 'AR', rank: 3 },
  { id: 2063771, name: 'CA', rank: 4 },
  { id: 2063772, name: 'CO', rank: 5 },
  { id: 2063773, name: 'CT', rank: 6 },
  { id: 2063774, name: 'DE', rank: 7 },
  { id: 2063775, name: 'DC', rank: 8 },
  { id: 2063776, name: 'FL', rank: 9 },
  { id: 2063777, name: 'GA', rank: 10 },
  { id: 2063778, name: 'HI', rank: 11 },
  { id: 2063779, name: 'ID', rank: 12 },
  { id: 2063780, name: 'IL', rank: 13 },
  { id: 2063781, name: 'IN', rank: 14 },
  { id: 2063782, name: 'IA', rank: 15 },
  { id: 2063783, name: 'KS', rank: 16 },
  { id: 2063784, name: 'KY', rank: 17 },
  { id: 2063785, name: 'LA', rank: 18 },
  { id: 2063786, name: 'ME', rank: 19 },
  { id: 2063787, name: 'MD', rank: 20 },
  { id: 2063788, name: 'MA', rank: 21 },
  { id: 2063789, name: 'MI', rank: 22 },
  { id: 2063790, name: 'MN', rank: 23 },
  { id: 2063791, name: 'MS', rank: 24 },
  { id: 2063792, name: 'MO', rank: 25 },
  { id: 2063793, name: 'MT', rank: 26 },
  { id: 2063794, name: 'NE', rank: 27 },
  { id: 2063795, name: 'NV', rank: 28 },
  { id: 2063796, name: 'NH', rank: 29 },
  { id: 2063797, name: 'NJ', rank: 30 },
  { id: 2063798, name: 'NM', rank: 31 },
  { id: 2063799, name: 'NY', rank: 32 },
  { id: 2063800, name: 'NC', rank: 33 },
  { id: 2063801, name: 'ND', rank: 34 },
  { id: 2063802, name: 'OH', rank: 35 },
  { id: 2063803, name: 'OK', rank: 36 },
  { id: 2063804, name: 'OR', rank: 37 },
  { id: 2063805, name: 'PA', rank: 38 },
  { id: 2063806, name: 'RI', rank: 39 },
  { id: 2063807, name: 'SC', rank: 40 },
  { id: 2063808, name: 'SD', rank: 41 },
  { id: 2063809, name: 'TN', rank: 42 },
  { id: 2063810, name: 'TX', rank: 43 },
  { id: 2063811, name: 'UT', rank: 44 },
  { id: 2063812, name: 'VT', rank: 45 },
  { id: 2063813, name: 'VA', rank: 46 },
  { id: 2063814, name: 'WA', rank: 47 },
  { id: 2063815, name: 'WV', rank: 48 },
  { id: 2063816, name: 'WI', rank: 49 },
  { id: 2063817, name: 'WY', rank: 50 },
];

// Time options for Start Time / End Time
export const TIME_OPTIONS: CustomFieldOption[] = [
  { id: 1, name: '5 AM', rank: 0 },
  { id: 2, name: '6 AM', rank: 1 },
  { id: 3, name: '7 AM', rank: 2 },
  { id: 4, name: '8 AM', rank: 3 },
  { id: 5, name: '9 AM', rank: 4 },
  { id: 6, name: '10 AM', rank: 5 },
  { id: 7, name: '11 AM', rank: 6 },
  { id: 8, name: '12 PM', rank: 7 },
  { id: 9, name: '1 PM', rank: 8 },
  { id: 10, name: '2 PM', rank: 9 },
  { id: 11, name: '3 PM', rank: 10 },
  { id: 12, name: '4 PM', rank: 11 },
  { id: 13, name: '5 PM', rank: 12 },
  { id: 14, name: '6 PM', rank: 13 },
];

// Favorite Products
export const FAVORITE_PRODUCT_OPTIONS: CustomFieldOption[] = [
  { id: 2071534, name: 'Focus+Flow', rank: 0 },
  { id: 2071535, name: 'Release+Relax', rank: 1 },
  { id: 2071536, name: 'Kanva Zoom', rank: 2 },
  { id: 2071537, name: 'Mango Extract', rank: 3 },
  { id: 2071538, name: 'Raw+Releaf', rank: 4 },
];

// ============== Decoder Functions ==============

/**
 * Generic function to decode a Copper custom field ID to its display name
 */
function decodeCustomFieldId(id: any, options: CustomFieldOption[]): string | null {
  if (!id) return null;
  
  // Handle numeric IDs
  const numericId = typeof id === 'number' ? id : parseInt(String(id), 10);
  if (isNaN(numericId)) return null;
  
  const option = options.find(opt => opt.id === numericId);
  return option ? option.name : null;
}

/**
 * Decode multiple IDs (for multi-select fields like Account Type)
 */
function decodeCustomFieldIds(ids: any, options: CustomFieldOption[]): string[] {
  if (!ids) return [];
  
  // Handle array of IDs
  if (Array.isArray(ids)) {
    return ids
      .map(id => decodeCustomFieldId(id, options))
      .filter((name): name is string => name !== null);
  }
  
  // Handle single ID
  const decoded = decodeCustomFieldId(ids, options);
  return decoded ? [decoded] : [];
}

/**
 * Decode Region ID to name
 */
export function decodeRegion(regionId: any): string | null {
  return decodeCustomFieldId(regionId, REGION_OPTIONS);
}

/**
 * Decode Account Type ID(s) to name(s)
 */
export function decodeAccountType(typeIds: any): string[] {
  return decodeCustomFieldIds(typeIds, ACCOUNT_TYPE_OPTIONS);
}

/**
 * Decode Segment ID to name
 */
export function decodeSegment(segmentId: any): string | null {
  return decodeCustomFieldId(segmentId, SEGMENT_OPTIONS);
}

/**
 * Decode Customer Priority ID to name
 */
export function decodeCustomerPriority(priorityId: any): string | null {
  return decodeCustomFieldId(priorityId, CUSTOMER_PRIORITY_OPTIONS);
}

/**
 * Decode Payment Terms ID to name
 */
export function decodePaymentTerms(termsId: any): string | null {
  return decodeCustomFieldId(termsId, PAYMENT_TERMS_OPTIONS);
}

/**
 * Decode Shipping Terms ID to name
 */
export function decodeShippingTerms(termsId: any): string | null {
  return decodeCustomFieldId(termsId, SHIPPING_TERMS_OPTIONS);
}

/**
 * Decode Carrier ID to name
 */
export function decodeCarrier(carrierId: any): string | null {
  return decodeCustomFieldId(carrierId, CARRIER_OPTIONS);
}

/**
 * Decode Business Model ID to name
 */
export function decodeBusinessModel(modelId: any): string | null {
  return decodeCustomFieldId(modelId, BUSINESS_MODEL_OPTIONS);
}

/**
 * Decode Organization Level ID to name
 */
export function decodeOrganizationLevel(levelId: any): string | null {
  return decodeCustomFieldId(levelId, ORGANIZATION_LEVEL_OPTIONS);
}

/**
 * Decode Lead Temperature ID to name
 */
export function decodeLeadTemperature(tempId: any): string | null {
  return decodeCustomFieldId(tempId, LEAD_TEMPERATURE_OPTIONS);
}

/**
 * Decode Account Opportunity ID to name
 */
export function decodeAccountOpportunity(oppId: any): string | null {
  return decodeCustomFieldId(oppId, ACCOUNT_OPPORTUNITY_OPTIONS);
}

/**
 * Decode Order Frequency ID to name
 */
export function decodeOrderFrequency(freqId: any): string | null {
  return decodeCustomFieldId(freqId, ORDER_FREQUENCY_OPTIONS);
}
