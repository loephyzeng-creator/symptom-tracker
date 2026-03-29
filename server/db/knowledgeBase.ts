import { getDb } from "./connection";
import { healthArticles, articleFavorites, articleReadHistory } from "../../drizzle/schema";
import { eq, and, like, or, sql, inArray, desc } from "drizzle-orm";

/** Get all articles, optionally filtered by category */
export async function getArticles(category?: string) {
  const db = await getDb();
  if (!db) return [];
  if (category) {
    return db.select().from(healthArticles).where(eq(healthArticles.category, category));
  }
  return db.select().from(healthArticles);
}

/** Get a single article by ID */
export async function getArticleById(articleId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(healthArticles).where(eq(healthArticles.id, articleId));
  return rows[0] ?? null;
}

/** Search articles by keyword (matches title, summary, tags, content) */
export async function searchArticles(keyword: string) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${keyword}%`;
  return db
    .select()
    .from(healthArticles)
    .where(
      or(
        like(healthArticles.title, pattern),
        like(healthArticles.summary, pattern),
        like(healthArticles.content, pattern),
        sql`JSON_SEARCH(${healthArticles.tags}, 'one', ${pattern}) IS NOT NULL`
      )
    );
}

/** Get articles related to specific triggers */
export async function getArticlesByTriggers(triggers: string[]) {
  const db = await getDb();
  if (!db) return [];
  if (triggers.length === 0) return [];

  // Build OR conditions: for each trigger, check if relatedTriggers JSON array contains it
  const conditions = triggers.map(
    (t) => sql`JSON_CONTAINS(${healthArticles.relatedTriggers}, JSON_QUOTE(${t}))`
  );

  return db
    .select()
    .from(healthArticles)
    .where(or(...conditions));
}

/** Get all distinct categories */
export async function getCategories() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ category: healthArticles.category })
    .from(healthArticles);
  return rows.map((r) => r.category);
}

/** Get user's favorite article IDs */
export async function getUserFavoriteIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ articleId: articleFavorites.articleId })
    .from(articleFavorites)
    .where(eq(articleFavorites.userId, userId));
  return rows.map((r) => r.articleId);
}

/** Get user's favorite articles (full article data) */
export async function getUserFavoriteArticles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const favIds = await getUserFavoriteIds(userId);
  if (favIds.length === 0) return [];
  return db
    .select()
    .from(healthArticles)
    .where(inArray(healthArticles.id, favIds));
}

/** Toggle favorite: add if not exists, remove if exists. Returns new state. */
export async function toggleFavorite(
  userId: number,
  articleId: number
): Promise<{ isFavorite: boolean }> {
  const db = await getDb();
  if (!db) return { isFavorite: false };

  const existing = await db
    .select()
    .from(articleFavorites)
    .where(
      and(
        eq(articleFavorites.userId, userId),
        eq(articleFavorites.articleId, articleId)
      )
    );

  if (existing.length > 0) {
    await db
      .delete(articleFavorites)
      .where(
        and(
          eq(articleFavorites.userId, userId),
          eq(articleFavorites.articleId, articleId)
        )
      );
    return { isFavorite: false };
  } else {
    await db.insert(articleFavorites).values({ userId, articleId });
    return { isFavorite: true };
  }
}

/** Seed preset articles — only inserts if the table is empty */
export async function seedPresetArticles(articles: Omit<typeof healthArticles.$inferInsert, "id" | "createdAt" | "updatedAt">[]) {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select({ id: healthArticles.id }).from(healthArticles).limit(1);
  if (existing.length > 0) return; // already seeded

  for (const article of articles) {
    await db.insert(healthArticles).values(article);
  }
}

/* ─── User Custom Articles ─── */

/** Create a user-contributed article */
export async function createUserArticle(userId: number, data: {
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: string;
  relatedTriggers: string[];
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(healthArticles).values({
    ...data,
    isPreset: 0,
    userId,
  });
  const insertId = result[0].insertId;
  return getArticleById(insertId);
}

/** Update a user-contributed article (only if owned by userId) */
export async function updateUserArticle(userId: number, articleId: number, data: {
  title?: string;
  category?: string;
  tags?: string[];
  summary?: string;
  content?: string;
  relatedTriggers?: string[];
}) {
  const db = await getDb();
  if (!db) return null;
  // Verify ownership
  const article = await getArticleById(articleId);
  if (!article || article.isPreset === 1 || article.userId !== userId) return null;
  await db.update(healthArticles).set(data).where(eq(healthArticles.id, articleId));
  return getArticleById(articleId);
}

/** Delete a user-contributed article (only if owned by userId) */
export async function deleteUserArticle(userId: number, articleId: number) {
  const db = await getDb();
  if (!db) return false;
  const article = await getArticleById(articleId);
  if (!article || article.isPreset === 1 || article.userId !== userId) return false;
  // Also remove favorites and read history for this article
  await db.delete(articleFavorites).where(eq(articleFavorites.articleId, articleId));
  await db.delete(articleReadHistory).where(eq(articleReadHistory.articleId, articleId));
  await db.delete(healthArticles).where(eq(healthArticles.id, articleId));
  return true;
}

/** Get articles created by a specific user */
export async function getUserArticles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(healthArticles).where(
    and(eq(healthArticles.userId, userId), eq(healthArticles.isPreset, 0))
  );
}

/* ─── Reading History ─── */

/** Record that a user read an article */
export async function recordArticleRead(userId: number, articleId: number) {
  const db = await getDb();
  if (!db) return;
  // Upsert: delete old record for same user+article, then insert new one
  await db.delete(articleReadHistory).where(
    and(eq(articleReadHistory.userId, userId), eq(articleReadHistory.articleId, articleId))
  );
  await db.insert(articleReadHistory).values({ userId, articleId });
}

/** Get user's recent reading history (article IDs ordered by most recent) */
export async function getReadHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      articleId: articleReadHistory.articleId,
      readAt: articleReadHistory.readAt,
    })
    .from(articleReadHistory)
    .where(eq(articleReadHistory.userId, userId))
    .orderBy(desc(articleReadHistory.readAt))
    .limit(limit);
  return rows;
}

/** Get user's recently read articles (full article data) */
export async function getRecentlyReadArticles(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const history = await getReadHistory(userId, limit);
  if (history.length === 0) return [];
  const articleIds = history.map((h) => h.articleId);
  const articles = await db
    .select()
    .from(healthArticles)
    .where(inArray(healthArticles.id, articleIds));
  // Sort by read order
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  return articleIds.map((id) => articleMap.get(id)).filter(Boolean);
}

/* ─── AI Recommendations ─── */

/** Get articles recommended based on trigger list (scored by relevance) */
export async function getRecommendedArticles(triggers: string[], limit = 5) {
  const db = await getDb();
  if (!db) return [];
  if (triggers.length === 0) return [];

  // Get all articles that match any trigger
  const allMatching = await getArticlesByTriggers(triggers);
  if (allMatching.length === 0) return [];

  // Score each article by how many triggers it matches
  const scored = allMatching.map((article) => {
    const matchCount = triggers.filter((t) =>
      (article.relatedTriggers as string[]).includes(t)
    ).length;
    return { article, score: matchCount };
  });

  // Sort by score descending, then by id for stability
  scored.sort((a, b) => b.score - a.score || a.article.id - b.article.id);

  return scored.slice(0, limit).map((s) => ({
    ...s.article,
    relevanceScore: s.score,
  }));
}
