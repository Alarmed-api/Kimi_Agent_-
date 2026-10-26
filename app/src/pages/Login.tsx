import { Button } from "@/components/ui/button";
import { Cpu } from "lucide-react";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="panel w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="status-dot" />
          <span className="font-mono text-xl font-bold tracking-[0.18em] uppercase">
            ПартсБаза
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Корпоративная база знаний: каталог запчастей из Excel-прайсов,
          техническая литература (PDF, DjVu), быстрый поиск, аналитика и
          ИИ-ассистент.
        </p>

        <div className="space-y-3 mb-8">
          {[
            "Поиск по артикулам, ценам и остаткам",
            "Полнотекстовый поиск по книгам со сниппетами",
            "Аналитика ассортимента и складских запасов",
            "ИИ-ассистент с ответами по базе и источниками",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <Cpu className="h-3.5 w-3.5 text-[#22d3ee] shrink-0" />
              <span className="text-xs text-muted-foreground">{f}</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full font-mono uppercase tracking-wider"
          size="lg"
          onClick={() => {
            window.location.href = getOAuthUrl();
          }}
        >
          Войти через Kimi
        </Button>
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Доступ предоставляется сотрудникам компании
        </p>
      </div>
    </div>
  );
}
