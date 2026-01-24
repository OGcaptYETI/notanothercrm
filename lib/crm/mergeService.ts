/**
 * Account Merge Service
 * Handles merging duplicate accounts in copper_companies collection
 */

import { db } from '@/lib/firebase/config';
import { 
  doc, 
  updateDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  arrayUnion,
  Timestamp 
} from 'firebase/firestore';
import type { UnifiedAccount } from './dataService';

export interface MergeConflict {
  fieldName: string;
  fieldLabel: string;
  primaryValue: any;
  secondaryValue: any;
  isDifferent: boolean;
  autoResolve?: 'primary' | 'secondary' | 'merge';
}

export interface MergeResolution {
  fieldName: string;
  chosenValue: any;
  source: 'primary' | 'secondary';
  rejectedValue: any;
}

export interface AccountMergeAudit {
  id?: string;
  primaryAccountId: string;
  secondaryAccountId: string;
  mergedAt: Date;
  mergedBy: string;
  
  // Snapshot of secondary account before merge
  secondaryAccountSnapshot: any;
  
  // Field resolution choices
  resolvedFields: MergeResolution[];
  
  // Related records migrated
  migratedRecords: {
    contacts: string[];
    deals: string[];
  };
  
  // Status
  status: 'completed' | 'failed' | 'rolled_back';
  canUndo: boolean;
}

/**
 * Detect conflicts between two accounts
 */
export function detectMergeConflicts(
  primary: UnifiedAccount,
  secondary: UnifiedAccount
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  
  // Define fields to check for conflicts
  const fieldsToCheck: { key: keyof UnifiedAccount; label: string; autoResolve?: 'primary' | 'secondary' | 'merge' }[] = [
    { key: 'name', label: 'Account Name' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'website', label: 'Website' },
    { key: 'shippingStreet', label: 'Street Address' },
    { key: 'shippingCity', label: 'City' },
    { key: 'shippingState', label: 'State' },
    { key: 'shippingZip', label: 'Zip Code' },
    { key: 'region', label: 'Region' },
    { key: 'segment', label: 'Segment' },
    { key: 'accountType', label: 'Account Type' },
    { key: 'customerPriority', label: 'Customer Priority' },
    { key: 'paymentTerms', label: 'Payment Terms' },
    { key: 'shippingTerms', label: 'Shipping Terms' },
    { key: 'carrierName', label: 'Carrier' },
    { key: 'salesPerson', label: 'Sales Person' },
    { key: 'accountOrderId', label: 'Account Order ID' },
    { key: 'copperId', label: 'Copper ID', autoResolve: 'primary' },
    { key: 'totalOrders', label: 'Total Orders', autoResolve: 'merge' },
    { key: 'totalSpent', label: 'Total Spent', autoResolve: 'merge' },
  ];
  
  for (const field of fieldsToCheck) {
    const primaryValue = primary[field.key];
    const secondaryValue = secondary[field.key];
    
    // Check if values are different
    const isDifferent = !valuesEqual(primaryValue, secondaryValue);
    
    conflicts.push({
      fieldName: field.key as string,
      fieldLabel: field.label,
      primaryValue,
      secondaryValue,
      isDifferent,
      autoResolve: field.autoResolve,
    });
  }
  
  return conflicts;
}

/**
 * Compare two values for equality
 */
function valuesEqual(a: any, b: any): boolean {
  // Handle null/undefined
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => valuesEqual(val, b[idx]));
  }
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  
  // Simple comparison
  return a === b;
}

/**
 * Execute account merge (supports multiple secondary accounts)
 */
export async function mergeAccounts(
  primaryId: string,
  secondaryIds: string | string[],
  resolutions: MergeResolution[],
  userId: string
): Promise<{ success: boolean; error?: string; auditId?: string }> {
  try {
    // Normalize secondaryIds to array
    const secondaryIdArray = Array.isArray(secondaryIds) ? secondaryIds : [secondaryIds];
    
    // 1. Get primary account
    const primaryDoc = await getDoc(doc(db, 'copper_companies', primaryId));
    if (!primaryDoc.exists()) {
      return { success: false, error: 'Primary account not found' };
    }
    
    // 2. Get all secondary accounts
    const secondaryDocs = await Promise.all(
      secondaryIdArray.map(id => getDoc(doc(db, 'copper_companies', id)))
    );
    
    // Check all exist
    const missingAccounts = secondaryDocs.filter(doc => !doc.exists());
    if (missingAccounts.length > 0) {
      return { success: false, error: `${missingAccounts.length} secondary account(s) not found` };
    }
    
    // 3. Build merged data from resolutions
    const mergedData: any = {
      updatedAt: new Date(),
      mergedFrom: arrayUnion(...secondaryIdArray),
    };
    
    // Map UnifiedAccount field names to Copper field names
    const fieldMapping: Record<string, string> = {
      'totalOrders': 'cf_698403',
      'totalSpent': 'cf_698404',
      'accountOrderId': 'cf_698467',
      'accountType': 'cf_675914',
      'region': 'cf_680701',
      'segment': 'cf_680702',
      'customerPriority': 'cf_698396',
      'paymentTerms': 'cf_698397',
      'shippingTerms': 'cf_698398',
      'carrierName': 'cf_698399',
      'lastOrderDate': 'cf_698406',
      'firstOrderDate': 'cf_698405',
    };
    
    // Apply each resolution (filter out undefined values)
    for (const resolution of resolutions) {
      if (resolution.chosenValue !== undefined) {
        // Use mapped field name if it exists, otherwise use original
        const fieldName = fieldMapping[resolution.fieldName] || resolution.fieldName;
        mergedData[fieldName] = resolution.chosenValue;
      }
    }
    
    // 4. Migrate related records from ALL secondary accounts
    const allMigratedRecords = { contacts: [] as string[], deals: [] as string[] };
    
    for (let i = 0; i < secondaryIdArray.length; i++) {
      const secondaryId = secondaryIdArray[i];
      const secondaryData = secondaryDocs[i].data();
      
      const migratedRecords = await migrateRelatedRecords(
        primaryId,
        secondaryId,
        primaryDoc.data()?.copperId,
        secondaryData?.copperId
      );
      
      allMigratedRecords.contacts.push(...migratedRecords.contacts);
      allMigratedRecords.deals.push(...migratedRecords.deals);
    }
    
    // 5. Update primary account
    await updateDoc(doc(db, 'copper_companies', primaryId), mergedData);
    
    // 6. Archive ALL secondary accounts
    await Promise.all(
      secondaryIdArray.map(secondaryId =>
        updateDoc(doc(db, 'copper_companies', secondaryId), {
          cf_712751: false, // Remove from active list
          mergedInto: primaryId,
          isArchived: true,
          archivedAt: new Date(),
          archivedBy: userId,
        })
      )
    );
    
    // Helper function to deeply remove undefined values
    const cleanObject = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return null;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => cleanObject(item)).filter(item => item !== undefined);
      }
      
      if (typeof obj === 'object' && !(obj instanceof Date)) {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            const cleanedValue = cleanObject(value);
            if (cleanedValue !== undefined) {
              cleaned[key] = cleanedValue;
            }
          }
        }
        return cleaned;
      }
      
      return obj;
    };
    
    // 7. Create audit log for each merge (deeply clean all undefined values)
    const auditLogs = secondaryIdArray.map((secondaryId, index) => {
      const log = {
        primaryAccountId: primaryId,
        secondaryAccountId: secondaryId,
        mergedAt: new Date(),
        mergedBy: userId,
        secondaryAccountSnapshot: cleanObject(secondaryDocs[index].data() || {}),
        resolvedFields: resolutions
          .filter(r => r.chosenValue !== undefined)
          .map(r => cleanObject(r)),
        migratedRecords: cleanObject(allMigratedRecords),
        status: 'completed' as const,
        canUndo: true,
        batchMerge: secondaryIdArray.length > 1,
        batchSize: secondaryIdArray.length,
      };
      
      return cleanObject(log);
    });
    
    const auditRefs = await Promise.all(
      auditLogs.map(log => addDoc(collection(db, 'account_merges'), log))
    );
    
    return { success: true, auditId: auditRefs[0].id };
  } catch (error) {
    console.error('Error merging accounts:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Migrate contacts and deals from secondary to primary account
 */
async function migrateRelatedRecords(
  primaryAccountId: string,
  secondaryAccountId: string,
  primaryCopperId: number,
  secondaryCopperId: number
): Promise<{ contacts: string[]; deals: string[] }> {
  const migratedContacts: string[] = [];
  const migratedDeals: string[] = [];
  
  try {
    // Skip migration if copperId values are missing
    if (!primaryCopperId || !secondaryCopperId) {
      console.log('Skipping related records migration - missing Copper IDs');
      return { contacts: migratedContacts, deals: migratedDeals };
    }
    
    // Migrate contacts (update companyId)
    const contactsQuery = query(
      collection(db, 'copper_people'),
      where('companyId', '==', secondaryCopperId)
    );
    
    const contactsSnapshot = await getDocs(contactsQuery);
    
    for (const contactDoc of contactsSnapshot.docs) {
      await updateDoc(doc(db, 'copper_people', contactDoc.id), {
        companyId: primaryCopperId,
        'Company Id': primaryCopperId,
        updatedAt: new Date(),
      });
      migratedContacts.push(contactDoc.id);
    }
    
    // Migrate deals (update company_id)
    const dealsQuery = query(
      collection(db, 'copper_opportunities'),
      where('company_id', '==', secondaryCopperId)
    );
    
    const dealsSnapshot = await getDocs(dealsQuery);
    
    for (const dealDoc of dealsSnapshot.docs) {
      await updateDoc(doc(db, 'copper_opportunities', dealDoc.id), {
        company_id: primaryCopperId,
        'Primary Company Id': primaryCopperId,
        updatedAt: new Date(),
      });
      migratedDeals.push(dealDoc.id);
    }
    
    console.log(`Migrated ${migratedContacts.length} contacts and ${migratedDeals.length} deals`);
  } catch (error) {
    console.error('Error migrating related records:', error);
  }
  
  return { contacts: migratedContacts, deals: migratedDeals };
}

/**
 * Get merge audit history for an account
 */
export async function getMergeHistory(accountId: string): Promise<AccountMergeAudit[]> {
  try {
    const q = query(
      collection(db, 'account_merges'),
      where('primaryAccountId', '==', accountId)
    );
    
    const snapshot = await getDocs(q);
    const history: AccountMergeAudit[] = [];
    
    snapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data() as Omit<AccountMergeAudit, 'id'>
      });
    });
    
    return history;
  } catch (error) {
    console.error('Error getting merge history:', error);
    return [];
  }
}
