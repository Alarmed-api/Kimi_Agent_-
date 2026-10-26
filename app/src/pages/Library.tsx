import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";

/** Подсветка терминов запроса в сниппете */
function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "giu",
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export default function Library() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [fileId, setFileId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [reader, setReader] = useState<{ fileId: number; page: number } | null>(null);

  const books = trpc.library.books.useQuery();
  const search = trpc.library.search.useQuery(
    { q: query, fileId, page, pageSize: 20 },
    { enabled: query.length >= 2 },
  );
  const pageText = trpc.library.pageText.useQuery(reader!, { enabled: !!reader });

  const PAGE_SIZE = 20;
  const totalPages = search.data ? Math.max(1, Math.ceil(search.data.total / PAGE_SIZE)) : 1;

  const runSearch = () => {
    setPage(1);
    setQuery(q.trim());
  };

  const selectedBook = books.data?.find((b) => b.id === fileId);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div>
        <p className="chrome-label mb-1">Книги и документы</p>
        <h1 className="text-2xl font-bold tracking-tight">Библиотека</h1>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">
        {/* Список книг */}
        <div className="panel p-3 space-y-1.5">
          <p className="chrome-label px-1 pb-2">Документы ({books.data?.length ?? 0})</p>
          <button
            onClick={() => {
              setFileId(undefined);
              setPage(1);
            }}
            className={`w-full text-left text-xs px-2.5 py-2 rounded-md transition-colors ${
              fileId === undefined
                ? "bg-accent text-[#22d3ee]"
                : "hover:bg-accent/50 text-muted-foreground"
            }`}
          >
            Все документы
          </button>
          {books.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)
          ) : (
            books.data?.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setFileId(b.id);
                  setPage(1);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                  fileId === b.id ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  {b.kind === "pdf" ? (
                    <FileText className="h-3.5 w-3.5 text-[#22d3ee] shrink-0" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5 text-[#fbbf24] shrink-0" />
                  )}
                  <span className="text-xs truncate">{b.name}</span>
                </span>
                <span className="block font-mono text-[10px] text-muted-foreground mt-0.5 pl-5">
                  {b.pagesCount.toLocaleString("ru-RU")} стр. ·{" "}
                  {(b.size / 1024 / 1024).toFixed(1)} МБ
                </span>
              </button>
            ))
          )}
        </div>

        {/* Поиск */}
        <div className="space-y-3">
          <div className="panel p-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder={
                  selectedBook
                    ? `Поиск в «${selectedBook.name}»…`
                    : "Полнотекстовый поиск по всем книгам…"
                }
                className="pl-9 bg-[#050810] border-border text-sm"
              />
            </div>
            <Button onClick={runSearch} className="font-mono uppercase tracking-wider text-xs">
              Найти
            </Button>
          </div>

          {query.length >= 2 && (
            <div className="panel">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="chrome-label">
                  {search.data
                    ? `Совпадений: ${search.data.total.toLocaleString("ru-RU")}${search.data.truncated ? "+" : ""}`
                    : "Поиск…"}
                </span>
                {search.data && search.data.total > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    стр. {page} / {totalPages}
                  </span>
                )}
              </div>

              {search.isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : search.data && search.data.rows.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {search.data.rows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setReader({ fileId: r.fileId, page: r.page })}
                      className="w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] text-[#22d3ee] truncate">
                          {r.fileName}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                          стр. {r.page}
                        </span>
                      </div>
                      <p className="snippet text-[13px] text-muted-foreground leading-relaxed">
                        <Highlighted text={r.snippet} query={query} />
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state m-4 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Совпадений не найдено. Учтите: сканы без текстового слоя (OCR)
                    не индексируются.
                  </p>
                </div>
              )}

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
          )}

          {query.length < 2 && (
            <div className="empty-state p-10 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Введите запрос — поиск идёт по тексту всех страниц PDF и DjVu.
                Выберите документ слева, чтобы искать только в нём.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Чтение страницы */}
      <Dialog open={!!reader} onOpenChange={(open) => !open && setReader(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0c1220] border-border">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-[#22d3ee]">
              {pageText.data?.fileName} — стр. {reader?.page}
            </DialogTitle>
          </DialogHeader>
          {pageText.isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <p className="snippet text-sm leading-relaxed whitespace-pre-wrap">
                <Highlighted text={pageText.data?.content || "Текст страницы отсутствует"} query={query} />
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!reader || reader.page <= 1}
                  onClick={() => reader && setReader({ ...reader, page: reader.page - 1 })}
                  className="border-border"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Пред.
                </Button>
                <span className="font-mono text-xs text-muted-foreground">
                  {reader?.page} / {pageText.data?.pagesCount ?? "?"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pageText.data || (reader?.page ?? 0) >= pageText.data.pagesCount}
                  onClick={() => reader && setReader({ ...reader, page: reader.page + 1 })}
                  className="border-border"
                >
                  След. <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
