import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logQuoteActivity } from '@/lib/services/quoteService';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const quoteId = params.id;
    const updates = await request.json();

    // Get the existing quote to preserve fields we don't want to update
    const quoteRef = adminDb.collection('quotes').doc(quoteId);
    const quoteDoc = await quoteRef.get();

    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const existingQuote = quoteDoc.data();

    // Update the quote
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
      version: (existingQuote?.version || 1) + 1,
    };

    await quoteRef.update(updatedData);

    // Log the update activity
    await logQuoteActivity({
      quoteId,
      type: 'updated',
      description: `Quote updated - modified ${Object.keys(updates).join(', ')}`,
      userId: existingQuote?.createdBy || 'unknown',
      userEmail: existingQuote?.createdByEmail || 'unknown',
      metadata: {
        changes: Object.keys(updates),
      },
    });

    return NextResponse.json({
      success: true,
      quoteId,
      version: updatedData.version,
    });
  } catch (error) {
    console.error('Error updating quote:', error);
    return NextResponse.json(
      { error: 'Failed to update quote' },
      { status: 500 }
    );
  }
}
