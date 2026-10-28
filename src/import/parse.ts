// Library-independent parser: takes sheet rows (arrays of cell values) and returns normalized records.
// Layout mirrors trading_journal.xlsx: journal header = row 4, row 5 = example (excluded), data from row 6.
import type { Trade, MissedOpportunity } from '../engine/types.ts';
import type { AppSettings } from '../db/db.ts';

const FIRST_DATA_ROW = 5;           // 0-based index of Excel row 6
export interface Rejected { row: number; reason: string }
export interface ParseResult<T> { items: T[]; rejected: Rejected[]; duplicates: number }

const str = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? undefined : String(v).trim());
const numv = (v: unknown): number | undefined | 'bad' => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 'bad';
};
/** Date | ISO string | Excel serial -> 'YYYY-MM-DD' or null */
export function toDay(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) { const d = new Date(v.slice(0, 10) + 'T00:00:00Z'); return isNaN(+d) ? null : v.slice(0, 10); }
  return null;
}
export const fingerprint = (t: Pick<Trade, 'entryAt' | 'instrument' | 'side' | 'entry' | 'pnl'>) =>
  [t.entryAt.slice(0, 10), t.instrument, t.side, t.entry ?? '', t.pnl ?? ''].join('|');

export function parseJournal(rows: unknown[][], existing: Trade[] = []): ParseResult<Trade> {
  const seen = new Set(existing.map(fingerprint)), items: Trade[] = [], rejected: Rejected[] = [];
  let duplicates = 0;
  rows.slice(FIRST_DATA_ROW).forEach((r, i) => {
    const row = FIRST_DATA_ROW + i + 1;
    if (str(r[0]) === 'مثال') return;
    const core = [1, 3, 4, 6, 7, 8, 16].map(c => r[c]);
    if (core.every(v => str(v) === undefined)) return;               // empty row (formulas only)
    const day = toDay(r[1]); if (!day) return void rejected.push({ row, reason: 'تاريخ غير صالح' });
    const instrument = str(r[3]); if (!instrument) return void rejected.push({ row, reason: 'الأداة مفقودة' });
    const side = str(r[4]) === 'شراء' ? 'buy' : str(r[4]) === 'بيع' ? 'sell' : null;
    if (!side) return void rejected.push({ row, reason: 'نوع الصفقة غير معروف' });
    const [entry, stop, target, lots, risk, score, pnl] = [6, 7, 8, 9, 10, 13, 16].map(c => numv(r[c]));
    if ([entry, stop, target, lots, risk, score, pnl].includes('bad')) return void rejected.push({ row, reason: 'قيمة رقمية غير صالحة' });
    const f = str(r[14]);
    // seconds offset preserves the sheet's entry order for same-day trades
    const at = new Date(Date.parse(day + 'T00:00:00Z') + i * 1000).toISOString();
    const t: Trade = {
      id: crypto.randomUUID(), entryAt: at, closedAt: pnl === undefined ? undefined : at, side, instrument,
      session: str(r[2]), strategy: str(r[5]), entry: entry as number | undefined, stop: stop as number | undefined, target: target as number | undefined,
      lots: lots as number | undefined, riskPct: risk as number | undefined, entryReason: str(r[11]), mood: str(r[12]),
      checklistScore: score as number | undefined, followedRules: f === 'نعم' ? true : f === 'لا' ? false : undefined,
      exitReason: str(r[15]), pnl: pnl as number | undefined, lesson: str(r[18]), source: 'import',
    };
    const fp = fingerprint(t);
    if (seen.has(fp)) { duplicates++; return; }
    seen.add(fp); items.push(t);
  });
  return { items, rejected, duplicates };
}

export function parseMissed(rows: unknown[][], existing: MissedOpportunity[] = []): ParseResult<MissedOpportunity> {
  const seen = new Set(existing.map(m => [m.date, m.instrument, m.reason].join('|'))), items: MissedOpportunity[] = [], rejected: Rejected[] = [];
  let duplicates = 0;
  rows.slice(FIRST_DATA_ROW).forEach((r, i) => {
    const row = FIRST_DATA_ROW + i + 1;
    if ([0, 1, 2, 3].every(c => str(r[c]) === undefined)) return;
    const date = toDay(r[0]); if (!date) return void rejected.push({ row, reason: 'تاريخ غير صالح' });
    const instrument = str(r[1]); if (!instrument) return void rejected.push({ row, reason: 'الأداة مفقودة' });
    const h = str(r[3]); const hypothetical = h === 'ربح' ? 'win' : h === 'خسارة' ? 'loss' : undefined;
    if (h && !hypothetical) return void rejected.push({ row, reason: 'النتيجة الافتراضية غير معروفة' });
    const m: MissedOpportunity = { id: crypto.randomUUID(), date, instrument, reason: str(r[2]) ?? '', hypothetical, notes: str(r[4]), source: 'import' };
    const k = [m.date, m.instrument, m.reason].join('|');
    if (seen.has(k)) { duplicates++; return; }
    seen.add(k); items.push(m);
  });
  return { items, rejected, duplicates };
}

/** Settings sheet: B4..B7 rules, lists in columns A..E from row 11. */
export function parseSettings(rows: unknown[][], base: AppSettings, initialBalance?: unknown): Partial<AppSettings> {
  const col = (c: number) => rows.slice(10).map(r => str(r[c])).filter((x): x is string => !!x);
  const n = (r: number, d: number) => { const v = numv(rows[r]?.[1]); return typeof v === 'number' ? v : d; };
  const bal = numv(initialBalance);
  return {
    initialBalance: typeof bal === 'number' ? bal : base.initialBalance,
    rules: { ...base.rules, maxRiskPct: n(3, base.rules.maxRiskPct), maxDailyTrades: n(4, base.rules.maxDailyTrades), minRR: n(5, base.rules.minRR), minChecklist: n(6, base.rules.minChecklist) },
    lists: { instruments: col(0), sessions: col(1), strategies: col(2), moods: col(3), exitReasons: col(4) },
  };
}
