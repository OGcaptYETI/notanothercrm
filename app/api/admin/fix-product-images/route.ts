import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const productsRef = adminDb.collection('products');
    const snapshot = await productsRef.get();
    
    let fixed = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    const batch = adminDb.batch();
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      let needsUpdate = false;
      const updates: any = {};
      
      // Fix imageUrl
      if (data.imageUrl && typeof data.imageUrl === 'string') {
        const fixedUrl = fixImageUrl(data.imageUrl);
        if (fixedUrl !== data.imageUrl) {
          updates.imageUrl = fixedUrl;
          needsUpdate = true;
        }
      }
      
      // Fix images array
      if (data.images && Array.isArray(data.images)) {
        const fixedImages = data.images.map((url: string) => fixImageUrl(url));
        if (JSON.stringify(fixedImages) !== JSON.stringify(data.images)) {
          updates.images = fixedImages;
          needsUpdate = true;
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
    console.error('Error fixing product images:', error);
    return NextResponse.json(
      { error: 'Failed to fix product images', details: error.message },
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
