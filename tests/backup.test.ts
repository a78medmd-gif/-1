import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, validateBackup, planRestore, tradesToCsv, type BackupData, type ImageRecord } from '../src/backup/backup.ts';
import type { Trade } from '../src/engine/types.ts';

const tr = (id: string, d: string, extra: Partial<Trade> = {}): Trade => ({ id, entryAt: `${d}T10:00:00.000Z`, side: 'buy', instrument: 'XAUUSD', pnl: 1, ...extra });
const img = (id: string, tradeId: string, extra: Partial<ImageRecord> = {}): ImageRecord => ({ id, tradeId, kind: 'before', fileName: 'a.png', mime: 'image/png', size: 4, addedAt: '2026-10-01T00:00:00Z', order: 0, dataBase64: 'AAAA', ...extra });
const data = (): BackupData => ({ trades: [tr('a', '2026-10-01'), tr('b', '2026-10-15'), tr('x', '2026-10-02', { isExample: true })], missed: [{ id: 'm1', date: '2026-10-03', instrument: 'EURUSD', reason: 'r' }], settings: { initialBalance: 30 }, images: [img('i1', 'a'), img('i2', 'b')] });

test('roundtrip: build -> serialize -> validate keeps everything, example excluded', async () => {
  const b = await buildBackup(data());
  const v = await validateBackup(JSON.stringify(b));
  assert.ok(v.ok); if (!v.ok) return;
  assert.deepEqual(v.backup.counts, { trades: 2, missed: 1, images: 2 });
  assert.equal(v.backup.data.images[0].dataBase64, 'AAAA');
});
test('date range and images-off scope; images follow their trades', async () => {
  const b = await buildBackup(data(), { from: '2026-10-10', includeImages: true });
  assert.deepEqual(b.data.trades.map(t => t.id), ['b']); assert.deepEqual(b.data.images.map(i => i.id), ['i2']); assert.equal(b.data.missed.length, 0);
  assert.equal((await buildBackup(data(), { includeImages: false })).data.images.length, 0);
});
test('tampering is detected', async () => {
  const b = await buildBackup(data()); b.data.trades[0].pnl = 999;
  const v = await validateBackup(JSON.stringify(b)); assert.ok(!v.ok); if (!v.ok) assert.match(v.errors[0], /سلامة/);
});
test('rejects junk, wrong format, newer version, orphan/bad images', async () => {
  assert.ok(!(await validateBackup('not json')).ok);
  assert.ok(!(await validateBackup('{"format":"other"}')).ok);
  const b = await buildBackup(data()); b.version = 99; assert.ok(!(await validateBackup(JSON.stringify(b))).ok);
  const raw = await buildBackup(data()); raw.data.images.push(img('i3', 'nope'), img('i4', 'a', { mime: 'image/svg+xml' }), img('i5', 'a', { size: 1e9 }));
  const { sha256 } = await import('../src/backup/backup.ts'); raw.checksum = await sha256(JSON.stringify(raw.data));
  const v2 = await validateBackup(JSON.stringify(raw)); assert.ok(!v2.ok); if (!v2.ok) assert.equal(v2.errors.length, 3);
});
test('restore never overwrites: existing ids skipped, new added; restoring twice adds nothing the second time', async () => {
  const b = await buildBackup(data());
  const p1 = planRestore(b, { tradeIds: new Set(['a']), missedIds: new Set(), imageIds: new Set(['i1']) });
  assert.deepEqual(p1.addTrades.map(t => t.id), ['b']); assert.deepEqual(p1.addImages.map(i => i.id), ['i2']); assert.equal(p1.skipped.trades, 1);
  const p2 = planRestore(b, { tradeIds: new Set(['a', 'b']), missedIds: new Set(['m1']), imageIds: new Set(['i1', 'i2']) });
  assert.equal(p2.addTrades.length + p2.addMissed.length + p2.addImages.length, 0);
});
test('CSV: quoting, newlines, Arabic, formula injection, negative numbers untouched, example excluded', () => {
  const csv = tradesToCsv([tr('a', '2026-10-01', { lesson: 'قال "تمام", ثم\nسطر', entryReason: '=HYPERLINK("x")', pnl: -0.45 }), tr('x', '2026-10-01', { isExample: true })]);
  const lines = csv.split('\r\n'); assert.ok(csv.startsWith('\ufeffid,'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"')); assert.ok(csv.includes('"قال ""تمام"", ثم\nسطر"'));
  assert.ok(csv.includes(',-0.45,')); assert.ok(!csv.includes('\nx,') && !csv.includes('\r\nx,')); assert.equal(lines.length >= 2, true);
});
