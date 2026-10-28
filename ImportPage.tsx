import { useState } from 'react';
import { readWorkbook } from '../import/readWorkbook.ts';
import { parseJournal, parseMissed, parseSettings, type ParseResult } from '../import/parse.ts';
import { saveTrade, saveMissed, putSettings, listMissed, type AppSettings } from '../db/db.ts';
import type { Trade, MissedOpportunity } from '../engine/types.ts';

interface Preview { trades: ParseResult<Trade>; missed: ParseResult<MissedOpportunity>; settings: Partial<AppSettings>; missing: string[] }
const SHEETS = { journal: 'سجل الصفقات', missed: 'صفقات ترددت فيها', settings: 'الإعدادات', summary: 'الملخص' };

export default function ImportPage({ trades, settings, onDone }: { trades: Trade[]; settings: AppSettings; onDone: () => Promise<void> }) {
  const [p, setP] = useState<Preview | null>(null); const [msg, setMsg] = useState(''); const [useSettings, setUseSettings] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return; setMsg(''); setP(null);
    try {
      const s = await readWorkbook(f);
      const missing = Object.values(SHEETS).filter(n => !s[n]);
      setP({ missing,
        trades: parseJournal(s[SHEETS.journal] ?? [], trades),
        missed: parseMissed(s[SHEETS.missed] ?? [], await listMissed()),
        settings: parseSettings(s[SHEETS.settings] ?? [], settings, s[SHEETS.summary]?.[2]?.[1]) });
    } catch (e) { setMsg('فشل قراءة الملف: ' + (e as Error).message); }
  };
  const commit = async () => {
    if (!p) return;
    try {
      for (const t of p.trades.items) await saveTrade(t);
      for (const m of p.missed.items) await saveMissed(m);
      if (useSettings) await putSettings({ ...settings, ...p.settings } as AppSettings);
      await onDone(); setMsg(`تم الحفظ: ${p.trades.items.length} صفقة، ${p.missed.items.length} فرصة فائتة.`); setP(null);
    } catch (e) { setMsg('فشل الحفظ (لم يُعتمد الاستيراد بالكامل): ' + (e as Error).message); }
  };
  const part = (name: string, r: ParseResult<unknown>) => <div className="card"><b>{name}</b>
    <div>سيُستورد: {r.items.length} · مكرر: {r.duplicates} · مرفوض: {r.rejected.length}</div>
    {r.rejected.map(x => <div className="k" key={x.row}>صف {x.row}: {x.reason}</div>)}</div>;
  return <>
    <h2>استيراد من Excel</h2>
    <input type="file" accept=".xlsx" onChange={e => pick(e.target.files?.[0])} />
    {msg && <div className="warn">{msg}</div>}
    {p && <>
      {p.missing.length > 0 && <div className="warn">أوراق غير موجودة: {p.missing.join('، ')}</div>}
      {part('سجل الصفقات', p.trades)}{part('الفرص الفائتة', p.missed)}
      {p.trades.items.length + p.missed.items.length === 0 && <p className="k">لا توجد سجلات حقيقية في الملف (صف المثال يُستبعد دائمًا).</p>}
      <label><input type="checkbox" checked={useSettings} onChange={e => setUseSettings(e.target.checked)} style={{ width: 'auto' }} /> استبدال الإعدادات والقوائم بما في الملف (الرصيد {String(p.settings.initialBalance)})</label>
      <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={commit}>اعتماد الاستيراد</button><button className="btn g" onClick={() => setP(null)}>إلغاء</button></div>
    </>}
    <p className="k">لا يُنفَّذ أي كود من الملف. الصور غير مستوردة: الملف لا يحتوي روابط صور.</p>
  </>;
}
