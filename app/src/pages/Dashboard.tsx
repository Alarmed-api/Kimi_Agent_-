import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router";
import { ArrowRight, FileSpreadsheet, FileText, BookOpen } from "lucide-react";

const KIND_COLORS = ["#22d3ee", "#34d399", "#fbbf24"];

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("ru-RU") + suffix;
}

function kindIcon(kind: string) {
  if (kind === "excel") return <FileSpreadsheet className="h-4 w-4 text-[#34d399]" />;
  if (kind === "pdf") return <FileText className="h-4 w-4 text-[#22d3ee]" />;
  return <BookOpen className="h-4 w-4 text-[#fbbf24]" />;
}

export default function Dashboard() {
  const overview = trpc.analytics.overview.useQuery();
  const byBrand = trpc.analytics.byBrand.useQuery();
  const byCategory = trpc.analytics.byCategory.useQuery();
  const priceDist = trpc.analytics.priceDistribution.useQuery();
  const recent = trpc.analytics.recentFiles.useQuery();
  const topValue = trpc.analytics.topStockValue.useQuery();

  const o = overview.data;

  const fileKindData = o
    ? [
        { name: "Excel", value: o.files.excel },
        { name: "PDF", value: o.files.pdf },
        { name: "DjVu", value: o.files.djvu },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="chrome-label mb-1">Обзор базы знаний</p>
          <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
        </div>
        <div className="flex items-center gap-2 panel px-3 py-1.5">
          <span className={`status-dot ${o && o.files.error > 0 ? "crit" : ""}`} />
          <span className="font-mono text-xs text-muted-foreground">
            {o ? `${o.files.ready} файлов активно` : "загрузка…"}
          </span>
        </div>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {overview.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))
        ) : (
          <>
            <div className="stat-card p-4">
              <p className="chrome-label">Позиций в каталоге</p>
              <p className="font-mono text-3xl font-bold mt-2">{fmt(o?.parts.total)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmt(o?.parts.brands)} брендов · {fmt(o?.parts.categories)} категорий
              </p>
            </div>
            <div className="stat-card ok p-4">
              <p className="chrome-label">В наличии</p>
              <p className="font-mono text-3xl font-bold mt-2 text-[#34d399]">
                {fmt(o?.parts.inStock)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmt(o?.parts.stockTotal, " шт.")} суммарно
              </p>
            </div>
            <div className="stat-card warn p-4">
              <p className="chrome-label">Средняя цена</p>
              <p className="font-mono text-3xl font-bold mt-2 text-[#fbbf24]">
                {o?.parts.avgPrice ? `${fmt(Math.round(o.parts.avgPrice))} ₽` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmt(o?.parts.minPrice)} — {fmt(o?.parts.maxPrice)} ₽
              </p>
            </div>
            <div className="stat-card p-4">
              <p className="chrome-label">Страниц в книгах</p>
              <p className="font-mono text-3xl font-bold mt-2">{fmt(o?.pages)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmt((o?.files.pdf ?? 0) + (o?.files.djvu ?? 0))} документов PDF/DjVu
              </p>
            </div>
          </>
        )}
      </div>

      {o && o.stockValue !== null && (
        <div className="panel px-4 py-3 flex items-center justify-between">
          <span className="chrome-label">Оценка складских запасов (цена × остаток)</span>
          <span className="font-mono text-xl font-bold text-[#22d3ee]">
            {fmt(Math.round(o.stockValue))} ₽
          </span>
        </div>
      )}

      {/* Графики */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="panel p-4 lg:col-span-2">
          <p className="chrome-label mb-4">Топ брендов по числу позиций</p>
          {byBrand.isLoading ? (
            <Skeleton className="h-64" />
          ) : byBrand.data && byBrand.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byBrand.data} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid stroke="#1a2540" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} fontFamily="JetBrains Mono" />
                <YAxis
                  type="category"
                  dataKey="brand"
                  width={130}
                  stroke="#94a3b8"
                  fontSize={11}
                  fontFamily="JetBrains Mono"
                />
                <Tooltip
                  contentStyle={{
                    background: "#111a2b",
                    border: "1px solid #1a2540",
                    borderRadius: 8,
                    fontFamily: "JetBrains Mono",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString("ru-RU"),
                    name === "count" ? "Позиций" : name,
                  ]}
                />
                <Bar dataKey="count" fill="#22d3ee" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="Загрузите Excel-прайсы — статистика по брендам появится здесь" />
          )}
        </div>

        <div className="panel p-4">
          <p className="chrome-label mb-4">Состав базы</p>
          {overview.isLoading ? (
            <Skeleton className="h-64" />
          ) : fileKindData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={fileKindData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  strokeWidth={2}
                  stroke="#050810"
                >
                  {fileKindData.map((_, i) => (
                    <Cell key={i} fill={KIND_COLORS[i % KIND_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#111a2b",
                    border: "1px solid #1a2540",
                    borderRadius: 8,
                    fontFamily: "JetBrains Mono",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="Пока нет файлов" />
          )}
          {fileKindData.length > 0 && (
            <div className="flex justify-center gap-4 mt-2">
              {fileKindData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: KIND_COLORS[i % KIND_COLORS.length] }}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {d.name} · {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="panel p-4">
          <p className="chrome-label mb-4">Распределение цен, ₽</p>
          {priceDist.isLoading ? (
            <Skeleton className="h-56" />
          ) : priceDist.data && priceDist.data.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={priceDist.data} margin={{ left: -16, right: 8 }}>
                <CartesianGrid stroke="#1a2540" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={10}
                  fontFamily="JetBrains Mono"
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#94a3b8" fontSize={11} fontFamily="JetBrains Mono" />
                <Tooltip
                  contentStyle={{
                    background: "#111a2b",
                    border: "1px solid #1a2540",
                    borderRadius: 8,
                    fontFamily: "JetBrains Mono",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value.toLocaleString("ru-RU"), "Позиций"]}
                />
                <Bar dataKey="count" fill="#fbbf24" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="Нет данных о ценах" />
          )}
        </div>

        <div className="panel p-4">
          <p className="chrome-label mb-4">Категории</p>
          {byCategory.isLoading ? (
            <Skeleton className="h-56" />
          ) : byCategory.data && byCategory.data.length > 0 ? (
            <div className="space-y-2">
              {byCategory.data.slice(0, 8).map((c) => {
                const max = byCategory.data[0].count;
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="truncate mr-2">{c.category}</span>
                      <span className="font-mono text-muted-foreground shrink-0">
                        {c.count.toLocaleString("ru-RU")}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#111a2b] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#34d399] rounded-full"
                        style={{ width: `${Math.max(3, (c.count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart text="Категории не заполнены в прайсах" />
          )}
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="chrome-label">Последние файлы</p>
            <Link
              to="/files"
              className="font-mono text-xs text-[#22d3ee] hover:underline flex items-center gap-1"
            >
              все <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recent.isLoading ? (
            <Skeleton className="h-56" />
          ) : recent.data && recent.data.length > 0 ? (
            <div className="space-y-2.5">
              {recent.data.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 min-w-0">
                  {kindIcon(f.kind)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{f.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {f.kind === "excel"
                        ? `${f.partsCount.toLocaleString("ru-RU")} позиций`
                        : `${f.pagesCount.toLocaleString("ru-RU")} стр.`}
                      {" · "}
                      {new Date(f.createdAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <span
                    className={`status-dot shrink-0 ${
                      f.status === "ready" ? "" : f.status === "error" ? "crit" : "warn"
                    }`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart text="Загрузите первый файл на странице «Файлы»" />
          )}
        </div>
      </div>

      {/* Топ по складской стоимости */}
      {topValue.data && topValue.data.length > 0 && (
        <div className="panel p-4">
          <p className="chrome-label mb-4">Самые ценные складские позиции</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="chrome-label text-left py-2 pr-4">Артикул</th>
                  <th className="chrome-label text-left py-2 pr-4">Наименование</th>
                  <th className="chrome-label text-right py-2 pr-4">Цена</th>
                  <th className="chrome-label text-right py-2 pr-4">Остаток</th>
                  <th className="chrome-label text-right py-2">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {topValue.data.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-accent/40 transition-colors">
                    <td className="font-mono text-xs py-2 pr-4 text-[#22d3ee]">{p.article || "—"}</td>
                    <td className="py-2 pr-4 max-w-[320px] truncate">{p.name || "—"}</td>
                    <td className="font-mono text-xs text-right py-2 pr-4">
                      {p.price ? `${Number(p.price).toLocaleString("ru-RU")} ${p.currency}` : "—"}
                    </td>
                    <td className="font-mono text-xs text-right py-2 pr-4">{p.stock ?? "—"}</td>
                    <td className="font-mono text-xs text-right py-2 text-[#34d399]">
                      {p.value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} {p.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="empty-state h-56 flex items-center justify-center">
      <p className="text-xs text-muted-foreground text-center px-6">{text}</p>
    </div>
  );
}
