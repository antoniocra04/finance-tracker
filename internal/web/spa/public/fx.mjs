import { dateAxis, periodRange } from './chart.mjs';

export function rateWindow(points, days, endDate) {
  const range = periodRange(days, endDate);
  const available = points.filter(point => point.date <= endDate);
  if (!available.length) return { range, points: [], changePercent: null, observations: 0, latestQuote: null };
  const startDate = available[0].date > range.start ? available[0].date : range.start;
  const baseline = available.findLast(point => point.date <= startDate);
  const window = [{ ...baseline, date: startDate }, ...available.filter(point => point.date > startDate)];
  if (window.at(-1).date < endDate) window.push({ ...window.at(-1), date: endDate });
  const observations = new Set(window.filter(point => point.rate > 0).map(point => point.rateDate ?? point.date)).size;
  const first = window[0].rate, last = window.at(-1).rate;
  const changePercent = observations > 1 && first > 0 && last > 0 ? (last - first) / first * 100 : null;
  return { range, points: window, changePercent, observations, latestQuote: available.findLast(point => point.rate > 0) ?? null };
}

export function rateGeometry(points, width = 640, range = { start: points[0]?.date, end: points.at(-1)?.date }) {
  const valid = points.filter(point => point.rate > 0 && Number.isFinite(point.rate));
  if (!valid.length) return null;
  const values = valid.map(point => point.rate);
  const lowest = Math.min(...values), highest = Math.max(...values);
  const padding = Math.max((highest - lowest) * 0.15, highest * 0.005, Number.MIN_VALUE);
  const minimum = Math.max(0, lowest - padding), maximum = highest + padding;
  const axis = dateAxis(range, width - 120);
  const positions = points.map(point => ({
    ...point, x: axis.x(point.date),
    y: point.rate > 0 && Number.isFinite(point.rate) ? 128 - (point.rate - minimum) / (maximum - minimum) * 116 : null
  }));
  let path = '', connected = false;
  for (const point of positions) {
    if (point.y === null) { connected = false; continue; }
    path += `${connected ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)} `;
    connected = true;
  }
  const ticks = [0, 1, 2].map(index => ({ y: 12 + index * 58, value: maximum - (maximum - minimum) * index / 2 }));
  const samples = positions.filter(point => point.y !== null);
  return { path: path.trim(), positions, samples, endpoint: samples.at(-1), ticks, labels: axis.labels };
}
