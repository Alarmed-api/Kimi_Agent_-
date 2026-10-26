import { desc, gt, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { files, parts, docPages } from "../db/schema";

export const analyticsRouter = createRouter({
  overview: authedQuery.query(async () => {
    const db = getDb();

    const [fileStats] = await db
      .select({
        total: sql<number>`count(*)`,
        excel: sql<number>`sum(case when ${files.kind} = 'excel' then 1 else 0 end)`,
        pdf: sql<number>`sum(case when ${files.kind} = 'pdf' then 1 else 0 end)`,
        djvu: sql<number>`sum(case when ${files.kind} = 'djvu' then 1 else 0 end)`,
        ready: sql<number>`sum(case when ${files.status} = 'ready' then 1 else 0 end)`,
        error: sql<number>`sum(case when ${files.status} = 'error' then 1 else 0 end)`,
      })
      .from(files);

    const [partStats] = await db
      .select({
        total: sql<number>`count(*)`,
        inStock: sql<number>`sum(case when ${parts.stock} > 0 then 1 else 0 end)`,
        withPrice: sql<number>`sum(case when ${parts.price} is not null then 1 else 0 end)`,
        avgPrice: sql<string | null>`avg(${parts.price})`,
        minPrice: sql<string | null>`min(${parts.price})`,
        maxPrice: sql<string | null>`max(${parts.price})`,
        stockTotal: sql<number | null>`sum(${parts.stock})`,
        brands: sql<number>`count(distinct ${parts.brand})`,
        categories: sql<number>`count(distinct ${parts.category})`,
      })
      .from(parts);

    const [pageStats] = await db
      .select({ total: sql<number>`count(*)` })
      .from(docPages);

    const stockValue = await db
      .select({
        value: sql<string | null>`sum(${parts.price} * ${parts.stock})`,
      })
      .from(parts)
      .where(gt(parts.stock, 0));

    return {
      files: {
        total: Number(fileStats?.total ?? 0),
        excel: Number(fileStats?.excel ?? 0),
        pdf: Number(fileStats?.pdf ?? 0),
        djvu: Number(fileStats?.djvu ?? 0),
        ready: Number(fileStats?.ready ?? 0),
        error: Number(fileStats?.error ?? 0),
      },
      parts: {
        total: Number(partStats?.total ?? 0),
        inStock: Number(partStats?.inStock ?? 0),
        withPrice: Number(partStats?.withPrice ?? 0),
        avgPrice: partStats?.avgPrice ? Number(partStats.avgPrice) : null,
        minPrice: partStats?.minPrice ? Number(partStats.minPrice) : null,
        maxPrice: partStats?.maxPrice ? Number(partStats.maxPrice) : null,
        stockTotal: Number(partStats?.stockTotal ?? 0),
        brands: Number(partStats?.brands ?? 0),
        categories: Number(partStats?.categories ?? 0),
      },
      pages: Number(pageStats?.total ?? 0),
      stockValue: stockValue[0]?.value ? Number(stockValue[0].value) : null,
    };
  }),

  byBrand: authedQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        brand: parts.brand,
        count: sql<number>`count(*)`,
        stock: sql<number | null>`sum(${parts.stock})`,
        avgPrice: sql<string | null>`avg(${parts.price})`,
      })
      .from(parts)
      .where(sql`${parts.brand} != ''`)
      .groupBy(parts.brand)
      .orderBy(desc(sql`count(*)`))
      .limit(12);
    return rows.map((r) => ({
      brand: r.brand,
      count: Number(r.count),
      stock: Number(r.stock ?? 0),
      avgPrice: r.avgPrice ? Math.round(Number(r.avgPrice)) : null,
    }));
  }),

  byCategory: authedQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        category: parts.category,
        count: sql<number>`count(*)`,
        stock: sql<number | null>`sum(${parts.stock})`,
      })
      .from(parts)
      .where(sql`${parts.category} != ''`)
      .groupBy(parts.category)
      .orderBy(desc(sql`count(*)`))
      .limit(12);
    return rows.map((r) => ({
      category: r.category,
      count: Number(r.count),
      stock: Number(r.stock ?? 0),
    }));
  }),

  priceDistribution: authedQuery.query(async () => {
    const db = getDb();
    const bounds = [500, 1000, 5000, 10000, 50000];
    const labels = [
      "до 500",
      "500–1 000",
      "1 000–5 000",
      "5 000–10 000",
      "10 000–50 000",
      "50 000+",
    ];
    const rows = await db
      .select({
        bucket: sql<number>`case
          when ${parts.price} < ${bounds[0]} then 0
          when ${parts.price} < ${bounds[1]} then 1
          when ${parts.price} < ${bounds[2]} then 2
          when ${parts.price} < ${bounds[3]} then 3
          when ${parts.price} < ${bounds[4]} then 4
          else 5 end`,
        count: sql<number>`count(*)`,
      })
      .from(parts)
      .where(sql`${parts.price} is not null`)
      .groupBy(sql`1`);
    const counts = new Array(6).fill(0);
    for (const r of rows) counts[Number(r.bucket)] = Number(r.count);
    return labels.map((label, i) => ({ label, count: counts[i] }));
  }),

  recentFiles: authedQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: files.id,
        name: files.name,
        kind: files.kind,
        status: files.status,
        partsCount: files.partsCount,
        pagesCount: files.pagesCount,
        createdAt: files.createdAt,
      })
      .from(files)
      .orderBy(desc(files.createdAt))
      .limit(6);
  }),

  /** Топ позиций по складской стоимости (цена × остаток) */
  topStockValue: authedQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: parts.id,
        article: parts.article,
        name: parts.name,
        brand: parts.brand,
        price: parts.price,
        stock: parts.stock,
        currency: parts.currency,
        value: sql<string>`${parts.price} * ${parts.stock}`,
      })
      .from(parts)
      .where(gt(parts.stock, 0))
      .orderBy(desc(sql`${parts.price} * ${parts.stock}`))
      .limit(8);
    return rows
      .filter((r) => r.price !== null)
      .map((r) => ({ ...r, value: Number(r.value) }));
  }),
});
