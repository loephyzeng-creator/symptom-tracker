import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-trigger-tips-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("triggerTips", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  // Clean up any existing test data first
  beforeAll(async () => {
    try {
      await caller.triggerTips.delete({ trigger: "上火" });
      await caller.triggerTips.delete({ trigger: "睡眠不足" });
    } catch {
      // Ignore errors if nothing to delete
    }
  });

  afterAll(async () => {
    try {
      await caller.triggerTips.delete({ trigger: "上火" });
      await caller.triggerTips.delete({ trigger: "睡眠不足" });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should list trigger tips (initially empty for test user)", async () => {
    const tips = await caller.triggerTips.list();
    expect(Array.isArray(tips)).toBe(true);
  });

  it("should upsert a new trigger tip", async () => {
    const result = await caller.triggerTips.upsert({
      trigger: "上火",
      title: "上火调理建议",
      recommended: ["薄荷水", "菊花茶", "绿豆汤"],
      avoid: ["辣椒", "油炸食品"],
      tip: "多喝水，清淡饮食",
    });

    expect(result).toBeDefined();
    expect(result.updated).toBe(false); // New record
  });

  it("should list the newly created trigger tip", async () => {
    const tips = await caller.triggerTips.list();
    const fireTip = tips.find((t) => t.trigger === "上火");
    expect(fireTip).toBeDefined();
    expect(fireTip!.title).toBe("上火调理建议");
    expect(fireTip!.recommended).toContain("薄荷水");
    expect(fireTip!.avoid).toContain("辣椒");
    expect(fireTip!.tip).toBe("多喝水，清淡饮食");
  });

  it("should update an existing trigger tip", async () => {
    const result = await caller.triggerTips.upsert({
      trigger: "上火",
      title: "上火调理建议（更新）",
      recommended: ["薄荷水", "菊花茶", "绿豆汤", "西瓜"],
      avoid: ["辣椒", "油炸食品", "羊肉"],
      tip: "多喝水，清淡饮食，注意休息",
    });

    expect(result.updated).toBe(true);
  });

  it("should reflect the update in list", async () => {
    const tips = await caller.triggerTips.list();
    const fireTip = tips.find((t) => t.trigger === "上火");
    expect(fireTip!.title).toBe("上火调理建议（更新）");
    expect(fireTip!.recommended).toContain("西瓜");
    expect(fireTip!.avoid).toContain("羊肉");
  });

  it("should upsert a second trigger tip", async () => {
    const result = await caller.triggerTips.upsert({
      trigger: "睡眠不足",
      recommended: ["热牛奶", "薰衣草茶"],
      avoid: ["咖啡", "浓茶"],
    });

    expect(result).toBeDefined();
    expect(result.updated).toBe(false);
  });

  it("should list both trigger tips", async () => {
    const tips = await caller.triggerTips.list();
    const triggers = tips.map((t) => t.trigger);
    expect(triggers).toContain("上火");
    expect(triggers).toContain("睡眠不足");
  });

  it("should delete a trigger tip", async () => {
    const result = await caller.triggerTips.delete({ trigger: "上火" });
    expect(result).toEqual({ success: true });

    const tips = await caller.triggerTips.list();
    const fireTip = tips.find((t) => t.trigger === "上火");
    expect(fireTip).toBeUndefined();
  });

  it("should still have the other trigger tip after deletion", async () => {
    const tips = await caller.triggerTips.list();
    const sleepTip = tips.find((t) => t.trigger === "睡眠不足");
    expect(sleepTip).toBeDefined();
  });
});
