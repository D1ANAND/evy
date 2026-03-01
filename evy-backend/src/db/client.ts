import Database from 'better-sqlite3';
import { DB_PATH } from '../config';
import { createSchema } from './schema';
import { seedDatabase } from './seed';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  createSchema(_db);
  seedDatabase(_db);

  console.log(`[db] Connected to SQLite at ${DB_PATH}`);
  return _db;
}
