import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseJournal, parseMissed, parseSettings, toDay } from '../src/import/parse.ts';
import { DEFAULT_SETTINGS } from '../src/db/db.ts';

const wb = JSON.parse(readFileSync(new URL('./fixtures/journal.json', import.meta.url), 'utf8'));
const pad = (n: number) => Array.from({ length: n }, () => [] as unknown[]);
const sheet = (...rows: unknown[][]) => [...pad(5), ...rows];
// A,B..S = 19 columns
const row = (o: Record<number, unknown>) => { const r: unknown[] = Array(19).fill(null); for (const [k, v] of Object.entries(o)) r[+k] = v; return r; };

test('the real workbook: example row excluded, 0 real trades / missed', () => {
  assert.equal(parseJournal(wb['سجل الصفقات']).items.length, 0);
  assert.equal(parseJournal(wb['سجل الصفقات']).rejected.length, 0);
  assert.equal(parseMissed(wb['صفقات ترددت فيها']).items.length, 0);
});
test('the real workbook: settings and lists', () => {
  const s = parseSettings(wb['الإعدادات'], DEFAULT_SETTINGS, wb['الملخص'][2][1]);
  assert.equal(s.initialBalance, 30); assert.equal(s.rules!.maxRiskPct, 0.02); assert.equal(s.rules!.maxDailyTrades, 3);
  assert.equal(s.rules!.minRR, 1.5); assert.equal(s.rules!.minChecklist, 10);
  assert.equal(s.lists!.instruments.length, 8); assert.equal(s.lists!.moods.length, 7); assert.equal(s.lists!.exitReasons.length, 4);
});
test('valid rows import; marker-example, empty, bad date, bad number, bad side rejected correctly', () => {
  const r = parseJournal(sheet(
    row({ 0: 1, 1: '2026-10-20', 3: 'XAUUSD', 4: 'شراء', 6: 2650, 7: 2645, 8: 2660, 14: 'نعم', 16: 1.5 }),
    row({ 0: 2, 1: '2026-10-20', 3: 'EURUSD', 4: 'بيع', 16: -1 }),
    row({ 0: 'مثال', 1: '2026-10-20', 3: 'XAUUSD', 4: 'شراء', 16: 9 }),
    row({}),
    row({ 1: 'xx', 3: 'XAUUSD', 4: 'شراء', 16: 1 }),
    row({ 1: '2026-10-21', 3: 'XAUUSD', 4: 'شراء', 16: 'abc' }),
    row({ 1: '2026-10-21', 3: 'XAUUSD', 4: '??', 16: 1 }),
  ));
  assert.equal(r.items.length, 2); assert.equal(r.rejected.length, 3);
  assert.deepEqual(r.rejected.map(x => x.row), [10, 11, 12]);
  assert.equal(r.items[0].followedRules, true); assert.equal(r.items[1].side, 'sell');
  assert.ok(r.items[0].entryAt < r.items[1].entryAt);       // sheet order preserved on the same day
});
test('re-importing the same data creates no duplicates', () => {
  const rows = sheet(row({ 1: '2026-10-20', 3: 'XAUUSD', 4: 'شراء', 6: 2650, 16: 1.5 }));
  const first = parseJournal(rows), second = parseJournal(rows, first.items);
  assert.equal(first.items.length, 1); assert.equal(second.items.length, 0); assert.equal(second.duplicates, 1);
});
test('open trade (no pnl) imports as open, no closedAt', () => {
  const t = parseJournal(sheet(row({ 1: '2026-10-20', 3: 'GBPUSD', 4: 'شراء' }))).items[0];
  assert.equal(t.pnl, undefined); assert.equal(t.closedAt, undefined);
});
test('dates: Date, ISO, Excel serial, junk', () => {
  assert.equal(toDay(new Date('2026-10-28T00:00:00Z')), '2026-10-28'); assert.equal(toDay('2026-10-28T00:00:00'), '2026-10-28');
  assert.equal(toDay(46323), '2026-10-28'); assert.equal(toDay('hello'), null); assert.equal(toDay(5), null);
});
test('missed: valid, bad outcome, duplicate', () => {
  const m = (o: Record<number, unknown>) => { const r: unknown[] = Array(6).fill(null); for (const [k, v] of Object.entries(o)) r[+k] = v; return r; };
  const r = parseMissed(sheet(m({ 0: '2026-10-20', 1: 'EURUSD', 2: 'تردد', 3: 'ربح' }), m({ 0: '2026-10-20', 1: 'EURUSD', 2: 'تردد', 3: 'ربح' }), m({ 0: '2026-10-21', 1: 'EURUSD', 3: 'ممكن' })));
  assert.equal(r.items.length, 1); assert.equal(r.duplicates, 1); assert.equal(r.rejected.length, 1);
});
