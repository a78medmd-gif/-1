import { useCallback, useEffect, useRef, useState } from 'react';
import { listImages, saveImage, deleteImage, newId, type TradeImage } from '../db/db.ts';
import { validateImage, nextOrder, reorder, sortImages, comparePair, KIND_LABEL, type Kind } from './imageUtils.ts';

export default function TradeImages({ tradeId }: { tradeId: string }) {
  const [imgs, setImgs] = useState<TradeImage[]>([]); const [urls, setUrls] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Kind>('before'); const [caption, setCaption] = useState('');
  const [msgs, setMsgs] = useState<string[]>([]); const [view, setView] = useState<number | null>(null);
  const [compare, setCompare] = useState(false); const urlRef = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const xs = sortImages(await listImages(tradeId));
    Object.values(urlRef.current).forEach(URL.revokeObjectURL);
    urlRef.current = Object.fromEntries(xs.map(x => [x.id, URL.createObjectURL(x.blob)]));
    setImgs(xs); setUrls(urlRef.current);
  }, [tradeId]);
  useEffect(() => { load(); return () => Object.values(urlRef.current).forEach(URL.revokeObjectURL); }, [load]);

  const add = async (files: FileList | null) => {
    if (!files) return; const errs: string[] = []; let order = nextOrder(imgs);
    for (const f of Array.from(files)) {
      const head = new Uint8Array(await f.slice(0, 16).arrayBuffer()), e = validateImage(f.size, head);
      if (e) { errs.push(`${f.name}: ${e}`); continue; }
      try { await saveImage({ id: newId(), tradeId, kind, fileName: f.name, mime: f.type, size: f.size, addedAt: new Date().toISOString(), caption: caption || undefined, order: order++, blob: f }); }
      catch (x) { errs.push(`${f.name}: فشل الحفظ (${(x as Error).message})`); }   // e.g. storage quota
    }
    setMsgs(errs); await load();
  };
  const move = async (id: string, d: -1 | 1) => { for (const u of reorder(imgs, id, d)) { const im = imgs.find(i => i.id === u.id)!; if (im.order !== u.order) await saveImage({ ...im, order: u.order }); } await load(); };
  const del = async (id: string) => { if (confirm('حذف هذه الصورة؟ لن تُحذف الصفقة.')) { await deleteImage(id); await load(); } };
  const { before, after } = comparePair(imgs);
  const cur = view !== null ? imgs[view] : null;

  return <div className="card" style={{ marginTop: 8 }}>
    <div className="form">
      <label>النوع<select value={kind} onChange={e => setKind(e.target.value as Kind)}>{(Object.keys(KIND_LABEL) as Kind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
      <label>وصف (اختياري)<input value={caption} onChange={e => setCaption(e.target.value)} /></label>
      <label>من المعرض / الملفات<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { add(e.target.files); e.target.value = ''; }} /></label>
      <label>الكاميرا<input type="file" accept="image/*" capture="environment" onChange={e => { add(e.target.files); e.target.value = ''; }} /></label>
    </div>
    {msgs.map(m => <div className="warn" key={m}>{m}</div>)}
    {imgs.length === 0 && <p className="k">لا توجد صور لهذه الصفقة.</p>}
    <div className="grid" style={{ marginTop: 8 }}>
      {imgs.map((im, i) => <div key={im.id} className="card" style={{ padding: 6 }}>
        <img src={urls[im.id]} alt={im.caption ?? im.fileName} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }} onClick={() => setView(i)} />
        <div className="k">{KIND_LABEL[im.kind]}{im.caption ? ' · ' + im.caption : ''}</div>
        <div className="row"><button className="btn g" onClick={() => move(im.id, -1)} aria-label="للأمام">↑</button><button className="btn g" onClick={() => move(im.id, 1)} aria-label="للخلف">↓</button><button className="btn d" onClick={() => del(im.id)}>حذف</button></div>
      </div>)}
    </div>
    {before && after && <><button className="btn g" style={{ marginTop: 8 }} onClick={() => setCompare(!compare)}>{compare ? 'إخفاء المقارنة' : 'مقارنة قبل / بعد'}</button>
      {compare && <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 8 }}><div><div className="k">قبل</div><img src={urls[before.id]} style={{ width: '100%' }} /></div><div><div className="k">بعد</div><img src={urls[after.id]} style={{ width: '100%' }} /></div></div>}</>}
    {cur && <div role="dialog" style={{ position: 'fixed', inset: 0, background: '#000e', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={() => setView(null)}>
      <img src={urls[cur.id]} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
      <div style={{ color: '#fff', marginTop: 8 }}>{KIND_LABEL[cur.kind]} · {new Date(cur.addedAt).toLocaleString('ar')}{cur.caption ? ' · ' + cur.caption : ''}</div>
      <div className="row" style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
        <button className="btn" disabled={view! >= imgs.length - 1} onClick={() => setView(view! + 1)}>التالي</button>
        <button className="btn" disabled={view! <= 0} onClick={() => setView(view! - 1)}>السابق</button>
        <button className="btn g" onClick={() => setView(null)}>إغلاق</button></div></div>}
  </div>;
}
