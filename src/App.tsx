import { useCallback, useEffect, useState } from 'react';
import { listTrades, getSettings, putSettings, deleteTrade, saveTrade, DEFAULT_SETTINGS, type AppSettings } from './db/db.ts';
import type { Trade } from './engine/types.ts';
import Home from './pages/Home.tsx';
import Trades from './pages/Trades.tsx';
import TradeForm from './pages/TradeForm.tsx';
import ImportPage from './pages/ImportPage.tsx';
import BackupPage from './pages/BackupPage.tsx';
import AnalysisPage from './pages/AnalysisPage.tsx';
import ChartsPage from './pages/ChartsPage.tsx';
import ChecklistPage from './pages/ChecklistPage.tsx';
import MissedPage from './pages/MissedPage.tsx';
import HelpPage from './pages/HelpPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';

// Only implemented screens are enabled; the rest are visibly disabled (no fake features).
const PAGES = [['home','الرئيسية'],['trades','الصفقات'],['add','إضافة صفقة'],['analysis','التحليل'],['charts','الرسوم'],['import','استيراد Excel'],['backup'],['settings','الإعدادات']] as const;
type Page = typeof PAGES[number][0];

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [editing, setEditing] = useState<Trade | undefined>();
  const [preset, setPreset] = useState<Parameters<typeof TradeForm>[0]['preset']>();
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [theme, setTheme] = useState<'dark'|'light'>('dark');

  const reload = useCallback(async () => { try { setTrades(await listTrades()); setSettings(await getSettings()); setReady(true); } catch (e) { setErr(String(e)); } }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  if (err) return <div className="main"><div className="warn">تعذر فتح قاعدة البيانات المحلية: {err}</div></div>;
  if (!ready) return <div className="main">جارٍ التحميل…</div>;
  const go = (p: Page) => { if (p !== 'add') { setEditing(undefined); setPreset(undefined); } setPage(p); };
  return (
    <div className="app">
      <nav className="side">
        {PAGES.map(([k, l]) => <button key={k} className={'nav' + (page === k ? ' on' : '')} onClick={() => go(k)}>{l}</button>)}
        <button className="nav" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'وضع فاتح' : 'وضع داكن'}</button>
      </nav>
      <main className="main">
        {page === 'home' && <Home trades={trades} settings={settings} />}
        {page === 'trades' && <Trades trades={trades} onEdit={t => { setEditing(t); setPage('add'); }}
          onDelete={async id => { await deleteTrade(id); await reload(); }} />}
        {page === 'add' && <TradeForm key={(editing?.id ?? 'new') + (preset ? 'p' : '')} preset={preset} initial={editing} trades={trades} settings={settings}
          onSave={async t => { await saveTrade(t); await reload(); setEditing(undefined); setPage('trades'); }} />}
        {page === 'import' && <ImportPage trades={trades} settings={settings} onDone={reload} />}
        {page === 'backup' && <BackupPage trades={trades} settings={settings} onDone={reload} />}
        {page === 'analysis' && <AnalysisPage trades={trades} settings={settings} />}
        {page === 'charts' && <ChartsPage trades={trades} settings={settings} />}
        {page === 'missed' && <MissedPage settings={settings} />}
        {page === 'checklist' && <ChecklistPage settings={settings} onUse={a => { setPreset(a); setEditing(undefined); setPage('add'); }} />}
        {page === 'help' && <HelpPage />}
        {page === 'settings' && <SettingsPage settings={settings} onSave={async s => { await putSettings(s); await reload(); }} />}
      </main>
    </div>
  );
}
