# Sync Fishbowl → Copper Tool - Improvement Plan

## Current Issues
1. **Data Loss on Refresh**: Calculated metrics disappear when page refreshes
2. **No Field Mapping**: Assumes field names without verification
3. **Price Data Still $0**: Need to verify correct field names in fishbowl_sales_orders
4. **No Staging Area**: Data goes directly from calculation to sync
5. **Poor Progress Tracking**: Limited visibility into what's happening

## Proposed Architecture (Based on Copper Import Tool)

### Stage 1: Calculate & Store Metrics
**Purpose**: Calculate metrics from sales orders and store in Firestore staging collection

**Implementation**:
- Create `fishbowl_metrics_staging` collection in Firestore
- Calculate metrics for all active Copper customers
- Store results with metadata:
  ```json
  {
    "customerId": "115",
    "customerName": "Honest Inc",
    "copperCompanyId": "72196288",
    "accountId": "72196288",
    "metrics": {
      "totalOrders": 30,
      "totalSpent": 45000,
      "firstOrderDate": "2023-01-15",
      "lastOrderDate": "2025-12-17",
      "averageOrderValue": 1500,
      "daysSinceLastOrder": 29,
      "topProducts": "Focus+Flow (12), Relax (8), Sleep (6)"
    },
    "calculatedAt": "2026-01-15T17:30:00Z",
    "status": "pending",
    "syncedAt": null
  }
  ```

**API Endpoint**: `/api/fishbowl/calculate-and-stage-metrics`
- Query active Copper companies (Active Customer cf_712751 = true)
- Match to fishbowl_customers by accountId
- Query fishbowl_sales_orders for each customer
- Calculate all metrics
- Store in staging collection
- Return summary stats

### Stage 2: Field Mapping & Preview
**Purpose**: Map Fishbowl metrics to Copper custom fields and preview before sync

**Implementation**:
- Fetch field definitions from Copper API
- Display mapping UI similar to Copper Import:
  ```
  Fishbowl Field          →  Copper Field
  totalOrders            →  Total Orders cf_698403
  totalSpent             →  Total Spent cf_698404
  firstOrderDate         →  First Order Date cf_698405
  lastOrderDate          →  Last Order Date cf_698406
  averageOrderValue      →  Average Order Value cf_698407
  daysSinceLastOrder     →  Days Since Last Order cf_713846
  topProducts            →  Top Products cf_713845
  ```
- Save mapping to Firestore for reuse
- Preview table showing what will be synced

**API Endpoint**: `/api/fishbowl/get-copper-field-mappings`
- Fetch Copper custom field definitions
- Return available fields for mapping

### Stage 3: Sync to Copper
**Purpose**: Push staged metrics to Copper CRM with proper error handling

**Implementation**:
- Read from `fishbowl_metrics_staging` collection
- Apply field mappings
- Batch update Copper companies via API
- Update staging records with sync status
- Handle errors gracefully with retry logic

**API Endpoint**: `/api/fishbowl/sync-staged-metrics-to-copper`
- Process in batches of 50
- Update Copper via PUT request
- Mark as synced in staging collection
- Return detailed results

## Data Flow

```
1. User clicks "Calculate Metrics"
   ↓
2. Query active Copper companies (1600+)
   ↓
3. Match to fishbowl_customers by accountId
   ↓
4. For each matched customer:
   - Query fishbowl_sales_orders (by customerId)
   - Calculate metrics from order data
   - Store in fishbowl_metrics_staging
   ↓
5. Display summary: "1120 customers calculated"
   ↓
6. User clicks "Load Preview"
   ↓
7. Fetch from fishbowl_metrics_staging
   ↓
8. Display table with all metrics (persists on refresh)
   ↓
9. User verifies field mappings (optional)
   ↓
10. User clicks "Sync to Copper"
    ↓
11. Read staged metrics
    ↓
12. Apply field mappings
    ↓
13. Batch update Copper companies
    ↓
14. Update staging records with sync status
    ↓
15. Display results: "1120 synced successfully"
```

## Critical Fixes Needed

### 1. Price Data Issue - CRITICAL FINDING
**Problem**: Orders showing $0 for totalPrice

**ROOT CAUSE DISCOVERED**:
- `fishbowl_sales_orders` collection has **NO PRICE DATA**
- Only contains metadata: salesOrderId, salesRep, dates, customerName, etc.
- Same issue as `sales_order_history` subcollection
- Price data must be stored in a different location

**Investigation Needed**:
- Check `fishbowl_soitems` collection (line items with prices)
- Check if there's a `line_items` subcollection under sales orders
- Review the Fishbowl import code to see where price data is stored
- May need to aggregate from line items: `SUM(quantity * unitPrice)`

**Possible Data Sources**:
1. `fishbowl_soitems` collection (most likely)
   - Has fields like: `totalPrice`, `unitPrice`, `quantity`
   - Need to join by `salesOrderId` or `soNumber`
2. Line items subcollection under `fishbowl_sales_orders/{orderId}/line_items`
3. Separate order totals collection

**Solution**:
```typescript
// Option 1: Query fishbowl_soitems and aggregate
const lineItemsSnapshot = await adminDb
  .collection('fishbowl_soitems')
  .where('salesOrderId', '==', order.salesOrderId)
  .get();

let orderTotal = 0;
lineItemsSnapshot.forEach(item => {
  const itemData = item.data();
  orderTotal += itemData.totalPrice || (itemData.quantity * itemData.unitPrice) || 0;
});

// Option 2: Check for subcollection
const lineItemsSnapshot = await adminDb
  .collection('fishbowl_sales_orders')
  .doc(orderId)
  .collection('line_items')
  .get();
```

### 2. Field Mapping Storage
**Collection**: `sync_configurations`
**Document ID**: `fishbowl_to_copper_mapping`

```json
{
  "mappings": {
    "totalOrders": "cf_698403",
    "totalSpent": "cf_698404",
    "firstOrderDate": "cf_698405",
    "lastOrderDate": "cf_698406",
    "averageOrderValue": "cf_698407",
    "daysSinceLastOrder": "cf_713846",
    "topProducts": "cf_713845"
  },
  "lastUpdated": "2026-01-15T17:30:00Z",
  "updatedBy": "user@example.com"
}
```

### 3. State Management
**Current**: React state (lost on refresh)
**New**: Firestore + React state
- Firestore as source of truth
- React state for UI updates
- Automatic reload from Firestore on mount

## UI Improvements

### Progress Indicators
- Real-time progress bars during calculation
- Status badges for each customer (Pending, Synced, Error)
- Last calculated/synced timestamps

### Error Handling
- Display specific errors for failed syncs
- Retry button for individual customers
- Bulk retry for all failed syncs

### Filters & Search
- Filter by sync status
- Search by customer name
- Sort by any column

## Implementation Priority

1. **CRITICAL**: Fix price data calculation
   - Debug fishbowl_sales_orders field structure
   - Implement correct field mapping
   - Test with sample customers

2. **HIGH**: Add staging collection
   - Create fishbowl_metrics_staging collection
   - Update calculate-metrics API to store results
   - Add API to fetch staged metrics

3. **HIGH**: Persist data across refreshes
   - Load from staging on component mount
   - Update UI to show staged data

4. **MEDIUM**: Add field mapping UI
   - Fetch Copper field definitions
   - Display mapping interface
   - Save mappings to Firestore

5. **MEDIUM**: Improve sync process
   - Batch processing with progress
   - Error handling and retry
   - Update staging records with status

6. **LOW**: UI polish
   - Better progress indicators
   - Filters and search
   - Export functionality

## Testing Plan

1. **Calculate Metrics**
   - Test with 10 customers
   - Verify all fields populated correctly
   - Check price calculations

2. **Staging Persistence**
   - Calculate metrics
   - Refresh page
   - Verify data still visible

3. **Field Mapping**
   - Verify Copper field IDs are correct
   - Test custom mapping changes
   - Ensure mappings persist

4. **Sync to Copper**
   - Test with 5 customers first
   - Verify data appears in Copper
   - Check error handling

5. **Full Integration**
   - Run with all 1600+ active customers
   - Monitor performance
   - Verify success rate

## Success Criteria

✅ Metrics calculate correctly with real dollar amounts
✅ Data persists across page refreshes
✅ Field mappings are configurable and saved
✅ Sync process is reliable with error handling
✅ UI provides clear feedback and progress
✅ Tool matches quality of Copper Import tool
