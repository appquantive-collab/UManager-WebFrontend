/**
 * Reads an item list from Excel (.xlsx) or CSV into rows keyed by our field
 * names. Column headers can be in plain English or Hindi/Hinglish — whatever a
 * shop's existing sheet (or Tally/Vyapar export) happens to use.
 */

export const IMPORT_FIELDS = [
  "name",
  "sku",
  "barcode",
  "category",
  "brand",
  "unit",
  "hsn",
  "gstPercent",
  "purchasePrice",
  "wholesalePrice",
  "retailPrice",
  "reorderLevel",
  "openingStock",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "item", "item name", "product", "product name", "naam", "saman", "samaan", "description", "particulars"],
  sku: ["sku", "code", "item code", "product code"],
  barcode: ["barcode", "bar code", "ean", "upc"],
  category: ["category", "group", "item group", "shreni", "category name"],
  brand: ["brand", "company", "make", "manufacturer"],
  unit: ["unit", "uom", "units", "ikai"],
  hsn: ["hsn", "hsn code", "hsn/sac", "sac"],
  gstPercent: ["gst", "gst %", "gst%", "gst rate", "tax", "tax %", "tax rate", "igst %"],
  purchasePrice: ["purchase price", "cost", "cost price", "buy price", "purchase rate", "kharid", "kharid daam", "p rate"],
  wholesalePrice: ["wholesale", "wholesale price", "wholesale rate", "dealer price", "thok"],
  retailPrice: ["retail", "retail price", "price", "selling price", "sale price", "mrp", "rate", "s rate", "bikri daam"],
  reorderLevel: ["reorder", "reorder level", "min stock", "minimum stock", "alert qty", "low stock"],
  openingStock: ["stock", "opening stock", "qty", "quantity", "current stock", "closing stock", "maal"],
};

const norm = (h: unknown) =>
  String(h ?? "")
    .toLowerCase()
    .replace(/[_\-.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Which of our fields each column holds (null = ignore that column). */
export function mapHeaders(headers: unknown[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const key = norm(h);
    if (!key) return null;
    const exact = IMPORT_FIELDS.find((f) => !used.has(f) && ALIASES[f].includes(key));
    const loose = exact ?? IMPORT_FIELDS.find((f) => !used.has(f) && ALIASES[f].some((a) => key.startsWith(a) || key.includes(` ${a}`)));
    if (loose) used.add(loose);
    return loose ?? null;
  });
}

/** Simple CSV reader: commas or semicolons, quoted cells, "" escapes. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ParsedSheet {
  columns: (ImportField | null)[];
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function readItemSheet(file: File): Promise<ParsedSheet> {
  let table: unknown[][];
  if (/\.xlsx?$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    table = (await readSheet(file)) as unknown[][];
  } else {
    table = parseCsv(await file.text());
  }
  // The header row is the first row that names an item column (sheets often start with a title).
  const headerIndex = Math.max(
    0,
    table.slice(0, 10).findIndex((r) => mapHeaders(r).includes("name"))
  );
  const headers = (table[headerIndex] ?? []).map((h) => String(h ?? "").trim());
  const columns = mapHeaders(headers);
  const rows = table
    .slice(headerIndex + 1)
    .map((r) => {
      const out: Record<string, unknown> = {};
      columns.forEach((field, i) => {
        if (!field) return;
        const value = r[i];
        if (value === null || value === undefined || String(value).trim() === "") return;
        out[field] = typeof value === "string" ? value.trim() : value;
      });
      return out;
    })
    .filter((r) => Object.keys(r).length > 0);
  return { columns, headers, rows };
}

export const TEMPLATE_CSV =
  "Item name,Unit,Retail price,Wholesale price,Purchase price,GST %,HSN,Category,Brand,Opening stock,Reorder level,SKU,Barcode\n" +
  "Basmati Rice 1kg,pcs,120,110,95,5,1006,Grocery,India Gate,50,10,,\n" +
  "Lux Soap 100g,pcs,40,36,30,18,3401,Personal care,Lux,100,20,,8901030865278\n";
