import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * Protected Fields Configuration
 * These fields are used throughout the application and should not be modified
 * without careful consideration and code updates
 */
interface ProtectedField {
  copperFieldId: string;
  copperFieldName: string;
  ourFieldName: string;
  usedIn: string[];
  critical: boolean;
  description: string;
}

const PROTECTED_FIELDS: ProtectedField[] = [
  {
    copperFieldId: 'cf_675914',
    copperFieldName: 'Account Type',
    ourFieldName: 'accountType',
    usedIn: [
      'Commission Calculations',
      'Customer Filtering',
      'Order Processing',
      'Sales Rep Assignment',
    ],
    critical: true,
    description: 'Determines customer type (Wholesale/Distributor/Retail) - used extensively in commission logic',
  },
  {
    copperFieldId: 'cf_698467',
    copperFieldName: 'Account Order ID',
    ourFieldName: 'fishbowlCustomerId',
    usedIn: [
      'Fishbowl Integration',
      'Order Matching',
      'Customer Sync',
    ],
    critical: true,
    description: 'Links Copper customers to Fishbowl - critical for order processing',
  },
  {
    copperFieldId: 'cf_713477',
    copperFieldName: 'Account ID',
    ourFieldName: 'accountId',
    usedIn: [
      'Customer Identification',
      'Data Sync',
    ],
    critical: false,
    description: 'Secondary customer identifier',
  },
  {
    copperFieldId: 'cf_680701',
    copperFieldName: 'Region',
    ourFieldName: 'region',
    usedIn: [
      'Sales Rep Assignment',
      'Regional Reporting',
      'Territory Management',
    ],
    critical: true,
    description: 'Geographic region assignment - affects sales rep routing',
  },
  {
    copperFieldId: 'cf_708027',
    copperFieldName: 'Sales Rep',
    ourFieldName: 'salesPerson',
    usedIn: [
      'Commission Calculations',
      'Sales Rep Dashboard',
      'Customer Assignment',
    ],
    critical: true,
    description: 'Primary sales rep assignment - critical for commissions',
  },
  {
    copperFieldId: 'cf_712751',
    copperFieldName: 'Active Customer',
    ourFieldName: 'activeCustomer',
    usedIn: [
      'Customer Filtering',
      'Data Sync',
    ],
    critical: false,
    description: 'Indicates if customer is active',
  },
];

/**
 * GET: Retrieve protected fields configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Get current field mappings
    const mappingsDoc = await adminDb
      .collection('system_config')
      .doc('copper_field_mappings')
      .get();

    const currentMappings = mappingsDoc.exists ? mappingsDoc.data()?.mappings || [] : [];

    // Check which protected fields are currently mapped
    const protectedFieldsStatus = PROTECTED_FIELDS.map(field => {
      const currentMapping = currentMappings.find((m: any) => m.copperField === field.copperFieldId);
      return {
        ...field,
        currentlyMapped: !!currentMapping,
        currentMapping: currentMapping || null,
        mappingChanged: currentMapping && currentMapping.ourField !== field.ourFieldName,
      };
    });

    return NextResponse.json({
      success: true,
      protectedFields: protectedFieldsStatus,
      totalProtected: PROTECTED_FIELDS.length,
      criticalCount: PROTECTED_FIELDS.filter(f => f.critical).length,
    });

  } catch (error: any) {
    console.error('❌ Error fetching protected fields:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST: Validate field mapping changes against protected fields
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'Mappings must be an array' },
        { status: 400 }
      );
    }

    // Check for conflicts with protected fields
    const conflicts: Array<{
      field: ProtectedField;
      issue: string;
      severity: 'error' | 'warning';
    }> = [];

    PROTECTED_FIELDS.forEach(protectedField => {
      const mapping = mappings.find((m: any) => m.copperField === protectedField.copperFieldId);

      if (!mapping) {
        // Protected field is not mapped
        conflicts.push({
          field: protectedField,
          issue: 'This critical field is not mapped. Application features may break.',
          severity: protectedField.critical ? 'error' : 'warning',
        });
      } else if (mapping.ourField !== protectedField.ourFieldName) {
        // Protected field is mapped to a different name
        conflicts.push({
          field: protectedField,
          issue: `Field is mapped to "${mapping.ourField}" but code expects "${protectedField.ourFieldName}". This will break: ${protectedField.usedIn.join(', ')}`,
          severity: protectedField.critical ? 'error' : 'warning',
        });
      } else if (!mapping.enabled) {
        // Protected field is disabled
        conflicts.push({
          field: protectedField,
          issue: 'This field is disabled but required by the application.',
          severity: protectedField.critical ? 'error' : 'warning',
        });
      }
    });

    const hasErrors = conflicts.some(c => c.severity === 'error');
    const hasWarnings = conflicts.some(c => c.severity === 'warning');

    return NextResponse.json({
      success: true,
      valid: !hasErrors,
      conflicts,
      summary: {
        totalConflicts: conflicts.length,
        errors: conflicts.filter(c => c.severity === 'error').length,
        warnings: conflicts.filter(c => c.severity === 'warning').length,
      },
      canProceed: !hasErrors,
      message: hasErrors 
        ? 'Cannot save: Critical field mapping conflicts detected'
        : hasWarnings
        ? 'Warnings detected: Review before proceeding'
        : 'All protected fields are correctly mapped',
    });

  } catch (error: any) {
    console.error('❌ Error validating field mappings:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
