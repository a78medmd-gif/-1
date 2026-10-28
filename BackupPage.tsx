import { useState } from 'react';
import { buildBackup, validateBackup, planRestore, tradesToCsv, type Backup, type RestorePlan } from '../backup/backup.ts';
import { toRecord, fromRecord } from '../backup/blobs.ts';
import { listAllImages, listMissed, saveTrade, saveMissed, saveImage, getSettings, type AppSettings } from '../db/db.ts';
import type { Trade } from '../engine/types.ts';

function download(name: string, body: string, type: string) {
  const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([body], { type }));
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export default function BackupPage({ trades, onDone }: { trades: Trade[]; settings: AppSettings; onDone: () => Promise<void> }) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [withImages, setWithImages] = useState(true);
  const [msg, setMsg] = useState(''); const [plan, setPlan] = useState<{ b: Backup; p: RestorePlan } | null>(null); const [errs, setErrs] = useState<string[]>([]);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportJson = async () => {
    try {
      const images = withImages ? await Promise.all((await listAllImages()).map(toRecord)) : [];
      const b = await buildBackup({ trades, missed: await listMissed(), settings: await getSettings(), images }, { from: from || undefined, to: to || undefined, includeImages: withImages });
      download(`trading-journal-${stamp}.json`, JSON.stringify(b), 'application/json');
      setMsg(`تم إنشاء ملف النسخة (${b.counts.trades} صفقة، ${b.counts.images} صورة). هذا ملف محلي نزّلته بنفسك؛ لم يُرفع إلى أي سحابة.`);
    } catch (e) { setMsg('فشل التصدير: ' + (e as Error).message); }
  };
  const exportCsv = () => download(`trades-${stamp}.csv`, tradesToCsv(trades.filter(t => (!from || t.entryAt.slice(0, 10) >= from) && (!to || t.entryAt.slice(0, 10) <= to))), 'text/csv;charset=utf-8');
  const pick = async (f?: File) => {
    if (!f) return; setPlan(null); setErrs([]); setMsg('');
    if (f.size > 500 * 1024 * 1024) return setErrs(['الملف كبير جدًا']);
    const v = await validateBackup(await f.text());
    if (!v.ok) return setErrs(v.errors);
    setPlan({ b: v.backup, p: planRestore(v.backup, { tradeIds: new Set(trades.map(t => t.id)), missedIds: new Set((await listMissed()).map(m => m.id)), imageIds: new Set((await listAllImages()).map(i => i.id)) }) });
  };
  const restore = async () => {
    if (!plan) return;
    try {
      for (const t of plan.p.addTrades) await saveTrade(t);
      for (const m of plan.p.addMissed) await saveMissed(m);
      for (const i of plan.p.addImages) await saveImage(fromRecord(i));
      await onDone(); setMsg(`تمت الاستعادة: أُضيف ${plan.p.addTrades.length} صفقة و${plan.p.addImages.length} صورة. لم يُحذف أو يُعدَّل أي سجل موجود.`); setPlan(null);
    } catch (e) { setMsg('فشلت الاستعادة (قد تكون جزئية): ' + (e as Error).message); }
  };
  return <>
    <h2>النسخ الاحتياطي</h2>
    <div className="card"><b>تصدير</b>
      <div className="form"><label>من<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>إلى<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={withImages} onChange={e => setWithImages(e.target.checked)} /> تضمين الصور</label>
      <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={exportJson}>نسخة JSON كاملة</button><button className="btn g" onClick={exportCsv}>CSV للصفقات</button></div></div>
    <div className="card" style={{ marginTop: 10 }}><b>استعادة</b><br /><input type="file" accept=".json" onChange={e => pick(e.target.files?.[0])} />
      {errs.map(e => <div className="warn" key={e}>{e}</div>)}
      {plan && <><p>سيُضاف: {plan.p.addTrades.length} صفقة، {plan.p.addMissed.length} فرصة فائتة، {plan.p.addImages.length} صورة · موجود مسبقًا ويُتخطى: {plan.p.skipped.trades + plan.p.skipped.missed + plan.p.skipped.images}</p>
        <div className="row"><button className="btn" onClick={restore}>اعتماد الاستعادة</button><button className="btn g" onClick={() => setPlan(null)}>إلغاء</button></div></>}</div>
    {msg && <div className="card" style={{ marginTop: 10 }}>{msg}</div>}
    <p className="k">بياناتك الآن محفوظة داخل متصفح هذا الجهاز فقط. مسح بيانات الموقع أو حذف المتصفح يحذفها، فصدّر نسخة بانتظام. مزامنة Google Drive غير منفّذة.</p>
  </>;
}
