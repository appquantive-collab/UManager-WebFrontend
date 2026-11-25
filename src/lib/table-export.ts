/**
 * Download a simple table as CSV, Excel (.xlsx) or PDF, from the same rows.
 * The first row is the header. No libraries: the .xlsx is a tiny zip we
 * write ourselves, and the PDF goes through the browser's print dialog
 * ("Save as PDF") so Hindi names print with the system fonts.
 */

export type ExportFormat = "excel" | "pdf" | "csv";
export type Cell = string | number;

export type ExportMeta = {
  /** File name without extension. */
  name: string;
  /** Big heading on the PDF and the sheet name in Excel. */
  title: string;
  /** Small lines under the PDF heading, e.g. business name and period. */
  subtitle?: string[];
};

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- CSV ----------
export function downloadCsv(name: string, rows: Cell[][]) {
  const escape = (value: Cell) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // BOM so Excel opens Hindi names correctly.
  save(new Blob(["﻿" + rows.map((r) => r.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}

// ---------- Excel (.xlsx) ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip with no compression ("stored"); plenty for a few hundred rows. */
function zip(files: { name: string; data: string }[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, data.length, true);
    dv.setUint32(24, data.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    dir.set(name, 46);
    parts.push(local, data);
    central.push(dir);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end] as BlobPart[], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const xml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Characters XML 1.0 does not allow.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** Numbers stay numbers in Excel (so SUM works); "12 kg" stays text. */
const asNumber = (value: Cell) => (typeof value === "number" ? value : /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null);

export function downloadExcel(meta: ExportMeta, rows: Cell[][]) {
  const widths = rows[0]?.map((_, c) => Math.min(48, Math.max(10, ...rows.map((r) => String(r[c] ?? "").length + 2)))) ?? [];
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`;
          const num = r === 0 ? null : asNumber(value);
          if (num !== null && Number.isFinite(num)) return `<c r="${ref}"${r === 0 ? ' s="1"' : ""}><v>${num}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const sheetName = xml(meta.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
  const files = [
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    },
    {
      name: "xl/styles.xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
    },
  ];
  save(zip(files), `${meta.name}.xlsx`);
}

// ---------- PDF (print to PDF) ----------
const html = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function downloadPdf(meta: ExportMeta, rows: Cell[][]) {
  const [head = [], ...body] = rows;
  // A column is right-aligned when every value in it is a number.
  const numeric = head.map((_, c) => body.length > 0 && body.every((r) => asNumber(r[c] ?? "") !== null));
  const cell = (value: Cell, c: number, tag: "td" | "th") => `<${tag}${numeric[c] ? ' class="num"' : ""}>${html(String(value))}</${tag}>`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${html(meta.name)}</title><style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "Inter", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif; color: #171717; margin: 0; font-size: 12px; }
    .brand { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #c2410c; padding-bottom: 10px; margin-bottom: 14px; }
    .brand b { color: #c2410c; font-size: 13px; letter-spacing: .02em; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .sub { color: #525252; margin: 0; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #fff1e8; color: #9a3412; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 8px 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #eaecef; }
    tr:nth-child(even) td { background: #f8f9fb; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    .foot { margin-top: 14px; color: #737373; font-size: 10px; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style></head><body>
    <div class="brand"><div><h1>${html(meta.title)}</h1>${(meta.subtitle ?? []).map((s) => `<p class="sub">${html(s)}</p>`).join("")}</div><b>VoiceMunshi</b></div>
    <table><thead><tr>${head.map((v, c) => cell(v, c, "th")).join("")}</tr></thead>
    <tbody>${body.map((r) => `<tr>${r.map((v, c) => cell(v, c, "td")).join("")}</tr>`).join("")}</tbody></table>
    <p class="foot">${html(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))}</p>
  </body></html>`;

  // A hidden frame: no pop-up blocker, and the app page stays as it is.
  document.querySelectorAll("iframe[data-table-export]").forEach((old) => old.remove());
  const frame = document.createElement("iframe");
  frame.setAttribute("data-table-export", "");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return;
  }
  win.document.open();
  win.document.write(doc);
  win.document.close();
  // Browsers that never fire afterprint leave it until the next export.
  win.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 500), { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

export function exportTable(format: ExportFormat, meta: ExportMeta, rows: Cell[][]) {
  if (format === "excel") downloadExcel(meta, rows);
  else if (format === "pdf") downloadPdf(meta, rows);
  else downloadCsv(meta.name, rows);
}
