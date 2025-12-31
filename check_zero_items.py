import pandas as pd

csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\all_time_review_file.csv')
csv['Total Price'] = csv['Total Price'].str.replace('$', '').str.replace(',', '').astype(float)

print('=== CHECKING $0 ITEMS ===\n')
print('Total rows in CSV:', len(csv))
print('Rows with $0 Total Price:', len(csv[csv['Total Price'] == 0]))

dec = csv[csv['Year-month'] == 'December 2025']
dec_zero = dec[dec['Total Price'] == 0]
print('December 2025 rows with $0:', len(dec_zero))

print('\n=== IMPORT STATS ===')
print('Items created (stat): 13,228')
print('Items in Firestore: 12,576')
print('Missing: 652')

print('\n=== HYPOTHESIS ===')
print('Import is NOT filtering $0 items (no such logic in code)')
print('The 652 missing items suggests:')
print('1. Batch size issue causing some batches to fail')
print('2. Firestore write limits being hit')
print('3. Document ID conflicts causing overwrites')
print('\nBATCH_SIZE = 450')
print('Total rows: 14,856')
print('Expected batches: ~33')
print('If some batches fail silently, we lose items')

print('\n=== CHECKING DOCUMENT ID CONFLICTS ===')
print('Line item IDs should be unique...')
print('Unique SO Item IDs in CSV:', csv['SO Item ID'].nunique())
print('Total rows:', len(csv))
print('Duplicate SO Item IDs:', len(csv) - csv['SO Item ID'].nunique())

if len(csv) - csv['SO Item ID'].nunique() > 0:
    print('\n⚠️  FOUND DUPLICATE SO ITEM IDs!')
    print('This means multiple rows have the same SO Item ID')
    print('When using doc ID = SO Item ID, later writes overwrite earlier ones')
    print('This explains the missing 652 items!')
