import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { storage } from "./lib/storage";
import { getDb } from "./queries/connection";
import { files, parts, docPages, users } from "../db/schema";
import { parseExcel } from "./lib/parsers/excel";
import { parsePdf } from "./lib/parsers/pdf";
import { parseDjvu } from "./lib/parsers/djvu";
import { log } from "./lib/logger";

const MAX_FILE_BYTES = 35 * 1024 * 1024; // base64 должен уместиться в 50MB bodyLimit
const PARTS_BATCH = 500;
const PAGES_BATCH = 100;

type FileKind = "excel" | "pdf" | "djvu";

function detectKind(name: string): FileKind | null {
  const lower = name.toLowerCase();
  if (/\.(xlsx|xls|xlsm|csv)$/.test(lower)) return "excel";
  if (/\.pdf$/.test(lower)) return "pdf";
  if (/\.(djvu|djv)$/.test(lower)) return "djvu";
  return null;
}

/** Парсит файл и заполняет parts / doc_pages; обновляет статус файла. */
async function indexFile(fileId: number, buffer: Buffer, kind: FileKind) {
  const db = getDb();
  if (kind === "excel") {
    const result = parseExcel(buffer);
    for (let i = 0; i < result.parts.length; i += PARTS_BATCH) {
      await db.insert(parts).values(
        result.parts.slice(i, i + PARTS_BATCH).map((p) => ({
          fileId,
          article: p.article,
          articleNorm: p.articleNorm,
          name: p.name,
          brand: p.brand,
          category: p.category,
          applicability: p.applicability,
          price: p.price === null ? null : String(p.price),
          currency: p.currency,
          stock: p.stock,
          sheet: p.sheet,
          extra: p.extra,
        })),
      );
    }
    await db
      .update(files)
      .set({
        status: "ready",
        partsCount: result.parts.length,
        sheetsCount: result.sheetsCount,
        error: result.warnings.length
          ? result.warnings.slice(0, 5).join("; ")
          : null,
      })
      .where(eq(files.id, fileId));
  } else {
    const result = kind === "pdf" ? await parsePdf(buffer) : await parseDjvu(buffer);
    const rows = result.pages
      .map((content, idx) => ({ fileId, page: idx + 1, content }))
      .filter((r) => r.content.length > 0);
    for (let i = 0; i < rows.length; i += PAGES_BATCH) {
      await db.insert(docPages).values(rows.slice(i, i + PAGES_BATCH));
    }
    await db
      .update(files)
      .set({
        status: "ready",
        pagesCount: result.pages.length,
        error:
          result.emptyPages > 0
            ? `${result.emptyPages} стр. без текстового слоя (пропущены при поиске)`
            : null,
      })
      .where(eq(files.id, fileId));
  }
}

export const filesRouter = createRouter({
  upload: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(500),
        contentBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const kind = detectKind(input.name);
      if (!kind) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Неподдерживаемый формат. Загружайте Excel (.xlsx, .xls, .csv), PDF или DjVu.",
        });
      }
      const buffer = Buffer.from(input.contentBase64, "base64");
      if (buffer.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Пустой файл" });
      }
      if (buffer.length > MAX_FILE_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Файл слишком большой: ${(buffer.length / 1024 / 1024).toFixed(1)} МБ. Лимит — 35 МБ.`,
        });
      }

      const saved = await storage.uploadFile({
        fileContent: new Uint8Array(buffer),
        fileName: `uploads/${input.name}`,
        contentType: "application/octet-stream",
      });

      const db = getDb();
      const [{ id }] = await db
        .insert(files)
        .values({
          key: saved.key,
          name: input.name.slice(0, 500),
          size: buffer.length,
          kind,
          status: "processing",
          ownerId: ctx.user.id,
        })
        .$returningId();

      try {
        await indexFile(id, buffer, kind);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error("file indexing failed", { fileId: id, error: message });
        await db
          .update(files)
          .set({ status: "error", error: `Ошибка обработки: ${message.slice(0, 500)}` })
          .where(eq(files.id, id));
      }

      const [row] = await db.select().from(files).where(eq(files.id, id));
      return row;
    }),

  list: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: files.id,
        key: files.key,
        name: files.name,
        size: files.size,
        kind: files.kind,
        status: files.status,
        error: files.error,
        partsCount: files.partsCount,
        pagesCount: files.pagesCount,
        sheetsCount: files.sheetsCount,
        ownerId: files.ownerId,
        createdAt: files.createdAt,
        ownerName: users.name,
      })
      .from(files)
      .leftJoin(users, eq(files.ownerId, users.id))
      .orderBy(desc(files.createdAt));
  }),

  remove: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(files).where(eq(files.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Файл не найден" });
      if (row.ownerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Удалить файл может только загрузивший его пользователь или администратор",
        });
      }
      await db.delete(parts).where(eq(parts.fileId, row.id));
      await db.delete(docPages).where(eq(docPages.fileId, row.id));
      await db.delete(files).where(eq(files.id, row.id));
      try {
        await storage.deleteFile({ fileKey: row.key });
      } catch (err) {
        log.error("storage delete failed", { key: row.key, error: String(err) });
      }
      return { ok: true };
    }),

  url: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(files).where(eq(files.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Файл не найден" });
      const { url } = await storage.getPresignedUrl({ key: row.key, download: true });
      return { url };
    }),

  removeMany: authedQuery
    .input(z.object({ ids: z.array(z.number()).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db.select().from(files).where(inArray(files.id, input.ids));
      let removed = 0;
      for (const row of rows) {
        if (row.ownerId !== ctx.user.id && ctx.user.role !== "admin") continue;
        await db.delete(parts).where(eq(parts.fileId, row.id));
        await db.delete(docPages).where(eq(docPages.fileId, row.id));
        await db.delete(files).where(eq(files.id, row.id));
        try {
          await storage.deleteFile({ fileKey: row.key });
        } catch (err) {
          log.error("storage delete failed", { key: row.key, error: String(err) });
        }
        removed++;
      }
      return { ok: true, removed };
    }),
});
