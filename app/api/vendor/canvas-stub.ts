/**
 * Заглушка для опционального native-пакета "canvas", который pdfjs-dist
 * пытается подключить через require() для рендеринга. Мы используем pdfjs
 * только для извлечения текста — рендеринг не нужен, поэтому модуль пустой.
 * Резолвится через tsconfig paths ("canvas" → этот файл), чтобы esbuild
 * мог собрать серверный бандл без native-зависимости.
 */

export function createCanvas(): never {
  throw new Error("canvas is not available: rendering is not supported on this server");
}

export const CanvasRenderingContext2D = undefined;
export const DOMMatrix = undefined;
export const ImageData = undefined;
export const Path2D = undefined;
