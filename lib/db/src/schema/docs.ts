import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const docCategoriesTable = pgTable("doc_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const docProjectsTable = pgTable("doc_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  status: text("status").notNull().default("active"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const docFeaturesTable = pgTable("doc_features", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("stable"),
  projectId: integer("project_id").references(() => docProjectsTable.id, { onDelete: "set null" }),
  categoryId: integer("category_id").references(() => docCategoriesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const docArticlesTable = pgTable("doc_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull().default(""),
  type: text("type").notNull().default("guide"),
  categoryId: integer("category_id").references(() => docCategoriesTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => docProjectsTable.id, { onDelete: "set null" }),
  featureId: integer("feature_id").references(() => docFeaturesTable.id, { onDelete: "set null" }),
  author: text("author"),
  tags: text("tags").array().notNull().default([]),
  published: boolean("published").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const docArticleRelationsTable = pgTable("doc_article_relations", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => docArticlesTable.id, { onDelete: "cascade" }),
  relatedArticleId: integer("related_article_id").notNull().references(() => docArticlesTable.id, { onDelete: "cascade" }),
});

export const insertDocCategorySchema = createInsertSchema(docCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocProjectSchema = createInsertSchema(docProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocFeatureSchema = createInsertSchema(docFeaturesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocArticleSchema = createInsertSchema(docArticlesTable).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true });

export type InsertDocCategory = z.infer<typeof insertDocCategorySchema>;
export type InsertDocProject = z.infer<typeof insertDocProjectSchema>;
export type InsertDocFeature = z.infer<typeof insertDocFeatureSchema>;
export type InsertDocArticle = z.infer<typeof insertDocArticleSchema>;

export type DocCategory = typeof docCategoriesTable.$inferSelect;
export type DocProject = typeof docProjectsTable.$inferSelect;
export type DocFeature = typeof docFeaturesTable.$inferSelect;
export type DocArticle = typeof docArticlesTable.$inferSelect;
