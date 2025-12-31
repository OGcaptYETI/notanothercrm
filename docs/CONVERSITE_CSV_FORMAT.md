# Conversite CSV Format - Source of Truth

**CRITICAL: This is the ONLY data format we import. Do not use Fishbowl direct exports.**

Conversite is a data company that processes Fishbowl data and provides formatted exports for reporting and analysis.

## Key Principles

1. **Issued date is the ONLY date field used** (format: `MM-DD-YYYY HH:MM:SS`)
2. **Data is at LINE ITEM level** - each row represents one line item from a sales order
3. **Revenue is calculated by summing `Total Price` for all line items in an order**
4. **Orders can have multiple line items** (products, shipping, etc.)

## Column Definitions

### Date & Time Fields
- **Issued date**: Order issue date - THE ONLY DATE WE USE
  - Format: `MM-DD-YYYY HH:MM:SS` (e.g., `12-31-2024 19:21:32`)
  - Used for: Commission month/year calculation, posting date
- **Year-week**: Week identifier (e.g., `2024 W01`)
- **Year-month**: Month identifier (e.g., `December 2024`)
- **Year-quarter**: Quarter identifier (e.g., `2024 Q4`)
- **Year**: Year (e.g., `2024`)

### Customer Information
- **Account ID**: Customer account ID (numeric)
  - Used for: Customer identification
- **Account type**: Type of account (e.g., `Retail`, `Wholesale`)
- **Billing Name**: Customer billing name
- **Billing Address**: Street address
- **Billing City**: City
- **Billing State**: State/Province
- **Billing Zip**: ZIP/Postal code
- **Customer Name**: Display name for customer
  - Used for: Customer record creation/lookup
- **Customer id**: Customer identifier (numeric)
  - Used for: Primary customer ID in our system

### Sales Rep Information
- **Sales person**: **CRITICAL - ONLY FIELD WE USE** - Sales person name (e.g., `Jared`, `BrandonG`, `Sergio`)
  - Column T in CSV
  - Used for: **PRIMARY AND ONLY field for sales rep assignment and commission calculation**
  - Must match user records exactly for commission calculation
- **Sales Rep**: Rep identifier (e.g., `JL`, `BG`, `SF`)
  - Used for: Data reporting only - NOT used in commission calculation
- **Sales Rep Initials**: Rep initials (e.g., `JL`, `MC`)
  - Used for: Data reporting only - NOT used in commission calculation

### Product Information
- **Product ID**: Product ID (numeric)
- **Product**: Product name/description
  - Used for: Product identification
- **SO Item Product Number**: Product SKU/part number
  - Used for: Line item product identification
- **Product description**: Detailed product description
- **Sales Order Item Description**: Line item description

### Order Information
- **Sales order Number**: **PRIMARY ORDER IDENTIFIER** - Order number (numeric, e.g., `5811`)
  - Used for: **ONLY field for order identification in our system**
- **SO Number**: Same as Sales order Number (duplicate column name)
- **Sales Order ID**: Fishbowl internal ID assigned to the Sales order Number
  - Used for: Linking line items to orders (foreign key)
  - NOT the primary identifier - just Fishbowl's internal reference
- **SO ID**: Same as Sales Order ID (duplicate column name)
- **SO Status**: Order status (e.g., `Fulfilled`)
- **Status ID**: Status ID (numeric, e.g., `30`)
- **Ship status**: Shipping status (e.g., `Shipped`)

### Line Item Information
- **SO Item ID**: Line item ID (numeric)
  - Used for: Unique line item identifier
- **Soitem type**: Line item type (e.g., `Sale`, `Shipping`)
  - Used for: Identifying shipping/processing fees to exclude
- **Qty fulfilled**: Quantity fulfilled (numeric)
  - Used for: Line item quantity
- **Unit price**: Unit price per item (numeric with $ or decimal)
  - Used for: Line item unit price
- **Last Unit Price**: Last unit price
- **Total Price**: **CRITICAL** - Total price for this line item
  - Used for: **PRIMARY REVENUE CALCULATION**
  - Format: Numeric with $ or decimal (e.g., `$3,456.00` or `324.00`)
  - **This is what we sum to get order revenue**
- **Total cost**: Total cost for line item
- **Sales Order Line Item**: Line item sequence number (e.g., `1.00`, `2.00`)

### Shipping Information
- **BOL**: Bill of lading number
- **Carrier name**: Shipping carrier (e.g., `UPS`, `Will Call`)

### Company Information
- **Company id**: Company ID (numeric)
- **Company name**: Company name (e.g., `CWL Brands`)

### Custom Fields
- **So c1**: Sales Order Custom Field 1
- **So c2**: Sales Order Custom Field 2
- **Sales Order Custom Field 3**: Custom field 3
- **So c4**: Sales Order Custom Field 4
- **Sales Order Custom Field 5**: Custom field 5
- **Sales Order Custom Field 6**: Custom field 6
- **So ct**: Unknown custom field

### Other Fields
- **Account id2**: Duplicate of Account ID (will be deleted in future exports)

## How We Use This Data

### Order Import Process
1. **Group by Sales Order ID** - Multiple line items belong to one order
2. **Create/Update Order Record**:
   - `soNumber`: From `Sales order Number`
   - `salesOrderId`: From `Sales Order ID`
   - `customerId`: From `Customer id`
   - `customerName`: From `Customer Name`
   - `postingDate`: Parsed from `Issued date`
   - `commissionMonth`: Extracted from `Issued date` (YYYY-MM format)
   - `commissionYear`: Extracted from `Issued date` (YYYY)
   - `salesPerson`: From `Sales person`
   - `salesRep`: From `Sales Rep`

3. **Create Line Item Records**:
   - `soItemId`: From `SO Item ID`
   - `salesOrderId`: From `Sales Order ID`
   - `productNum`: From `SO Item Product Number`
   - `productName`: From `Product`
   - `quantity`: From `Qty fulfilled`
   - `unitPrice`: From `Unit price`
   - `totalPrice`: From `Total Price` (**CRITICAL FOR REVENUE**)
   - `itemType`: From `Soitem type`

### Commission Calculation
1. **Load orders for commission month** (based on `Issued date`)
2. **For each order**:
   - Load all line items where `salesOrderId` matches
   - Sum `totalPrice` for all line items (excluding shipping/CC processing if configured)
   - This sum is the **order revenue** for commission calculation
3. **Match sales person to user record**
4. **Apply commission rates** based on customer type and product

### Revenue Calculation Rules
- **Sum all line items** with `Soitem type` = `Sale`
- **Exclude shipping** if configured (where `Soitem type` = `Shipping` or product contains "shipping")
- **Exclude CC processing** if configured (where product contains "cc processing")
- **Include negative line items** (credits/refunds) - they reduce the commission base

## Ground Truth - December 2025

When processing December 2025 Conversite data, we MUST match these totals from Fishbowl:

| Sales Person | Revenue |
|--------------|---------|
| admin | $508,422.28 |
| BenW | $293,362.70 |
| BrandonG | $272,069.93 |
| DerekW | $250,622.49 |
| Jared | $160,362.70 |
| Zalak | $352,043.20 |
| **Grand Total** | **$1,836,883.30** |

## Example Data Row

```csv
12-31-2024 17:07:30,2024 W01,December 2024,2024 Q4,2024,511,Retail,Drip Botanical Tea Bar,6166 Gunn Hwy,Tampa,Florida,33625,Drip Botanical Tea Bar,,81,FG- MC12 Focus+ Flow,JL,5810,Fulfilled,Jared,,,,,,10711,32824,FG- MC12 Focus+ Flow,353,MC12 Focus + Flow,MC12 Focus + Flow,Sale,94788,UPS,1,CWL Brands,10711,Shipped,5810,30,511,6.00,$576.0000,1.00,$576.00,"$3,456.00","$1,050.80",1.00
```

**Interpretation:**
- Order #5810 for Drip Botanical Tea Bar
- Issued: 12-31-2024 17:07:30
- Sales person: **Jared** (this is the ONLY value we use for commission calculation)
- Product: MC12 Focus + Flow
- Quantity: 6
- Unit price: $576.00
- **Total Price: $3,456.00** (this is what counts for revenue)
- Line item type: Sale
- This is line item #1 of the order

## Important Notes

1. **Do NOT use Fishbowl direct exports** - They have different column names and structure
2. **Issued date is sacred** - It's the only date that matters for commission calculation
3. **Line items are the source of truth** - Always sum line items for revenue, never use order-level totals
4. **Handle currency formatting** - `Total Price` may have $ and commas (e.g., `$3,456.00`)
5. **Multiple line items per order** - Orders typically have product lines + shipping line
