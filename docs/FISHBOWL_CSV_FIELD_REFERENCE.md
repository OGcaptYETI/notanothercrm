# Fishbowl CSV Export Field Reference

**Source of Truth for Commission Calculation System**  
Last Updated: January 15, 2026

---

## CSV Headers (42 Fields)

```
Issued date, Account ID, Bill to name, Billing Address, Bill to city, Bill to state, 
Billing Zip, Customer, Default Sales Rep, Product ID, Sku, Sales order Number, 
Sales Order Status, Sales Rep, So c1, So c2, Sales Order Custom Field 3, So c4, 
So c5, So c6, Sales Order ID, SO Item ID, SO Item Product Number, Customer ID, 
Product Description, SO Item Description, Soitem type, BOL, Carrier Name, 
Company id, Company name, Ship status, SO Number, Status ID, Account ID, 
Sales Rep Initials, Fulfilled Quantity, Last Unit Price, So ct, Unit price, 
Total price, Total Cost, So line item
```

---

## Field Categories & Definitions

### 📅 Customer & Billing Information

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `Issued date` | Date when sales order was created/issued | `12-15-2025` | `commissionMonth`, `commissionYear` |
| `Account ID` | Unique numeric identifier for customer account | `2026` | `customerId` (primary) |
| `Bill to name` | Business/person name for invoice | `U V Distro` | *(not imported)* |
| `Billing Address` | Street address for billing | `123 Main St` | *(not imported)* |
| `Bill to city` | City portion of billing address | `Portland` | *(not imported)* |
| `Bill to state` | State portion of billing address | `OR` | *(not imported)* |
| `Billing Zip` | ZIP/postal code for billing | `97201` | *(not imported)* |
| `Customer` | Customer name (often same as Bill to name) | `U V Distro` | `customerName` |
| `Default Sales Rep` | Sales rep assigned to account by default | `Ben Wallner` | *(fallback for line items)* |
| `Customer ID` | Another unique identifier for customer | `2026` | `customerId` (alternate) |

### 📦 Product Information

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `Product ID` | Unique numeric identifier for product | `74` | `productNum` (fallback) |
| `Sku` | Stock Keeping Unit - product code | `KANVA-CBD-1000` | `productNum`, `partNumber` (fallback) |
| `Product Description` | Full description of product | `1000mg CBD Tincture` | `productName`, `description` |

### 📋 Sales Order Header Information

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `Sales order Number` | Human-readable order number | `9825` | `soNumber` |
| `Sales Order Status` | Current status of order | `Fulfilled`, `Estimate` | *(not imported)* |
| `Sales Rep` | Sales rep who processed this order | `Ben Wallner` | `salesPerson` (PRIMARY) |
| `So c1` - `So c6` | Custom fields for sales order | *(unused)* | *(not imported)* |
| `Sales Order Custom Field 3` | Another custom field | *(unused)* | *(not imported)* |
| `Sales Order ID` | Internal system ID for sales order | `12345` | `salesOrderId` (PRIMARY KEY) |

### 🛒 Line Item Information

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `SO Item ID` | Unique identifier for line item | `67890` | `soItemId` |
| `SO Item Product Number` | Product number/SKU at line item level | `KANVA-CBD-1000` | `product`, `productNum`, `partNumber` (PRIMARY) |
| `SO Item Description` | Description specific to line item | `1000mg CBD Tincture` or `Tracking: 1Z999AA1` | `description` (fallback) |
| `Soitem type` | Type of line item | `Sale`, `Shipping`, `Kit` | *(not imported)* |
| `So line item` | Line item number/sequence | `1`, `2`, `3` | *(not imported)* |

### 🚚 Shipping & Fulfillment

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `BOL` | Bill of Lading number | `BOL-12345` | *(not imported)* |
| `Carrier Name` | Shipping carrier used | `UPS` | *(not imported)* |
| `Ship status` | Current shipping status | `Shipped` | *(not imported)* |
| `SO Number` | Sales order number (duplicate) | `9825` | *(duplicate of Sales order Number)* |

### 🏢 Company Information

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `Company id` | Identifier for selling company | `1` | *(not imported)* |
| `Company name` | Name of selling company | `CWL Brands` | *(not imported)* |

### 🔢 Status & Identification

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `Status ID` | Numeric code for order status | `30` (Fulfilled), `0` (Estimate) | *(not imported)* |
| `Account ID` | (Duplicate column) Same as first Account ID | `2026` | *(duplicate)* |
| `Sales Rep Initials` | Abbreviated initials of sales rep | `BW`, `JL`, `DW`, `BG` | *(not imported)* |

### 💰 Financial/Quantity Data

| Field | Description | Example | Import Mapping |
|-------|-------------|---------|----------------|
| `Fulfilled Quantity` | Number of units actually shipped | `12` | `quantity` (PRIMARY) |
| `Last Unit Price` | Most recent unit price (cost basis) | `45.00` | *(not imported)* |
| `So ct` | Always "1" - possibly count/multiplier | `1` | *(not imported)* |
| `Unit price` | Price per unit charged to customer | `50.00` | `unitPrice` |
| `Total price` | Fulfilled Quantity × Unit Price | `600.00` | `totalPrice` (PRIMARY for commission) |
| `Total Cost` | Cost of goods sold for line item | `540.00` | *(not imported)* |

---

## 🔑 Critical Fields for Commission Calculation

### **Primary Keys:**
- `Sales Order ID` → `salesOrderId` (joins orders to line items)
- `SO Item ID` → `soItemId` (unique line item identifier)

### **Commission Calculation:**
- `Sales Rep` → `salesPerson` (determines who gets commission)
- `Total price` → `totalPrice` (commission base amount)
- `Fulfilled Quantity` → `quantity` (used for spiff calculations)
- `SO Item Product Number` → `productNum`, `partNumber` (spiff matching)
- `Product Description` → `productName` (shipping/CC exclusion logic)

### **Date/Period:**
- `Issued date` → `commissionMonth`, `commissionYear` (determines commission period)

### **Customer Matching:**
- `Account ID` → `customerId` (links to Copper CRM)
- `Customer` → `customerName` (fallback matching)

---

## 📊 Sales Rep Initials Mapping

| Initials | Full Name | salesPerson Value |
|----------|-----------|-------------------|
| `JL` | Jared Leuzinger | `Jared Leuzinger` |
| `DW` | Derek Whitworth | `Derek Whitworth` |
| `BW` | Ben Wallner | `Ben Wallner` |
| `BG` | Brandon Good | `Brandon Good` |

---

## ⚠️ Important Data Patterns

### **Shipping Lines Appear Twice:**
1. **Shipping Charge Line**: `Soitem type = "Shipping"`, has `Total price` for shipping cost
2. **Tracking Number Line**: `SO Item Description` contains tracking number (e.g., `Tracking: 1Z999AA1`)

### **Credit Card Processing Fee:**
- `Product ID = 74`
- Separate line item for CC processing fees
- Should be **excluded** from commission calculation per rules

### **Custom Fields:**
- `So c1` through `So c6` are currently **unused**
- Available for future custom data needs

---

## 🔧 Import Code Field Mapping

### **Sales Orders (`fishbowl_sales_orders`):**
```typescript
{
  soNumber: row['Sales order Number'],
  salesOrderId: row['Sales Order ID'],
  customerId: row['Account ID'] || row['Customer ID'],
  customerName: row['Customer'],
  salesPerson: row['Sales Rep'],
  salesRep: row['Sales Rep'], // Duplicate for reporting
  postingDate: parseDate(row['Issued date']),
  commissionMonth: "YYYY-MM",
  commissionYear: YYYY,
  accountType: // Determined from Copper CRM lookup
}
```

### **Line Items (`fishbowl_soitems`):**
```typescript
{
  soNumber: row['Sales order Number'],
  salesOrderId: row['Sales Order ID'],
  soItemId: row['SO Item ID'],
  customerId: row['Account ID'] || row['Customer ID'],
  customerName: row['Customer'],
  product: row['SO Item Product Number'],
  productNum: row['SO Item Product Number'],
  partNumber: row['SO Item Product Number'],
  productName: row['Product Description'],
  description: row['Product Description'],
  quantity: parseFloat(row['Fulfilled Quantity']),
  unitPrice: parseFloat(row['Unit price']),
  totalPrice: parseFloat(row['Total price']),
  salesPerson: row['Sales Rep'],
  postingDate: parseDate(row['Issued date']),
  commissionMonth: "YYYY-MM",
  commissionYear: YYYY
}
```

---

## 🎯 Commission Calculation Logic

### **Revenue Calculation:**
```
Commission Base = SUM(line_items.totalPrice) 
  WHERE Soitem type != 'Shipping'
  AND Product ID != 74 (CC Processing)
  AND quantity > 0
```

### **Commission Formula:**
```
Commission = Commission Base × Rate%
Rate = f(rep.title, customer.accountType, customer.status)
```

### **Spiff Calculation:**
```
Spiff = quantity × spiff.incentiveValue (if flat)
     OR totalPrice × spiff.incentiveValue% (if percentage)
WHERE productNum matches active spiff
```

---

## 📝 Data Quality Notes

1. **Duplicate Fields**: `Account ID` appears twice, `SO Number` duplicates `Sales order Number`
2. **Date Format**: `Issued date` uses MM-DD-YYYY format (Conversite standard)
3. **Fallback Logic**: Import uses multiple fallback fields for robustness
4. **Zero Quantity**: Orders with `Fulfilled Quantity = 0` are skipped in commission calculation
5. **Status Filtering**: Only `Status ID = 30` (Fulfilled) orders should be commissioned

---

## 🔍 Troubleshooting Guide

### **$0 Commission Issues:**
- ✅ Check `Fulfilled Quantity` > 0
- ✅ Verify `Sales Rep` matches active user in system
- ✅ Confirm `Account ID` links to customer with accountType != 'Retail'
- ✅ Check `Total price` is not negative (credits/refunds)
- ✅ Verify `Issued date` is valid and in correct commission month

### **Missing Orders:**
- ✅ Check `Sales Order Status` = "Fulfilled" (not "Estimate")
- ✅ Verify `Issued date` is within target commission month
- ✅ Confirm `Sales Rep` is not "admin" or "Shopify"

### **Spiff Not Applied:**
- ✅ Verify `SO Item Product Number` exactly matches spiff product number
- ✅ Check spiff is active for the order date period
- ✅ Confirm `Fulfilled Quantity` > 0

---

**End of Field Reference**
