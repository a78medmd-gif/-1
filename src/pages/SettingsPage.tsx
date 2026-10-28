import { useState } from 'react';
import type { AppSettings } from '../db/db.ts';
import type { Mode } from '../engine/policy.ts';

const RULE_LABEL: Record<string, string> = { risk: 'تجاوز المخاطرة القصوى', rr: 'R:R أقل من الحد', checklist: 'قائمة الشروط ناقصة', daily: 'تجاوز حد الصفقات اليومي', losses: 'الدخول بعد خسارتين متتاليتين', mood: 'حالة نفسية خطرة' };
const LISTS: [keyof AppSettings['lists'], string][] = [['instruments', 'الأدوات'], ['sessions', 'الجلسات'], ['strategies', 'الاستراتيجيات'], ['moods', 'الحالات النفسية'], ['exitReasons', 'أسباب الخروج']];

export default function SettingsPage({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => Promise<void> }) {
  const [s, setS] = useState(settings); const [msg, setMsg] = useState(''); const r = s.rules;
  const rule = (label: string, key: 'maxRiskPct' | 'maxDailyTrades' | 'minRR' | 'minChecklist' | 'consecutiveLossStop', step = 'any') =>
    <label>{label}<input type="number" step={step} value={r[key]} onChange={e => setS({ ...s, rules: { ...r, [key]: Number(e.target.value) } })} /></label>;
  const tzOk = (() => { try { new Intl.DateTimeFormat('en', { timeZone: s.timeZone }); return true; } catch { return false; } })();
  return <>
    <h2>الإعدادات</h2>
    <div className="form">
      <label>الرصيد المبدئي<input type="number" value={s.initialBalance} onChange={e => setS({ ...s, initialBalance: Number(e.target.value) })} /></label>
      <label>العملة<input value={s.currency} onChange={e => setS({ ...s, currency: e.target.value })} /></label>
      <label>المنطقة الزمنية (IANA)<input value={s.timeZone} onChange={e => setS({ ...s, timeZone: e.target.value })} /></label>
      {rule('أقصى مخاطرة للصفقة (0.02 = 2%)', 'maxRiskPct')}{rule('أقصى صفقات يوميًا', 'maxDailyTrades', '1')}
      {rule('أدنى R:R', 'minRR')}{rule('أدنى درجة للقائمة', 'minChecklist', '1')}{rule('خسائر متتالية للتوقف', 'consecutiveLossStop', '1')}
    </div>
    {!tzOk && <div className="warn">المنطقة الزمنية غير صالحة (مثال: Asia/Riyadh).</div>}
    {s.initialBalance <= 0 && <div className="warn">الرصيد المبدئي صفر أو سالب: نسبة النمو لن تُحسب.</div>}
    <label style={{ marginTop: 8 }}><input type="checkbox" style={{ width: 'auto' }} checked={s.allowNA} onChange={e => setS({ ...s, allowNA: e.target.checked })} /> السماح بـ «غير منطبق» في قائمة الشروط</label>
    <h2>سياسة كل قاعدة</h2>
    <div className="form">{Object.keys(RULE_LABEL).map(k => <label key={k}>{RULE_LABEL[k]}
      <select value={s.policies[k] ?? 'warn'} onChange={e => setS({ ...s, policies: { ...s.policies, [k]: e.target.value as Mode } })}><option value="warn">تحذير فقط</option><option value="confirm">طلب تأكيد</option><option value="block">منع الحفظ في التطبيق</option></select></label>)}</div>
    <p className="k">المنع يسري داخل التطبيق فقط؛ لا يستطيع التطبيق منع تنفيذ الصفقات على MT5.</p>
    <h2>القوائم (عنصر في كل سطر)</h2>
    <div className="form">{LISTS.map(([k, l]) => <label key={k}>{l}<textarea rows={6} value={s.lists[k].join('\n')} onChange={e => setS({ ...s, lists: { ...s.lists, [k]: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) } })} /></label>)}</div>
    <label>الحالات التي تُعدّ خطرة (سطر لكل حالة)<textarea rows={4} value={r.riskyMoods.join('\n')} onChange={e => setS({ ...s, rules: { ...r, riskyMoods: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) } })} /></label>
    <p className="k">تغيير القواعد لا يعيد حساب الصفقات القديمة؛ كل صفقة تحفظ القواعد وقت إدخالها.</p>
    <button className="btn" disabled={!tzOk} onClick={async () => { await onSave(s); setMsg('تم الحفظ'); }}>حفظ</button> {msg}
  </>;
}
