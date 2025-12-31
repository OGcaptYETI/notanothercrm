import pandas as pd

csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\all_time_review_file.csv')
csv['Total Price'] = csv['Total Price'].str.replace('$', '').str.replace(',', '').astype(float)

print('=== INVESTIGATING SKIPPED ROWS ===\n')

# Find rows with January 0000
bad_rows = csv[csv['Year-month'] == 'January 0000']
print('Rows with Year-month = "January 0000":', len(bad_rows))
print('Unique orders:', bad_rows['Sales order Number'].nunique())
print('Total revenue in skipped rows: $', bad_rows['Total Price'].sum())

print('\nSample of bad rows:')
print(bad_rows[['Sales order Number', 'Issued date', 'Year-month', 'Sales person', 'Total Price']].head(20))

print('\n=== CHECKING DECEMBER 2025 ===')
dec_2025 = csv[csv['Year-month'] == 'December 2025']
print('December 2025 rows in CSV:', len(dec_2025))
print('December 2025 unique orders:', dec_2025['Sales order Number'].nunique())
print('December 2025 revenue: $', dec_2025['Total Price'].sum())

# Check overlap
dec_orders = set(dec_2025['Sales order Number'].unique())
bad_orders = set(bad_rows['Sales order Number'].unique())
overlap = dec_orders.intersection(bad_orders)

print('\nDecember 2025 orders that were skipped:', len(overlap))
if len(overlap) > 0:
    print('❌ CRITICAL: December orders were skipped:', list(overlap)[:10])
else:
    print('✅ GOOD: No December 2025 orders were skipped')

print('\n=== BREAKDOWN OF SKIPPED ROWS ===')
print('By sales person:')
print(bad_rows.groupby('Sales person')['Total Price'].agg(['count', 'sum']).sort_values('sum', ascending=False))

print('\n=== IMPORT RESULTS ===')
print('Total rows in CSV:', len(csv))
print('Rows imported (13,228 items created):', 13228)
print('Rows skipped (1,628):', 1628)
print('Difference:', len(csv) - 13228 - 1628)
