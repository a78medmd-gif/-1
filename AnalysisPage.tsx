import { useEffect, useMemo, useState } from 'react';
import { analyze, insights, type Dim, type Filters } from '../engine/analytics.ts';
import { listAllImages, type AppSettings } from '../db/db.ts';
import type { Trade } from '../engine/types.ts';
import FilterBar from './FilterBar.tsx';

const DIMS: [Dim, string][] = [['instrument', 'الأداة'], ['session', 'الجلسة'], ['strategy', 'الاستراتيجية'], ['mood', 'الحالة النفسية'], ['weekday', 'يوم الأسبوع'], ['month', 'الشهر'],
  ['timeframe', 'الإطار الزمني'], ['side', 'نوع الصفقة'], ['checklist', 'درجة القائمة'], ['exitReason', 'سبب الخروج'], ['followed', 'الالتزام بالقواعد'], ['hasBeforeImage', 'صورة قبل الدخول']];
const n = (v: number | null, d = 2) => (v === null ? '—' : v.toFixed(d));

export default function AnalysisPage({ trades, settings }: { trades: Trade[]; settings: AppSettings }) {
  const [f, setF] = useState<Filters>({}); const [byTrade, setBy] = useState<Record<string, string[]>>({});
  useEffect(() => { listAllImages().then(xs => { const m: Record<string, string[]> = {}; xs.forEach(i => (m[i.tradeId] ??= []).push(i.kind)); setBy(m); }); }, [trades]);
  const tz = settings.timeZone;
  const tables = useMemo(() => DIMS.map(([d, label]) => ({ d, label, rows: analyze(trades, settings.initialBalance, d, f, tz, byTrade) })), [trades, settings.initialBalance, f, tz, byTrade]);
  const notes = tables.filter(t => ['strategy', 'session', 'instrument', 'followed'].includes(t.d)).flatMap(t => insights(t.rows, t.label));
  return <>
    <h2>التحليل</h2><FilterBar f={f} setF={setF} settings={settings} />
    {notes.length > 0 && <div className="card" style={{ marginTop: 10 }}><b>قراءة سريعة</b>{notes.map(x => <div className="k" key={x}>{x}</div>)}</div>}
    {tables.map(t => <div key={t.d}><h2>حسب {t.label}</h2>
      {t.rows.length === 0 ? <p className="k">لا توجد بيانات.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr className="k">{['البند', 'الصفقات', 'النجاح %', 'الصافي $', 'متوسط R', 'PF'].map(h => <th key={h} style={{ textAlign: 'start', padding: 4 }}>{h}</th>)}</tr></thead>
        <tbody>{t.rows.map(r => <tr key={r.key} style={{ borderTop: '1px solid var(--line)' }}>
          <td style={{ padding: 4 }}>{r.key}{r.lowSample && <span className="k"> (عينة صغيرة)</span>}</td><td>{r.trades}</td><td>{n(r.winRate, 0)}</td>
          <td className={r.net >= 0 ? 'pos' : 'neg'}>{n(r.net)}</td><td>{n(r.avgR)}</td><td>{r.profitFactor === 'no_losses' ? 'لا خسائر' : n(r.profitFactor as number | null)}</td></tr>)}</tbody></table></div>}
    </div>)}
  </>;
}
