import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../server/store.mjs';

test('backup includes committed WAL data; restore validates input, recovers balances and clears sessions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'svod-backup-'));
  const path = join(directory, 'live.sqlite');
  const copy = join(directory, 'copy.sqlite');
  const store = new Store(path);
  const run = (script, file) => spawnSync(process.execPath, [script, file], { env: { ...process.env, DB_PATH: path }, encoding: 'utf8' });
  try {
    store.createAccount({ name: 'Saved', currency: 'RUB', amount: '123.45' });
    store.db.prepare('INSERT INTO sessions VALUES (?,?)').run('session', Date.now() + 10000);
    assert.equal(run('scripts/backup.mjs', copy).status, 0);
    const backed = new DatabaseSync(copy);
    assert.equal(backed.prepare('SELECT amount FROM balances').get().amount, 12345);
    backed.close();
    assert.notEqual(run('scripts/backup.mjs', copy).status, 0);
    store.db.close();
    const invalid = join(directory, 'invalid.sqlite'); writeFileSync(invalid, 'invalid');
    assert.notEqual(run('scripts/restore.mjs', invalid).status, 0);
    assert.equal(run('scripts/restore.mjs', copy).status, 0);
    const restored = new Store(path);
    assert.equal(restored.dashboard().total, 123.45);
    assert.equal(restored.db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0);
    restored.db.close();
  } finally { try { store.db.close(); } catch {} rmSync(directory, { recursive: true, force: true }); }
});
