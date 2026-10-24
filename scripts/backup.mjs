import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, chmod, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = resolve(process.env.DB_PATH ?? 'data/svod.sqlite');
const target = resolve(process.argv[2] ?? `backups/svod-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
await stat(source);
if (source === target) throw new Error('Путь копии должен отличаться от основной базы');
try { await stat(target); throw new Error('Файл копии уже существует. Выберите другое имя.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
process.umask(0o077);
await mkdir(dirname(target), { recursive: true, mode: 0o700 });
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, target);
  await chmod(target, 0o600);
  console.log(`Резервная копия: ${target}`);
} finally { database.close(); }
