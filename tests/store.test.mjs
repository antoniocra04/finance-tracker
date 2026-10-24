import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.mjs';
import { toMinor, fromMinor, convert } from '../server/money.mjs';

const rates = (date, rub = 100) => ({ date, rates: { USD: 1, RUB: rub, KZT: 500, JPY: 150, KWD: 0.3 }, nextUpdate: '2026-10-25T00:00:00Z' });

test('money preserves ISO precision and rejects nonfinite, excessive or fractional minor amounts', () => {
  assert.equal(toMinor('123.45', 'USD'), 12345);
  assert.equal(toMinor('1,005', 'KWD'), 1005);
  assert.equal(toMinor('123', 'JPY'), 123);
  assert.equal(fromMinor(12345, 'USD'), 123.45);
  for (const amount of ['NaN', 'Infinity', '1.001', '-1', '1e9', '100000000000000']) assert.throws(() => toMinor(amount, 'USD'));
  assert.throws(() => toMinor('1.5', 'JPY'));
  assert.equal(convert(100, 'USD', 'RUB', { USD: 1, RUB: 100 }), 10000);
  assert.equal(convert(100, 'USD', 'KZT', {}), null);
});

test('capital uses latest dated balances and cross rates; corrections persist in journal', () => {
  const store = new Store(':memory:');
  try {
    store.saveRates(rates('2026-10-20'));
    const usd = store.createAccount({ name: 'Dollar', institution: 'Bank', currency: 'USD', type: 'savings', amount: '100', date: '2026-10-20' });
    store.createAccount({ name: 'Tenge', currency: 'KZT', amount: '50000', date: '2026-10-20' });
    store.recordBalance(usd.id, { amount: '150', date: '2026-10-21', note: 'New balance' });
    store.recordBalance(usd.id, { amount: '200', date: '2026-10-21', note: 'Correction' });
    store.saveRates(rates('2026-10-22', 110));
    const data = store.dashboard('RUB', '2026-10-22');
    assert.equal(data.total, 33000);
    assert.equal(data.history.find(point => point.date === '2026-10-20').total, 20000);
    assert.equal(data.history.find(point => point.date === '2026-10-21').total, 30000);
    assert.equal(data.change.balance, 10000);
    assert.equal(data.change.fx, 3000);
    assert.equal(data.journal.length, 4);
    assert.equal(store.dashboard('KZT', '2026-10-22').total, 150000);
  } finally { store.db.close(); }
});

test('missing FX remains explicit and history never backfills with future rates', () => {
  const store = new Store(':memory:');
  try {
    store.createAccount({ name: 'USD', currency: 'USD', amount: '100', date: '2026-10-20' });
    assert.equal(store.dashboard('RUB', '2026-10-20').total, null);
    store.saveRates(rates('2026-10-22'));
    const data = store.dashboard('RUB', '2026-10-22');
    assert.equal(data.history[0].total, null);
    assert.equal(data.total, 10000);
  } finally { store.db.close(); }
});

test('archive excludes current value but preserves prior dates and exported accounts', () => {
  const store = new Store(':memory:');
  try {
    const account = store.createAccount({ name: 'Cash', currency: 'RUB', amount: '500', date: '2026-10-20' });
    store.archiveAccount(account.id, '2026-10-22');
    const data = store.dashboard('RUB', '2026-10-22');
    assert.equal(data.total, 0);
    assert.equal(data.history[0].total, 500);
    assert.equal(store.export().accounts.length, 1);
    assert.throws(() => store.recordBalance(account.id, { amount: '10', date: '2026-10-22' }));
    assert.throws(() => store.createAccount({ name: 'Future', currency: 'USD', amount: '1', date: '2099-01-01' }));
    assert.throws(() => store.createAccount({ name: '', currency: 'USD', amount: '1' }));
    assert.throws(() => store.createAccount({ name: 'Invalid date', currency: 'USD', amount: '1', date: '2026-02-30' }));
  } finally { store.db.close(); }
});
