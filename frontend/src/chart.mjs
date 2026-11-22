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

/** @param {{ width: number, height: number } | null} measured */
export function capitalPlotBounds(measured = null, mobile = false) {
  const baseWidth = mobile ? 320 : 680;
  const baseHeight = mobile ? 153 : 213;
  const { width, height } = measured ?? { width: baseWidth, height: baseHeight };
  const x = width / baseWidth;
  const y = height / baseHeight;
  const right = mobile ? 269 : 623;
  return {
    width, height,
    left: (mobile ? 3 : 4) * x,
    right: right * x,
    top: (mobile ? 13 : 16) * y,
    bottom: (mobile ? 128 : 184) * y,
    valueLabelX: (right + 8) * x,
    dateLabelY: (baseHeight - 5) * y,
  };
}

export function nearestPoint(points, x, tolerance = 0) {
  if (!points.length || !Number.isFinite(x) || x < points[0].x - tolerance || x > points.at(-1).x + tolerance) return -1;
  const next = points.findIndex(point => point.x >= x);
  if (next < 0) return points.length - 1;
  return next > 0 && x - points[next - 1].x <= points[next].x - x ? next - 1 : next;
}
