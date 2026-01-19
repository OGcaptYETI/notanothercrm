# JustCall Integration - Implementation Guide

## Overview
JustCall is the phone system used by Kanva Botanicals for tracking calls and SMS messages. This integration pulls call/SMS data from JustCall API and syncs it to the goals tracker for metrics tracking.

## Current Implementation (copper-goals-tracker)

### **JustCall API Client**
Location: `copper-goals-tracker/lib/justcall/client.ts`

**Authentication:**
- Uses Basic Auth with API Key and Secret
- Credentials: `JUSTCALL_API_KEY` and `JUSTCALL_API_SECRET`
- Base URL: `https://api.justcall.io/v2.1`

**Key Methods:**
1. `getUsers()` - Fetches all JustCall users/agents
2. `getUserByEmail(email)` - Find user by email address
3. `getCalls(params)` - Fetch call records with filters
4. `getCallsByUserEmail(email, startDate, endDate)` - Get all calls for a user with pagination
5. `calculateMetrics(calls)` - Calculate metrics from call records

### **Call Record Structure**
```typescript
interface JustCallCallRecord {
  id: number;
  contact_number: string;
  contact_name?: string;
  contact_email?: string;
  agent_id?: number;
  agent_name?: string;
  agent_email?: string;
  call_date: string; // YYYY-MM-DD format
  call_time: string;
  call_info: {
    direction: 'Incoming' | 'Outgoing';
    type: string; // "Answered", "Missed", "Unanswered", etc.
    disposition?: string;
    notes?: string;
    recording?: string;
  };
  call_duration: {
    total_duration: number; // seconds
    conversation_time: number; // seconds
    ring_time?: number;
    hold_time?: number;
  };
  tags?: string[];
}
```

### **Metrics Calculated**
```typescript
interface JustCallMetrics {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  completedCalls: number; // Answered calls
  missedCalls: number;
  totalDuration: number; // Total seconds
  averageDuration: number; // Average seconds per call
  callsByDay: Record<string, number>; // Date -> call count
  callsByStatus: Record<string, number>; // Status -> call count
}
```

## Data Flow Architecture

### **Current Flow (copper-goals-tracker):**
```
JustCall API
  ↓
GET /api/justcall/calls?email=user@kanva.com&start_date=2026-01-01&end_date=2026-01-31
  ↓
JustCallClient.getCallsByUserEmail()
  ↓
Calculates metrics (calls, duration, by day)
  ↓
Returns to frontend for display
```

### **Proposed Flow (KanvaPortal):**
```
JustCall API
  ↓
Webhook OR Scheduled Sync (daily/hourly)
  ↓
POST /api/goals/sync-justcall
  ↓
Fetches calls from JustCall API
  ↓
Maps agent_email to KanvaPortal userId
  ↓
Logs metrics to 'metrics' collection
  - phone_call_quantity (count per day)
  - sms_quantity (count per day)
  - talk_time_minutes (duration per day)
  ↓
Goals dashboard displays progress
```

## How Data Attaches to Users/Accounts

### **User Mapping:**
1. **JustCall User** has `agent_email` field
2. **KanvaPortal User** has `email` field
3. **Mapping:** Match `agent_email` (JustCall) to `email` (KanvaPortal users collection)
4. **Result:** Metrics logged with `userId` from KanvaPortal

### **Customer/Account Mapping:**
JustCall call records include:
- `contact_number` - Phone number called/received
- `contact_name` - Contact name (if in JustCall contacts)
- `contact_email` - Contact email (if available)

**Mapping to Customers:**
1. **By Email:** Match `contact_email` to `fishbowl_customers.email` or `copper_contacts.email`
2. **By Phone:** Match `contact_number` to customer phone fields
3. **By Name:** Fuzzy match `contact_name` to customer names

**Use Cases:**
- Track which customers a sales rep calls most
- Measure call frequency per account
- Correlate calls with sales outcomes
- Pipeline progression tracking (calls → meetings → deals)

## SMS Tracking

**Note:** JustCall also tracks SMS messages through a separate endpoint.

**SMS Endpoint:** `/api/justcall/sms` (needs to be implemented)

**SMS Record Structure:**
```typescript
interface JustCallSMSRecord {
  id: number;
  contact_number: string;
  agent_email?: string;
  message_text: string;
  direction: 'Incoming' | 'Outgoing';
  sent_at: string; // ISO timestamp
  status: string; // "sent", "delivered", "failed"
}
```

**SMS Metrics:**
- Total SMS sent
- SMS by day
- SMS by contact/customer
- Response rate (incoming vs outgoing)

## Implementation Steps for KanvaPortal

### **Phase 1: Copy JustCall Client** ✅ (Partially Done)
- [x] Create `lib/justcall/client.ts` with JustCall API client
- [x] Add environment variables to `.env.local`
- [ ] Test connection with real credentials

### **Phase 2: Fix Sync API** (Current)
- [x] Fix `getAllUsers` toDate() error in goals services
- [ ] Update `/api/goals/sync-justcall` to use real JustCall API
- [ ] Map JustCall users to KanvaPortal users by email
- [ ] Log metrics to Firestore 'metrics' collection
- [ ] Test with real JustCall data

### **Phase 3: Scheduled Sync**
- [ ] Create Cloud Function or cron job for daily sync
- [ ] Sync all users' calls from previous day
- [ ] Handle pagination (JustCall returns 100 calls per page)
- [ ] Error handling and retry logic

### **Phase 4: Webhook Integration** (Optional)
- [ ] Set up JustCall webhook endpoint
- [ ] Receive real-time call/SMS events
- [ ] Immediately log to metrics collection
- [ ] Update goals dashboard in real-time

### **Phase 5: JustCall Dialer Integration**
**Goal:** Embed JustCall dialer in KanvaPortal (like Copper CRM integration)

**Research Needed:**
- JustCall Click-to-Call widget
- JustCall Embedded Dialer
- JustCall Chrome Extension integration
- Similar to Copper's JustCall integration

**Placement:** Next to notification bell in top navigation

**Features:**
- Click-to-call from customer pages
- Call history popup
- Active call controls
- Call notes and disposition

## Current Issues & Fixes

### **Issue 1: getAllUsers toDate() Error** ✅ FIXED
**Error:** `TypeError: _data_updatedAt.toDate is not a function`

**Cause:** Firestore Timestamps might be plain objects with `seconds` field, not Timestamp instances

**Fix:** Added helper function to handle multiple timestamp formats:
```typescript
const toDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date();
};
```

### **Issue 2: sync-justcall API 500 Error** (In Progress)
**Error:** `POST http://localhost:3000/api/goals/sync-justcall 500`

**Likely Causes:**
1. No `justcall_activities` collection exists in Firestore
2. Missing JustCall API credentials
3. Need to fetch from JustCall API directly, not Firestore

**Fix Needed:**
Update `/api/goals/sync-justcall/route.ts` to:
1. Fetch calls from JustCall API using client
2. Map agent_email to userId
3. Log metrics to goals system

## Environment Variables Required

```env
# JustCall API Credentials
JUSTCALL_API_KEY=your_api_key_here
JUSTCALL_API_SECRET=your_api_secret_here
```

**Where to Get:**
1. Log in to JustCall admin panel
2. Go to Settings → Integrations → API
3. Generate API Key and Secret
4. Add to `.env.local` in KanvaPortal

## Testing Checklist

### **Manual Testing:**
- [ ] Test JustCall API connection
- [ ] Fetch users from JustCall
- [ ] Fetch calls for a specific user
- [ ] Calculate metrics from calls
- [ ] Map JustCall users to KanvaPortal users
- [ ] Log metrics to Firestore
- [ ] View metrics in goals dashboard

### **Integration Testing:**
- [ ] Sync button works on goals page
- [ ] Metrics appear in goals dashboard
- [ ] Progress bars update correctly
- [ ] Calendar shows activity days
- [ ] Team aggregates include call metrics

### **Data Validation:**
- [ ] Call counts match JustCall dashboard
- [ ] Duration calculations are accurate
- [ ] Date ranges work correctly
- [ ] User attribution is correct
- [ ] No duplicate metrics logged

## Future Enhancements

1. **Real-time Sync:** Webhook integration for instant updates
2. **SMS Tracking:** Add SMS metrics alongside calls
3. **Call Quality:** Track call ratings and dispositions
4. **Customer Insights:** Link calls to specific customers/accounts
5. **Dialer Integration:** Embedded dialer in KanvaPortal
6. **Call Recording:** Access recordings from goals dashboard
7. **Voicemail Transcription:** Display transcriptions in UI
8. **Call Analytics:** Advanced reporting and insights

## References

- **JustCall API Docs:** https://developer.justcall.io/
- **Copper Goals Tracker:** `c:\Projects\copper-goals-tracker\`
- **JustCall Client:** `copper-goals-tracker/lib/justcall/client.ts`
- **JustCall Metrics Component:** `copper-goals-tracker/components/JustCallMetrics.tsx`

---

**Last Updated:** January 19, 2026
**Status:** Phase 2 In Progress - Fixing sync API
**Next Step:** Update sync-justcall route to use real JustCall API
