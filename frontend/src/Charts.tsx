import { Link } from 'react-router';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { buttonClass, Icon } from '@home-apps/ui';
import { capitalPlotBounds, dateAxis, nearestPoint, periodRange } from './chart.mjs';
import { rateGeometry, rateWindow } from './fx.mjs';
import { currencyNames, dateLabel, longDate, money, share, shareLabel, signClass, signed, today } from './model';
import type { Allocation, Dashboard, Quote, QuoteSeries } from './model';

const periods = [[30, '1М'], [90, '3М'], [180, '6М'], [365, '1Г']] as const;
const mobileQuery = watchMedia('(max-width: 580px)');
const wideQuery = watchMedia('(min-width: 1100px)');
function watchMedia(query: string) {
  const media = matchMedia(query);
  return {
    subscribe(listener: () => void) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    getSnapshot: () => media.matches,
  };
}

type PlotFrame = { width: number; height: number };

function useWidePlotFrame() {
  const wide = useSyncExternalStore(wideQuery.subscribe, wideQuery.getSnapshot);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<PlotFrame | null>(null);
  useLayoutEffect(() => {
    if (!wide || !element) return;
    function measure({ width, height }: PlotFrame) {
      if (width > 0 && height > 0) {
        setSize(current => current?.width === width && current.height === height ? current : { width, height });
      }
    }
    measure(element.getBoundingClientRect());
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, wide]);
  return { frameRef: setElement, size: wide ? size : null };
}
const compact = new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 2 });

function Period({ label, period, change }: { label: string; period: number; change: (value: number) => void }) {
  return <div className="segmented" role="group" aria-label={label}>
    {periods.map(([days, name]) => <button type="button" key={days} aria-pressed={period === days} onClick={() => change(days)}>{name}</button>)}
  </div>;
}

interface Point { x: number; y: number | null; label: string; value: string }
interface AxisLabel { x: number; date: string }

function AxisLabels({ labels, y, offset = 0 }: { labels: AxisLabel[]; y: number; offset?: number }) {
  const years = labels[0].date.slice(0, 4) !== labels.at(-1)?.date.slice(0, 4);
  return labels.map(({ date, x }, index) => <text className="chart-label" key={date} x={x + offset} y={y} textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}>
    {years ? date.slice(2).split('-').reverse().join('.') : dateLabel(date).replace(/\.$/, '')}
  </text>);
}

function Plot({ points, width, height, left = 0, right, top, bottom, label, children }: {
  points: Point[]; width: number; height: number; left?: number; right: number; top: number; bottom: number; label: string; children: ReactNode;
}) {
  const [index, setIndex] = useState(-1);
  const [announce, setAnnounce] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const selected = points[index];
  function follow(event: PointerEvent<SVGRectElement>) {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const { x } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    setAnnounce(false);
    setIndex(nearestPoint(points, x, 6 / Math.hypot(matrix.a, matrix.b)));
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const last = points.length - 1;
    switch (event.key) {
      case 'Escape': setIndex(-1); return;
      case 'Home': event.preventDefault(); setIndex(0); break;
      case 'End': event.preventDefault(); setIndex(last); break;
      case 'ArrowLeft': case 'ArrowRight':
        event.preventDefault();
        setIndex(index < 0 ? last : Math.max(0, Math.min(last, index + (event.key === 'ArrowLeft' ? -1 : 1))));
        break;
      default: return;
    }
    setAnnounce(true);
  }
  return <div className="interactive-chart" tabIndex={0} role="group" aria-label="Значения графика: используйте стрелки влево и вправо" onBlur={() => setIndex(-1)} onKeyDown={keyboard}>
    {selected && <div className="chart-tooltip" aria-hidden="true"><span>{selected.label}</span><strong>{selected.value}</strong></div>}
    <svg ref={svg} className="plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {children}
      {selected && <g aria-hidden="true" className="chart-indicator"><line x1={selected.x} x2={selected.x} y1={top} y2={bottom} />{selected.y !== null && <circle cx={selected.x} cy={selected.y} r="4" />}</g>}
      <rect className="chart-hit-area" x={left} width={right - left} y={top} height={bottom - top} aria-hidden="true" onPointerMove={follow} onPointerDown={follow}
        onPointerLeave={event => { if (event.pointerType !== 'touch') setIndex(-1); }} onPointerCancel={() => setIndex(-1)} />
    </svg>
    <span className="ui-sr-only" role="status">{announce && selected ? `${selected.label}: ${selected.value}` : ''}</span>
  </div>;
}

function CapitalPlot({ data, period }: { data: Dashboard; period: number }) {
  const mobile = useSyncExternalStore(mobileQuery.subscribe, mobileQuery.getSnapshot);
  const { frameRef, size } = useWidePlotFrame();
  const range = periodRange(period, today());
  const history = data.history.filter(point => point.date >= range.start && point.date <= range.end);
  const amounts = history.flatMap(point => point.total === null ? [] : [point.total]);
  if (!amounts.length) return <p className="chart-empty">Нет данных за выбранный период</p>;

  const { width, height, left, right, top, bottom, valueLabelX, dateLabelY } = capitalPlotBounds(size, mobile);
  const lowest = Math.min(...amounts), highest = Math.max(...amounts);
  const padding = Math.max((highest - lowest) * 0.07, highest * 0.01, 1);
  const minimum = Math.max(0, lowest - padding), maximum = highest + padding;
  const axis = dateAxis(range, right - left, mobile ? 3 : 5);
  const points = history.map(({ date, total }) => ({
    x: axis.x(date) + left,
    y: total === null ? null : bottom - (total - minimum) / (maximum - minimum) * (bottom - top),
    label: dateLabel(date, true), value: total === null ? 'Нет данных' : money(total, data.base),
  }));
  const segments: Point[][] = [];
  let inSegment = false;
  for (const point of points) {
    if (point.y === null) { inSegment = false; continue; }
    if (!inSegment) segments.push([]);
    segments.at(-1)!.push(point);
    inSegment = true;
  }
  const endpoint = segments.at(-1)!.at(-1)!;
  return <div className="capital-plot-frame" ref={frameRef}><Plot key={period} points={points} width={width} height={height} left={left} right={right} top={top} bottom={bottom}
    label={`Капитал с ${dateLabel(range.start, true)} по ${dateLabel(range.end, true)}`}>
    {[0, 0.5, 1].map(fraction => {
      const y = top + (bottom - top) * fraction;
      return <g key={fraction}><line className="chart-grid" x1={left} x2={right} y1={y} y2={y} /><text className="chart-label" x={valueLabelX} y={y + 4}>{compact.format(maximum - (maximum - minimum) * fraction)}</text></g>;
    })}
    {segments.map(segment => {
      const line = 'M' + segment.map(({ x, y }) => `${x},${y}`).join('L');
      return <g key={segment[0].x}><path className="chart-area" d={`${line}L${segment.at(-1)!.x},${bottom}H${segment[0].x}Z`} /><path className="chart-line" d={line} /></g>;
    })}
    {(mobile || points.length === 1) && <circle className="chart-end" cx={endpoint.x} cy={endpoint.y!} r="3.6" />}
    <AxisLabels labels={axis.labels} y={dateLabelY} offset={left} />
  </Plot></div>;
}

export function Capital({ data, hidden }: { data: Dashboard; hidden: boolean }) {
  const [period, setPeriod] = useState(90);
  const baseMoney = !hidden && data.total !== null ? money(data.total, data.base) : '';
  const [amount, symbol] = /^(.+)\s+(\S+)$/.exec(baseMoney)?.slice(1) ?? [baseMoney, ''];
  const start = data.history[0]?.date;
  return <section className="balance-summary" aria-labelledby="capital-title">
    <div className="capital-heading"><h1 id="capital-title">Общий капитал</h1>
      <p className="capital-value ui-number">{baseMoney ? <>{amount}{symbol && <span className="capital-unit"> {symbol}</span>}</> : money(data.total, data.base, hidden)}</p>
      <div className="capital-actions">
        <div className={`capital-change ${signClass(data.change.total, hidden)}`}>
          {start && data.change.total !== null && !hidden && <><Icon name="trend" /><strong>{signed(data.change.total, data.base, hidden)}</strong><span>с {longDate(start)}</span></>}
          {start && data.change.total === null && !hidden && <span>Недостаточно данных</span>}
        </div>
        <Period label="Период графика" period={period} change={setPeriod} />
      </div>
    </div>
    {hidden ? <p className="chart-empty">Суммы скрыты</p> : <CapitalPlot data={data} period={period} />}
    <div className="chart-caption"><i aria-hidden="true" />Капитал в {data.base}</div>
  </section>;
}

const denomination: Record<string,string> = { RUB: 'rub', USD: 'usd', KZT: 'kzt' };
function color(code: string, index: number) { return denomination[code] ?? `other-${index % 4}`; }

export function CurrencyOverview({ data, hidden }: { data: Dashboard; hidden: boolean }) {
  let offset = 0;
  return <section className="currency-overview" aria-labelledby="currency-title">
    <div className="section-head"><h2 id="currency-title">Валютная структура</h2>
      <Link to="/settings" className={`${buttonClass()} base-currency`} aria-label={`Основная валюта: ${data.base}. Настройки`}>{data.base}<Icon name="chevron" /></Link>
    </div>
    <details className="rate-details">
      <summary>{data.rates ? `Курсы за ${longDate(data.rates.date)}` : 'Нет курсов'}</summary>
      <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a>
    </details>
    {!hidden && data.total !== null && data.total > 0 && <svg className="allocation-bar" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true">
      {data.currencies.map((item, index) => {
        const part = share(item.value, data.total) ?? 0;
        const x = offset;
        offset += part;
        return <rect key={item.currency} className={`allocation-color ${color(item.currency, index)}`} height="5" x={x} width={Math.max(0, part - (index < data.currencies.length - 1 ? 0.7 : 0))} />;
      })}
    </svg>}
    {data.currencies.length ? <ul className="allocation-list">
      {data.currencies.map((item, index) => <li key={item.currency}>
        <span className="allocation-key"><i className={`allocation-color ${color(item.currency, index)}`} aria-hidden="true" />{item.currency}</span>
        <span className="allocation-value"><strong className="ui-number">{money(item.value, data.base, hidden)}</strong><span className="ui-muted">{shareLabel(item.value, data.total, hidden)}</span></span>
      </li>)}
    </ul> : <p className="ui-muted currency-empty">Здесь появится доля каждой валюты.</p>}
    <div className="finance-foot">
      <p>Изменение остатков<strong className={`ui-number ${signClass(data.change.balance, hidden)}`}>{signed(data.change.balance, data.base, hidden)}</strong></p>
      <p>Влияние курсов<strong className={`ui-number ${signClass(data.change.fx, hidden)}`}>{signed(data.change.fx, data.base, hidden)}</strong></p>
    </div>
  </section>;
}

const quoteNumber = (value: number | null, digits = 7) => value === null ? 'Нет курса' : new Intl.NumberFormat('ru', { maximumSignificantDigits: digits }).format(value);
const percent = (value: number | null) => value === null ? 'Нет данных для сравнения'
  : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value) > 0 && Math.abs(value) < 0.01 ? '<0,01' : new Intl.NumberFormat('ru', { maximumFractionDigits: 2 }).format(Math.abs(value))}%`;

type ExchangeWindow = { range: { start: string; end: string }; points: Quote[]; changePercent: number | null; observations: number; latestQuote: Quote | null };

function RateChart({ series, row, base, period, hidden }: { series: QuoteSeries; row: Allocation; base: string; period: number; hidden: boolean }) {
  const mobile = useSyncExternalStore(mobileQuery.subscribe, mobileQuery.getSnapshot);
  const { frameRef, size } = useWidePlotFrame();
  const window: ExchangeWindow = rateWindow(series.points, period, today());
  const width = size?.width ?? (mobile ? 360 : 640), right = width - 120;
  const geometry = rateGeometry(window.points, width, window.range);
  const last = window.points.at(-1);
  const pair = `${row.currency} / ${base}`;
  const quotes = window.points.filter((point, index, points) => index === 0 || point.rateDate !== points[index - 1].rateDate || point.rate !== points[index - 1].rate);
  return <article className="fx-row">
    <div className="section-head fx-row-heading"><div><h3>{pair}</h3><p className="ui-muted">{currencyNames.of(row.currency)}</p></div>
      <div className="fx-quote"><strong className="ui-number">{quoteNumber(row.rate)}{row.rate !== null && ` ${base}`}</strong><small>за 1 {row.currency}{row.rate !== null && last?.rateDate && ` · курс от ${dateLabel(last.rateDate)}`}</small></div>
    </div>
    <div className="fx-row-body">
      <div className="fx-plot-frame" ref={frameRef}>{geometry ? <Plot key={period} points={geometry.positions.map((point: {x: number; y: number | null}, index: number) => ({
        x: point.x, y: point.y, label: dateLabel(window.points[index].date, true),
        value: point.y === null ? 'Нет курса' : `${quoteNumber(window.points[index].rate)} ${base}${window.points[index].rateDate && window.points[index].rateDate !== window.points[index].date ? ` · курс от ${dateLabel(window.points[index].rateDate!)}` : ''}`,
      }))} width={width} height={164} right={right} top={12} bottom={128} label={`${pair}: ${dateLabel(window.range.start, true)} — ${dateLabel(window.range.end, true)}`}>
        {geometry.ticks.map(tick => <g key={tick.y}><line className="chart-grid" x1="0" x2={right} y1={tick.y} y2={tick.y} /><text className="chart-label" x={right + 12} y={tick.y + 4}>{quoteNumber(tick.value, 4)}</text></g>)}
        <path className="chart-line" d={geometry.path} /><circle className="chart-end" cx={geometry.endpoint?.x} cy={geometry.endpoint?.y ?? undefined} r="4" />
        <AxisLabels labels={geometry.labels} y={160} />
      </Plot> : <p className="chart-empty">Для этой пары пока нет курсов за выбранный период.</p>}</div>
      <dl className="fx-metrics"><div><dt>Изменение курса</dt><dd className={signClass(window.changePercent)}>{percent(window.changePercent)}</dd>{last && <small>{dateLabel(window.points[0].date)} — {dateLabel(last.date)}</small>}</div>
        <div><dt>Вклад в переоценку</dt><dd className={signClass(row.fx, hidden)}>{signed(row.fx, base, hidden)}</dd></div>
      </dl>
    </div>
    {quotes.length > 0 && <details className="fx-data"><summary>Данные графика</summary>
      <table><thead><tr><th scope="col">Дата курса</th><th scope="col">1 {row.currency}, {base}</th></tr></thead>
        <tbody>{quotes.map(point => <tr key={point.date}><td>{dateLabel(point.rateDate ?? point.date, true)}</td><td>{quoteNumber(point.rate)}</td></tr>)}</tbody>
      </table>
    </details>}
  </article>;
}

export function CurrencyCharts({ data, hidden }: { data: Dashboard; hidden: boolean }) {
  const [period, setPeriod] = useState(90);
  return <section className="fx-section" aria-labelledby="fx-title">
    <div className="section-head"><div><h2 id="fx-title">Курсы валют</h2>
      {data.history.length > 0 && <p className="ui-muted">Вклад в переоценку с {dateLabel(data.history[0].date, true)} по {dateLabel(today(), true)}</p>}</div>
      {data.fxHistory.length > 0 && <Period label="Период графиков курсов" period={period} change={setPeriod} />}
    </div>
    {data.fxHistory.length > 0 ? data.fxHistory.map(series => <RateChart key={series.currency} series={series} row={data.currencies.find(row => row.currency === series.currency)!} base={data.base} period={period} hidden={hidden} />)
      : <p className="chart-empty">{data.accounts.length ? `Все счета в ${data.base}. Валютной переоценки нет.` : 'Добавьте счёт в иностранной валюте, чтобы отслеживать курс.'}</p>}
    {data.fxHistory.length > 0 && data.change.fx === null && <p className="ui-muted">Общее влияние курсов недоступно: не для всех сумм есть курсы на начало или конец периода.</p>}
  </section>;
}
