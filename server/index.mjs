import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.mjs';

const dbPath = resolve(process.env.DB_PATH ?? 'data/svod.sqlite');
mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
process.umask(0o077);
const bootstrapToken = process.env.BOOTSTRAP_TOKEN || randomBytes(16).toString('hex');
const app = createApp({ dbPath, bootstrapToken, secureCookie: process.env.SECURE_COOKIE === 'true', appOrigin: process.env.APP_ORIGIN });
if (!app.store.getSetting('password')) console.log(`Код первой установки: ${bootstrapToken}`);
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);
app.server.listen(port, host, () => console.log(`Свод: http://${host}:${port}`));
void app.refreshRates();
const timer = setInterval(() => { void app.refreshRates(); }, 3600000);
timer.unref();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  clearInterval(timer);
  app.server.close(async () => { await app.refreshRates(); app.store.db.close(); process.exit(0); });
  app.server.closeIdleConnections();
});
