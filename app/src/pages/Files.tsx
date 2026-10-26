import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  Trash2,
} from "lucide-react";

const ACCEPT = ".xlsx,.xls,.xlsm,.csv,.pdf,.djvu,.djv";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function kindIcon(kind: string) {
  if (kind === "excel") return <FileSpreadsheet className="h-4 w-4 text-[#34d399] shrink-0" />;
  if (kind === "pdf") return <FileText className="h-4 w-4 text-[#22d3ee] shrink-0" />;
  return <BookOpen className="h-4 w-4 text-[#fbbf24] shrink-0" />;
}

function statusLabel(status: string) {
  if (status === "ready") return { text: "Готов", cls: "" };
  if (status === "error") return { text: "Ошибка", cls: "crit" };
  return { text: "Обработка", cls: "warn" };
}

export default function Files() {
  const utils = trpc.useUtils();
  const list = trpc.files.list.useQuery();
  const me = trpc.auth.me.useQuery();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = trpc.files.upload.useMutation({
    onSuccess: (file) => {
      setUploading((u) => u.filter((n) => n !== file.name));
      utils.files.list.invalidate();
      utils.analytics.overview.invalidate();
      utils.library.books.invalidate();
      utils.catalog.facets.invalidate();
      if (file.status === "ready") {
        toast.success(`«${file.name}» обработан`, {
          description:
            file.kind === "excel"
              ? `Позиций: ${file.partsCount.toLocaleString("ru-RU")}`
              : `Страниц: ${file.pagesCount.toLocaleString("ru-RU")}`,
        });
      } else {
        toast.error(`«${file.name}»: ошибка обработки`, {
          description: file.error ?? undefined,
        });
      }
    },
    onError: (err, vars) => {
      setUploading((u) => u.filter((n) => n !== vars.name));
      toast.error(`Не удалось загрузить «${vars.name}»`, { description: err.message });
    },
  });

  const remove = trpc.files.remove.useMutation({
    onSuccess: () => {
      toast.success("Файл удалён");
      setDeleteId(null);
      utils.files.list.invalidate();
      utils.analytics.overview.invalidate();
      utils.library.books.invalidate();
      utils.catalog.facets.invalidate();
    },
    onError: (err) => toast.error("Ошибка удаления", { description: err.message }),
  });


  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      if (file.size > 35 * 1024 * 1024) {
        toast.error(`«${file.name}» больше 35 МБ — такие файлы пока не поддерживаются`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const contentBase64 = await fileToBase64(file);
        upload.mutate({ name: file.name, contentBase64 });
      } catch {
        setUploading((u) => u.filter((n) => n !== file.name));
        toast.error(`Не удалось прочитать «${file.name}»`);
      }
    }
  };

  const downloadFile = async (id: number) => {
    try {
      const { url } = await utils.files.url.fetch({ id });
      window.open(url, "_blank");
    } catch {
      toast.error("Не удалось получить ссылку на файл");
    }
  };


  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      <div>
        <p className="chrome-label mb-1">Управление базой</p>
        <h1 className="text-2xl font-bold tracking-tight">Файлы</h1>
      </div>

      {/* Дропзона */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`empty-state p-10 text-center cursor-pointer transition-colors ${
          dragOver ? "border-[#22d3ee] bg-[#22d3ee]/5" : "hover:border-[#22d3ee]/50"
        }`}
      >
        <FileUp className="h-8 w-8 mx-auto mb-3 text-[#22d3ee]" />
        <p className="text-sm font-medium">
          Перетащите файлы сюда или нажмите для выбора
        </p>
        <p className="font-mono text-xs text-muted-foreground mt-2">
          Excel (.xlsx, .xls, .csv) · PDF · DjVu · до 35 МБ на файл
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploading.length > 0 && (
        <div className="panel p-3 space-y-2">
          {uploading.map((name) => (
            <div key={name} className="flex items-center gap-3 px-2 py-1.5">
              <Loader2 className="h-4 w-4 animate-spin text-[#fbbf24]" />
              <span className="text-xs truncate">{name}</span>
              <span className="font-mono text-[10px] text-muted-foreground ml-auto shrink-0">
                загрузка и индексация…
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Список файлов */}
      <div className="panel">
        <div className="px-4 py-2.5 border-b border-border">
          <span className="chrome-label">
            Загруженные файлы ({list.data?.length ?? 0})
          </span>
        </div>
        {list.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : list.data && list.data.length > 0 ? (
          <div className="divide-y divide-border/50">
            {list.data.map((f) => {
              const st = statusLabel(f.status);
              const canDelete = me.data?.id === f.ownerId || me.data?.role === "admin";
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  {kindIcon(f.kind)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{f.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                      {(f.size / 1024 / 1024).toFixed(2)} МБ
                      {f.kind === "excel"
                        ? ` · ${f.partsCount.toLocaleString("ru-RU")} позиций · ${f.sheetsCount} лист.`
                        : ` · ${f.pagesCount.toLocaleString("ru-RU")} стр.`}
                      {" · "}
                      {f.ownerName ?? "—"} · {new Date(f.createdAt).toLocaleDateString("ru-RU")}
                    </p>
                    {f.error && (
                      <p
                        className={`text-[11px] mt-0.5 ${
                          f.status === "error" ? "text-[#f87171]" : "text-[#fbbf24]"
                        }`}
                      >
                        {f.error}
                      </p>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className={`status-dot ${st.cls}`} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {st.text}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFile(f.id)}
                    className="shrink-0 text-muted-foreground hover:text-[#22d3ee]"
                    title="Скачать оригинал"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(f.id)}
                      className="shrink-0 text-muted-foreground hover:text-[#f87171]"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state m-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Файлов пока нет. Загрузите Excel-прайсы и книги — после обработки
              они станут доступны для поиска и аналитики всей команде.
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0c1220] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
            <AlertDialogDescription>
              Файл и все извлечённые из него данные (позиции каталога или страницы)
              будут удалены из базы без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && remove.mutate({ id: deleteId })}
              className="bg-[#f87171] text-[#050810] hover:bg-[#f87171]/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
