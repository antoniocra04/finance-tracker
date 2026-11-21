export const accountTypes = {
  checking: 'Текущий счёт', savings: 'Накопления', cash: 'Наличные', investment: 'Инвестиции', other: 'Другой счёт',
};

export interface Account {
  id: string;
  name: string;
  institution: string;
  currency: string;
  type: keyof typeof accountTypes;
  archived_at: string | null;
}
export interface ActiveAccount extends Account { amount: number; value: number | null; date: string }
export interface Balance { date: string; amount: number; note: string; id: number; account_id: string; created_at: string }
export interface JournalEntry extends Balance { name: string; currency: string; archived: boolean }
export interface Rates { date: string; updatedAt?: string; nextUpdate?: string; rates: Record<string, number> }
export interface Allocation { currency: string; amount: number; value: number | null; rate: number | null; initialRate: number | null; fx: number | null }
export interface Quote { date: string; rate: number | null; rateDate: string | null }
export interface QuoteSeries { currency: string; points: Quote[] }
export interface Dashboard {
  base: string;
  total: number | null;
  accounts: ActiveAccount[];
  currencies: Allocation[];
  history: { date: string; total: number | null }[];
  fxHistory: QuoteSeries[];
  change: { total: number | null; balance: number | null; fx: number | null };
  missing: string[];
  rates: Rates | null;
  rateError: string | null;
  journal: JournalEntry[];
  archived: Account[];
}
export interface Session { initialized: boolean; authenticated: boolean }
export type Currency = { code: string; supported: boolean };
export type DialogState =
  | { kind: 'add' }
  | { kind: 'balance' | 'edit' | 'archive'; account: ActiveAccount }
  | { kind: 'correct' | 'delete'; entry: JournalEntry };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const content = await response.json();
  if (!response.ok) throw new ApiError(response.status, content.error || 'Не удалось выполнить запрос');
  return content;
}

export const today = () => new Date().toISOString().slice(0, 10);
const day = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`);
export const dateLabel = (date: string, year = false) => new Intl.DateTimeFormat('ru', {
  day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC',
}).format(day(date));
export const longDate = (date: string) => new Intl.DateTimeFormat('ru', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
}).format(day(date));
export const relativeDate = (date: string) => {
  const age = Math.round((Date.parse(today()) - Date.parse(date)) / 86400000);
  return age === 0 ? 'Сегодня' : age === 1 ? 'Вчера' : dateLabel(date);
};
export const currencyNames = new Intl.DisplayNames('ru', { type: 'currency' });
export const currencyDigits = (currency: string) => new Intl.NumberFormat('ru', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос';
export const money = (amount: number | null, currency: string, hidden = false) => {
  if (hidden) return '••••••';
  if (amount === null) return '—';
  return new Intl.NumberFormat('ru', {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0,
  }).format(amount);
};
export const signed = (amount: number | null, currency: string, hidden = false) => {
  if (hidden) return '••••••';
  return amount === null ? 'Недостаточно данных' : `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${money(Math.abs(amount), currency)}`;
};
export const signClass = (amount: number | null, hidden = false) => hidden ? '' : (amount ?? 0) > 0 ? 'positive' : (amount ?? 0) < 0 ? 'negative' : '';
export const share = (value: number | null, total: number | null) => value !== null && total !== null && total > 0 ? value / total * 100 : null;
export const shareLabel = (value: number | null, total: number | null, hidden: boolean) => {
  if (hidden) return '•••';
  const part = share(value, total);
  return part === null ? '—' : `${Math.round(part)}%`;
};
export const staleRates = (rates: Rates | null) => Boolean(rates && Date.now() - Date.parse(rates.updatedAt ?? rates.date) > 48 * 3600000);

interface Export { accounts: Account[]; balances: Balance[] }

export async function downloadExport(format: 'csv' | 'json') {
  const data = await api<Export>('/export');
  let text = JSON.stringify(data, null, 2);
  if (format === 'csv') {
    const cell = (value: unknown) => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
    const accounts = new Map(data.accounts.map(account => [account.id, account]));
    const rows = data.balances.map(row => {
      const account = accounts.get(row.account_id)!;
      return [row.date, account.name, account.institution, account.currency, row.amount / 10 ** currencyDigits(account.currency), row.note, row.created_at];
    });
    text = '\uFEFF' + [['Дата остатка', 'Счёт', 'Банк', 'Валюта', 'Сумма', 'Заметка', 'Записано'], ...rows]
      .map(row => row.map(cell).join(';')).join('\r\n');
  }
  const type = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
  const href = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `${format === 'csv' ? 'svod-history' : 'svod'}-${today()}.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
