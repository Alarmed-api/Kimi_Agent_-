import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Cpu,
  Loader2,
  MessageSquarePlus,
  Package,
  Send,
  Trash2,
} from "lucide-react";

interface Source {
  type: "part" | "page";
  fileName: string;
  ref: string;
  snippet: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[] | null;
}

const SUGGESTIONS = [
  "Найди фильтр LF3345 — цена и наличие",
  "Что есть в наличии по бренду Fleetguard?",
  "Найди в книгах момент затяжки головки блока",
  "Какие позиции дороже 10 000 ₽ есть на складе?",
];

export default function Assistant() {
  const utils = trpc.useUtils();
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [local, setLocal] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = trpc.assistant.conversations.useQuery();
  const hints = trpc.assistant.hints.useQuery();
  const history = trpc.assistant.messages.useQuery(
    { conversationId: conversationId! },
    { enabled: conversationId !== undefined },
  );

  const chat = trpc.assistant.chat.useMutation({
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setLocal((l) => [
        ...l.slice(0, -1),
        { role: "assistant", content: res.answer, sources: res.sources },
      ]);
      utils.assistant.conversations.invalidate();
      if (conversationId) utils.assistant.messages.invalidate({ conversationId });
    },
    onError: (err) => {
      const isQuota = err.message.includes("AI_UNAVAILABLE");
      setLocal((l) => [
        ...l.slice(0, -1),
        {
          role: "assistant",
          content: isQuota
            ? "Квота ИИ исчерпана — ассистент временно недоступен. Поиск по каталогу и библиотеке продолжает работать в обычном режиме."
            : `Не удалось получить ответ: ${err.message.replace("AI_ERROR: ", "")}. Попробуйте ещё раз.`,
        },
      ]);
    },
  });

  const removeConv = trpc.assistant.removeConversation.useMutation({
    onSuccess: () => {
      utils.assistant.conversations.invalidate();
      newChat();
    },
  });

  // Подгружаем историю выбранного диалога
  useEffect(() => {
    if (history.data) {
      setLocal(
        history.data.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources ? (JSON.parse(m.sources) as Source[]) : null,
        })),
      );
    }
  }, [history.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [local, chat.isPending]);

  const newChat = () => {
    setConversationId(undefined);
    setLocal([]);
    setInput("");
  };

  const send = (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || chat.isPending) return;
    setLocal((l) => [
      ...l,
      { role: "user", content: message },
      { role: "assistant", content: "__pending__" },
    ]);
    setInput("");
    chat.mutate({ conversationId, message });
  };

  const empty = local.length === 0;

  return (
    <div className="max-w-[1200px] mx-auto h-[calc(100vh-6rem)] flex gap-4">
      {/* Список диалогов */}
      <div className="hidden md:flex panel w-60 shrink-0 flex-col p-3">
        <Button
          onClick={newChat}
          variant="outline"
          className="w-full border-border font-mono text-xs uppercase tracking-wider mb-3"
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" /> Новый диалог
        </Button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.data?.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-md transition-colors ${
                conversationId === c.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() => {
                  setConversationId(c.id);
                  setLocal([]);
                }}
                className="flex-1 text-left text-xs px-2.5 py-2 truncate"
              >
                {c.title}
              </button>
              <button
                onClick={() => removeConv.mutate({ conversationId: c.id })}
                className="opacity-0 group-hover:opacity-100 px-2 text-muted-foreground hover:text-[#f87171] transition-opacity"
                title="Удалить диалог"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Чат */}
      <div className="panel flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <Cpu className="h-4 w-4 text-[#22d3ee]" />
          <span className="chrome-label">ИИ-ассистент базы знаний</span>
          <span className="status-dot ml-auto" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {empty && !history.isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 rounded-full border border-[#22d3ee]/40 flex items-center justify-center mb-4">
                <Cpu className="h-6 w-6 text-[#22d3ee]" />
              </div>
              <p className="font-medium mb-1">Спросите что-нибудь по базе</p>
              <p className="text-xs text-muted-foreground mb-6 max-w-sm">
                Ассистент ищет по {hints.data?.parts.toLocaleString("ru-RU") ?? "…"} позициям
                каталога и {hints.data?.pages.toLocaleString("ru-RU") ?? "…"} страницам
                документов, отвечает со ссылками на источники.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="empty-state text-left text-xs px-3 py-2.5 text-muted-foreground hover:text-foreground hover:border-[#22d3ee]/50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.isLoading && conversationId !== undefined ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            local.map((m, i) =>
              m.content === "__pending__" ? (
                <div key={i} className="chat-bubble-assistant chat-message-enter p-4 max-w-[85%]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-[#22d3ee]" />
                    <span className="font-mono text-xs">ищу в базе и формулирую ответ…</span>
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  className={`chat-message-enter p-4 max-w-[85%] ${
                    m.role === "user" ? "chat-bubble-user ml-auto" : "chat-bubble-assistant"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                      <p className="chrome-label !text-[10px]">Источники</p>
                      {m.sources.map((s, j) => (
                        <div key={j} className="flex items-start gap-2">
                          {s.type === "part" ? (
                            <Package className="h-3.5 w-3.5 text-[#34d399] shrink-0 mt-0.5" />
                          ) : (
                            <BookOpen className="h-3.5 w-3.5 text-[#fbbf24] shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <span className="font-mono text-[11px] text-[#22d3ee]">
                              {s.fileName}
                              {s.ref ? ` · ${s.ref}` : ""}
                            </span>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {s.snippet}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Вопрос по запчастям или документам… (Enter — отправить)"
              className="bg-[#050810] border-border text-sm min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              onClick={() => send()}
              disabled={!input.trim() || chat.isPending}
              className="shrink-0 h-11 w-11 p-0"
            >
              {chat.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
