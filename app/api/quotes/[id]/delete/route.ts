import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logQuoteActivity } from '@/lib/services/quoteService';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const quoteId = params.id;

    // Get the quote first to log activity
    const quoteRef = adminDb.collection('quotes').doc(quoteId);
    const quoteDoc = await quoteRef.get();

    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const quoteData = quoteDoc.data();

    // Delete the quote
    await quoteRef.delete();

    // Log the deletion activity
    await logQuoteActivity({
      quoteId,
      type: 'deleted',
      description: `Quote ${quoteData?.quoteNumber || quoteId} deleted`,
      userId: quoteData?.createdBy || 'unknown',
      userEmail: quoteData?.createdByEmail || 'unknown',
      metadata: {
        quoteName: quoteData?.quoteName,
        customerName: quoteData?.customer?.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Quote deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting quote:', error);
    return NextResponse.json(
      { error: 'Failed to delete quote' },
      { status: 500 }
    );
  }
}
