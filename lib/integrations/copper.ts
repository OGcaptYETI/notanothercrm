// Copper CRM Integration Utilities

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';

interface CopperHeaders {
  'X-PW-AccessToken': string;
  'X-PW-Application': string;
  'X-PW-UserEmail': string;
  'Content-Type': string;
}

function getCopperHeaders(): CopperHeaders {
  return {
    'X-PW-AccessToken': process.env.COPPER_API_KEY || '',
    'X-PW-Application': 'developer_api',
    'X-PW-UserEmail': process.env.COPPER_USER_EMAIL || '',
    'Content-Type': 'application/json',
  };
}

export async function copperRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${COPPER_API_BASE}${endpoint}`;
  const headers = getCopperHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });
  
  if (!response.ok) {
    throw new Error(`Copper API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function getCompany(companyId: number): Promise<any> {
  return copperRequest(`/companies/${companyId}`);
}

export async function searchCompanies(query: string): Promise<any[]> {
  return copperRequest('/companies/search', {
    method: 'POST',
    body: JSON.stringify({
      page_size: 25,
      name: query,
    }),
  });
}

export async function updateCompanyCustomField(
  companyId: number, 
  customFieldId: number, 
  value: any
): Promise<any> {
  const company = await getCompany(companyId);
  const customFields = company.custom_fields || [];
  
  const existingIndex = customFields.findIndex(
    (cf: any) => cf.custom_field_definition_id === customFieldId
  );
  
  if (existingIndex >= 0) {
    customFields[existingIndex].value = value;
  } else {
    customFields.push({
      custom_field_definition_id: customFieldId,
      value,
    });
  }
  
  return copperRequest(`/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify({ custom_fields: customFields }),
  });
}

export async function createActivity(data: {
  parent_type: string;
  parent_id: number;
  type: { category: string; id: number };
  details: string;
}): Promise<any> {
  return copperRequest('/activities', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      activity_date: Math.floor(Date.now() / 1000),
    }),
  });
}

export async function getActivityTypes(): Promise<any[]> {
  return copperRequest('/activity_types');
}

export async function getPipelines(): Promise<any[]> {
  return copperRequest('/pipelines');
}

export async function getUsers(): Promise<any[]> {
  return copperRequest('/users');
}

// Store Locator specific functions
export async function getStoreLocatorFieldId(): Promise<number | null> {
  try {
    const definitions = await copperRequest('/custom_field_definitions');
    const storeLocatorField = definitions.find(
      (d: any) => d.name?.toLowerCase().includes('store locator') || 
                  d.name?.toLowerCase().includes('storelocator')
    );
    return storeLocatorField?.id || null;
  } catch (error) {
    console.error('Error getting store locator field ID:', error);
    return null;
  }
}

export async function getAllActiveCustomers(): Promise<any[]> {
  try {
    const companies = await copperRequest('/companies/search', {
      method: 'POST',
      body: JSON.stringify({
        page_size: 200,
        sort_by: 'name',
      }),
    });
    return companies || [];
  } catch (error) {
    console.error('Error getting active customers:', error);
    return [];
  }
}

export async function searchCompaniesByNameInList(names: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  for (const name of names) {
    try {
      const companies = await searchCompanies(name);
      if (companies.length > 0) {
        results.set(name, companies[0]);
      }
    } catch (error) {
      console.error(`Error searching for company ${name}:`, error);
    }
  }
  
  return results;
}
