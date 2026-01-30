import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// US State name to abbreviation mapping
const STATE_MAPPINGS: { [key: string]: string } = {
  // Full names (case-insensitive)
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
  
  // Common variations
  'wash': 'WA', 'washington state': 'WA', 'wash.': 'WA',
  'calif': 'CA', 'calif.': 'CA', 'cali': 'CA',
  'penn': 'PA', 'penna': 'PA', 'penn.': 'PA',
  'mass': 'MA', 'mass.': 'MA',
  'conn': 'CT', 'conn.': 'CT',
  'fla': 'FL', 'fla.': 'FL',
  'mich': 'MI', 'mich.': 'MI',
  'ill': 'IL', 'ill.': 'IL',
  'wis': 'WI', 'wisc': 'WI', 'wis.': 'WI',
  'ore': 'OR', 'oreg': 'OR', 'ore.': 'OR',
  'dc': 'DC', 'd.c.': 'DC', 'wash dc': 'DC', 'washington dc': 'DC'
};

// Valid 2-character state codes
const VALID_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC'
]);

/**
 * Normalize state name to 2-character abbreviation
 */
function normalizeState(rawState: string | null | undefined): string | null {
  if (!rawState) return null;
  
  const state = String(rawState).trim();
  if (!state) return null;
  
  // Already a valid 2-character code
  const upperState = state.toUpperCase();
  if (VALID_STATE_CODES.has(upperState)) {
    return upperState;
  }
  
  // Try to map from full name
  const lowerState = state.toLowerCase();
  const mapped = STATE_MAPPINGS[lowerState];
  if (mapped) {
    return mapped;
  }
  
  // Unknown - return as-is (will be flagged in results)
  return state;
}

interface NormalizationResult {
  customerId: string;
  customerName: string;
  oldShippingState: string | null;
  newShippingState: string | null;
  oldBillingState: string | null;
  newBillingState: string | null;
  action: 'normalized' | 'already_correct' | 'unknown_state' | 'empty';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 STATE DATA NORMALIZATION ${dryRun ? '🟢 DRY RUN' : '🔴 LIVE MODE'}`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Load all fishbowl_customers
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    console.log(`📂 Loaded ${customersSnapshot.size} customers from Firestore`);
    
    const results: NormalizationResult[] = [];
    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    
    let stats = {
      total: 0,
      normalized: 0,
      alreadyCorrect: 0,
      unknownStates: 0,
      empty: 0,
      errors: 0
    };
    
    for (const doc of customersSnapshot.docs) {
      stats.total++;
      const data = doc.data();
      
      const oldShippingState = data.shippingState || null;
      const oldBillingState = data.billingState || null;
      
      const newShippingState = normalizeState(oldShippingState);
      const newBillingState = normalizeState(oldBillingState);
      
      // Determine action
      let action: 'normalized' | 'already_correct' | 'unknown_state' | 'empty' = 'already_correct';
      
      if (!oldShippingState && !oldBillingState) {
        action = 'empty';
        stats.empty++;
      } else if (newShippingState !== oldShippingState || newBillingState !== oldBillingState) {
        // Check if we successfully mapped it
        const shippingUnknown = oldShippingState && newShippingState && !VALID_STATE_CODES.has(newShippingState);
        const billingUnknown = oldBillingState && newBillingState && !VALID_STATE_CODES.has(newBillingState);
        
        if (shippingUnknown || billingUnknown) {
          action = 'unknown_state';
          stats.unknownStates++;
        } else {
          action = 'normalized';
          stats.normalized++;
          
          // Update Firestore if not dry run
          if (!dryRun) {
            const updates: any = {
              updatedAt: Timestamp.now(),
              stateNormalizedAt: Timestamp.now()
            };
            
            if (newShippingState !== oldShippingState) {
              updates.shippingState = newShippingState;
            }
            if (newBillingState !== oldBillingState) {
              updates.billingState = newBillingState;
            }
            
            batch.update(doc.ref, updates);
            batchCount++;
            
            // Commit batch if needed
            if (batchCount >= BATCH_SIZE) {
              await batch.commit();
              console.log(`✅ Committed batch of ${batchCount} updates`);
              batch = adminDb.batch();
              batchCount = 0;
            }
          }
        }
      } else {
        stats.alreadyCorrect++;
      }
      
      // Store result if changed or unknown
      if (action === 'normalized' || action === 'unknown_state') {
        results.push({
          customerId: doc.id,
          customerName: data.name || data.customerName || 'Unknown',
          oldShippingState,
          newShippingState,
          oldBillingState,
          newBillingState,
          action
        });
      }
    }
    
    // Commit final batch
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }
    
    console.log('\n📊 NORMALIZATION STATS:');
    console.log(`   Total Customers: ${stats.total}`);
    console.log(`   ✅ Normalized: ${stats.normalized}`);
    console.log(`   ✓ Already Correct: ${stats.alreadyCorrect}`);
    console.log(`   ⚠️ Unknown States: ${stats.unknownStates}`);
    console.log(`   ∅ Empty States: ${stats.empty}`);
    console.log(`   ❌ Errors: ${stats.errors}\n`);
    
    return NextResponse.json({
      success: true,
      dryRun,
      stats,
      results: results.slice(0, 100), // Limit results to first 100 for performance
      message: dryRun 
        ? `Preview: Would normalize ${stats.normalized} customers` 
        : `Normalized ${stats.normalized} customers successfully`
    });
    
  } catch (error: any) {
    console.error('State normalization error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
