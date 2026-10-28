import type { RiskRules } from './calc.ts';
import type { ChecklistSnapshot } from './types.ts';
export type Answer = 'yes' | 'no' | 'na';

/** The 10 original conditions; numbers come from the user's settings, not hard-coded text. */
export const checklistItems = (r: RiskRules): string[] => [
  'الاتجاه العام على الفريم الأكبر واضح والصفقة معه',
  'السعر عند مستوى دعم أو مقاومة مهم',
  'توجد إشارة دخول واضحة وفق الاستراتيجية',
  'تم تحديد وقف الخسارة قبل الدخول',
  `تم تحديد الهدف ونسبة R:R لا تقل عن 1:${r.minRR}`,
  `المخاطرة لا تتجاوز ${(r.maxRiskPct * 100).toFixed(1).replace(/\.0$/, '')}% من الرصيد`,
  'لا توجد أخبار قوية خلال 30 دقيقة (تحقق منها بنفسك)',
  'السبريد طبيعي وليس مرتفعًا (تحقق منه بنفسك)',
  'لا توجد صفقة انتقامية ولا دخول بسبب FOMO',
  `عدد صفقات اليوم أقل من ${r.maxDailyTrades}`,
];
export interface Evaluation { score: number; failed: number[]; unanswered: number; verdict: 'enter' | 'dont' | 'incomplete' }
export function evaluate(answers: (Answer | undefined)[], r: RiskRules, allowNA = false): Evaluation {
  const a = Array.from({ length: 10 }, (_, i) => answers[i]);
  const score = a.filter(x => x === 'yes').length, nas = a.filter(x => x === 'na').length, unanswered = a.filter(x => x === undefined).length;
  const failed = a.flatMap((x, i) => (x === 'no' || (x === 'na' && !allowNA) ? [i + 1] : []));
  const verdict = failed.length ? 'dont' : unanswered ? 'incomplete' : score + nas >= r.minChecklist ? 'enter' : 'dont';
  return { score, failed, unanswered, verdict };
}
export const snapshot = (answers: (Answer | undefined)[], r: RiskRules, allowNA: boolean, now = new Date()): ChecklistSnapshot => {
  const e = evaluate(answers, r, allowNA);
  return { at: now.toISOString(), answers: Array.from({ length: 10 }, (_, i) => answers[i]), score: e.score, failed: e.failed, texts: checklistItems(r), minScore: r.minChecklist };
};
