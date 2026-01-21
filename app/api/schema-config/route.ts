import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const SCHEMA_COLLECTION = 'system_schema_config';
const SCHEMA_DOC_ID = 'current_schema';

/**
 * GET - Load current schema from Firestore with LIVE document counts
 */
export async function GET(request: NextRequest) {
  try {
    const docRef = adminDb.collection(SCHEMA_COLLECTION).doc(SCHEMA_DOC_ID);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({
        success: false,
        message: 'No schema found. Run inspect-schema to initialize.',
      }, { status: 404 });
    }
    
    const data = doc.data();
    
    // Fetch LIVE document counts for all collections
    if (data?.collections && Array.isArray(data.collections)) {
      const collectionsWithLiveCounts = await Promise.all(
        data.collections.map(async (col: any) => {
          try {
            const snapshot = await adminDb.collection(col.id).limit(1).get();
            const stats = await adminDb.collection(col.id).count().get();
            const liveCount = stats.data().count;
            
            return {
              ...col,
              documentCount: liveCount, // Always use LIVE count
            };
          } catch (err) {
            console.error(`Error counting ${col.id}:`, err);
            return {
              ...col,
              documentCount: col.documentCount || 0, // Fallback to stored count
            };
          }
        })
      );
      
      data.collections = collectionsWithLiveCounts;
    }
    
    return NextResponse.json({
      success: true,
      schema: data,
      lastUpdated: data?.lastUpdated || null,
    });
  } catch (error: any) {
    console.error('Error loading schema:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Save schema to Firestore
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collections, relationships, nodes, edges } = body;
    
    if (!collections || !Array.isArray(collections)) {
      return NextResponse.json(
        { error: 'collections array is required' },
        { status: 400 }
      );
    }
    
    const schemaData = {
      collections,
      relationships: relationships || [],
      nodes: nodes || [],
      edges: edges || [],
      lastUpdated: new Date().toISOString(),
      version: 1,
    };
    
    const docRef = adminDb.collection(SCHEMA_COLLECTION).doc(SCHEMA_DOC_ID);
    await docRef.set(schemaData, { merge: true });
    
    console.log('✅ Schema saved to Firestore');
    
    return NextResponse.json({
      success: true,
      message: 'Schema saved successfully',
      lastUpdated: schemaData.lastUpdated,
    });
  } catch (error: any) {
    console.error('Error saving schema:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Initialize schema from inspection results
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { collections, relationships } = body;
    
    if (!collections || !Array.isArray(collections)) {
      return NextResponse.json(
        { error: 'collections array is required' },
        { status: 400 }
      );
    }
    
    // Auto-generate node positions in a grid layout
    const nodes = collections.map((col: any, index: number) => {
      const cols = 5; // 5 columns
      const x = (index % cols) * 350 + 100;
      const y = Math.floor(index / cols) * 300 + 100;
      
      return {
        id: col.id,
        type: 'collectionNode',
        position: { x, y },
        data: {
          label: col.id,
          collectionName: col.id,
          documentCount: `${col.documentCount} docs`,
          fields: col.fields || [],
          expanded: false,
        },
      };
    });
    
    // Auto-generate edges from discovered relationships
    const edges = (relationships || []).map((rel: any, index: number) => ({
      id: `edge-${index}`,
      source: rel.source,
      target: rel.target,
      type: 'default',
      animated: true,
      label: `${rel.sourceField} → ${rel.targetField}`,
      data: {
        sourceField: rel.sourceField,
        targetField: rel.targetField,
        relationshipType: '1:many', // Default
        confidence: rel.confidence,
      },
    }));
    
    const schemaData = {
      collections,
      relationships: relationships || [],
      nodes,
      edges,
      lastUpdated: new Date().toISOString(),
      version: 1,
      initialized: true,
    };
    
    const docRef = adminDb.collection(SCHEMA_COLLECTION).doc(SCHEMA_DOC_ID);
    await docRef.set(schemaData);
    
    console.log(`✅ Schema initialized with ${collections.length} collections and ${edges.length} relationships`);
    
    return NextResponse.json({
      success: true,
      message: 'Schema initialized successfully',
      stats: {
        collections: collections.length,
        relationships: edges.length,
        nodes: nodes.length,
      },
    });
  } catch (error: any) {
    console.error('Error initializing schema:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
