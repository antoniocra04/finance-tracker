export const currencyCodes = new Set(Intl.supportedValuesOf('currency'));
for (const code of ['USD', 'RUB', 'KZT']) currencyCodes.add(code);

export function precision(currency) {
  if (!currencyCodes.has(currency)) throw new Error('Выберите валюту из списка');
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}

export function toMinor(value, currency) {
  const digits = precision(currency);
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Введите положительную сумму или 0');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > digits) throw new Error(`Для ${currency} допустимо знаков после запятой: ${digits}`);
  const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(amount) || amount > 1e14) throw new Error('Сумма слишком велика');
  return amount;
}

export function fromMinor(amount, currency) {
  return amount / 10 ** precision(currency);
}

export function convert(amount, source, target, rates) {
  if (source === target || amount === 0) return amount;
  if (!(rates[source] > 0) || !(rates[target] > 0)) return null;
  return amount / rates[source] * rates[target];
}

export function validDate(value) {
  const today = new Date().toISOString().slice(0, 10);
  const date = value ?? today;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2000-01-01' || date > today || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Укажите корректную дату от 2000 года до сегодня');
  return date;
}

export function textField(value, label, max = 80, required = false) {
  if (value != null && typeof value !== 'string') throw new Error(`Проверьте поле «${label}»`);
  const result = (value ?? '').trim();
  if ((required && !result) || result.length > max) throw new Error(`Поле «${label}»: ${required ? 'от 1 до' : 'до'} ${max} символов`);
  return result;
}
