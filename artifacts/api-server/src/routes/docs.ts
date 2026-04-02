import { Router } from "express";
import { db } from "@workspace/db";
import {
  docCategoriesTable,
  docArticlesTable,
  docProjectsTable,
  docFeaturesTable,
  docArticleRelationsTable,
} from "@workspace/db";
import { eq, like, or, and, desc, asc, sql, inArray, ilike } from "drizzle-orm";

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────

function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function articleRow(a: typeof docArticlesTable.$inferSelect) {
  const [cat] = a.categoryId
    ? await db.select().from(docCategoriesTable).where(eq(docCategoriesTable.id, a.categoryId)).limit(1)
    : [];
  const [proj] = a.projectId
    ? await db.select().from(docProjectsTable).where(eq(docProjectsTable.id, a.projectId)).limit(1)
    : [];
  const [feat] = a.featureId
    ? await db.select().from(docFeaturesTable).where(eq(docFeaturesTable.id, a.featureId)).limit(1)
    : [];
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    type: a.type,
    categoryId: a.categoryId,
    categoryName: cat?.name ?? null,
    categorySlug: cat?.slug ?? null,
    projectId: a.projectId,
    projectName: proj?.name ?? null,
    featureId: a.featureId,
    featureName: feat?.name ?? null,
    author: a.author,
    tags: a.tags,
    published: a.published,
    viewCount: a.viewCount,
    readingTime: readingTime(a.content),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// ── stats ─────────────────────────────────────────────────────────────────────

router.get("/docs/stats", async (_req, res) => {
  try {
    const [totalArticles] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable);
    const [publishedArticles] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(eq(docArticlesTable.published, true));
    const [totalCategories] = await db.select({ count: sql<number>`count(*)` }).from(docCategoriesTable);
    const [totalProjects] = await db.select({ count: sql<number>`count(*)` }).from(docProjectsTable);
    const [totalFeatures] = await db.select({ count: sql<number>`count(*)` }).from(docFeaturesTable);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentUpdates] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(sql`${docArticlesTable.updatedAt} > ${sevenDaysAgo}`);

    res.json({
      totalArticles: Number(totalArticles.count),
      totalCategories: Number(totalCategories.count),
      totalProjects: Number(totalProjects.count),
      totalFeatures: Number(totalFeatures.count),
      publishedArticles: Number(publishedArticles.count),
      recentUpdates: Number(recentUpdates.count),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── search ────────────────────────────────────────────────────────────────────

router.get("/docs/search", async (req, res) => {
  try {
    const { q, type, categoryId, projectId, limit = "20" } = req.query as Record<string, string>;
    const conditions: any[] = [eq(docArticlesTable.published, true)];
    if (q) {
      conditions.push(or(
        ilike(docArticlesTable.title, `%${q}%`),
        ilike(docArticlesTable.excerpt, `%${q}%`),
        ilike(docArticlesTable.content, `%${q}%`),
      )!);
    }
    if (type) conditions.push(eq(docArticlesTable.type, type));
    if (categoryId) conditions.push(eq(docArticlesTable.categoryId, Number(categoryId)));
    if (projectId) conditions.push(eq(docArticlesTable.projectId, Number(projectId)));

    const articles = await db.select().from(docArticlesTable)
      .where(and(...conditions))
      .orderBy(desc(docArticlesTable.viewCount))
      .limit(Number(limit));

    const results = await Promise.all(articles.map(async (a) => {
      const row = await articleRow(a);
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        type: row.type,
        categoryName: row.categoryName,
        categorySlug: row.categorySlug,
        projectName: row.projectName,
        tags: row.tags,
        updatedAt: row.updatedAt,
      };
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

// ── trending ──────────────────────────────────────────────────────────────────

router.get("/docs/trending", async (_req, res) => {
  try {
    const articles = await db.select().from(docArticlesTable)
      .where(eq(docArticlesTable.published, true))
      .orderBy(desc(docArticlesTable.viewCount))
      .limit(8);
    const results = await Promise.all(articles.map(articleRow));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trending docs" });
  }
});

// ── categories ────────────────────────────────────────────────────────────────

router.get("/docs/categories", async (_req, res) => {
  try {
    const cats = await db.select().from(docCategoriesTable).orderBy(asc(docCategoriesTable.sortOrder));
    const results = await Promise.all(cats.map(async (c) => {
      const [cnt] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(and(eq(docArticlesTable.categoryId, c.id), eq(docArticlesTable.published, true)));
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
        articleCount: Number(cnt.count),
        createdAt: c.createdAt.toISOString(),
      };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/docs/categories", async (req, res) => {
  try {
    const { name, slug, description, icon, color, sortOrder = 0 } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name and slug required" }); return; }
    const [cat] = await db.insert(docCategoriesTable).values({ name, slug, description, icon, color, sortOrder }).returning();
    res.status(201).json({ ...cat, articleCount: 0, createdAt: cat.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.get("/docs/categories/:slug", async (req, res) => {
  try {
    const [cat] = await db.select().from(docCategoriesTable).where(eq(docCategoriesTable.slug, req.params.slug)).limit(1);
    if (!cat) { res.status(404).json({ error: "Not found" }); return; }
    const articles = await db.select().from(docArticlesTable).where(and(eq(docArticlesTable.categoryId, cat.id), eq(docArticlesTable.published, true))).orderBy(desc(docArticlesTable.updatedAt));
    const articleRows = await Promise.all(articles.map(articleRow));
    res.json({
      id: cat.id, name: cat.name, slug: cat.slug, description: cat.description,
      icon: cat.icon, color: cat.color, sortOrder: cat.sortOrder,
      articleCount: articleRows.length, createdAt: cat.createdAt.toISOString(),
      articles: articleRows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

router.put("/docs/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, slug, description, icon, color, sortOrder } = req.body;
    const [cat] = await db.update(docCategoriesTable).set({ name, slug, description, icon, color, sortOrder, updatedAt: new Date() }).where(eq(docCategoriesTable.id, id)).returning();
    if (!cat) { res.status(404).json({ error: "Not found" }); return; }
    const [cnt] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(eq(docArticlesTable.categoryId, id));
    res.json({ ...cat, articleCount: Number(cnt.count), createdAt: cat.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/docs/categories/:id", async (req, res) => {
  try {
    await db.delete(docCategoriesTable).where(eq(docCategoriesTable.id, Number(req.params.id)));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// ── articles ──────────────────────────────────────────────────────────────────

router.get("/docs/articles", async (req, res) => {
  try {
    const { q, categoryId, type, projectId, featureId, published, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (q) conditions.push(or(ilike(docArticlesTable.title, `%${q}%`), ilike(docArticlesTable.excerpt, `%${q}%`))!);
    if (categoryId) conditions.push(eq(docArticlesTable.categoryId, Number(categoryId)));
    if (type) conditions.push(eq(docArticlesTable.type, type));
    if (projectId) conditions.push(eq(docArticlesTable.projectId, Number(projectId)));
    if (featureId) conditions.push(eq(docArticlesTable.featureId, Number(featureId)));
    if (published !== undefined) conditions.push(eq(docArticlesTable.published, published === "true"));

    const articles = await db.select().from(docArticlesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(docArticlesTable.updatedAt))
      .limit(Number(limit)).offset(Number(offset));

    const results = await Promise.all(articles.map(articleRow));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

router.post("/docs/articles", async (req, res) => {
  try {
    const { title, slug, excerpt, content, type, categoryId, projectId, featureId, author, tags = [], published = false, relatedArticleIds = [] } = req.body;
    if (!title || !slug || !content || !type) { res.status(400).json({ error: "title, slug, content, type required" }); return; }
    const [article] = await db.insert(docArticlesTable).values({ title, slug, excerpt, content, type, categoryId: categoryId ?? null, projectId: projectId ?? null, featureId: featureId ?? null, author, tags, published }).returning();
    if (relatedArticleIds.length) {
      await db.insert(docArticleRelationsTable).values(relatedArticleIds.map((rid: number) => ({ articleId: article.id, relatedArticleId: rid })));
    }
    res.status(201).json(await articleRow(article));
  } catch (err) {
    res.status(500).json({ error: "Failed to create article" });
  }
});

router.get("/docs/articles/:slug", async (req, res) => {
  try {
    const [article] = await db.select().from(docArticlesTable).where(eq(docArticlesTable.slug, req.params.slug)).limit(1);
    if (!article) { res.status(404).json({ error: "Not found" }); return; }
    await db.update(docArticlesTable).set({ viewCount: article.viewCount + 1 }).where(eq(docArticlesTable.id, article.id));
    const relations = await db.select().from(docArticleRelationsTable).where(eq(docArticleRelationsTable.articleId, article.id));
    const relatedIds = relations.map(r => r.relatedArticleId);
    const relatedArticles = relatedIds.length
      ? await db.select().from(docArticlesTable).where(inArray(docArticlesTable.id, relatedIds))
      : [];
    const relatedRows = await Promise.all(relatedArticles.map(articleRow));
    const row = await articleRow({ ...article, viewCount: article.viewCount + 1 });
    res.json({ ...row, content: article.content, relatedArticles: relatedRows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

router.put("/docs/articles/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, slug, excerpt, content, type, categoryId, projectId, featureId, author, tags, published, relatedArticleIds } = req.body;
    const [article] = await db.update(docArticlesTable).set({
      title, slug, excerpt, content, type,
      categoryId: categoryId ?? null, projectId: projectId ?? null, featureId: featureId ?? null,
      author, tags, published, updatedAt: new Date(),
    }).where(eq(docArticlesTable.id, id)).returning();
    if (!article) { res.status(404).json({ error: "Not found" }); return; }
    if (relatedArticleIds !== undefined) {
      await db.delete(docArticleRelationsTable).where(eq(docArticleRelationsTable.articleId, id));
      if (relatedArticleIds.length) {
        await db.insert(docArticleRelationsTable).values(relatedArticleIds.map((rid: number) => ({ articleId: id, relatedArticleId: rid })));
      }
    }
    res.json(await articleRow(article));
  } catch (err) {
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.delete("/docs/articles/:id", async (req, res) => {
  try {
    await db.delete(docArticlesTable).where(eq(docArticlesTable.id, Number(req.params.id)));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete article" });
  }
});

// ── projects ──────────────────────────────────────────────────────────────────

router.get("/docs/projects", async (_req, res) => {
  try {
    const projects = await db.select().from(docProjectsTable).orderBy(asc(docProjectsTable.name));
    const results = await Promise.all(projects.map(async (p) => {
      const [aCnt] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(eq(docArticlesTable.projectId, p.id));
      const [fCnt] = await db.select({ count: sql<number>`count(*)` }).from(docFeaturesTable).where(eq(docFeaturesTable.projectId, p.id));
      return { ...p, articleCount: Number(aCnt.count), featureCount: Number(fCnt.count), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/docs/projects", async (req, res) => {
  try {
    const { name, slug, description, icon, status = "active", tags = [] } = req.body;
    if (!name || !slug || !status) { res.status(400).json({ error: "name, slug, status required" }); return; }
    const [p] = await db.insert(docProjectsTable).values({ name, slug, description, icon, status, tags }).returning();
    res.status(201).json({ ...p, articleCount: 0, featureCount: 0, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/docs/projects/:slug", async (req, res) => {
  try {
    const [project] = await db.select().from(docProjectsTable).where(eq(docProjectsTable.slug, req.params.slug)).limit(1);
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const articles = await db.select().from(docArticlesTable).where(and(eq(docArticlesTable.projectId, project.id), eq(docArticlesTable.published, true))).orderBy(desc(docArticlesTable.updatedAt));
    const articleRows = await Promise.all(articles.map(articleRow));
    const features = await db.select().from(docFeaturesTable).where(eq(docFeaturesTable.projectId, project.id));
    const featureRows = features.map(f => ({ ...f, projectName: project.name, articleCount: 0, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() }));
    res.json({ ...project, articleCount: articleRows.length, featureCount: featureRows.length, articles: articleRows, features: featureRows, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.put("/docs/projects/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, slug, description, icon, status, tags } = req.body;
    const [p] = await db.update(docProjectsTable).set({ name, slug, description, icon, status, tags, updatedAt: new Date() }).where(eq(docProjectsTable.id, id)).returning();
    if (!p) { res.status(404).json({ error: "Not found" }); return; }
    const [aCnt] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(eq(docArticlesTable.projectId, id));
    const [fCnt] = await db.select({ count: sql<number>`count(*)` }).from(docFeaturesTable).where(eq(docFeaturesTable.projectId, id));
    res.json({ ...p, articleCount: Number(aCnt.count), featureCount: Number(fCnt.count), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/docs/projects/:id", async (req, res) => {
  try {
    await db.delete(docProjectsTable).where(eq(docProjectsTable.id, Number(req.params.id)));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ── features ──────────────────────────────────────────────────────────────────

router.get("/docs/features", async (req, res) => {
  try {
    const { projectId, status } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (projectId) conditions.push(eq(docFeaturesTable.projectId, Number(projectId)));
    if (status) conditions.push(eq(docFeaturesTable.status, status));
    const features = await db.select().from(docFeaturesTable).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(docFeaturesTable.name));
    const results = await Promise.all(features.map(async (f) => {
      const [proj] = f.projectId ? await db.select().from(docProjectsTable).where(eq(docProjectsTable.id, f.projectId)).limit(1) : [];
      const [cat] = f.categoryId ? await db.select().from(docCategoriesTable).where(eq(docCategoriesTable.id, f.categoryId)).limit(1) : [];
      const [aCnt] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(eq(docArticlesTable.featureId, f.id));
      return { ...f, projectName: proj?.name ?? null, categoryName: cat?.name ?? null, articleCount: Number(aCnt.count), createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch features" });
  }
});

router.post("/docs/features", async (req, res) => {
  try {
    const { name, slug, description, status = "stable", projectId, categoryId } = req.body;
    if (!name || !slug || !status) { res.status(400).json({ error: "name, slug, status required" }); return; }
    const [f] = await db.insert(docFeaturesTable).values({ name, slug, description, status, projectId: projectId ?? null, categoryId: categoryId ?? null }).returning();
    res.status(201).json({ ...f, projectName: null, categoryName: null, articleCount: 0, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create feature" });
  }
});

router.get("/docs/features/:slug", async (req, res) => {
  try {
    const [feature] = await db.select().from(docFeaturesTable).where(eq(docFeaturesTable.slug, req.params.slug)).limit(1);
    if (!feature) { res.status(404).json({ error: "Not found" }); return; }
    const [proj] = feature.projectId ? await db.select().from(docProjectsTable).where(eq(docProjectsTable.id, feature.projectId)).limit(1) : [];
    const [cat] = feature.categoryId ? await db.select().from(docCategoriesTable).where(eq(docCategoriesTable.id, feature.categoryId)).limit(1) : [];
    const articles = await db.select().from(docArticlesTable).where(and(eq(docArticlesTable.featureId, feature.id), eq(docArticlesTable.published, true))).orderBy(desc(docArticlesTable.updatedAt));
    const articleRows = await Promise.all(articles.map(articleRow));
    res.json({ ...feature, projectName: proj?.name ?? null, categoryName: cat?.name ?? null, articleCount: articleRows.length, articles: articleRows, createdAt: feature.createdAt.toISOString(), updatedAt: feature.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feature" });
  }
});

router.put("/docs/features/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, slug, description, status, projectId, categoryId } = req.body;
    const [f] = await db.update(docFeaturesTable).set({ name, slug, description, status, projectId: projectId ?? null, categoryId: categoryId ?? null, updatedAt: new Date() }).where(eq(docFeaturesTable.id, id)).returning();
    if (!f) { res.status(404).json({ error: "Not found" }); return; }
    const [aCnt] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable).where(eq(docArticlesTable.featureId, id));
    res.json({ ...f, projectName: null, categoryName: null, articleCount: Number(aCnt.count), createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update feature" });
  }
});

router.delete("/docs/features/:id", async (req, res) => {
  try {
    await db.delete(docFeaturesTable).where(eq(docFeaturesTable.id, Number(req.params.id)));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete feature" });
  }
});

export default router;
