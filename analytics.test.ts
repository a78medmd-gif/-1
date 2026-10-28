import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, applyFilters, localParts, monthlyNet, pnlHistogram, insights } from '../src/engine/analytics.ts';
import type { Trade } from '../src/engine/types.ts';

const T = (id: string, iso: string, pnl: number | undefined, e: Partial<Trade> = {}): Trade => ({ id, entryAt: iso, closedAt: pnl === undefined ? undefined : iso, side: 'buy', pnl, ...e });
const tz = 'UTC';

test('timezone: same instant lands on different local days', () => {
  assert.equal(localParts('2026-10-27T22:30:00Z', 'UTC').day, '2026-10-27');
  assert.equal(localParts('2026-10-27T22:30:00Z', 'Asia/Riyadh').day, '2026-10-28');       // UTC+3
  assert.equal(localParts('2026-10-28T12:00:00Z', 'UTC').weekday, 'الأربعاء'); assert.equal(localParts('2026-10-28T12:00:00Z', 'UTC').month, '2026-10');
});
test('groups: counts, win rate, net, PF; example/open excluded; sorted by net', () => {
  const ts = [T('1', '2026-10-01T10:00:00Z', 3, { instrument: 'A' }), T('2', '2026-10-02T10:00:00Z', -1, { instrument: 'A' }), T('3', '2026-10-03T10:00:00Z', 2, { instrument: 'B' }),
    T('4', '2026-10-04T10:00:00Z', undefined, { instrument: 'B' }), T('5', '2026-10-05T10:00:00Z', 50, { instrument: 'B', isExample: true }), T('6', '2026-10-06T10:00:00Z', 1)];
  const r = analyze(ts, 30, 'instrument', {}, tz);
  assert.deepEqual(r.map(x => [x.key, x.trades, x.net]), [['A', 2, 2], ['B', 1, 2], ['غير محدد', 1, 1]].sort((a, b) => (b[2] as number) - (a[2] as number)).map(x => x) as any);
  const a = r.find(x => x.key === 'A')!; assert.equal(a.winRate, 50); assert.equal(a.profitFactor, 3); assert.equal(a.lowSample, true);
  assert.equal(r.find(x => x.key === 'B')!.profitFactor, 'no_losses');
});
test('avgR per group uses journal-wide balance-before (matches Excel R definition)', () => {
  const ts = [T('1', '2026-10-01T10:00:00Z', -0.45, { instrument: 'A', riskPct: 0.015 }), T('2', '2026-10-02T10:00:00Z', 0.2955 * 2, { instrument: 'B', riskPct: 0.01 })];
  const r = analyze(ts, 30, 'instrument', {}, tz);        // trade 2 balance before = 29.55, risk = 0.2955 -> R = 2
  assert.ok(Math.abs(r.find(x => x.key === 'A')!.avgR! + 1) < 1e-9); assert.ok(Math.abs(r.find(x => x.key === 'B')!.avgR! - 2) < 1e-9);
});
test('filters by date, instrument, side apply to groups', () => {
  const ts = [T('1', '2026-10-01T10:00:00Z', 1, { instrument: 'A' }), T('2', '2026-10-10T10:00:00Z', 1, { instrument: 'A', side: 'sell' }), T('3', '2026-10-10T10:00:00Z', 1, { instrument: 'B' })];
  assert.equal(applyFilters(ts, { from: '2026-10-05' }, tz).length, 2); assert.equal(applyFilters(ts, { instrument: 'A', side: 'sell' }, tz).length, 1);
  assert.equal(analyze(ts, 30, 'side', { instrument: 'A' }, tz).length, 2);
});
test('other dimensions: weekday, followed, checklist, image presence', () => {
  const ts = [T('1', '2026-10-28T10:00:00Z', 1, { followedRules: true, checklistScore: 10 }), T('2', '2026-10-29T10:00:00Z', -1, { followedRules: false, checklistScore: 8 })];
  assert.deepEqual(analyze(ts, 30, 'weekday', {}, tz).map(r => r.key).sort(), ['الأربعاء', 'الخميس']);
  assert.deepEqual(analyze(ts, 30, 'followed', {}, tz).map(r => r.key).sort(), ['غير ملتزم', 'ملتزم'].sort());
  assert.equal(analyze(ts, 30, 'checklist', {}, tz).length, 2);
  assert.equal(analyze(ts, 30, 'hasBeforeImage', {}, tz, { '1': ['before'] }).find(r => r.key === 'بصورة قبل الدخول')!.trades, 1);
});
test('monthly net and histogram', () => {
  const ts = [T('1', '2026-09-30T10:00:00Z', 2), T('2', '2026-10-01T10:00:00Z', -1), T('3', '2026-10-02T10:00:00Z', 4), T('4', '2026-10-03T10:00:00Z', undefined)];
  assert.deepEqual(monthlyNet(ts, tz), [{ month: '2026-09', net: 2 }, { month: '2026-10', net: 3 }]);
  const h = pnlHistogram(ts, 3); assert.equal(h.reduce((s, b) => s + b.count, 0), 3); assert.equal(h[2].count, 1);
  assert.deepEqual(pnlHistogram([], 5), []); assert.equal(pnlHistogram([T('1', '2026-10-01T00:00:00Z', 1)], 5)[0].count, 1);
});
test('insights: no best/worst claim from tiny samples', () => {
  const small = [{ key: 'A', trades: 2, winRate: 100, net: 5, avgR: 1, profitFactor: 'no_losses' as const, lowSample: true }, { key: 'B', trades: 1, winRate: 0, net: -1, avgR: -1, profitFactor: 0, lowSample: true }];
  assert.match(insights(small, 'الاستراتيجية')[0], /غير كافية/); assert.equal(insights([], 'x').length, 0);
  const big = [{ ...small[0], trades: 9, lowSample: false }, { ...small[1], trades: 7, lowSample: false }];
  const s = insights(big, 'الاستراتيجية')[0]; assert.match(s, /9 صفقة/); assert.match(s, /ارتباط/);
});
