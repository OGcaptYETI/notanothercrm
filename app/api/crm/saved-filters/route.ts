import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET - Load all saved filters for a user
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get public filters
    const publicFiltersSnapshot = await adminDb
      .collection('saved_filters')
      .where('isPublic', '==', true)
      .where('active', '==', true)
      .orderBy('name')
      .get();

    // Get user's private filters
    const privateFiltersSnapshot = await adminDb
      .collection('saved_filters')
      .where('isPublic', '==', false)
      .where('userId', '==', userId)
      .where('active', '==', true)
      .orderBy('name')
      .get();

    const publicFilters = publicFiltersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const privateFilters = privateFiltersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      publicFilters,
      privateFilters
    });

  } catch (error: any) {
    console.error('Error loading saved filters:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load filters' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save a new filter
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, filters, isPublic, userId, collection = 'copper_companies' } = body;

    if (!name || !userId) {
      return NextResponse.json(
        { error: 'name and userId required' },
        { status: 400 }
      );
    }

    const filterDoc = {
      name,
      filters: filters || [],
      isPublic: isPublic || false,
      userId,
      collection,
      active: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      count: 0 // Will be updated when filter is applied
    };

    const docRef = await adminDb.collection('saved_filters').add(filterDoc);

    return NextResponse.json({
      success: true,
      filterId: docRef.id,
      filter: { id: docRef.id, ...filterDoc }
    });

  } catch (error: any) {
    console.error('Error saving filter:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save filter' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update an existing filter
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { filterId, name, filters, isPublic, userId } = body;

    if (!filterId || !userId) {
      return NextResponse.json(
        { error: 'filterId and userId required' },
        { status: 400 }
      );
    }

    // Verify ownership or public filter
    const filterDoc = await adminDb.collection('saved_filters').doc(filterId).get();
    
    if (!filterDoc.exists) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    const filterData = filterDoc.data();
    if (filterData?.userId !== userId && !filterData?.isPublic) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates: any = {
      updatedAt: Timestamp.now(),
      updatedBy: userId
    };

    if (name !== undefined) updates.name = name;
    if (filters !== undefined) updates.filters = filters;
    if (isPublic !== undefined) updates.isPublic = isPublic;

    await adminDb.collection('saved_filters').doc(filterId).update(updates);

    return NextResponse.json({
      success: true,
      filterId
    });

  } catch (error: any) {
    console.error('Error updating filter:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update filter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a filter (soft delete)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterId = searchParams.get('filterId');
    const userId = searchParams.get('userId');

    if (!filterId || !userId) {
      return NextResponse.json(
        { error: 'filterId and userId required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const filterDoc = await adminDb.collection('saved_filters').doc(filterId).get();
    
    if (!filterDoc.exists) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    const filterData = filterDoc.data();
    if (filterData?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Soft delete
    await adminDb.collection('saved_filters').doc(filterId).update({
      active: false,
      deletedAt: Timestamp.now(),
      deletedBy: userId
    });

    return NextResponse.json({
      success: true,
      filterId
    });

  } catch (error: any) {
    console.error('Error deleting filter:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete filter' },
      { status: 500 }
    );
  }
}
