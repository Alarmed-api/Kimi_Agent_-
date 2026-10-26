/**
 * Извлечение текста из DjVu (djvu-rs, WebAssembly — работает в Node без
 * системных зависимостей). WASM вшит в бандл как base64 (api/vendor/),
 * чтобы не зависеть от файловой системы и fetch в рантайме.
 */
import initDjvu, * as djvu from "djvu-rs";
import { wasmBase64 as simdBase64 } from "../../vendor/djvu-wasm-simd128";
import { wasmBase64 as scalarBase64 } from "../../vendor/djvu-wasm-scalar";

export interface DjvuParseResult {
  pages: string[];
  emptyPages: number;
}

const MAX_PAGES = 5000;

let initPromise: Promise<unknown> | null = null;

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    const useSimd = djvu.wasmSimd128Supported();
    const bytes = Buffer.from(useSimd ? simdBase64 : scalarBase64, "base64");
    initPromise = initDjvu(new Uint8Array(bytes));
  }
  await initPromise;
}

export async function parseDjvu(buffer: Buffer): Promise<DjvuParseResult> {
  await ensureInit();
  const doc = djvu.WasmDocument.from_bytes(new Uint8Array(buffer));
  const pages: string[] = [];
  let emptyPages = 0;

  const count = Math.min(doc.page_count(), MAX_PAGES);
  for (let i = 0; i < count; i++) {
    const page = doc.page(i);
    const text = (page.text() ?? "").replace(/[ \t]+/g, " ").trim();
    if (text.length < 3) emptyPages++;
    pages.push(text);
  }
  doc.free();

  return { pages, emptyPages };
}
