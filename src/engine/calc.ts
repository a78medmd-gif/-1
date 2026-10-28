import type { Trade, Outcome, Stats, Point } from './types.ts';

/** Formulas (documented; mirrored in the in-app Instructions page):
 *  completed      = trades with a numeric pnl (open trades are NOT completed)
 *  net            = sum(pnl);  balance = initial + net
 *  growth%        = net / initial * 100, only if initial > 0 (else null)
 *  winRate%       = wins / completed * 100
 *  profitFactor   = grossProfit / |grossLoss|; 'no_losses' if no losses
 *  expectancy     = net / completed
 *  plannedRR      = |target-entry| / |entry-stop|
 *  R              = pnl / (riskPct * balanceBefore)   -- riskPct is the PLANNED risk
 *  drawdown       = peak - balance (peak starts at initial balance); % = dd / peak * 100
 *  streaks        = computed in CLOSING order (closedAt, then entryAt, then id)
 */
export const outcome = (t: Trade): Outcome =>
  t.pnl === undefined || t.pnl === null || Number.isNaN(t.pnl) ? 'open' : t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'breakeven';

export const plannedRR = (t: Pick<Trade, 'entry' | 'stop' | 'target'>): number | null => {
  const { entry, stop, target } = t;
  if (entry === undefined || stop === undefined || target === undefined) return null;
  const risk = Math.abs(entry - stop);
  return risk === 0 ? null : Math.abs(target - entry) / risk;
};

export const closeOrder = (a: Trade, b: Trade) =>
  (a.closedAt ?? a.entryAt).localeCompare(b.closedAt ?? b.entryAt) || a.entryAt.localeCompare(b.entryAt) || a.id.localeCompare(b.id);

export function computeStats(all: Trade[], initial: number): Stats {
  const real = all.filter(t => !t.isExample);
  const done = real.filter(t => outcome(t) !== 'open').sort(closeOrder);
  const wins = done.filter(t => t.pnl! > 0), losses = done.filter(t => t.pnl! < 0);
  const net = done.reduce((s, t) => s + t.pnl!, 0);
  const gp = wins.reduce((s, t) => s + t.pnl!, 0), gl = losses.reduce((s, t) => s + t.pnl!, 0);
  let bal = initial, peak = initial, ws = 0, ls = 0, maxDd = 0, maxDdPct = 0, mw = 0, ml = 0;
  const curve: Point[] = [], rs: number[] = [];
  for (const t of done) {
    const risk = t.riskPct !== undefined ? t.riskPct * bal : 0;
    const r = risk > 0 ? t.pnl! / risk : undefined;
    if (r !== undefined) rs.push(r);
    bal += t.pnl!; peak = Math.max(peak, bal);
    ws = t.pnl! > 0 ? ws + 1 : 0; ls = t.pnl! < 0 ? ls + 1 : 0;
    const dd = peak - bal, ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    maxDd = Math.max(maxDd, dd); maxDdPct = Math.max(maxDdPct, ddPct); mw = Math.max(mw, ws); ml = Math.max(ml, ls);
    curve.push({ id: t.id, balance: bal, peak, ddUsd: dd, ddPct, winStreak: ws, lossStreak: ls, r });
  }
  const n = done.length;
  return {
    completed: n, wins: wins.length, losses: losses.length, breakeven: n - wins.length - losses.length,
    open: real.length - n, net, balance: initial + net,
    growthPct: initial > 0 ? (net / initial) * 100 : null,
    winRate: n ? (wins.length / n) * 100 : null,
    avgWin: wins.length ? gp / wins.length : null, avgLoss: losses.length ? gl / losses.length : null,
    payoff: wins.length && losses.length ? gp / wins.length / Math.abs(gl / losses.length) : null,
    profitFactor: losses.length ? gp / Math.abs(gl) : wins.length ? 'no_losses' : null,
    expectancy: n ? net / n : null, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    maxDdUsd: maxDd, maxDdPct, maxWinStreak: mw, maxLossStreak: ml,
    best: n ? Math.max(...done.map(t => t.pnl!)) : null, worst: n ? Math.min(...done.map(t => t.pnl!)) : null, curve,
  };
}

export interface RiskRules { maxRiskPct: number; maxDailyTrades: number; minRR: number; minChecklist: number; consecutiveLossStop: number; riskyMoods: string[] }
export const DEFAULT_RULES: RiskRules = { maxRiskPct: 0.02, maxDailyTrades: 3, minRR: 1.5, minChecklist: 10, consecutiveLossStop: 2, riskyMoods: ['خايف يفوتني (FOMO)', 'انتقام', 'ملل', 'طمع'] };

/** Alerts for a trade, given prior trades (same-day count excludes the trade itself, so edits never double count). */
export function alerts(t: Trade, others: Trade[], rules: RiskRules, dayOf: (iso: string) => string): string[] {
  const out: string[] = [];
  if (t.riskPct !== undefined && t.riskPct > rules.maxRiskPct) out.push('مخاطرة عالية');
  const rr = plannedRR(t); if (rr !== null && rr < rules.minRR) out.push('R:R ضعيف');
  if (t.checklistScore !== undefined && t.checklistScore < rules.minChecklist) out.push('قائمة ناقصة');
  if (t.mood && rules.riskyMoods.includes(t.mood)) out.push('حالة نفسية خطرة');
  const prior = others.filter(o => !o.isExample && o.id !== t.id && o.entryAt <= t.entryAt);
  if (prior.filter(o => dayOf(o.entryAt) === dayOf(t.entryAt)).length + 1 > rules.maxDailyTrades) out.push('تجاوز حد اليوم');
  const closed = prior.filter(o => outcome(o) !== 'open').sort(closeOrder);
  const lastN = closed.slice(-rules.consecutiveLossStop);
  if (lastN.length === rules.consecutiveLossStop && lastN.every(o => o.pnl! < 0) && dayOf(lastN[lastN.length - 1].closedAt ?? lastN[lastN.length - 1].entryAt) === dayOf(t.entryAt)) out.push('دخول بعد خسارتين متتاليتين');
  return out;
}
