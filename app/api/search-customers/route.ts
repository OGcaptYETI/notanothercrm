import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CustomerSearchResult {
  id: string;
  name: string;
  accountType?: string;
  copperAccountOrderId?: string;
  aliases?: string[];
  matchScore: number;
}

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 10 } = await req.json();
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    const searchQuery = query.trim().toLowerCase();
    
    // Load all customers
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    
    const results: CustomerSearchResult[] = [];
    
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      const customerId = data.id || doc.id;
      const customerName = (data.name || '').toLowerCase();
      
      // Calculate match score
      let matchScore = 0;
      
      // Exact ID match (highest priority)
      if (customerId === searchQuery) {
        matchScore = 100;
      }
      // ID starts with query
      else if (customerId.startsWith(searchQuery)) {
        matchScore = 90;
      }
      // ID contains query
      else if (customerId.includes(searchQuery)) {
        matchScore = 80;
      }
      // Check aliases
      else if (data.aliases && Array.isArray(data.aliases)) {
        const aliasMatch = data.aliases.find((alias: string) => 
          String(alias).toLowerCase() === searchQuery
        );
        if (aliasMatch) {
          matchScore = 95;
        }
      }
      
      // Name matching
      if (matchScore === 0) {
        // Exact name match
        if (customerName === searchQuery) {
          matchScore = 85;
        }
        // Name starts with query
        else if (customerName.startsWith(searchQuery)) {
          matchScore = 75;
        }
        // Name contains query
        else if (customerName.includes(searchQuery)) {
          matchScore = 60;
        }
        // Fuzzy match - check if all words in query appear in name
        else {
          const queryWords = searchQuery.split(/\s+/);
          const matchingWords = queryWords.filter((word: string) => customerName.includes(word));
          if (matchingWords.length > 0) {
            matchScore = (matchingWords.length / queryWords.length) * 50;
          }
        }
      }
      
      // Only include results with some match
      if (matchScore > 0) {
        results.push({
          id: customerId,
          name: data.name || 'Unknown',
          accountType: data.accountType,
          copperAccountOrderId: data.copperAccountOrderId,
          aliases: data.aliases,
          matchScore
        });
      }
    });
    
    // Sort by match score (highest first) and limit results
    const sortedResults = results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
    
    return NextResponse.json({
      success: true,
      results: sortedResults,
      count: sortedResults.length
    });
    
  } catch (error: any) {
    console.error('❌ Customer search error:', error);
    return NextResponse.json({ 
      error: error.message || 'Search failed' 
    }, { status: 500 });
  }
}
