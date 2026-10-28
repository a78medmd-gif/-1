// Thin wrapper over exceljs: returns cached cell values only (formulas' results); never evaluates code from the file.
import ExcelJS from 'exceljs';
export type Sheets = Record<string, unknown[][]>;
const MAX_BYTES = 20 * 1024 * 1024;

export async function readWorkbook(file: File): Promise<Sheets> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('الملف يجب أن يكون بصيغة .xlsx');
  if (file.size > MAX_BYTES) throw new Error('الملف أكبر من 20 ميغابايت');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const out: Sheets = {};
  wb.eachSheet(ws => {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const vals: unknown[] = [];
      for (let c = 1; c <= Math.max(row.cellCount, 1); c++) {
        const v = row.getCell(c).value;
        vals.push(v && typeof v === 'object' && !(v instanceof Date) ? ('result' in v ? (v as { result: unknown }).result : null) : v);
      }
      rows[n - 1] = vals;
    });
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
    out[ws.name] = rows;
  });
  return out;
}
