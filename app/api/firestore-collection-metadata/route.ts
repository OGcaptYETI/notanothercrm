import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface FieldMetadata {
  fieldName: string;
  displayName: string;
  count: number;
  sampleValues: any[];
  type: string;
  frequency: string;
  isReference?: boolean;
  referencePattern?: string;
  possibleLookups?: string[];
}

/**
 * Analyze a Firestore collection to understand its structure
 * Similar to Copper metadata but for any Firestore collection
 */
export async function POST(request: NextRequest) {
  try {
    const { collectionName, sampleSize = 100 } = await request.json();

    if (!collectionName) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Analyzing Firestore collection: ${collectionName}`);

    // Fetch sample documents
    const collectionRef = adminDb.collection(collectionName);
    const snapshot = await collectionRef.limit(sampleSize).get();

    if (snapshot.empty) {
      return NextResponse.json({
        error: `Collection '${collectionName}' is empty or does not exist`,
      }, { status: 404 });
    }

    const totalDocs = snapshot.size;
    console.log(`📊 Analyzing ${totalDocs} documents from ${collectionName}`);

    // Analyze all fields across documents
    const fieldStats: Record<string, {
      count: number;
      sampleValues: any[];
      types: Set<string>;
      isReference: boolean;
      referencePattern?: string;
      possibleLookups: Set<string>;
    }> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      Object.keys(data).forEach(fieldName => {
        const value = data[fieldName];
        
        if (!fieldStats[fieldName]) {
          fieldStats[fieldName] = {
            count: 0,
            sampleValues: [],
            types: new Set(),
            isReference: false,
            possibleLookups: new Set(),
          };
        }
        
        fieldStats[fieldName].count++;
        
        // Determine type
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        fieldStats[fieldName].types.add(valueType);
        
        // Check if it's a Firestore reference
        if (value && typeof value === 'object' && value._firestore) {
          fieldStats[fieldName].isReference = true;
          fieldStats[fieldName].referencePattern = value.path;
        }
        
        // Detect potential lookup fields (IDs that might reference other collections)
        if (fieldName.toLowerCase().includes('id') || 
            fieldName.toLowerCase().includes('ref') ||
            fieldName.toLowerCase().includes('key')) {
          // Check if value looks like a document ID
          if (typeof value === 'string' || typeof value === 'number') {
            fieldStats[fieldName].possibleLookups.add(String(value).substring(0, 20));
          }
        }
        
        // Store up to 5 sample values
        if (fieldStats[fieldName].sampleValues.length < 5 && value !== null && value !== '') {
          let sampleValue = value;
          
          // Handle different types
          if (typeof value === 'object' && value !== null) {
            if (value._seconds !== undefined) {
              // Firestore Timestamp
              sampleValue = new Date(value._seconds * 1000).toISOString();
            } else if (Array.isArray(value)) {
              sampleValue = value.slice(0, 3); // First 3 items
            } else if (JSON.stringify(value).length > 200) {
              sampleValue = '[Complex Object]';
            }
          }
          
          fieldStats[fieldName].sampleValues.push(sampleValue);
        }
      });
    });

    // Convert to array and sort by frequency
    const fields: FieldMetadata[] = Object.entries(fieldStats)
      .map(([fieldName, stats]) => ({
        fieldName,
        displayName: fieldName,
        count: stats.count,
        sampleValues: stats.sampleValues,
        type: Array.from(stats.types).join(' | '),
        frequency: `${stats.count}/${totalDocs}`,
        isReference: stats.isReference,
        referencePattern: stats.referencePattern,
        possibleLookups: stats.possibleLookups.size > 0 ? Array.from(stats.possibleLookups) : undefined,
      }))
      .sort((a, b) => b.count - a.count);

    // Categorize fields
    const idFields = fields.filter(f => 
      f.fieldName.toLowerCase().includes('id') || 
      f.fieldName.toLowerCase().includes('key')
    );
    
    const referenceFields = fields.filter(f => f.isReference);
    
    const timestampFields = fields.filter(f => 
      f.fieldName.toLowerCase().includes('date') || 
      f.fieldName.toLowerCase().includes('time') ||
      f.fieldName.toLowerCase().includes('at')
    );
    
    const standardFields = fields.filter(f => 
      !idFields.includes(f) && 
      !referenceFields.includes(f) && 
      !timestampFields.includes(f)
    );

    // Detect potential relationships
    const relationships: Array<{
      field: string;
      type: 'direct_reference' | 'id_lookup' | 'possible_association';
      targetCollection?: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    // Direct Firestore references
    referenceFields.forEach(field => {
      if (field.referencePattern) {
        const parts = field.referencePattern.split('/');
        if (parts.length >= 2) {
          relationships.push({
            field: field.fieldName,
            type: 'direct_reference',
            targetCollection: parts[0],
            confidence: 'high',
          });
        }
      }
    });

    // ID-based lookups
    idFields.forEach(field => {
      // Try to infer collection from field name
      const fieldLower = field.fieldName.toLowerCase();
      const possibleCollections = [
        'copper_companies',
        'copper_people',
        'fishbowl_customers',
        'fishbowl_sales_orders',
        'users',
        'accounts',
        'contacts',
        'orders',
      ];
      
      possibleCollections.forEach(collection => {
        const collectionBase = collection.replace('_', '').toLowerCase();
        if (fieldLower.includes(collectionBase) || 
            fieldLower.includes(collection.split('_')[0])) {
          relationships.push({
            field: field.fieldName,
            type: 'id_lookup',
            targetCollection: collection,
            confidence: 'medium',
          });
        }
      });
    });

    console.log(`✅ Analysis complete for ${collectionName}`);
    console.log(`   Total fields: ${fields.length}`);
    console.log(`   ID fields: ${idFields.length}`);
    console.log(`   Reference fields: ${referenceFields.length}`);
    console.log(`   Relationships detected: ${relationships.length}`);

    return NextResponse.json({
      success: true,
      collectionName,
      totalDocumentsAnalyzed: totalDocs,
      summary: {
        totalFields: fields.length,
        idFieldsCount: idFields.length,
        referenceFieldsCount: referenceFields.length,
        timestampFieldsCount: timestampFields.length,
        standardFieldsCount: standardFields.length,
        relationshipsDetected: relationships.length,
      },
      fields: {
        all: fields,
        idFields,
        referenceFields,
        timestampFields,
        standardFields,
      },
      relationships,
      metadata: {
        analyzedAt: new Date().toISOString(),
        sampleSize: totalDocs,
      },
    });

  } catch (error: any) {
    console.error('❌ Error analyzing Firestore collection:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
