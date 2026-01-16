import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, note } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    console.log(`📝 Updating commission note for order ${orderId}`);

    // Update the order in sales_order_history
    const orderRef = adminDb.collection('sales_order_history').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Update the note
    await orderRef.update({
      commissionNote: note || '',
      commissionNoteUpdatedAt: FieldValue.serverTimestamp(),
      commissionNoteUpdatedBy: 'admin' // TODO: Get actual user email from auth
    });

    console.log(`✅ Commission note updated for order ${orderId}`);

    return NextResponse.json({
      success: true,
      message: 'Commission note updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating commission note:', error);
    return NextResponse.json(
      { error: 'Failed to update note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
