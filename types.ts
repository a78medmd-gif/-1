export type Side = 'buy' | 'sell';
export interface Trade {
  id: string;
  isExample?: boolean;          // excluded from every calculation
  entryAt: string;              // ISO
  closedAt?: string;            // ISO; closing order drives balance/DD/streaks
  side: Side;
  entry?: number; stop?: number; target?: number;
  riskPct?: number;             // fraction, 0.015 = 1.5%
  pnl?: number;                 // actual USD result; undefined = open/unfinished
  followedRules?: boolean;
  checklistScore?: number;
  instrument?: string; session?: string; strategy?: string; timeframe?: string;
  lots?: number; commission?: number; swap?: number; slippage?: number;
  entryReason?: string; exitReason?: string; mood?: string; lesson?: string;
  source?: 'manual' | 'import'; createdAt?: string; updatedAt?: string;
  checklist?: ChecklistSnapshot;   // frozen at entry time
  rulesAtEntry?: Record<string, unknown>; // rules in force when the trade was saved
}
export type Outcome = 'win' | 'loss' | 'breakeven' | 'open';
export interface Point { id: string; balance: number; peak: number; ddUsd: number; ddPct: number; winStreak: number; lossStreak: number; r?: number }
export interface Stats {
  completed: number; wins: number; losses: number; breakeven: number; open: number;
  net: number; balance: number; growthPct: number | null; winRate: number | null;
  avgWin: number | null; avgLoss: number | null; payoff: number | null;
  profitFactor: number | 'no_losses' | null; expectancy: number | null; avgR: number | null;
  maxDdUsd: number; maxDdPct: number; maxWinStreak: number; maxLossStreak: number;
  best: number | null; worst: number | null; curve: Point[];
}
export interface MissedOpportunity {
  id: string; date: string; instrument: string; reason: string;
  hypothetical?: 'win' | 'loss'; notes?: string; source?: 'manual' | 'import';
  strategy?: string; direction?: 'buy' | 'sell'; entry?: number; stop?: number; target?: number;
  whyMissed?: string; correctDecision?: boolean;   // overrides the default (loss => correct)
}
export interface ChecklistSnapshot { at: string; answers: ('yes' | 'no' | 'na' | undefined)[]; score: number; failed: number[]; texts: string[]; minScore: number }
