// Test date parsing for Fishbowl import
// Sample dates from user's XLSX file

function parseExcelOrTextDate(raw) {
  if (!raw && raw !== 0) return {};
  try {
    if (typeof raw === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + raw * 86400000);
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
    const s = String(raw).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { // ISO YYYY-MM-DD
      const [Y, M, D] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) { // MM/DD/YYYY or M/D/YY
      const [M, D, Yraw] = s.split('/').map((t) => t.trim());
      const Y = Number(Yraw.length === 2 ? (Number(Yraw) + 2000) : Yraw);
      const d = new Date(Y, Number(M) - 1, Number(D));
      return { date: d, monthKey: `${Y}-${String(Number(M)).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) { // MM-DD-YYYY
      const [M, D, Y] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
  } catch {}
  return {};
}

// Test cases from user's data
const testDates = [
  // XLSX format
  '12-04-2025 18:35:01',
  '12-08-2025 20:04:06',
  '12-09-2025 18:20:01',
  '12-11-2025 18:05:01',
  '12-29-2025 21:05:03',
  '04-01-2012',
  '07-01-2012',
  '08-01-2012',
  '11-01-2012',
  // CSV format
  '12/29/2025 21:05',
  '12/29/2025 18:35',
  '12/11/2025 17:15',
  '12/11/2025 18:05',
  '12/9/2025 17:54',
  '12/9/2025 18:20',
  '12/8/2025 17:55',
  '12/8/2025 20:04',
  '12/4/2025 17:00',
  '12/4/2025 18:35',
  '7/1/2012',
  '8/1/2012',
  '11/1/2012',
  '4/1/2012'
];

console.log('Testing date parsing:\n');
testDates.forEach(dateStr => {
  const result = parseExcelOrTextDate(dateStr);
  console.log(`Input: "${dateStr}"`);
  console.log(`  → monthKey: "${result.monthKey}"`);
  console.log(`  → year: ${result.y}`);
  console.log(`  → date: ${result.date}\n`);
});
