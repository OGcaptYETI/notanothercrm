import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

// Global progress tracker for customer sync operation
let syncProgress = {
  inProgress: false,
  currentStep: '',
  totalCompanies: 0,
  processedCompanies: 0,
  created: 0,
  updated: 0,
  noChanges: 0,
  errors: 0,
  status: 'idle' as 'idle' | 'loading' | 'analyzing' | 'syncing' | 'complete' | 'error',
  message: '',
};

interface SyncStats {
  dryRun: boolean;
  copperCompaniesLoaded: number;
  activeCompanies: number;
  fishbowlCustomersLoaded: number;
  usersLoaded: number;
  
  wouldCreate: number;
  wouldUpdate: number;
  noChanges: number;
  errors: number;
  
  changes: ChangeDetail[];
  errors_details: ErrorDetail[];
}

interface ChangeDetail {
  fishbowlCustomerId?: string;
  copperCompanyId: string;
  companyName: string;
  action: 'create' | 'update' | 'no_change';
  fieldsChanged: string[];
  before?: any;
  after?: any;
  concerns: string[];
}

interface ErrorDetail {
  copperCompanyId: string;
  companyName: string;
  error: string;
}

/**
 * Normalize account type from Copper to Commission Calculator format
 * Handles multiple Copper field formats:
 * - String: "Wholesale", "Distributor", "Retail"
 * - Array: ["Wholesale"], [2063862]
 * - Number: 2063862 (Copper option ID)
 * - MultiSelect object: { id: 2063862, name: "Wholesale" }
 */
function normalizeAccountType(copperType: any, companyName?: string, debug = false): string {
  if (!copperType) {
    if (debug) console.log(`   [${companyName}] No account type, defaulting to Retail`);
    return 'Retail';
  }
  
  // Handle array format (MultiSelect)
  if (Array.isArray(copperType)) {
    if (copperType.length === 0) {
      if (debug) console.log(`   [${companyName}] Empty array, defaulting to Retail`);
      return 'Retail';
    }
    
    // Take first item if array
    const firstItem = copperType[0];
    
    // If it's an object with name property
    if (typeof firstItem === 'object' && firstItem.name) {
      if (debug) console.log(`   [${companyName}] Array with object: ${firstItem.name}`);
      return normalizeAccountType(firstItem.name, companyName, false);
    }
    
    // If it's a number (option ID)
    if (typeof firstItem === 'number') {
      // Map Copper option IDs to types
      // 1981470 = Distributor, 2063862 = Wholesale, 2066840 = Retail
      const typeMap: Record<number, string> = {
        1981470: 'Distributor',
        2063862: 'Wholesale',
        2066840: 'Retail',
      };
      const mapped = typeMap[firstItem] || 'Retail';
      if (debug) console.log(`   [${companyName}] Array with ID ${firstItem} → ${mapped}`);
      return mapped;
    }
    
    // Otherwise treat as string
    if (debug) console.log(`   [${companyName}] Array with string: ${firstItem}`);
    return normalizeAccountType(firstItem, companyName, false);
  }
  
  // Handle number (option ID)
  if (typeof copperType === 'number') {
    const typeMap: Record<number, string> = {
      1981470: 'Distributor',
      2063862: 'Wholesale',
      2066840: 'Retail',
    };
    const mapped = typeMap[copperType] || 'Retail';
    if (debug) console.log(`   [${companyName}] Number ID ${copperType} → ${mapped}`);
    return mapped;
  }
  
  // Handle object format
  if (typeof copperType === 'object' && copperType.name) {
    if (debug) console.log(`   [${companyName}] Object with name: ${copperType.name}`);
    return normalizeAccountType(copperType.name, companyName, false);
  }
  
  // Handle string format
  const typeStr = String(copperType).toLowerCase().trim();
  
  if (debug) console.log(`   [${companyName}] Raw value: "${copperType}" → string: "${typeStr}"`);
  
  if (typeStr.includes('distributor') || typeStr.includes('distribution')) {
    return 'Distributor';
  }
  if (typeStr.includes('wholesale')) {
    return 'Wholesale';
  }
  
  if (debug) console.log(`   [${companyName}] No match, defaulting to Retail`);
  return 'Retail';
}

/**
 * Check if a company is active in Copper
 */
function isActiveCompany(copperData: any): boolean {
  const isActive = copperData['Active Customer cf_712751'];
  const activeValues = ['checked', 'true', 'Checked', true];
  return activeValues.includes(isActive);
}

/**
 * Extract and normalize address fields from Copper
 */
function extractAddress(copperData: any) {
  return {
    street: copperData['Street'] || copperData['street'] || '',
    city: copperData['city'] || copperData['City'] || '',
    state: copperData['State'] || copperData['state'] || '',
    zip: copperData['Postal Code'] || copperData['postal_code'] || copperData['zip'] || '',
    country: copperData['country'] || copperData['Country'] || '',
  };
}

/**
 * Compare two values and determine if they're different
 */
function hasChanged(oldVal: any, newVal: any): boolean {
  // Normalize empty values
  const old = oldVal === null || oldVal === undefined || oldVal === '' ? '' : String(oldVal).trim();
  const newV = newVal === null || newVal === undefined || newVal === '' ? '' : String(newVal).trim();
  
  return old !== newV;
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dryRun = searchParams.get('live') !== 'true';
  
  // Reset progress
  syncProgress = {
    inProgress: true,
    currentStep: 'Initializing',
    totalCompanies: 0,
    processedCompanies: 0,
    created: 0,
    updated: 0,
    noChanges: 0,
    errors: 0,
    status: 'loading',
    message: 'Starting customer sync...',
  };

  try {
    // Check if this is a live run or dry run
    const { searchParams } = new URL(request.url);
    const isLiveMode = searchParams.get('live') === 'true';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 CUSTOMER SYNC ${isLiveMode ? '🔴 LIVE MODE' : '🟢 DRY RUN'}`);
    console.log(`${'='.repeat(80)}\n`);

    const stats: SyncStats = {
      dryRun: !isLiveMode,
      copperCompaniesLoaded: 0,
      activeCompanies: 0,
      fishbowlCustomersLoaded: 0,
      usersLoaded: 0,
      wouldCreate: 0,
      wouldUpdate: 0,
      noChanges: 0,
      errors: 0,
      changes: [],
      errors_details: [],
    };

    // STEP 1: Load users with Copper IDs
    syncProgress.currentStep = 'Loading users';
    syncProgress.message = 'Loading users collection...';
    console.log('📂 Loading users collection...');
    const usersSnap = await adminDb.collection('users').get();
    const usersByCopperId = new Map<number, any>();
    
    usersSnap.forEach(doc => {
      const userData = doc.data();
      if (userData.copperUserId) {
        usersByCopperId.set(Number(userData.copperUserId), {
          id: doc.id,
          name: userData.name || '',
          salesPerson: userData.salesPerson || '',
          email: userData.email || userData.copperUserEmail || '',
          region: userData.region || '',
          title: userData.title || '',
        });
      }
    });
    
    stats.usersLoaded = usersByCopperId.size;
    console.log(`   ✅ Loaded ${stats.usersLoaded} users with Copper IDs`);

    // STEP 2: Load copper_companies
    syncProgress.currentStep = 'Loading Copper companies';
    syncProgress.message = 'Loading copper_companies collection...';
    console.log('\n📂 Loading copper_companies collection...');
    const copperSnap = await adminDb.collection('copper_companies').get();
    
    const activeCopperCompanies: any[] = [];
    copperSnap.forEach(doc => {
      const copperData = doc.data();
      
      // Filter: ACTIVE companies only
      if (isActiveCompany(copperData)) {
        activeCopperCompanies.push({
          id: doc.id,
          ...copperData,
        });
      }
    });
    
    stats.copperCompaniesLoaded = copperSnap.size;
    stats.activeCompanies = activeCopperCompanies.length;
    console.log(`   ✅ Loaded ${stats.copperCompaniesLoaded} companies (${stats.activeCompanies} active)`);

    // STEP 2.5: Build Copper indexes (prefer records with more data for duplicates)
    console.log('\n🔍 Building Copper company indexes (handling duplicates)...');
    const copperByAccountOrderId = new Map<string, any>();
    const copperByCopperId = new Map<string, any>();
    
    // Helper: Score a record's completeness (higher = more complete)
    function scoreCompleteness(company: any): number {
      let score = 0;
      if (company['Region cf_680701']) score += 10;
      if (company.Street) score += 5;
      if (company.city) score += 5;
      if (company.State) score += 5;
      if (company['Postal Code']) score += 3;
      if (company.assignee_id) score += 2;
      return score;
    }
    
    activeCopperCompanies.forEach(company => {
      const copperId = String(company.id);
      const accountOrderId = company['Account Order ID cf_698467'];
      
      // Always set by Copper ID (unique)
      copperByCopperId.set(copperId, company);
      
      // For Account Order ID, prefer the record with more data
      if (accountOrderId) {
        const key = String(accountOrderId).trim();
        const existing = copperByAccountOrderId.get(key);
        
        if (!existing) {
          copperByAccountOrderId.set(key, company);
        } else {
          // We have a duplicate! Choose the one with more data
          const existingScore = scoreCompleteness(existing);
          const newScore = scoreCompleteness(company);
          
          if (newScore > existingScore) {
            console.log(`   ⚠️ Duplicate Account Order ${key}: Preferring ${company.name} (score ${newScore}) over ${existing.name} (score ${existingScore})`);
            copperByAccountOrderId.set(key, company);
          }
        }
      }
    });
    
    console.log(`   ✅ Indexed ${copperByCopperId.size} by Copper ID`);
    console.log(`   ✅ Indexed ${copperByAccountOrderId.size} by Account Order ID (duplicates resolved)\n`);

    // STEP 3: Load fishbowl_customers (current state)
    syncProgress.currentStep = 'Loading Fishbowl customers';
    syncProgress.message = 'Loading fishbowl_customers collection...';
    console.log('\n📂 Loading fishbowl_customers collection...');
    const fishbowlSnap = await adminDb.collection('fishbowl_customers').get();
    
    // Build index for matching
    // KEY: fishbowl_customers.id (doc.id) = Copper Account Order ID
    const fishbowlById = new Map<string, any>();
    
    fishbowlSnap.forEach(doc => {
      const data: any = { firestoreDocId: doc.id, ...doc.data() };
      // Index by the Firestore document ID (e.g., "1037")
      fishbowlById.set(String(doc.id).trim(), data);
    });
    
    stats.fishbowlCustomersLoaded = fishbowlSnap.size;
    console.log(`   ✅ Loaded ${stats.fishbowlCustomersLoaded} fishbowl customers`);

    // STEP 4: Analyze and sync
    syncProgress.currentStep = 'Analyzing companies';
    syncProgress.totalCompanies = copperByAccountOrderId.size;
    syncProgress.status = 'analyzing';
    syncProgress.message = `Analyzing ${copperByAccountOrderId.size} active Copper companies...`;
    console.log(`\n🔍 Analyzing ${copperByAccountOrderId.size} unique active Copper companies (duplicates resolved)...\n`);
    
    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 450;
    let processedCount = 0;

    for (const copperCompany of Array.from(copperByAccountOrderId.values())) {
      try {
        const copperName = copperCompany.name || '';
        const copperAccountOrderId = copperCompany['Account Order ID cf_698467'] || '';
        const copperAccountType = copperCompany['Account Type cf_675914'] || '';
        const copperAccountId = copperCompany['Account ID cf_713477'] || '';
        const copperRegion = copperCompany['Region cf_680701'] || '';
        const copperAssigneeId = copperCompany.assignee_id;
        
        // Debug logging for first 20 companies to diagnose Account Type format
        const enableDebug = processedCount < 20;
        if (enableDebug) {
          console.log(`\n🔍 DEBUG #${processedCount + 1}: ${copperName}`);
          console.log(`   Raw Account Type field:`, copperAccountType);
          console.log(`   Type: ${typeof copperAccountType}`);
          if (Array.isArray(copperAccountType)) {
            console.log(`   Array length: ${copperAccountType.length}`);
            console.log(`   Array contents:`, copperAccountType);
          }
        }
        
        processedCount++;
        
        const address = extractAddress(copperCompany);
        
        // Map Copper assignee to sales rep
        let salesRepData = null;
        if (copperAssigneeId && usersByCopperId.has(Number(copperAssigneeId))) {
          salesRepData = usersByCopperId.get(Number(copperAssigneeId));
        }

        // Find matching fishbowl_customer
        // Match: fishbowl_customers.id = Copper Account Order ID
        let existingCustomer = null;
        let matchMethod = '';
        
        if (copperAccountOrderId && fishbowlById.has(String(copperAccountOrderId).trim())) {
          existingCustomer = fishbowlById.get(String(copperAccountOrderId).trim());
          matchMethod = 'accountOrderId';
        }

        // Build the new customer data from Copper
        // MERGE STRATEGY: Only update fields that have values in Copper
        const newCustomerData: any = {
          copperId: copperCompany.id,
          accountTypeSource: 'copper_companies',
          syncedFromCopperAt: Timestamp.now(),
        };
        
        // Only update if Copper has a value (don't overwrite with empty strings)
        if (copperName) newCustomerData.name = copperName;
        if (copperAccountOrderId) newCustomerData.accountNumber = copperAccountOrderId;
        // CRITICAL: Convert to string and strip commas - Copper may store as number with formatting
        if (copperAccountId) newCustomerData.accountId = String(copperAccountId).replace(/,/g, '');
        if (copperRegion) newCustomerData.region = copperRegion;
        
        // Account Type: Always set if Copper has data, or if creating new customer
        if (copperAccountType || !existingCustomer) {
          newCustomerData.accountType = normalizeAccountType(copperAccountType, copperName, enableDebug);
        }
        
        // Address fields: Only update if Copper has values
        if (address.street) {
          newCustomerData.billingAddress = address.street;
          newCustomerData.shippingAddress = address.street;
        }
        if (address.city) {
          newCustomerData.billingCity = address.city;
          newCustomerData.shippingCity = address.city;
        }
        if (address.state) {
          newCustomerData.billingState = address.state;
          newCustomerData.shippingState = address.state;
        }
        if (address.zip) {
          newCustomerData.billingZip = address.zip;
          newCustomerData.shipToZip = address.zip;
        }
        if (address.country) {
          newCustomerData.shippingCountry = address.country;
        }

        // Add sales rep data if available
        if (salesRepData) {
          newCustomerData.salesPerson = salesRepData.salesPerson;
          newCustomerData.salesRepName = salesRepData.name;
          newCustomerData.salesRepEmail = salesRepData.email;
          newCustomerData.salesRepRegion = salesRepData.region;
        }

        // Determine action: create or update
        if (!existingCustomer) {
          // NO MATCH FOUND - CREATE NEW CUSTOMER
          // If they have an Order ID, they ARE a Fishbowl customer
          if (copperAccountOrderId) {
            stats.wouldCreate++;
            
            // Create complete customer record
            const newCustomerRecord = {
              ...newCustomerData,
              source: 'copper_sync',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };
            
            stats.changes.push({
              copperCompanyId: copperCompany.id,
              companyName: copperName,
              action: 'create',
              fieldsChanged: Object.keys(newCustomerRecord),
              after: newCustomerRecord,
              concerns: [
                '✅ Creating new fishbowl_customer from Copper data',
                `Account Order ID: ${copperAccountOrderId}`,
                `Account Type: ${newCustomerData.accountType}`,
              ],
            });
            
            if (!dryRun) {
              // Use Account Order ID as the Firestore document ID
              const customerRef = adminDb.collection('fishbowl_customers').doc(String(copperAccountOrderId));
              batch.set(customerRef, newCustomerRecord);
              batchCount++;
            }
            
            // Log creation for first 10 companies
            if (stats.wouldCreate <= 10) {
              console.log(`✅ CREATING: ${copperName} - Account Order ID: ${copperAccountOrderId}, Type: ${newCustomerData.accountType}`);
            }
          } else {
            // No Order ID - truly not a Fishbowl customer yet
            stats.changes.push({
              copperCompanyId: copperCompany.id,
              companyName: copperName,
              action: 'no_change',
              fieldsChanged: [],
              after: {},
              concerns: [
                '⚠️ No Account Order ID - not a Fishbowl customer yet',
                'SKIPPED - Cannot create without Order ID',
              ],
            });
          }
        } else {
          // EXISTING CUSTOMER - check what would change
          const fieldsChanged: string[] = [];
          const before: any = {};
          const after: any = {};
          const concerns: string[] = [];

          // Compare each field
          for (const [key, newValue] of Object.entries(newCustomerData)) {
            if (key === 'syncedFromCopperAt') continue; // Always updates
            
            const oldValue = existingCustomer[key];
            
            if (hasChanged(oldValue, newValue)) {
              fieldsChanged.push(key);
              before[key] = oldValue;
              after[key] = newValue;
              
              // Flag critical changes
              if (key === 'accountType') {
                concerns.push(`⚠️ Account Type changing: "${oldValue}" → "${newValue}"`);
              }
            }
          }

          // Check if we're preserving critical fields
          const preservedFields = ['transferStatus', 'originalOwner', 'fishbowlUsername'];
          const hasPreservedData = preservedFields.some(field => existingCustomer[field]);
          
          if (hasPreservedData) {
            concerns.push(`✅ Preserving: ${preservedFields.filter(f => existingCustomer[f]).join(', ')}`);
          }
          
          // Warn if Account Type is not being updated because Copper has no value
          if (!copperAccountType && existingCustomer.accountType) {
            concerns.push(`ℹ️ Account Type not synced (Copper field is empty, keeping existing: "${existingCustomer.accountType}")`);
          }
          
          // Warn if address fields are missing in Copper
          if (!address.street && existingCustomer.billingAddress) {
            concerns.push(`ℹ️ Address not synced (Copper has no address data)`);
          }

          if (fieldsChanged.length === 0) {
            stats.noChanges++;
          } else {
            stats.wouldUpdate++;
            
            stats.changes.push({
              fishbowlCustomerId: existingCustomer.id,
              copperCompanyId: copperCompany.id,
              companyName: copperName,
              action: 'update',
              fieldsChanged,
              before,
              after,
              concerns,
            });

            if (!dryRun) {
              const updateData = { ...newCustomerData };
              
              // PRESERVE commission-specific fields
              if (existingCustomer.transferStatus !== undefined) {
                delete updateData.transferStatus;
              }
              if (existingCustomer.originalOwner !== undefined) {
                delete updateData.originalOwner;
              }
              if (existingCustomer.fishbowlUsername !== undefined) {
                delete updateData.fishbowlUsername;
              }
              
              updateData.updatedAt = Timestamp.now();

              // Use the Firestore document ID for updates
              const customerRef = adminDb.collection('fishbowl_customers').doc(existingCustomer.firestoreDocId);
              batch.update(customerRef, updateData);
              batchCount++;
            }
          }
        }

        // Commit batch if needed
        if (!dryRun && batchCount >= BATCH_SIZE) {
          syncProgress.status = 'syncing';
          syncProgress.message = `Committing ${batchCount} changes to database...`;
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} updates`);
          batch = adminDb.batch();
          batchCount = 0;
        }

        syncProgress.processedCompanies++;
        syncProgress.message = `Analyzing: ${syncProgress.processedCompanies} / ${syncProgress.totalCompanies}`;

      } catch (error: any) {
        stats.errors++;
        stats.errors_details.push({
          copperCompanyId: String(copperCompany.id),
          companyName: copperCompany.name || 'Unknown',
          error: error.message,
        });
        
        syncProgress.processedCompanies++;
        syncProgress.errors++;
        syncProgress.message = `Processing: ${syncProgress.processedCompanies} / ${syncProgress.totalCompanies} (${syncProgress.errors} errors)`;
      }
    }

    // Commit final batch
    if (!dryRun && batchCount > 0) {
      syncProgress.status = 'syncing';
      syncProgress.message = `Committing ${batchCount} changes to database...`;
      await batch.commit();
      console.log(`   ✅ Committed final batch of ${batchCount} updates\n`);
    }
    
    // Mark as complete
    syncProgress.status = 'complete';
    syncProgress.inProgress = false;
    syncProgress.created = stats.wouldCreate;
    syncProgress.updated = stats.wouldUpdate;
    syncProgress.noChanges = stats.noChanges;
    syncProgress.message = `Sync complete: ${stats.wouldCreate} created, ${stats.wouldUpdate} updated`;

    // STEP 5: Generate report
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SYNC REPORT ${isLiveMode ? '(LIVE)' : '(DRY RUN)'}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Copper Companies (Active):  ${stats.activeCompanies}`);
    console.log(`Fishbowl Customers:         ${stats.fishbowlCustomersLoaded}`);
    console.log(`Users Mapped:               ${stats.usersLoaded}`);
    console.log('');
    console.log(`${isLiveMode ? 'Created' : 'Would Create'}:            ${stats.wouldCreate}`);
    console.log(`${isLiveMode ? 'Updated' : 'Would Update'}:            ${stats.wouldUpdate}`);
    console.log(`No Changes:                 ${stats.noChanges}`);
    console.log(`Errors:                     ${stats.errors}`);
    console.log(`${'='.repeat(80)}\n`);

    // Show sample changes
    if (stats.changes.length > 0) {
      console.log(`\n📝 Sample Changes (first 10):`);
      stats.changes.slice(0, 10).forEach((change, idx) => {
        console.log(`\n${idx + 1}. ${change.companyName} (${change.action})`);
        if (change.action === 'update') {
          console.log(`   Changed: ${change.fieldsChanged.join(', ')}`);
          if (change.concerns.length > 0) {
            change.concerns.forEach(c => console.log(`   ${c}`));
          }
        }
      });
    }

    return NextResponse.json(stats);

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    syncProgress.status = 'error';
    syncProgress.inProgress = false;
    syncProgress.message = `Error: ${error.message}`;
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync progress
export async function GET(request: NextRequest) {
  return NextResponse.json(syncProgress);
}
