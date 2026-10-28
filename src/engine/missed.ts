import type { MissedOpportunity } from './types.ts';
/** Hypothetical result in R (win => planned R:R, loss => -1). Needs entry/stop/target; never touches the real balance. */
export function hypotheticalR(m: Pick<MissedOpportunity, 'entry' | 'stop' | 'target' | 'hypothetical'>): number | null {
  if (!m.hypothetical || m.entry === undefined || m.stop === undefined || m.target === undefined) return null;
  const risk = Math.abs(m.entry - m.stop); if (risk === 0) return null;
  return m.hypothetical === 'loss' ? -1 : Math.abs(m.target - m.entry) / risk;
}
export const wasCorrect = (m: MissedOpportunity) => m.correctDecision ?? (m.hypothetical === 'loss' ? true : m.hypothetical === 'win' ? false : undefined);
export function missedStats(ms: MissedOpportunity[]) {
  const reasons = new Map<string, number>();
  for (const m of ms) if (m.reason) reasons.set(m.reason, (reasons.get(m.reason) ?? 0) + 1);
  const rs = ms.map(hypotheticalR).filter((x): x is number => x !== null);
  return { total: ms.length, avoidedLoss: ms.filter(m => wasCorrect(m) === true).length, missedWin: ms.filter(m => wasCorrect(m) === false).length,
    undecided: ms.filter(m => wasCorrect(m) === undefined).length, hypotheticalNetR: rs.reduce((a, b) => a + b, 0), withR: rs.length,
    topReasons: [...reasons].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })) };
}
