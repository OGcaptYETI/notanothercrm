import pandas as pd

csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\all_time_review_file.csv')
csv['Total Price'] = csv['Total Price'].str.replace('$', '').str.replace(',', '').astype(float)

dec = csv[csv['Year-month'] == 'December 2025']

print('=== FINDING MISSING 3 DECEMBER ITEMS ===\n')
print('CSV December total: 534 items')
print('Firestore December: 531 items')
print('Missing: 3 items\n')

print('CSV December by sales person:')
for sp in sorted(dec['Sales person'].unique()):
    sp_data = dec[dec['Sales person'] == sp]
    sp_rev = sp_data['Total Price'].sum()
    sp_count = len(sp_data)
    print(f'  {sp}: ${sp_rev:,.2f} ({sp_count} items)')

print('\nFirestore December:')
print('  BenW: $101,797.73 (117 items)')
print('  BrandonG: $97,640.30 (167 items)')
print('  DerekW: $90,362.95 (102 items)')
print('  Jared: $57,198.02 (73 items)')
print('  Zalak: $143,109.14 (72 items)')

print('\n=== BENW MISSING 3 ITEMS ===')
benw_csv = dec[dec['Sales person'] == 'BenW']
print(f'CSV has {len(benw_csv)} BenW items')
print(f'Firestore has 117 BenW items')
print(f'Missing: {len(benw_csv) - 117} items')

print('\nBenW CSV revenue: $', benw_csv['Total Price'].sum())
print('BenW Firestore revenue: $101,797.73')
print('Missing revenue: $', benw_csv['Total Price'].sum() - 101797.73)

print('\n=== ALL BENW DECEMBER ITEMS ===')
print(benw_csv[['Sales order Number', 'Issued date', 'Year-month', 'Total Price', 'Product']].to_string())

print('\n=== HYPOTHESIS ===')
print('Import stats show 13,228 items created')
print('Firestore has 12,576 items')
print('Missing: 652 items total')
print('\nThis suggests batch commits are failing or items are being filtered out after creation')
