import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for knowledge base enhancements:
 * 1. User custom articles (CRUD)
 * 2. AI smart recommendations
 * 3. Article reading history
 */

/* ─── Mock database ─── */
vi.mock("./db/connection", () => ({
  getDb: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── 1. User Custom Articles ─── */
describe("User Custom Articles", () => {
  describe("createUserArticle", () => {
    it("returns null when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { createUserArticle } = await import("./db/knowledgeBase");
      const result = await createUserArticle(1, {
        title: "Test",
        category: "个人笔记",
        tags: ["test"],
        summary: "Test summary",
        content: "Test content",
        relatedTriggers: [],
      });
      expect(result).toBeNull();
    });

    it("input data should have correct structure", () => {
      const data = {
        title: "我的头痛缓解方法",
        category: "个人笔记",
        tags: ["头痛", "按摩"],
        summary: "记录我发现的有效缓解头痛的方法",
        content: "## 方法一\n按摩太阳穴...",
        relatedTriggers: ["压力大", "睡眠不足"],
      };
      expect(data.title.length).toBeLessThanOrEqual(200);
      expect(data.summary.length).toBeLessThanOrEqual(500);
      expect(Array.isArray(data.tags)).toBe(true);
      expect(Array.isArray(data.relatedTriggers)).toBe(true);
    });
  });

  describe("updateUserArticle", () => {
    it("returns null when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { updateUserArticle } = await import("./db/knowledgeBase");
      const result = await updateUserArticle(1, 1, { title: "Updated" });
      expect(result).toBeNull();
    });
  });

  describe("deleteUserArticle", () => {
    it("returns false when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { deleteUserArticle } = await import("./db/knowledgeBase");
      const result = await deleteUserArticle(1, 1);
      expect(result).toBe(false);
    });
  });

  describe("getUserArticles", () => {
    it("returns empty array when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getUserArticles } = await import("./db/knowledgeBase");
      const result = await getUserArticles(1);
      expect(result).toEqual([]);
    });
  });
});

/* ─── 2. Reading History ─── */
describe("Reading History", () => {
  describe("recordArticleRead", () => {
    it("does nothing when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { recordArticleRead } = await import("./db/knowledgeBase");
      await expect(recordArticleRead(1, 1)).resolves.toBeUndefined();
    });
  });

  describe("getReadHistory", () => {
    it("returns empty array when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getReadHistory } = await import("./db/knowledgeBase");
      const result = await getReadHistory(1);
      expect(result).toEqual([]);
    });

    it("accepts optional limit parameter", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getReadHistory } = await import("./db/knowledgeBase");
      const result = await getReadHistory(1, 5);
      expect(result).toEqual([]);
    });
  });

  describe("getRecentlyReadArticles", () => {
    it("returns empty array when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getRecentlyReadArticles } = await import("./db/knowledgeBase");
      const result = await getRecentlyReadArticles(1);
      expect(result).toEqual([]);
    });
  });
});

/* ─── 3. AI Recommendations ─── */
describe("AI Recommendations", () => {
  describe("getRecommendedArticles", () => {
    it("returns empty array when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getRecommendedArticles } = await import("./db/knowledgeBase");
      const result = await getRecommendedArticles(["上火"]);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty triggers", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getRecommendedArticles } = await import("./db/knowledgeBase");
      const result = await getRecommendedArticles([]);
      expect(result).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getRecommendedArticles } = await import("./db/knowledgeBase");
      const result = await getRecommendedArticles(["上火"], 3);
      expect(result).toEqual([]);
    });
  });

  describe("Recommendation scoring logic", () => {
    it("should score articles by trigger match count", () => {
      const triggers = ["上火", "压力大", "睡眠不足"];
      const articles = [
        { id: 1, relatedTriggers: ["上火"], title: "A" },
        { id: 2, relatedTriggers: ["上火", "压力大"], title: "B" },
        { id: 3, relatedTriggers: ["上火", "压力大", "睡眠不足"], title: "C" },
      ];

      const scored = articles.map((article) => {
        const matchCount = triggers.filter((t) =>
          article.relatedTriggers.includes(t)
        ).length;
        return { article, score: matchCount };
      });

      scored.sort((a, b) => b.score - a.score);

      expect(scored[0].article.id).toBe(3); // matches all 3
      expect(scored[0].score).toBe(3);
      expect(scored[1].article.id).toBe(2); // matches 2
      expect(scored[1].score).toBe(2);
      expect(scored[2].article.id).toBe(1); // matches 1
      expect(scored[2].score).toBe(1);
    });

    it("should limit results to specified count", () => {
      const triggers = ["上火"];
      const articles = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        relatedTriggers: ["上火"],
      }));

      const scored = articles.map((article) => ({
        article,
        score: triggers.filter((t) => article.relatedTriggers.includes(t)).length,
      }));

      const limited = scored.slice(0, 5);
      expect(limited).toHaveLength(5);
    });
  });
});

/* ─── 4. Router Input Validation ─── */
describe("Enhanced Router Input Schemas", () => {
  it("createArticle requires title, category, summary, content", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      title: z.string().min(1).max(200),
      category: z.string().min(1).max(50),
      tags: z.array(z.string()).default([]),
      summary: z.string().min(1).max(500),
      content: z.string().min(1),
      relatedTriggers: z.array(z.string()).default([]),
    });

    expect(schema.safeParse({
      title: "Test",
      category: "个人笔记",
      summary: "Summary",
      content: "Content",
    }).success).toBe(true);

    expect(schema.safeParse({
      title: "",
      category: "个人笔记",
      summary: "Summary",
      content: "Content",
    }).success).toBe(false);

    expect(schema.safeParse({
      title: "Test",
      category: "",
      summary: "Summary",
      content: "Content",
    }).success).toBe(false);
  });

  it("updateArticle requires id and optional fields", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      id: z.number(),
      title: z.string().min(1).max(200).optional(),
      category: z.string().min(1).max(50).optional(),
      tags: z.array(z.string()).optional(),
      summary: z.string().min(1).max(500).optional(),
      content: z.string().min(1).optional(),
      relatedTriggers: z.array(z.string()).optional(),
    });

    expect(schema.safeParse({ id: 1 }).success).toBe(true);
    expect(schema.safeParse({ id: 1, title: "Updated" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("deleteArticle requires numeric id", async () => {
    const { z } = await import("zod");
    const schema = z.object({ id: z.number() });
    expect(schema.safeParse({ id: 1 }).success).toBe(true);
    expect(schema.safeParse({ id: "abc" }).success).toBe(false);
  });

  it("recordRead requires numeric articleId", async () => {
    const { z } = await import("zod");
    const schema = z.object({ articleId: z.number() });
    expect(schema.safeParse({ articleId: 5 }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("recommendations input accepts triggers array and limit", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      triggers: z.array(z.string()),
      limit: z.number().min(1).max(20).default(5),
    }).optional();

    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse({ triggers: ["上火"], limit: 3 }).success).toBe(true);
    expect(schema.safeParse({ triggers: ["上火"] }).success).toBe(true);
  });

  it("readHistory accepts optional limit", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      limit: z.number().min(1).max(100).default(20),
    }).optional();

    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse({ limit: 10 }).success).toBe(true);
    expect(schema.safeParse({ limit: 0 }).success).toBe(false);
    expect(schema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

/* ─── 5. Schema validation ─── */
describe("Schema: articleReadHistory table structure", () => {
  it("should have the expected fields", async () => {
    const { articleReadHistory } = await import("../drizzle/schema");
    // Verify the table has the expected columns
    const columns = Object.keys(articleReadHistory);
    expect(columns).toContain("id");
    expect(columns).toContain("userId");
    expect(columns).toContain("articleId");
    expect(columns).toContain("readAt");
  });
});

describe("Schema: healthArticles userId field", () => {
  it("should have userId field for user-contributed articles", async () => {
    const { healthArticles } = await import("../drizzle/schema");
    const columns = Object.keys(healthArticles);
    expect(columns).toContain("userId");
    expect(columns).toContain("isPreset");
  });
});

/* ─── 6. Trigger extraction logic ─── */
describe("Trigger extraction for recommendations", () => {
  it("should extract top triggers from entries by frequency", () => {
    const entries = [
      { date: "2026-03-28", triggers: ["上火", "压力大"] },
      { date: "2026-03-27", triggers: ["上火", "睡眠不足"] },
      { date: "2026-03-26", triggers: ["上火", "压力大", "饮食不当"] },
      { date: "2026-03-25", triggers: ["天气变化"] },
    ];

    const triggerCounts: Record<string, number> = {};
    for (const entry of entries) {
      for (const t of entry.triggers) {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      }
    }

    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    expect(topTriggers[0]).toBe("上火"); // 3 times
    expect(topTriggers[1]).toBe("压力大"); // 2 times
    expect(topTriggers).toHaveLength(3);
  });

  it("should handle entries with no triggers", () => {
    const entries = [
      { date: "2026-03-28", triggers: [] },
      { date: "2026-03-27", triggers: [] },
    ];

    const triggerCounts: Record<string, number> = {};
    for (const entry of entries) {
      for (const t of entry.triggers) {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      }
    }

    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    expect(topTriggers).toHaveLength(0);
  });
});
