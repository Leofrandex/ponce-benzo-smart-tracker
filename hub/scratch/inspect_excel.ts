import * as XLSX from 'xlsx';
import * as fs from 'fs';

const workbook = XLSX.readFile('data para supabase.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log("Columns found in sheet:", Object.keys(data[0] || {}));
console.log("First row example:", data[0]);
console.log("Total rows:", data.length);
