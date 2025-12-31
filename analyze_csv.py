import pandas as pd
import re

df = pd.read_csv(r'C:\Projects\KanvaPortal\docs\2025 YTD.csv')
dec_2025 = df[df['Issued date'].str.startswith('12-', na=False)]

print('=== DATE FORMAT VERIFICATION ===\n')
print('Sample December 2025 Dates:')
print(dec_2025['Issued date'].head(20).tolist())

print('\n--- DATE FORMAT PATTERNS ---')
date_patterns = dec_2025['Issued date'].apply(
    lambda x: 'MM-DD-YYYY HH:MM:SS' if re.match(r'^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$', str(x)) else 'OTHER'
)
print(date_patterns.value_counts())

print('\n--- VERIFY ALL DATES ARE DECEMBER 2025 ---')
print('All dates start with 12-:', dec_2025['Issued date'].str.startswith('12-').all())
print('\nSample dates to verify year:')
for date in dec_2025['Issued date'].head(10):
    parts = date.split(' ')[0].split('-')
    print(f'  {date} -> Month: {parts[0]}, Day: {parts[1]}, Year: {parts[2]}')

print('\n--- CHECK FOR ANY NON-2025 YEARS ---')
years = dec_2025['Issued date'].apply(lambda x: x.split(' ')[0].split('-')[2])
print('Unique years in December data:', years.unique())
print('All December dates are 2025:', (years == '2025').all())
