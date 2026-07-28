import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'alcon.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

export function open() {
  if (db) return db;

  const init = !fs.existsSync(DB_PATH);

  db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (init) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
  }

  return db;
}

export function close() {
  if (db) {
    db.close();
    db = null;
  }
}

export function get() {
  if (!db) open();
  return db;
}
