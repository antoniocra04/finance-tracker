import { useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button, Icon, Shell } from '@home-apps/ui';
import { Glyph } from './Glyph';
import { accountTypes, api, currencyDigits, currencyNames, dateLabel, errorMessage, money, today } from './model';
import type { Currency, Dashboard, DialogState } from './model';

type Fields = Record<string, FormDataEntryValue>;

export function AsyncForm({ submit, children, footer, action, cancel, danger = false, pending = 'Сохраняем…' }: {
  submit: (values: Fields) => Promise<void>; children: ReactNode; footer?: ReactNode; action: string; cancel?: () => void; danger?: boolean; pending?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    if (body.confirm !== undefined && body.confirm !== body.password) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      await submit(body);
    } catch (err) {
      setError(errorMessage(err));
      errorRef.current?.scrollIntoView({ block: 'nearest' });
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={handle} aria-busy={busy}>
    {children}
    {error && <p className="form-error" ref={errorRef} role="alert">{error}</p>}
    <div className="form-actions">
      {footer}
      {cancel && <Button onClick={cancel}>Отмена</Button>}
      <Button kind={danger ? 'danger' : 'primary'} className={danger ? 'danger-confirm' : undefined} type="submit" disabled={busy}>{busy ? pending : action}</Button>
    </div>
  </form>;
}

export function Auth({ initialized, submit }: { initialized: boolean; submit: (data: Fields) => Promise<void> }) {
  const title = initialized ? 'Вход' : 'Настройка доступа';
  return <Shell theme="svod" appearance="light"><main className="auth-layout" id="content">
    <section className="auth-panel" aria-labelledby="auth-title">
      <a href="/" className="auth-brand"><Icon name="wallet" />Свод</a>
      <h1 id="auth-title">{title}</h1>
      <AsyncForm key={String(initialized)} submit={submit} action={initialized ? 'Войти' : 'Сохранить пароль'} pending="Открываем…">
        {!initialized && <label>Код установки
          <input name="token" required autoComplete="off" spellCheck={false} autoCapitalize="none" aria-describedby="setup-help" autoFocus />
          <small id="setup-help">Код показан в журнале запуска сервера. Он нужен один раз.</small>
        </label>}
        <label>Пароль
          <input name="password" type="password" minLength={initialized ? 1 : 12} maxLength={256} required
            autoComplete={initialized ? 'current-password' : 'new-password'} autoFocus={initialized} />
          {!initialized && <small>Не меньше 12 символов.</small>}
        </label>
        {!initialized && <label>Повторите пароль<input name="confirm" type="password" minLength={12} maxLength={256} required autoComplete="new-password" /></label>}
      </AsyncForm>
    </section>
  </main></Shell>;
}

export function CurrencySelect({ currencies, name, label, initial, onChange }: { currencies: Currency[]; name: string; label: string; initial: string; onChange?: (code: string) => void }) {
  const codes = new Set(['RUB', 'USD', 'KZT', ...currencies.map(item => item.code), initial]);
  return <select name={name} aria-label={label} defaultValue={initial} onChange={event => onChange?.(event.target.value)}>
    {[...codes].map(code => <option value={code} key={code}>{code} · {currencyNames.of(code)}</option>)}
  </select>;
}

function AmountFields({ currency, amount, date = today(), note = '', maxDate = today(), focus }: {
  currency: string; amount?: number; date?: string; note?: string; maxDate?: string; focus?: boolean;
}) {
  const digits = currencyDigits(currency);
  return <>
    <label>Остаток, {currency}<input name="amount" inputMode="decimal" required autoComplete="off" placeholder={digits ? `0,${'0'.repeat(digits)}` : '0'}
      defaultValue={amount === undefined ? '' : amount.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: digits })}
      onFocus={focus ? event => event.currentTarget.select() : undefined} data-initial-focus={focus ? true : undefined} /></label>
    <label>На дату<input name="date" type="date" min="2000-01-01" max={maxDate} defaultValue={date} required /></label>
    <label>Заметка<input name="note" maxLength={500} defaultValue={note} /></label>
  </>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className="svod-dialog" aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientY < box.top || event.clientX > box.right || event.clientY > box.bottom) close();
    } }}>
    <div className="section-head"><h2 id="dialog-title">{title}</h2><Button kind="quiet" className="icon-button" aria-label="Закрыть" onClick={close}><Icon name="close" /></Button></div>
    {children}
  </dialog>;
}

interface DialogProps {
  state: DialogState;
  data: Dashboard;
  currencies: Currency[];
  hidden: boolean;
  close: () => void;
  archive: (state: DialogState) => void;
  save: (path: string, method: string, body: object, notice: string) => Promise<void>;
}

function NewAccount({ currencies, base, close, save }: { currencies: Currency[]; base: string } & Pick<DialogProps, 'close' | 'save'>) {
  const [currency, setCurrency] = useState(base);
  return <Modal title="Новый счёт" close={close}>
    <AsyncForm submit={body => save('/accounts', 'POST', body, 'Счёт добавлен')} action="Добавить счёт" cancel={close}>
      <label>Название счёта<input name="name" required maxLength={80} placeholder="Например, накопления" data-initial-focus /></label>
      <label>Банк или организация<input name="institution" maxLength={80} /></label>
      <div className="form-columns">
        <label>Валюта<CurrencySelect currencies={currencies} name="currency" label="Валюта" initial={base} onChange={setCurrency} /></label>
        <label>Тип счёта<select name="type" aria-label="Тип счёта">{Object.entries(accountTypes).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <AmountFields currency={currency} />
    </AsyncForm>
  </Modal>;
}

export function AccountDialog({ state, data, currencies, hidden, close, archive, save }: DialogProps) {
  if (state.kind === 'add') return <NewAccount currencies={currencies} base={data.base} close={close} save={save} />;
  if ('account' in state) {
    const account = state.account;
    const path = `/accounts/${account.id}`;
    switch (state.kind) {
      case 'balance': return <Modal title="Обновить остаток" close={close}>
        <p className="dialog-note">{account.name} · {account.currency}</p>
        <AsyncForm submit={body => save(`${path}/balances`, 'POST', body, 'Новый остаток сохранён')} action="Сохранить остаток" cancel={close}>
          <AmountFields currency={account.currency} amount={account.amount} focus />
          <p className="ui-muted">Введите полный остаток.</p>
        </AsyncForm>
      </Modal>;
      case 'edit': return <Modal title="Настройки счёта" close={close}>
        <AsyncForm submit={body => save(path, 'PATCH', body, 'Счёт обновлён')} action="Сохранить" footer={<Button kind="danger" className="archive-action" onClick={() => archive({ kind: 'archive', account })}><Glyph name="archive" />В архив</Button>}>
          <label>Название<input name="name" defaultValue={account.name} required maxLength={80} data-initial-focus /></label>
          <label>Банк<input name="institution" defaultValue={account.institution} maxLength={80} /></label>
          <p className="ui-muted">Валюта счёта: {account.currency}.</p>
        </AsyncForm>
      </Modal>;
      case 'archive': return <Modal title="Переместить в архив?" close={close}>
        <AsyncForm submit={() => save(`${path}/archive`, 'POST', {}, 'Счёт перемещён в архив')} action="В архив" cancel={close} danger>
          <p>Счёт «{account.name}» исключим из общего капитала с сегодняшнего дня. История сохранится.</p>
        </AsyncForm>
      </Modal>;
    }
  }
  const entry = state.entry;
  const path = `/balances/${entry.id}`;
  const archived = data.archived.find(account => account.id === entry.account_id);
  const corrected = data.journal.some(item => item.account_id === entry.account_id && item.date === entry.date && item.id > entry.id);
  if (state.kind === 'delete') return <Modal title="Удалить запись?" close={close}>
    <p className="dialog-note">{entry.name} · {entry.currency} · {dateLabel(entry.date, true)}</p>
    <AsyncForm submit={() => save(path, 'DELETE', {}, 'Запись удалена. История пересчитана.')} action="Удалить запись" cancel={close} danger pending="Удаляем…">
      <p className="ui-number delete-amount">{money(entry.amount, entry.currency, hidden)}</p>
      <p>Остаток и история капитала пересчитаются по оставшимся записям. Удаление необратимо.</p>
    </AsyncForm>
  </Modal>;
  return <Modal title="Редактировать запись" close={close}>
    <p className="dialog-note">{entry.name} · {entry.currency}</p>
    <AsyncForm submit={body => save(path, 'PATCH', body, 'Запись изменена. История пересчитана.')} action="Сохранить изменения" cancel={close}>
      <AmountFields currency={entry.currency} amount={entry.amount} date={entry.date} note={entry.note} maxDate={archived?.archived_at ?? today()} focus />
      <p className="ui-muted">Для одной даты действует запись, добавленная последней.{corrected && ' Эта запись заменена более поздней.'}</p>
    </AsyncForm>
  </Modal>;
}

export function Settings({ data, currencies, refresh, save, download, logout }: {
  data: Dashboard; currencies: Currency[]; refresh: () => Promise<void>; save: DialogProps['save'];
  download: (format: 'json' | 'csv') => void; logout: (notice?: string) => void;
}) {
  return <div className="settings-list">
    <section className="settings-section">
      <div><h2>Основная валюта</h2><p>В ней показываем общий капитал и аналитику. Остатки хранятся в исходных валютах.</p></div>
      <AsyncForm key={data.base} submit={body => save('/settings', 'PUT', body, 'Основная валюта изменена')} action="Сохранить">
        <label>Валюта отчёта<CurrencySelect currencies={currencies} name="base" label="Валюта отчёта" initial={data.base} /></label>
      </AsyncForm>
    </section>
    <section className="settings-section">
      <div><h2>Курсы валют</h2><p>Сервер проверяет обновления каждый час.</p></div>
      <AsyncForm submit={refresh} action="Проверить курсы" pending="Проверяем…">
        <p>{data.rates ? `Последняя публикация: ${dateLabel(data.rates.date, true)}` : 'Курсы ещё не загружены.'}</p>
        {data.rates?.nextUpdate && <p>Следующая публикация: {dateLabel(data.rates.nextUpdate, true)}</p>}
        <a className="svod-link" href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a>
      </AsyncForm>
    </section>
    <section className="settings-section">
      <div><h2>Пароль</h2><p>После смены пароля все сессии завершатся. Потребуется войти заново.</p></div>
      <AsyncForm submit={async body => { await api('/password', 'PUT', body); logout('Пароль изменён. Войдите снова.'); }} action="Изменить пароль">
        <label>Текущий пароль<input name="current" type="password" autoComplete="current-password" required /></label>
        <label>Новый пароль<input name="password" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /></label>
        <label>Повторите новый пароль<input name="confirm" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /></label>
      </AsyncForm>
    </section>
    <section className="settings-section">
      <div><h2>Ваши данные</h2><p>Скачайте счета и историю.</p></div>
      <div className="export-buttons">
        <Button onClick={() => download('json')}><Glyph name="download" />Экспорт JSON</Button>
        <Button onClick={() => download('csv')}><Glyph name="download" />История в CSV</Button>
      </div>
    </section>
    {data.archived.length > 0 && <section className="settings-section">
      <div><h2>Архив счетов</h2><p>Остатки сохранены в истории и экспорте.</p></div>
      <ul className="archived-list">{data.archived.map(account => <li key={account.id}><strong>{account.name}</strong><span>{account.currency} · {dateLabel(account.archived_at!, true)}</span></li>)}</ul>
    </section>}
    <Button onClick={() => logout()}><Glyph name="logout" />Выйти</Button>
  </div>;
}
