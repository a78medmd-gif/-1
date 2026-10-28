import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, plannedRR, outcome, alerts, DEFAULT_RULES } from '../src/engine/calc.ts';
import type { Trade } from '../src/engine/types.ts';

const T = (id: string, day: number, pnl?: number, extra: Partial<Trade> = {}): Trade =>
  ({ id, entryAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`, closedAt: pnl === undefined ? undefined : `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`, side: 'buy', pnl, ...extra });
const day = (s: string) => s.slice(0, 10);

test('empty journal', () => {
  const s = computeStats([], 30);
  assert.equal(s.completed, 0); assert.equal(s.balance, 30); assert.equal(s.winRate, null); assert.equal(s.profitFactor, null); assert.equal(s.expectancy, null);
});
test('example row and open trades are excluded', () => {
  const s = computeStats([T('x', 1, -0.45, { isExample: true }), T('o', 2), T('a', 3, 1)], 30);
  assert.equal(s.completed, 1); assert.equal(s.open, 1); assert.equal(s.net, 1);
});
test('win / loss / breakeven classification', () => {
  assert.equal(outcome(T('a', 1, 5)), 'win'); assert.equal(outcome(T('a', 1, -5)), 'loss');
  assert.equal(outcome(T('a', 1, 0)), 'breakeven'); assert.equal(outcome(T('a', 1)), 'open');
});
test('core metrics', () => {
  const s = computeStats([T('1', 1, 3), T('2', 2, -1), T('3', 3, -1), T('4', 4, 2)], 30);
  assert.equal(s.net, 3); assert.equal(s.balance, 33); assert.equal(s.growthPct, 10);
  assert.equal(s.winRate, 50); assert.equal(s.profitFactor, 2.5); assert.equal(s.expectancy, 0.75);
  assert.equal(s.avgWin, 2.5); assert.equal(s.avgLoss, -1); assert.equal(s.payoff, 2.5);
});
test('no losses -> explicit marker, no losses side', () => {
  const s = computeStats([T('1', 1, 2)], 30);
  assert.equal(s.profitFactor, 'no_losses'); assert.equal(s.avgLoss, null); assert.equal(s.maxDdUsd, 0);
});
test('no wins', () => {
  const s = computeStats([T('1', 1, -2)], 30);
  assert.equal(s.profitFactor, 0); assert.equal(s.avgWin, null); assert.equal(s.winRate, 0);
});
test('drawdown from initial peak', () => {
  const s = computeStats([T('1', 1, 10), T('2', 2, -5), T('3', 3, -5), T('4', 4, 20)], 30);
  assert.equal(s.maxDdUsd, 10); assert.ok(Math.abs(s.maxDdPct - (10 / 40) * 100) < 1e-9);
});
test('streaks follow closing order, not entry order', () => {
  const a = T('a', 1, -1, { closedAt: '2026-10-05T00:00:00Z' });
  const b = T('b', 2, 1, { closedAt: '2026-10-03T00:00:00Z' });
  const c = T('c', 3, -1, { closedAt: '2026-10-04T00:00:00Z' });
  const s = computeStats([a, b, c], 30);          // closing order: b(win) c(loss) a(loss)
  assert.equal(s.maxLossStreak, 2); assert.equal(s.maxWinStreak, 1);
});
test('editing an old trade re-derives the whole curve', () => {
  const trades = [T('1', 1, 5), T('2', 2, -2)];
  assert.equal(computeStats(trades, 30).balance, 33);
  trades[0] = { ...trades[0], pnl: 1 };
  assert.equal(computeStats(trades, 30).balance, 29);
  assert.equal(computeStats(trades.filter(t => t.id !== '2'), 30).balance, 31);
});
test('R uses planned risk on balance before the trade (matches Excel row example: -0.45 @1.5% of 30 = -1R)', () => {
  const s = computeStats([T('1', 1, -0.45, { riskPct: 0.015 })], 30);
  assert.ok(Math.abs(s.curve[0].r! + 1) < 1e-9); assert.ok(Math.abs(s.avgR! + 1) < 1e-9);
});
test('planned RR', () => {
  assert.equal(plannedRR({ entry: 2650, stop: 2645, target: 2660 }), 2);
  assert.equal(plannedRR({ entry: 1, stop: 1, target: 2 }), null);
  assert.equal(plannedRR({ entry: 1, stop: 0.9 }), null);
});
test('zero / negative initial balance -> growth null', () => {
  assert.equal(computeStats([T('1', 1, 1)], 0).growthPct, null);
  assert.equal(computeStats([T('1', 1, 1)], -5).growthPct, null);
});
test('alerts: risk, RR, checklist, daily limit, 2 consecutive losses; edit does not double count', () => {
  const prev = [T('p1', 28, -1), T('p2', 28, -1)];
  const t = T('n', 28, undefined, { riskPct: 0.03, entry: 10, stop: 9, target: 10.5, checklistScore: 8 });
  const a = alerts(t, prev, DEFAULT_RULES, day);
  for (const k of ['مخاطرة عالية', 'R:R ضعيف', 'قائمة ناقصة', 'دخول بعد خسارتين متتاليتين']) assert.ok(a.includes(k), k);
  assert.ok(!a.includes('تجاوز حد اليوم'));
  const three = [T('q1', 28, 1), T('q2', 28, 1), T('q3', 28, 1)];
  assert.ok(alerts(T('n', 28, undefined), three, DEFAULT_RULES, day).includes('تجاوز حد اليوم'));
  assert.ok(!alerts(three[2], three, DEFAULT_RULES, day).includes('تجاوز حد اليوم')); // editing q3 itself
});
