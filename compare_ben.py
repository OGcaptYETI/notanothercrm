import pandas as pd

ben_csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\ben_12_2025.csv')
ytd_csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\2025 YTD.csv')

# Filter YTD for BenW December
ytd_ben = ytd_csv[(ytd_csv['Sales person'] == 'BenW') & (ytd_csv['Issued date'].str.startswith('12-', na=False))]

print('=== COMPARISON: BenW December 2025 ===\n')
print('ben_12_2025.csv:')
print('  Rows:', len(ben_csv))
print('  Revenue: $', ben_csv['Total Price'].sum())
print('  Unique Orders:', ben_csv['Sales order Number'].nunique())

print('\n2025 YTD.csv (BenW, December):')
print('  Rows:', len(ytd_ben))
print('  Revenue: $', ytd_ben['Total Price'].sum())
print('  Unique Orders:', ytd_ben['Sales order Number'].nunique())

print('\n=== DISCREPANCY ===')
print('Missing Rows:', len(ben_csv) - len(ytd_ben))
print('Missing Revenue: $', ben_csv['Total Price'].sum() - ytd_ben['Total Price'].sum())

print('\n=== FIND MISSING ORDERS ===')
ben_orders = set(ben_csv['Sales order Number'].unique())
ytd_orders = set(ytd_ben['Sales order Number'].unique())
missing_orders = ben_orders - ytd_orders

print('Orders in ben_12_2025.csv but NOT in 2025 YTD.csv:', sorted(missing_orders))

if missing_orders:
    print('\nMissing order details:')
    total_missing_revenue = 0
    for order in sorted(missing_orders):
        order_data = ben_csv[ben_csv['Sales order Number'] == order]
        order_revenue = order_data['Total Price'].sum()
        total_missing_revenue += order_revenue
        print(f'\n  Order {order}:')
        print(f'    Line Items: {len(order_data)}')
        print(f'    Revenue: ${order_revenue}')
        print(f'    Dates: {order_data["Issued date"].unique()}')
    
    print(f'\n  TOTAL MISSING REVENUE: ${total_missing_revenue}')

print('\n=== CHECK FOR EXTRA ORDERS IN YTD ===')
extra_orders = ytd_orders - ben_orders
if extra_orders:
    print('Orders in 2025 YTD.csv but NOT in ben_12_2025.csv:', sorted(extra_orders))
else:
    print('No extra orders in YTD.csv')
