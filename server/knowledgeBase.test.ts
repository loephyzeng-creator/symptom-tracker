import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the knowledge base module:
 * 1. Seed data integrity
 * 2. Router input validation
 * 3. DB query helpers (mocked)
 */

/* ─── Seed data tests ─── */
describe("Knowledge Base Seed Data", () => {
  it("should have 10 preset articles", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    expect(PRESET_ARTICLES).toHaveLength(10);
  });

  it("every article should have required fields", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    for (const article of PRESET_ARTICLES) {
      expect(article.title).toBeTruthy();
      expect(article.category).toBeTruthy();
      expect(article.summary).toBeTruthy();
      expect(article.content).toBeTruthy();
      expect(Array.isArray(article.tags)).toBe(true);
      expect(Array.isArray(article.relatedTriggers)).toBe(true);
      expect(article.isPreset).toBe(1);
    }
  });

  it("should have unique titles", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    const titles = PRESET_ARTICLES.map((a) => a.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("should cover expected categories", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    const categories = new Set(PRESET_ARTICLES.map((a) => a.category));
    expect(categories.has("饮食调理")).toBe(true);
    expect(categories.has("睡眠改善")).toBe(true);
    expect(categories.has("心理健康")).toBe(true);
    expect(categories.has("头痛管理")).toBe(true);
    expect(categories.has("运动康复")).toBe(true);
    expect(categories.has("用药知识")).toBe(true);
  });

  it("articles with relatedTriggers should reference known triggers", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    const knownTriggers = ["上火", "睡眠不足", "压力大", "熬夜", "天气变化", "饮食不当"];
    for (const article of PRESET_ARTICLES) {
      for (const trigger of article.relatedTriggers) {
        expect(knownTriggers).toContain(trigger);
      }
    }
  });

  it("each article summary should be under 500 characters", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    for (const article of PRESET_ARTICLES) {
      expect(article.summary.length).toBeLessThanOrEqual(500);
    }
  });

  it("each article title should be under 200 characters", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    for (const article of PRESET_ARTICLES) {
      expect(article.title.length).toBeLessThanOrEqual(200);
    }
  });
});

/* ─── Router input validation tests (using zod schemas) ─── */
describe("Knowledge Base Router Input Schemas", () => {
  it("detail input requires a numeric id", async () => {
    const { z } = await import("zod");
    const schema = z.object({ id: z.number() });
    expect(schema.safeParse({ id: 1 }).success).toBe(true);
    expect(schema.safeParse({ id: "abc" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("search input requires non-empty keyword", async () => {
    const { z } = await import("zod");
    const schema = z.object({ keyword: z.string().min(1) });
    expect(schema.safeParse({ keyword: "头痛" }).success).toBe(true);
    expect(schema.safeParse({ keyword: "" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("byTriggers input requires array of strings", async () => {
    const { z } = await import("zod");
    const schema = z.object({ triggers: z.array(z.string()) });
    expect(schema.safeParse({ triggers: ["上火", "压力大"] }).success).toBe(true);
    expect(schema.safeParse({ triggers: [] }).success).toBe(true);
    expect(schema.safeParse({ triggers: [1, 2] }).success).toBe(false);
  });

  it("toggleFavorite input requires numeric articleId", async () => {
    const { z } = await import("zod");
    const schema = z.object({ articleId: z.number() });
    expect(schema.safeParse({ articleId: 5 }).success).toBe(true);
    expect(schema.safeParse({ articleId: "abc" }).success).toBe(false);
  });

  it("list input is optional with optional category", async () => {
    const { z } = await import("zod");
    const schema = z.object({ category: z.string().optional() }).optional();
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ category: "饮食调理" }).success).toBe(true);
  });
});

/* ─── DB helper unit tests (with mocked database) ─── */
describe("Knowledge Base DB Helpers", () => {
  // Mock the database connection
  vi.mock("./db/connection", () => ({
    getDb: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getArticles returns empty array when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { getArticles } = await import("./db/knowledgeBase");
    const result = await getArticles();
    expect(result).toEqual([]);
  });

  it("getArticleById returns null when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { getArticleById } = await import("./db/knowledgeBase");
    const result = await getArticleById(1);
    expect(result).toBeNull();
  });

  it("searchArticles returns empty array when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { searchArticles } = await import("./db/knowledgeBase");
    const result = await searchArticles("test");
    expect(result).toEqual([]);
  });

  it("getArticlesByTriggers returns empty array for empty triggers", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { getArticlesByTriggers } = await import("./db/knowledgeBase");
    const result = await getArticlesByTriggers([]);
    expect(result).toEqual([]);
  });

  it("getCategories returns empty array when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { getCategories } = await import("./db/knowledgeBase");
    const result = await getCategories();
    expect(result).toEqual([]);
  });

  it("getUserFavoriteIds returns empty array when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { getUserFavoriteIds } = await import("./db/knowledgeBase");
    const result = await getUserFavoriteIds(1);
    expect(result).toEqual([]);
  });

  it("getUserFavoriteArticles returns empty array when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { getUserFavoriteArticles } = await import("./db/knowledgeBase");
    const result = await getUserFavoriteArticles(1);
    expect(result).toEqual([]);
  });

  it("toggleFavorite returns isFavorite false when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { toggleFavorite } = await import("./db/knowledgeBase");
    const result = await toggleFavorite(1, 1);
    expect(result).toEqual({ isFavorite: false });
  });

  it("seedPresetArticles does nothing when db is null", async () => {
    const { getDb } = await import("./db/connection");
    (getDb as any).mockResolvedValue(null);

    const { seedPresetArticles } = await import("./db/knowledgeBase");
    // Should not throw
    await expect(seedPresetArticles([])).resolves.toBeUndefined();
  });
});

/* ─── Category color mapping tests ─── */
describe("Knowledge Base Category Colors", () => {
  it("all preset categories should have color mappings", async () => {
    const { PRESET_ARTICLES } = await import("./knowledgeBaseSeed");
    const categories = new Set(PRESET_ARTICLES.map((a) => a.category));

    // Known categories from the component
    const KNOWN_CATEGORIES = [
      "饮食调理", "睡眠改善", "心理健康", "生活习惯",
      "环境因素", "头痛管理", "运动康复", "用药知识",
    ];

    for (const cat of categories) {
      expect(KNOWN_CATEGORIES).toContain(cat);
    }
  });
});
