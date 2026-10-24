import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, chmod, rename, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

if (!process.argv[2]) throw new Error('Использование: node scripts/restore.mjs путь-к-копии.sqlite. Сначала остановите приложение.');
const source = resolve(process.argv[2]);
const target = resolve(process.env.DB_PATH ?? 'data/svod.sqlite');
if (source === target) throw new Error('Нельзя восстановить базу из неё самой');
await stat(source);
process.umask(0o077);
await mkdir(dirname(target), { recursive: true, mode: 0o700 });
const temporary = `${target}.restore-${randomUUID()}`;
const database = new DatabaseSync(source, { readOnly: true });
try {
  if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Копия повреждена');
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
  if (!['accounts', 'balances', 'rates', 'settings', 'sessions'].every(name => tables.includes(name))) throw new Error('Это не резервная копия Свода');
  await backup(database, temporary);
  const replacement = new DatabaseSync(temporary);
  try { replacement.exec('DELETE FROM sessions; PRAGMA journal_mode=DELETE;'); }
  finally { replacement.close(); }
  await chmod(temporary, 0o600);
  await rm(`${target}-wal`, { force: true });
  await rm(`${target}-shm`, { force: true });
  await rename(temporary, target);
  console.log(`База восстановлена: ${target}. Все сессии завершены.`);
} finally { database.close(); await rm(temporary, { force: true }); }
