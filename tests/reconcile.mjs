// Usage: node --experimental-strip-types tests/reconcile.mjs trades.json excel.json   (prints a comparison table)
import { readFileSync } from 'node:fs';
import { computeStats } from '../src/engine/calc.ts';
const T = JSON.parse(readFileSync(process.argv[2], 'utf8')), X = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const trades = T.map((t, i) => ({ id: String(i), entryAt: `${t[0]}T10:00:00Z`, closedAt: `${t[0]}T11:00:${String(i).padStart(2, '0')}Z`, side: t[3] === 'شراء' ? 'buy' : 'sell',
  riskPct: t[9], pnl: t[14], followedRules: t[12] === 'نعم', checklistScore: t[11] }));
const s = computeStats(trades, 30);
const adh = v => trades.filter(t => t.followedRules === v).reduce((a, t) => a + t.pnl, 0);
const rows = [['عدد الصفقات', 'عدد الصفقات', s.completed], ['الرابحة', 'الصفقات الرابحة', s.wins], ['الخاسرة', 'الصفقات الخاسرة', s.losses], ['نسبة النجاح', 'نسبة النجاح', s.winRate / 100],
  ['صافي', 'صافي الربح/الخسارة ($)', s.net], ['الرصيد', 'الرصيد الحالي ($)', s.balance], ['النمو', 'نسبة النمو', s.growthPct / 100], ['متوسط الربح', 'متوسط الربح ($)', s.avgWin], ['متوسط الخسارة', 'متوسط الخسارة ($)', s.avgLoss],
  ['ربح/خسارة', 'نسبة متوسط الربح للخسارة', s.payoff], ['PF', 'Profit Factor (إجمالي الأرباح ÷ إجمالي الخسائر)', s.profitFactor], ['Expectancy', 'متوسط الربح لكل صفقة ($)', s.expectancy],
  ['متوسط R', 'متوسط النتيجة لكل صفقة (R)', s.avgR], ['أقصى تراجع $', 'أقصى تراجع ($)', s.maxDdUsd], ['أقصى تراجع %', 'أقصى تراجع (%)', s.maxDdPct / 100],
  ['سلسلة ربح', 'أطول سلسلة ربح', s.maxWinStreak], ['سلسلة خسارة', 'أطول سلسلة خسارة', s.maxLossStreak], ['أفضل', 'أفضل صفقة ($)', s.best], ['أسوأ', 'أسوأ صفقة ($)', s.worst],
  ['صافي ملتزم', 'صافي ربح الصفقات الملتزمة بالشروط ($)', adh(true)], ['صافي غير ملتزم', 'صافي ربح الصفقات غير الملتزمة ($)', adh(false)]];
let bad = 0;
for (const [n, k, v] of rows) { const e = X[k], ok = Math.abs(e - v) < 1e-9; if (!ok) bad++; console.log(`${ok ? 'OK ' : 'DIFF'} | ${n} | excel=${e} | app=${v}`); }
console.log('mismatches:', bad);
