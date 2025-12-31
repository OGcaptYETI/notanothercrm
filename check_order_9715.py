import pandas as pd

ytd = pd.read_csv(r'C:\Projects\KanvaPortal\docs\2025 YTD.csv')
ben_csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\ben_12_2025.csv')

print('=== ORDER 9715 IN 2025 YTD.CSV ===\n')
order_9715_ytd = ytd[ytd['Sales order Number'] == 9715]

if len(order_9715_ytd) > 0:
    print('FOUND Order 9715 in YTD.csv:')
    print('  Line Items:', len(order_9715_ytd))
    print('  Sales Person:', order_9715_ytd['Sales person'].unique())
    print('  Issued Date:', order_9715_ytd['Issued date'].unique())
    print('  Total Revenue:', order_9715_ytd['Total Price'].sum())
    print('\nLine item details:')
    print(order_9715_ytd[['Issued date', 'Sales order Number', 'Sales person', 'Total Price', 'Product']])
else:
    print('Order 9715 NOT FOUND in 2025 YTD.csv')

print('\n=== ORDER 9715 IN ben_12_2025.csv ===\n')
order_9715_ben = ben_csv[ben_csv['Sales order Number'] == 9715]
print('Line Items:', len(order_9715_ben))
print('Issued Date:', order_9715_ben['Issued date'].unique())
print('Total Revenue:', order_9715_ben['Total Price'].sum())
print('\nLine item details:')
print(order_9715_ben[['Issued date', 'Sales order Number', 'Sales person', 'Total Price', 'Product']])

print('\n=== SEARCH FOR 01-01 DATES IN YTD ===')
jan_dates = ytd[ytd['Issued date'].str.contains('01-01', na=False)]
print(f'Found {len(jan_dates)} rows with 01-01 dates')
if len(jan_dates) > 0:
    print('\nSample:')
    print(jan_dates[['Issued date', 'Sales order Number', 'Sales person', 'Total Price']].head(20))
