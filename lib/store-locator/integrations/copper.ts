const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;
const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';

export interface CopperCompany {
  id: number;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  custom_fields?: Array<{
    custom_field_definition_id: number;
    value: any;
  }>;
  [key: string]: any;
}

export interface CopperCustomFieldDefinition {
  id: number;
  name: string;
  data_type: string;
  available_on: string[];
}

/**
 * Make a Copper API request
 */
async function copperRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${COPPER_API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'X-PW-AccessToken': COPPER_API_KEY,
    'X-PW-Application': 'developer_api',
    'X-PW-UserEmail': COPPER_USER_EMAIL,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Copper API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get all custom field definitions
 */
export async function getCustomFieldDefinitions(): Promise<CopperCustomFieldDefinition[]> {
  try {
    const response = await copperRequest('/custom_field_definitions', 'GET');
    return response || [];
  } catch (error) {
    console.error('Error fetching custom field definitions:', error);
    throw error;
  }
}

/**
 * Get the "On Store Locator" custom field ID
 */
export async function getStoreLocatorFieldId(): Promise<number | null> {
  try {
    const definitions = await getCustomFieldDefinitions();
    const field = definitions.find(
      (def) => def.name === 'On Store Locator' && def.available_on.includes('company')
    );
    return field?.id || null;
  } catch (error) {
    console.error('Error finding Store Locator field:', error);
    return null;
  }
}

/**
 * Get all active customers from Copper
 * Active Customer field ID: 712751
 */
export async function getAllActiveCustomers(): Promise<CopperCompany[]> {
  try {
    const allCompanies: CopperCompany[] = [];
    let pageNumber = 1;
    const pageSize = 200;
    let hasMore = true;

    console.log('Fetching all active customers from Copper...');

    while (hasMore) {
      const response = await copperRequest('/companies/search', 'POST', {
        page_number: pageNumber,
        page_size: pageSize,
        sort_by: 'name',
        custom_fields: [
          {
            custom_field_definition_id: 712751, // Active Customer field
            value: true
          }
        ]
      });

      const companies = response || [];
      allCompanies.push(...companies);

      console.log(`Fetched page ${pageNumber}: ${companies.length} companies (total: ${allCompanies.length})`);

      // Check if there are more pages
      if (companies.length < pageSize) {
        hasMore = false;
      } else {
        pageNumber++;
      }

      // Add a small delay between pages to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Fetched ${allCompanies.length} active customers total`);
    return allCompanies;
  } catch (error) {
    console.error('Error fetching active customers:', error);
    throw error;
  }
}

/**
 * Search for companies by name within a provided list
 */
export function searchCompaniesByNameInList(
  name: string,
  companies: CopperCompany[]
): CopperCompany[] {
  // Filter by name (case-insensitive partial match)
  return companies.filter((company: CopperCompany) =>
    company.name?.toLowerCase().includes(name.toLowerCase())
  );
}

/**
 * Search for companies by name (legacy - calls API directly)
 * @deprecated Use getAllActiveCustomers + searchCompaniesByNameInList instead
 */
export async function searchCompaniesByName(name: string): Promise<CopperCompany[]> {
  try {
    const response = await copperRequest('/companies/search', 'POST', {
      page_size: 200,
      sort_by: 'name',
    });
    
    const companies = response || [];
    
    // Filter by name (case-insensitive partial match)
    return companies.filter((company: CopperCompany) =>
      company.name?.toLowerCase().includes(name.toLowerCase())
    );
  } catch (error) {
    console.error('Error searching companies:', error);
    throw error;
  }
}

/**
 * Get a specific company by ID
 */
export async function getCompany(companyId: number): Promise<CopperCompany | null> {
  try {
    const company = await copperRequest(`/companies/${companyId}`, 'GET');
    return company || null;
  } catch (error) {
    console.error(`Error fetching company ${companyId}:`, error);
    return null;
  }
}

/**
 * Update a company's custom field
 */
export async function updateCompanyCustomField(
  companyId: number,
  fieldId: number,
  value: any
): Promise<boolean> {
  try {
    const company = await getCompany(companyId);
    if (!company) {
      console.error(`Company ${companyId} not found`);
      return false;
    }

    // Get existing custom fields or initialize empty array
    const customFields = company.custom_fields || [];
    
    // Find if field already exists
    const existingFieldIndex = customFields.findIndex(
      (field: any) => field.custom_field_definition_id === fieldId
    );

    if (existingFieldIndex >= 0) {
      // Update existing field
      customFields[existingFieldIndex].value = value;
    } else {
      // Add new field
      customFields.push({
        custom_field_definition_id: fieldId,
        value: value,
      });
    }

    // Update company
    await copperRequest(`/companies/${companyId}`, 'PUT', {
      custom_fields: customFields,
    });

    return true;
  } catch (error) {
    console.error(`Error updating company ${companyId}:`, error);
    return false;
  }
}

/**
 * Create a new company in Copper
 */
export async function createCompany(companyData: {
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  phone?: string;
  website?: string;
  email?: string;
  custom_fields?: Array<{
    custom_field_definition_id: number;
    value: any;
  }>;
}): Promise<CopperCompany | null> {
  try {
    const company = await copperRequest('/companies', 'POST', companyData);
    return company || null;
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
}

/**
 * Bulk update companies with "On Store Locator" field
 */
export async function bulkMarkCompaniesOnStoreLocator(
  companyIds: number[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const fieldId = await getStoreLocatorFieldId();
  
  if (!fieldId) {
    return {
      success: 0,
      failed: companyIds.length,
      errors: ['Custom field "On Store Locator" not found in Copper'],
    };
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const companyId of companyIds) {
    try {
      const updated = await updateCompanyCustomField(companyId, fieldId, true);
      if (updated) {
        success++;
      } else {
        failed++;
        errors.push(`Failed to update company ${companyId}`);
      }
      
      // Rate limiting: wait 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: any) {
      failed++;
      errors.push(`Error updating company ${companyId}: ${error.message}`);
    }
  }

  return { success, failed, errors };
}
