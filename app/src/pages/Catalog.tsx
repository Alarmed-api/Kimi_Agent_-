import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, PackageX } from "lucide-react";

const PAGE_SIZE = 25;

export default function Catalog() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [inStock, setInStock] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState<"relevance" | "priceAsc" | "priceDesc" | "nameAsc">("relevance");
  const [page, setPage] = useState(1);

  const facets = trpc.catalog.facets.useQuery();
  const search = trpc.catalog.search.useQuery({
    q: query,
    brand: brand || undefined,
    category: category || undefined,
    inStock: inStock || undefined,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = search.data ? Math.max(1, Math.ceil(search.data.total / PAGE_SIZE)) : 1;

  const runSearch = () => {
    setPage(1);
    setQuery(q.trim());
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div>
        <p className="chrome-label mb-1">Поиск по запчастям</p>
        <h1 className="text-2xl font-bold tracking-tight">Каталог</h1>
      </div>

      {/* Строка поиска */}
      <div className="panel p-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Артикул, название детали, бренд, применяемость…"
            className="pl-9 bg-[#050810] border-border font-mono text-sm"
          />
        </div>
        <Button onClick={runSearch} className="font-mono uppercase tracking-wider text-xs">
          Найти
        </Button>
      </div>

      {/* Фильтры */}
      <div className="panel p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Select
          value={brand}
          onValueChange={(v) => {
            setBrand(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-[#050810] border-border text-xs">
            <SelectValue placeholder="Бренд" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все бренды</SelectItem>
            {(facets.data?.brands ?? []).map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.value} ({b.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-[#050810] border-border text-xs">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все категории</SelectItem>
            {(facets.data?.categories ?? []).map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.value} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={priceMin}
          onChange={(e) => setPriceMin(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Цена от"
          className="bg-[#050810] border-border text-xs font-mono"
        />
        <Input
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Цена до"
          className="bg-[#050810] border-border text-xs font-mono"
        />

        <button
          onClick={() => {
            setInStock(!inStock);
            setPage(1);
          }}
          className={`text-xs font-mono uppercase tracking-wider rounded-md border px-3 py-2 transition-colors ${
            inStock
              ? "border-[#34d399] text-[#34d399] bg-[#34d399]/10"
              : "border-border text-muted-foreground hover:border-[#34d399]/50"
          }`}
        >
          В наличии
        </button>

        <Select
          value={sort}
          onValueChange={(v) => setSort(v as typeof sort)}
        >
          <SelectTrigger className="bg-[#050810] border-border text-xs">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">По релевантности</SelectItem>
            <SelectItem value="priceAsc">Цена: сначала дешевле</SelectItem>
            <SelectItem value="priceDesc">Цена: сначала дороже</SelectItem>
            <SelectItem value="nameAsc">По названию</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Результаты */}
      <div className="panel">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="chrome-label">
            {search.data
              ? `Найдено: ${search.data.total.toLocaleString("ru-RU")}`
              : "Поиск…"}
          </span>
          {search.data && search.data.total > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              стр. {page} / {totalPages}
            </span>
          )}
        </div>

        {search.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : search.data && search.data.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="chrome-label text-left px-4 py-2">Артикул</th>
                  <th className="chrome-label text-left px-4 py-2">Наименование</th>
                  <th className="chrome-label text-left px-4 py-2">Бренд</th>
                  <th className="chrome-label text-right px-4 py-2">Цена</th>
                  <th className="chrome-label text-center px-4 py-2">Остаток</th>
                  <th className="chrome-label text-left px-4 py-2">Источник</th>
                </tr>
              </thead>
              <tbody>
                {search.data.rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 hover:bg-accent/40 transition-colors"
                  >
                    <td className="font-mono text-xs px-4 py-2.5 text-[#22d3ee] whitespace-nowrap">
                      {p.article || "—"}
                    </td>
                    <td className="px-4 py-2.5 max-w-[380px]">
                      <span className="line-clamp-2 text-[13px]">{p.name || "—"}</span>
                      {p.applicability && (
                        <span className="block text-[11px] text-muted-foreground line-clamp-1">
                          {p.applicability}
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-xs px-4 py-2.5 whitespace-nowrap">
                      {p.brand || "—"}
                    </td>
                    <td className="font-mono text-xs px-4 py-2.5 text-right whitespace-nowrap">
                      {p.price !== null
                        ? `${Number(p.price).toLocaleString("ru-RU")} ${p.currency}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.stock === null ? (
                        <span className="font-mono text-xs text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono text-xs ${
                            p.stock > 0 ? "text-[#34d399]" : "text-[#f87171]"
                          }`}
                        >
                          <span
                            className={`status-dot ${p.stock > 0 ? "" : "crit"}`}
                            style={{ width: 6, height: 6 }}
                          />
                          {p.stock}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      <span
                        className="block truncate font-mono text-[10px] text-muted-foreground"
                        title={p.fileName ?? ""}
                      >
                        {p.fileName}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state m-4 p-10 flex flex-col items-center gap-3">
            <PackageX className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {query
                ? "Ничего не найдено. Попробуйте изменить запрос или снять фильтры."
                : "Введите запрос — поиск идёт по артикулам, названиям, брендам и применяемости."}
            </p>
          </div>
        )}

        {/* Пагинация */}
        {search.data && search.data.total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="border-border"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="border-border"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
