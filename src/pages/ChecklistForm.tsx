import { evaluate, type Answer } from '../engine/checklist.ts';
import type { RiskRules } from '../engine/calc.ts';

export default function ChecklistForm({ items, answers, setAnswers, rules, allowNA }: { items: string[]; answers: (Answer | undefined)[]; setAnswers: (a: (Answer | undefined)[]) => void; rules: RiskRules; allowNA: boolean }) {
  const e = evaluate(answers, rules, allowNA);
  return <div className="card">
    {items.map((txt, i) => <div key={i} className="row" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ flex: 1, minWidth: 200 }}>{i + 1}. {txt}</span>
      <select style={{ width: 110 }} value={answers[i] ?? ''} onChange={ev => { const a = [...answers]; a[i] = (ev.target.value || undefined) as Answer | undefined; setAnswers(a); }}>
        <option value="">—</option><option value="yes">نعم</option><option value="no">لا</option>{allowNA && <option value="na">غير منطبق</option>}</select></div>)}
    <div className={e.verdict === 'enter' ? 'pos' : e.verdict === 'dont' ? 'neg' : 'k'} style={{ marginTop: 8, fontWeight: 700 }}>
      الدرجة {e.score}/10 · {e.verdict === 'enter' ? 'استوفيت الشروط' : e.verdict === 'dont' ? `لا تدخل. غير مستوفى: ${e.failed.join('، ')}` : `ناقصة (${e.unanswered} بلا إجابة)`}</div>
    <p className="k">الأخبار والسبريد تتحقق منهما أنت؛ التطبيق غير متصل بمصدر بيانات.</p>
  </div>;
}
