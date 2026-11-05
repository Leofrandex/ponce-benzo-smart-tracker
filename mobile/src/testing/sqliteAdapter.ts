// Solo para pruebas: SQLite real en memoria (node:sqlite) con la forma de expo-sqlite
// que usa la app (execAsync, runAsync, getAllAsync, getFirstAsync).
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

export function memoryDb(): SQLiteDatabase {
  const d = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { d.exec(sql); },
    runAsync: async (sql: string, ...args: any[]) => { d.prepare(sql).run(...args); },
    getAllAsync: async (sql: string, ...args: any[]) => d.prepare(sql).all(...args),
    getFirstAsync: async (sql: string, ...args: any[]) => d.prepare(sql).get(...args) ?? null,
  };
  return db as unknown as SQLiteDatabase;
}
