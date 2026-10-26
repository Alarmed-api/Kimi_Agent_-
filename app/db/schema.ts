import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  mediumtext,
  timestamp,
  bigint,
  int,
  decimal,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Загруженные файлы базы знаний (Excel-прайсы и книги PDF/DjVu) */
export const files = mysqlTable(
  "files",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 512 }).notNull().unique(),
    name: varchar("name", { length: 512 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    kind: mysqlEnum("kind", ["excel", "pdf", "djvu"]).notNull(),
    status: mysqlEnum("status", ["processing", "ready", "error"])
      .default("processing")
      .notNull(),
    error: text("error"),
    partsCount: int("partsCount").default(0).notNull(),
    pagesCount: int("pagesCount").default(0).notNull(),
    sheetsCount: int("sheetsCount").default(0).notNull(),
    ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("files_status_idx").on(table.status),
    ownerIdx: index("files_owner_idx").on(table.ownerId),
  }),
);

export type DbFile = typeof files.$inferSelect;

/** Строки каталога запчастей, извлечённые из Excel-файлов */
export const parts = mysqlTable(
  "parts",
  {
    id: serial("id").primaryKey(),
    fileId: bigint("fileId", { mode: "number", unsigned: true }).notNull(),
    article: varchar("article", { length: 255 }).default("").notNull(),
    articleNorm: varchar("articleNorm", { length: 255 }).default("").notNull(),
    name: text("name"),
    brand: varchar("brand", { length: 255 }).default("").notNull(),
    category: varchar("category", { length: 255 }).default("").notNull(),
    applicability: text("applicability"),
    price: decimal("price", { precision: 14, scale: 2 }),
    currency: varchar("currency", { length: 16 }).default("₽").notNull(),
    stock: int("stock"),
    sheet: varchar("sheet", { length: 255 }).default("").notNull(),
    extra: text("extra"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    articleIdx: index("parts_article_idx").on(table.articleNorm),
    brandIdx: index("parts_brand_idx").on(table.brand),
    fileIdx: index("parts_file_idx").on(table.fileId),
  }),
);

export type Part = typeof parts.$inferSelect;

/** Текстовые страницы книг (PDF/DjVu) для полнотекстового поиска */
export const docPages = mysqlTable(
  "doc_pages",
  {
    id: serial("id").primaryKey(),
    fileId: bigint("fileId", { mode: "number", unsigned: true }).notNull(),
    page: int("page").notNull(),
    content: mediumtext("content").notNull(),
  },
  (table) => ({
    fileIdx: index("doc_pages_file_idx").on(table.fileId),
  }),
);

export type DocPage = typeof docPages.$inferSelect;

/** Диалоги с ИИ-ассистентом */
export const conversations = mysqlTable("conversations", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).default("Новый диалог").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messages = mysqlTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    content: mediumtext("content").notNull(),
    sources: text("sources"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    convIdx: index("messages_conv_idx").on(table.conversationId),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
