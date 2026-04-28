/**
 * Script to analyze MAESTRO.xlsx and RUTAS 05-12-25 (1).xlsx
 * Extracts schema info, sample data, and statistics
 */
const XLSX = require('xlsx');
const path = require('path');

// ── MAESTRO.xlsx ──────────────────────────────────────────────
console.log('='.repeat(80));
console.log('ANALYZING: MAESTRO.xlsx');
console.log('='.repeat(80));

const maestroPath = path.resolve(__dirname, '..', 'MAESTRO.xlsx');
const maestroWb = XLSX.readFile(maestroPath);

console.log(`\nSheets: ${maestroWb.SheetNames.join(', ')}`);

for (const sheetName of maestroWb.SheetNames) {
  const ws = maestroWb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: null });
  
  if (data.length === 0) {
    console.log(`\n--- Sheet: "${sheetName}" --- (EMPTY)`);
    continue;
  }

  console.log(`\n--- Sheet: "${sheetName}" ---`);
  console.log(`Rows: ${data.length}`);
  
  // Column names
  const cols = Object.keys(data[0]);
  console.log(`Columns (${cols.length}): ${cols.join(' | ')}`);
  
  // Sample first 3 rows
  console.log('\nSample rows (first 3):');
  for (let i = 0; i < Math.min(3, data.length); i++) {
    console.log(JSON.stringify(data[i], null, 2));
  }

  // Unique value counts for key columns
  console.log('\n--- Unique value analysis ---');
  for (const col of cols) {
    const values = data.map((r: any) => r[col]).filter((v: any) => v !== null && v !== undefined && v !== '');
    const unique = new Set(values);
    if (unique.size <= 30) {
      console.log(`  ${col}: ${unique.size} unique values → [${[...unique].slice(0, 15).join(', ')}${unique.size > 15 ? '...' : ''}]`);
    } else {
      console.log(`  ${col}: ${unique.size} unique values (${values.length} non-empty)`);
    }
  }
}

// ── RUTAS ──────────────────────────────────────────────────────
console.log('\n\n' + '='.repeat(80));
console.log('ANALYZING: RUTAS 05-12-25 (1).xlsx');
console.log('='.repeat(80));

const rutasPath = path.resolve(__dirname, '..', 'RUTAS 05-12-25 (1).xlsx');
const rutasWb = XLSX.readFile(rutasPath);

console.log(`\nSheets: ${rutasWb.SheetNames.join(', ')}`);

for (const sheetName of rutasWb.SheetNames) {
  const ws = rutasWb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: null });
  
  if (data.length === 0) {
    console.log(`\n--- Sheet: "${sheetName}" --- (EMPTY)`);
    continue;
  }

  console.log(`\n--- Sheet: "${sheetName}" ---`);
  console.log(`Rows: ${data.length}`);
  
  const cols = Object.keys(data[0]);
  console.log(`Columns (${cols.length}): ${cols.join(' | ')}`);
  
  // Sample first 5 rows
  console.log('\nSample rows (first 5):');
  for (let i = 0; i < Math.min(5, data.length); i++) {
    console.log(JSON.stringify(data[i], null, 2));
  }

  // Unique value counts
  console.log('\n--- Unique value analysis ---');
  for (const col of cols) {
    const values = data.map((r: any) => r[col]).filter((v: any) => v !== null && v !== undefined && v !== '');
    const unique = new Set(values);
    if (unique.size <= 30) {
      console.log(`  ${col}: ${unique.size} unique values → [${[...unique].slice(0, 20).join(', ')}${unique.size > 20 ? '...' : ''}]`);
    } else {
      console.log(`  ${col}: ${unique.size} unique values (${values.length} non-empty)`);
    }
  }
}
