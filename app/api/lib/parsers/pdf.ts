/**
 * Извлечение текста из PDF постранично (pdfjs-dist legacy, Node).
 * Работает только с PDF, содержащими текстовый слой;
 * сканы без OCR дадут пустые страницы (файл всё равно сохраняется).
 */
// pdfjs-dist legacy сборка завендорена в api/vendor/pdfjs.cjs, чтобы esbuild
// мог подставить заглушку canvas (tsconfig paths не действует на node_modules).
// Воркер воркер-потока не поднимаем: подключаем worker-бандл как модуль,
// его UMD пишет globalThis.pdfjsWorker — pdfjs берёт WorkerMessageHandler
// оттуда и работает на главном потоке (см. PDFWorker._mainThreadWorkerMessageHandler).
import "../../vendor/pdfjs-worker.cjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — CJS-файл без типов
import * as pdfjsNs from "../../vendor/pdfjs.cjs";
// CJS/ESM интероп: ищем уровень, где реально лежит getDocument
// (различается между esbuild-бандлом и vite dev SSR;
// UMD-обёртка pdf.js всегда дублирует экспорт в globalThis.pdfjsLib).
/* eslint-disable @typescript-eslint/no-explicit-any */
const pdfjsCandidates = [
  pdfjsNs as any,
  (pdfjsNs as any).default,
  (pdfjsNs as any).default?.default,
  (globalThis as any).pdfjsLib,
];
const pdfjs: any =
  pdfjsCandidates.find((c) => typeof c?.getDocument === "function") ??
  (pdfjsNs as any);

export interface PdfParseResult {
  /** Текст по страницам (индекс = страница - 1) */
  pages: string[];
  /** Сколько страниц оказалось без текстового слоя */
  emptyPages: number;
}

const MAX_PAGES = 5000;

export async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  let emptyPages = 0;

  const count = Math.min(doc.numPages, MAX_PAGES);
  for (let i = 1; i <= count; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str?: string }>)
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 3) emptyPages++;
    pages.push(text);
    page.cleanup();
  }
  await doc.destroy();

  return { pages, emptyPages };
}
