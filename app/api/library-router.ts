import { z } from "zod";
import { and, asc, eq, inArray, like, type SQL } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { docPages, files } from "../db/schema";
import { escapeLike, makeSnippet, scoreContent, termsOf } from "./lib/search";

const SEARCH_SCAN_LIMIT = 400;

export const libraryRouter = createRouter({
  /** Книги (PDF/DjVu) в базе */
  books: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: files.id,
        name: files.name,
        size: files.size,
        kind: files.kind,
        status: files.status,
        pagesCount: files.pagesCount,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(inArray(files.kind, ["pdf", "djvu"]))
      .orderBy(asc(files.name));
  }),

  /** Полнотекстовый поиск по страницам книг */
  search: authedQuery
    .input(
      z.object({
        q: z.string().min(2).max(300),
        fileId: z.number().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const terms = termsOf(input.q);
      const phrase = input.q.trim();
      if (terms.length === 0 && phrase.length < 2) {
        return { rows: [], total: 0, page: input.page, pageSize: input.pageSize };
      }

      // Каждое слово запроса должно встречаться на странице
      const conds: SQL[] = [];
      for (const term of terms.length ? terms : [phrase]) {
        conds.push(like(docPages.content, `%${escapeLike(term)}%`));
      }
      if (input.fileId) conds.push(eq(docPages.fileId, input.fileId));
      const where = and(...conds);

      // Сканируем ограниченный пул совпадений и ранжируем в JS
      const candidates = await db
        .select({
          id: docPages.id,
          fileId: docPages.fileId,
          page: docPages.page,
          content: docPages.content,
          fileName: files.name,
        })
        .from(docPages)
        .leftJoin(files, eq(docPages.fileId, files.id))
        .where(where)
        .limit(SEARCH_SCAN_LIMIT);

      const ranked = candidates
        .map((c) => ({
          id: c.id,
          fileId: c.fileId,
          fileName: c.fileName ?? "",
          page: c.page,
          score:
            scoreContent(c.content, terms.length ? terms : [phrase]) +
            (phrase.length >= 4 &&
            c.content.toLowerCase().includes(phrase.toLowerCase())
              ? 10
              : 0),
          snippet: makeSnippet(c.content, terms.length ? terms : [phrase]),
        }))
        .sort((a, b) => b.score - a.score);

      const start = (input.page - 1) * input.pageSize;
      return {
        rows: ranked.slice(start, start + input.pageSize),
        total: ranked.length,
        truncated: candidates.length >= SEARCH_SCAN_LIMIT,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** Текст страницы (для чтения контекста найденного) */
  pageText: authedQuery
    .input(z.object({ fileId: z.number(), page: z.number().int().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select({ content: docPages.content, page: docPages.page })
        .from(docPages)
        .where(and(eq(docPages.fileId, input.fileId), eq(docPages.page, input.page)));
      const [file] = await db
        .select({ name: files.name, pagesCount: files.pagesCount })
        .from(files)
        .where(eq(files.id, input.fileId));
      return {
        page: row?.page ?? input.page,
        content: row?.content ?? "",
        fileName: file?.name ?? "",
        pagesCount: file?.pagesCount ?? 0,
      };
    }),
});
