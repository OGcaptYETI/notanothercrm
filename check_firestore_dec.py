import pandas as pd

csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\all_time_review_file.csv')
csv['Total Price'] = csv['Total Price'].str.replace('$', '').str.replace(',', '').astype(float)

dec = csv[csv['Year-month'] == 'December 2025']

print('=== CSV DECEMBER 2025 ANALYSIS ===')
print('Total rows:', len(dec))
print('Total revenue: $', dec['Total Price'].sum())

print('\nBy sales person:')
for sp in sorted(dec['Sales person'].unique()):
    sp_data = dec[dec['Sales person'] == sp]
    print(f'  {sp}: ${sp_data["Total Price"].sum():,.2f} ({len(sp_data)} items)')

print('\n=== FIRESTORE VALIDATION RESULTS ===')
print('BenW: $101,797.73 (should be $291,879.50)')
print('Total: $490,108.14 (should be $1,432,298.73)')

print('\n=== DISCREPANCY ===')
print('Missing: $', 1432298.73 - 490108.14)
print('This is 66% of December revenue missing!')

print('\n=== HYPOTHESIS ===')
print('The import stats show:')
print('  - 13,228 items created')
print('  - 1,628 items skipped')
print('  - Total: 14,856 rows in CSV')
print('\nBut December 2025 has 534 rows in CSV')
print('If only 174 orders imported (from validation), that means ~360 December rows are missing')
print('\nPossible causes:')
print('1. Import is updating existing records instead of creating new ones')
print('2. commissionMonth not being set correctly for some December orders')
print('3. Date parsing failing silently for some December orders')
print('4. Batch commits failing partway through')
