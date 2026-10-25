import { createServer } from 'node:http';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { currencyCodes } from './money.mjs';

const scrypt = promisify(scryptCallback);
const hashToken = token => createHash('sha256').update(token).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
const assets = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/fx.mjs', ['fx.mjs', 'text/javascript']], ['/styles.css', ['styles.css', 'text/css']], ['/icon.svg', ['icon.svg', 'image/svg+xml']]]);

async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw fail(400, 'Пароль: от 12 до 256 символов');
  const salt = randomBytes(24).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [salt, expected] = (stored ?? `${'0'.repeat(48)}:${'0'.repeat(128)}`).split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

async function jsonBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Ожидается JSON');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw fail(413, 'Слишком большой запрос');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw fail(400, 'Некорректный JSON'); }
}

export async function fetchLiveRates() {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Rate provider HTTP ${response.status}`);
  const data = await response.json();
  if (data.result !== 'success' || data.base_code !== 'USD' || !Number.isFinite(data.time_last_update_unix) || !Number.isFinite(data.time_next_update_unix)) throw new Error('Invalid rate response');
  return {
    date: new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10),
    updatedAt: new Date(data.time_last_update_unix * 1000).toISOString(),
    nextUpdate: new Date(data.time_next_update_unix * 1000).toISOString(), rates: data.rates
  };
}

export function createApp({ dbPath, bootstrapToken, fetchRates = fetchLiveRates, secureCookie = false, appOrigin } = {}) {
  const store = new Store(dbPath ?? ':memory:');
  const attempts = new Map();
  let pendingRefresh;
  let settingUp = false;
  const cookieOptions = `Path=/; HttpOnly; SameSite=Strict${secureCookie ? '; Secure' : ''}`;
  function newSession(response) {
    const token = randomBytes(32).toString('hex');
    store.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    store.db.prepare('INSERT INTO sessions VALUES (?,?)').run(hashToken(token), Date.now() + 7 * 86400000);
    response.setHeader('Set-Cookie', `svod_session=${token}; ${cookieOptions}; Max-Age=604800`);
  }
  function session(request) {
    const token = request.headers.cookie?.match(/(?:^|;\s*)svod_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    return token ? store.db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(hashToken(token), Date.now()) : null;
  }
  async function refreshRates() {
    if (pendingRefresh) return pendingRefresh;
    const latest = store.latestRates();
    const retryAt = Number(store.getSetting('rateRetryAt') ?? 0);
    if ((latest?.nextUpdate && Date.parse(latest.nextUpdate) > Date.now()) || retryAt > Date.now()) return latest;
    pendingRefresh = (async () => {
      try {
        const payload = await fetchRates();
        store.saveRates(payload);
        store.setSetting('rateError', '');
        store.setSetting('rateRetryAt', '0');
        return payload;
      } catch {
        store.setSetting('rateError', 'Не удалось обновить курсы. Повторим через час.');
        store.setSetting('rateRetryAt', Date.now() + 3600000);
        return latest;
      } finally { pendingRefresh = null; }
    })();
    return pendingRefresh;
  }
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    const send = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data)); };
    try {
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      const method = request.method;
      if (!path.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(method) || !assets.has(path)) throw fail(404, 'Страница не найдена');
        const [file, mime] = assets.get(path);
        const content = await readFile(fileURLToPath(new URL(`../public/${file}`, import.meta.url)));
        response.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` });
        response.end(method === 'HEAD' ? undefined : content);
        return;
      }
      if (!['GET', 'HEAD'].includes(method)) {
        const origin = request.headers.origin;
        const expected = appOrigin || `${secureCookie ? 'https' : 'http'}://${request.headers.host}`;
        if (!origin || origin !== expected || request.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Запрос с другого сайта отклонён');
      }
      const initialized = Boolean(store.getSetting('password'));
      if (path === '/api/session' && method === 'GET') {
        send(200, { initialized, authenticated: Boolean(session(request)), base: initialized ? undefined : 'RUB' }); return;
      }
      if ((path === '/api/login' || path === '/api/setup') && method === 'POST') {
        const key = request.socket.remoteAddress;
        const now = Date.now();
        for (const [address, attempt] of attempts) if (attempt.until < now) attempts.delete(address);
        const attempt = attempts.get(key) ?? { count: 0, until: now + 900000 };
        if (attempt.count >= 5) throw fail(429, 'Слишком много попыток. Подождите 15 минут.');
        const body = await jsonBody(request);
        attempt.count++;
        attempts.set(key, attempt);
        if (path === '/api/setup') {
          if (initialized || settingUp) throw fail(409, 'Пароль уже установлен');
          if (!bootstrapToken || typeof body.token !== 'string' || hashToken(body.token) !== hashToken(bootstrapToken)) {
            throw fail(403, 'Неверный код установки');
          }
          settingUp = true;
          try { store.setSetting('password', await passwordHash(body.password)); }
          finally { settingUp = false; }
        } else if (!await verifyPassword(body.password, store.getSetting('password')) || !initialized) {
          throw fail(401, 'Неверный пароль');
        }
        attempts.delete(key);
        newSession(response);
        send(200, { ok: true }); return;
      }
      const activeSession = session(request);
      if (!activeSession) throw fail(401, 'Войдите в приложение');
      if (path === '/api/logout' && method === 'POST') {
        store.db.prepare('DELETE FROM sessions WHERE token=?').run(activeSession.token);
        response.setHeader('Set-Cookie', `svod_session=; ${cookieOptions}; Max-Age=0`);
        send(200, { ok: true }); return;
      }
      if (path === '/api/data' && method === 'GET') { send(200, store.dashboard()); return; }
      if (path === '/api/currencies' && method === 'GET') {
        const latest = store.latestRates();
        for (const code of Object.keys(latest?.rates ?? {})) currencyCodes.add(code);
        send(200, [...currencyCodes].sort().map(code => ({ code, supported: code === 'USD' || Boolean(latest?.rates[code]) }))); return;
      }
      if (path === '/api/accounts' && method === 'POST') { send(201, store.createAccount(await jsonBody(request))); return; }
      const balanceRoute = path.match(/^\/api\/balances\/([1-9]\d*)$/);
      if (balanceRoute) {
        const id = Number(balanceRoute[1]);
        if (!Number.isSafeInteger(id)) throw fail(400, 'Некорректный номер записи');
        if (method === 'PATCH') store.updateBalance(id, await jsonBody(request));
        else if (method === 'DELETE') { await jsonBody(request); store.deleteBalance(id); }
        else throw fail(405, 'Метод не поддерживается');
        send(200, { ok: true }); return;
      }
      const accountRoute = path.match(/^\/api\/accounts\/([a-f0-9-]{36})(?:\/(balances|archive))?$/);
      if (accountRoute) {
        const [, id, action] = accountRoute;
        if (action === 'balances' && method === 'POST') store.recordBalance(id, await jsonBody(request));
        else if (action === 'archive' && method === 'POST') { await jsonBody(request); store.archiveAccount(id); }
        else if (!action && method === 'PATCH') store.updateAccount(id, await jsonBody(request));
        else throw fail(405, 'Метод не поддерживается');
        send(200, { ok: true }); return;
      }
      if (path === '/api/settings' && method === 'PUT') {
        const body = await jsonBody(request);
        if (!currencyCodes.has(body.base)) throw fail(400, 'Неизвестная валюта');
        store.setSetting('base', body.base); send(200, { ok: true }); return;
      }
      if (path === '/api/password' && method === 'PUT') {
        const body = await jsonBody(request);
        if (!await verifyPassword(body.current, store.getSetting('password'))) throw fail(403, 'Текущий пароль неверен');
        const hash = await passwordHash(body.password);
        store.transaction(() => { store.setSetting('password', hash); store.db.exec('DELETE FROM sessions'); });
        send(200, { ok: true }); return;
      }
      if (path === '/api/rates/refresh' && method === 'POST') {
        await jsonBody(request); await refreshRates(); send(200, { ok: true, error: store.getSetting('rateError') || null }); return;
      }
      if (path === '/api/export' && method === 'GET') {
        response.setHeader('Content-Disposition', 'attachment; filename="svod-export.json"');
        send(200, store.export()); return;
      }
      throw fail(404, 'Не найдено');
    } catch (error) {
      const isStorage = error.code?.startsWith('ERR_SQLITE') || error.code === 'ENOENT';
      const status = error.status ?? (isStorage ? 500 : 400);
      if (status === 500) console.error('Request failed:', error.message);
      if (!response.headersSent) send(status, { error: status === 500 ? 'Ошибка сервера. Проверьте журнал.' : error.message });
      else response.end();
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 15000;
  return { server, store, refreshRates };
}
