export type Mode = 'warn' | 'confirm' | 'block';
export const ALERT_KEY: Record<string, string> = {
  'مخاطرة عالية': 'risk', 'R:R ضعيف': 'rr', 'قائمة ناقصة': 'checklist', 'تجاوز حد اليوم': 'daily',
  'دخول بعد خسارتين متتاليتين': 'losses', 'حالة نفسية خطرة': 'mood',
};
export const DEFAULT_POLICIES: Record<string, Mode> = { risk: 'warn', rr: 'warn', checklist: 'warn', daily: 'warn', losses: 'warn', mood: 'warn' };
export interface Decision { block: string[]; confirm: string[]; warn: string[]; canSave: boolean }
/** User-chosen policy per rule. Unknown alerts fall back to warn. The app never changes the user's policy itself. */
export function decide(alerts: string[], policies: Record<string, Mode>): Decision {
  const d: Decision = { block: [], confirm: [], warn: [], canSave: true };
  for (const a of alerts) (d[policies[ALERT_KEY[a]] ?? 'warn']).push(a);
  d.canSave = d.block.length === 0; return d;
}
