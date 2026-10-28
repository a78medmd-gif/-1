import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { computeStats } from '../engine/calc.ts';
import { applyFilters, monthlyNet, pnlHistogram, type Filters } from '../engine/analytics.ts';
import type { AppSettings } from '../db/db.ts';
import type { Trade } from '../engine/types.ts';
import FilterBar from './FilterBar.tsx';

const Box = ({ title, children }: { title: string; children: React.ReactElement }) =>
  <div className="card" style={{ marginTop: 10 }}><b>{title}</b><div style={{ height: 220, marginTop: 6 }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>;

export default function ChartsPage({ trades, settings }: { trades: Trade[]; settings: AppSettings }) {
  const [f, setF] = useState<Filters>({}); const tz = settings.timeZone;
  const d = useMemo(() => {
    const ts = applyFilters(trades, f, tz), s = computeStats(ts, settings.initialBalance);
    const eq = [{ i: 0, balance: settings.initialBalance, dd: 0 }, ...s.curve.map((p, i) => ({ i: i + 1, balance: +p.balance.toFixed(2), dd: -+p.ddUsd.toFixed(2) }))];
    const adh = (v: boolean) => ts.filter(t => !t.isExample && t.pnl !== undefined && t.followedRules === v).reduce((a, t) => a + t.pnl!, 0);
    return { eq, s, monthly: monthlyNet(ts, tz), hist: pnlHistogram(ts).map(b => ({ range: `${b.from.toFixed(1)}…${b.to.toFixed(1)}`, count: b.count })),
      adh: [{ name: 'ملتزم', net: +adh(true).toFixed(2) }, { name: 'غير ملتزم', net: +adh(false).toFixed(2) }],
      wl: [{ name: 'متوسط الربح', v: s.avgWin ?? 0 }, { name: 'متوسط الخسارة', v: Math.abs(s.avgLoss ?? 0) }] };
  }, [trades, f, tz, settings.initialBalance]);
  if (d.s.completed === 0) return <><h2>الرسوم البيانية</h2><FilterBar f={f} setF={setF} settings={settings} /><p className="k">لا توجد صفقات مكتملة ضمن هذه الفلاتر.</p></>;
  return <>
    <h2>الرسوم البيانية ({d.s.completed} صفقة)</h2><FilterBar f={f} setF={setF} settings={settings} />
    <Box title="منحنى الرصيد"><AreaChart data={d.eq}><CartesianGrid strokeOpacity={0.15} /><XAxis dataKey="i" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Area dataKey="balance" stroke="#3b82f6" fill="#3b82f633" /></AreaChart></Box>
    <Box title="التراجع (Drawdown $)"><AreaChart data={d.eq}><CartesianGrid strokeOpacity={0.15} /><XAxis dataKey="i" /><YAxis /><Tooltip /><Area dataKey="dd" stroke="#ef4444" fill="#ef444433" /></AreaChart></Box>
    <Box title="النتيجة حسب الشهر"><BarChart data={d.monthly}><CartesianGrid strokeOpacity={0.15} /><XAxis dataKey="month" /><YAxis /><Tooltip /><ReferenceLine y={0} /><Bar dataKey="net" fill="#22c55e" /></BarChart></Box>
    <Box title="توزيع الأرباح والخسائر"><BarChart data={d.hist}><CartesianGrid strokeOpacity={0.15} /><XAxis dataKey="range" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#3b82f6" /></BarChart></Box>
    <Box title="ملتزم مقابل غير ملتزم (صافي $)"><BarChart data={d.adh}><CartesianGrid strokeOpacity={0.15} /><XAxis dataKey="name" /><YAxis /><Tooltip /><ReferenceLine y={0} /><Bar dataKey="net" fill="#3b82f6" /></BarChart></Box>
    <Box title="متوسط الربح مقابل متوسط الخسارة"><BarChart data={d.wl}><CartesianGrid strokeOpacity={0.15} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="v" fill="#8a99b3" /></BarChart></Box>
    <p className="k">سلاسل الأرباح والخسائر: أطول ربح {d.s.maxWinStreak}، أطول خسارة {d.s.maxLossStreak}. كل الصفقات مشمولة بلا حد 100.</p>
  </>;
}
