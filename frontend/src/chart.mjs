const dayMs = 86400000;
const isoDay = timestamp => new Date(timestamp).toISOString().slice(0, 10);

export function periodRange(days, end) {
  return { start: isoDay(Date.parse(end) - days * dayMs), end };
}

export function dateAxis({ start, end }, width, ticks = 3) {
  const first = Date.parse(start);
  const last = Date.parse(end);
  const duration = Math.max(dayMs, last - first);
  const x = date => (Date.parse(date) - first) / duration * width;
  const dates = [...new Set(Array.from({ length: ticks }, (_, index) => isoDay(first + (last - first) * index / (ticks - 1))))];
  return { x, labels: dates.map(date => ({ date, x: x(date) })) };
}

export function nearestPoint(points, x, tolerance = 0) {
  if (!points.length || !Number.isFinite(x) || x < points[0].x - tolerance || x > points.at(-1).x + tolerance) return -1;
  const next = points.findIndex(point => point.x >= x);
  if (next < 0) return points.length - 1;
  return next > 0 && x - points[next - 1].x <= points[next].x - x ? next - 1 : next;
}
