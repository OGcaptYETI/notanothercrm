import { QuoteCustomer } from '@/types/quote';
import { adminDb } from '@/lib/firebase/admin';

export interface CustomerSearchResult extends QuoteCustomer {
  matchScore: number;
  matchReason: string;
}

/**
 * Search for customers across Fishbowl and Copper collections
 * Priority: Fishbowl (active) > Copper (all)
 * 
 * NOTE: This service uses Firebase Admin SDK and must be called from server-side API routes only
 */
export async function searchCustomers(searchTerm: string, maxResults: number = 10): Promise<CustomerSearchResult[]> {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const results: CustomerSearchResult[] = [];
  const searchLower = searchTerm.toLowerCase().trim();

  try {
    // Search Fishbowl customers first (active customers)
    const fishbowlResults = await searchFishbowlCustomers(searchLower);
    results.push(...fishbowlResults);

    // If we don't have enough results, search Copper
    if (results.length < maxResults) {
      const copperResults = await searchCopperCompanies(searchLower, maxResults - results.length);
      results.push(...copperResults);
    }

    // Sort by match score and return top results
    return results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, maxResults);

  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
}

/**
 * Search Fishbowl customers (active customers)
 */
async function searchFishbowlCustomers(searchTerm: string): Promise<CustomerSearchResult[]> {
  const results: CustomerSearchResult[] = [];
  
  try {
    const customersRef = adminDb.collection('fishbowl_customers');
    
    // Get a batch of customers to search through
    const snapshot = await customersRef.limit(100).get();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const email = (data.email || '').toLowerCase();
      const phone = (data.phone || '').toLowerCase();
      const accountNumber = (data.accountNumber || '').toLowerCase();
      
      let matchScore = 0;
      let matchReason = '';
      
      // Exact match
      if (name === searchTerm) {
        matchScore = 100;
        matchReason = 'Exact company name match';
      }
      // Starts with
      else if (name.startsWith(searchTerm)) {
        matchScore = 90;
        matchReason = 'Company name starts with search';
      }
      // Contains
      else if (name.includes(searchTerm)) {
        matchScore = 80;
        matchReason = 'Company name contains search';
      }
      // Email match
      else if (email && email.includes(searchTerm)) {
        matchScore = 85;
        matchReason = 'Email match';
      }
      // Phone match
      else if (phone && phone.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))) {
        matchScore = 85;
        matchReason = 'Phone match';
      }
      // Account number match
      else if (accountNumber && accountNumber.includes(searchTerm)) {
        matchScore = 95;
        matchReason = 'Account number match';
      }
      
      if (matchScore > 0) {
        results.push({
          source: 'fishbowl',
          fishbowlId: doc.id,
          copperId: data.copperId,
          companyName: data.name || '',
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          street: data.billingAddress || data.shippingAddress,
          city: data.billingCity || data.shippingCity,
          state: data.billingState || data.shippingState,
          zip: data.billingZip || data.shipToZip,
          country: data.shippingCountry,
          accountType: data.accountType as any,
          salesPerson: data.salesPerson,
          salesRepName: data.salesRepName,
          region: data.region,
          isActive: true,
          accountNumber: data.accountNumber,
          matchScore,
          matchReason: `${matchReason} (Active in Fishbowl)`,
        });
      }
    });
    
  } catch (error) {
    console.error('Error searching Fishbowl customers:', error);
  }
  
  return results;
}

/**
 * Search Copper companies (all customers)
 */
async function searchCopperCompanies(searchTerm: string, maxResults: number = 10): Promise<CustomerSearchResult[]> {
  const results: CustomerSearchResult[] = [];
  
  try {
    const companiesRef = adminDb.collection('copper_companies');
    
    // Get a batch of companies to search through
    const snapshot = await companiesRef.limit(100).get();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const email = (data.email_domain || '').toLowerCase();
      const phone = (data.phone || '').toLowerCase();
      
      let matchScore = 0;
      let matchReason = '';
      
      // Exact match
      if (name === searchTerm) {
        matchScore = 70; // Lower than Fishbowl
        matchReason = 'Exact company name match';
      }
      // Starts with
      else if (name.startsWith(searchTerm)) {
        matchScore = 60;
        matchReason = 'Company name starts with search';
      }
      // Contains
      else if (name.includes(searchTerm)) {
        matchScore = 50;
        matchReason = 'Company name contains search';
      }
      // Email match
      else if (email && email.includes(searchTerm)) {
        matchScore = 55;
        matchReason = 'Email domain match';
      }
      // Phone match
      else if (phone && phone.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))) {
        matchScore = 55;
        matchReason = 'Phone match';
      }
      
      if (matchScore > 0) {
        const isActive = data['Active Customer cf_712751'] === 'checked' || 
                        data['Active Customer cf_712751'] === true;
        
        results.push({
          source: 'copper',
          copperId: String(data.id),
          companyName: data.name || '',
          email: data.email_domain,
          phone: data.phone,
          street: data.Street || data.street,
          city: data.city || data.City,
          state: data.State || data.state,
          zip: data['Postal Code'] || data.postal_code || data.zip,
          country: data.country || data.Country,
          accountType: normalizeAccountType(data['Account Type cf_675914']),
          region: data['Region cf_680701'],
          isActive,
          accountNumber: data['Account Order ID cf_698467'],
          matchScore,
          matchReason: `${matchReason} (${isActive ? 'Active' : 'Inactive'} in Copper)`,
        });
      }
    });
    
  } catch (error) {
    console.error('Error searching Copper companies:', error);
  }
  
  return results.slice(0, maxResults);
}

/**
 * Normalize account type from Copper format
 */
function normalizeAccountType(copperType: any): 'Distributor' | 'Wholesale' | 'Retail' | undefined {
  if (!copperType) return undefined;
  
  // Handle array format
  if (Array.isArray(copperType)) {
    if (copperType.length === 0) return 'Retail';
    const firstItem = copperType[0];
    
    if (typeof firstItem === 'object' && firstItem.name) {
      return normalizeAccountType(firstItem.name);
    }
    
    if (typeof firstItem === 'number') {
      const typeMap: Record<number, any> = {
        1981470: 'Distributor',
        2063862: 'Wholesale',
        2066840: 'Retail',
      };
      return typeMap[firstItem] || 'Retail';
    }
    
    return normalizeAccountType(firstItem);
  }
  
  // Handle number (option ID)
  if (typeof copperType === 'number') {
    const typeMap: Record<number, any> = {
      1981470: 'Distributor',
      2063862: 'Wholesale',
      2066840: 'Retail',
    };
    return typeMap[copperType] || 'Retail';
  }
  
  // Handle object format
  if (typeof copperType === 'object' && copperType.name) {
    return normalizeAccountType(copperType.name);
  }
  
  // Handle string format
  const typeStr = String(copperType).toLowerCase().trim();
  
  if (typeStr.includes('distributor') || typeStr.includes('distribution')) {
    return 'Distributor';
  }
  if (typeStr.includes('wholesale')) {
    return 'Wholesale';
  }
  
  return 'Retail';
}

/**
 * Get customer by ID (Fishbowl or Copper)
 */
export async function getCustomerById(id: string, source: 'fishbowl' | 'copper'): Promise<QuoteCustomer | null> {
  try {
    const collectionName = source === 'fishbowl' ? 'fishbowl_customers' : 'copper_companies';
    const docRef = adminDb.collection(collectionName).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    const data = doc.data();
    if (!data) return null;
    
    if (source === 'fishbowl') {
      return {
        source: 'fishbowl',
        fishbowlId: doc.id,
        copperId: data.copperId,
        companyName: data.name || '',
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        street: data.billingAddress || data.shippingAddress,
        city: data.billingCity || data.shippingCity,
        state: data.billingState || data.shippingState,
        zip: data.billingZip || data.shipToZip,
        country: data.shippingCountry,
        accountType: data.accountType as any,
        salesPerson: data.salesPerson,
        salesRepName: data.salesRepName,
        region: data.region,
        isActive: true,
        accountNumber: data.accountNumber,
      };
    } else {
      const isActive = data['Active Customer cf_712751'] === 'checked' || 
                      data['Active Customer cf_712751'] === true;
      
      return {
        source: 'copper',
        copperId: String(data.id),
        companyName: data.name || '',
        email: data.email_domain,
        phone: data.phone,
        street: data.Street || data.street,
        city: data.city || data.City,
        state: data.State || data.state,
        zip: data['Postal Code'] || data.postal_code || data.zip,
        country: data.country || data.Country,
        accountType: normalizeAccountType(data['Account Type cf_675914']),
        region: data['Region cf_680701'],
        isActive,
        accountNumber: data['Account Order ID cf_698467'],
      };
    }
  } catch (error) {
    console.error('Error getting customer by ID:', error);
    return null;
  }
}

/**
 * Get recent customers for a user
 */
export async function getRecentCustomers(userId: string, limit_count: number = 5): Promise<QuoteCustomer[]> {
  try {
    const quotesRef = adminDb.collection('quotes');
    const snapshot = await quotesRef
      .where('createdBy', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit_count * 2) // Get more to account for duplicates
      .get();
    
    const customers: QuoteCustomer[] = [];
    const seenCompanies = new Set<string>();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const customer = data.customer as QuoteCustomer;
      
      if (customer && !seenCompanies.has(customer.companyName)) {
        customers.push(customer);
        seenCompanies.add(customer.companyName);
      }
    });
    
    return customers.slice(0, limit_count);
  } catch (error) {
    console.error('Error getting recent customers:', error);
    return [];
  }
}
