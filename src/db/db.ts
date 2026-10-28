// IndexedDB layer (no localStorage). Stores: trades, images (Blob kept OUT of the trade object), kv (settings).
import type { Trade } from '../engine/types.ts';
import { DEFAULT_RULES, type RiskRules } from '../engine/calc.ts';
import { DEFAULT_POLICIES, type Mode } from '../engine/policy.ts';

export interface TradeImage { id: string; tradeId: string; kind: 'before'|'during'|'after'|'other'; fileName: string; mime: string; size: number; addedAt: string; caption?: string; order: number; blob: Blob; annotations?: unknown }
export interface AppSettings { initialBalance: number; currency: string; timeZone: string; rules: RiskRules; policies: Record<string, Mode>; allowNA: boolean; lists: { instruments: string[]; sessions: string[]; strategies: string[]; moods: string[]; exitReasons: string[] } }

// Defaults taken from the Excel "الإعدادات" sheet; all editable in-app.
export const DEFAULT_SETTINGS: AppSettings = {
  initialBalance: 30, currency: 'USD', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, rules: DEFAULT_RULES, policies: DEFAULT_POLICIES, allowNA: false,
  lists: {
    instruments: ['XAUUSD','EURUSD','GBPUSD','USDJPY','GBPJPY','USDCAD','AUDUSD','BTCUSD'],
    sessions: ['آسيا','لندن','نيويورك','تداخل لندن/نيويورك'],
    strategies: ['ارتداد من دعم/مقاومة','كسر مستوى','متابعة اتجاه','انعكاس'],
    moods: ['واثق','هادي','متوتر','خايف يفوتني (FOMO)','انتقام','ملل','طمع'],
    exitReasons: ['هدف','وقف خسارة','خروج يدوي','تعادل'],
  },
};

let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('trading-journal', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('trades', { keyPath: 'id' });
      d.createObjectStore('missed', { keyPath: 'id' });
      d.createObjectStore('images', { keyPath: 'id' }).createIndex('tradeId', 'tradeId');
      d.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
const wrap = <T,>(rq: IDBRequest<T>) => new Promise<T>((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
async function store(name: string, mode: IDBTransactionMode = 'readonly') { return (await open()).transaction(name, mode).objectStore(name); }

export const newId = () => crypto.randomUUID();
export const listTrades = async () => wrap<Trade[]>((await store('trades')).getAll());
export async function saveTrade(t: Trade) {
  const now = new Date().toISOString();
  await wrap((await store('trades', 'readwrite')).put({ ...t, createdAt: t.createdAt ?? now, updatedAt: now }));
}
// Deleting a trade deletes its images (explicit policy); deleting an image never deletes a trade.
export async function deleteTrade(id: string) {
  await wrap((await store('trades', 'readwrite')).delete(id));
  for (const im of await listImages(id)) await deleteImage(im.id);
}
export const listImages = async (tradeId: string) => wrap<TradeImage[]>((await store('images')).index('tradeId').getAll(tradeId));
export const saveImage = async (im: TradeImage) => { await wrap((await store('images', 'readwrite')).put(im)); };
export const deleteImage = async (id: string) => { await wrap((await store('images', 'readwrite')).delete(id)); };
export async function getSettings(): Promise<AppSettings> {
  const v = await wrap<AppSettings | undefined>((await store('kv')).get('settings'));
  return v ? { ...DEFAULT_SETTINGS, ...v, lists: { ...DEFAULT_SETTINGS.lists, ...v.lists }, rules: { ...DEFAULT_RULES, ...v.rules }, policies: { ...DEFAULT_POLICIES, ...v.policies } } : DEFAULT_SETTINGS;
}
export const putSettings = async (s: AppSettings) => { await wrap((await store('kv', 'readwrite')).put(s, 'settings')); };
export const listMissed = async () => wrap<import('../engine/types.ts').MissedOpportunity[]>((await store('missed')).getAll());
export const saveMissed = async (m: import('../engine/types.ts').MissedOpportunity) => { await wrap((await store('missed', 'readwrite')).put(m)); };
export const listAllImages = async () => wrap<TradeImage[]>((await store('images')).getAll());
export const deleteMissed = async (id: string) => { await wrap((await store('missed', 'readwrite')).delete(id)); };
