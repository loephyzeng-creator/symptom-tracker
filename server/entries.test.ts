import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
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

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
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

describe("entries router", () => {
  it("should require authentication for entries.list", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.entries.list()).rejects.toThrow();
  });

  it("should require authentication for entries.upsert", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.entries.upsert({
        date: "2026-03-20",
        dizziness: 3,
        headache: 2,
        sleepQuality: 7,
        anxiety: 4,
        fatigue: 3,
        photosensitivity: 2,
        motionSickness: 1,
        palpitations: 2,
        mood: 6,
        medications: [{ name: "布洛芬", dosage: "200mg" }],
        triggers: ["睡眠不足", "压力大"],
        notes: "测试记录",
      })
    ).rejects.toThrow();
  });

  it("should require authentication for entries.delete", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.entries.delete({ id: 1 })).rejects.toThrow();
  });

  it("should validate date format for entries.upsert", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.entries.upsert({
        date: "invalid-date",
        dizziness: 3,
        headache: 2,
        sleepQuality: 7,
        anxiety: 4,
        fatigue: 3,
        photosensitivity: 2,
        motionSickness: 1,
        palpitations: 2,
        mood: 6,
        medications: [],
        triggers: [],
      })
    ).rejects.toThrow();
  });

  it("should validate score ranges for entries.upsert", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.entries.upsert({
        date: "2026-03-20",
        dizziness: 15, // Out of range
        headache: 2,
        sleepQuality: 7,
        anxiety: 4,
        fatigue: 3,
        photosensitivity: 2,
        motionSickness: 1,
        palpitations: 2,
        mood: 6,
        medications: [],
        triggers: [],
      })
    ).rejects.toThrow();
  });
});

describe("triggers router", () => {
  it("should require authentication for triggers.list", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.triggers.list()).rejects.toThrow();
  });

  it("should require authentication for triggers.add", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.triggers.add({ name: "测试诱因" })).rejects.toThrow();
  });

  it("should validate trigger name for triggers.add", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.triggers.add({ name: "" })).rejects.toThrow();
  });

  it("should require authentication for triggers.delete", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.triggers.delete({ id: 1 })).rejects.toThrow();
  });
});
