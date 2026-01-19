/**
 * CSV Header Normalization System
 * 
 * Automatically maps various CSV header formats to standardized field names.
 * Handles case-insensitivity, whitespace variations, and common aliases.
 */

export interface HeaderMapping {
  standardName: string;
  aliases: string[];
  description: string;
}

/**
 * Standard field mappings for Fishbowl imports
 */
export const HEADER_MAPPINGS: HeaderMapping[] = [
  {
    standardName: 'Sales order Number',
    aliases: [
      'sales order number',
      'salesordernumber',
      'sales order num',
      'so number',
      'so num',
      'order number',
      'order num'
    ],
    description: 'Sales order number/ID'
  },
  {
    standardName: 'Sales Order ID',
    aliases: [
      'sales order id',
      'salesorderid',
      'so id',
      'soid',
      'order id',
      'orderid'
    ],
    description: 'Unique sales order identifier'
  },
  {
    standardName: 'SO Item ID',
    aliases: [
      'so item id',
      'soitemid',
      'so item',
      'line item id',
      'lineitemid',
      'item id'
    ],
    description: 'Line item identifier'
  },
  {
    standardName: 'Account ID',
    aliases: [
      'account id',
      'accountid',
      'cust id',
      'custid'
    ],
    description: 'Customer account identifier'
  },
  {
    standardName: 'Customer Name',
    aliases: [
      'customer name',
      'customername',
      'customer',
      'account name',
      'accountname'
    ],
    description: 'Customer company name'
  },
  {
    standardName: 'Issued date',
    aliases: [
      'issued date',
      'issueddate',
      'issue date',
      'issuedate',
      'date issued',
      'order date',
      'orderdate',
      'posting date',
      'postingdate'
    ],
    description: 'Order issue/posting date'
  },
  {
    standardName: 'Sales person',
    aliases: [
      'sales person',
      'salesperson',
      'sales rep',
      'salesrep',
      'rep',
      'sales representative',
      'salesrepresentative',
      'assigned rep',
      'assigned to'
    ],
    description: 'Sales representative assigned to order'
  },
  {
    standardName: 'Sales Rep',
    aliases: [
      'sales rep',
      'salesrep',
      'rep',
      'sales person',
      'salesperson'
    ],
    description: 'Sales rep (alternative field)'
  },
  {
    standardName: 'SO Item Product Number',
    aliases: [
      'so item product number',
      'product number',
      'productnumber',
      'product num',
      'part number',
      'partnumber',
      'part num',
      'sku',
      'item number',
      'product',
      'part description'
    ],
    description: 'Product/part number'
  },
  {
    standardName: 'Qty fulfilled',
    aliases: [
      'qty fulfilled',
      'qtyfulfilled',
      'quantity fulfilled',
      'qty',
      'quantity',
      'amount',
      'units'
    ],
    description: 'Quantity fulfilled'
  },
  {
    standardName: 'Unit price',
    aliases: [
      'unit price',
      'unitprice',
      'price',
      'unit cost',
      'unitcost',
      'cost'
    ],
    description: 'Unit price per item'
  },
  {
    standardName: 'Total Price',
    aliases: [
      'total price',
      'totalprice',
      'total',
      'total cost',
      'totalcost',
      'line total',
      'linetotal',
      'extended price',
      'extendedprice'
    ],
    description: 'Total line item price'
  },
  {
    standardName: 'Bill to name',
    aliases: [
      'bill to name',
      'bill_to_name',
      'billtoname',
      'billing name',
      'billingname'
    ],
    description: 'Billing contact name'
  },
  {
    standardName: 'Billing Address',
    aliases: [
      'billing address',
      'billing_address',
      'billingaddress',
      'bill to address',
      'bill_to_address',
      'billtoaddress'
    ],
    description: 'Billing street address'
  },
  {
    standardName: 'Billing City',
    aliases: [
      'billing city',
      'billing_city',
      'billingcity',
      'bill to city',
      'bill_to_city',
      'billtocity'
    ],
    description: 'Billing city'
  },
  {
    standardName: 'Billing State',
    aliases: [
      'billing state',
      'billing_state',
      'billingstate',
      'bill to state',
      'bill_to_state',
      'billtostate'
    ],
    description: 'Billing state/province'
  },
  {
    standardName: 'Billing Zip',
    aliases: [
      'billing zip',
      'billing_zip',
      'billingzip',
      'bill to zip',
      'bill_to_zip',
      'billtozip',
      'billing postal code',
      'billingpostalcode'
    ],
    description: 'Billing ZIP/postal code'
  },
  {
    standardName: 'Product ID',
    aliases: [
      'product id',
      'product_id',
      'productid',
      'prod id',
      'prod_id',
      'prodid'
    ],
    description: 'Product identifier'
  },
  {
    standardName: 'SO Status',
    aliases: [
      'so status',
      'sostatus',
      'order status',
      'orderstatus',
      'status'
    ],
    description: 'Sales order status'
  },
  {
    standardName: 'Product description',
    aliases: [
      'product description',
      'product_description',
      'productdescription',
      'prod description',
      'prod_description',
      'proddescription',
      'description'
    ],
    description: 'Product description'
  },
  {
    standardName: 'Sales Order Item Description',
    aliases: [
      'sales order item description',
      'so item description',
      'soitemdescription',
      'item description',
      'itemdescription',
      'line item description'
    ],
    description: 'Line item description'
  },
  {
    standardName: 'Soitem type',
    aliases: [
      'soitem type',
      'so item type',
      'soitemtype',
      'item type',
      'itemtype',
      'line type',
      'linetype'
    ],
    description: 'Line item type (Sale, Shipping, etc.)'
  },
  {
    standardName: 'BOL',
    aliases: [
      'bol',
      'bill of lading',
      'billoflading',
      'bol number',
      'bolnumber'
    ],
    description: 'Bill of lading number'
  },
  {
    standardName: 'Carrier name',
    aliases: [
      'carrier name',
      'carriername',
      'carrier',
      'shipping carrier',
      'shippingcarrier'
    ],
    description: 'Shipping carrier name'
  },
  {
    standardName: 'Company id',
    aliases: [
      'company id',
      'companyid',
      'company identifier'
    ],
    description: 'Company identifier'
  },
  {
    standardName: 'Company name',
    aliases: [
      'company name',
      'companyname',
      'company'
    ],
    description: 'Company name'
  },
  {
    standardName: 'Ship status',
    aliases: [
      'ship status',
      'shipstatus',
      'shipping status',
      'shippingstatus'
    ],
    description: 'Shipping status'
  },
  {
    standardName: 'Status ID',
    aliases: [
      'status id',
      'statusid',
      'status identifier'
    ],
    description: 'Status identifier'
  },
  {
    standardName: 'Sales Rep Initials',
    aliases: [
      'sales rep initials',
      'salesrepinitials',
      'rep initials',
      'repinitials',
      'initials'
    ],
    description: 'Sales rep initials'
  },
  {
    standardName: 'Fulfilled Quantity',
    aliases: [
      'fulfilled quantity',
      'fulfilledquantity',
      'qty fulfilled',
      'qtyfulfilled',
      'quantity fulfilled'
    ],
    description: 'Quantity fulfilled'
  },
  {
    standardName: 'Last Unit Price',
    aliases: [
      'last unit price',
      'lastunitprice',
      'last price',
      'lastprice'
    ],
    description: 'Last unit price'
  },
  {
    standardName: 'So ct',
    aliases: [
      'so ct',
      'soct',
      'so count',
      'socount'
    ],
    description: 'Sales order count'
  },
  {
    standardName: 'Sales Order Line Item',
    aliases: [
      'sales order line item',
      'so line item',
      'solineitem',
      'line item number',
      'lineitemnumber',
      'line number',
      'linenumber',
      'line item',
      'lineitem'
    ],
    description: 'Line item number/sequence'
  },
  {
    standardName: 'So c1',
    aliases: [
      'so c1',
      'soc1',
      'sales order custom 1',
      'so custom 1'
    ],
    description: 'Sales order custom field 1'
  },
  {
    standardName: 'So c2',
    aliases: [
      'so c2',
      'soc2',
      'sales order custom 2',
      'so custom 2'
    ],
    description: 'Sales order custom field 2'
  },
  {
    standardName: 'Sales Order Custom Field 3',
    aliases: [
      'sales order custom field 3',
      'so c3',
      'soc3',
      'so custom 3'
    ],
    description: 'Sales order custom field 3'
  },
  {
    standardName: 'So c4',
    aliases: [
      'so c4',
      'soc4',
      'sales order custom 4',
      'so custom 4'
    ],
    description: 'Sales order custom field 4'
  },
  {
    standardName: 'So c5',
    aliases: [
      'so c5',
      'soc5',
      'sales order custom 5',
      'so custom 5'
    ],
    description: 'Sales order custom field 5'
  },
  {
    standardName: 'Sales Order Custom Field 6',
    aliases: [
      'sales order custom field 6',
      'so c6',
      'soc6',
      'so custom 6'
    ],
    description: 'Sales order custom field 6'
  }
];

/**
 * Normalizes a header string for comparison
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Removes special characters
 */
function normalizeHeaderString(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[^a-z0-9]/g, ''); // Remove special characters
}

/**
 * Creates a mapping from CSV headers to standardized field names
 */
export function createHeaderMap(csvHeaders: string[]): Map<string, string> {
  const headerMap = new Map<string, string>();
  
  console.log('\n🔍 CSV Header Normalization:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // For each CSV header, find the best match
  for (const csvHeader of csvHeaders) {
    const normalizedCsv = normalizeHeaderString(csvHeader);
    let matched = false;
    
    // Try to find a match in our mappings
    for (const mapping of HEADER_MAPPINGS) {
      // Check if CSV header matches the standard name
      if (normalizeHeaderString(mapping.standardName) === normalizedCsv) {
        headerMap.set(csvHeader, mapping.standardName);
        console.log(`✅ "${csvHeader}" → "${mapping.standardName}" (exact match)`);
        matched = true;
        break;
      }
      
      // Check if CSV header matches any alias
      for (const alias of mapping.aliases) {
        if (normalizeHeaderString(alias) === normalizedCsv) {
          headerMap.set(csvHeader, mapping.standardName);
          console.log(`✅ "${csvHeader}" → "${mapping.standardName}" (via alias: "${alias}")`);
          matched = true;
          break;
        }
      }
      
      if (matched) break;
    }
    
    if (!matched) {
      // No match found - keep original header
      headerMap.set(csvHeader, csvHeader);
      console.log(`⚠️  "${csvHeader}" → "${csvHeader}" (no mapping found, using original)`);
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  return headerMap;
}

/**
 * Normalizes a CSV row object using the header map
 */
export function normalizeRow(row: any, headerMap: Map<string, string>): any {
  const normalizedRow: any = {};
  
  for (const [originalHeader, standardHeader] of headerMap.entries()) {
    if (row.hasOwnProperty(originalHeader)) {
      normalizedRow[standardHeader] = row[originalHeader];
    }
  }
  
  return normalizedRow;
}

/**
 * Gets a value from a row with fallback options
 */
export function getRowValue(row: any, ...fieldNames: string[]): any {
  for (const fieldName of fieldNames) {
    if (row.hasOwnProperty(fieldName) && row[fieldName] !== null && row[fieldName] !== undefined) {
      return row[fieldName];
    }
  }
  return undefined;
}

/**
 * Validates that required headers are present
 */
export function validateRequiredHeaders(headerMap: Map<string, string>): { valid: boolean; missing: string[] } {
  const requiredHeaders = [
    'Sales order Number',
    'Sales Order ID',
    'SO Item ID',
    'Account ID',
    'Customer Name',
    'Issued date',
    'Sales person'
  ];
  
  const standardHeaders = new Set(headerMap.values());
  const missing: string[] = [];
  
  for (const required of requiredHeaders) {
    if (!standardHeaders.has(required)) {
      missing.push(required);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Convenience function to normalize an array of CSV rows
 * Automatically creates header map and normalizes all rows
 */
export function normalizeHeaders(rows: any[]): any[] {
  if (rows.length === 0) return [];
  
  const headers = Object.keys(rows[0]);
  const headerMap = createHeaderMap(headers);
  
  return rows.map(row => normalizeRow(row, headerMap));
}
