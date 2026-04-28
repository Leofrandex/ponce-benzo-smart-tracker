/**
 * Script to analyze MAESTRO.xlsx — first 2 sheets only, with truncated output
 */
const XLSX = require('xlsx');
const path = require('path');

const maestroPath = path.resolve(__dirname, '..', 'MAESTRO.xlsx');
const maestroWb = XLSX.readFile(maestroPath);

console.log(`MAESTRO.xlsx Sheets: ${maestroWb.SheetNames.join(', ')}\n`);

// Only first 2 sheets (the big ones)
for (const sheetName of maestroWb.SheetNames.slice(0, 2)) {
  const ws = maestroWb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: null });
  
  if (data.length === 0) {
    console.log(`--- Sheet: "${sheetName}" --- (EMPTY)\n`);
    continue;
  }

  console.log(`--- Sheet: "${sheetName}" ---`);
  console.log(`Rows: ${data.length}`);
  
  const cols = Object.keys(data[0]);
  console.log(`Columns (${cols.length}):`);
  cols.forEach((c, i) => console.log(`  [${i}] ${c}`));
  
  // Sample first 2 rows
  console.log('\nSample row 1:');
  const row1 = data[0];
  for (const [k,v] of Object.entries(row1)) {
    if (v !== null && v !== undefined) console.log(`  ${k}: ${v}`);
  }
  
  console.log('\nSample row 2:');
  const row2 = data[1];
  for (const [k,v] of Object.entries(row2)) {
    if (v !== null && v !== undefined) console.log(`  ${k}: ${v}`);
  }

  // Unique counts only
  console.log('\n--- Unique value counts ---');
  for (const col of cols) {
    const values = data.map((r: any) => r[col]).filter((v: any) => v !== null && v !== undefined && v !== '');
    const unique = new Set(values);
    const sample = [...unique].slice(0, 10).join(', ');
    console.log(`  ${col}: ${unique.size} unique / ${values.length} non-empty → [${sample}${unique.size > 10 ? '...' : ''}]`);
  }
  console.log();
}

// RUTAS — get sheet names and count vendedores
const rutasPath = path.resolve(__dirname, '..', 'RUTAS 05-12-25 (1).xlsx');
const rutasWb = XLSX.readFile(rutasPath);
console.log(`\nRUTAS.xlsx Sheets: ${rutasWb.SheetNames.join(', ')}`);

// Extract vendedor names from each sheet
for (const sheetName of rutasWb.SheetNames) {
  const ws = rutasWb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: null });
  
  // Find the NOMBRE row
  let vendedor = 'unknown';
  for (const row of data) {
    const pv = (row as any)['Plan de visitas'];
    if (typeof pv === 'string' && pv.startsWith('NOMBRE:')) {
      vendedor = pv.replace('NOMBRE:', '').trim();
      break;
    }
  }
  
  // Count unique stores across all days
  const stores = new Set<string>();
  for (const row of data) {
    for (const val of Object.values(row)) {
      if (typeof val === 'string' && val !== 'ASESOR COMERCIAL' && !val.startsWith('NOMBRE:') && !val.startsWith('Ruta') && !val.startsWith('Rev') && !['Lunes','Martes','Miércoles','Jueves','Viernes'].includes(val)) {
        stores.add(val.trim());
      }
    }
  }
  
  // Count days (columns with routes)
  const firstDataRow = data.find((r: any) => r['__EMPTY'] === 'Ruta 1' || r['__EMPTY'] === 1);
  const numCols = firstDataRow ? Object.keys(firstDataRow).filter(k => {
    const v = (firstDataRow as any)[k];
    return v === 'Ruta 1' || v === 'Ruta 2' || v === 'Ruta 3' || v === 'Ruta 4' || v === 'Ruta 5';
  }).length : 0;
  
  console.log(`  Sheet "${sheetName}": ${vendedor} → ${stores.size} tiendas únicas, ${data.length} filas`);
}
