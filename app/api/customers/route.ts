import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// GET - Fetch customers for email matching
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await verifyIdToken(token);
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // Get customers from your CRM
    const customersRef = adminDb.collection('customers');
    const userCustomers = await customersRef
      .where('assignedTo', '==', userId)
      .get();

    const customers: Array<{
      id: string;
      name: string;
      email: string;
      company?: string;
    }> = [];

    userCustomers.docs.forEach((doc: any) => {
      const data = doc.data();
      customers.push({
        id: doc.id,
        name: data.name || data.contactName,
        email: data.email || data.contactEmail,
        company: data.company
      });
    });

    return NextResponse.json({
      success: true,
      data: customers
    });

  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

// POST - Associate email with customer
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await verifyIdToken(token);
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { emailId, customerId, emailFrom, emailTo } = await request.json();
    const userId = decodedToken.uid;

    // Store email-customer association
    await adminDb.collection('email_associations').doc(emailId).set({
      userId,
      customerId,
      emailFrom,
      emailTo,
      associatedAt: new Date(),
      associatedBy: userId
    });

    return NextResponse.json({
      success: true,
      message: 'Email associated with customer'
    });

  } catch (error) {
    console.error('Error associating email:', error);
    return NextResponse.json(
      { error: 'Failed to associate email' },
      { status: 500 }
    );
  }
}
