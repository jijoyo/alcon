import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { open, close } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(path.dirname(__dirname), 'tasks.json');
const CHAT_FILE = path.join(path.dirname(__dirname), 'messages.json');

function migrate() {
  console.log('=== Migration: tasks.json + messages.json → SQLite ===\n');

  const db = open();
  const migrateMessages = db.transaction(() => {
    // --- Migrate tasks.json ---
    if (!fs.existsSync(DATA_FILE)) {
      console.log('No tasks.json found, skipping task migration.');
    } else {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      const tasks = data.tasks || [];
      console.log(`Found ${tasks.length} tasks in tasks.json`);

      for (const task of tasks) {
        db.prepare(`
          INSERT OR REPLACE INTO tasks
            (id, text, original_text, status, assigned_to,
             lock_owner, lock_acquired_at, lock_expires_at,
             last_heartbeat, result, created, completed_at, error_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id,
          task.text,
          task.original_text,
          task.status || 'pendiente',
          task.assigned_to,
          task.lock_owner,
          task.lock_acquired_at,
          task.lock_expires_at,
          task.last_heartbeat,
          task.result,
          task.created,
          task.completed_at,
          task.error_at
        );

        for (const msg of (task.messages || [])) {
          db.prepare(`
            INSERT OR IGNORE INTO messages
              (id, task_id, from_agent, text, timestamp)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            msg.id || crypto.randomUUID(),
            task.id,
            msg.from,
            msg.text,
            msg.timestamp
          );
        }
      }

      console.log(`Migrated ${tasks.length} tasks with messages`);
    }

    // --- Migrate messages.json (global chat) ---
    if (!fs.existsSync(CHAT_FILE)) {
      console.log('No messages.json found, skipping chat migration.');
    } else {
      const raw = fs.readFileSync(CHAT_FILE, 'utf8');
      const chat = JSON.parse(raw);
      console.log(`Found ${chat.length} global chat messages`);

      for (const msg of chat) {
        db.prepare(`
          INSERT OR IGNORE INTO chat
            (id, from_agent, text, timestamp)
          VALUES (?, ?, ?, ?)
        `).run(
          msg.id || crypto.randomUUID(),
          msg.from,
          msg.text,
          msg.timestamp
        );
      }

      console.log(`Migrated ${chat.length} chat messages`);
    }
  });

  migrateMessages();

  // Verify
  const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  const msgCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
  const chatCount = db.prepare('SELECT COUNT(*) as count FROM chat').get();
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get();

  console.log(`\nVerification:`);
  console.log(`  Tasks:   ${taskCount.count}`);
  console.log(`  Messages: ${msgCount.count}`);
  console.log(`  Chat:    ${chatCount.count}`);
  console.log(`  Agents:   ${agentCount.count}`);

  const wal = db.pragma('journal_mode')[0];
  console.log(`  WAL mode: ${wal.journal_mode}`);

  close();
  console.log('\nMigration complete!');
}

migrate();
