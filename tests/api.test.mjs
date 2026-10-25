import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server/app.mjs';

async function fixture(run, fetchRates = async () => { throw new Error('offline'); }) {
  const app = createApp({ dbPath: ':memory:', bootstrapToken: 'test-bootstrap-token', fetchRates, appOrigin: '' });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  let cookie = '';
  const request = async (path, method = 'GET', body, custom = {}) => {
    const response = await fetch(origin + path, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), origin, cookie, ...custom }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json(), headers: response.headers };
  };
  try { await run({ app, request, origin }); }
  finally { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); app.store.db.close(); }
}

test('setup token, session expiry, password validation and origin protect private data', async () => fixture(async ({ app, request }) => {
  assert.equal((await request('/api/data')).status, 401);
  assert.equal((await request('/api/setup', 'POST', { token: 'wrong', password: 'long-password-123' })).status, 403);
  assert.equal((await request('/api/setup', 'POST', { token: 'test-bootstrap-token', password: 'short' })).status, 400);
  const setup = await request('/api/setup', 'POST', { token: 'test-bootstrap-token', password: 'long-password-123' });
  assert.equal(setup.status, 200);
  assert.match(setup.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await request('/api/setup', 'POST', { token: 'test-bootstrap-token', password: 'long-password-123' })).status, 409);
  assert.equal((await request('/api/accounts', 'POST', { name: 'Cash', currency: 'RUB', amount: '100' }, { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request('/api/data')).status, 200);
  assert.equal((await request('/api/settings', 'PUT', { base: 'XXX' })).status, 400);
  assert.equal((await request('/api/accounts', 'POST', {}, { 'content-type': 'text/plain' })).status, 415);
  app.store.db.prepare('UPDATE sessions SET expires=0').run();
  assert.equal((await request('/api/data')).status, 401);
}));

test('successful provider refresh is cached until next publication', async () => {
  let calls = 0;
  await fixture(async ({ app }) => {
    await app.refreshRates();
    await app.refreshRates();
    assert.equal(calls, 1);
    assert.equal(app.store.latestRates().rates.KZT, 500);
  }, async () => {
    calls++;
    return { date: new Date().toISOString().slice(0, 10), nextUpdate: new Date(Date.now() + 86400000).toISOString(), rates: { USD: 1, RUB: 100, KZT: 500 } };
  });
});

test('split UTF-8 request chunks preserve Cyrillic passwords', async () => fixture(async ({ origin, request }) => {
  const password = 'пароль-длинный-123';
  const payload = Buffer.from(JSON.stringify({ token: 'test-bootstrap-token', password }));
  const split = payload.indexOf(Buffer.from('п')) + 1;
  const status = await new Promise((resolve, reject) => {
    const outgoing = httpRequest(origin + '/api/setup', { method: 'POST', headers: { origin, 'content-type': 'application/json' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    outgoing.on('error', reject);
    outgoing.write(payload.subarray(0, split));
    setTimeout(() => outgoing.end(payload.subarray(split)), 20);
  });
  assert.equal(status, 200);
  assert.equal((await request('/api/login', 'POST', { password })).status, 200);
}));

test('account mutations, journal export and password change work through authenticated HTTP', async () => fixture(async ({ request }) => {
  await request('/api/setup', 'POST', { token: 'test-bootstrap-token', password: 'long-password-123' });
  assert.equal((await request('/api/accounts', 'POST', { name: 'Bad', currency: 'USD', amount: 'NaN' })).status, 400);
  const created = await request('/api/accounts', 'POST', { name: 'Cash', currency: 'KZT', amount: '50000' });
  assert.equal(created.status, 201);
  assert.equal((await request(`/api/accounts/${created.data.id}/balances`, 'POST', { amount: '60000' })).status, 200);
  assert.equal((await request('/api/settings', 'PUT', { base: 'KZT' })).status, 200);
  assert.equal((await request('/api/data')).data.total, 60000);
  const exported = await request('/api/export');
  assert.equal(exported.data.balances.length, 2);
  assert.equal(exported.data.password, undefined);
  assert.equal((await request('/api/password', 'PUT', { current: 'wrong', password: 'new-password-123' })).status, 403);
  assert.equal((await request('/api/password', 'PUT', { current: 'long-password-123', password: 'new-password-123' })).status, 200);
  assert.equal((await request('/api/data')).status, 401);
  assert.equal((await request('/api/login', 'POST', { password: 'long-password-123' })).status, 401);
  assert.equal((await request('/api/login', 'POST', { password: 'new-password-123' })).status, 200);
  assert.equal((await request(`/api/accounts/${created.data.id}/archive`, 'POST', {})).status, 200);
  assert.equal((await request('/api/data')).data.total, 0);
}));

test('provider failure preserves cache, invalid data is rejected and retries are throttled', async () => fixture(async ({ app, request }) => {
  app.store.saveRates({ date: '2026-10-20', rates: { USD: 1, RUB: 100, KZT: 500 }, nextUpdate: '2026-10-21T00:00:00Z' });
  await app.refreshRates();
  assert.equal(app.store.latestRates().rates.RUB, 100);
  assert.ok(app.store.getSetting('rateError'));
  assert.throws(() => app.store.saveRates({ date: '2026-10-22', rates: { USD: 1, RUB: -1, KZT: 1 } }));
  await request('/api/setup', 'POST', { token: 'test-bootstrap-token', password: 'long-password-123' });
  for (let index = 0; index < 5; index++) await request('/api/login', 'POST', { password: 'wrong' });
  assert.equal((await request('/api/login', 'POST', { password: 'wrong' })).status, 429);
}));

test('history mutations require authentication and same origin and recalculate dashboard data', async () => fixture(async ({ request }) => {
  assert.equal((await request('/api/balances/1', 'PATCH', { amount: '99' })).status, 401);
  assert.equal((await request('/api/balances/1', 'DELETE', {})).status, 401);
  await request('/api/setup', 'POST', { token: 'test-bootstrap-token', password: 'long-password-123' });
  const created = await request('/api/accounts', 'POST', { name: 'Cash', currency: 'RUB', amount: '100', date: '2026-10-20' });
  await request(`/api/accounts/${created.data.id}/balances`, 'POST', { amount: '200', date: '2026-10-21' });
  const row = (await request('/api/data')).data.journal[0];
  for (const method of ['PATCH', 'DELETE']) {
    assert.equal((await request(`/api/balances/${row.id}`, method, { amount: '300' }, { origin: 'https://attacker.example' })).status, 403);
  }
  assert.equal((await request(`/api/balances/${row.id}`, 'PATCH', { amount: '300', date: '2026-10-22', note: 'Corrected' })).status, 200);
  assert.equal((await request('/api/data')).data.total, 300);
  assert.equal((await request(`/api/balances/${row.id}`, 'PATCH', { amount: 'NaN' })).status, 400);
  assert.equal((await request(`/api/balances/${row.id}`, 'DELETE', {})).status, 200);
  const after = (await request('/api/data')).data;
  assert.equal(after.total, 100);
  assert.equal(after.journal.length, 1);
  assert.equal((await request(`/api/balances/${after.journal[0].id}`, 'DELETE', {})).status, 400);
  assert.equal((await request('/api/export')).data.balances.length, 1);
}));
