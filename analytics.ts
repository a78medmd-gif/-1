import { computeStats, outcome } from './calc.ts';
import type { Trade } from './types.ts';

export const MIN_SAMPLE = 5;   // groups below this are flagged; never called "best/worst"
const AR_DAYS: Record<string, string> = { Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت' };

/** Local calendar parts of an ISO instant in an IANA time zone. */
export function localParts(iso: string, tz: string) {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).formatToParts(d);
  const p = Object.fromEntries(f({ year: 'numeric', month: '2-digit', day: '2-digit' }).map(x => [x.type, x.value]));
  const weekday = f({ weekday: 'long' }).find(x => x.type === 'weekday')!.value;
  return { day: `${p.year}-${p.month}-${p.day}`, month: `${p.year}-${p.month}`, weekday: AR_DAYS[weekday] };
}
export const localDay = (iso: string, tz: string) => localParts(iso, tz).day;

export interface Filters { from?: string; to?: string; instrument?: string; strategy?: string; session?: string; side?: 'buy' | 'sell' }
export function applyFilters(ts: Trade[], f: Filters, tz: string): Trade[] {
  return ts.filter(t => { const day = localDay(t.entryAt, tz);
    return (!f.from || day >= f.from) && (!f.to || day <= f.to) && (!f.instrument || t.instrument === f.instrument)
      && (!f.strategy || t.strategy === f.strategy) && (!f.session || t.session === f.session) && (!f.side || t.side === f.side); });
}

export type Dim = 'instrument' | 'session' | 'strategy' | 'mood' | 'weekday' | 'month' | 'timeframe' | 'side' | 'checklist' | 'exitReason' | 'followed' | 'hasBeforeImage';
export interface Row { key: string; trades: number; winRate: number | null; net: number; avgR: number | null; profitFactor: number | 'no_losses' | null; lowSample: boolean }

export function analyze(all: Trade[], initial: number, dim: Dim, f: Filters, tz: string, imagesByTrade: Record<string, string[]> = {}): Row[] {
  // R is derived on the WHOLE journal (balance before each trade), then trades are filtered/grouped.
  const rById = new Map(computeStats(all, initial).curve.map(p => [p.id, p.r]));
  const key = (t: Trade): string | undefined => {
    switch (dim) {
      case 'weekday': return localParts(t.entryAt, tz).weekday; case 'month': return localParts(t.entryAt, tz).month;
      case 'side': return t.side === 'buy' ? 'شراء' : 'بيع'; case 'checklist': return t.checklistScore === undefined ? undefined : String(t.checklistScore);
      case 'followed': return t.followedRules === undefined ? undefined : t.followedRules ? 'ملتزم' : 'غير ملتزم';
      case 'hasBeforeImage': return (imagesByTrade[t.id] ?? []).includes('before') ? 'بصورة قبل الدخول' : 'بلا صورة قبل الدخول';
      default: return (t as unknown as Record<string, string | undefined>)[dim];
    }
  };
  const groups = new Map<string, Trade[]>();
  for (const t of applyFilters(all.filter(x => !x.isExample && outcome(x) !== 'open'), f, tz)) {
    const k = key(t) ?? 'غير محدد'; groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  return [...groups].map(([k, ts]) => {
    const w = ts.filter(t => t.pnl! > 0), l = ts.filter(t => t.pnl! < 0), rs = ts.map(t => rById.get(t.id)).filter((r): r is number => r !== undefined);
    const gl = l.reduce((s, t) => s + t.pnl!, 0), gp = w.reduce((s, t) => s + t.pnl!, 0);
    return { key: k, trades: ts.length, winRate: (w.length / ts.length) * 100, net: ts.reduce((s, t) => s + t.pnl!, 0),
      avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null, profitFactor: l.length ? gp / Math.abs(gl) : w.length ? 'no_losses' : null, lowSample: ts.length < MIN_SAMPLE };
  }).sort((a, b) => b.net - a.net);
}

export const monthlyNet = (ts: Trade[], tz: string) => {
  const m = new Map<string, number>();
  for (const t of ts) if (!t.isExample && outcome(t) !== 'open') { const k = localParts(t.closedAt ?? t.entryAt, tz).month; m.set(k, (m.get(k) ?? 0) + t.pnl!); }
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([month, net]) => ({ month, net }));
};
export function pnlHistogram(ts: Trade[], bins = 10) {
  const v = ts.filter(t => !t.isExample && outcome(t) !== 'open').map(t => t.pnl!); if (!v.length) return [];
  const lo = Math.min(...v), hi = Math.max(...v); if (lo === hi) return [{ from: lo, to: hi, count: v.length }];
  const w = (hi - lo) / bins, out = Array.from({ length: bins }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 }));
  for (const x of v) out[Math.min(bins - 1, Math.floor((x - lo) / w))].count++;
  return out;
}
/** Cautious readings: names a best/worst group only if it has >= MIN_SAMPLE trades; always shows n; association != causation. */
export function insights(rows: Row[], label: string): string[] {
  const ok = rows.filter(r => !r.lowSample);
  if (rows.length === 0) return [];
  if (ok.length < 2) return [`${label}: العينة غير كافية للمقارنة (أقل من ${MIN_SAMPLE} صفقات في معظم المجموعات).`];
  const b = ok[0], w = ok[ok.length - 1];
  return [`${label}: الأعلى نتيجة "${b.key}" (${b.trades} صفقة، صافي ${b.net.toFixed(2)}$) والأدنى "${w.key}" (${w.trades} صفقة، ${w.net.toFixed(2)}$). هذا ارتباط في بياناتك وليس دليلًا على السبب.`];
}
