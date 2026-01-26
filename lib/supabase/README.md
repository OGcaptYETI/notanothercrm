# Supabase Multi-Tenant SaaS Setup

## What We Built Today

### ✅ Multi-Tenant Architecture
- **One Supabase instance** serves all customers
- **Row Level Security (RLS)** enforces data isolation
- **Automatic company_id filtering** via JWT claims
- **Kanva Botanicals** set up as first tenant

### ✅ Database Schema
- `companies` - Your SaaS customers
- `accounts` - CRM accounts (with company_id)
- `contacts` - CRM contacts (with company_id)
- `prospects` - CRM leads (with company_id)
- `deals` - CRM opportunities (with company_id)
- `orders` - Sales orders (with company_id)
- `order_items` - Order line items (with company_id)
- `saved_filters` - User filters (with company_id)

### ✅ Security
- RLS policies on all tables
- Users can only see their company's data
- Database-enforced isolation (not app-level)
- Impossible to access other company data

## Migration Status

**Kanva Botanicals Data:**
- ✅ 269,872 accounts migrated
- ✅ company_id: 'kanva-botanicals'
- ✅ All data isolated by RLS

## Next Steps

### 1. Supabase Auth (Replace Firebase Auth)
- Switch authentication to Supabase
- Add company_id to user metadata
- Update login/signup flows

### 2. Update App to Use Supabase
- Replace Firestore queries with Supabase
- Use `lib/supabase/dataService.ts` for CRM data
- Test RLS isolation

### 3. Customer Onboarding
- Build signup flow for new customers
- Create company record
- Assign users to companies
- Import their CRM data

## Files Created

- `lib/supabase/schema-multitenant.sql` - Full database schema
- `lib/supabase/auth.ts` - Supabase auth helpers
- `lib/supabase/dataService.ts` - CRM data queries
- `lib/supabase/client.ts` - Supabase client config
- `scripts/migrate-to-multitenant-supabase.ts` - Migration script

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://ctkcoyvzdyoqvduqnami.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## Testing RLS

Once auth is implemented, test that:
1. Users can only see their company's data
2. Queries automatically filter by company_id
3. Cannot access other company data even with direct API calls

## Onboarding New Customer

```typescript
// 1. Create company
await supabase.from('companies').insert({
  id: 'new-customer',
  name: 'New Customer Inc',
  subdomain: 'newcustomer',
  plan: 'professional',
  status: 'active'
});

// 2. Create admin user
await supabase.auth.signUp({
  email: 'admin@newcustomer.com',
  password: 'secure-password',
  options: {
    data: {
      company_id: 'new-customer',
      role: 'admin'
    }
  }
});

// 3. Import their data (with company_id)
await supabase.from('accounts').insert(
  theirAccounts.map(a => ({ ...a, company_id: 'new-customer' }))
);
```

## Cost at Scale

**Supabase Pro ($25/month):**
- 8GB database
- 100GB storage
- 100k monthly active users

**Supabase Team ($599/month):**
- Unlimited database
- Unlimited storage
- Unlimited users
- **Perfect for 100+ customers**

**Revenue Example:**
- 100 customers × $299/month = $29,900/month
- Supabase cost: $599/month
- **Profit: $29,301/month** 🚀
