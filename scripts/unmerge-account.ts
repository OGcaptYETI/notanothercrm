/**
 * Script to unmerge accounts
 * Usage: Run this in Firebase console or via Node.js
 */

import { adminDb } from '@/lib/firebase/admin';

async function unmergeAccount(secondaryAccountId: string) {
  try {
    console.log(`Unmerging account: ${secondaryAccountId}`);
    
    // 1. Get the archived account
    const accountRef = adminDb.collection('copper_companies').doc(secondaryAccountId);
    const accountDoc = await accountRef.get();
    
    if (!accountDoc.exists) {
      console.error('Account not found');
      return;
    }
    
    const accountData = accountDoc.data();
    
    if (!accountData?.isArchived) {
      console.log('Account is not archived - nothing to unmerge');
      return;
    }
    
    console.log('Account data:', {
      name: accountData.name,
      mergedInto: accountData.mergedInto,
      archivedAt: accountData.archivedAt,
    });
    
    // 2. Reactivate the account
    await accountRef.update({
      cf_712751: true, // Active Customer flag
      isArchived: false,
      mergedInto: null,
      archivedAt: null,
      archivedBy: null,
      unmergedAt: new Date(),
    });
    
    console.log('✅ Account reactivated successfully!');
    console.log('The account is now active again and will appear in the accounts list.');
    
  } catch (error) {
    console.error('Error unmerging account:', error);
  }
}

// Run the unmerge for #1 Tobacco (ID: 70961229)
unmergeAccount('70961229');
