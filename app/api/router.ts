import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { filesRouter } from "./files-router";
import { catalogRouter } from "./catalog-router";
import { libraryRouter } from "./library-router";
import { analyticsRouter } from "./analytics-router";
import { assistantRouter } from "./assistant-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  files: filesRouter,
  catalog: catalogRouter,
  library: libraryRouter,
  analytics: analyticsRouter,
  assistant: assistantRouter,
});

export type AppRouter = typeof appRouter;
