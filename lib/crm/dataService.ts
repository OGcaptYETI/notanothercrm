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
 * Load accounts with pagination and filtering
 * Uses indexed queries for efficient search
 */
export async function loadUnifiedAccounts(
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedAccount>> {
  const { pageSize = 50, offset = 0, searchTerm, filters } = options;
  const accounts: UnifiedAccount[] = [];
  const accountMap = new Map<string, UnifiedAccount>();
  let totalCount = 0;
  
  // If searching, use indexed queries
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    console.log(`Searching accounts with indexed queries for: "${term}"`);
    
    const searchLimit = 100;
    
    // Search by name (prefix match)
    const nameQuery = query(
      collection(db, 'fishbowl_customers'),
      where('name', '>=', term),
      where('name', '<=', term + '\uf8ff'),
      limit(searchLimit)
    );
    
    const nameResults = await getDocs(nameQuery);
    
    nameResults.forEach((doc) => {
      if (!accountMap.has(doc.id)) {
        const fb = doc.data();
        const account = buildAccountFromFirestore(doc.id, fb);
        accountMap.set(doc.id, account);
      }
    });
    
    accounts.push(...Array.from(accountMap.values()));
    totalCount = accounts.length;
    
    console.log(`Found ${accounts.length} accounts using indexed queries (reads: ~${nameResults.size})`);
  } else {
    // Build query with filters
    let fishbowlQuery = query(
      collection(db, 'fishbowl_customers'),
      orderBy('name'),
      limit(pageSize)
    );
    
    // Apply filters if provided
    if (filters?.salesPerson) {
      fishbowlQuery = query(
        collection(db, 'fishbowl_customers'),
        where('salesPerson', '==', filters.salesPerson),
        orderBy('name'),
        limit(pageSize)
      );
    }
  
    // Load fishbowl_customers with pagination
    try {
      const fishbowlSnapshot = await getDocs(fishbowlQuery);
      totalCount = fishbowlSnapshot.size;
      
      fishbowlSnapshot.forEach((doc) => {
        const fb = doc.data();
        
        const account: UnifiedAccount = {
          id: doc.id,
          source: 'fishbowl',
          fishbowlId: fb.id || fb.customerNum || doc.id,
          copperId: fb.copperId ? Number(fb.copperId) : undefined,
          
          // Core fields from Fishbowl
          name: fb.name || fb.customerContact || 'Unknown',
          accountNumber: fb.accountId || fb.accountNumber || fb.customerNum,
          website: fb.website,
          phone: fb.phone,
          email: fb.email,
          
          // Address
          shippingStreet: fb.shippingAddress,
          shippingCity: fb.shippingCity,
          shippingState: fb.shippingState,
          shippingZip: fb.shippingZip,
          
          // Classification
          accountType: parseAccountType(fb.accountType),
          region: fb.region,
          segment: fb.segment,
          customerPriority: fb.customerPriority,
          
          // Terms
          paymentTerms: fb.paymentTerms,
          shippingTerms: fb.shippingTerms,
          carrierName: fb.carrierName,
          
          // Sales
          salesPerson: fb.salesPerson || fb.fishbowlUsername,
          totalOrders: fb.totalOrders || 0,
          totalSpent: fb.totalSpent || 0,
          lastOrderDate: fb.lastOrderDate?.toDate?.() || undefined,
          firstOrderDate: fb.firstOrderDate?.toDate?.() || undefined,
          
          // Primary Contact (from Copper if available)
          primaryContactId: fb['Primary Contact ID']?.toString() || fb.primaryContactId?.toString(),
          primaryContactName: fb['Primary Contact'] || fb.primaryContactName,
          
          // Status
          status: determineAccountStatus(fb, undefined),
          isActiveCustomer: fb.isActiveCustomer,
          
          // Metadata
          createdAt: fb.createdAt?.toDate?.(),
          updatedAt: fb.updatedAt?.toDate?.(),
          notes: fb.notes,
        };
        
        accounts.push(account);
      });
      
      console.log(`Loaded ${accounts.length} accounts (page size: ${pageSize})`);
    } catch (error) {
      console.error('Error loading fishbowl_customers:', error);
    }
  }
  
  return {
    data: accounts,
    total: totalCount,
    hasMore: !searchTerm && accounts.length >= pageSize
  };
}

// Helper function to build account from Firestore data
function buildAccountFromFirestore(docId: string, fb: DocumentData): UnifiedAccount {
  return {
    id: docId,
    source: 'fishbowl',
    fishbowlId: fb.id || fb.customerNum || docId,
    copperId: fb.copperId ? Number(fb.copperId) : undefined,
    
    name: fb.name || fb.customerContact || 'Unknown',
    accountNumber: fb.accountId || fb.accountNumber || fb.customerNum,
    website: fb.website,
    phone: fb.phone,
    email: fb.email,
    
    shippingStreet: fb.shippingAddress,
    shippingCity: fb.shippingCity,
    shippingState: fb.shippingState,
    shippingZip: fb.shippingZip,
    
    accountType: parseAccountType(fb.accountType),
    region: fb.region,
    segment: fb.segment,
    customerPriority: fb.customerPriority,
    
    paymentTerms: fb.paymentTerms,
    shippingTerms: fb.shippingTerms,
    carrierName: fb.carrierName,
    
    salesPerson: fb.salesPerson || fb.fishbowlUsername,
    totalOrders: fb.totalOrders || 0,
    totalSpent: fb.totalSpent || 0,
    lastOrderDate: fb.lastOrderDate?.toDate?.() || undefined,
    firstOrderDate: fb.firstOrderDate?.toDate?.() || undefined,
    
    primaryContactId: fb['Primary Contact ID']?.toString() || fb.primaryContactId?.toString(),
    primaryContactName: fb['Primary Contact'] || fb.primaryContactName,
    
    status: determineAccountStatus(fb, undefined),
    isActiveCustomer: fb.isActiveCustomer,
    
    createdAt: fb.createdAt?.toDate?.(),
    updatedAt: fb.updatedAt?.toDate?.(),
    notes: fb.notes,
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
 * Load order history for an account
 */
export async function loadAccountOrders(accountId: string): Promise<OrderSummary[]> {
  const orders: OrderSummary[] = [];
  
  try {
    // First get the fishbowl customer to find the customer ID
    const accountDoc = await getDoc(doc(db, 'fishbowl_customers', accountId));
    if (!accountDoc.exists()) {
      console.log(`Account ${accountId} not found in fishbowl_customers`);
      return orders;
    }
    
    const accountData = accountDoc.data();
    const customerId = accountData.id || accountData.customerNum || accountData.accountId;
    
    if (!customerId) {
      console.log(`No customer ID found for account ${accountId}`);
      return orders;
    }
    
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
        total: parseFloat(data.totalAmount) || parseFloat(data.total) || 0,
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
 * Load sales summary for an account
 */
export async function loadAccountSalesSummary(accountId: string): Promise<any | null> {
  try {
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
