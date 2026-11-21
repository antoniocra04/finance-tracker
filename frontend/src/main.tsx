import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, useLocation } from 'react-router';
import { AppHeader, Button, buttonClass, Icon, PageHeading, Shell } from '@home-apps/ui';
import { AccountList, Journal } from './Accounts';
import { Capital, CurrencyCharts, CurrencyOverview } from './Charts';
import { AccountDialog, Auth, Settings } from './Forms';
import { Glyph } from './Glyph';
import { ApiError, api, currencyNames, dateLabel, downloadExport, errorMessage, money, signed, staleRates } from './model';
import type { Currency, Dashboard, DialogState, Session } from './model';
import './style.css';

const navigation = [['/', 'Обзор'], ['/accounts', 'Счета'], ['/history', 'История'], ['/analytics', 'Аналитика']] as const;
const historyLinks: Record<string,string> = { '#overview': '/', '#accounts': '/accounts', '#history': '/history', '#analytics': '/analytics', '#settings': '/settings' };
const legacyPath = historyLinks[location.hash];
if (location.pathname === '/' && legacyPath) history.replaceState(null, '', legacyPath);

function Warning({ data, refresh, busy }: { data: Dashboard; refresh: () => void; busy: boolean }) {
  const stale = staleRates(data.rates);
  if (!data.missing.length && !data.rateError && !stale) return null;
  const message = data.missing.length ? `Итог неполный: нет курса для ${data.missing.join(', ')}.`
    : data.rateError || 'Курсы старше 48 часов. Используем сохранённые значения.';
  return <div className="notice" role="status">
    <p>{message}{data.rates && ` Последний курс: ${dateLabel(data.rates.date, true)}.`}</p>
    <Button kind="quiet" onClick={refresh} disabled={busy}>{busy ? 'Проверяем…' : 'Обновить'}</Button>
  </div>;
}

function App() {
  const { pathname } = useLocation();
  const pageTitle = navigation.find(([url]) => url === pathname)?.[1] ?? 'Настройки';
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('svod-hidden') === 'true');
  const [modal, setModal] = useState<DialogState | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [initialError, setInitialError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const loadVersion = useRef(0);
  const loggedIn = data !== null;

  const endSession = useCallback(() => {
    loadVersion.current++;
    setSession({ initialized: true, authenticated: false });
    setData(null);
    setModal(null);
  }, []);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const [dashboard, catalog] = await Promise.all([api<Dashboard>('/data'), api<Currency[]>('/currencies')]);
      if (version === loadVersion.current) {
        setData(dashboard);
        setCurrencies(catalog);
      }
    } catch (error) {
      if (version === loadVersion.current && error instanceof ApiError && error.status === 401) endSession();
      throw error;
    }
  }, [endSession]);

  useEffect(() => {
    async function initialize() {
      const state = await api<Session>('/session');
      setSession(state);
      if (state.authenticated) await load();
    }
    void initialize().catch(error => {
      if (!(error instanceof ApiError && error.status === 401)) setInitialError(errorMessage(error));
    });
  }, [load]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (session) document.title = `${data ? pageTitle : session.initialized ? 'Вход' : 'Настройка доступа'} · Свод`;
  }, [data, pageTitle, session]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!loggedIn || modal) return;
    const refreshOpenView = () => {
      if (document.visibilityState === 'visible' && !document.activeElement?.matches('input, select, textarea')) void load().catch(() => {});
    };
    const update = window.setInterval(refreshOpenView, 300000);
    document.addEventListener('visibilitychange', refreshOpenView);
    return () => {
      window.clearInterval(update);
      document.removeEventListener('visibilitychange', refreshOpenView);
    };
  }, [load, loggedIn, modal]);

  useEffect(() => {
    const reloadRestoredPage = (event: PageTransitionEvent) => { if (event.persisted) location.reload(); };
    window.addEventListener('pageshow', reloadRestoredPage);
    return () => window.removeEventListener('pageshow', reloadRestoredPage);
  }, []);

  function flash(text: string, error = false) { setMessage({ text, error }); }
  function handleError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) endSession();
    flash(errorMessage(error), true);
  }
  function logout(notice?: string) {
    if (notice) {
      endSession();
      flash(notice);
      return;
    }
    void api('/logout', 'POST', {}).then(endSession).catch(handleError);
  }
  async function save(path: string, method: string, body: object, notice: string) {
    try {
      await api(path, method, body);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) endSession();
      throw error;
    }
    setModal(null);
    await load();
    flash(notice);
  }
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const result = await api<{ error: string | null }>('/rates/refresh', 'POST', {});
      await load();
      flash(result.error || 'Используется последний опубликованный курс.', Boolean(result.error));
    } finally { setRefreshing(false); }
  }
  const download = (format: 'csv' | 'json') => { void downloadExport(format).catch(handleError); };
  const toast = message && <div className={`toast ${message.error ? 'toast-error' : ''}`} role="status">{message.text}</div>;

  if (!data) {
    if (initialError) return <Shell theme="svod" appearance="light"><main className="auth-layout" id="content"><section className="auth-panel">
      <h1>Не удалось открыть Свод</h1><p role="alert">{initialError}</p><a href="/" className={buttonClass('primary')}>Попробовать снова</a>
    </section></main></Shell>;
    if (!session || session.authenticated) return <Shell theme="svod" appearance="light"><main className="auth-layout" id="content"><p role="status">Загрузка…</p></main></Shell>;
    return <><Auth initialized={session.initialized} submit={async values => {
      await api(session.initialized ? '/login' : '/setup', 'POST', values);
      setSession({ initialized: true, authenticated: true });
      try { await load(); } catch (error) { setInitialError(errorMessage(error)); }
    }} />{toast}</>;
  }

  const overview = pathname === '/';
  const analytics = pathname === '/analytics';
  const privacyLabel = hidden ? 'Показать суммы' : 'Скрыть суммы';
  return <Shell theme="svod" appearance="light">
    <AppHeader brand={<Link to="/" aria-label="Свод — обзор"><Icon name="wallet" />Свод</Link>}
      navigation={navigation.map(([url, label]) => <NavLink key={url} to={url} end>{label}</NavLink>)}
      actions={<>
        <Button kind="quiet" className="icon-button privacy" aria-label={privacyLabel} title={privacyLabel} aria-pressed={hidden}
          onClick={() => { sessionStorage.setItem('svod-hidden', String(!hidden)); setHidden(!hidden); }}><Glyph name={hidden ? 'eyeOff' : 'eye'} /></Button>
        <Button kind="primary" onClick={() => setModal({ kind: 'add' })} aria-label="Добавить счёт"><Icon name="plus" />Счёт</Button>
      </>} />
    <main id="content" tabIndex={-1} className="ui-container ui-main">
      {!overview && <PageHeading>{pathname === '/history' ? 'История остатков' : pageTitle}</PageHeading>}
      {(overview || analytics || pathname === '/accounts') && <Warning data={data} busy={refreshing} refresh={() => { void refresh().catch(handleError); }} />}
      {(overview || analytics) && <div className="finance-report"><Capital data={data} hidden={hidden} /><CurrencyOverview data={data} hidden={hidden} /></div>}
      {overview && <AccountList key="overview" data={data} hidden={hidden} preview open={setModal} />}
      {pathname === '/accounts' && <AccountList key="accounts" data={data} hidden={hidden} preview={false} open={setModal} />}
      {pathname === '/history' && <Journal data={data} hidden={hidden} open={setModal} download={() => download('csv')} />}
      {analytics && <>
        <section className="analytics-detail"><div className="section-head"><h2>Изменение капитала</h2><span className="ui-muted">{data.history[0] && `с ${dateLabel(data.history[0].date, true)}`}</span></div>
          <p>Общее изменение <strong className="ui-number">{signed(data.change.total, data.base, hidden)}</strong></p>
          <ul>{data.currencies.map(row => <li key={row.currency}><strong>{row.currency}</strong><span>{currencyNames.of(row.currency)}</span><strong className="ui-number">{money(row.amount, row.currency, hidden)}</strong><span className="ui-number">{money(row.value, data.base, hidden)}</span></li>)}</ul>
        </section>
        <CurrencyCharts data={data} hidden={hidden} />
      </>}
      {pathname === '/settings' && <Settings data={data} currencies={currencies} refresh={refresh} save={save} download={download} logout={logout} />}
      {!overview && pathname !== '/settings' && <footer className="utility-footer"><Link className="svod-link" to="/settings"><Glyph name="settings" />Настройки</Link></footer>}
    </main>
    {modal && <AccountDialog key={modal.kind} state={modal} data={data} currencies={currencies} hidden={hidden} archive={setModal}
      close={() => setModal(null)} save={save} />}
    {toast}
  </Shell>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
