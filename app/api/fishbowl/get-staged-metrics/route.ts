import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Loading staged metrics...');

    // Get all staged metrics
    const stagingSnapshot = await adminDb
      .collection('fishbowl_metrics_staging')
      .orderBy('calculatedAt', 'desc')
      .get();

    console.log(`Found ${stagingSnapshot.size} staged metrics`);

    const stagedMetrics = stagingSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        customerId: data.customerId,
        customerName: data.customerName,
        copperCompanyId: data.copperCompanyId,
        copperCompanyName: data.copperCompanyName,
        accountId: data.accountId,
        metrics: data.metrics,
        sampleKitSent: data.sampleKitSent || false,
        sampleKitDate: data.sampleKitDate || null,
        calculatedAt: data.calculatedAt,
        status: data.status || 'pending',
        syncedAt: data.syncedAt,
        syncError: data.syncError,
      };
    });

    // Sort by name
    stagedMetrics.sort((a, b) => a.customerName.localeCompare(b.customerName));

    return NextResponse.json({
      success: true,
      count: stagedMetrics.length,
      metrics: stagedMetrics,
      summary: {
        total: stagedMetrics.length,
        pending: stagedMetrics.filter(m => m.status === 'pending').length,
        synced: stagedMetrics.filter(m => m.status === 'synced').length,
        error: stagedMetrics.filter(m => m.status === 'error').length,
      }
    });

  } catch (error: any) {
    console.error('❌ Error loading staged metrics:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
