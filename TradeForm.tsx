import { useState } from 'react';
import { alerts, plannedRR } from '../engine/calc.ts';
import { localDay } from '../engine/analytics.ts';
import { newId, type AppSettings } from '../db/db.ts';
import { decide } from '../engine/policy.ts';
import { checklistItems, evaluate, snapshot, type Answer } from '../engine/checklist.ts';
import ChecklistForm from './ChecklistForm.tsx';
import type { Trade } from '../engine/types.ts';

const num = (v: string) => (v === '' ? undefined : Number(v));
export default function TradeForm({ initial, trades, settings, onSave, preset }: { initial?: Trade; trades: Trade[]; settings: AppSettings; onSave: (t: Trade) => void; preset?: (Answer | undefined)[] }) {
  const [answers, setAnswers] = useState<(Answer | undefined)[]>(initial?.checklist?.answers ?? preset ?? []);
  const [t, setT] = useState<Trade>(initial ?? { id: newId(), entryAt: new Date().toISOString().slice(0, 16), side: 'buy', source: 'manual' });
  const set = (p: Partial<Trade>) => setT({ ...t, ...p });
  const L = settings.lists, rr = plannedRR(t);
  const day = (iso: string) => localDay(iso.length === 16 ? new Date(iso).toISOString() : iso, settings.timeZone);
  const touched = answers.some(a => a !== undefined), ev = evaluate(answers, settings.rules, settings.allowNA);
  const eff: Trade = touched ? { ...t, checklistScore: ev.score } : t;
  const al = alerts(eff, trades, settings.rules, day), dec = decide(al, settings.policies);
  const bad = t.entry !== undefined && t.stop !== undefined && t.target !== undefined && (t.side === 'buy' ? !(t.stop < t.entry && t.target > t.entry) : !(t.stop > t.entry && t.target < t.entry));
  const sel = (label: string, key: keyof Trade, opts: string[]) =>
    <label>{label}<select value={(t[key] as string) ?? ''} onChange={e => set({ [key]: e.target.value || undefined })}><option value="">—</option>{opts.map(o => <option key={o}>{o}</option>)}</select></label>;
  const n = (label: string, key: keyof Trade, step = 'any') =>
    <label>{label}<input type="number" step={step} value={(t[key] as number | undefined) ?? ''} onChange={e => set({ [key]: num(e.target.value) })} /></label>;
  return <>
    <h2>{initial ? 'تعديل صفقة' : 'إضافة صفقة'}</h2>
    <div className="form">
      {sel('الأداة', 'instrument', L.instruments)}
      <label>النوع<select value={t.side} onChange={e => set({ side: e.target.value as 'buy' | 'sell' })}><option value="buy">شراء</option><option value="sell">بيع</option></select></label>
      <label>وقت الدخول<input type="datetime-local" value={t.entryAt.slice(0, 16)} onChange={e => set({ entryAt: e.target.value })} /></label>
      <label>وقت الخروج<input type="datetime-local" value={t.closedAt?.slice(0, 16) ?? ''} onChange={e => set({ closedAt: e.target.value || undefined })} /></label>
      {sel('الجلسة', 'session', L.sessions)}{sel('الاستراتيجية', 'strategy', L.strategies)}
      {n('سعر الدخول', 'entry')}{n('وقف الخسارة', 'stop')}{n('الهدف', 'target')}{n('حجم اللوت', 'lots', '0.01')}
      {n('المخاطرة (كسر، 0.015 = 1.5%)', 'riskPct')}{n('العمولة', 'commission')}{n('السواب', 'swap')}
      {n('درجة القائمة (0-10)', 'checklistScore', '1')}
      <label>التزمت بالشروط؟<select value={t.followedRules === undefined ? '' : t.followedRules ? 'y' : 'n'} onChange={e => set({ followedRules: e.target.value === '' ? undefined : e.target.value === 'y' })}><option value="">—</option><option value="y">نعم</option><option value="n">لا</option></select></label>
      {sel('الحالة النفسية', 'mood', L.moods)}{sel('سبب الخروج', 'exitReason', L.exitReasons)}
      {n('النتيجة الفعلية $ (اتركها فارغة للصفقة المفتوحة)', 'pnl')}
      <label>سبب الدخول<textarea value={t.entryReason ?? ''} onChange={e => set({ entryReason: e.target.value })} /></label>
      <label>الدرس المستفاد<textarea value={t.lesson ?? ''} onChange={e => set({ lesson: e.target.value })} /></label>
    </div>
    <div className="card" style={{ marginTop: 10 }}>R:R المخطط: <b>{rr === null ? 'غير متاح' : rr.toFixed(2)}</b></div>
    {bad && <div className="warn">الوقف/الهدف غير منطقيين لاتجاه الصفقة. يمكنك الحفظ لكن راجع الأسعار.</div>}
    <h2>قائمة الشروط</h2><ChecklistForm items={checklistItems(settings.rules)} answers={answers} setAnswers={setAnswers} rules={settings.rules} allowNA={settings.allowNA} />
    {dec.block.map(a => <div className="warn" key={a}>ممنوع الحفظ حسب سياستك: {a}</div>)}{dec.confirm.map(a => <div className="warn" key={a}>سيُطلب تأكيد: {a}</div>)}{dec.warn.map(a => <div className="warn" key={a}>تنبيه: {a}</div>)}
    <button className="btn" style={{ marginTop: 10 }} disabled={!t.instrument || !dec.canSave} onClick={() => {
      if (dec.confirm.length && !confirm('مخالفات: ' + dec.confirm.join('، ') + '\nهل تريد الحفظ رغم ذلك؟')) return;
      onSave({ ...eff, entryAt: new Date(t.entryAt).toISOString(), closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : undefined,
        checklist: touched ? (initial?.checklist && JSON.stringify(initial.checklist.answers) === JSON.stringify(answers) ? initial.checklist : snapshot(answers, settings.rules, settings.allowNA)) : undefined,
        rulesAtEntry: initial?.rulesAtEntry ?? { ...settings.rules, policies: settings.policies } });
    }}>حفظ</button>
    <p className="k">التطبيق يحذّرك فقط؛ لا يستطيع منع تنفيذ الصفقات على MT5.</p>
  </>;
}
