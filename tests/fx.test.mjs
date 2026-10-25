import test from 'node:test';
import assert from 'node:assert/strict';
import { rateWindow, rateGeometry } from '../public/fx.mjs';

test('quote windows carry past baselines, retain publication dates and never use future quotes', () => {
  const points = [
    { date: '2026-09-01', rate: 100, rateDate: '2026-09-01' },
    { date: '2026-10-20', rate: 90, rateDate: '2026-10-20' },
    { date: '2026-10-26', rate: 200, rateDate: '2026-10-26' }
  ];
  const result = rateWindow(points, 30, '2026-10-25');
  assert.deepEqual(result.points, [
    { date: '2026-09-25', rate: 100, rateDate: '2026-09-01' },
    { date: '2026-10-20', rate: 90, rateDate: '2026-10-20' },
    { date: '2026-10-25', rate: 90, rateDate: '2026-10-20' }
  ]);
  assert.equal(result.changePercent, -10);
  assert.equal(result.observations, 2);
});

test('missing starting quotes and a single publication cannot imply a full-period percentage', () => {
  const missing = rateWindow([
    { date: '2026-10-01', rate: null, rateDate: null },
    { date: '2026-10-22', rate: 90, rateDate: '2026-10-22' },
    { date: '2026-10-24', rate: 95, rateDate: '2026-10-24' }
  ], 30, '2026-10-25');
  assert.equal(missing.changePercent, null);
  assert.equal(missing.points[0].rate, null);
  assert.equal(rateWindow([{ date: '2026-10-22', rate: 90, rateDate: '2026-10-22' }], 30, '2026-10-25').changePercent, null);
  assert.deepEqual(rateWindow([], 30, '2026-10-25').points, []);
});

test('rate geometry uses calendar spacing and breaks the line at missing quotes', () => {
  const geometry = rateGeometry([
    { date: '2026-10-01', rate: 100 },
    { date: '2026-10-02', rate: 110 },
    { date: '2026-10-03', rate: null },
    { date: '2026-10-11', rate: 90 }
  ]);
  assert.equal(geometry.path.match(/M/g).length, 2);
  assert.equal(geometry.samples[1].x, 52);
  assert.equal(geometry.samples[2].x, 520);
  assert.equal(geometry.endpoint.x, 520);
  assert.equal(geometry.samples.length, 3);
});

test('flat, single and tiny quotes have finite chart geometry and missing data stays empty', () => {
  for (const rate of [100, 0.00000000000002]) {
    for (const points of [[{ date: '2026-10-01', rate }], [{ date: '2026-10-01', rate }, { date: '2026-10-25', rate }]]) {
      const geometry = rateGeometry(points);
      assert.equal(/NaN|Infinity/.test(geometry.path), false);
      assert.ok(geometry.samples.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
      assert.ok(geometry.ticks.every(tick => Number.isFinite(tick.value)));
    }
  }
  assert.equal(rateGeometry([{ date: '2026-10-01', rate: null }]), null);
  assert.equal(rateGeometry([]), null);
});

test('sparse quote charts keep calendar date labels separated on mobile', () => {
  const window = rateWindow([
    { date: '2026-09-20', rate: 90, rateDate: '2026-09-20' },
    { date: '2026-10-24', rate: 95, rateDate: '2026-10-24' }
  ], 30, '2026-10-25');
  const geometry = rateGeometry(window.points, 360);
  assert.deepEqual(geometry.labels.map(label => label.date), ['2026-09-25', '2026-10-10', '2026-10-25']);
  assert.ok(geometry.labels.every((label, index, labels) => index === 0 || label.x - labels[index - 1].x >= 100));
});

test('last valid quotation retains its date when a later snapshot omits that currency', () => {
  const window = rateWindow([
    { date: '2026-10-20', rate: 0.6, rateDate: '2026-10-20' },
    { date: '2026-10-22', rate: null, rateDate: '2026-10-22' }
  ], 30, '2026-10-25');
  assert.deepEqual(window.latestQuote, { date: '2026-10-20', rate: 0.6, rateDate: '2026-10-20' });
  assert.equal(window.points.at(-1).rate, null);
  assert.equal(window.changePercent, null);
});
