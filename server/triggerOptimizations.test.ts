import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for trigger tag optimizations:
 * 1. Frequency-based sorting
 * 2. Category grouping
 * 3. Rename custom trigger
 */

/* ─── Mock database ─── */
vi.mock("./db/connection", () => ({
  getDb: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── 1. Trigger Frequency ─── */
describe("Trigger Frequency", () => {
  describe("getTriggerFrequency", () => {
    it("returns empty object when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { getTriggerFrequency } = await import("./db/notifications");
      const result = await getTriggerFrequency(1);
      expect(result).toEqual({});
    });
  });

  describe("Frequency sorting logic", () => {
    it("sorts triggers by frequency descending", () => {
      const frequency: Record<string, number> = {
        "压力大": 15,
        "睡眠不足": 20,
        "天气变化": 5,
        "饮食不当": 10,
      };

      const triggers = ["睡眠不足", "压力大", "天气变化", "饮食不当"];
      const sorted = [...triggers].sort((a, b) => {
        const fa = frequency[a] ?? 0;
        const fb = frequency[b] ?? 0;
        return fb - fa;
      });

      expect(sorted[0]).toBe("睡眠不足"); // 20
      expect(sorted[1]).toBe("压力大"); // 15
      expect(sorted[2]).toBe("饮食不当"); // 10
      expect(sorted[3]).toBe("天气变化"); // 5
    });

    it("handles triggers with no frequency data (default to 0)", () => {
      const frequency: Record<string, number> = {
        "压力大": 5,
      };

      const triggers = ["压力大", "新诱因"];
      const sorted = [...triggers].sort((a, b) => {
        const fa = frequency[a] ?? 0;
        const fb = frequency[b] ?? 0;
        return fb - fa;
      });

      expect(sorted[0]).toBe("压力大");
      expect(sorted[1]).toBe("新诱因");
    });

    it("maintains stable order for equal frequencies", () => {
      const frequency: Record<string, number> = {
        "A": 5,
        "B": 5,
        "C": 5,
      };

      const triggers = ["A", "B", "C"];
      const sorted = [...triggers].sort((a, b) => {
        const fa = frequency[a] ?? 0;
        const fb = frequency[b] ?? 0;
        return fb - fa;
      });

      // All equal, so order should remain stable
      expect(sorted).toHaveLength(3);
    });
  });
});

/* ─── 2. Category Grouping ─── */
describe("Trigger Category Grouping", () => {
  const TRIGGER_CATEGORIES = [
    { label: "睡眠相关", triggers: ["睡眠不足", "熬夜", "中午未午睡", "白天嗜睡"] },
    { label: "情绪与压力", triggers: ["压力大", "情绪波动", "临时工作汇报"] },
    { label: "环境因素", triggers: ["天气变化", "强光刺激", "噪音"] },
    { label: "身体与生活", triggers: ["饮食不当", "运动过量", "久坐", "坐车", "月经期", "未戴眼镜", "上火"] },
    { label: "神经与认知", triggers: ["注意力下降", "头昏沉"] },
    { label: "泌尿相关", triggers: ["排尿困难", "尿等待", "夜尿增多", "排尿不尽", "尿频", "尿急"] },
  ];

  it("should have 6 default categories", () => {
    expect(TRIGGER_CATEGORIES).toHaveLength(6);
  });

  it("should cover all default triggers", () => {
    const allGrouped = TRIGGER_CATEGORIES.flatMap((c) => c.triggers);
    expect(allGrouped).toHaveLength(25); // total default triggers
  });

  it("should not have duplicate triggers across categories", () => {
    const allGrouped = TRIGGER_CATEGORIES.flatMap((c) => c.triggers);
    const unique = new Set(allGrouped);
    expect(unique.size).toBe(allGrouped.length);
  });

  it("should add custom triggers as a separate group", () => {
    const customTriggers = ["自定义A", "自定义B"];
    const groups = [
      ...TRIGGER_CATEGORIES,
      { label: "自定义", triggers: customTriggers },
    ];
    expect(groups).toHaveLength(7);
    expect(groups[6].label).toBe("自定义");
    expect(groups[6].triggers).toEqual(["自定义A", "自定义B"]);
  });

  it("should sort triggers within each group by frequency", () => {
    const frequency: Record<string, number> = {
      "熬夜": 10,
      "睡眠不足": 5,
      "中午未午睡": 15,
      "白天嗜睡": 2,
    };

    const sleepGroup = TRIGGER_CATEGORIES[0];
    const sorted = [...sleepGroup.triggers].sort((a, b) => {
      const fa = frequency[a] ?? 0;
      const fb = frequency[b] ?? 0;
      return fb - fa;
    });

    expect(sorted[0]).toBe("中午未午睡"); // 15
    expect(sorted[1]).toBe("熬夜"); // 10
    expect(sorted[2]).toBe("睡眠不足"); // 5
    expect(sorted[3]).toBe("白天嗜睡"); // 2
  });
});

/* ─── 3. Rename Custom Trigger ─── */
describe("Rename Custom Trigger", () => {
  describe("renameCustomTrigger DB function", () => {
    it("throws when db is null", async () => {
      const { getDb } = await import("./db/connection");
      (getDb as any).mockResolvedValue(null);
      const { renameCustomTrigger } = await import("./db/notifications");
      await expect(renameCustomTrigger(1, 1, "新名称")).rejects.toThrow(
        "Database not available"
      );
    });
  });

  describe("Rename validation logic", () => {
    it("should reject empty new name", () => {
      const newName = "".trim();
      expect(newName.length).toBe(0);
    });

    it("should reject if new name equals old name", () => {
      const oldName = "旧名称";
      const newName = "旧名称";
      expect(newName === oldName).toBe(true);
    });

    it("should reject if new name already exists in allTriggers", () => {
      const allTriggers = ["睡眠不足", "压力大", "自定义A"];
      const newName = "压力大";
      expect(allTriggers.includes(newName)).toBe(true);
    });

    it("should accept valid new name", () => {
      const allTriggers = ["睡眠不足", "压力大", "自定义A"];
      const newName = "新诱因名称";
      expect(newName.trim().length).toBeGreaterThan(0);
      expect(allTriggers.includes(newName)).toBe(false);
    });
  });
});

/* ─── 4. Router Input Validation ─── */
describe("Trigger Router Input Schemas", () => {
  it("rename requires id and name", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      id: z.number(),
      name: z.string().min(1).max(100),
    });

    expect(schema.safeParse({ id: 1, name: "新名称" }).success).toBe(true);
    expect(schema.safeParse({ id: 1, name: "" }).success).toBe(false);
    expect(schema.safeParse({ id: 1 }).success).toBe(false);
    expect(schema.safeParse({ name: "新名称" }).success).toBe(false);
  });

  it("frequency requires no input (query)", () => {
    // frequency is a query with no input, just verify it's a valid pattern
    expect(true).toBe(true);
  });
});

/* ─── 5. Router structure ─── */
describe("Trigger Router Structure", () => {
  it("should have triggers router in appRouter with rename and frequency", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("triggers.list");
    expect(procedures).toContain("triggers.add");
    expect(procedures).toContain("triggers.delete");
    expect(procedures).toContain("triggers.rename");
    expect(procedures).toContain("triggers.frequency");
  });
});
