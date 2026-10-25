import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { currencyCodes, toMinor, fromMinor, convert, validDate, textField } from './money.mjs';

export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, institution TEXT NOT NULL, currency TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT);
      CREATE TABLE IF NOT EXISTS balances (id INTEGER PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, amount INTEGER NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS balance_dates ON balances(account_id,date,id);
      CREATE TABLE IF NOT EXISTS rates (date TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    `);
    this.db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').run('base', 'RUB');
    for (const row of this.db.prepare('SELECT DISTINCT currency FROM accounts').all()) currencyCodes.add(row.currency);
    for (const code of Object.keys(this.latestRates()?.rates ?? {})) currencyCodes.add(code);
  }

  getSetting(key) { return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value; }
  setSetting(key, value) { this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, String(value)); }

  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  createAccount(input) {
    const account = {
      id: randomUUID(), name: textField(input.name, 'Название', 80, true),
      institution: textField(input.institution, 'Банк', 80), currency: input.currency,
      type: input.type ?? 'checking'
    };
    if (!currencyCodes.has(account.currency)) throw new Error('Выберите валюту из списка');
    if (!['checking', 'savings', 'cash', 'investment', 'other'].includes(account.type)) throw new Error('Неизвестный тип счёта');
    return this.transaction(() => {
      this.db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,NULL)').run(account.id, account.name, account.institution, account.currency, account.type);
      this.recordBalance(account.id, input);
      return account;
    });
  }

  recordBalance(id, input) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id);
    if (!account || account.archived_at) throw new Error('Счёт не найден или в архиве');
    const date = validDate(input.date);
    const amount = toMinor(input.amount, account.currency);
    const note = textField(input.note, 'Заметка', 500);
    this.db.prepare('INSERT INTO balances(account_id,date,amount,note,created_at) VALUES (?,?,?,?,?)').run(id, date, amount, note, new Date().toISOString());
  }

  updateBalance(id, input) {
    const row = this.db.prepare('SELECT balances.*, accounts.currency, accounts.archived_at FROM balances JOIN accounts ON accounts.id=balances.account_id WHERE balances.id=?').get(id);
    if (!row) throw new Error('Запись не найдена');
    const date = validDate(input.date);
    const amount = toMinor(input.amount, row.currency);
    const note = textField(input.note, 'Заметка', 500);
    if (row.archived_at && date > row.archived_at) throw new Error('Дата записи не может быть позже даты архивации счёта');
    this.db.prepare('UPDATE balances SET amount=?, date=?, note=? WHERE id=?').run(amount, date, note, id);
  }

  deleteBalance(id) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT account_id FROM balances WHERE id=?').get(id);
      if (!row) throw new Error('Запись не найдена');
      const count = this.db.prepare('SELECT COUNT(*) AS count FROM balances WHERE account_id=?').get(row.account_id).count;
      if (count === 1) throw new Error('Единственную запись счёта нельзя удалить. Её можно отредактировать.');
      this.db.prepare('DELETE FROM balances WHERE id=?').run(id);
    });
  }

  updateAccount(id, input) {
    const name = textField(input.name, 'Название', 80, true);
    const institution = textField(input.institution, 'Банк', 80);
    if (!this.db.prepare('UPDATE accounts SET name=?, institution=? WHERE id=? AND archived_at IS NULL').run(name, institution, id).changes) throw new Error('Счёт не найден');
  }

  archiveAccount(id, date = new Date().toISOString().slice(0, 10)) {
    validDate(date);
    if (!this.db.prepare('UPDATE accounts SET archived_at=? WHERE id=? AND archived_at IS NULL').run(date, id).changes) throw new Error('Счёт не найден');
  }

  saveRates(payload) {
    if (!payload || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || !payload.rates || payload.rates.USD !== 1 || Object.keys(payload.rates).length < 3) throw new Error('Некорректные курсы провайдера');
    if (Object.entries(payload.rates).some(([code, value]) => !/^[A-Z]{3}$/.test(code) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) throw new Error('Некорректные курсы провайдера');
    validDate(payload.date);
    for (const code of Object.keys(payload.rates)) currencyCodes.add(code);
    this.db.prepare('INSERT OR REPLACE INTO rates VALUES (?,?)').run(payload.date, JSON.stringify(payload));
  }

  latestRates() {
    const row = this.db.prepare('SELECT payload FROM rates ORDER BY date DESC LIMIT 1').get();
    return row ? JSON.parse(row.payload) : null;
  }

  export() {
    return {
      version: 1, exportedAt: new Date().toISOString(), base: this.getSetting('base'),
      accounts: this.db.prepare('SELECT * FROM accounts').all(),
      balances: this.db.prepare('SELECT * FROM balances ORDER BY date,id').all(),
      rates: this.db.prepare('SELECT payload FROM rates ORDER BY date').all().map(row => JSON.parse(row.payload))
    };
  }

  dashboard(base = this.getSetting('base'), today = new Date().toISOString().slice(0, 10)) {
    if (!currencyCodes.has(base)) throw new Error('Неизвестная валюта');
    const all = this.export();
    for (const snapshot of all.rates) for (const code of Object.keys(snapshot.rates)) currencyCodes.add(code);
    const at = (date) => {
      const snapshot = all.rates.findLast(row => row.date <= date);
      const fx = snapshot?.rates ?? {};
      const accounts = all.accounts.filter(account => !account.archived_at || account.archived_at > date).flatMap(account => {
        const balance = all.balances.findLast(row => row.account_id === account.id && row.date <= date);
        if (!balance) return [];
        const amount = fromMinor(balance.amount, account.currency);
        return [{ ...account, amount, date: balance.date, value: convert(amount, account.currency, base, fx) }];
      });
      const missing = [...new Set(accounts.filter(account => account.value === null).map(account => account.currency))];
      return { accounts, missing, total: missing.length ? null : accounts.reduce((sum, account) => sum + account.value, 0), fx };
    };
    const current = at(today);
    const floor = new Date(`${today}T00:00:00Z`);
    floor.setUTCDate(floor.getUTCDate() - 365);
    const start = all.balances[0]?.date > floor.toISOString().slice(0, 10) ? all.balances[0].date : floor.toISOString().slice(0, 10);
    const history = [];
    if (all.balances.length) {
      for (const day = new Date(`${start}T00:00:00Z`); day.toISOString().slice(0, 10) <= today; day.setUTCDate(day.getUTCDate() + 1)) {
        const date = day.toISOString().slice(0, 10);
        const point = at(date);
        history.push({ date, total: point.total });
      }
    }
    const initial = history.length ? at(history[0].date) : current;
    const endAtInitialRates = current.accounts.map(account => convert(account.amount, account.currency, base, initial.fx));
    const complete = initial.total !== null && current.total !== null && endAtInitialRates.every(value => value !== null);
    const constant = endAtInitialRates.reduce((sum, value) => sum + (value ?? 0), 0);
    const change = complete ? { total: current.total - initial.total, balance: constant - initial.total, fx: current.total - constant } : { total: null, balance: null, fx: null };
    const currencies = [...new Set(current.accounts.map(account => account.currency))].map(currency => {
      const accounts = current.accounts.filter(account => account.currency === currency);
      const amount = accounts.reduce((sum, account) => sum + account.amount, 0);
      const value = accounts.some(account => account.value === null) ? null : accounts.reduce((sum, account) => sum + account.value, 0);
      const initialValue = convert(amount, currency, base, initial.fx);
      return { currency, amount, value, rate: convert(1, currency, base, current.fx), initialRate: convert(1, currency, base, initial.fx), fx: value !== null && initialValue !== null ? value - initialValue : null };
    }).sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
    const quoteDates = history.length ? [start, ...all.rates.filter(row => row.date > start && row.date <= today).map(row => row.date)] : [];
    const fxHistory = currencies.filter(row => row.currency !== base).map(({ currency }) => ({
      currency, points: quoteDates.map(date => {
        const snapshot = all.rates.findLast(row => row.date <= date);
        return { date, rate: convert(1, currency, base, snapshot?.rates ?? {}), rateDate: snapshot?.date ?? null };
      })
    }));
    return {
      base, total: current.total, missing: current.missing, accounts: current.accounts, currencies, history, change, fxHistory,
      rates: this.latestRates(), rateError: this.getSetting('rateError') ?? null,
      journal: [...all.balances].reverse().map(balance => {
        const account = all.accounts.find(row => row.id === balance.account_id);
        return { ...balance, amount: fromMinor(balance.amount, account.currency), name: account.name, currency: account.currency, archived: Boolean(account.archived_at) };
      }),
      archived: all.accounts.filter(account => account.archived_at)
    };
  }
}
