import type { Filters } from '../engine/analytics.ts';
import type { AppSettings } from '../db/db.ts';
export default function FilterBar({ f, setF, settings }: { f: Filters; setF: (f: Filters) => void; settings: AppSettings }) {
  const L = settings.lists;
  const sel = (label: string, key: keyof Filters, opts: [string, string][]) =>
    <label>{label}<select value={(f[key] as string) ?? ''} onChange={e => setF({ ...f, [key]: e.target.value || undefined })}><option value="">الكل</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  return <div className="form">
    <label>من<input type="date" value={f.from ?? ''} onChange={e => setF({ ...f, from: e.target.value || undefined })} /></label>
    <label>إلى<input type="date" value={f.to ?? ''} onChange={e => setF({ ...f, to: e.target.value || undefined })} /></label>
    {sel('الأداة', 'instrument', L.instruments.map(x => [x, x]))}{sel('الاستراتيجية', 'strategy', L.strategies.map(x => [x, x]))}
    {sel('الجلسة', 'session', L.sessions.map(x => [x, x]))}{sel('النوع', 'side', [['buy', 'شراء'], ['sell', 'بيع']])}
  </div>;
}
