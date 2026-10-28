import type { TradeImage } from '../db/db.ts';
import type { ImageRecord } from './backup.ts';

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer()); let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
export const base64ToBlob = (b64: string, mime: string) => new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: mime });
export async function toRecord(im: TradeImage): Promise<ImageRecord> {
  const { blob, ...meta } = im; return { ...meta, dataBase64: await blobToBase64(blob) } as ImageRecord;
}
export function fromRecord(r: ImageRecord): TradeImage {
  const { dataBase64, ...meta } = r; return { ...meta, blob: base64ToBlob(dataBase64, r.mime) } as TradeImage;
}
