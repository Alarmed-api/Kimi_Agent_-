/**
 * Парсер Excel-файлов с ассортиментом запчастей.
 * Эвристически определяет строку заголовков и маппит колонки
 * (артикул / наименование / бренд / категория / цена / остаток / применяемость),
 * неизвестные колонки сохраняет в extra (JSON).
 */
import * as XLSX from "xlsx";

export interface ParsedPart {
  article: string;
  articleNorm: string;
  name: string;
  brand: string;
  category: string;
  applicability: string;
  price: number | null;
  currency: string;
  stock: number | null;
  sheet: string;
  extra: string | null;
}

export interface ExcelParseResult {
  parts: ParsedPart[];
  sheetsCount: number;
  warnings: string[];
}

type ColumnRole =
  | "article"
  | "name"
  | "brand"
  | "category"
  | "price"
  | "stock"
  | "applicability";

const ROLE_PATTERNS: Array<[ColumnRole, RegExp]> = [
  [
    "article",
    /^(артикул|арт\.?|код( товара)?|part\s*(number|no|#)?|p\/?n|pn|oem|кросс(-?код)?|номер( детали)?|sku)/i,
  ],
  [
    "name",
    /(наименование|название|описание|номенклатура|деталь|запчасть|товар|name|description|title)/i,
  ],
  ["brand", /(бренд|марка|производител|фирма|brand|manufacturer|maker)/i],
  ["category", /(категория|группа|раздел|тип детали|category|group|section)/i],
  [
    "price",
    /(цена|price|стоимость|розниц|опт|прайс|cost|руб\.?$)/i,
  ],
  [
    "stock",
    /(остаток|наличие|количество|кол-?во|stock|qty|quantity|склад|резерв|свободн)/i,
  ],
  [
    "applicability",
    /(применяемост|совместимост|модель( двигателя| авто)?|application|fits|применяется|двигател|авто|техника)/i,
  ],
];

const MAX_SCAN_ROWS = 15;
const MAX_ROWS_PER_FILE = 50_000;

export function normalizeArticle(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 255);
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function parsePrice(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v >= 0 ? v : null;
  const s = cellText(v);
  if (!s) return null;
  const cleaned = s
    .replace(/\s| /g, "")
    .replace(/(руб\.?|₽|р\.?)$/i, "")
    .replace(",", ".");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseStock(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const s = cellText(v);
  if (!s) return null;
  if (/^(да|есть|в наличии|\+)$/i.test(s)) return 1;
  if (/^(нет|отсутствует|-|—)$/i.test(s)) return 0;
  const m = s.replace(/\s/g, "").match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

function detectCurrency(header: string): string {
  if (/\$|usd|доллар/i.test(header)) return "$";
  if (/€|eur|евро/i.test(header)) return "€";
  return "₽";
}

function scoreHeaderRow(row: unknown[]): { roles: Map<number, ColumnRole>; score: number } {
  const roles = new Map<number, ColumnRole>();
  const usedRoles = new Set<ColumnRole>();
  let score = 0;
  row.forEach((cell, idx) => {
    const text = cellText(cell);
    if (!text || text.length > 60) return;
    for (const [role, pattern] of ROLE_PATTERNS) {
      if (usedRoles.has(role)) continue;
      if (pattern.test(text)) {
        roles.set(idx, role);
        usedRoles.add(role);
        score++;
        break;
      }
    }
  });
  return { roles, score };
}

export function parseExcel(buffer: Buffer): ExcelParseResult {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    dense: true,
  });

  const parts: ParsedPart[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: true,
    });
    if (rows.length === 0) continue;

    // Ищем строку заголовков среди первых строк
    let headerIdx = -1;
    let headerRoles = new Map<number, ColumnRole>();
    let bestScore = 0;
    const scanLimit = Math.min(rows.length, MAX_SCAN_ROWS);
    for (let i = 0; i < scanLimit; i++) {
      const { roles, score } = scoreHeaderRow(rows[i] ?? []);
      if (score > bestScore) {
        bestScore = score;
        headerIdx = i;
        headerRoles = roles;
      }
    }

    if (bestScore < 2) {
      // Заголовки не распознаны — пробуем первую непустую строку как заголовок,
      // но без маппинга ролей такой лист пропускаем: слишком высок риск мусора.
      if (rows.length > 0) {
        warnings.push(
          `Лист «${sheetName}»: заголовки не распознаны, лист пропущен`,
        );
      }
      continue;
    }

    const headers = (rows[headerIdx] ?? []).map(cellText);
    const mappedIdx = new Set(headerRoles.keys());
    const priceHeader = headers.find((h) => /цена|price|стоимость/i.test(h)) ?? "";
    const currency = detectCurrency(priceHeader);

    const dataRows = rows.slice(headerIdx + 1);
    let parsedOnSheet = 0;
    for (const row of dataRows) {
      if (parts.length >= MAX_ROWS_PER_FILE) {
        warnings.push(
          `Достигнут лимит ${MAX_ROWS_PER_FILE} строк — остальные строки пропущены`,
        );
        break;
      }
      if (!row || row.every((c) => cellText(c) === "")) continue;

      const get = (role: ColumnRole): string => {
        for (const [idx, r] of headerRoles) {
          if (r === role) return cellText(row[idx]);
        }
        return "";
      };

      const article = get("article").slice(0, 255);
      const name = get("name");
      const brand = get("brand").slice(0, 255);
      const category = get("category").slice(0, 255);
      const applicability = get("applicability");

      // Пропускаем повторные строки-заголовки и пустые
      if (article && article === get("article") && scoreHeaderRow(row).score >= 2)
        continue;
      if (!article && !name) continue;

      const price = headerRoles.size
        ? parsePrice(
            row[[...headerRoles].find(([, r]) => r === "price")?.[0] ?? -1],
          )
        : null;
      const stockRaw = row[[...headerRoles].find(([, r]) => r === "stock")?.[0] ?? -1];
      const stock = parseStock(stockRaw);

      const extra: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (!h || mappedIdx.has(idx)) return;
        const v = cellText(row[idx]);
        if (v) extra[h.slice(0, 100)] = v.slice(0, 500);
      });

      parts.push({
        article,
        articleNorm: normalizeArticle(article),
        name: name.slice(0, 2000),
        brand,
        category,
        applicability: applicability.slice(0, 2000),
        price,
        currency,
        stock,
        sheet: sheetName.slice(0, 255),
        extra: Object.keys(extra).length ? JSON.stringify(extra) : null,
      });
      parsedOnSheet++;
    }
    if (parsedOnSheet === 0) {
      warnings.push(`Лист «${sheetName}»: данные не найдены под заголовками`);
    }
  }

  return { parts, sheetsCount: workbook.SheetNames.length, warnings };
}
