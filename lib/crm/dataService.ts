/**
 * Unified CRM Data Service
 * Links data from multiple Firebase collections:
 * - fishbowl_customers -> Accounts
 * - copper_companies -> Accounts (merged)
 * - copper_leads -> Prospects
 * - copper_opportunities -> Pipeline Deals
 * - copper_people -> Contacts
 * - fishbowl_sales_orders -> Order History
 * - customer_sales_summary -> Sales Metrics
 */

import { db } from '@/lib/firebase/config';
import { 
  collection, 
  query, 
  getDocs, 
  getDoc,
  doc,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  DocumentData
} from 'firebase/firestore';

// ============== ID Generation ==============
// Generates IDs in the same format as Copper (numeric)
let idCounter = Date.now();

export function generateCRMId(): number {
  idCounter++;
  return idCounter;
}

// ============== Type Definitions ==============

export interface UnifiedAccount {
  id: string;
  // Source tracking
  source: 'fishbowl' | 'copper' | 'manual';
  fishbowlId?: string;
  copperId?: number;
  
  // Core fields
  name: string;
  accountNumber?: string;
  website?: string;
  phone?: string;
  email?: string;
  
  // Address
  shippingStreet?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  
  // Classification
  accountType?: string[];
  region?: string;
  segment?: string;
  customerPriority?: string;
  organizationLevel?: string;
  businessModel?: string;
  
  // Terms
  paymentTerms?: string;
  shippingTerms?: string;
  carrierName?: string;
  
  // Sales data
  salesPerson?: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  
  // Primary Contact (from Copper)
  primaryContactId?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  
  // Copper custom fields
  accountOrderId?: string; // cf_698467 - links to fishbowl_sales_orders.customerId
  copperUrl?: string;
  contactType?: string;
  inactiveDays?: number;
  interactionCount?: number;
  lastContacted?: Date;
  ownedBy?: string;
  ownerId?: number;
  
  // Status
  status: 'prospect' | 'active' | 'inactive' | 'churned';
  isActiveCustomer?: boolean;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  notes?: string;
}

export interface UnifiedProspect {
  id: string;
  source: 'copper_lead' | 'manual';
  copperId?: number;
  
  // Core fields
  name: string;
  companyName?: string;
  title?: string;
  email?: string;
  phone?: string;
  
  // Address
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  
  // Classification
  accountType?: string[];
  region?: string;
  segment?: string;
  leadTemperature?: string;
  accountOpportunity?: string;
  
  // Status
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
  assigneeId?: string;
  assigneeName?: string;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  followUpDate?: Date;
  notes?: string;
  tradeShowName?: string;
}

export interface UnifiedContact {
  id: string;
  source: 'copper_person' | 'manual';
  copperId?: number;
  
  // Core fields
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  title?: string;
  
  // Related account
  accountId?: string;
  accountName?: string;
  copperId_company?: number;
  isPrimaryContact?: boolean;
  
  // Address
  street?: string;
  city?: string;
  state?: string;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UnifiedDeal {
  id: string;
  source: 'copper_opportunity' | 'manual';
  copperId?: number;
  
  // Core fields
  name: string;
  value?: number;
  probability?: number;
  stage?: string;
  pipelineId?: string;
  
  // Related entities
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  
  // Status
  status: 'open' | 'won' | 'lost';
  expectedCloseDate?: Date;
  wonDate?: Date;
  lostDate?: Date;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  notes?: string;
}

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  total: number;
  status: string;
  items?: OrderItem[];
}

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesSummary {
  accountId: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  topProducts?: { name: string; quantity: number; revenue: number }[];
}

// ============== Data Loading Functions ==============

export interface PaginationOptions {
  pageSize?: number;
  offset?: number;
  searchTerm?: string;
  filters?: {
    status?: string;
    source?: string;
    salesPerson?: string;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

/**
 * Get total count of accounts across all collections
 */
export async function getTotalAccountsCount(): Promise<{
  total: number;
  active: number;
  fishbowl: number;
}> {
  try {
    const fishbowlSnapshot = await getDocs(collection(db, 'fishbowl_customers'));
    const fishbowlCount = fishbowlSnapshot.size;
    
    // Count active accounts
    let activeCount = 0;
    fishbowlSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.isActiveCustomer || data.status === 'active') {
        activeCount++;
      }
    });
    
    return {
      total: fishbowlCount,
      active: activeCount,
      fishbowl: fishbowlCount,
    };
  } catch (error) {
    console.error('Error getting account counts:', error);
    return { total: 0, active: 0, fishbowl: 0 };
  }
}

/**
 * Load accounts with pagination and filtering from copper_companies
 * Uses indexed queries for efficient search
 */
export async function loadUnifiedAccounts(
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedAccount>> {
  const { pageSize = 50, offset = 0, searchTerm, filters } = options;
  const accounts: UnifiedAccount[] = [];
  let totalCount = 0;
  
  try {
    // If searching, use indexed queries
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      console.log(`Searching accounts in copper_companies for: "${term}"`);
      
      const searchLimit = 100;
      
      // Search by name (prefix match)
      const nameQuery = query(
        collection(db, 'copper_companies'),
        where('name', '>=', term),
        where('name', '<=', term + '\uf8ff'),
        limit(searchLimit)
      );
      
      const nameResults = await getDocs(nameQuery);
      
      nameResults.forEach((doc) => {
        const data = doc.data();
        const account = buildAccountFromCopper(doc.id, data);
        accounts.push(account);
      });
      
      totalCount = accounts.length;
      
      console.log(`Found ${accounts.length} accounts using indexed queries`);
    } else {
      // Build query for copper_companies
      let copperQuery = query(
        collection(db, 'copper_companies'),
        orderBy('name'),
        limit(pageSize)
      );
      
      // Apply filters if provided
      if (filters?.salesPerson) {
        copperQuery = query(
          collection(db, 'copper_companies'),
          where('Owned By', '==', filters.salesPerson),
          orderBy('name'),
          limit(pageSize)
        );
      }
  
      // Load copper_companies with pagination
      const copperSnapshot = await getDocs(copperQuery);
      totalCount = copperSnapshot.size;
      
      copperSnapshot.forEach((doc) => {
        const data = doc.data();
        const account = buildAccountFromCopper(doc.id, data);
        accounts.push(account);
      });
      
      console.log(`Loaded ${accounts.length} accounts from copper_companies`);
    }
  } catch (error) {
    console.error('Error loading accounts from copper_companies:', error);
  }
  
  return {
    data: accounts,
    total: totalCount,
    hasMore: !searchTerm && accounts.length >= pageSize
  };
}

// Helper function to build account from copper_companies data
function buildAccountFromCopper(docId: string, data: DocumentData): UnifiedAccount {
  // Parse address from copper data
  const address = data.address || {};
  const street = address.street || data.street || data.Street || '';
  const city = address.city || data.city || data.City || '';
  const state = address.state || data.state || data.State || '';
  const zip = address.postal_code || data.zip || data['Postal Code'] || '';
  
  return {
    id: docId,
    source: 'copper',
    copperId: data.id || data['Copper ID'] || Number(docId),
    
    name: data.name || data.Name || 'Unknown',
    accountNumber: data.cf_713477 || data['Account ID cf_713477'],
    website: data.websites?.[0] || '',
    phone: data.phone_numbers?.[0]?.number || data.phone || data.Phone || '',
    email: data.email || data.Email || '',
    
    shippingStreet: street,
    shippingCity: city,
    shippingState: state,
    shippingZip: zip,
    
    // Classification
    accountType: parseAccountType(data.cf_675914 || data['Account Type cf_675914']),
    region: data.cf_680701 || data['Region cf_680701'],
    
    // Copper custom fields
    accountOrderId: data.cf_698467 || data['Account Order ID cf_698467'],
    copperUrl: data.copperUrl,
    contactType: data['Contact Type'] || data.contact_type_id,
    inactiveDays: data['Inactive Days'],
    interactionCount: data['Interaction Count'] || data.interaction_count,
    lastContacted: data['Last Contacted'] ? new Date(data['Last Contacted'] * 1000) : undefined,
    ownedBy: data['Owned By'],
    ownerId: data['Owner Id'] || data.assignee_id,
    
    // Primary Contact
    primaryContactId: data['Primary Contact ID']?.toString() || data.primary_contact_id?.toString(),
    primaryContactName: data['Primary Contact'],
    
    // Status
    status: data.cf_712751 || data['Active Customer cf_712751'] ? 'active' : 'prospect',
    isActiveCustomer: data.cf_712751 || data['Active Customer cf_712751'],
    
    // Metadata
    createdAt: data['Created At'] ? new Date(data['Created At'] * 1000) : 
               data.date_created ? new Date(data.date_created * 1000) : undefined,
    updatedAt: data['Updated At'] ? new Date(data['Updated At'] * 1000) : 
               data.date_modified ? new Date(data.date_modified * 1000) : undefined,
    notes: data.details || data.notes || '',
  };
}

/**
 * Load prospects from copper_leads
 */
export async function loadUnifiedProspects(): Promise<UnifiedProspect[]> {
  const prospects: UnifiedProspect[] = [];
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_leads'));
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      const prospect: UnifiedProspect = {
        id: doc.id,
        source: 'copper_lead',
        copperId: data.id || Number(doc.id),
        
        name: data.Name || data['Lead Name'] || 'Unknown',
        companyName: data['Company Name'] || data.Company,
        title: data.Title,
        email: data.Email || data['Email Address'],
        phone: data.Phone || data['Phone Number'],
        
        street: data['Street Address'],
        city: data.City,
        state: data.State,
        postalCode: data['Postal Code'],
        
        accountType: parseAccountType(data['Account Type cf_698259']),
        region: data['Region cf_698278'],
        segment: data['Segment cf_698498'],
        leadTemperature: data['Lead Temperature cf_698273'] || 'Warm',
        accountOpportunity: data['Account Opportunity cf_698257'],
        
        status: mapLeadStatus(data.Status),
        assigneeId: data['Assignee Id'],
        assigneeName: data.Assignee,
        
        createdAt: data.importedAt?.toDate?.() || data['Date Created'] ? new Date(data['Date Created']) : undefined,
        updatedAt: data['Date Modified'] ? new Date(data['Date Modified']) : undefined,
        notes: data['Prospect Notes cf_698281'] || data.Details,
        tradeShowName: data['Trade Show Name cf_698295'],
      };
      
      prospects.push(prospect);
    });
    
    console.log(`Loaded ${prospects.length} prospects from copper_leads`);
  } catch (error) {
    console.error('Error loading copper_leads:', error);
  }
  
  return prospects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get total count of contacts
 */
export async function getTotalContactsCount(): Promise<{
  total: number;
  withAccounts: number;
}> {
  try {
    const snapshot = await getDocs(collection(db, 'copper_people'));
    const total = snapshot.size;
    
    let withAccounts = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.companyId || data['Company Id']) {
        withAccounts++;
      }
    });
    
    return { total, withAccounts };
  } catch (error) {
    console.error('Error getting contact counts:', error);
    return { total: 0, withAccounts: 0 };
  }
}

/**
 * Load contacts with pagination and filtering
 * Uses indexed queries for efficient search (100 reads vs 75k)
 */
export async function loadUnifiedContacts(
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedContact>> {
  const { pageSize = 50, offset = 0, searchTerm, filters } = options;
  const contacts: UnifiedContact[] = [];
  const contactMap = new Map<string, UnifiedContact>();
  let totalCount = 0;
  
  try {
    // If searching, use indexed queries for efficient search
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      console.log(`Searching contacts with indexed queries for: "${term}"`);
      
      // Firestore range query for prefix matching
      // Uses composite indexes for efficient search
      const searchLimit = 100; // Limit results per query
      
      // Query 1: Search by name (prefix match)
      const nameQuery = query(
        collection(db, 'copper_people'),
        where('name', '>=', term),
        where('name', '<=', term + '\uf8ff'),
        limit(searchLimit)
      );
      
      // Query 2: Search by email (prefix match)
      const emailQuery = query(
        collection(db, 'copper_people'),
        where('email', '>=', term),
        where('email', '<=', term + '\uf8ff'),
        limit(searchLimit)
      );
      
      // Query 3: Search by company name (prefix match)
      const companyQuery = query(
        collection(db, 'copper_people'),
        where('companyName', '>=', term),
        where('companyName', '<=', term + '\uf8ff'),
        limit(searchLimit)
      );
      
      // Execute queries in parallel for better performance
      const [nameResults, emailResults, companyResults] = await Promise.all([
        getDocs(nameQuery),
        getDocs(emailQuery),
        getDocs(companyQuery)
      ]);
      
      // Process and deduplicate results
      const processSnapshot = (snapshot: any) => {
        snapshot.forEach((doc: any) => {
          if (!contactMap.has(doc.id)) {
            const data = doc.data();
            const firstName = data.firstName || data['First Name'] || '';
            const lastName = data.lastName || data['Last Name'] || '';
            
            const contact: UnifiedContact = {
              id: doc.id,
              source: 'copper_person',
              copperId: data.id || Number(doc.id),
              
              firstName,
              lastName,
              fullName: data.name || data.Name || `${firstName} ${lastName}`.trim() || 'Unknown',
              email: data.email || data.Email || data['Email Address'] || '',
              phone: data.phone || data.Phone || data['Phone Number'] || '',
              title: data.title || data.Title || '',
              
              accountId: data.companyId?.toString() || data['Company Id']?.toString(),
              accountName: data.companyName || data['Company Name'] || data.Company || '',
              copperId_company: data.companyId || data['Company Id'],
              isPrimaryContact: false,
              
              street: data.street || data['Street Address'] || '',
              city: data.city || data.City || '',
              state: data.state || data.State || '',
              
              createdAt: data.dateCreated?.toDate?.() || data.importedAt?.toDate?.() || (data['Date Created'] ? new Date(data['Date Created']) : undefined),
              updatedAt: data.dateModified?.toDate?.() || data.updatedAt?.toDate?.() || (data['Date Modified'] ? new Date(data['Date Modified']) : undefined),
            };
            
            contactMap.set(doc.id, contact);
          }
        });
      };
      
      processSnapshot(nameResults);
      processSnapshot(emailResults);
      processSnapshot(companyResults);
      
      contacts.push(...Array.from(contactMap.values()));
      totalCount = contacts.length;
      
      console.log(`Found ${contacts.length} contacts using indexed queries (reads: ~${nameResults.size + emailResults.size + companyResults.size})`);
    } else {
      // No search - return paginated results
      const contactQuery = query(
        collection(db, 'copper_people'),
        limit(pageSize)
      );
      
      const snapshot = await getDocs(contactQuery);
      totalCount = snapshot.size;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const firstName = data.firstName || data['First Name'] || '';
        const lastName = data.lastName || data['Last Name'] || '';
        
        const contact: UnifiedContact = {
          id: doc.id,
          source: 'copper_person',
          copperId: data.id || Number(doc.id),
          
          firstName,
          lastName,
          fullName: data.name || data.Name || `${firstName} ${lastName}`.trim() || 'Unknown',
          email: data.email || data.Email || data['Email Address'] || '',
          phone: data.phone || data.Phone || data['Phone Number'] || '',
          title: data.title || data.Title || '',
          
          accountId: data.companyId?.toString() || data['Company Id']?.toString(),
          accountName: data.companyName || data['Company Name'] || data.Company || '',
          copperId_company: data.companyId || data['Company Id'],
          isPrimaryContact: false,
          
          street: data.street || data['Street Address'] || '',
          city: data.city || data.City || '',
          state: data.state || data.State || '',
          
          createdAt: data.dateCreated?.toDate?.() || data.importedAt?.toDate?.() || (data['Date Created'] ? new Date(data['Date Created']) : undefined),
          updatedAt: data.dateModified?.toDate?.() || data.updatedAt?.toDate?.() || (data['Date Modified'] ? new Date(data['Date Modified']) : undefined),
        };
        
        contacts.push(contact);
      });
      
      console.log(`Loaded ${contacts.length} contacts (page size: ${pageSize})`);
    }
  } catch (error) {
    console.error('Error loading copper_people:', error);
  }
  
  return {
    data: contacts,
    total: totalCount,
    hasMore: !searchTerm && contacts.length >= pageSize
  };
}

/**
 * Load deals from copper_opportunities
 */
export async function loadUnifiedDeals(): Promise<UnifiedDeal[]> {
  const deals: UnifiedDeal[] = [];
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_opportunities'));
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      const deal: UnifiedDeal = {
        id: doc.id,
        source: 'copper_opportunity',
        copperId: data.id || Number(doc.id),
        
        name: data.Name || data['Opportunity Name'] || 'Untitled Deal',
        value: parseFloat(data['Monetary Value']) || parseFloat(data.Value) || 0,
        probability: parseInt(data['Win Probability']) || parseInt(data.Probability) || 50,
        stage: data['Pipeline Stage'] || data.Stage,
        pipelineId: data['Pipeline Id']?.toString(),
        
        accountId: data['Primary Company Id']?.toString(),
        accountName: data['Primary Company'] || data.Company,
        contactId: data['Primary Contact Id']?.toString(),
        contactName: data['Primary Contact'],
        
        status: mapOpportunityStatus(data.Status),
        expectedCloseDate: data['Close Date'] ? new Date(data['Close Date']) : undefined,
        wonDate: data['Won Date'] ? new Date(data['Won Date']) : undefined,
        lostDate: data['Lost Date'] ? new Date(data['Lost Date']) : undefined,
        
        createdAt: data.importedAt?.toDate?.() || data['Date Created'] ? new Date(data['Date Created']) : undefined,
        updatedAt: data['Date Modified'] ? new Date(data['Date Modified']) : undefined,
        notes: data.Details || data.Notes,
      };
      
      deals.push(deal);
    });
    
    console.log(`Loaded ${deals.length} deals from copper_opportunities`);
  } catch (error) {
    console.error('Error loading copper_opportunities:', error);
  }
  
  return deals.sort((a, b) => (b.value || 0) - (a.value || 0));
}

/**
 * Load order history for an account from copper_companies
 * Links via cf_698467 (Account Order ID) = fishbowl_sales_orders.customerId
 */
export async function loadAccountOrders(accountId: string): Promise<OrderSummary[]> {
  const orders: OrderSummary[] = [];
  
  try {
    // First get the copper_companies account to find the Account Order ID
    const accountDoc = await getDoc(doc(db, 'copper_companies', accountId));
    if (!accountDoc.exists()) {
      console.log(`Account ${accountId} not found in copper_companies`);
      return orders;
    }
    
    const accountData = accountDoc.data();
    const customerId = accountData.cf_698467 || accountData['Account Order ID cf_698467'];
    
    if (!customerId) {
      console.log(`No Account Order ID (cf_698467) found for account ${accountId}`);
      return orders;
    }
    
    console.log(`Loading orders for account ${accountId} with customerId: ${customerId}`);
    
    // Query orders by customerId
    const ordersQuery = query(
      collection(db, 'fishbowl_sales_orders'),
      where('customerId', '==', customerId),
      orderBy('dateCreated', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(ordersQuery);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      orders.push({
        orderId: doc.id,
        orderNumber: data.orderNum || data.soNum || doc.id,
        orderDate: data.dateCreated?.toDate?.() || new Date(),
        total: parseFloat(data.totalAmount) || parseFloat(data.total) || parseFloat(data.revenue) || 0,
        status: data.status || data.statusName || 'Unknown',
      });
    });
    
    console.log(`Loaded ${orders.length} orders for account ${accountId}`);
  } catch (error) {
    console.error('Error loading orders:', error);
  }
  
  return orders;
}

/**
 * Load a single account from copper_companies by Copper ID
 */
export async function loadAccountFromCopper(copperId: string): Promise<UnifiedAccount | null> {
  try {
    const docRef = doc(db, 'copper_companies', copperId);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      console.log(`Account ${copperId} not found in copper_companies`);
      return null;
    }
    
    const data = snapshot.data();
    
    // Parse address from copper data
    const address = data.address || {};
    const street = address.street || data.street || data.Street || '';
    const city = address.city || data.city || data.City || '';
    const state = address.state || data.state || data.State || '';
    const zip = address.postal_code || data.zip || data['Postal Code'] || '';
    
    // Build unified account from copper_companies data
    const account: UnifiedAccount = {
      id: snapshot.id,
      source: 'copper',
      copperId: data.id || data['Copper ID'] || Number(snapshot.id),
      
      // Core fields
      name: data.name || data.Name || 'Unknown',
      accountNumber: data.cf_713477 || data['Account ID cf_713477'],
      website: data.websites?.[0] || '',
      phone: data.phone_numbers?.[0]?.number || data.phone || data.Phone || '',
      email: data.email || data.Email || '',
      
      // Address
      shippingStreet: street,
      shippingCity: city,
      shippingState: state,
      shippingZip: zip,
      
      // Classification
      accountType: parseAccountType(data.cf_675914 || data['Account Type cf_675914']),
      region: data.cf_680701 || data['Region cf_680701'],
      
      // Copper custom fields
      accountOrderId: data.cf_698467 || data['Account Order ID cf_698467'],
      copperUrl: data.copperUrl,
      contactType: data['Contact Type'] || data.contact_type_id,
      inactiveDays: data['Inactive Days'],
      interactionCount: data['Interaction Count'] || data.interaction_count,
      lastContacted: data['Last Contacted'] ? new Date(data['Last Contacted'] * 1000) : undefined,
      ownedBy: data['Owned By'],
      ownerId: data['Owner Id'] || data.assignee_id,
      
      // Primary Contact
      primaryContactId: data['Primary Contact ID']?.toString() || data.primary_contact_id?.toString(),
      primaryContactName: data['Primary Contact'],
      
      // Status
      status: data.cf_712751 || data['Active Customer cf_712751'] ? 'active' : 'prospect',
      isActiveCustomer: data.cf_712751 || data['Active Customer cf_712751'],
      
      // Metadata
      createdAt: data['Created At'] ? new Date(data['Created At'] * 1000) : 
                 data.date_created ? new Date(data.date_created * 1000) : undefined,
      updatedAt: data['Updated At'] ? new Date(data['Updated At'] * 1000) : 
                 data.date_modified ? new Date(data.date_modified * 1000) : undefined,
      notes: data.details || data.notes || '',
    };
    
    return account;
  } catch (error) {
    console.error('Error loading account from copper_companies:', error);
    return null;
  }
}

/**
 * Load sales summary for an account from metrics subcollection
 */
export async function loadAccountSalesSummary(accountId: string): Promise<any | null> {
  try {
    // Try loading from copper_companies metrics subcollection first
    const metricsRef = doc(db, 'copper_companies', accountId, 'metrics', 'sales_summary');
    const metricsSnapshot = await getDoc(metricsRef);
    
    if (metricsSnapshot.exists()) {
      return metricsSnapshot.data();
    }
    
    // Fallback to old customer_sales_summary collection
    const docRef = doc(db, 'customer_sales_summary', accountId);
    const snapshot = await getDoc(docRef);
    
    if (snapshot.exists()) {
      return snapshot.data();
    }
    
    return null;
  } catch (error) {
    console.error('Error loading sales summary:', error);
    return null;
  }
}

// ============== Helper Functions ==============

function parseAccountType(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // Handle comma-separated values
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function determineAccountStatus(fishbowlData: any, copperData: any): UnifiedAccount['status'] {
  // If marked as active in either system
  if (copperData?.['Active Customer cf_712751'] === true || fishbowlData?.isActiveCustomer) {
    return 'active';
  }
  
  // If has recent orders (within last 6 months)
  if (fishbowlData?.lastOrderDate) {
    const lastOrder = fishbowlData.lastOrderDate.toDate?.() || new Date(fishbowlData.lastOrderDate);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (lastOrder > sixMonthsAgo) {
      return 'active';
    } else if (fishbowlData.totalOrders > 0) {
      return 'inactive';
    }
  }
  
  return 'prospect';
}

function mapLeadStatus(status: string): UnifiedProspect['status'] {
  if (!status) return 'new';
  const lower = status.toLowerCase();
  
  if (lower.includes('new') || lower.includes('open')) return 'new';
  if (lower.includes('contact')) return 'contacted';
  if (lower.includes('qualif')) return 'qualified';
  if (lower.includes('unqualif') || lower.includes('disqualif')) return 'unqualified';
  if (lower.includes('convert') || lower.includes('won')) return 'converted';
  
  return 'new';
}

function mapOpportunityStatus(status: string): UnifiedDeal['status'] {
  if (!status) return 'open';
  const lower = status.toLowerCase();
  
  if (lower.includes('won') || lower.includes('closed won')) return 'won';
  if (lower.includes('lost') || lower.includes('closed lost')) return 'lost';
  
  return 'open';
}

// ============== CRUD Operations ==============

/**
 * Create a new account in the accounts collection
 */
export async function createAccount(data: Partial<UnifiedAccount>): Promise<string> {
  const newId = generateCRMId();
  
  const accountData = {
    ...data,
    id: newId,
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'accounts'), accountData);
  return docRef.id;
}

/**
 * Create a new prospect
 */
export async function createProspect(data: Partial<UnifiedProspect>): Promise<string> {
  const newId = generateCRMId();
  
  const prospectData = {
    ...data,
    id: newId,
    copperId: newId, // Use same ID format as Copper
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'prospects'), prospectData);
  return docRef.id;
}

/**
 * Create a new contact
 */
export async function createContact(data: Partial<UnifiedContact>): Promise<string> {
  const newId = generateCRMId();
  
  const contactData = {
    ...data,
    id: newId,
    copperId: newId,
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'contacts'), contactData);
  return docRef.id;
}

/**
 * Create a new deal
 */
export async function createDeal(data: Partial<UnifiedDeal>): Promise<string> {
  const newId = generateCRMId();
  
  const dealData = {
    ...data,
    id: newId,
    copperId: newId,
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'pipeline_deals'), dealData);
  return docRef.id;
}
