const dayMs = 86400000;
const isoDay = timestamp => new Date(timestamp).toISOString().slice(0, 10);

export function periodRange(days, end) {
  return { start: isoDay(Date.parse(end) - days * dayMs), end };
}

export function dateAxis({ start, end }, width) {
  const first = Date.parse(start);
  const last = Date.parse(end);
  const duration = Math.max(dayMs, last - first);
  const x = date => (Date.parse(date) - first) / duration * width;
  const dates = [...new Set([start, isoDay((first + last) / 2), end])];
  return { x, labels: dates.map(date => ({ date, x: x(date) })) };
}

export function nearestPoint(points, x, tolerance = 0) {
  if (!points.length || !Number.isFinite(x) || x < points[0].x - tolerance || x > points.at(-1).x + tolerance) return -1;
  const next = points.findIndex(point => point.x >= x);
  if (next < 0) return points.length - 1;
  return next > 0 && x - points[next - 1].x <= points[next].x - x ? next - 1 : next;
}

export function bindChart(plot, points) {
  const svg = plot.querySelector('svg');
  const area = svg.querySelector('.chart-hit-area');
  const indicator = svg.querySelector('.chart-indicator');
  const guide = indicator.querySelector('line');
  const marker = indicator.querySelector('circle');
  const tooltip = plot.querySelector('.chart-tooltip');
  const date = tooltip.querySelector('span');
  const value = tooltip.querySelector('strong');
  const announcement = plot.querySelector('.chart-announcement');
  let selected = -1;

  function hide() {
    selected = -1;
    tooltip.hidden = true;
    indicator.setAttribute('visibility', 'hidden');
    announcement.textContent = '';
  }

  function show(index, announce = false) {
    if (index < 0) { hide(); return; }
    if (index === selected && !announce) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    selected = index;
    const point = points[index];
    guide.setAttribute('x1', point.x);
    guide.setAttribute('x2', point.x);
    marker.setAttribute('visibility', point.y === null ? 'hidden' : 'visible');
    if (point.y !== null) {
      marker.setAttribute('cx', point.x);
      marker.setAttribute('cy', point.y);
    }
    indicator.setAttribute('visibility', 'visible');
    date.textContent = point.label;
    value.textContent = point.value;
    tooltip.hidden = false;
    const bounds = plot.getBoundingClientRect();
    const anchor = new DOMPoint(point.x, 0).matrixTransform(matrix);
    const width = tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(0, Math.min(bounds.width - width, anchor.x - bounds.left - width / 2))}px`;
    if (announce) announcement.textContent = `${point.label}: ${point.value}`;
  }

  function follow(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const { x } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    show(nearestPoint(points, x, 6 / Math.hypot(matrix.a, matrix.b)));
  }

  area.addEventListener('pointermove', follow);
  area.addEventListener('pointerdown', follow);
  area.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') hide(); });
  area.addEventListener('pointercancel', hide);
  plot.addEventListener('blur', hide);
  plot.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hide(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const last = points.length - 1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' || selected < 0 ? last :
      Math.max(0, Math.min(last, selected + (event.key === 'ArrowRight' ? 1 : -1)));
    show(index, true);
  });
}
