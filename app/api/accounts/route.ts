/**
 * API Route for Accounts
 * Server-side Supabase queries with service role key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const searchParams = request.nextUrl.searchParams;
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const cursor = searchParams.get('cursor');
    const searchTerm = searchParams.get('searchTerm');
    const region = searchParams.get('region');
    const segment = searchParams.get('segment');
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId') || 'kanva-botanicals';

    // Build query
    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('name', { ascending: true })
      .limit(pageSize);

    // Cursor pagination
    if (cursor) {
      query = query.gt('name', cursor);
    }

    // Search
    if (searchTerm) {
      query = query.or(
        `name.ilike.%${searchTerm}%,` +
        `email.ilike.%${searchTerm}%,` +
        `phone.ilike.%${searchTerm}%,` +
        `shipping_city.ilike.%${searchTerm}%`
      );
    }

    // Filters
    if (region) query = query.eq('region', region);
    if (segment) query = query.eq('segment', segment);
    if (status === 'active') query = query.eq('is_active_customer', true);
    if (status === 'prospect') query = query.eq('is_active_customer', false);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasMore = (data?.length || 0) === pageSize;
    const nextCursor = hasMore && data && data.length > 0 
      ? data[data.length - 1].name 
      : null;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      hasMore,
      nextCursor,
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
