# KanvaPortal Data Schema - Master Reference

**Last Updated:** January 20, 2026  
**Purpose:** Source of truth for all data relationships, field mappings, and CRM structure

---

## 🎯 Core Collections

### 1. copper_companies (Master Customer Record)
**Description:** Primary source of truth for all customer/company data  
**Document Count:** 1000+  
**Primary Key:** `id` (Copper ID)

#### Standard Fields

| Field Name | Data Type | Description | Example |
|------------|-----------|-------------|---------|
| `name` | Text | Company/business name | "The Mighty Quinn Smoke" |
| `details` | Text | Additional company details or notes | "Re-Allocation" |
| `email_domain` | Text | Company's email domain | "example.com" |
| `street` | Text | Street address | "3372 SANTA ROSA AVE." |
| `city` | Text | City location | "SANTA ROSA" |
| `state` | Text | State/province | "CA" |
| `postal_code` | Text | ZIP/postal code | "95407" |
| `country` | Text | Country location | "United States" |
| `assignee_id` | Number | Internal ID of account owner | 1198774 |
| `contact_type_id` | Number | Classification of contact relationship | 123456 |
| `tags` | Array | Labels/categories for organization | ["derek", "current accts"] |
| `date_last_contacted` | Timestamp | Date of most recent contact | 1/9/2026 |
| `interaction_count` | Number | Total number of interactions | 98 |
| `date_created` | Timestamp | Date record was created | 1/6/2025 |
| `date_modified` | Timestamp | Date record was last modified | 1/19/2026 |

#### Custom Fields (cf_*)

| Field ID | Field Name | Data Type | Description | Example | Lookup Target |
|----------|------------|-----------|-------------|---------|---------------|
| `cf_675914` | Account Type | Dropdown | Type of business account | "Wholesale" | - |
| `cf_680701` | Region | Dropdown | Geographic sales region | "Pacific Northwest" | - |
| `cf_698403` | Total Orders | Number | Total number of orders placed | 15 | - |
| `cf_698404` | Total Spent | Currency | Total amount customer has spent | 17172.56 | - |
| `cf_698405` | First Order Date | Date | Date of first purchase | 2/18/2025 | - |
| `cf_698406` | Last Order Date | Date | Date of most recent purchase | 1/13/2026 | - |
| `cf_698407` | Average Order Value | Currency | Average amount per order | 1144.84 | - |
| `cf_698467` | **Account Order ID** | Text | **Links to Fishbowl orders** | "CUST-12345" | `fishbowl_sales_orders.customerId` |
| `cf_712751` | Active Customer | Checkbox | Whether customer is currently active | true | - |
| `cf_713477` | **Account ID** | Text | **Unique account identifier** | "70961276" | - |
| `cf_713845` | Top Products | Text | Best-selling products for this account | "KB-3000 (62)" | - |
| `cf_713846` | Days Since Last Order | Number | Number of days since last purchase | 6 | - |

#### Relationships

**1:Many Relationships:**
- `copper_companies` → `copper_people` (One company has many contacts)
  - Link: `copper_companies.id` → `copper_people.company_id`
  
- `copper_companies` → `fishbowl_sales_orders` (One company has many orders)
  - Link: `copper_companies.cf_698467` → `fishbowl_sales_orders.customerId`
  
- `copper_companies` → `copper_opportunities` (One company has many opportunities)
  - Link: `copper_companies.id` → `copper_opportunities.company_id`

**1:1 Relationships:**
- `copper_companies` → `users` (One company assigned to one sales rep)
  - Link: `copper_companies.assignee_id` → `users.copper_user_id`

---

### 2. copper_people (Contacts)
**Description:** Individual contacts associated with companies  
**Document Count:** 1000+  
**Primary Key:** `id` (Copper Person ID)

#### Key Fields

| Field Name | Data Type | Description | Lookup Target |
|------------|-----------|-------------|---------------|
| `id` | Number | Unique person identifier | - |
| `name` | Text | Contact full name | - |
| `email` | Email | Contact email address | - |
| `phone_numbers` | Array | Contact phone numbers | - |
| `company_id` | Number | **Links to company** | `copper_companies.id` |
| `company_name` | Text | Company name (denormalized) | - |
| `title` | Text | Job title | - |
| `assignee_id` | Number | Sales rep assigned | `users.copper_user_id` |

#### Relationships

**Many:1 Relationships:**
- `copper_people` → `copper_companies` (Many contacts belong to one company)
  - Link: `copper_people.company_id` → `copper_companies.id`

---

### 3. fishbowl_sales_orders
**Description:** Sales order data from Fishbowl ERP  
**Document Count:** 1000+  
**Primary Key:** `id` (Fishbowl Order ID)

#### Key Fields

| Field Name | Data Type | Description | Lookup Target |
|------------|-----------|-------------|---------------|
| `id` | Text | Unique order identifier | - |
| `customerId` | Text | **Customer identifier** | `copper_companies.cf_698467` |
| `customerName` | Text | Customer name (denormalized) | - |
| `orderDate` | Timestamp | Date order was placed | - |
| `totalPrice` | Number | Total order amount | - |
| `status` | Text | Order status | - |
| `salesRep` | Text | Sales representative | `users.email` |
| `items` | Array | Order line items | - |

#### Relationships

**Many:1 Relationships:**
- `fishbowl_sales_orders` → `copper_companies` (Many orders belong to one company)
  - Link: `fishbowl_sales_orders.customerId` → `copper_companies.cf_698467`

**1:Many Relationships:**
- `fishbowl_sales_orders` → `fishbowl_sales_order_items` (One order has many line items)
  - Link: `fishbowl_sales_orders.id` → `fishbowl_sales_order_items.orderId`

---

### 4. fishbowl_sales_order_items
**Description:** Individual line items within sales orders  
**Document Count:** 1000+  
**Primary Key:** Composite (`orderId` + `lineItemId`)

#### Key Fields

| Field Name | Data Type | Description | Lookup Target |
|------------|-----------|-------------|---------------|
| `orderId` | Text | **Parent order ID** | `fishbowl_sales_orders.id` |
| `lineItemId` | Number | Line item number | - |
| `productNumber` | Text | Product SKU | - |
| `description` | Text | Product description | - |
| `quantity` | Number | Quantity ordered | - |
| `unitPrice` | Number | Price per unit | - |
| `totalPrice` | Number | Line item total | - |

---

### 5. users (Sales Reps & Staff)
**Description:** User accounts for portal access  
**Document Count:** ~20  
**Primary Key:** `uid` (Firebase Auth UID)

#### Key Fields

| Field Name | Data Type | Description | Lookup Target |
|------------|-----------|-------------|---------------|
| `uid` | Text | Firebase Auth UID | - |
| `email` | Email | User email address | `fishbowl_sales_orders.salesRep` |
| `displayName` | Text | Full name | - |
| `copper_user_id` | Number | **Copper CRM user ID** | `copper_companies.assignee_id` |
| `role` | Text | User role (admin, sales, etc.) | - |
| `isActive` | Boolean | Account active status | - |

---

### 6. monthly_commissions
**Description:** Monthly commission summaries for sales reps  
**Document Count:** ~100  
**Primary Key:** Composite (`userId` + `year` + `month`)

#### Key Fields

| Field Name | Data Type | Description | Lookup Target |
|------------|-----------|-------------|---------------|
| `userId` | Text | **User ID** | `users.uid` |
| `salesRep` | Text | Sales rep name | - |
| `year` | Number | Year | - |
| `month` | Number | Month (1-12) | - |
| `totalRevenue` | Number | Total sales revenue | - |
| `totalCommission` | Number | Total commission earned | - |
| `orderCount` | Number | Number of orders | - |

---

### 7. commission_details
**Description:** Individual order commission records  
**Document Count:** 1000+  
**Primary Key:** Composite (`orderId` + `userId`)

#### Key Fields

| Field Name | Data Type | Description | Lookup Target |
|------------|-----------|-------------|---------------|
| `orderId` | Text | **Order ID** | `fishbowl_sales_orders.id` |
| `userId` | Text | **User ID** | `users.uid` |
| `customerId` | Text | Customer ID | `copper_companies.cf_698467` |
| `orderDate` | Timestamp | Order date | - |
| `revenue` | Number | Order revenue | - |
| `commissionRate` | Number | Commission percentage | - |
| `commissionAmount` | Number | Commission earned | - |

---

## 🔗 Critical Relationships Map

### Primary Data Flow

```
copper_companies (Master)
    ├─→ copper_people (1:many via company_id)
    ├─→ fishbowl_sales_orders (1:many via cf_698467 → customerId)
    │   └─→ fishbowl_sales_order_items (1:many via orderId)
    ├─→ copper_opportunities (1:many via company_id)
    └─→ users (many:1 via assignee_id → copper_user_id)

fishbowl_sales_orders
    ├─→ commission_details (1:1 via orderId)
    └─→ users (many:1 via salesRep → email)

users
    └─→ monthly_commissions (1:many via uid → userId)
```

---

## 🎯 Key Lookup Fields

### Critical Linking Fields

1. **Company to Orders:**
   - `copper_companies.cf_698467` (Account Order ID) → `fishbowl_sales_orders.customerId`
   - **Type:** 1:many
   - **Purpose:** Link Copper customers to their Fishbowl orders

2. **Company to Contacts:**
   - `copper_companies.id` → `copper_people.company_id`
   - **Type:** 1:many
   - **Purpose:** Link companies to their contacts

3. **Company to Sales Rep:**
   - `copper_companies.assignee_id` → `users.copper_user_id`
   - **Type:** many:1
   - **Purpose:** Link companies to assigned sales rep

4. **Orders to Sales Rep:**
   - `fishbowl_sales_orders.salesRep` → `users.email`
   - **Type:** many:1
   - **Purpose:** Link orders to sales rep for commissions

5. **Orders to Line Items:**
   - `fishbowl_sales_orders.id` → `fishbowl_sales_order_items.orderId`
   - **Type:** 1:many
   - **Purpose:** Link orders to their line items

---

## 📊 Field Type Compatibility Matrix

| Source Type | Compatible Target Types | Notes |
|-------------|------------------------|-------|
| Text | Text, Email, Phone, URL | Direct match |
| Number | Number, Text | Number can be stored as text |
| Email | Email, Text | Email is specialized text |
| Phone | Phone, Text | Phone is specialized text |
| Date/Timestamp | Date, Timestamp, Number | Timestamps can be numbers |
| Boolean | Boolean, Text | Boolean can be "true"/"false" |
| Array | Array, Text | Arrays can be JSON strings |
| Currency | Number, Text | Currency is specialized number |
| Dropdown | Text | Dropdown values are text |

---

## 🚀 Recommended Mappings

### Essential Relationships to Define

1. **Customer Orders (CRITICAL)**
   ```
   copper_companies.cf_698467 → fishbowl_sales_orders.customerId
   Type: 1:many
   Purpose: View all orders for a customer
   ```

2. **Company Contacts**
   ```
   copper_companies.id → copper_people.company_id
   Type: 1:many
   Purpose: View all contacts for a company
   ```

3. **Sales Rep Assignment**
   ```
   copper_companies.assignee_id → users.copper_user_id
   Type: many:1
   Purpose: Identify account owner
   ```

4. **Order Line Items**
   ```
   fishbowl_sales_orders.id → fishbowl_sales_order_items.orderId
   Type: 1:many
   Purpose: View order details
   ```

5. **Commission Tracking**
   ```
   fishbowl_sales_orders.salesRep → users.email
   Type: many:1
   Purpose: Calculate commissions
   ```

---

## 📝 Notes

- **copper_companies** is the master customer record - all customer data should reference this
- **cf_698467** (Account Order ID) is the critical link between Copper and Fishbowl
- Always use **cf_713477** (Account ID) as the unique identifier for companies
- **Active Customer** flag (cf_712751) should be used to filter active accounts
- All custom fields in Copper start with `cf_` prefix followed by the field ID

---

## 🔄 Data Sync Strategy

1. **Copper → Portal:** Sync company and contact data nightly
2. **Fishbowl → Portal:** Import orders and line items daily
3. **Portal → Copper:** Update sales metrics (Total Orders, Total Spent, etc.) weekly
4. **Commission Calculation:** Run monthly on the 1st of each month

---

## 🛠️ Usage in Schema Mapper

When using the Visual Schema Mapper:

1. **Start with copper_companies** - it's the master record
2. **Use cf_698467** to link to orders
3. **Use id** to link to contacts
4. **Use assignee_id** to link to sales reps
5. **Validate field types** match the compatibility matrix
6. **Document all relationships** for future reference

---

*This schema is the source of truth for all data relationships in KanvaPortal. Update this document whenever new collections or relationships are added.*
