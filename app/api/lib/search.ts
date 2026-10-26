/** Утилиты полнотекстового поиска (LIKE-based) и сниппетов. */

/** Экранирование спецсимволов LIKE (%, _, \) */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Стоп-слова русского и английского, не несущие поискового смысла */
const STOP_WORDS = new Set([
  "какой", "какая", "какое", "какие", "как", "что", "где", "когда", "почему",
  "сколько", "который", "которая", "которые", "есть", "это", "весь", "для",
  "про", "под", "над", "при", "без", "через", "между", "после", "перед",
  "найди", "найти", "покажи", "показать", "расскажи", "рассказать", "поищи",
  "нужен", "нужна", "нужно", "нужны", "надо", "можно", "мне", "нам", "вам",
  "установлен", "стоит", "стоят", "подходит", "подойдет", "быть", "будет",
  "the", "what", "which", "where", "when", "how", "for", "and", "are",
  "with", "that", "this", "from", "does", "have", "has", "find", "show",
  "any", "some", "all", "can", "could", "should", "would",
]);

/**
 * Разбивает запрос на значимые слова (от 2 символов, без стоп-слов).
 * Сначала — самые длинные (информативные), максимум maxTerms.
 */
export function termsOf(query: string, maxTerms = 6): string[] {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  const unique = [...new Set(words)];
  unique.sort((a, b) => b.length - a.length);
  return unique.slice(0, maxTerms);
}

/**
 * Делает сниппет вокруг первого вхождения любого из терминов.
 * Возвращает фрагмент ~radius символов вокруг совпадения.
 */
export function makeSnippet(
  content: string,
  terms: string[],
  radius = 160,
): string {
  const lower = content.toLowerCase();
  let pos = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (pos === -1 || idx < pos)) pos = idx;
  }
  if (pos === -1) {
    return content.slice(0, radius * 2).trim() + (content.length > radius * 2 ? "…" : "");
  }
  const start = Math.max(0, pos - radius);
  const end = Math.min(content.length, pos + radius);
  return (
    (start > 0 ? "…" : "") +
    content.slice(start, end).trim() +
    (end < content.length ? "…" : "")
  );
}

/** Оценка релевантности: сумма вхождений терминов (регистронезависимо) */
export function scoreContent(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    let idx = lower.indexOf(t);
    let hits = 0;
    while (idx !== -1 && hits < 20) {
      hits++;
      idx = lower.indexOf(t, idx + t.length);
    }
    score += hits;
  }
  return score;
}

/**
 * Грубое русское стеммирование для LIKE-поиска: срезает частые флексии,
 * чтобы «затяжки» совпадало с «затяжке», «болтов» — с «болт» и т.п.
 * Латиницу не трогаем. Слово короче 6 букв возвращаем как есть.
 */
const RU_ENDINGS = [
  "иями", "ами", "ями", "иях", "ями", "ого", "его", "ому", "ему", "ыми",
  "ими", "ов", "ев", "ей", "ам", "ям", "ах", "ях", "ия", "ие", "ий",
  "ый", "ой", "ая", "ое", "ые", "ие", "а", "я", "о", "е", "у", "ю",
  "ы", "и", "ь",
];
export function stemForSearch(term: string): string {
  const t = term.toLowerCase();
  if (t.length <= 5 || !/\p{Script=Cyrillic}/u.test(t)) return t;
  for (const end of RU_ENDINGS) {
    if (t.endsWith(end) && t.length - end.length >= 4) {
      return t.slice(0, t.length - end.length);
    }
  }
  return t;
}

/** Артикулоподобные токены из свободного текста (для точного поиска по каталогу) */
export function articleTokens(text: string): string[] {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}./-]{3,29}/gu) ?? [];
  const norms = matches
    .map((m) => m.toUpperCase().replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((m) => m.length >= 4 && /\p{N}/u.test(m));
  return [...new Set(norms)].slice(0, 8);
}
