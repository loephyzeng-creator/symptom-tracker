import { getDb } from "./connection";
import { healthArticles, articleFavorites } from "../../drizzle/schema";
import { eq, and, like, or, sql, inArray } from "drizzle-orm";

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
