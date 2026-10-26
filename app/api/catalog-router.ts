import { z } from "zod";
import { and, asc, desc, eq, gt, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { parts, files } from "../db/schema";
import { escapeLike, termsOf } from "./lib/search";
import { normalizeArticle } from "./lib/parsers/excel";

const sortOptions = ["relevance", "priceAsc", "priceDesc", "nameAsc"] as const;

export const catalogRouter = createRouter({
  search: authedQuery
    .input(
      z.object({
        q: z.string().max(300).default(""),
        brand: z.string().max(255).optional(),
        category: z.string().max(255).optional(),
        inStock: z.boolean().optional(),
        priceMin: z.number().min(0).optional(),
        priceMax: z.number().min(0).optional(),
        sort: z.enum(sortOptions).default("relevance"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(25),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds: SQL[] = [];

      const q = input.q.trim();
      const terms = termsOf(q);
      const norm = normalizeArticle(q);
      if (q) {
        const escaped = escapeLike(q);
        const qConds: SQL[] = [
          like(parts.article, `%${escaped}%`),
          like(parts.name, `%${escaped}%`),
          like(parts.brand, `%${escaped}%`),
          like(parts.applicability, `%${escaped}%`),
        ];
        if (norm.length >= 3) {
          qConds.push(like(parts.articleNorm, `%${escapeLike(norm)}%`));
        }
        // Многословный запрос: все слова должны встречаться в имени/применяемости,
        // либо запрос целиком совпадает с артикулом
        if (terms.length > 1) {
          const wordConds = terms.map((t) =>
            or(
              like(parts.name, `%${escapeLike(t)}%`),
              like(parts.applicability, `%${escapeLike(t)}%`),
              like(parts.brand, `%${escapeLike(t)}%`),
            ),
          );
          qConds.push(and(...wordConds)!);
        }
        conds.push(or(...qConds)!);
      }
      if (input.brand) conds.push(eq(parts.brand, input.brand));
      if (input.category) conds.push(eq(parts.category, input.category));
      if (input.inStock) conds.push(gt(parts.stock, 0));
      if (input.priceMin !== undefined)
        conds.push(gte(parts.price, String(input.priceMin)));
      if (input.priceMax !== undefined)
        conds.push(lte(parts.price, String(input.priceMax)));

      const where = conds.length ? and(...conds) : undefined;

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(parts)
        .where(where);

      const orderBy =
        input.sort === "priceAsc"
          ? [asc(parts.price)]
          : input.sort === "priceDesc"
            ? [desc(parts.price)]
            : input.sort === "nameAsc"
              ? [asc(parts.name)]
              : q && norm.length >= 3
                ? [
                    desc(
                      sql`case when ${parts.articleNorm} = ${norm} then 1 else 0 end`,
                    ),
                    asc(parts.name),
                  ]
                : [asc(parts.name)];

      const rows = await db
        .select({
          id: parts.id,
          article: parts.article,
          name: parts.name,
          brand: parts.brand,
          category: parts.category,
          applicability: parts.applicability,
          price: parts.price,
          currency: parts.currency,
          stock: parts.stock,
          sheet: parts.sheet,
          fileId: parts.fileId,
          fileName: files.name,
        })
        .from(parts)
        .leftJoin(files, eq(parts.fileId, files.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return { rows, total: Number(total), page: input.page, pageSize: input.pageSize };
    }),

  facets: authedQuery.query(async () => {
    const db = getDb();
    const brands = await db
      .select({ value: parts.brand, count: sql<number>`count(*)` })
      .from(parts)
      .where(sql`${parts.brand} != ''`)
      .groupBy(parts.brand)
      .orderBy(desc(sql`count(*)`))
      .limit(100);
    const categories = await db
      .select({ value: parts.category, count: sql<number>`count(*)` })
      .from(parts)
      .where(sql`${parts.category} != ''`)
      .groupBy(parts.category)
      .orderBy(desc(sql`count(*)`))
      .limit(100);
    const [priceRange] = await db
      .select({
        min: sql<string | null>`min(${parts.price})`,
        max: sql<string | null>`max(${parts.price})`,
      })
      .from(parts);
    return {
      brands: brands.map((b) => ({ value: b.value, count: Number(b.count) })),
      categories: categories.map((c) => ({ value: c.value, count: Number(c.count) })),
      priceMin: priceRange?.min ? Number(priceRange.min) : 0,
      priceMax: priceRange?.max ? Number(priceRange.max) : 0,
    };
  }),

  partById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select({
          part: parts,
          fileName: files.name,
        })
        .from(parts)
        .leftJoin(files, eq(parts.fileId, files.id))
        .where(eq(parts.id, input.id));
      return row ?? null;
    }),
});
