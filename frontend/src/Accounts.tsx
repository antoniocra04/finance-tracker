import { Link } from 'react-router';
import { useState } from 'react';
import { Button, Icon } from '@home-apps/ui';
import { Glyph } from './Glyph';
import { accountTypes, dateLabel, money, relativeDate, shareLabel } from './model';
import type { Dashboard, DialogState } from './model';

export type OpenDialog = (value: DialogState) => void;

export function AccountList({ data, hidden, preview, open }: {
  data: Dashboard; hidden: boolean; preview: boolean; open: OpenDialog;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('value');
  const needle = search.trim().toLocaleLowerCase('ru');
  const accounts = preview ? data.accounts.slice(0, 5) : data.accounts.filter(account =>
    `${account.name} ${account.institution} ${account.currency} ${accountTypes[account.type]}`.toLocaleLowerCase('ru').includes(needle)
  ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ru') : sort === 'date'
    ? a.date.localeCompare(b.date) : (b.value ?? 0) - (a.value ?? 0));
  return <section className={preview ? 'account-list preview' : 'account-list'} aria-label="Счета">
    {preview ? <div className="section-head"><h2>Счета</h2><Link className="svod-link" to="/accounts">Все счета <Icon name="next" /></Link></div>
      : <div className="account-tools">
        <label className="search-field"><Glyph name="search" /><input type="search" placeholder="Найти счёт" aria-label="Поиск счетов" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <select aria-label="Сортировка счетов" value={sort} onChange={event => setSort(event.target.value)}>
          <option value="value">По сумме</option><option value="name">По названию</option><option value="date">Сначала старые</option>
        </select>
      </div>}
    {data.accounts.length === 0 ? <Empty title="Нет счетов" text="Добавьте счёт с текущим остатком." open={open} />
      : accounts.length === 0 ? <p className="empty-state">Счетов по этому запросу нет.</p>
      : <table className="accounts-table">
        <colgroup>{['account','type','currency','amount','base','share','date','action'].map(name => <col className={`col-${name}`} key={name} />)}</colgroup>
        <thead><tr>
          <th scope="col" className="cell-account">Счёт / банк</th><th scope="col" className="cell-type">Тип счёта</th>
          <th scope="col" className="cell-currency">Валюта</th><th scope="col" className="cell-amount right">Остаток</th>
          <th scope="col" className="cell-base right">В пересчёте</th><th scope="col" className="cell-share right">Доля капитала</th>
          <th scope="col" className="cell-date">Обновлён</th><th scope="col" className="cell-action" aria-label="Действия" />
        </tr></thead>
        <tbody>{accounts.map(account => {
          const foreign = account.currency !== data.base;
          const converted = money(account.value, data.base, hidden);
          const type = accountTypes[account.type];
          return <tr key={account.id}>
            <th scope="row" className="cell-account">
              {preview ? <strong>{account.name}</strong> : <button className="account-name" type="button" title="Настройки счёта" aria-label={`Настроить счёт «${account.name}»`} onClick={() => open({ kind: 'edit', account })}>{account.name}<Icon name="pencil" /></button>}
              <small>{account.institution}<span className="mobile-type">{account.institution ? ' · ' : ''}{type}</span></small>
            </th>
            <td className="cell-type">{type}</td><td className="cell-currency">{account.currency}</td>
            <td className="cell-amount right ui-number"><strong>{money(account.amount, account.currency, hidden)}</strong>{foreign && <span className="mobile-value">{account.value !== null && !hidden && '≈ '}{converted}</span>}</td>
            <td className="cell-base right ui-number">{foreign && account.value !== null && !hidden && <span className="approx">≈ </span>}{converted}</td>
            <td className="cell-share right ui-number">{shareLabel(account.value, data.total, hidden)}</td>
            <td className="cell-date"><time dateTime={account.date} title={dateLabel(account.date, true)}>{relativeDate(account.date)}</time></td>
            <td className="cell-action right"><Button kind="quiet" className="icon-button" aria-label={`Обновить остаток счёта «${account.name}»`} title="Обновить остаток" onClick={() => open({ kind: 'balance', account })}><Glyph name="refresh" /></Button></td>
          </tr>;
        })}</tbody>
      </table>}
  </section>;
}

export function Empty({ title, text, open }: { title: string; text: string; open: OpenDialog }) {
  return <div className="empty-state"><h2>{title}</h2><p>{text}</p><Button kind="primary" onClick={() => open({ kind: 'add' })}><Icon name="plus" />Добавить счёт</Button></div>;
}

export function Journal({ data, hidden, open, download }: { data: Dashboard; hidden: boolean; open: OpenDialog; download: () => void }) {
  const counts = new Map<string, number>();
  const latest = new Map<string, number>();
  for (const row of data.journal) {
    counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
    const key = `${row.account_id}/${row.date}`;
    if (!latest.has(key)) latest.set(key, row.id);
  }
  return <>
    <div className="section-head history-toolbar"><span className="ui-muted">Записей: {data.journal.length} · новые сверху</span><Button onClick={download}><Glyph name="download" />Скачать CSV</Button></div>
    {data.journal.length ? <ul className="journal-list">{data.journal.map(row => {
      const corrected = latest.get(`${row.account_id}/${row.date}`) !== row.id;
      const sole = counts.get(row.account_id) === 1;
      return <li className="journal-row" key={row.id}>
        <div className="journal-description"><strong>{row.name}</strong>{row.archived && <span className="tag">Архив</span>}{corrected && <span className="tag">Заменено</span>}
          {row.note && <p>{row.note}</p>}<small>Записано {dateLabel(row.created_at, true)}</small>
        </div>
        <div className="journal-amount ui-number"><strong>{money(row.amount, row.currency, hidden)}</strong><small>на {dateLabel(row.date, true)}</small></div>
        <div className="row-actions">
          <Button kind="quiet" className="icon-button" aria-label={`Редактировать запись «${row.name}» от ${dateLabel(row.date, true)}`} onClick={() => open({ kind: 'correct', entry: row })}><Icon name="pencil" /></Button>
          <Button kind="danger" className="icon-button" aria-label={`Удалить запись «${row.name}» от ${dateLabel(row.date, true)}`} title={sole ? 'Единственную запись счёта можно только отредактировать' : 'Удалить запись'} disabled={sole} onClick={() => open({ kind: 'delete', entry: row })}><Icon name="trash" /></Button>
        </div>
      </li>;
    })}</ul> : <Empty title="Нет записей" text="Добавьте счёт или обновите остаток." open={open} />}
  </>;
}
