export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
export type PricingMode = 'distribution' | 'wholesale';
export type PaymentMethod = 'wire' | 'check' | 'creditCard';

export interface QuoteProduct {
  id: string;
  productId: string;
  name: string;
  category: string;
  unitsPerCase: number;
  price: number; // Distribution price
  msrp: number; // Retail price
  image?: string;
  parentSku?: string;
  variantType?: string;
}

export interface QuoteLineItem {
  id: string;
  productId: string;
  product: QuoteProduct;
  masterCases: number;
  displayBoxes: number;
  unitPrice: number; // Actual price used (after tier/mode)
  lineTotal: number;
  notes?: string;
}

export interface QuoteTier {
  id: string;
  name: string;
  threshold: number; // Minimum cases
  discountPercent: number;
  margin?: number;
}

export interface QuoteShipping {
  zone: string;
  zoneName: string;
  state: string;
  ltlPercent: number;
  groundRates?: Record<number, number>; // cases -> rate
  calculatedAmount: number;
  manualOverride?: number;
}

export interface QuoteCustomer {
  // Source identification
  source: 'fishbowl' | 'copper' | 'manual';
  fishbowlId?: string;
  copperId?: string;
  
  // Basic info
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  
  // Address
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  
  // Business info
  accountType?: 'Distributor' | 'Wholesale' | 'Retail';
  salesPerson?: string;
  salesRepName?: string;
  region?: string;
  
  // Status
  isActive?: boolean;
  accountNumber?: string;
}

export interface QuoteCalculation {
  subtotal: number;
  shipping: number;
  creditCardFee: number;
  total: number;
  totalCases: number;
  appliedTier?: QuoteTier;
}

export interface Quote {
  id: string;
  quoteNumber: string; // Auto-generated (e.g., Q-2025-001)
  
  // Status & Metadata
  status: QuoteStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  sentAt?: Date;
  viewedAt?: Date;
  
  // Customer
  customer: QuoteCustomer;
  
  // Quote Details
  quoteName: string;
  pricingMode: PricingMode;
  paymentMethod: PaymentMethod;
  
  // Line Items
  lineItems: QuoteLineItem[];
  
  // Calculations
  calculation: QuoteCalculation;
  shipping: QuoteShipping;
  
  // Notes & Attachments
  internalNotes?: string;
  customerNotes?: string;
  attachments?: string[]; // URLs to PDFs, etc.
  
  // Integration
  copperOpportunityId?: string;
  pipelineLeadId?: string;
  emailTemplateUsed?: string;
  
  // Tracking
  createdBy: string; // User ID
  createdByEmail: string;
  assignedTo?: string; // Sales rep user ID
  
  // History
  previousVersionId?: string;
  revisionReason?: string;
}

export interface QuoteSummary {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  customer: {
    companyName: string;
    email?: string;
  };
  total: number;
  createdAt: Date;
  sentAt?: Date;
  createdBy: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description?: string;
  lineItems: Omit<QuoteLineItem, 'id' | 'lineTotal'>[];
  pricingMode: PricingMode;
  createdBy: string;
  createdAt: Date;
}

export interface QuoteEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'initial' | 'followup' | 'negotiation' | 'closing';
}

export interface QuoteActivity {
  id: string;
  quoteId: string;
  type: 'created' | 'updated' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'revised' | 'deleted';
  description: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
