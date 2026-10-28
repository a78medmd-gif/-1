import { useMemo, useState } from 'react';
import { outcome } from '../engine/calc.ts';
import type { Trade } from '../engine/types.ts';
import TradeImages from '../images/TradeImages.tsx';

export default function Trades({ trades, onEdit, onDelete }: { trades: Trade[]; onEdit: (t: Trade) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState(''); const [res, setRes] = useState(''); const [sort, setSort] = useState('date'); const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => trades.filter(t => !t.isExample)
    .filter(t => !q || (t.instrument ?? '').toLowerCase().includes(q.toLowerCase()))
    .filter(t => !res || outcome(t) === res)
    .sort((a, b) => sort === 'pnl' ? (b.pnl ?? -1e9) - (a.pnl ?? -1e9) : b.entryAt.localeCompare(a.entryAt)), [trades, q, res, sort]);
  return <>
    <h2>الصفقات ({rows.length})</h2>
    <div className="form">
      <input placeholder="بحث بالأداة" value={q} onChange={e => setQ(e.target.value)} />
      <select value={res} onChange={e => setRes(e.target.value)}><option value="">كل النتائج</option><option value="win">رابحة</option><option value="loss">خاسرة</option><option value="breakeven">متعادلة</option><option value="open">مفتوحة</option></select>
      <select value={sort} onChange={e => setSort(e.target.value)}><option value="date">الأحدث</option><option value="pnl">الأكثر ربحًا</option></select>
    </div>
    {rows.length === 0 && <p className="k">لا توجد صفقات بعد.</p>}
    {rows.map(t => <div className="card" key={t.id} style={{ marginTop: 8 }}>
      <div className="row"><b>{t.instrument ?? '—'} · {t.side === 'buy' ? 'شراء' : 'بيع'}</b>
        <span className={t.pnl === undefined ? '' : t.pnl >= 0 ? 'pos' : 'neg'}>{t.pnl === undefined ? 'مفتوحة' : t.pnl.toFixed(2) + ' $'}</span></div>
      <div className="k">{t.entryAt.slice(0, 16).replace('T', ' ')} · {t.followedRules === undefined ? '' : t.followedRules ? 'ملتزم' : 'غير ملتزم'}</div>
      <div className="row" style={{ marginTop: 8 }}><button className="btn g" onClick={() => onEdit(t)}>تعديل</button><button className="btn g" onClick={() => setOpen(open === t.id ? null : t.id)}>الصور</button>
        <button className="btn d" onClick={() => { if (confirm('حذف هذه الصفقة وصورها نهائيًا؟')) onDelete(t.id); }}>حذف</button></div>
      {open === t.id && <TradeImages tradeId={t.id} />}
    </div>)}
  </>;
}
