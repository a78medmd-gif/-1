import { ALLOWED_MIME, MAX_IMAGE_BYTES } from '../backup/backup.ts';

export type Kind = 'before' | 'during' | 'after' | 'other';
export const KIND_LABEL: Record<Kind, string> = { before: 'قبل الدخول', during: 'أثناء الصفقة', after: 'بعد الخروج', other: 'أخرى' };

/** Detects the real image type from the first bytes (do not trust file name or declared MIME). */
export function sniffMime(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
/** Returns an Arabic error message, or null when the file is acceptable. */
export function validateImage(size: number, head: Uint8Array): string | null {
  if (size <= 0) return 'الملف فارغ';
  if (size > MAX_IMAGE_BYTES) return `الصورة أكبر من ${MAX_IMAGE_BYTES / 1048576} ميغابايت`;
  const m = sniffMime(head);
  return m && ALLOWED_MIME.includes(m) ? null : 'النوع غير مدعوم (المسموح: JPG وPNG وWebP)';
}

export interface Ordered { id: string; order: number; kind: Kind }
export const sortImages = <T extends Ordered>(xs: T[]) => [...xs].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
export const nextOrder = (xs: Ordered[]) => (xs.length ? Math.max(...xs.map(x => x.order)) + 1 : 0);
/** Moves one image up/down; returns [id, newOrder] updates for every image (dense 0..n-1). Unknown id or edge => no change. */
export function reorder(xs: Ordered[], id: string, dir: -1 | 1): { id: string; order: number }[] {
  const s = sortImages(xs), i = s.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= s.length) return s.map((x, k) => ({ id: x.id, order: k }));
  [s[i], s[j]] = [s[j], s[i]];
  return s.map((x, k) => ({ id: x.id, order: k }));
}
/** First "before" and last "after" image, for side-by-side comparison. */
export function comparePair<T extends Ordered>(xs: T[]): { before?: T; after?: T } {
  const s = sortImages(xs);
  return { before: s.find(x => x.kind === 'before'), after: [...s].reverse().find(x => x.kind === 'after') };
}
