import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const quotesRef = adminDb.collection('quotes');
    const snapshot = await quotesRef.get();
    
    let fixed = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    const batch = adminDb.batch();
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      let needsUpdate = false;
      const updates: any = {};
      
      // Fix line items
      if (data.lineItems && Array.isArray(data.lineItems)) {
        const fixedLineItems = data.lineItems.map((item: any) => {
          if (item.product && item.product.image) {
            const fixedImage = fixImageUrl(item.product.image);
            if (fixedImage !== item.product.image) {
              needsUpdate = true;
              return {
                ...item,
                product: {
                  ...item.product,
                  image: fixedImage
                }
              };
            }
          }
          return item;
        });
        
        if (needsUpdate) {
          updates.lineItems = fixedLineItems;
        }
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        fixed++;
      } else {
        skipped++;
      }
    });
    
    await batch.commit();
    
    return NextResponse.json({
      success: true,
      fixed,
      skipped,
      errors,
      total: snapshot.docs.length
    });
  } catch (error: any) {
    console.error('Error fixing quote images:', error);
    return NextResponse.json(
      { error: 'Failed to fix quote images', details: error.message },
      { status: 500 }
    );
  }
}

function fixImageUrl(url: string): string {
  if (!url) return url;
  
  // Already has protocol
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Missing protocol - add https://
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // Completely missing protocol
  if (url.includes('firebasestorage.googleapis.com')) {
    return `https://${url}`;
  }
  
  // Return as-is if we can't determine
  return url;
}
