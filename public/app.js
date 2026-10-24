const root = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const paths = {
  overview: '<rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />',
  accounts: '<path d="M3 11h3.75a2 2 0 0 1 1.6.8l.45.6a4 4 0 0 0 6.4 0l.45-.6a2 2 0 0 1 1.6-.8H21" /><path d="M3 7h18" /><rect x="3" y="3" width="18" height="18" rx="2" />',
  analytics: '<path d="M5 21v-6" /><path d="M12 21V9" /><path d="M19 21V3" />',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />',
  settings: '<path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" /><path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" />',
  plus: '<path d="M5 12h14" /><path d="M12 5v14" />',
  arrow: '<path d="M7 7h10v10" /><path d="M7 17 17 7" />',
  arrowDown: '<path d="m7 7 10 10" /><path d="M17 7v10H7" />',
  chevron: '<path d="m6 9 6 6 6-6" />',
  chevronRight: '<path d="m9 18 6-6-6-6" />',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />',
  eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" />',
  logout: '<path d="m16 17 5-5-5-5" /><path d="M21 12H9" /><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />',
  download: '<path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" />',
  close: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />',
  search: '<path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" />',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />',
  info: '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />'
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] ?? paths.wallet}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (date, year = false) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
const fullDate = date => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
const currencyNames = new Intl.DisplayNames('ru', { type: 'currency' });
const typeNames = { checking: 'Текущий счёт', savings: 'Накопления', cash: 'Наличные', investment: 'Инвестиции', other: 'Другой счёт' };
const symbols = { RUB: '₽', USD: '$', KZT: '₸', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥' };
const plural = (count, forms) => forms[count % 100 >= 11 && count % 100 <= 14 ? 2 : count % 10 === 1 ? 0 : count % 10 >= 2 && count % 10 <= 4 ? 1 : 2];
const state = { data: null, currencies: [], page: location.hash.slice(1) || 'overview', hidden: sessionStorage.getItem('svod-hidden') === 'true', period: 90, search: '', sort: 'value' };
const navItems = [['overview', 'Обзор'], ['accounts', 'Счета'], ['analytics', 'Аналитика'], ['history', 'История'], ['settings', 'Настройки']];

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/login' && state.data) { state.data = null; renderAuth(true); }
    throw new Error(data.error || 'Не удалось выполнить запрос');
  }
  return data;
}

function money(amount, currency = state.data?.base ?? 'RUB', compact = false) {
  if (state.hidden) return '••••••';
  if (amount === null || amount === undefined) return '—';
  const digits = new Intl.NumberFormat('ru', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return new Intl.NumberFormat('ru', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: compact ? 0 : digits, ...(compact && Math.abs(amount) >= 1e7 ? { notation: 'compact' } : {}) }).format(amount);
}

function signed(amount) {
  return amount === null ? 'Недостаточно данных' : `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${money(Math.abs(amount))}`;
}

function toast(message, error = false) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.className = error ? 'visible error-toast' : 'visible';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.className = ''; }, 4500);
}

function currencyOptions(selected) {
  const codes = [...new Set(['RUB', 'USD', 'KZT', ...state.currencies.map(item => item.code)])];
  return codes.map(code => `<option value="${code}" ${code === selected ? 'selected' : ''}>${code} · ${escape(currencyNames.of(code))}</option>`).join('');
}

function empty(title, text, action = true) {
  return `<div class="empty-state"><span class="empty-icon">${icon('wallet')}</span><h2>${title}</h2><p>${text}</p>${action ? `<button class="button primary" data-action="add">${icon('plus')}Добавить счёт</button>` : ''}</div>`;
}

function renderAuth(initialized) {
  clearTimeout(toast.timer);
  document.querySelector('#toast').textContent = '';
  document.querySelector('#toast').className = '';
  document.title = `${initialized ? 'Вход' : 'Настройка доступа'} · Свод`;
  root.innerHTML = `<main class="auth-layout">
    <section class="auth-panel" aria-labelledby="auth-title">
      <a href="/" class="brand" aria-label="Свод"><img src="/icon.svg" alt="" width="36" height="36">свод</a>
      <form id="auth-form" class="auth-form" data-initialized="${initialized}">
        <h1 id="auth-title">${initialized ? 'Вход' : 'Настройка доступа'}</h1>
        ${initialized ? '' : '<p class="auth-description">Задайте пароль для входа.</p>'}
        ${!initialized ? `<label>Код установки<input name="token" required autocomplete="off" spellcheck="false" autocapitalize="none" aria-describedby="setup-code-help" placeholder="Из журнала запуска сервера" autofocus><small id="setup-code-help">Код показан при запуске сервера. Он нужен один раз.</small></label>` : ''}
        <label>Пароль<input name="password" type="password" minlength="${initialized ? 1 : 12}" maxlength="256" required autocomplete="${initialized ? 'current-password' : 'new-password'}" ${initialized ? 'autofocus' : 'aria-describedby="password-help"'}>${!initialized ? '<small id="password-help">Не меньше 12 символов.</small>' : ''}</label>
        ${!initialized ? '<label>Повторите пароль<input name="confirm" type="password" minlength="12" maxlength="256" required autocomplete="new-password"></label>' : ''}
        <p class="form-error" role="alert"></p>
        <button type="submit" class="button primary wide">${initialized ? 'Войти' : 'Сохранить пароль'}</button>
      </form>
    </section>
  </main>`;
}

async function load() {
  const [data, currencies] = await Promise.all([api('/data'), api('/currencies')]);
  state.data = data; state.currencies = currencies;
  render();
}

function rateStatus(placement = 'header') {
  const { rates, rateError } = state.data;
  const stale = !rates || Date.now() - Date.parse(rates.updatedAt ?? rates.date) > 48 * 3600000;
  return `<details class="rate-details ${placement}"><summary class="rate-status ${stale || rateError ? 'outdated' : ''}"><span class="status-dot"></span><span>${!rates ? 'Нет курсов' : `Курсы на ${dateLabel(rates.date)}`}</span>${icon('chevron')}</summary><div class="rate-source"><p>${rates ? `Дата курса: ${dateLabel(rates.date, true)}` : 'Курсы ещё не загружены.'}</p>${rates && (stale || rateError) ? '<p>Используем последние доступные данные.</p>' : ''}<a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a></div></details>`;
}

function shell(content) {
  return `<aside class="sidebar">
    <a href="#overview" class="brand" aria-label="Свод — обзор"><img src="/icon.svg" alt="" width="33" height="33">свод</a>
    <nav aria-label="Основная навигация">${navItems.map(([id, label]) => `<a href="#${id}" class="nav-item ${state.page === id ? 'active' : ''}" aria-label="${label}" ${state.page === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a>`).join('')}</nav>
    <div class="sidebar-bottom"><button class="nav-item" data-action="logout" aria-label="Выйти">${icon('logout')}<span>Выйти</span></button></div>
  </aside><div class="app-main">
    <header class="topbar"><div class="topbar-actions">${rateStatus()}<button class="icon-button" data-action="privacy" aria-label="${state.hidden ? 'Показать' : 'Скрыть'} суммы" aria-pressed="${state.hidden}" title="${state.hidden ? 'Показать' : 'Скрыть'} суммы">${icon(state.hidden ? 'eyeOff' : 'eye')}</button></div></header>
    <main id="main-content" class="content">${content}</main>
  </div>`;
}

function heading(title, subtitle = '', action = true) {
  return `<div class="page-heading"><div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action ? `<button class="button primary" data-action="add" aria-label="Добавить счёт">${icon('plus')}Добавить счёт</button>` : ''}</div>`;
}

function warning() {
  const data = state.data;
  const stale = data.rates && Date.now() - Date.parse(data.rates.updatedAt ?? data.rates.date) > 48 * 3600000;
  if (!data.missing.length && !data.rateError && !stale) return '';
  return `<div class="notice" role="status">${icon('info')}<div>${data.missing.length ? `Итог неполный: нет курса для ${data.missing.join(', ')}. Исходные суммы сохранены.` : data.rateError || 'Курсы старше 48 часов. Используем последние сохранённые значения.'} ${data.rates ? `Последний курс: ${dateLabel(data.rates.date, true)}.` : ''}</div><button class="text-button" data-action="refresh">Обновить</button></div>`;
}

function capitalSummary() {
  const data = state.data;
  const start = data.history[0]?.date;
  return `<section class="capital-summary" aria-label="Общий капитал"><div class="total-block"><div class="total-label">Общий капитал <button class="currency-switch" data-action="base" title="Сменить основную валюту">${data.base}${icon('chevron')}</button></div><div class="total-value">${money(data.total)}</div><div class="total-change ${data.change.total < 0 ? 'negative' : ''}">${data.change.total !== null ? `${icon(data.change.total < 0 ? 'arrowDown' : 'arrow')}<strong>${signed(data.change.total)}</strong><span>${start ? `с ${dateLabel(start)}` : 'за время наблюдений'}</span>` : '<span>История появится по мере наблюдений</span>'}</div></div><div class="summary-facts"><div><span>Счета</span><strong>${data.accounts.length}</strong></div><div><span>Валюты</span><strong>${data.currencies.length}<small>${data.currencies.map(row => row.currency).join(' / ') || 'пока нет'}</small></strong></div></div></section>`;
}

function chart() {
  const data = state.data;
  const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - state.period);
  const history = data.history.filter(point => point.date >= cutoff.toISOString().slice(0, 10));
  const valid = history.filter(point => point.total !== null);
  const toolbar = `<div class="section-heading"><div><h2>Динамика капитала</h2></div><div class="segmented" aria-label="Период графика">${[[30, '1М'], [90, '3М'], [180, '6М'], [365, '1Г']].map(([period, label]) => `<button data-action="period" data-period="${period}" aria-pressed="${state.period === period}" class="${state.period === period ? 'selected' : ''}">${label}</button>`).join('')}</div></div>`;
  if (state.hidden) return `<section class="chart-section">${toolbar}<div class="chart-empty">${icon('eye')}Суммы скрыты</div></section>`;
  if (valid.length < 2) return `<section class="chart-section">${toolbar}<div class="chart-empty">${icon('analytics')}<strong>${valid.length ? 'Первая точка уже есть' : 'Здесь будет ваша история'}</strong><p>${valid.length ? 'Завтра появится следующая: курсы обновляются автоматически.' : 'Добавьте счёт. График начнётся с первого доступного остатка и курса.'}</p>${valid.length ? `<span class="first-point">${money(valid[0].total)} · ${dateLabel(valid[0].date)}</span>` : ''}</div></section>`;
  const width = window.innerWidth <= 580 ? 400 : 720, height = 230, left = 0, right = width - 100, top = 25, bottom = 195;
  const values = valid.map(point => point.total);
  let minimum = Math.min(...values), maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.2, maximum * 0.025, 1);
  minimum = Math.max(0, minimum - padding); maximum += padding;
  const position = (point, index) => [left + index / Math.max(history.length - 1, 1) * right, bottom - (point.total - minimum) / (maximum - minimum) * (bottom - top)];
  let line = '', segment = false;
  history.forEach((point, index) => {
    if (point.total === null) { segment = false; return; }
    const [horizontal, vertical] = position(point, index);
    line += `${segment ? 'L' : 'M'}${horizontal.toFixed(2)},${vertical.toFixed(2)} `; segment = true;
  });
  const grids = [0, 1, 2, 3].map(index => {
    const vertical = top + (bottom - top) / 3 * index;
    const value = maximum - (maximum - minimum) / 3 * index;
    return `<line class="chart-grid" x1="0" y1="${vertical}" x2="${right}" y2="${vertical}"/><text class="chart-label" x="${right + 18}" y="${vertical + 4}">${escape(new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 }).format(value))}</text>`;
  }).join('');
  const labels = [...new Set([0, Math.floor((history.length - 1) / 2), history.length - 1])].map(index => `<text class="chart-label" x="${index / (history.length - 1) * right}" y="225" text-anchor="${index === 0 ? 'start' : index === history.length - 1 ? 'end' : 'middle'}">${dateLabel(history[index].date)}</text>`).join('');
  const points = history.map((point, index) => {
    if (point.total === null) return '';
    const [horizontal, vertical] = position(point, index);
    return `<circle class="chart-hover-point" cx="${horizontal}" cy="${vertical}" r="5"><title>${dateLabel(point.date, true)}: ${money(point.total)}</title></circle>`;
  }).join('');
  const lastIndex = history.findLastIndex(point => point.total !== null);
  const [endX, endY] = position(history[lastIndex], lastIndex);
  return `<section class="chart-section">${toolbar}<div class="chart-wrap"><svg class="capital-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Капитал с ${dateLabel(history[0].date)} по ${dateLabel(history.at(-1).date)}: от ${money(valid[0].total)} до ${money(valid.at(-1).total)}">${grids}<path class="chart-line" d="${line}"/><circle class="chart-end" cx="${endX}" cy="${endY}" r="4.5"/>${points}${labels}</svg></div><div class="chart-caption"><span class="legend-dot color-0"></span>Капитал в ${data.base}</div></section>`;
}

function allocation() {
  const data = state.data;
  let offset = 0;
  const segments = data.currencies.map((row, index) => {
    const share = data.total > 0 && row.value !== null ? row.value / data.total * 100 : 0;
    const segment = `<circle class="donut-segment color-stroke-${index % 6}" cx="90" cy="90" r="66" pathLength="100" stroke-dasharray="${share} ${100 - share}" stroke-dashoffset="${-offset}"/>`;
    offset += share; return segment;
  }).join('');
  return `<section class="allocation-section"><div class="section-heading"><h2>Валюты капитала</h2></div><div class="donut-wrap"><svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Распределение капитала по валютам"><circle class="donut-track" cx="90" cy="90" r="66"/>${state.hidden ? '' : segments}</svg><div class="donut-center"><strong>${data.currencies.length}</strong><span>${plural(data.currencies.length, ['валюта', 'валюты', 'валют'])}</span></div></div><div class="allocation-legend">${data.currencies.map((row, index) => `<div><span class="legend-dot color-${index % 6}"></span><strong>${row.currency}</strong><span>${state.hidden ? '•••' : data.total > 0 && row.value !== null ? `${Math.round(row.value / data.total * 100)}%` : '—'}</span><b>${money(row.value, data.base, true)}</b></div>`).join('') || '<p class="subtle">Здесь появится доля каждой валюты.</p>'}</div></section>`;
}

function accountRows(accounts) {
  return accounts.map((account, index) => {
    const age = Math.floor((Date.now() - Date.parse(account.date)) / 86400000);
    return `<div class="account-row"><div class="account-identity"><span class="account-symbol currency-${['RUB', 'USD', 'KZT', 'EUR'].includes(account.currency) ? account.currency : 'other'}">${escape(symbols[account.currency] ?? account.currency.slice(0, 1))}</span><div><strong>${escape(account.name)}</strong><span>${escape(account.institution || typeNames[account.type])}</span></div></div><span class="account-currency">${account.currency}</span><div class="account-amount"><strong>${money(account.amount, account.currency)}</strong>${account.currency !== state.data.base ? `<span>≈ ${money(account.value)}</span>` : ''}</div><div class="account-updated ${age > 30 ? 'old' : ''}"><span>${dateLabel(account.date)}</span><small>${age === 0 ? 'сегодня' : age > 30 ? 'пора проверить' : `${age} дн. назад`}</small></div><div class="row-actions"><button class="button small secondary" data-action="balance" data-id="${account.id}" aria-label="Обновить остаток счёта ${escape(account.name)}">${icon('refresh')}<span>Обновить</span></button><button class="icon-button edit-account" data-action="edit" data-id="${account.id}" aria-label="Настроить счёт ${escape(account.name)}">${icon('edit')}</button></div></div>`;
  }).join('');
}

function accountsSection(preview = false) {
  const data = state.data;
  let accounts = [...data.accounts];
  if (!preview) {
    accounts = accounts.filter(account => `${account.name} ${account.institution} ${account.currency}`.toLowerCase().includes(state.search.toLowerCase()));
    accounts.sort(state.sort === 'name' ? (left, right) => left.name.localeCompare(right.name) : state.sort === 'date' ? (left, right) => left.date.localeCompare(right.date) : (left, right) => (right.value ?? 0) - (left.value ?? 0));
  }
  return `<section class="accounts-section"><div class="section-heading"><h2>${preview ? `Счета <span class="count-badge">${data.accounts.length}</span>` : `${data.accounts.length} ${plural(data.accounts.length, ['счёт', 'счёта', 'счетов'])}`}</h2>${preview ? `<a class="text-link" href="#accounts">Все счета${icon('chevronRight')}</a>` : `<div class="account-tools"><label class="search-field">${icon('search')}<input type="search" id="account-search" placeholder="Найти счёт" aria-label="Поиск счетов" value="${escape(state.search)}"></label><select id="account-sort" aria-label="Сортировка счетов"><option value="value" ${state.sort === 'value' ? 'selected' : ''}>По сумме</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>По названию</option><option value="date" ${state.sort === 'date' ? 'selected' : ''}>Сначала старые</option></select></div>`}</div>${!data.accounts.length ? empty('Нет счетов', 'Добавьте счёт с текущим остатком.') : `<div class="account-table"><div class="account-table-header"><span>Счёт / банк</span><span>Валюта</span><span>Остаток</span><span>Обновлён</span><span></span></div>${accounts.length ? accountRows(preview ? accounts.slice(0, 5) : accounts) : '<p class="no-results">Счетов по этому запросу нет.</p>'}</div>`}</section>`;
}

function changeDetails() {
  const data = state.data;
  return `<section class="change-details"><div class="section-heading"><div><h2>Из чего сложилось изменение</h2><p class="subtle">${data.history.length ? `${dateLabel(data.history[0].date, true)} — ${dateLabel(today(), true)}` : 'За период наблюдений'}</p></div></div><div class="change-grid"><div><span>Изменение остатков</span><strong>${signed(data.change.balance)}</strong><p>Новые суммы на счетах, в курсах начала периода.</p></div><div><span>Влияние курсов</span><strong>${signed(data.change.fx)}</strong><p>Переоценка текущих остатков из-за изменения курсов.</p></div><div><span>Общее изменение</span><strong>${signed(data.change.total)}</strong><p>Изменение стоимости капитала, не инвестиционная доходность.</p></div></div></section>`;
}

function journal() {
  const rows = state.data.journal;
  return `${heading('История остатков', 'Исправления сохраняются отдельными записями.', false)}<div class="history-toolbar"><span class="subtle">${rows.length} ${plural(rows.length, ['запись', 'записи', 'записей'])} · новые сверху</span><button class="button secondary" data-action="csv">${icon('download')}Скачать CSV</button></div>${rows.length ? `<div class="journal-list">${rows.map(row => {
    const corrected = rows.some(other => other.account_id === row.account_id && other.date === row.date && other.id > row.id);
    return `<article class="journal-row ${corrected ? 'superseded' : ''}"><span class="journal-icon">${icon(corrected ? 'edit' : 'refresh')}</span><div><strong>${escape(row.name)}${row.archived ? '<span class="tag">Архив</span>' : ''}</strong>${row.note || corrected ? `<p>${escape(row.note || 'Заменено более поздним обновлением за эту дату')}</p>` : ''}<small>Записано ${dateLabel(row.created_at, true)}</small></div><div class="journal-amount"><strong>${money(row.amount, row.currency)}</strong><span>на ${dateLabel(row.date, true)}</span></div></article>`;
  }).join('')}</div>` : empty('Нет записей', 'Добавьте счёт или обновите остаток.')}`;
}

function settings() {
  const data = state.data;
  return `${heading('Настройки', '', false)}
    <div class="settings-list">
      <section class="settings-section">
        <div><h2>Основная валюта</h2><p>В ней показываем общий капитал и аналитику. Остатки счетов хранятся в исходных валютах.</p></div>
        <form id="base-form"><label>Валюта отчёта<select name="base">${currencyOptions(data.base)}</select></label><p class="form-error" role="alert"></p><button class="button primary">Сохранить</button></form>
      </section>
      <section class="settings-section">
        <div><h2>Курсы валют</h2><p>Обновляются раз в сутки. Если интернет недоступен, используем сохранённый курс с указанием даты.</p></div>
        <div>${rateStatus('settings')}<p class="subtle">${data.rates ? `Следующая публикация провайдера: ${escape(data.rates.nextUpdate ? fullDate(data.rates.nextUpdate) : 'в течение суток')}` : 'Курсы ещё не загружены.'}</p><button class="button secondary" data-action="refresh">${icon('refresh')}Проверить курсы</button></div>
      </section>
      <section class="settings-section">
        <div><h2>Пароль</h2><p>После смены пароля все сессии завершатся. Потребуется войти заново.</p></div>
        <form id="password-form"><label>Текущий пароль<input name="current" type="password" autocomplete="current-password" required></label><label>Новый пароль<input name="password" type="password" minlength="12" maxlength="256" autocomplete="new-password" required placeholder="Не меньше 12 символов"></label><label>Повторите новый пароль<input name="confirm" type="password" minlength="12" maxlength="256" autocomplete="new-password" required></label><p class="form-error" role="alert"></p><button class="button secondary">Изменить пароль</button></form>
      </section>
      <section class="settings-section">
        <div><h2>Ваши данные</h2><p>Скачайте счета и историю в JSON или CSV.</p></div>
        <div class="export-buttons"><button class="button secondary" data-action="export">${icon('download')}Экспорт JSON</button><button class="button secondary" data-action="csv">${icon('download')}История в CSV</button><small>Файлы экспорта не защищены паролем.</small></div>
      </section>
      ${data.archived.length ? `<section class="settings-section"><div><h2>Архив счетов</h2><p>Архивные счета исключены из текущего капитала, но остались в истории и экспорте.</p></div><div class="archived-list">${data.archived.map(account => `<div><strong>${escape(account.name)}</strong><span>${account.currency} · ${dateLabel(account.archived_at, true)}</span></div>`).join('')}</div></section>` : ''}
      <div class="settings-logout"><button class="button secondary" data-action="logout">${icon('logout')}Выйти</button></div>
    </div>`;
}

function render() {
  if (!state.data) return;
  const focused = document.activeElement;
  const focusAction = focused?.dataset?.action;
  const focusId = focused?.id;
  const focusPeriod = focused?.dataset?.period;
  const focusAccount = focused?.dataset?.id;
  if (!navItems.some(([id]) => id === state.page)) state.page = 'overview';
  const data = state.data;
  document.title = `${navItems.find(([id]) => id === state.page)[1]} · Свод`;
  let content = '';
  if (state.page === 'overview') content = `${heading('Обзор капитала', fullDate(new Date().toISOString()))}${warning()}${capitalSummary()}<div class="overview-grid">${chart()}${allocation()}</div>${accountsSection(true)}`;
  if (state.page === 'accounts') content = `${heading('Счета')}${warning()}${accountsSection()}`;
  if (state.page === 'analytics') content = `${heading('Аналитика', '', false)}${warning()}${capitalSummary()}<div class="overview-grid">${chart()}${allocation()}</div>${changeDetails()}<div class="currency-detail-list">${data.currencies.map((row, index) => `<div><span class="currency-code">${row.currency}</span><span>${escape(currencyNames.of(row.currency))}</span><strong>${money(row.amount, row.currency)}</strong><span>≈ ${money(row.value)}</span></div>`).join('')}</div>`;
  if (state.page === 'history') content = journal();
  if (state.page === 'settings') content = settings();
  root.innerHTML = shell(content);
  if (focusAction) {
    const selector = `[data-action="${CSS.escape(focusAction)}"]${focusPeriod ? `[data-period="${CSS.escape(focusPeriod)}"]` : ''}${focusAccount ? `[data-id="${CSS.escape(focusAccount)}"]` : ''}`;
    root.querySelector(selector)?.focus({ preventScroll: true });
  } else if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

function showDialog(title, content) {
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Закрыть">${icon('close')}</button></div><div class="dialog-body">${content}</div>`;
  const footer = dialog.querySelector('.dialog-footer');
  if (footer) {
    const form = footer.closest('form');
    if (form) for (const button of footer.querySelectorAll('button:not([type]), button[type="submit"]')) button.setAttribute('form', form.id);
    dialog.append(footer);
  }
  dialog.showModal();
}

function amountFields(account) {
  const digits = new Intl.NumberFormat('ru', { style: 'currency', currency: account?.currency ?? state.data.base }).resolvedOptions().maximumFractionDigits;
  return `<label><span class="amount-label">Остаток, ${account?.currency ?? state.data.base}</span><input name="amount" inputmode="decimal" type="text" required autocomplete="off" placeholder="0${digits ? `,${'0'.repeat(digits)}` : ''}" value="${account ? account.amount : ''}"></label><label>На дату<input name="date" type="date" min="2000-01-01" max="${today()}" value="${today()}" required></label><label>Заметка <span class="optional">необязательно</span><input name="note" maxlength="500" placeholder="Например, после зарплаты"></label>`;
}

function addDialog() {
  showDialog('Новый счёт', `<form id="account-form"><label>Название счёта<input name="name" required maxlength="80" placeholder="Например, накопления" autofocus></label><label>Банк или организация <span class="optional">необязательно</span><input name="institution" maxlength="80" placeholder="Название банка"></label><div class="form-columns"><label>Валюта<select name="currency">${currencyOptions(state.data.base)}</select></label><label>Тип счёта<select name="type">${Object.entries(typeNames).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div>${amountFields()}<p class="form-error" role="alert"></p><div class="dialog-footer"><button type="button" class="button secondary" data-action="close">Отмена</button><button class="button primary">Добавить счёт</button></div></form>`);
}

function balanceDialog(id) {
  const account = state.data.accounts.find(row => row.id === id);
  if (!account) return;
  showDialog('Обновить остаток', `<p class="dialog-intro">${escape(account.name)} · ${account.currency}</p><form id="balance-form" data-id="${id}">${amountFields(account)}<p class="field-help">Введите полный остаток, не разницу.</p><p class="form-error" role="alert"></p><div class="dialog-footer"><button type="button" class="button secondary" data-action="close">Отмена</button><button class="button primary">Сохранить остаток</button></div></form>`);
  const input = dialog.querySelector('[name="amount"]'); input.focus(); input.select();
}

function editDialog(id) {
  const account = state.data.accounts.find(row => row.id === id);
  showDialog('Настройки счёта', `<form id="edit-form" data-id="${id}"><label>Название<input name="name" value="${escape(account.name)}" required maxlength="80"></label><label>Банк<input name="institution" value="${escape(account.institution)}" maxlength="80"></label><p class="field-help">Валюта счёта: ${account.currency}. Для другой валюты добавьте отдельный счёт.</p><p class="form-error" role="alert"></p><div class="dialog-footer"><button type="button" class="button danger-quiet" data-action="archive-confirm" data-id="${id}">${icon('archive')}В архив</button><button class="button primary">Сохранить</button></div></form>`);
}

function download(data, filename, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('click', async event => {
  document.querySelectorAll('.rate-details[open]').forEach(details => {
    if (!details.contains(event.target)) details.open = false;
  });
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === 'close') { dialog.close(); return; }
    if (action === 'add') { addDialog(); return; }
    if (action === 'balance') { balanceDialog(button.dataset.id); return; }
    if (action === 'edit') { editDialog(button.dataset.id); return; }
    if (action === 'privacy') { state.hidden = !state.hidden; sessionStorage.setItem('svod-hidden', state.hidden); render(); return; }
    if (action === 'period') { state.period = Number(button.dataset.period); render(); return; }
    if (action === 'base') { state.page = 'settings'; location.hash = 'settings'; return; }
    if (action === 'archive-confirm') {
      const account = state.data.accounts.find(row => row.id === button.dataset.id);
      dialog.close();
      showDialog('Переместить в архив?', `<p class="dialog-intro">Счёт «${escape(account.name)}» исключим из общего капитала с сегодняшнего дня. История останется.</p><div class="dialog-footer"><button class="button secondary" data-action="close">Отмена</button><button class="button danger" data-action="archive" data-id="${account.id}">В архив</button></div>`); return;
    }
    button.disabled = true;
    if (action === 'logout') { await api('/logout', { method: 'POST', body: {} }); state.data = null; renderAuth(true); }
    if (action === 'archive') { await api(`/accounts/${button.dataset.id}/archive`, { method: 'POST', body: {} }); dialog.close(); await load(); toast('Счёт перемещён в архив'); }
    if (action === 'refresh') {
      const result = await api('/rates/refresh', { method: 'POST', body: {} }); await load(); toast(result.error || 'Проверено. Используется последний опубликованный курс.', Boolean(result.error));
    }
    if (action === 'export') download(JSON.stringify(await api('/export'), null, 2), `svod-${today()}.json`, 'application/json');
    if (action === 'csv') {
      const data = await api('/export');
      const cell = value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
      const rows = data.balances.map(row => { const account = data.accounts.find(item => item.id === row.account_id); const digits = new Intl.NumberFormat('ru', { style: 'currency', currency: account.currency }).resolvedOptions().maximumFractionDigits; return [row.date, account.name, account.institution, account.currency, row.amount / 10 ** digits, row.note, row.created_at]; });
      download('\uFEFF' + [['Дата остатка', 'Счёт', 'Банк', 'Валюта', 'Сумма', 'Заметка', 'Записано'], ...rows].map(row => row.map(cell).join(';')).join('\r\n'), `svod-history-${today()}.csv`, 'text/csv;charset=utf-8');
    }
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['auth-form', 'account-form', 'balance-form', 'edit-form', 'base-form', 'password-form'].includes(form.id)) return;
  event.preventDefault();
  const body = Object.fromEntries(new FormData(form));
  const errorElement = form.querySelector('.form-error');
  const submit = event.submitter ?? [...form.elements].find(element => element.type === 'submit');
  const submitLabel = submit.innerHTML;
  errorElement.textContent = '';
  if (body.confirm !== undefined && body.confirm !== body.password) { errorElement.textContent = 'Пароли не совпадают'; errorElement.scrollIntoView({ block: 'nearest' }); return; }
  submit.disabled = true; form.setAttribute('aria-busy', 'true');
  submit.setAttribute('aria-busy', 'true');
  submit.innerHTML = `<span class="button-label">${submitLabel}</span><span class="button-pending">${form.id === 'auth-form' ? 'Открываем…' : 'Сохраняем…'}</span>`;
  try {
    if (form.id === 'auth-form') { await api(form.dataset.initialized === 'true' ? '/login' : '/setup', { method: 'POST', body }); await load(); }
    if (form.id === 'account-form') { await api('/accounts', { method: 'POST', body }); dialog.close(); await load(); toast('Счёт добавлен'); }
    if (form.id === 'balance-form') { await api(`/accounts/${form.dataset.id}/balances`, { method: 'POST', body }); dialog.close(); await load(); toast('Новый остаток сохранён'); }
    if (form.id === 'edit-form') { await api(`/accounts/${form.dataset.id}`, { method: 'PATCH', body }); dialog.close(); await load(); toast('Счёт обновлён'); }
    if (form.id === 'base-form') { await api('/settings', { method: 'PUT', body }); await load(); toast('Основная валюта изменена'); }
    if (form.id === 'password-form') { await api('/password', { method: 'PUT', body }); state.data = null; renderAuth(true); toast('Пароль изменён. Войдите снова.'); }
  } catch (error) { errorElement.textContent = error.message; errorElement.scrollIntoView({ block: 'nearest' }); }
  finally { submit.disabled = false; submit.innerHTML = submitLabel; submit.removeAttribute('aria-busy'); form.removeAttribute('aria-busy'); }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || dialog.open) return;
  const details = [...document.querySelectorAll('.rate-details[open]')];
  const focused = details.find(element => element.contains(document.activeElement));
  details.forEach(element => { element.open = false; });
  focused?.querySelector('summary').focus();
});

document.addEventListener('input', event => {
  if (event.target.id !== 'account-search') return;
  const position = event.target.selectionStart;
  state.search = event.target.value; render();
  const input = document.querySelector('#account-search'); input.focus(); input.setSelectionRange(position, position);
});
document.addEventListener('change', event => {
  if (event.target.id === 'account-sort') { state.sort = event.target.value; render(); }
  if (event.target.matches('#account-form [name="currency"]')) {
    const currency = event.target.value;
    const digits = new Intl.NumberFormat('ru', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
    dialog.querySelector('.amount-label').textContent = `Остаток, ${currency}`;
    dialog.querySelector('[name="amount"]').placeholder = `0${digits ? `,${'0'.repeat(digits)}` : ''}`;
  }
});
window.addEventListener('hashchange', () => { state.page = location.hash.slice(1) || 'overview'; state.search = ''; render(); window.scrollTo(0, 0); });
window.matchMedia('(max-width: 580px)').addEventListener('change', () => { render(); });
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

async function boot() {
  try {
    const session = await api('/session');
    if (session.authenticated) await load(); else renderAuth(session.initialized);
  } catch (error) {
    root.innerHTML = `<main class="connection-error"><img src="/icon.svg" alt="" width="45" height="45"><h1>Не удалось открыть Свод</h1><p>${escape(error.message)}</p><a href="/" class="button primary">Попробовать снова</a></main>`;
  }
}
void boot();
async function refreshOpenView() {
  if (!state.data || dialog.open || document.visibilityState !== 'visible' || document.activeElement?.matches('input, select')) return;
  try { await load(); } catch { }
}
setInterval(() => { void refreshOpenView(); }, 300000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refreshOpenView(); });
