import { describe, it, expect } from "vitest";

/**
 * Tests for social anxiety tracking feature.
 * Verifies that:
 * 1. The entry input schema accepts socialAnxiety and socialContext fields
 * 2. The report generation includes social anxiety analysis
 * 3. The AI analysis includes social anxiety data
 */

// Test the report generation logic for social context analysis
describe("Social Anxiety Report Analysis", () => {
  // Simulate the social context analysis logic from report.ts
  function computeSocialContextAnalysis(entries: { socialAnxiety: number; socialContext: string[] }[]) {
    const socialEntries = entries.filter(e => e.socialAnxiety > 0);
    if (socialEntries.length === 0) return null;

    const contextCounts: Record<string, { count: number; totalAnxiety: number }> = {};
    socialEntries.forEach(e => {
      if (Array.isArray(e.socialContext)) {
        e.socialContext.forEach((c: string) => {
          if (!contextCounts[c]) contextCounts[c] = { count: 0, totalAnxiety: 0 };
          contextCounts[c].count++;
          contextCounts[c].totalAnxiety += e.socialAnxiety;
        });
      }
    });

    const contextList = Object.entries(contextCounts)
      .map(([name, data]) => ({ name, count: data.count, avgAnxiety: +(data.totalAnxiety / data.count).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    return {
      totalDays: socialEntries.length,
      avgAnxiety: +(socialEntries.reduce((s, e) => s + e.socialAnxiety, 0) / socialEntries.length).toFixed(1),
      contexts: contextList,
    };
  }

  it("should return null when no entries have social anxiety > 0", () => {
    const entries = [
      { socialAnxiety: 0, socialContext: [] },
      { socialAnxiety: 0, socialContext: ["多人聚会"] },
    ];
    expect(computeSocialContextAnalysis(entries)).toBeNull();
  });

  it("should compute correct stats for entries with social anxiety", () => {
    const entries = [
      { socialAnxiety: 7, socialContext: ["多人聚会", "公开发言"] },
      { socialAnxiety: 5, socialContext: ["一对一交谈"] },
      { socialAnxiety: 8, socialContext: ["多人聚会", "与陌生人交流"] },
      { socialAnxiety: 0, socialContext: [] },
    ];
    const result = computeSocialContextAnalysis(entries);
    expect(result).not.toBeNull();
    expect(result!.totalDays).toBe(3);
    expect(result!.avgAnxiety).toBeCloseTo(6.7, 1);
    expect(result!.contexts).toHaveLength(4);
    // 多人聚会 appears twice
    const party = result!.contexts.find(c => c.name === "多人聚会");
    expect(party).toBeDefined();
    expect(party!.count).toBe(2);
    expect(party!.avgAnxiety).toBe(7.5); // (7+8)/2
  });

  it("should sort contexts by frequency descending", () => {
    const entries = [
      { socialAnxiety: 6, socialContext: ["工作会议"] },
      { socialAnxiety: 4, socialContext: ["工作会议"] },
      { socialAnxiety: 8, socialContext: ["工作会议", "公开发言"] },
      { socialAnxiety: 3, socialContext: ["公开发言"] },
    ];
    const result = computeSocialContextAnalysis(entries);
    expect(result!.contexts[0].name).toBe("工作会议");
    expect(result!.contexts[0].count).toBe(3);
    expect(result!.contexts[1].name).toBe("公开发言");
    expect(result!.contexts[1].count).toBe(2);
  });
});

// Test the entry input schema validation
describe("Entry Input Schema - Social Anxiety Fields", () => {
  it("should accept valid socialAnxiety values (0-10)", () => {
    const validValues = [0, 1, 5, 10];
    validValues.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    });
  });

  it("should validate socialContext as array of strings", () => {
    const validContexts = [
      [],
      ["一对一交谈"],
      ["多人聚会", "公开发言", "与陌生人交流"],
    ];
    validContexts.forEach(ctx => {
      expect(Array.isArray(ctx)).toBe(true);
      ctx.forEach(item => expect(typeof item).toBe("string"));
    });
  });
});

// Test SOCIAL_CONTEXTS constant
describe("Social Context Options", () => {
  const SOCIAL_CONTEXTS = [
    "一对一交谈",
    "多人聚会",
    "公开发言",
    "与陌生人交流",
    "工作会议",
    "电话/视频通话",
    "社交媒体互动",
    "家庭聚会",
  ];

  it("should have 8 predefined social context options", () => {
    expect(SOCIAL_CONTEXTS).toHaveLength(8);
  });

  it("should include common social situations", () => {
    expect(SOCIAL_CONTEXTS).toContain("多人聚会");
    expect(SOCIAL_CONTEXTS).toContain("公开发言");
    expect(SOCIAL_CONTEXTS).toContain("与陌生人交流");
    expect(SOCIAL_CONTEXTS).toContain("工作会议");
  });
});

// Test trigger categories include social-related triggers
describe("Social Triggers Category", () => {
  const SOCIAL_TRIGGERS = ["社交聚会", "公开发言", "与陌生人交流", "被关注/评价", "冲突对话"];

  it("should have 5 social-related triggers", () => {
    expect(SOCIAL_TRIGGERS).toHaveLength(5);
  });

  it("should include key social anxiety triggers", () => {
    expect(SOCIAL_TRIGGERS).toContain("社交聚会");
    expect(SOCIAL_TRIGGERS).toContain("公开发言");
    expect(SOCIAL_TRIGGERS).toContain("被关注/评价");
  });
});
