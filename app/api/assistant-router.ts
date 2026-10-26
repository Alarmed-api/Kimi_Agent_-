import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { conversations, messages, parts, docPages, files } from "../db/schema";
import {
  articleTokens,
  escapeLike,
  makeSnippet,
  scoreContent,
  termsOf,
  stemForSearch,
} from "./lib/search";
import { listModels, classifyAiError, AiUnavailable } from "./ai/ai-client";
import { log } from "./lib/logger";

interface Source {
  type: "part" | "page";
  fileName: string;
  ref: string;
  snippet: string;
}

interface RetrievalResult {
  context: string;
  sources: Source[];
}

/** Собирает контекст по базе: точные артикулы, похожие позиции, страницы книг. */
async function retrieve(question: string): Promise<RetrievalResult> {
  const db = getDb();
  const sources: Source[] = [];
  const blocks: string[] = [];

  // 1. Точные совпадения по артикулам
  const tokens = articleTokens(question);
  if (tokens.length > 0) {
    const exact = await db
      .select({
        article: parts.article,
        name: parts.name,
        brand: parts.brand,
        price: parts.price,
        currency: parts.currency,
        stock: parts.stock,
        applicability: parts.applicability,
        fileName: files.name,
      })
      .from(parts)
      .leftJoin(files, eq(parts.fileId, files.id))
      .where(inArray(parts.articleNorm, tokens))
      .limit(10);
    if (exact.length > 0) {
      blocks.push(
        "Позиции каталога с точным совпадением артикула:\n" +
          exact
            .map(
              (p) =>
                `• ${p.article} — ${p.name ?? "без названия"} (${p.brand || "бренд не указан"}), ` +
                `цена: ${p.price !== null ? `${p.price} ${p.currency}` : "не указана"}, ` +
                `остаток: ${p.stock ?? "—"}` +
                (p.applicability ? `, применяемость: ${p.applicability.slice(0, 200)}` : "") +
                ` [${p.fileName}]`,
            )
            .join("\n"),
      );
      for (const p of exact) {
        sources.push({
          type: "part",
          fileName: p.fileName ?? "",
          ref: p.article,
          snippet: `${p.name ?? ""} · ${p.price ?? "—"} ${p.currency} · остаток ${p.stock ?? "—"}`,
        });
      }
    }
  }

  // 2. Похожие позиции каталога: широкая выборка по ИЛИ + ранжирование в JS
  const terms = termsOf(question, 5);
  const patterns = terms.map(stemForSearch);
  const minMatched = Math.min(2, Math.max(1, terms.length - 1));
  if (terms.length > 0) {
    const orConds = patterns.map((p) =>
      or(
        like(parts.name, `%${escapeLike(p)}%`),
        like(parts.article, `%${escapeLike(p)}%`),
        like(parts.applicability, `%${escapeLike(p)}%`),
        like(parts.brand, `%${escapeLike(p)}%`),
      ),
    );
    const candidates = await db
      .select({
        article: parts.article,
        name: parts.name,
        brand: parts.brand,
        price: parts.price,
        currency: parts.currency,
        stock: parts.stock,
        applicability: parts.applicability,
        fileName: files.name,
      })
      .from(parts)
      .leftJoin(files, eq(parts.fileId, files.id))
      .where(or(...orConds))
      .limit(300);
    const similar = candidates
      .map((c) => {
        const hay =
          `${c.article ?? ""} ${c.name ?? ""} ${c.brand ?? ""} ${c.applicability ?? ""}`.toLowerCase();
        const matched = patterns.filter((p) => hay.includes(p)).length;
        return { ...c, matched, score: scoreContent(hay, patterns) };
      })
      .filter((c) => c.matched >= minMatched)
      .sort((a, b) => b.matched - a.matched || b.score - a.score)
      .slice(0, 6);
    if (similar.length > 0) {
      blocks.push(
        "Похожие позиции каталога:\n" +
          similar
            .map(
              (p) =>
                `• ${p.article} — ${p.name ?? "без названия"} (${p.brand || "—"}), ` +
                `цена: ${p.price !== null ? `${p.price} ${p.currency}` : "—"}, остаток: ${p.stock ?? "—"} [${p.fileName}]`,
            )
            .join("\n"),
      );
      for (const p of similar.slice(0, 4)) {
        sources.push({
          type: "part",
          fileName: p.fileName ?? "",
          ref: p.article || (p.name ?? "").slice(0, 40),
          snippet: `${p.name ?? ""} · ${p.price ?? "—"} ${p.currency} · остаток ${p.stock ?? "—"}`,
        });
      }
    }
  }

  // 3. Страницы книг: широкая выборка по ИЛИ + ранжирование в JS
  if (terms.length > 0) {
    const pageConds = patterns.map((p) =>
      like(docPages.content, `%${escapeLike(p)}%`),
    );
    const candidates = await db
      .select({
        fileId: docPages.fileId,
        page: docPages.page,
        content: docPages.content,
        fileName: files.name,
      })
      .from(docPages)
      .leftJoin(files, eq(docPages.fileId, files.id))
      .where(or(...pageConds))
      .limit(400);
    const ranked = candidates
      .map((c) => {
        const lower = c.content.toLowerCase();
        const matched = patterns.filter((p) => lower.includes(p)).length;
        return { ...c, matched, score: scoreContent(c.content, patterns) };
      })
      .filter((c) => c.matched >= minMatched)
      .sort((a, b) => b.matched - a.matched || b.score - a.score)
      .slice(0, 5);
    if (ranked.length > 0) {
      blocks.push(
        "Фрагменты из книг и документов:\n" +
          ranked
            .map(
              (c) =>
                `• [${c.fileName}, стр. ${c.page}]: «${makeSnippet(c.content, patterns, 220)}»`,
            )
            .join("\n"),
      );
      for (const c of ranked) {
        sources.push({
          type: "page",
          fileName: c.fileName ?? "",
          ref: `стр. ${c.page}`,
          snippet: makeSnippet(c.content, patterns, 140),
        });
      }
    }
  }

  return { context: blocks.join("\n\n"), sources };
}

const SYSTEM_PROMPT = `Ты — ассистент корпоративной базы знаний по запчастям и технической документации.
Отвечай на русском языке, кратко и по делу.
Правила:
- Опирайся ТОЛЬКО на контекст из базы, приведённый ниже. Если в контексте нет ответа — честно скажи, что в базе ничего не найдено, и предложи уточнить запрос (артикул, название детали, тема документа).
- Не выдумывай цены, остатки и артикулы. Все числа — только из контекста.
- Ссылаясь на данные, указывай источник в квадратных скобках: [имя файла] или [имя файла, стр. N].
- При перечислении позиций используй компактные списки с артикулом, ценой и остатком.`;

export const assistantRouter = createRouter({
  chat: authedQuery
    .input(
      z.object({
        conversationId: z.number().optional(),
        message: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Найти или создать диалог
      let conversationId = input.conversationId;
      if (conversationId) {
        const [conv] = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId));
        if (!conv || conv.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Диалог не найден" });
        }
      } else {
        const [{ id }] = await db
          .insert(conversations)
          .values({
            userId: ctx.user.id,
            title: input.message.slice(0, 80),
          })
          .$returningId();
        conversationId = id;
      }

      await db.insert(messages).values({
        conversationId,
        role: "user",
        content: input.message,
      });

      // История диалога (последние сообщения)
      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
        .limit(12);

      const { context, sources } = await retrieve(input.message);

      const userContent = context
        ? `Контекст из базы знаний:\n${context}\n\nВопрос: ${input.message}`
        : `Контекст из базы знаний отсутствует (по запросу ничего не найдено).\n\nВопрос: ${input.message}`;

      let answer: string;
      try {
        const { defaultModelId } = await listModels();
        const kimiGw = createOpenAICompatible({
          name: "kimi-gw",
          baseURL: process.env.KIMI_AGENTGW_BASE_URL!,
          apiKey: process.env.KIMI_AGENTGW_API_KEY!,
        });
        const result = await generateText({
          model: kimiGw(defaultModelId),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history.slice(0, -1).map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user", content: userContent },
          ],
          providerOptions: {
            "kimi-gw": { max_completion_tokens: 2048 },
          },
        });
        answer = result.text.trim();
      } catch (err) {
        const classified = classifyAiError(err);
        log.error("assistant chat failed", { error: classified.message });
        if (classified instanceof AiUnavailable) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "AI_UNAVAILABLE: Квота ИИ исчерпана. Пополните баланс в настройках Kimi (поиск по базе при этом работает).",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI_ERROR: ${classified.message}`,
        });
      }

      if (!answer) answer = "Не удалось получить ответ от модели. Попробуйте переформулировать вопрос.";

      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: answer,
        sources: sources.length ? JSON.stringify(sources) : null,
      });

      return { conversationId, answer, sources };
    }),

  conversations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, ctx.user.id))
      .orderBy(desc(conversations.createdAt))
      .limit(50);
  }),

  messages: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId));
      if (!conv || conv.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Диалог не найден" });
      }
      return db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(asc(messages.createdAt))
        .limit(200);
    }),

  removeConversation: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId));
      if (!conv || conv.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Диалог не найден" });
      }
      await db.delete(messages).where(eq(messages.conversationId, conv.id));
      await db.delete(conversations).where(eq(conversations.id, conv.id));
      return { ok: true };
    }),

  /** Быстрая статистика для приветственного экрана ассистента */
  hints: authedQuery.query(async () => {
    const db = getDb();
    const [partsCount] = await db
      .select({ total: sql<number>`count(*)` })
      .from(parts);
    const [pagesCount] = await db
      .select({ total: sql<number>`count(*)` })
      .from(docPages);
    return {
      parts: Number(partsCount?.total ?? 0),
      pages: Number(pagesCount?.total ?? 0),
    };
  }),
});
