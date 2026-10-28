import { useEffect, useState } from 'react';
import { listMissed, saveMissed, deleteMissed, newId, type AppSettings } from '../db/db.ts';
import { hypotheticalR, missedStats, wasCorrect } from '../engine/missed.ts';
import type { MissedOpportunity } from '../engine/types.ts';

const blank = (): MissedOpportunity => ({ id: newId(), date: new Date().toISOString().slice(0, 10), instrument: '', reason: '', source: 'manual' });
export default function MissedPage({ settings }: { settings: AppSettings }) {
  const [list, setList] = useState<MissedOpportunity[]>([]); const [m, setM] = useState<MissedOpportunity>(blank()); const [err, setErr] = useState('');
  const load = async () => setList((await listMissed()).sort((a, b) => b.date.localeCompare(a.date)));
  useEffect(() => { load(); }, []);
  const st = missedStats(list), L = settings.lists;
  const n = (k: 'entry' | 'stop' | 'target', label: string) => <label>{label}<input type="number" step="any" value={m[k] ?? ''} onChange={e => setM({ ...m, [k]: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>;
  return <>
    <h2>الفرص الفائتة</h2>
    <div className="card"><div className="k">نتائج افتراضية فقط — لا تدخل في الرصيد ولا في الصافي الحقيقي.</div>
      <div className="grid"><div><div className="k">الإجمالي</div><b>{st.total}</b></div><div><div className="k">تجنبت خسارة</div><b className="pos">{st.avoidedLoss}</b></div><div><div className="k">فاتتك أرباح</div><b className="neg">{st.missedWin}</b></div>
        <div><div className="k">صافي R افتراضي ({st.withR} فرصة)</div><b>{st.hypotheticalNetR.toFixed(2)}</b></div></div>
      {st.topReasons.slice(0, 3).map(r => <div className="k" key={r.reason}>سبب متكرر: {r.reason} ({r.count})</div>)}</div>
    <h2>تسجيل فرصة</h2>
    <div className="form">
      <label>التاريخ<input type="date" value={m.date} onChange={e => setM({ ...m, date: e.target.value })} /></label>
      <label>الأداة<select value={m.instrument} onChange={e => setM({ ...m, instrument: e.target.value })}><option value="">—</option>{L.instruments.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>الاستراتيجية<select value={m.strategy ?? ''} onChange={e => setM({ ...m, strategy: e.target.value || undefined })}><option value="">—</option>{L.strategies.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>الاتجاه المتوقع<select value={m.direction ?? ''} onChange={e => setM({ ...m, direction: (e.target.value || undefined) as 'buy' | 'sell' | undefined })}><option value="">—</option><option value="buy">شراء</option><option value="sell">بيع</option></select></label>
      {n('entry', 'الدخول الافتراضي')}{n('stop', 'الوقف')}{n('target', 'الهدف')}
      <label>سبب التردد<input value={m.reason} onChange={e => setM({ ...m, reason: e.target.value })} /></label>
      <label>لو دخلت<select value={m.hypothetical ?? ''} onChange={e => setM({ ...m, hypothetical: (e.target.value || undefined) as 'win' | 'loss' | undefined })}><option value="">لم تُحدد</option><option value="win">ربح</option><option value="loss">خسارة</option></select></label>
      <label>هل عدم الدخول قرار صحيح؟<select value={m.correctDecision === undefined ? '' : m.correctDecision ? 'y' : 'n'} onChange={e => setM({ ...m, correctDecision: e.target.value === '' ? undefined : e.target.value === 'y' })}><option value="">تلقائي من النتيجة</option><option value="y">نعم</option><option value="n">لا</option></select></label>
      <label>ملاحظات<textarea value={m.notes ?? ''} onChange={e => setM({ ...m, notes: e.target.value })} /></label>
    </div>
    {err && <div className="warn">{err}</div>}
    <button className="btn" style={{ marginTop: 8 }} onClick={async () => { if (!m.instrument) return setErr('اختر الأداة'); setErr(''); await saveMissed(m); setM(blank()); await load(); }}>حفظ</button>
    {list.map(x => { const r = hypotheticalR(x), c = wasCorrect(x); return <div className="card" key={x.id} style={{ marginTop: 8 }}>
      <div className="row"><b>{x.date} · {x.instrument}</b><span className={c === true ? 'pos' : c === false ? 'neg' : 'k'}>{c === true ? 'قرار صح' : c === false ? 'فرصة فاتت' : 'غير محدد'}</span></div>
      <div className="k">{x.reason}{r !== null ? ` · ${r.toFixed(2)}R (افتراضي)` : ''}{x.source === 'import' ? ' · مستورد' : ''}</div>
      <div className="row"><button className="btn g" onClick={() => setM(x)}>تعديل</button><button className="btn d" onClick={async () => { if (confirm('حذف هذه الفرصة؟')) { await deleteMissed(x.id); await load(); } }}>حذف</button></div></div>; })}
    <p className="k">صور الشارت للفرص الفائتة غير منفّذة بعد.</p>
  </>;
}
