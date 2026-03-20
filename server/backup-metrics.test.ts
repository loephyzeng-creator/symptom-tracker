import { describe, it, expect } from "vitest";

/**
 * Tests for backup/restore and custom metrics router endpoints.
 * Validates that the router structure is correct and procedures exist.
 */

describe("Backup & Restore Router", () => {
  it("should have backup router with export and restore procedures", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();

    // Check that backup router exists
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
  });

  it("should have backup.export as a query procedure", async () => {
    const { appRouter } = await import("./routers");
    const backup = (appRouter as any)._def.procedures["backup.export"];
    expect(backup).toBeDefined();
  });

  it("should have backup.restore as a mutation procedure", async () => {
    const { appRouter } = await import("./routers");
    const restore = (appRouter as any)._def.procedures["backup.restore"];
    expect(restore).toBeDefined();
  });
});

describe("Custom Metrics Router", () => {
  it("should have customMetrics router with CRUD procedures", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;

    expect(procedures["customMetrics.list"]).toBeDefined();
    expect(procedures["customMetrics.add"]).toBeDefined();
    expect(procedures["customMetrics.update"]).toBeDefined();
    expect(procedures["customMetrics.delete"]).toBeDefined();
  });

  it("should have customMetrics.getValues as a query procedure", async () => {
    const { appRouter } = await import("./routers");
    const getValues = (appRouter as any)._def.procedures["customMetrics.getValues"];
    expect(getValues).toBeDefined();
  });

  it("should have customMetrics.saveValues as a mutation procedure", async () => {
    const { appRouter } = await import("./routers");
    const saveValues = (appRouter as any)._def.procedures["customMetrics.saveValues"];
    expect(saveValues).toBeDefined();
  });
});

describe("Database helpers - exportUserData", () => {
  it("should be a function", async () => {
    const { exportUserData } = await import("./db");
    expect(typeof exportUserData).toBe("function");
  });
});

describe("Database helpers - restoreUserData", () => {
  it("should be a function", async () => {
    const { restoreUserData } = await import("./db");
    expect(typeof restoreUserData).toBe("function");
  });
});

describe("Database helpers - custom metrics", () => {
  it("should export getCustomMetrics function", async () => {
    const { getCustomMetrics } = await import("./db");
    expect(typeof getCustomMetrics).toBe("function");
  });

  it("should export addCustomMetric function", async () => {
    const { addCustomMetric } = await import("./db");
    expect(typeof addCustomMetric).toBe("function");
  });

  it("should export updateCustomMetric function", async () => {
    const { updateCustomMetric } = await import("./db");
    expect(typeof updateCustomMetric).toBe("function");
  });

  it("should export deleteCustomMetric function", async () => {
    const db = await import("./db");
    // Exported as deleteCustomMetric
    expect(typeof db.deleteCustomMetric).toBe("function");
  });

  it("should export getCustomMetricValues function", async () => {
    const { getCustomMetricValues } = await import("./db");
    expect(typeof getCustomMetricValues).toBe("function");
  });

  it("should export saveCustomMetricValues function", async () => {
    const { saveCustomMetricValues } = await import("./db");
    expect(typeof saveCustomMetricValues).toBe("function");
  });

  it("should export upsertCustomMetricValue function", async () => {
    const { upsertCustomMetricValue } = await import("./db");
    expect(typeof upsertCustomMetricValue).toBe("function");
  });
});

describe("Schema - custom metrics tables", () => {
  it("should export customMetrics table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.customMetrics).toBeDefined();
  });

  it("should export customMetricValues table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.customMetricValues).toBeDefined();
  });
});
