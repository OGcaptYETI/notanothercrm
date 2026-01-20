# Complete Firestore Schema Report

**Generated:** 2026-01-20T22:27:36.099Z

**This shows REAL Firestore document fields from your database**

---

## Summary

- **Collections:** 54
- **Total Documents:** 398257
- **Relationships Found:** 6

---

## Collections

### activities

**Documents:** 4
**Fields:** 6

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `activity` | string | 4 | Phone Calls |
| `goal` | number | 4 | 1200 |
| `subWeight` | number | 4 | 0.3 |
| `dataSource` | string | 4 | JustCall |
| `active` | boolean | 4 | true |
| `notes` | string | 4 | Outbound |

### admin

**Documents:** 1
**Fields:** 8

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `0` | string | 1 | ben@kanvabotanicals.com |
| `2` | string | 1 | rob@cwlbrands.com |
| `migratedAt` | timestamp | 1 | 2025-07-20T15:57:02.788Z |
| `emails` | array | 1 | ["ben@kanvabotanicals.com","admin@kanvabotanicals. |
| `createdAt` | timestamp | 1 | 2025-07-20T20:10:20.688Z |
| `lastUpdated` | string | 1 | 2025-07-20T20:10:20.688Z |
| `description` | string | 1 | Admin notification email addresses for Kanva Quote |
| `updatedAt` | timestamp | 1 | 2025-07-20T20:10:20.688Z |

### cache_reprally

**Documents:** 11
**Fields:** 19

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `updatedAt` | timestamp | 11 | 2025-12-30T00:55:16.955Z |
| `customers` | array | 9 | [{"reprallyOrders":21,"businessName":"SACRAMENTO C |
| `totalChunks` | number | 8 | 6 |
| `chunkIndex` | number | 8 |  |
| `switcherCount` | number | 1 |  |
| `totalRevenue` | number | 1 | 3518898.3999999855 |
| `reprallyCustomers` | number | 1 | 1502 |
| `avgOrderValue` | number | 1 | 355.5161042634861 |
| `totalCustomers` | number | 1 | 2876 |
| `retailRevenue` | number | 1 | 813908.759999993 |
| `retailCustomers` | number | 1 | 1374 |
| `retailOrders` | number | 1 | 4524 |
| `reprallyRevenue` | number | 1 | 2704989.6399999615 |
| `buildDurationMs` | number | 1 | 30775 |
| `topSkus` | array | 1 | [{"productName":"BX12 Focus + Flow","revenue":2045 |
| `topStates` | array | 1 | [{"count":463,"state":"California","revenue":98671 |
| `reprallyOrders` | number | 1 | 5374 |
| `count` | number | 1 |  |
| `switchers` | array | 1 | [] |

### commission_audit_log

**Documents:** 98
**Fields:** 11

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `action` | string | 50 | customer_correction |
| `orderNumber` | string | 50 | 10017 |
| `oldCustomerId` | string | 50 | 2026 |
| `newCustomerId` | string | 50 | 2026 |
| `newCustomerName` | string | 50 | Numia Healing |
| `accountType` | string | 50 | Wholesale |
| `rememberCorrection` | boolean | 50 | true |
| `reason` | string | 50 | Manual correction via validation UI |
| `correctedBy` | string | 50 | admin |
| `timestamp` | timestamp | 50 | 2026-01-15T22:23:00.755Z |
| `accountTypeOverride` | boolean | 40 | true |

### commission_calc_progress

**Documents:** 29
**Fields:** 11

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `totalOrders` | number | 29 | 194 |
| `currentRep` | string | 29 |  |
| `currentCustomer` | string | 29 |  |
| `currentOrderNum` | string | 29 |  |
| `stats` | object | 29 | {"commissionsCalculated":0,"totalCommission":0,"ad |
| `startedAt` | timestamp | 29 | 2026-01-13T01:27:17.088Z |
| `percentage` | number | 29 | 100 |
| `currentOrder` | number | 29 | 194 |
| `status` | string | 29 | complete |
| `updatedAt` | timestamp | 29 | 2026-01-13T01:27:35.682Z |
| `completedAt` | timestamp | 28 | 2026-01-13T01:27:35.682Z |

### commission_calculation_logs

**Documents:** 1701
**Fields:** 18

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `id` | string | 50 | log_10031_1768845259342 |
| `commissionMonth` | string | 50 | 2025-01 |
| `orderNum` | string | 50 | 5575 |
| `orderId` | string | 50 | 10031 |
| `customerName` | string | 50 | Aimrok Nashville |
| `repName` | string | 50 | Jared Leuzinger |
| `repTitle` | string | 50 | Account Executive |
| `salesPerson` | string | 50 | Jared |
| `customerSegment` | string | 50 | Wholesale |
| `customerStatus` | string | 50 | 6month |
| `accountType` | string | 50 | Wholesale |
| `orderAmount` | number | 50 | 32172 |
| `commissionRate` | number | 50 | 8 |
| `commissionAmount` | number | 50 | 2573.76 |
| `rateSource` | string | 50 | configured |
| `calculatedAt` | timestamp | 50 | 2026-01-19T17:54:19.342Z |
| `orderDate` | timestamp | 50 | 2025-01-06T07:00:00.000Z |
| `notes` | string | 50 | Wholesale - 6month - Wholesale |

### copperLogs

**Documents:** 1
**Fields:** 2

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `payload` | object | 1 | {} |
| `createdAt` | timestamp | 1 | 2025-09-18T21:52:14.233Z |

### copperSummaries

**Documents:** 1
**Fields:** 2

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `payload` | object | 1 | {} |
| `createdAt` | timestamp | 1 | 2025-09-18T21:52:14.833Z |

### copper_companies

**Documents:** 269872
**Fields:** 147

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `id` | number | 50 | 70899031 |
| `importedAt` | timestamp | 50 | 2025-10-09T15:46:07.809Z |
| `source` | string | 50 | copper_export |
| `copperUrl` | string | 50 | https://app.copper.com/auth/auto_login?redirect_ur |
| `Name` | string | 50 | Budsglassjoint |
| `Owned By` | string | 50 | Joe Simmons |
| `Owner Id` | number | 50 | 1168901 |
| `Interaction Count` | string | number | 50 |  |
| `Created At` | number | 50 | 45657 |
| `Updated At` | number | 50 | 45937 |
| `Active Customer cf_712751` | string | boolean | 50 | unchecked |
| `Account ID cf_713477` | number | string | 50 | 70899031 |
| `Copper ID` | number | 50 | 70899031 |
| `name` | string | 50 | Budsglassjoint |
| `email` | string | 50 |  |
| `phone` | string | 50 |  |
| `street` | string | 50 | 47 Nubb Rainey Rd |
| `city` | string | 50 | Hattiesburg |
| `state` | string | 50 | Mississippi |
| `zip` | string | number | 50 | 39401-9711 |
| `country` | string | 50 | United States |
| `updatedAt` | timestamp | string | 50 | 2025-10-09T15:46:07.809Z |
| `Primary Contact` | string | 49 | Hello |
| `Primary Contact ID` | number | 49 | 169871120 |
| `Last Contacted` | number | 49 | 45660 |
| `Inactive Days` | number | string | 49 | 278 |
| `Credit Limit cf_712752` | string | 47 | USD |
| `Value cf_712752` | string | 47 |  |
| `Last Modified Date cf_712754` | number | 47 | 45937 |
| `Tags` | string | 41 | derek current accts import-1736196854038 |
| `State` | string | 36 | Mississippi |
| `Street` | string | 35 | 47 Nubb Rainey Rd |
| `Postal Code` | string | 35 | 39401-9711 |
| `Account Order ID cf_698467` | string | 34 | 1160 |
| `cf_675914` | array | 34 | [2063862] |
| `cf_726552` | null | number | 34 | 2142924 |
| `cf_675910` | null | 34 |  |
| `cf_712751` | boolean | 34 | true |
| `cf_680701` | number | null | 34 | 2017104 |
| `cf_698121` | null | number | 34 | 2063750 |
| `cf_698362` | null | number | 34 | 2065275 |
| `cf_699010` | null | 34 |  |
| `cf_712755` | array | 34 | [] |
| `cf_712754` | number | null | 34 | 1759816800 |
| `cf_698367` | null | 34 |  |
| `cf_712753` | null | 34 |  |
| `details` | string | 34 |  |
| `cf_698366` | null | 34 |  |
| `cf_712752` | number | null | 34 |  |
| `cf_698402` | null | number | 34 | 2066205 |
| `cf_699977` | null | 34 |  |
| `cf_724370` | array | 34 | [] |
| `cf_698404` | null | number | 34 | 700432.2 |
| `cf_699413` | null | 34 |  |
| `cf_713846` | null | number | 34 | 21 |
| `cf_698403` | null | number | 34 | 25 |
| `cf_699414` | array | 34 | [] |
| `cf_713845` | null | string | 34 | FG- MC12 Focus+ Flow, FG- MC12 Focus+ Flow, KB-400 |
| `custom_fields_raw` | array | 34 | [{"id":675914,"value":[2063862]},{"id":680701,"val |
| `cf_698406` | null | number | 34 | 1761721200 |
| `cf_698405` | null | number | 34 | 1678777200 |
| `cf_711949` | null | 34 |  |
| `cf_698407` | null | number | 34 | 28017.29 |
| `cf_724388` | null | 34 |  |
| `cf_698409` | null | 34 |  |
| `cf_724387` | null | 34 |  |
| `copper_raw_data` | object | 34 | {"id":70961188,"name":"Smoekshop LLC","address":{" |
| `cf_700318` | null | 34 |  |
| `interaction_count` | number | 34 | 56 |
| `tags` | array | 34 | ["derek current accts import-1736196854038","fishb |
| `cf_698130` | number | null | 34 | 2063797 |
| `cf_698257` | null | 34 |  |
| `cf_698256` | null | 34 |  |
| `cf_698259` | null | number | 34 | 2064435 |
| `cf_715755` | boolean | 34 |  |
| `cf_698219` | null | string | 34 | . |
| `cf_706523` | null | 34 |  |
| `cf_706522` | null | 34 |  |
| `cf_706521` | null | 34 |  |
| `cf_698460` | null | 34 |  |
| `cf_698462` | null | number | 34 | 2066264 |
| `cf_698464` | null | number | 34 | 2066266 |
| `cf_698149` | null | number | 34 | 2063875 |
| `socials` | array | 34 | [] |
| `cf_698148` | null | 34 |  |
| `cf_698467` | string | 34 | 1160 |
| `cf_698503` | null | 34 |  |
| `assignee_id` | number | 34 | 1168894 |
| `cf_702078` | array | 34 | [] |
| `cf_697979` | null | string | 34 | SANTA BARBARA |
| `address` | object | 34 | {"street":"446 Market St","city":"Saddle Brook","s |
| `cf_724366` | array | 34 | [] |
| `cf_702077` | array | 34 | [] |
| `date_created` | number | 34 | 1736196903 |
| `cf_700535` | null | 34 |  |
| `cf_724368` | array | 34 | [] |
| `cf_700533` | array | 34 | [] |
| `cf_700534` | array | 34 | [] |
| `cf_706515` | null | 34 |  |
| `phone_numbers` | array | 34 | [] |
| `cf_698471` | array | 34 | [] |
| `cf_713477` | string | 34 | 74820832 |
| `date_modified` | number | 34 | 1768342372 |
| `cf_698472` | array | 34 | [] |
| `cf_697980` | null | string | 34 | RANA S AND T ENTERPRISES CORP |
| `cf_698475` | null | string | 34 | Independent |
| `email_domain` | string | 34 |  |
| `cf_698356` | null | number | 34 | 2065272 |
| `websites` | array | 34 | [] |
| `cf_702072` | null | 34 |  |
| `cf_698434` | null | number | 34 | 2066218 |
| `cf_717639` | string | null | 34 | Unassigned |
| `syncedFromCopperApiAt` | timestamp | 34 | 2026-01-14T22:29:18.012Z |
| `Region cf_680701` | string | number | null | 24 | Midwest |
| `Contact Type` | string | 18 | Potential Customer |
| `Account Type cf_675914` | array | 18 | [1981470] |
| `cf_724385` | boolean | 18 |  |
| `State cf_698130` | string | 9 | OH |
| `Email Domain` | string | 8 | budsglassjoint.com |
| `City` | string | 8 | Hattiesburg |
| `Details` | string | 6 | Overview: The Roosevelt Row Head Shop.

Approx. Nu |
| `Website` | string | 5 | http://www.budsglassjoint.com |
| `Website Type` | string | 5 | work |
| `Social` | string | 3 | https://www.linkedin.com/company/buds-glass-co |
| `Social Type` | string | 3 | linkedin |
| `Segment cf_698149` | string | 3 | Smoke & Vape |
| `Country` | string | 2 | United States |
| `Account Opportunity cf_698259` | string | 2 | High-Value |
| `Business Model cf_698356` | string | 2 | Wholesale Only |
| `Phone Number` | number | string | 2 | 9526527227 |
| `Phone Number Type` | string | 2 | work |
| `Social 2` | string | 1 | https://twitter.com/BudsGlassJoint |
| `Social 2 Type` | string | 1 | twitter |
| `Social 3` | string | 1 | http://www.crunchbase.com/organization/buds-glass- |
| `Social 3 Type` | string | 1 | other |
| `Website 2` | string | 1 | https://www.buddhasbazaar.com/blog-feed.xml |
| `Website 2 Type` | string | 1 | work |
| `Customer Priority cf_698121` | number | 1 | 3 |
| `Organization Level cf_698362` | string | 1 | Corp HQ |
| `Reseller Permit cf_698402` | string | 1 | YES |
| `Total Orders cf_698403` | number | 1 | 22 |
| `Payment Terms cf_698434` | string | 1 | ACH |
| `Shipping Terms cf_698462` | string | 1 | Prepaid |
| `Carrier Name cf_698464` | string | 1 | LTL Freight Carrier |
| `County cf_697979` | string | 1 | SAN FRANCISCO |
| `Tax Entity cf_697980` | string | 1 | SHARIFI BROTHERS INVESTMENTS |
| `Parent Account cf_698475` | string | 1 | Independent |

### copper_leads

**Documents:** 4328
**Fields:** 86

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `Account` | string | 50 | Discontent Lifestyle Stores |
| `Account Number cf_698260` | string | 50 |  |
| `Converted Contact Id` | string | 50 |  |
| `Converted Currency` | string | 50 | USD |
| `Email` | string | 50 | wtmanagerteam@gmail.com |
| `End Time cf_698257` | string | 50 |  |
| `Follow-Up Date cf_683961` | string | 50 |  |
| `Owned By` | string | 50 | Joe Simmons |
| `Customer Priority cf_698121` | string | 50 |  |
| `First Name` | string | 50 | Aaron |
| `Organization Level cf_698362` | string | 50 |  |
| `Phone Number 2` | string | 50 |  |
| `source` | string | 50 | copper_export |
| `Secondary Contact cf_699414 people ids` | string | 50 |  |
| `Converted At` | string | 50 |  |
| `Last Status At` | string | 50 | 6/18/2025 |
| `Owner Id` | string | 50 | 1168901 |
| `Inactive Days` | string | 50 | 0 |
| `Currency` | string | 50 |  |
| `Street` | string | 50 |  |
| `Email Type` | string | 50 | work |
| `id` | number | 50 | 91461853 |
| `Tags` | string | 50 | prospect reload-1750285540722 |
| `Work Email cf_698503` | string | 50 |  |
| `Status` | string | 50 | New |
| `copperUrl` | string | 50 | https://app.copper.com/auth/auto_login?redirect_ur |
| `Converted Value` | string | 50 |  |
| `Social 3 Type` | string | 50 |  |
| `Postal Code` | string | 50 |  |
| `Trade Show Name cf_699977` | string | 50 |  |
| `Account Notes cf_698219` | string | 50 |  |
| `City` | string | 50 | St Cloud |
| `Converted Opportunity Id` | string | 50 |  |
| `firstName` | string | 50 | Aaron |
| `Details` | string | 50 | Sent email |
| `Suffix` | string | 50 |  |
| `Business Model cf_698356` | string | 50 |  |
| `phone` | string | 50 | (320) 253-7473 |
| `State` | string | 50 |  |
| `Value` | string | 50 |  |
| `Website Type` | string | 50 |  |
| `name` | string | 50 | Aaron LASTname |
| `Country` | string | 50 |  |
| `Last Name` | string | 50 | LASTname |
| `Segment cf_698149` | string | 50 |  |
| `Last Contacted` | string | 50 | 10/1/2025 |
| `status` | string | 50 | New |
| `2nd Contanct cf_699413` | string | 50 |  |
| `lastName` | string | 50 | LASTname |
| `Lead Temperature cf_698148` | string | 50 |  |
| `Copper ID` | string | 50 | 91461853 |
| `Phone Number 2 Type` | string | 50 |  |
| `Product Categories of Interest cf_698447` | string | 50 |  |
| `Website` | string | 50 |  |
| `Middle Name` | string | 50 |  |
| `Start Time cf_698256` | string | 50 |  |
| `Prefix` | string | 50 |  |
| `Exchange Rate` | string | 50 |  |
| `Updated At` | string | 50 | 10/1/2025 |
| `Interaction Count` | string | 50 | 11 |
| `Social Type` | string | 50 |  |
| `Source` | string | 50 |  |
| `Phone Number Type` | string | 50 | work |
| `Sale Type cf_710692` | string | 50 |  |
| `Prospect Notes cf_698137` | string | 50 |  |
| `Social 3` | string | 50 |  |
| `company` | string | 50 |  |
| `Account Order ID cf_698467` | string | 50 |  |
| `email` | string | 50 | wtmanagerteam@gmail.com |
| `Created At` | string | 50 | 6/18/2025 |
| `Social` | string | 50 |  |
| `importedAt` | timestamp | 50 | 2025-10-03T00:05:16.517Z |
| `Social 2` | string | 50 |  |
| `Secondary Contact cf_699414 people names` | string | 50 |  |
| `Title` | string | 50 |  |
| `Account Type cf_675914` | string | 50 |  |
| `County cf_697979` | string | 50 |  |
| `Parent Account cf_698475` | string | 50 |  |
| `Tax Entity cf_697980` | string | 50 |  |
| `Parent Account Number cf_698367` | string | 50 |  |
| `Region cf_680701` | string | 50 | Midwest |
| `State cf_698130` | string | 50 | MN |
| `Social 2 Type` | string | 50 |  |
| `Main Phone cf_699010` | string | 50 |  |
| `Account Opportunity cf_698259` | string | 50 |  |
| `Phone Number` | string | 50 | (320) 253-7473 |

### copper_opportunities

**Documents:** 357
**Fields:** 139

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `Account Number cf_698260` | string | 50 |  |
| `Owner` | string | 50 | Brandon Good |
| `Customer Priority cf_698121` | string | 50 |  |
| `Ship To Address cf_712768` | string | 50 |  |
| `Location cf_712765` | string | 50 |  |
| `Owner Id` | string | 50 | 1168899 |
| `Currency` | string | 50 |  |
| `Stage` | string | 50 | Payment Received |
| `Products Involved cf_705070` | string | 50 |  |
| `id` | number | 50 | 33569890 |
| `Last Modified cf_712761` | string | 50 |  |
| `Tags` | string | 50 | brandon leads-1736199730257 |
| `Work Email cf_698503` | string | 50 |  |
| `Primary Person Contact` | string | 50 | Sarah Mcdaniel |
| `Status` | string | 50 | Won |
| `copperUrl` | string | 50 | https://app.copper.com/auth/auto_login?redirect_ur |
| `Converted Value` | string | 50 |  |
| `Trade Show Name cf_699977` | string | 50 |  |
| `Free Samples Included cf_698431` | string | 50 |  |
| `Acrylic Displays White (Acrylic-007) cf_698424` | string | 50 |  |
| `Value cf_712758` | string | 50 |  |
| `ShipStation Order # cf_706512` | string | 50 |  |
| `Details` | string | 50 |  |
| `Special Bundles/Kits cf_698430` | string | 50 |  |
| `Business Model cf_698356` | string | 50 |  |
| `Delivery Date cf_706517` | string | 50 |  |
| `Value cf_706520` | string | 50 |  |
| `Win Probability` | string | 50 | 100% |
| `Processing Fees cf_698428` | string | 50 |  |
| `Segment cf_698149` | string | 50 |  |
| `status` | string | 50 | Won |
| `Order Notes cf_698401` | string | 50 |  |
| `Copper ID` | string | 50 | 33569890 |
| `Special Offers cf_698400` | string | 50 |  |
| `Salesman ID cf_712763` | string | 50 |  |
| `Target Completion Date cf_705066` | string | 50 |  |
| `Acrylic Displays Black (Acrylic-008) cf_698423` | string | 50 |  |
| `Completed Date` | string | 50 | 1/28/2025 |
| `Date Created cf_712760` | string | 50 |  |
| `Value cf_698438` | string | 50 |  |
| `Value cf_698439` | string | 50 |  |
| `Project Category cf_705064` | string | 50 |  |
| `Primary Products Ordered cf_698446` | string | 50 |  |
| `Sale Type cf_710692` | string | 50 |  |
| `Payment Status cf_698399` | string | 50 |  |
| `Ship To Zip cf_712770` | string | 50 |  |
| `Shipping Status cf_706518` | string | 50 |  |
| `FOB Point cf_712772` | string | 50 |  |
| `Order Status cf_698397` | string | 50 |  |
| `Account Order ID cf_698467` | string | 50 |  |
| `Customer PO cf_712764` | string | 50 |  |
| `Executive Approval Required cf_705075` | string | 50 | unchecked |
| `Priority Level cf_705065` | string | 50 |  |
| `Secondary Contact cf_699414 people names` | string | 50 |  |
| `Pipeline` | string | 50 | Sales Pipeline |
| `Salesman cf_712762` | string | 50 |  |
| `Value cf_698427` | string | 50 |  |
| `pipeline` | string | 50 | Sales Pipeline |
| `Value cf_698428` | string | 50 |  |
| `Date Completed cf_712759` | string | 50 |  |
| `stage` | string | 50 | Payment Received |
| `Close Date` | string | 50 | 2/21/2025 |
| `Lead Created At` | string | 50 | 1/21/2025 |
| `Shipping Amount cf_698427` | string | 50 |  |
| `Executive Approval Status cf_705076` | string | 50 |  |
| `Reseller Permit cf_698402` | string | 50 |  |
| `Sync Status cf_698445` | string | 50 |  |
| `Special Instructions cf_698432` | string | 50 |  |
| `Company` | string | 50 | Mountain High Wellness |
| `Converted Currency` | string | 50 | USD |
| `Last Stage At` | string | 50 | 3/21/2025 |
| `Organization Level cf_698362` | string | 50 |  |
| `source` | string | 50 | copper_export |
| `Estimated Budget cf_705067` | string | 50 |  |
| `Secondary Contact cf_699414 people ids` | string | 50 |  |
| `Name` | string | 50 | Mountain High Wellness |
| `Actual Delivery Date cf_698437` | string | 50 |  |
| `Company Id` | string | 50 | 71094766 |
| `Ship Date cf_698436` | string | 50 |  |
| `Focus+Flow 12PM (KB-3000) cf_698412` | string | 50 |  |
| `Inactive Days` | string | 50 | 2 |
| `Residential Delivery cf_712771` | string | 50 | unchecked |
| `Value cf_705067` | string | 50 |  |
| `Tracking # cf_706515` | string | 50 |  |
| `Project Owner cf_705068 user names` | string | 50 |  |
| `Tax Amount cf_698439` | string | 50 |  |
| `Priority` | string | 50 | None |
| `Lifetime Shipping Spend cf_706520` | string | 50 |  |
| `Value cf_698441` | string | 50 |  |
| `Value cf_698440` | string | 50 |  |
| `Service cf_706514` | string | 50 |  |
| `Payment Terms cf_698434` | string | 50 |  |
| `SO Number cf_698395` | string | 50 |  |
| `Ship To Name cf_712767` | string | 50 |  |
| `Subtotal cf_698438` | string | 50 |  |
| `companyId` | string | 50 | 71094766 |
| `Mango Extract 12PK (KB-3003) cf_698421` | string | 50 |  |
| `Mango Extract Single (KB-2003) cf_698420` | string | 50 |  |
| `Tax Included cf_712757` | string | 50 | unchecked |
| `Value` | string | 50 |  |
| `name` | string | 50 | Mountain High Wellness |
| `Discount Amount cf_698440` | string | 50 |  |
| `Focus+Flow Single Bottles (KB-2000) cf_698411` | string | 50 |  |
| `Last Contacted` | string | 50 | 9/29/2025 |
| `Last Sync Date cf_698444` | string | 50 |  |
| `Days in Stage` | string | 50 | 194 |
| `Lead Temperature cf_698148` | string | 50 |  |
| `Tracking Number cf_698433` | string | 50 |  |
| `Mango Extract MC12 (KB-4003) cf_698422` | string | 50 |  |
| `Carrier cf_706513` | string | 50 |  |
| `Exchange Rate` | string | 50 |  |
| `Updated At` | string | 50 | 9/29/2025 |
| `Focus+Flow MC12 (KB-4000) cf_698413` | string | 50 |  |
| `Interaction Count` | string | 50 | 72 |
| `Date Issued cf_698396` | string | 50 |  |
| `Source` | string | 50 |  |
| `Cost cf_712758` | string | 50 |  |
| `Company Mission Statement cf_710030` | string | 50 |  |
| `Prospect Notes cf_698137` | string | 50 |  |
| `company` | string | 50 | Mountain High Wellness |
| `value` | string | 50 |  |
| `Created At` | string | 50 | 1/21/2025 |
| `Lifetime Shipments cf_706519` | string | 50 |  |
| `importedAt` | timestamp | 50 | 2025-10-03T00:02:50.944Z |
| `Project Owner cf_705068 user ids` | string | 50 |  |
| `Ship To City cf_712769` | string | 50 |  |
| `Notes cf_675910` | string | 50 |  |
| `QB Class cf_712766` | string | 50 |  |
| `Account Type cf_675914` | string | 50 |  |
| `Order Total cf_698441` | string | 50 |  |
| `Parent Account cf_698475` | string | 50 |  |
| `Loss Reason` | string | 50 |  |
| `Fishbowl Status cf_698443` | string | 50 |  |
| `Region cf_680701` | string | 50 |  |
| `State cf_698130` | string | 50 |  |
| `primaryContact` | string | 50 | Sarah Mcdaniel |
| `Main Phone cf_699010` | string | 50 |  |
| `Account Opportunity cf_698259` | string | 50 |  |
| `Shipping Method cf_698435` | string | 50 |  |

### copper_people

**Documents:** 75716
**Fields:** 67

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `cf_675914` | array | 50 | [] |
| `country` | string | 50 | US |
| `cf_675910` | null | string | 50 | reseller permit |
| `cf_675913` | null | 50 |  |
| `companyName` | string | 50 | Bud's Glass Joint |
| `postalCode` | string | 50 |  |
| `source` | string | 50 | copper_api_direct |
| `cf_680701` | number | null | 50 | 2024067 |
| `cf_698362` | null | 50 |  |
| `cf_699010` | null | 50 |  |
| `cf_698367` | null | 50 |  |
| `id` | number | 50 | 169871118 |
| `state` | string | 50 |  |
| `cf_699415` | array | 50 | [] |
| `cf_698404` | null | 50 |  |
| `cf_699413` | null | 50 |  |
| `cf_698447` | array | 50 | [] |
| `cf_699414` | array | 50 | [] |
| `cf_712756` | array | 50 | [] |
| `cf_675906` | null | string | 50 | Michelle Kruger |
| `cf_675909` | null | 50 |  |
| `companyId` | number | null | 50 | 71520784 |
| `cf_698130` | null | number | 50 | 2063804 |
| `phone` | string | 50 |  |
| `cf_698257` | null | 50 |  |
| `cf_698256` | null | 50 |  |
| `cf_698259` | null | 50 |  |
| `cf_698137` | null | 50 |  |
| `cf_698219` | null | 50 |  |
| `city` | string | 50 |  |
| `phoneNumbers` | array | 50 | [] |
| `emails` | array | 50 | [{"category":"work","email":"budsglassjoint@gmail. |
| `dateCreated` | timestamp | 50 | 2024-12-31T20:25:27.000Z |
| `cf_698460` | null | 50 |  |
| `street` | string | 50 |  |
| `cf_698149` | null | 50 |  |
| `interactionCount` | number | 50 | 20 |
| `socials` | array | 50 | [{"category":"linkedin","url":"https://www.linkedi |
| `cf_698148` | null | 50 |  |
| `cf_698467` | null | 50 |  |
| `cf_698503` | null | 50 |  |
| `email` | string | 50 | budsglassjoint@gmail.com |
| `cf_697979` | null | string | 50 | Douglas County |
| `website` | string | 50 | http://budsglassjoint.com/ |
| `importedAt` | timestamp | 50 | 2025-12-22T20:33:33.370Z |
| `address` | object | 50 | {"country":"US","city":null,"street":null,"state": |
| `cf_705066` | null | 50 |  |
| `assigneeId` | number | null | 50 | 1206092 |
| `cf_698471` | array | 50 | [] |
| `cf_698475` | null | 50 |  |
| `websites` | array | 50 | [{"category":"work","url":"http://budsglassjoint.c |
| `contactTypeId` | number | 50 | 2480265 |
| `cf_724385` | boolean | 50 |  |
| `cf_724389` | null | string | 50 | TIGER/LineÃ‚Â® dataset from the US Census Bureau |
| `cf_724367` | array | 50 | [] |
| `cf_724365` | array | 50 | [] |
| `cf_724369` | array | 50 | [] |
| `firstName` | string | 50 | GREG AND FRANK |
| `lastName` | string | 50 | LASTNAME |
| `cf_724388` | string | null | 50 | 0 |
| `cf_713477` | string | null | 50 | 71520784 |
| `cf_724387` | string | null | 50 | 0 |
| `syncedFromCopperApiAt` | timestamp | 50 | 2026-01-12T20:37:59.460Z |
| `name` | string | 50 | GREG AND FRANK LASTNAME |
| `dateModified` | timestamp | 50 | 2026-01-08T02:39:52.000Z |
| `title` | string | 50 | PURCHASING MANAGERS |
| `updatedAt` | timestamp | 50 | 2026-01-12T20:37:59.460Z |

### copper_tasks

**Documents:** 1328
**Fields:** 33

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `Account Number cf_698260` | string | 50 |  |
| `Owner` | string | 50 | Derek Whitworth |
| `Copper ID` | string | 50 | 52070028 |
| `dueDate` | string | 50 | 1/7/2025 |
| `Completed At` | string | 50 | 1/7/2025 |
| `source` | string | 50 | copper_export |
| `Updated At` | string | 50 | 7/7/2025 |
| `ownerId` | string | 50 | 1168894 |
| `Name` | string | 50 | Smoekshop - Ali |
| `Owner Id` | string | 50 | 1168894 |
| `id` | number | 50 | 52070028 |
| `Account Order ID cf_698467` | string | 50 |  |
| `Tags` | string | 50 | reassigned |
| `Created At` | string | 50 | 1/6/2025 |
| `Due Date` | string | 50 | 1/7/2025 |
| `Status` | string | 50 | Completed |
| `copperUrl` | string | 50 | https://app.copper.com/auth/auto_login?redirect_ur |
| `owner` | string | 50 | Derek Whitworth |
| `Trade Show Name cf_699977` | string | 50 |  |
| `importedAt` | timestamp | 50 | 2025-10-03T00:05:49.322Z |
| `Priority` | string | 50 | High |
| `Account Type cf_675914` | string | 50 |  |
| `priority` | string | 50 | High |
| `Reminder At` | string | 50 | 1/6/2025 |
| `Details` | string | 50 | '- |
| `Region cf_680701` | string | 50 |  |
| `State cf_698130` | string | 50 |  |
| `name` | string | 50 | Smoekshop - Ali |
| `activityType` | string | 50 | To Do |
| `Activity Type` | string | 50 | To Do |
| `Segment cf_698149` | string | 50 |  |
| `% Complete` | string | 50 |  |
| `status` | string | 50 | Completed |

### customer_sales_summary

**Documents:** 1825
**Fields:** 31

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `customerId` | string | 50 | 1 |
| `customerName` | string | 50 | BTG Distro | TCC LLC |
| `totalSales` | number | 50 |  |
| `totalSalesYTD` | number | 50 |  |
| `orderCount` | number | 50 |  |
| `orderCountYTD` | number | 50 |  |
| `sales_30d` | number | 50 |  |
| `sales_90d` | number | 50 |  |
| `sales_12m` | number | 50 |  |
| `orders_30d` | number | 50 |  |
| `orders_90d` | number | 50 |  |
| `orders_12m` | number | 50 |  |
| `firstOrderDate` | null | string | 50 | 2024-04-09 |
| `lastOrderDate` | null | string | 50 | 2025-12-31 |
| `lastOrderAmount` | number | 50 |  |
| `avgOrderValue` | number | 50 |  |
| `salesPerson` | string | 50 |  |
| `salesPersonName` | string | 50 |  |
| `salesPersonId` | string | 50 |  |
| `salesPersonRegion` | string | 50 |  |
| `salesPersonTerritory` | string | 50 |  |
| `region` | string | 50 |  |
| `regionColor` | string | 50 | #808080 |
| `accountType` | string | 50 | Wholesale |
| `shippingAddress` | string | 50 |  |
| `shippingCity` | string | 50 |  |
| `shippingState` | string | 50 |  |
| `shippingZip` | string | 50 |  |
| `lat` | null | 50 |  |
| `lng` | null | 50 |  |
| `lastUpdatedAt` | timestamp | 50 | 2026-01-13T00:06:31.604Z |

### fishbowl_customers

**Documents:** 1621
**Fields:** 31
**Subcollections:** sales_order_history

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `copperId` | number | 50 | 72775545 |
| `accountTypeSource` | string | 50 | copper_companies |
| `name` | string | 50 | PURPLE HAZE HERMOSA BEACH-HM (CA) |
| `accountNumber` | string | 50 | 1000 |
| `accountId` | string | 50 | 72775545 |
| `region` | number | 50 | 2063731 |
| `billingCity` | string | 50 | Hermosa Beach |
| `shippingCity` | string | 50 | Hermosa Beach |
| `source` | string | 50 | copper_sync |
| `createdAt` | timestamp | 50 | 2026-01-14T21:43:18.018Z |
| `syncedFromCopperAt` | timestamp | 50 | 2026-01-14T21:59:00.697Z |
| `accountType` | string | 50 | Retail |
| `updatedAt` | timestamp | 50 | 2026-01-19T18:11:16.481Z |
| `billingState` | string | 49 | CA |
| `shippingState` | string | 49 | CA |
| `shippingCountry` | string | 48 | US |
| `billingAddress` | string | 46 | 504 Pacific Coast Highway |
| `shippingAddress` | string | 46 | 504 Pacific Coast Highway |
| `id` | string | 45 | 1000 |
| `lastSalesPerson` | string | 44 |  |
| `lastOrderDate` | timestamp | 44 | 2025-03-28T06:00:00.000Z |
| `lastOrderNum` | string | 44 | 6827 |
| `metrics` | object | 44 | {"totalOrders":27,"totalSpent":67530,"firstOrderDa |
| `metricsCalculatedAt` | string | 44 | 2026-01-19T19:36:07.945Z |
| `salesPerson` | string | 43 | BenW |
| `salesRepName` | string | 43 | Ben Wallner |
| `salesRepEmail` | string | 43 | ben@kanvabotanicals.com |
| `salesRepRegion` | string | 43 | Pacific Northwest |
| `billingZip` | string | 39 | 90254 |
| `shipToZip` | string | 39 | 90254 |
| `syncedToCopperAt` | string | 35 | 2026-01-19T19:04:49.748Z |

### fishbowl_metrics_staging

**Documents:** 982
**Fields:** 12

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `customerId` | string | 50 | 115 |
| `customerName` | string | 50 | Honest Inc |
| `copperCompanyId` | string | 50 | 70961189 |
| `copperCompanyName` | string | 50 | Honest Inc |
| `accountId` | string | 50 | 70961189 |
| `metrics` | object | 50 | {"totalOrders":22,"totalSpent":596647,"firstOrderD |
| `sampleKitSent` | boolean | 50 |  |
| `sampleKitDate` | null | string | 50 | 2024-11-14T07:00:00.000Z |
| `calculatedAt` | string | 50 | 2026-01-19T19:35:30.177Z |
| `status` | string | 50 | pending |
| `syncedAt` | null | 50 |  |
| `syncError` | null | 50 |  |

### fishbowl_sales_orders

**Documents:** 7162
**Fields:** 17

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `salesOrderId` | string | 50 | 25111 |
| `commissionMonth` | string | 50 | 2026-01 |
| `commissionYear` | number | 50 | 2026 |
| `accountType` | string | 50 | Retail |
| `customerId` | string | 50 | 1743 |
| `commissionDate` | timestamp | 50 | 2026-01-01T07:00:00.000Z |
| `postingDate` | timestamp | 50 | 2026-01-01T07:00:00.000Z |
| `soNumber` | string | 50 | #0A5PI616B625OB |
| `customerName` | string | 50 | 7 LUCKY FOOD MART |
| `salesRep` | string | 50 |  |
| `salesPerson` | string | 50 |  |
| `updatedAt` | timestamp | 50 | 2026-01-19T18:49:33.271Z |
| `manuallyLinked` | boolean | 2 | true |
| `linkedBy` | string | 2 | admin |
| `linkedReason` | string | 2 | Manual correction via validation UI |
| `originalCustomerId` | string | 2 | 2026 |
| `linkedAt` | timestamp | 2 | 2026-01-15T22:47:14.971Z |

### fishbowl_soitems

**Documents:** 24452
**Fields:** 19

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `salesOrderId` | string | 50 | 10000 |
| `unitPrice` | number | 50 | 648 |
| `product` | string | 50 | FG- MC12 Focus+ Flow |
| `quantity` | number | 50 | 2 |
| `commissionMonth` | string | 50 | 2024-12 |
| `commissionYear` | number | 50 | 2024 |
| `totalPrice` | number | 50 | 1296 |
| `postingDate` | timestamp | 50 | 2024-12-10T07:00:00.000Z |
| `customerName` | string | 50 | Rehbar Ehmar LLC | Williston |
| `soItemId` | string | 50 | 30890 |
| `customerId` | string | 50 | 1406 |
| `commissionDate` | timestamp | 50 | 2024-12-10T07:00:00.000Z |
| `soNumber` | string | 50 | 5552 |
| `description` | string | 50 | MC12 Focus + Flow |
| `partNumber` | string | 50 | FG- MC12 Focus+ Flow |
| `productNum` | string | 50 | FG- MC12 Focus+ Flow |
| `salesPerson` | string | 50 | DerekW |
| `productName` | string | 50 | MC12 Focus + Flow |
| `updatedAt` | timestamp | 50 | 2026-01-19T18:09:38.139Z |

### gmail_connections

**Documents:** 2
**Fields:** 12

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `userId` | string | 2 | iV3us7cyr6drTZv5z15NUX5uYJr1 |
| `userEmail` | string | 2 | derek@kanvabotanicals.com |
| `status` | string | 2 | pending |
| `createdAt` | timestamp | 2 | 2026-01-13T17:58:28.802Z |
| `updatedAt` | timestamp | 2 | 2026-01-13T17:58:28.802Z |
| `lastRefreshed` | timestamp | 1 | 2025-12-22T23:46:14.439Z |
| `needsReauth` | boolean | 1 |  |
| `connectedAt` | timestamp | 1 | 2025-12-22T23:46:14.439Z |
| `tokenExpiry` | timestamp | 1 | 2025-12-23T00:46:13.439Z |
| `accessToken` | string | 1 | ya29.a0Aa7pCA_yKwvHCFS35sJYgBACvi42f8UXuwJllFnjuKl |
| `refreshToken` | string | 1 | 1//04rtziIcoiCqGCgYIARAAGAQSNwF-L9IrWQDXF3sMTkblJc |
| `lastSyncAt` | timestamp | 1 | 2025-12-22T23:46:23.604Z |

### goals

**Documents:** 200
**Fields:** 10

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `id` | string | 50 | 2NZ8OQu0zeYpZimp6YhMVK8GFkt2_email_quantity_daily |
| `userId` | string | 50 | 2NZ8OQu0zeYpZimp6YhMVK8GFkt2 |
| `type` | string | 50 | email_quantity |
| `period` | string | 50 | daily |
| `target` | number | 50 | 20 |
| `current` | number | 50 |  |
| `startDate` | timestamp | 50 | 2026-01-19T07:00:00.000Z |
| `endDate` | timestamp | 50 | 2026-01-20T06:59:59.999Z |
| `createdAt` | timestamp | 50 | 2026-01-19T17:09:21.335Z |
| `updatedAt` | timestamp | 50 | 2026-01-19T17:09:21.335Z |

### import_pending

**Documents:** 6
**Fields:** 5

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `fileId` | string | 6 | file_1766004658554 |
| `filename` | string | 6 | 12.17_YTD.csv |
| `totalChunks` | number | 6 | 21 |
| `status` | string | 6 | pending |
| `createdAt` | timestamp | 6 | 2025-12-17T20:51:21.390Z |

### import_progress

**Documents:** 105
**Fields:** 10

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `totalRows` | number | 50 | 28591 |
| `startedAt` | timestamp | 50 | 2025-10-20T23:05:17.725Z |
| `status` | string | 50 | processing |
| `stats` | object | 50 | {"processed":2750,"customersCreated":0,"customersU |
| `currentRow` | number | 50 | 2750 |
| `percentage` | number | 50 | 9.6 |
| `updatedAt` | timestamp | 50 | 2025-10-20T23:07:40.418Z |
| `completedAt` | timestamp | 38 | 2025-10-21T00:09:40.208Z |
| `currentCustomer` | string | 27 | SMOKE RINGS WINSTON SALEM-WS (NC) |
| `currentOrder` | number | string | 27 | 6173 |

### integrations

**Documents:** 1
**Fields:** 9

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `github` | object | 1 | {"enabled":false} |
| `fishbowl` | object | 1 | {"enabled":false} |
| `lastUpdated` | string | 1 | 2025-07-20T15:57:02.624Z |
| `createdAt` | object | 1 | {"seconds":1753027023,"nanoseconds":41000000} |
| `migratedAt` | object | 1 | {"seconds":1753027023,"nanoseconds":41000000} |
| `updatedAt` | object | 1 | {} |
| `copper` | object | 1 | {"environment":"production","apiKey":"6187c1b571e2 |
| `shipstation` | object | 1 | {"environment":"production","apiKey":"3030832aab04 |
| `ringcentral` | object | 1 | {"environment":"production","clientId":"2nFqvUT38S |

### metrics_calculation_progress

**Documents:** 19
**Fields:** 7

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `currentRow` | number | 19 |  |
| `totalRows` | number | 19 |  |
| `startedAt` | string | 19 | 2025-10-30T00:31:12.712Z |
| `status` | string | 19 | loading |
| `message` | string | 19 | Loading line items... |
| `updatedAt` | string | 19 | 2025-10-30T00:31:12.841Z |
| `error` | string | 12 | Bad Request |

### monthly_commission_summary

**Documents:** 60
**Fields:** 18

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `id` | string | 50 | BenW_2025-06 |
| `salesPerson` | string | 50 | BenW |
| `repName` | string | 50 | Ben Wallner |
| `month` | string | 50 | 2025-06 |
| `year` | number | 50 | 2025 |
| `totalOrders` | number | 50 | 2 |
| `totalRevenue` | number | 50 | 69455 |
| `totalCommission` | number | 50 | 1407.3200000000002 |
| `totalSpiffs` | number | 50 |  |
| `totalEarnings` | number | 50 | 1407.3200000000002 |
| `paidStatus` | string | 50 | pending |
| `calculatedAt` | timestamp | 50 | 2026-01-19T17:35:03.670Z |
| `totalExcluded` | number | 4 |  |
| `excludedRevenue` | number | 4 |  |
| `commissionMonth` | string | 4 | 2025-12 |
| `lastRecalculated` | timestamp | 4 | 2026-01-19T22:07:00.087Z |
| `excludedCommission` | number | 4 |  |
| `updatedAt` | timestamp | 4 | 2026-01-19T22:07:00.087Z |

### monthly_commissions

**Documents:** 1700
**Fields:** 23

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `id` | string | 50 | BenW_2025-06_order_17546 |
| `repId` | string | 50 | mtjr4VgVIDcMWl9liox2oM3SI4B3 |
| `salesPerson` | string | 50 | BenW |
| `repName` | string | 50 | Ben Wallner |
| `repTitle` | string | 50 | Account Executive |
| `orderId` | string | 50 | 17546 |
| `orderNum` | string | 50 | 7882 |
| `customerId` | string | 50 | 1040 |
| `customerName` | string | 50 | Blueberry Trading |
| `accountType` | string | 50 | Distributor |
| `customerSegment` | string | 50 | Distributor |
| `customerStatus` | string | 50 | transferred |
| `orderRevenue` | number | 50 | 68544 |
| `orderValue` | number | 50 | 68544 |
| `commissionRate` | number | 50 | 2 |
| `commissionAmount` | number | 50 | 1370.88 |
| `orderDate` | timestamp | 50 | 2025-06-30T06:00:00.000Z |
| `postingDate` | timestamp | 50 | 2025-06-30T06:00:00.000Z |
| `commissionMonth` | string | 50 | 2025-06 |
| `commissionYear` | number | 50 | 2025 |
| `calculatedAt` | timestamp | 50 | 2026-01-19T17:34:55.601Z |
| `paidStatus` | string | 50 | pending |
| `notes` | string | 50 | Distributor - transferred - Distributor |

### payment

**Documents:** 1
**Fields:** 6

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `creditCardThreshold` | number | 1 | 10000 |
| `paymentMethods` | object | 1 | {"creditCard":{"label":"Credit Card","availableBel |
| `description` | string | 1 | Payment thresholds and accepted methods |
| `createdAt` | timestamp | 1 | 2025-07-20T15:57:02.663Z |
| `migratedAt` | timestamp | 1 | 2025-07-20T15:57:02.663Z |
| `updatedAt` | timestamp | 1 | 2025-07-20T15:57:02.663Z |

### pipelines

**Documents:** 2
**Fields:** 8

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `name` | string | 2 | Sales Pipeline |
| `description` | string | 2 | Main sales pipeline for tracking deals |
| `stages` | array | 2 | [{"id":"lead","name":"Lead","order":0,"color":"#6B |
| `isDefault` | boolean | 2 | true |
| `isShared` | boolean | 2 | true |
| `createdAt` | timestamp | 2 | 2025-12-19T21:12:31.957Z |
| `updatedAt` | timestamp | 2 | 2025-12-19T21:12:31.957Z |
| `createdBy` | string | 2 | mtjr4VgVIDcMWl9liox2oM3SI4B3 |

### pricing

**Documents:** 1
**Fields:** 4

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `1` | object | 1 | {"tierId":1,"threshold":0,"name":"Tier 1","descrip |
| `2` | object | 1 | {"tierId":2,"threshold":56,"name":"Tier 2","descri |
| `3` | object | 1 | {"tierId":3,"threshold":112,"description":"Best pr |
| `updatedAt` | timestamp | 1 | 2025-07-22T01:49:34.671Z |

### pricing_tiers

**Documents:** 3
**Fields:** 8

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `updatedAt` | string | 3 | 2026-01-08T01:20:32.810Z |
| `description` | string | 3 | Standard pricing for 0-55 master cases |
| `tierId` | number | 3 | 1 |
| `name` | string | 3 | Tier 1 |
| `createdAt` | string | 3 | 2026-01-08T01:20:32.810Z |
| `prices` | object | 3 | {"1":4.5,"2":4.5,"3":3.2,"4":4.25,"5":4.5} |
| `threshold` | number | 3 |  |
| `margin` | string | 3 | 10% |

### products

**Documents:** 60
**Fields:** 37

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `productNum` | string | 50 | KB-4005 |
| `productDescription` | string | 50 | RAW Master Case MC12 |
| `category` | string | 50 | RAW |
| `productType` | string | 50 | Master Case |
| `quarterlyBonusEligible` | boolean | 50 |  |
| `notes` | string | 50 | 12 boxes case |
| `createdAt` | string | 50 | 2025-12-29T21:46:59.871Z |
| `imageUrl` | string | 50 | https://firebasestorage.googleapis.com/v0/b/kanvap |
| `isActive` | boolean | 50 | true |
| `updatedAt` | string | 50 | 2026-01-09T17:24:08.936Z |
| `size` | string | 43 | MC12 |
| `uom` | string | 43 | MC |
| `imagePath` | null | string | 43 | product-images/FG- 1kg Green Powder.png |
| `familyId` | string | 43 | raw-relief |
| `imageMetadata` | object | 30 | {"fileName":"FG- 1kg Green Powder.png","originalNa |
| `images` | array | 22 | ["https://firebasestorage.googleapis.com/v0/b/kanv |
| `showInQuoteTool` | boolean | 18 | true |
| `casesPerPallet` | number | 10 | 56 |
| `unitsPerDisplayBox` | number | 10 | 12 |
| `unitsPerCase` | number | 10 | 144 |
| `displayBoxesPerCase` | number | 10 | 12 |
| `masterCaseDimensions` | object | 9 | {"length":14,"width":10,"height":12,"weight":42} |
| `upc` | object | 9 | {"unit":"850041279343","displayBox":"850041279350" |
| `displayBoxDimensions` | object | 9 | {"length":4,"width":5,"height":7,"weight":3.5} |
| `product` | object | 7 | {"parentSku":"","variantType":"unit"} |
| `familyName` | string | 7 | Focus Flow |
| `isFamilyParent` | boolean | 7 | true |
| `brand` | string | 7 | Kanva Botanicals |
| `mainImage` | string | 7 | https://firebasestorage.googleapis.com/v0/b/kanvap |
| `description` | string | 7 | Focus+Flow™ by  Kanva™ Botanicals a Kava + Kratom  |
| `price` | number | 6 | 5 |
| `msrp` | number | 6 | 9.99 |
| `retailPrice` | number | 6 | 9.99 |
| `variantType` | string | 6 | unit |
| `pricing` | object | 6 | {"wholesale":{"margin":"49.95","tier1":{"unit":5," |
| `parentSku` | string | 5 |  |
| `id` | string | 1 | 3a1YOnRkdAz3jUZwi99X |

### quarters

**Documents:** 5
**Fields:** 3

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `code` | string | 5 | Q1 2025 |
| `startDate` | timestamp | 5 | 2025-01-01T00:00:00.000Z |
| `endDate` | timestamp | 5 | 2025-03-31T00:00:00.000Z |

### quote_activities

**Documents:** 2
**Fields:** 6

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `createdAt` | timestamp | 2 | 2026-01-07T20:58:06.065Z |
| `quoteId` | string | 2 | wCJnvPcwDR5AOGSS43CP |
| `type` | string | 2 | created |
| `description` | string | 2 | Quote Q-2026-001 created |
| `userEmail` | string | 2 | ben@kanvabotanicals.com |
| `userId` | string | 2 | mtjr4VgVIDcMWl9liox2oM3SI4B3 |

### quotes

**Documents:** 1
**Fields:** 17

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `selectedTier` | number | 1 | 1 |
| `paymentMethod` | string | 1 | wire |
| `customer` | object | 1 | {"state":"CA","country":"","fishbowlId":"1040","ma |
| `lineItems` | array | 1 | [{"unitPrice":0,"masterCases":1,"displayBoxes":144 |
| `quoteName` | string | 1 | Test Quote |
| `pricingMode` | string | 1 | distribution |
| `customerNotes` | string | 1 |  |
| `createdByEmail` | string | 1 | ben@kanvabotanicals.com |
| `quoteNumber` | string | 1 | Q-2026-001 |
| `createdBy` | string | 1 | mtjr4VgVIDcMWl9liox2oM3SI4B3 |
| `shipping` | object | 1 | {"zoneName":"","zone":"","calculatedAmount":0,"ltl |
| `internalNotes` | string | 1 |  |
| `createdAt` | timestamp | 1 | 2026-01-08T01:08:02.512Z |
| `status` | string | 1 | draft |
| `calculation` | object | 1 | {"total":0,"shipping":0,"subtotal":0,"creditCardFe |
| `version` | number | 1 | 2 |
| `updatedAt` | timestamp | 1 | 2026-01-08T01:18:07.937Z |

### regions

**Documents:** 7
**Fields:** 6

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `name` | string | 7 | Sales Team |
| `states` | array | 7 | ["ID"] |
| `managerId` | null | string | 7 | mFhxPEAw8QgTCmEJFpl8v7jh2zh1 |
| `createdAt` | timestamp | 7 | 2025-10-10T16:57:56.262Z |
| `color` | string | 7 | #14B8A6 |
| `updatedAt` | timestamp | 7 | 2025-12-10T19:20:36.951Z |

### reprally_customers

**Documents:** 2597
**Fields:** 28
**Subcollections:** sales_orders

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `customerId` | string | 50 | 22 |
| `businessName` | string | 50 | Shopify Customer |
| `billingAddress` | string | 50 | 614 W MAIN ST
IN STORE |
| `billingCity` | string | 50 | Folsom |
| `billingState` | string | 50 | New York |
| `billingZip` | number | string | 50 | 98532 |
| `createdAt` | timestamp | 50 | 2025-12-16T21:16:21.003Z |
| `updatedAt` | timestamp | 50 | 2025-12-16T21:16:21.003Z |
| `source` | string | 50 | reprally_builder |
| `totalOrders` | number | 49 | 2 |
| `lifetimeValue` | number | 49 | 1856.4 |
| `firstOrderDate` | timestamp | 49 | 2024-08-26T07:00:00.000Z |
| `lastOrderDate` | timestamp | 49 | 2024-09-30T07:00:00.000Z |
| `extractedFrom` | string | 49 | order_number_pattern |
| `lng` | number | 48 | -121.8523248 |
| `geocodedAt` | timestamp | 48 | 2025-12-16T22:05:14.825Z |
| `lat` | number | 48 | 39.7263768 |
| `match` | object | 2 | {"matchScore":11,"fbBusinessName":"2nd Street Mark |
| `switcher` | object | 2 | {"reprally":{"repRallyOrders":9,"repRallyRevenue": |
| `accountNumber` | string | 1 | 22 |
| `accountType` | string | 1 | Retail |
| `copperId` | number | 1 | 74820941 |
| `originalOwner` | string | 1 | SHOPIFY |
| `originalSalesRep` | string | 1 | SHOPIFY |
| `totalRepRallyOrders` | number | 1 | 14726 |
| `firstRepRallyOrder` | timestamp | 1 | 2024-12-10T07:00:00.000Z |
| `lastRepRallyOrder` | timestamp | 1 | 2024-12-10T07:00:00.000Z |
| `totalRepRallyRevenue` | number | 1 | 5006815.800000176 |

### reps

**Documents:** 4
**Fields:** 8

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `name` | string | 4 | Jared |
| `title` | string | 4 | Account Executive |
| `email` | string | 4 | jared@kanvabotanicals.com |
| `active` | boolean | 4 | true |
| `startDate` | timestamp | 4 | 2025-10-06T00:00:00.000Z |
| `notes` | string | 4 |  |
| `fishbowlUsername` | string | 4 | Jared |
| `salesPerson` | string | 4 | Jared |

### sales_insights_metrics

**Documents:** 1486
**Fields:** 12

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `firstOrderDate` | string | 50 | 2024-04-10T06:00:00.000Z |
| `salesRep` | string | 50 | admin |
| `monthlyBuckets` | array | 50 | [{"month":"2024-04","orders":6,"revenue":3264},{"m |
| `salesRepName` | string | 50 | Ben Wallner |
| `totalRevenueAllTime` | number | 50 | 97141.2 |
| `totalOrdersAllTime` | number | 50 | 38 |
| `customerId` | string | 50 | 1000 |
| `lastOrderDate` | string | 50 | 2025-10-06T07:00:00.000Z |
| `salesPerson` | string | 50 | admin |
| `customerName` | string | 50 | PURPLE HAZE HERMOSA BEACH-HM (CA) |
| `salesRepRegion` | string | 50 | West |
| `rebuiltAt` | string | 50 | 2025-11-21T00:33:07.918Z |

### settings

**Documents:** 24
**Fields:** 40

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `lastSyncAt` | string | 10 | 2025-10-17T00:59:42.276Z |
| `updatedAt` | timestamp | string | 7 | 2025-10-09T01:45:59.889Z |
| `lastJustCallSyncAt` | string | 5 | 2025-10-17T17:38:36.035Z |
| `rates` | array | 5 | [] |
| `specialRules` | object | 5 | {"inactivityThreshold":12,"repTransfer":{"enabled" |
| `titles` | array | 5 | ["Account Executive","Jr. Account Executive","Acco |
| `segments` | array | 5 | [{"id":"distributor","name":"Distributor"},{"name" |
| `maxBonusPerRep` | number | 3 | 25000 |
| `updatedBy` | string | 3 | mtjr4VgVIDcMWl9liox2oM3SI4B3 |
| `overPerfCap` | number | 2 | 1.25 |
| `minAttainment` | number | 2 | 0.75 |
| `buckets` | array | 2 | [{"id":"A","code":"A","name":"New Business","weigh |
| `scales` | array | 1 | [{"role":"Sr. Account Executive","percentage":1,"m |
| `timezone` | string | 1 | America/Denver |
| `workStartHour` | number | 1 | 8 |
| `workEndHour` | number | 1 | 17 |
| `workDays` | array | 1 | [1,2,3,4,5] |
| `quarter` | string | 1 | Q4 2025 |
| `roleScales` | array | 1 | [{"role":"Sr. Account Executive","percentage":1},{ |
| `budgets` | array | 1 | [{"title":"Sr. Account Executive","bucketA":500000 |
| `excludeShipping` | boolean | 1 | true |
| `excludeCCProcessing` | boolean | 1 | true |
| `useOrderValue` | boolean | 1 | true |
| `applyReorgRule` | boolean | 1 | true |
| `reorgDate` | string | 1 | 2025-07-01 |
| `activityTypeSummary` | object | 1 | {"unknown":1000} |
| `sampleActivitiesCount` | number | 1 | 1000 |
| `user` | object | 1 | {"name":"Ben Wallner","groups":[{"id":51265,"name" |
| `suggestedDefaults` | object | 1 | {"phoneCallActivityId":null,"emailActivityId":null |
| `customFieldDefinitions` | array | 1 | [{"id":675906,"name":"PM Name","data_type":"String |
| `fetchedAt` | string | 1 | 2025-09-30T22:57:01.019Z |
| `activityTypes` | object | 1 | {"system":[{"id":1,"category":"system","name":"Pro |
| `defaults` | object | 1 | {"SALE_TYPE_FIELD_ID":710692,"PRODUCT_FIELD_ID":"" |
| `byEmail` | object | 1 | {"cori@cwlbrands.com":1190942,"joe@kanvabotanicals |
| `mappedCount` | number | 1 | 5 |
| `skippedCount` | number | 1 | 1 |
| `bySalesman` | object | 1 | {"JSimmons":"2NZ8OQu0zeYpZimp6YhMVK8GFkt2","DerekW |
| `byUserId` | object | 1 | {"2NZ8OQu0zeYpZimp6YhMVK8GFkt2":"JSimmons","iV3us7 |
| `saw` | object | 1 | {"reading":"Four Agreements"} |
| `teamGoals` | object | 1 | {"monthly":{"new_sales_wholesale":100000,"lead_pro |

### shipping

**Documents:** 1
**Fields:** 14

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `description` | string | 1 | Shipping rates based on display boxes and LTL perc |
| `displayBoxesPerMasterCase` | number | 1 | 12 |
| `masterCasesPerLayer` | number | 1 | 11 |
| `halfPallet` | number | 1 | 22 |
| `fullPallet` | number | 1 | 56 |
| `ltlThreshold` | number | 1 | 12 |
| `freightClass` | number | 1 | 70 |
| `palletDimensions` | object | 1 | {"length":48,"width":40,"description":"Standard pa |
| `displayBoxShipping` | object | 1 | {"description":"Fixed shipping rates by display bo |
| `creditCardFee` | number | 1 | 0.03 |
| `createdAt` | timestamp | 1 | 2025-07-20T15:57:02.504Z |
| `migratedAt` | timestamp | 1 | 2025-07-20T15:57:02.504Z |
| `zones` | object | 1 | {"zone4":{"shippingId":4,"name":"Zone 4","states": |
| `updatedAt` | timestamp | 1 | 2025-07-22T01:49:04.850Z |

### shipping_config

**Documents:** 1
**Fields:** 13

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `freightClass` | number | 1 | 70 |
| `updatedAt` | string | 1 | 2026-01-08T01:20:33.264Z |
| `description` | string | 1 | Shipping rates based on display boxes and LTL perc |
| `createdAt` | string | 1 | 2026-01-08T01:20:33.264Z |
| `displayBoxShipping` | object | 1 | {"description":"Fixed shipping rates by display bo |
| `zones` | object | 1 | {"zone3":{"color":"#3b82f6","name":"Zone 3","zoneN |
| `creditCardFee` | number | 1 | 0.03 |
| `fullPallet` | number | 1 | 56 |
| `halfPallet` | number | 1 | 22 |
| `ltlThreshold` | number | 1 | 12 |
| `masterCasesPerLayer` | number | 1 | 11 |
| `displayBoxesPerMasterCase` | number | 1 | 12 |
| `palletDimensions` | object | 1 | {"length":48,"description":"Standard pallet dimens |

### shipping_zones

**Documents:** 5
**Fields:** 9

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `createdAt` | string | 5 | 2026-01-08T01:20:33.928Z |
| `name` | string | 5 | Remote |
| `shippingId` | number | 5 | 5 |
| `zoneId` | string | 5 | remote |
| `zoneNumber` | number | 5 | 5 |
| `states` | array | 5 | ["AK","HI"] |
| `updatedAt` | string | 5 | 2026-01-08T01:20:33.928Z |
| `ltlPercentage` | number | 5 | 2.5 |
| `color` | string | 5 | #6b7280 |

### shipstationRequests

**Documents:** 51
**Fields:** 6

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `createdAt` | timestamp | 50 | 2025-08-14T19:20:32.689Z |
| `op` | string | 50 | listOrders |
| `requestedBy` | string | 50 | anonymous |
| `params` | object | 50 | {"start":"2025-08-14T06:00:00.000Z","pageSize":100 |
| `status` | string | 39 | done |
| `finishedAt` | timestamp | 39 | 2025-08-14T19:20:34.531Z |

### shipstationResponses

**Documents:** 40
**Fields:** 4

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `status` | string | 40 | ok |
| `finishedAt` | timestamp | 40 | 2025-08-14T19:20:34.442Z |
| `data` | object | array | 34 | {"total":26,"pages":1,"orders":[{"orderId":6156758 |
| `error` | string | 6 | {"Message":"The request is invalid.","ModelState": |

### shipstation_orders

**Documents:** 955
**Fields:** 19

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `orderNumber` | string | 50 | Sh117487 |
| `orderId` | number | 50 | 678628920 |
| `customerNotes` | null | 50 |  |
| `internalNotes` | null | 50 |  |
| `shipments` | array | 50 | [] |
| `orderTotal` | number | 50 | 138.96 |
| `webhookUpdated` | boolean | 50 | true |
| `amountPaid` | number | 50 |  |
| `customerEmail` | null | string | 50 | hawkdistro7@gmail.com |
| `billTo` | object | 50 | {"country":"US","residential":null,"street3":"","c |
| `shippingAmount` | number | 50 | 10.99 |
| `taxAmount` | number | 50 |  |
| `items` | array | 50 | [{"weight":null,"quantity":1,"lineItemKey":null,"f |
| `shipTo` | object | 50 | {"country":"US","residential":true,"street3":"","c |
| `lastSyncedAt` | timestamp | 50 | 2026-01-07T18:05:53.491Z |
| `orderStatus` | string | 50 | shipped |
| `displayStatus` | string | 50 | shipped |
| `orderDate` | timestamp | 50 | 2025-12-23T07:00:00.000Z |
| `expiresAt` | timestamp | 50 | 2026-01-22T18:05:53.491Z |

### shipstation_sync_meta

**Documents:** 1
**Fields:** 4

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `status` | string | 1 | success |
| `lastRunAt` | timestamp | 1 | 2026-01-08T19:28:39.776Z |
| `deletedCount` | number | 1 |  |
| `ordersProcessed` | number | 1 | 536 |

### shipstation_webhook_logs

**Documents:** 1292
**Fields:** 5

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `payload` | object | 50 | {"resource_type":"SHIP_NOTIFY","resource_url":"htt |
| `details` | string | 50 | Updated 1 orders |
| `status` | string | 50 | processed |
| `receivedAt` | timestamp | 50 | 2026-01-06T17:45:31.960Z |
| `event` | string | 50 | unknown |

### spiff_earnings

**Documents:** 115
**Fields:** 22

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `id` | string | 50 | BenW_2025-07_spiff_18981_56042 |
| `repId` | string | 50 | mtjr4VgVIDcMWl9liox2oM3SI4B3 |
| `salesPerson` | string | 50 | BenW |
| `repName` | string | 50 | Ben Wallner |
| `spiffId` | string | 50 | QW5HYfaMO1s7ofxeQSAU |
| `spiffName` | string | 50 | Acrylic BLK/WHT Full Assortment Kit |
| `productNum` | string | 50 | KB-038 |
| `productDescription` | string | 50 | Acrylic Kit- Black( 4 FF, 2 Zoom, 1 Mango, 1 RR) |
| `orderId` | string | 50 | 18981 |
| `orderNum` | string | 50 | 8227 |
| `customerId` | string | 50 | 1798 |
| `customerName` | string | 50 | KushKlub Munchies & More |
| `quantity` | number | 50 | 1 |
| `lineRevenue` | number | 50 | 299 |
| `incentiveType` | string | 50 | flat |
| `incentiveValue` | number | 50 | 50 |
| `spiffAmount` | number | 50 | 50 |
| `orderDate` | timestamp | 50 | 2025-07-28T06:00:00.000Z |
| `commissionMonth` | string | 50 | 2025-07 |
| `commissionYear` | number | 50 | 2025 |
| `calculatedAt` | timestamp | 50 | 2026-01-19T17:26:14.134Z |
| `paidStatus` | string | 50 | pending |

### spiffs

**Documents:** 4
**Fields:** 11

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `name` | string | 4 | Acrylic Focus + Flow WHT/BLK |
| `incentiveType` | string | 4 | flat |
| `incentiveValue` | number | 4 | 30 |
| `isActive` | boolean | 4 | true |
| `startDate` | string | 4 | 2025-07-01 |
| `endDate` | null | 4 |  |
| `notes` | string | 4 |  |
| `updatedAt` | string | 4 | 2025-10-14T23:16:46.333Z |
| `productNum` | string | 4 | KB-041 |
| `productDescription` | string | 4 | Acrylic kit- White(4 FF/acrylic) |
| `createdAt` | string | 4 | 2025-10-14T23:16:46.333Z |

### sync_log

**Documents:** 7
**Fields:** 12

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `syncType` | string | 7 | fishbowl_to_firestore |
| `status` | string | 7 | completed |
| `recordsProcessed` | number | 7 | 21913 |
| `recordsCreated` | number | 7 | 21910 |
| `recordsUpdated` | number | 7 |  |
| `recordsFailed` | number | 7 | 3 |
| `errors` | array | 7 | [{"recordId":"Cost: $5.00/$60","error":"Value for  |
| `startedAt` | timestamp | 7 | 2025-10-03T22:02:01.850Z |
| `completedAt` | timestamp | 7 | 2025-10-03T22:09:07.753Z |
| `duration` | number | 7 | 425903 |
| `triggeredBy` | string | 7 | api |
| `metadata` | object | 7 | {"customersProcessed":1686,"customersCreated":1683 |

### system_config

**Documents:** 1
**Fields:** 2

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `mappings` | array | 1 | [{"copperField":"id","ourField":"copperId","enable |
| `updatedAt` | timestamp | 1 | 2026-01-14T22:33:53.869Z |

### system_schema_config

**Documents:** 1
**Fields:** 7

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `collections` | array | 1 | [{"id":"activities","name":"activities","documentC |
| `relationships` | array | 1 | [{"source":"users","sourceField":"email","target": |
| `nodes` | array | 1 | [{"id":"activities","type":"collectionNode","posit |
| `edges` | array | 1 | [{"id":"edge-0","source":"users","target":"users", |
| `lastUpdated` | string | 1 | 2026-01-20T22:25:25.265Z |
| `version` | number | 1 | 1 |
| `initialized` | boolean | 1 | true |

### templates

**Documents:** 1
**Fields:** 9

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `quote` | object | 1 | {"subject":"{{quoteName}} - Partnership Proposal", |
| `followUp` | object | 1 | {"subject":"Following Up - {{companyName}} Partner |
| `negotiation` | object | 1 | {"subject":"Re: {{companyName}} - Partnership Term |
| `closing` | object | 1 | {"subject":"Ready to Move Forward - {{companyName} |
| `payment` | object | 1 | {"ach_required":"Since this order exceeds ${{achTh |
| `product_templates` | object | 1 | {"single_product":"**{{productName}}**\n- Quantity |
| `createdAt` | timestamp | 1 | 2025-07-20T15:57:02.915Z |
| `migratedAt` | timestamp | 1 | 2025-07-20T15:57:02.915Z |
| `updatedAt` | timestamp | 1 | 2025-07-20T15:57:02.915Z |

### users

**Documents:** 7
**Fields:** 23
**Subcollections:** metrics

#### Fields

| Field | Type | Occurrences | Sample Value |
|-------|------|-------------|-------------|
| `createdAt` | timestamp | string | 7 | 2025-09-18T19:51:34.298Z |
| `role` | string | 7 | sales |
| `email` | string | 7 | joe@kanvabotanicals.com |
| `division` | string | 7 |  |
| `isCommissioned` | boolean | 7 | true |
| `orgRole` | string | 7 | regional |
| `name` | string | 7 | Joe Simmons |
| `regionalTerritory` | string | 7 | Central |
| `title` | string | 7 | Account Executive |
| `region` | string | 7 | Central |
| `territory` | string | 7 |  |
| `salesPerson` | string | 7 | JSimmons |
| `isActive` | boolean | 7 |  |
| `updatedAt` | string | 7 | 2025-12-30T20:18:14.502Z |
| `id` | string | 6 | 2NZ8OQu0zeYpZimp6YhMVK8GFkt2 |
| `notes` | string | 6 |  |
| `startDate` | string | 6 | 2025-12-30 |
| `active` | boolean | 6 |  |
| `photoUrl` | null | 5 |  |
| `passwordChanged` | boolean | 5 | true |
| `copperUserEmail` | string | 5 | joe@kanvabotanicals.com |
| `copperUserId` | number | 5 | 1168901 |
| `photoURL` | string | 4 | https://lh3.googleusercontent.com/a/ACg8ocKwmmR-Y3 |

---

## Discovered Relationships

### 1. users.email → users.email

**Confidence:** high

**Found in:**
- `C:\Projects\KanvaPortal\app\(modules)\commissions\page.tsx:74`

### 2. fishbowl_sales_orders.accountType → copper_companies.accountType

**Confidence:** medium

**Found in:**
- `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:64`

### 3. fishbowl_sales_orders.accountTypeSource → copper_companies.accountTypeSource

**Confidence:** medium

**Found in:**
- `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:65`

### 4. fishbowl_sales_order_items.accountType → copper_companies.accountType

**Confidence:** medium

**Found in:**
- `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:120`

### 5. fishbowl_sales_order_items.accountTypeSource → copper_companies.accountTypeSource

**Confidence:** medium

**Found in:**
- `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:121`

### 6. users.email → notifications.userEmail

**Confidence:** high

**Found in:**
- `C:\Projects\KanvaPortal\hooks\useNotifications.ts:44`

