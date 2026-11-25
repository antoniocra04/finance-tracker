import test from 'node:test';
import assert from 'node:assert/strict';
import { periodRange, dateAxis, nearestPoint } from '../internal/web/spa/public/chart.mjs';

test('selected period defines the axis even when the first record is recent', () => {
  const month = dateAxis(periodRange(30, '2026-11-13'), 300);
  const quarter = dateAxis(periodRange(90, '2026-11-13'), 300);
  assert.equal(month.labels[0].date, '2026-10-14');
  assert.equal(quarter.labels[0].date, '2026-08-15');
  assert.equal(month.x('2026-10-29'), 150);
  assert.equal(quarter.x('2026-10-29'), 250);
  assert.equal(month.x('2026-11-13'), 300);
  assert.equal(quarter.x('2026-11-13'), 300);
});

test('pointer snaps by horizontal distance without extending history into blank dates', () => {
  const points = [{ x: 100, y: 60 }, { x: 150, y: null }, { x: 280, y: 20 }];
  assert.equal(nearestPoint(points, 50), -1);
  assert.equal(nearestPoint(points, 120), 0);
  assert.equal(nearestPoint(points, 155), 1);
  assert.equal(nearestPoint(points, 250), 2);
  assert.equal(nearestPoint(points, 300), -1);
  assert.equal(nearestPoint([], 100), -1);
});

test('a single observation can be selected near its marker', () => {
  const points = [{ x: 300, y: 70 }];
  assert.equal(nearestPoint(points, 296, 6), 0);
  assert.equal(nearestPoint(points, 280, 6), -1);
});
