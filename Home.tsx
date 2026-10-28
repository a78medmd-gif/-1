import { computeStats } from '../engine/calc.ts';
import type { Trade } from '../engine/types.ts';
import type { AppSettings } from '../db/db.ts';

const f = (n: number | null, d = 2) => (n === null ? 'غير متاح' : n.toFixed(d));
const Card = ({ k, v, tone }: { k: string; v: string; tone?: number | null }) =>
  <div className="card"><div className="k">{k}</div><div className={'v ' + (tone ? (tone > 0 ? 'pos' : 'neg') : '')}>{v}</div></div>;

export default function Home({ trades, settings }: { trades: Trade[]; settings: AppSettings }) {
  const s = computeStats(trades, settings.initialBalance);
  const real = trades.filter(t => !t.isExample);
  const followed = real.filter(t => t.pnl !== undefined && t.followedRules === true).reduce((a, t) => a + t.pnl!, 0);
  const broke = real.filter(t => t.pnl !== undefined && t.followedRules === false).reduce((a, t) => a + t.pnl!, 0);
  const pf = s.profitFactor === 'no_losses' ? 'لا خسائر في العينة' : f(s.profitFactor);
  return <>
    <h2>الحساب</h2>
    <div className="grid">
      <Card k="الرصيد المبدئي" v={f(settings.initialBalance)} />
      <Card k="الرصيد الحالي" v={f(s.balance)} />
      <Card k="صافي الربح/الخسارة" v={f(s.net)} tone={s.net} />
      <Card k="نسبة النمو %" v={f(s.growthPct)} tone={s.growthPct} />
      <Card k="صفقات مكتملة" v={String(s.completed)} />
      <Card k="رابحة / خاسرة / متعادلة" v={`${s.wins} / ${s.losses} / ${s.breakeven}`} />
      <Card k="مفتوحة" v={String(s.open)} />
      <Card k="نسبة النجاح %" v={f(s.winRate, 1)} />
    </div>
    <h2>مؤشرات الأداء</h2>
    <div className="grid">
      <Card k="متوسط الربح $" v={f(s.avgWin)} /><Card k="متوسط الخسارة $" v={f(s.avgLoss)} />
      <Card k="متوسط الربح ÷ الخسارة" v={f(s.payoff)} /><Card k="Profit Factor" v={pf} />
      <Card k="Expectancy $/صفقة" v={f(s.expectancy)} /><Card k="متوسط R" v={f(s.avgR)} />
      <Card k="أقصى Drawdown $" v={f(s.maxDdUsd)} /><Card k="أقصى Drawdown %" v={f(s.maxDdPct)} />
      <Card k="أطول سلسلة ربح" v={String(s.maxWinStreak)} /><Card k="أطول سلسلة خسارة" v={String(s.maxLossStreak)} />
      <Card k="أفضل صفقة" v={f(s.best)} /><Card k="أسوأ صفقة" v={f(s.worst)} />
    </div>
    <h2>الانضباط</h2>
    <div className="grid">
      <Card k="صافي الصفقات الملتزمة" v={f(followed)} tone={followed} />
      <Card k="صافي غير الملتزمة" v={f(broke)} tone={broke} />
    </div>
    {s.completed < 30 && <p className="k">العينة صغيرة ({s.completed} صفقة): لا تبنِ استنتاجات على هذه الأرقام.</p>}
  </>;
}
