import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniffMime, validateImage, reorder, nextOrder, sortImages, comparePair, type Ordered } from '../src/images/imageUtils.ts';

const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = Uint8Array.from([...'RIFF'].map(c => c.charCodeAt(0)).concat([1, 2, 3, 4], [...'WEBP'].map(c => c.charCodeAt(0))));
const mk = (id: string, order: number, kind: Ordered['kind'] = 'other'): Ordered => ({ id, order, kind });

test('sniff real types; reject svg/html/exe/empty disguised as images', () => {
  assert.equal(sniffMime(JPG), 'image/jpeg'); assert.equal(sniffMime(PNG), 'image/png'); assert.equal(sniffMime(WEBP), 'image/webp');
  assert.equal(sniffMime(new TextEncoder().encode('<svg xmlns=')), null); assert.equal(sniffMime(new TextEncoder().encode('MZ\x90')), null); assert.equal(sniffMime(new Uint8Array()), null);
});
test('validateImage: ok, too big, empty, wrong content', () => {
  assert.equal(validateImage(1000, JPG), null);
  assert.match(validateImage(16 * 1048576, JPG)!, /أكبر/); assert.match(validateImage(0, JPG)!, /فارغ/);
  assert.match(validateImage(10, new TextEncoder().encode('<html>'))!, /غير مدعوم/);
});
test('reorder swaps neighbours, stays dense, no-ops at edges and unknown id', () => {
  const xs = [mk('a', 0), mk('b', 5), mk('c', 9)];
  assert.deepEqual(reorder(xs, 'b', -1), [{ id: 'b', order: 0 }, { id: 'a', order: 1 }, { id: 'c', order: 2 }]);
  assert.deepEqual(reorder(xs, 'a', -1).map(x => x.id), ['a', 'b', 'c']); assert.deepEqual(reorder(xs, 'zz', 1).map(x => x.id), ['a', 'b', 'c']);
});
test('nextOrder / sortImages', () => {
  assert.equal(nextOrder([]), 0); assert.equal(nextOrder([mk('a', 3)]), 4);
  assert.deepEqual(sortImages([mk('b', 2), mk('a', 1)]).map(x => x.id), ['a', 'b']);
});
test('comparePair: before/after pick, partial and empty', () => {
  const p = comparePair([mk('1', 0, 'before'), mk('2', 1, 'during'), mk('3', 2, 'after'), mk('4', 3, 'after')]);
  assert.equal(p.before?.id, '1'); assert.equal(p.after?.id, '4');
  assert.equal(comparePair([mk('1', 0, 'before')]).after, undefined); assert.deepEqual(comparePair([]), { before: undefined, after: undefined });
});
