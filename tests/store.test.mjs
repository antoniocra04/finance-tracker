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

test('per-currency effects explain the aggregate FX change and follow the reporting currency', () => {
  const store = new Store(':memory:');
  try {
    store.saveRates(rates('2026-10-20'));
    const usd = store.createAccount({ name: 'USD', currency: 'USD', amount: '100', date: '2026-10-20' });
    store.createAccount({ name: 'KZT', currency: 'KZT', amount: '8000', date: '2026-10-20' });
    store.createAccount({ name: 'RUB', currency: 'RUB', amount: '500', date: '2026-10-20' });
    store.recordBalance(usd.id, { amount: '150', date: '2026-10-21' });
    store.saveRates({ ...rates('2026-10-22', 90), rates: { USD: 1, RUB: 90, KZT: 400 } });
    const data = store.dashboard('RUB', '2026-10-22');
    const dollars = data.currencies.find(row => row.currency === 'USD');
    const tenge = data.currencies.find(row => row.currency === 'KZT');
    assert.equal(dollars.rate, 90);
    assert.equal(dollars.initialRate, 100);
    assert.equal(dollars.fx, -1500);
    assert.equal(tenge.rate, 0.225);
    assert.equal(tenge.fx, 200);
    assert.equal(data.change.fx, -1300);
    assert.equal(data.currencies.reduce((sum, row) => sum + row.fx, 0), -1300);
    assert.deepEqual(data.fxHistory.find(row => row.currency === 'USD').points, [
      { date: '2026-10-20', rate: 100, rateDate: '2026-10-20' },
      { date: '2026-10-22', rate: 90, rateDate: '2026-10-22' }
    ]);
    assert.equal(data.fxHistory.some(row => row.currency === 'RUB'), false);
    const inTenge = store.dashboard('KZT', '2026-10-22');
    assert.equal(inTenge.currencies.find(row => row.currency === 'USD').rate, 400);
    assert.equal(inTenge.fxHistory.some(row => row.currency === 'KZT'), false);
  } finally { store.db.close(); }
});

test('quote history carries only past snapshots and keeps missing initial rates explicit', () => {
  const store = new Store(':memory:');
  try {
    store.createAccount({ name: 'USD', currency: 'USD', amount: '100', date: '2026-10-20' });
    store.saveRates(rates('2026-10-22'));
    const missing = store.dashboard('RUB', '2026-10-22');
    assert.equal(missing.currencies[0].initialRate, null);
    assert.equal(missing.currencies[0].fx, null);
    assert.deepEqual(missing.fxHistory[0].points, [
      { date: '2026-10-20', rate: null, rateDate: null },
      { date: '2026-10-22', rate: 100, rateDate: '2026-10-22' }
    ]);
    store.saveRates(rates('2026-10-19', 95));
    assert.deepEqual(store.dashboard('RUB', '2026-10-21').fxHistory[0].points, [
      { date: '2026-10-20', rate: 95, rateDate: '2026-10-19' }
    ]);
    assert.deepEqual(store.dashboard('USD', '2026-10-22').fxHistory, []);
  } finally { store.db.close(); }
});

test('editing a history row validates currency precision and recalculates dated balances and export', () => {
  const store = new Store(':memory:');
  try {
    const account = store.createAccount({ name: 'Yen', currency: 'JPY', amount: '100', date: '2026-10-20' });
    store.recordBalance(account.id, { amount: '200', date: '2026-10-21' });
    const row = store.dashboard('JPY', '2026-10-22').journal[0];
    store.updateBalance(row.id, { amount: '350', date: '2026-10-22', note: 'Исправлено' });
    const data = store.dashboard('JPY', '2026-10-22');
    assert.equal(data.total, 350);
    assert.equal(data.history.find(point => point.date === '2026-10-21').total, 100);
    assert.equal(data.journal[0].created_at, row.created_at);
    assert.equal(data.journal[0].id, row.id);
    assert.equal(store.export().balances.find(item => item.id === row.id).note, 'Исправлено');
    for (const input of [{ amount: '1.5' }, { amount: '-1' }, { amount: '1', date: '2099-01-01' }, { amount: '1', note: 'x'.repeat(501) }]) {
      assert.throws(() => store.updateBalance(row.id, input));
    }
    assert.equal(store.dashboard('JPY', '2026-10-22').total, 350);
    assert.throws(() => store.updateBalance(999999, { amount: '1' }), /не найдена/);
  } finally { store.db.close(); }
});

test('deleting a correction restores the previous row and protects the sole balance', () => {
  const store = new Store(':memory:');
  try {
    const account = store.createAccount({ name: 'Cash', currency: 'RUB', amount: '100', date: '2026-10-20' });
    store.recordBalance(account.id, { amount: '200', date: '2026-10-21' });
    store.recordBalance(account.id, { amount: '300', date: '2026-10-21' });
    store.deleteBalance(store.dashboard('RUB', '2026-10-22').journal[0].id);
    assert.equal(store.dashboard('RUB', '2026-10-22').total, 200);
    store.deleteBalance(store.dashboard('RUB', '2026-10-22').journal[0].id);
    const remaining = store.dashboard('RUB', '2026-10-22').journal[0];
    assert.equal(store.dashboard('RUB', '2026-10-22').total, 100);
    assert.throws(() => store.deleteBalance(remaining.id), /Единственную запись/);
    assert.equal(store.export().balances.length, 1);
    assert.throws(() => store.deleteBalance(999999), /не найдена/);
  } finally { store.db.close(); }
});

test('editing archived history never unarchives accounts or permits post-archive dates', () => {
  const store = new Store(':memory:');
  try {
    const account = store.createAccount({ name: 'Old', currency: 'RUB', amount: '100', date: '2026-10-20' });
    const row = store.dashboard('RUB', '2026-10-20').journal[0];
    store.archiveAccount(account.id, '2026-10-22');
    store.updateBalance(row.id, { amount: '250', date: '2026-10-21' });
    const data = store.dashboard('RUB', '2026-10-23');
    assert.equal(data.total, 0);
    assert.equal(data.history.find(point => point.date === '2026-10-21').total, 250);
    assert.equal(data.archived.length, 1);
    assert.throws(() => store.updateBalance(row.id, { amount: '1', date: '2026-10-23' }), /архив/);
  } finally { store.db.close(); }
});
