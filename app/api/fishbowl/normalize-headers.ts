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
      'customer id',
      'customerid',
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
    standardName: 'Shipped',
    aliases: [
      'shipped',
      'shipped amount',
      'shippedamount',
      'order total',
      'ordertotal',
      'order amount',
      'orderamount',
      'revenue',
      'order value',
      'ordervalue'
    ],
    description: 'Total shipped/fulfilled amount for the order'
  },
  {
    standardName: 'Ordered',
    aliases: [
      'ordered',
      'ordered amount',
      'orderedamount'
    ],
    description: 'Total ordered amount'
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
