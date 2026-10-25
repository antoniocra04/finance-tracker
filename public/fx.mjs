export function rateWindow(points, days, endDate) {
  const cutoff = new Date(`${endDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const available = points.filter(point => point.date <= endDate);
  if (!available.length) return { points: [], changePercent: null, observations: 0, latestQuote: null };
  const startDate = available[0].date > cutoff.toISOString().slice(0, 10) ? available[0].date : cutoff.toISOString().slice(0, 10);
  const baseline = available.findLast(point => point.date <= startDate);
  const window = [{ ...baseline, date: startDate }, ...available.filter(point => point.date > startDate)];
  if (window.at(-1).date < endDate) window.push({ ...window.at(-1), date: endDate });
  const observations = new Set(window.filter(point => point.rate > 0).map(point => point.rateDate ?? point.date)).size;
  const first = window[0].rate, last = window.at(-1).rate;
  const changePercent = observations > 1 && first > 0 && last > 0 ? (last - first) / first * 100 : null;
  return { points: window, changePercent, observations, latestQuote: available.findLast(point => point.rate > 0) ?? null };
}

export function rateGeometry(points, width = 640) {
  const valid = points.filter(point => point.rate > 0 && Number.isFinite(point.rate));
  if (!valid.length) return null;
  const values = valid.map(point => point.rate);
  const lowest = Math.min(...values), highest = Math.max(...values);
  const padding = Math.max((highest - lowest) * 0.15, highest * 0.005, Number.MIN_VALUE);
  const minimum = Math.max(0, lowest - padding), maximum = highest + padding;
  const firstDate = Date.parse(points[0].date), duration = Math.max(86400000, Date.parse(points.at(-1).date) - firstDate);
  const samples = [];
  let path = '', connected = false;
  for (const point of points) {
    if (!(point.rate > 0) || !Number.isFinite(point.rate)) { connected = false; continue; }
    const horizontal = (Date.parse(point.date) - firstDate) / duration * (width - 120);
    const vertical = 128 - (point.rate - minimum) / (maximum - minimum) * 116;
    samples.push({ ...point, x: horizontal, y: vertical });
    path += `${connected ? 'L' : 'M'}${horizontal.toFixed(2)},${vertical.toFixed(2)} `;
    connected = true;
  }
  const ticks = [0, 1, 2].map(index => ({ y: 12 + index * 58, value: maximum - (maximum - minimum) * index / 2 }));
  const middleDate = new Date((firstDate + Date.parse(points.at(-1).date)) / 2).toISOString().slice(0, 10);
  const labels = [...new Set([points[0].date, middleDate, points.at(-1).date])].map(date => ({ date, x: (Date.parse(date) - firstDate) / duration * (width - 120) }));
  return { path: path.trim(), samples, endpoint: samples.at(-1), ticks, labels };
}
