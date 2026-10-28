// Pure backup logic (no DOM/IndexedDB) so it is unit-testable. Images are carried as base64 inside the backup.
import type { Trade, MissedOpportunity } from '../engine/types.ts';

export const FORMAT = 'trading-journal-backup', VERSION = 1;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export interface ImageRecord { id: string; tradeId: string; kind: 'before' | 'during' | 'after' | 'other'; fileName: string; mime: string; size: number; addedAt: string; caption?: string; order: number; dataBase64: string; annotations?: unknown }
export interface BackupData { trades: Trade[]; missed: MissedOpportunity[]; settings: unknown; images: ImageRecord[] }
export interface Backup { format: string; version: number; createdAt: string; app: string; counts: Record<string, number>; checksum: string; data: BackupData }

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

export interface Scope { from?: string; to?: string; includeImages?: boolean }  // dates 'YYYY-MM-DD' on entryAt
export async function buildBackup(all: BackupData, scope: Scope = {}, now = new Date()): Promise<Backup> {
  const inRange = (d: string) => (!scope.from || d.slice(0, 10) >= scope.from) && (!scope.to || d.slice(0, 10) <= scope.to);
  const trades = all.trades.filter(t => !t.isExample && inRange(t.entryAt));
  const ids = new Set(trades.map(t => t.id));
  const data: BackupData = {
    trades, missed: all.missed.filter(m => inRange(m.date)), settings: all.settings,
    images: scope.includeImages === false ? [] : all.images.filter(i => ids.has(i.tradeId)),
  };
  return { format: FORMAT, version: VERSION, createdAt: now.toISOString(), app: 'trading-journal',
    counts: { trades: data.trades.length, missed: data.missed.length, images: data.images.length },
    checksum: await sha256(JSON.stringify(data)), data };
}

export type Validation = { ok: true; backup: Backup } | { ok: false; errors: string[] };
/** Parses and verifies untrusted text. Never executes anything from it. */
export async function validateBackup(text: string): Promise<Validation> {
  let b: any;
  try { b = JSON.parse(text); } catch { return { ok: false, errors: ['الملف ليس JSON صالحًا'] }; }
  const errors: string[] = [];
  if (b?.format !== FORMAT) return { ok: false, errors: ['ليس ملف نسخة احتياطية لهذا التطبيق'] };
  if (typeof b.version !== 'number' || b.version > VERSION) return { ok: false, errors: ['إصدار النسخة أحدث من التطبيق'] };
  const d = b.data;
  if (!d || !Array.isArray(d.trades) || !Array.isArray(d.missed) || !Array.isArray(d.images)) return { ok: false, errors: ['بنية البيانات ناقصة'] };
  if (await sha256(JSON.stringify(d)) !== b.checksum) errors.push('فشل التحقق من السلامة: الملف تالف أو معدّل');
  const tradeIds = new Set<string>();
  d.trades.forEach((t: any, i: number) => {
    if (typeof t?.id !== 'string' || typeof t?.entryAt !== 'string' || (t.side !== 'buy' && t.side !== 'sell')) errors.push(`صفقة غير صالحة رقم ${i + 1}`);
    else tradeIds.add(t.id);
  });
  d.images.forEach((im: any, i: number) => {
    if (typeof im?.id !== 'string' || typeof im?.tradeId !== 'string' || typeof im?.dataBase64 !== 'string') errors.push(`صورة غير صالحة رقم ${i + 1}`);
    else if (!ALLOWED_MIME.includes(im.mime)) errors.push(`نوع صورة غير مدعوم رقم ${i + 1}`);
    else if (im.size > MAX_IMAGE_BYTES) errors.push(`صورة كبيرة جدًا رقم ${i + 1}`);
    else if (!tradeIds.has(im.tradeId)) errors.push(`صورة بلا صفقة مرتبطة رقم ${i + 1}`);
  });
  return errors.length ? { ok: false, errors } : { ok: true, backup: b as Backup };
}

export interface RestorePlan { addTrades: Trade[]; addMissed: MissedOpportunity[]; addImages: ImageRecord[]; skipped: { trades: number; missed: number; images: number } }
/** Merge policy: existing records are NEVER overwritten or deleted; records whose id already exists are skipped. */
export function planRestore(b: Backup, existing: { tradeIds: Set<string>; missedIds: Set<string>; imageIds: Set<string> }): RestorePlan {
  const at = b.data.trades.filter(t => !existing.tradeIds.has(t.id)), am = b.data.missed.filter(m => !existing.missedIds.has(m.id));
  const ai = b.data.images.filter(i => !existing.imageIds.has(i.id));
  return { addTrades: at, addMissed: am, addImages: ai, skipped: { trades: b.data.trades.length - at.length, missed: b.data.missed.length - am.length, images: b.data.images.length - ai.length } };
}

const COLS: [string, (t: Trade) => unknown][] = [
  ['id', t => t.id], ['entryAt', t => t.entryAt], ['closedAt', t => t.closedAt], ['instrument', t => t.instrument], ['side', t => t.side],
  ['session', t => t.session], ['strategy', t => t.strategy], ['entry', t => t.entry], ['stop', t => t.stop], ['target', t => t.target],
  ['lots', t => t.lots], ['riskPct', t => t.riskPct], ['commission', t => t.commission], ['swap', t => t.swap], ['pnl', t => t.pnl],
  ['mood', t => t.mood], ['checklistScore', t => t.checklistScore], ['followedRules', t => t.followedRules === undefined ? '' : t.followedRules ? 'yes' : 'no'],
  ['exitReason', t => t.exitReason], ['entryReason', t => t.entryReason], ['lesson', t => t.lesson],
];
/** CSV with RFC-4180 quoting; text cells starting with = + - @ are prefixed with ' to block spreadsheet formula injection. */
export function tradesToCsv(trades: Trade[]): string {
  const cell = (v: unknown) => {
    if (v === undefined || v === null) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '\ufeff' + [COLS.map(c => c[0]).join(','), ...trades.filter(t => !t.isExample).map(t => COLS.map(c => cell(c[1](t))).join(','))].join('\r\n');
}
