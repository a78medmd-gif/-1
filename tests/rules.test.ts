import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, checklistItems, snapshot } from '../src/engine/checklist.ts';
import { decide } from '../src/engine/policy.ts';
import { hypotheticalR, missedStats } from '../src/engine/missed.ts';
import { alerts, computeStats, DEFAULT_RULES } from '../src/engine/calc.ts';
import type { MissedOpportunity } from '../src/engine/types.ts';

const yes = Array(10).fill('yes');
test('checklist: all yes => enter; any no => dont with failed list; missing => incomplete', () => {
  assert.deepEqual(evaluate(yes, DEFAULT_RULES), { score: 10, failed: [], unanswered: 0, verdict: 'enter' });
  const e = evaluate([...yes.slice(0, 3), 'no', ...yes.slice(4)], DEFAULT_RULES); assert.equal(e.verdict, 'dont'); assert.deepEqual(e.failed, [4]); assert.equal(e.score, 9);
  assert.equal(evaluate(yes.slice(0, 8), DEFAULT_RULES).verdict, 'incomplete');
});
test('checklist: N/A fails unless allowed; allowed N/A counts toward minimum', () => {
  const a = [...yes.slice(0, 9), 'na'];
  assert.equal(evaluate(a, DEFAULT_RULES, false).verdict, 'dont'); assert.equal(evaluate(a, DEFAULT_RULES, true).verdict, 'enter');
  assert.equal(evaluate(a, { ...DEFAULT_RULES, minChecklist: 10 }, true).score, 9);
});
test('checklist texts follow settings; snapshot is frozen data', () => {
  const t = checklistItems({ ...DEFAULT_RULES, maxRiskPct: 0.01, maxDailyTrades: 5, minRR: 2 });
  assert.match(t[4], /1:2/); assert.match(t[5], /1%/); assert.match(t[9], /5/);
  const s = snapshot(yes, DEFAULT_RULES, false, new Date('2026-10-28T10:00:00Z')); assert.equal(s.score, 10); assert.equal(s.texts.length, 10); assert.equal(s.at, '2026-10-28T10:00:00.000Z');
});
test('policy: warn / confirm / block per rule; default warn', () => {
  const d = decide(['مخاطرة عالية', 'R:R ضعيف', 'قائمة ناقصة', 'شيء جديد'], { risk: 'block', rr: 'confirm', checklist: 'warn' });
  assert.deepEqual(d.block, ['مخاطرة عالية']); assert.deepEqual(d.confirm, ['R:R ضعيف']); assert.deepEqual(d.warn, ['قائمة ناقصة', 'شيء جديد']); assert.equal(d.canSave, false);
  assert.equal(decide([], {}).canSave, true); assert.equal(decide(['مخاطرة عالية'], {}).canSave, true);
});
test('risky mood raises an alert', () => {
  const t = { id: 'n', entryAt: '2026-10-28T10:00:00Z', side: 'buy' as const, mood: 'انتقام' };
  assert.ok(alerts(t, [], DEFAULT_RULES, s => s.slice(0, 10)).includes('حالة نفسية خطرة'));
  assert.ok(!alerts({ ...t, mood: 'واثق' }, [], DEFAULT_RULES, s => s.slice(0, 10)).includes('حالة نفسية خطرة'));
});
test('missed: hypothetical R, stats, never affects real balance', () => {
  assert.equal(hypotheticalR({ entry: 100, stop: 99, target: 102, hypothetical: 'win' }), 2); assert.equal(hypotheticalR({ entry: 100, stop: 99, target: 102, hypothetical: 'loss' }), -1);
  assert.equal(hypotheticalR({ entry: 100, stop: 100, target: 102, hypothetical: 'win' }), null); assert.equal(hypotheticalR({ hypothetical: 'win' }), null);
  const ms: MissedOpportunity[] = [{ id: '1', date: 'd', instrument: 'A', reason: 'تردد', hypothetical: 'loss' }, { id: '2', date: 'd', instrument: 'A', reason: 'تردد', hypothetical: 'win', entry: 1, stop: 0, target: 3 },
    { id: '3', date: 'd', instrument: 'B', reason: 'خوف', hypothetical: 'win', correctDecision: true }, { id: '4', date: 'd', instrument: 'B', reason: 'خوف' }];
  const s = missedStats(ms); assert.deepEqual([s.avoidedLoss, s.missedWin, s.undecided], [2, 1, 1]); assert.equal(s.hypotheticalNetR, 2); assert.equal(s.topReasons[0].count, 2);
  assert.equal(computeStats([], 30).balance, 30);
});
