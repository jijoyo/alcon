import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'alcon.db');

const db = new Database(DB_PATH);

try {
  db.exec("ALTER TABLE tasks ADD COLUMN squad TEXT");
  console.log('✅ Columna "squad" agregada a tabla tasks');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('⚠️ Columna "squad" ya existe, skip');
  } else {
    throw e;
  }
}

db.close();
