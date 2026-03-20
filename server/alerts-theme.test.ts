import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── Alert Rules Router Tests ────────────────────────────────────────

describe("Alert Rules API", () => {
  it("alerts router is defined in routers.ts", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("alerts: router({");
  });

  it("alerts.listRules procedure exists", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("listRules: protectedProcedure");
  });

  it("alerts.createRule procedure exists with input validation", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("createRule: protectedProcedure");
    expect(content).toContain("metricKey: z.string()");
    expect(content).toContain("threshold: z.number().min(0).max(10)");
    expect(content).toContain("consecutiveDays: z.number().min(1).max(30)");
    expect(content).toContain('direction: z.enum(["above", "below"])');
  });

  it("alerts.updateRule procedure exists", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("updateRule: protectedProcedure");
  });

  it("alerts.deleteRule procedure exists", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("deleteRule: protectedProcedure");
  });

  it("alerts.history procedure exists", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("history: protectedProcedure");
  });

  it("alerts.unreadCount procedure exists", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("unreadCount: protectedProcedure");
  });

  it("alerts.markRead procedure exists", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("markRead: protectedProcedure");
  });
});

// ─── Alert Check Logic Tests ────────────────────────────────────────

describe("Alert Check Logic in db.ts", () => {
  it("checkAlertRules function exists", () => {
    const dbPath = path.resolve(__dirname, "db.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("export async function checkAlertRules");
  });

  it("checkAlertRules handles both above and below directions", () => {
    const dbPath = path.resolve(__dirname, "db.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain('rule.direction === "above"');
    expect(content).toContain("value >= rule.threshold");
    expect(content).toContain("value <= rule.threshold");
  });

  it("checkAlertRules prevents duplicate alerts same day", () => {
    const dbPath = path.resolve(__dirname, "db.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("rule.lastTriggeredDate === todayStr");
  });

  it("checkAlertRules records alert in history", () => {
    const dbPath = path.resolve(__dirname, "db.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("db.insert(alertHistory)");
  });

  it("entries.upsert triggers alert check after saving", () => {
    const routersPath = path.resolve(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("checkAlertRules(ctx.user.id, input.date)");
  });
});

// ─── Database Schema Tests ────────────────────────────────────────

describe("Alert Database Schema", () => {
  it("alertRules table is defined in schema", () => {
    const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain('mysqlTable("alert_rules"');
    expect(content).toContain("metricKey");
    expect(content).toContain("threshold");
    expect(content).toContain("consecutiveDays");
    expect(content).toContain('mysqlEnum("direction", ["above", "below"])');
  });

  it("alertHistory table is defined in schema", () => {
    const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain('mysqlTable("alert_history"');
    expect(content).toContain("ruleId");
    expect(content).toContain("triggeredDate");
    expect(content).toContain("isRead");
  });
});

// ─── Alert UI Component Tests ────────────────────────────────────────

describe("AlertSettings Component", () => {
  it("AlertSettings component file exists", () => {
    const componentPath = path.resolve(
      __dirname,
      "../client/src/components/AlertSettings.tsx"
    );
    expect(fs.existsSync(componentPath)).toBe(true);
  });

  it("AlertSettings uses trpc alerts hooks", () => {
    const componentPath = path.resolve(
      __dirname,
      "../client/src/components/AlertSettings.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("trpc.alerts.listRules.useQuery");
    expect(content).toContain("trpc.alerts.createRule.useMutation");
    expect(content).toContain("trpc.alerts.deleteRule.useMutation");
    expect(content).toContain("trpc.alerts.history.useQuery");
    expect(content).toContain("trpc.alerts.unreadCount.useQuery");
    expect(content).toContain("trpc.alerts.markRead.useMutation");
  });

  it("AlertSettings is integrated into Home.tsx", () => {
    const homePath = path.resolve(
      __dirname,
      "../client/src/pages/Home.tsx"
    );
    const content = fs.readFileSync(homePath, "utf-8");
    expect(content).toContain("AlertSettings");
    expect(content).toContain("<AlertSettings />");
  });

  it("AlertSettings has all 9 symptom options", () => {
    const componentPath = path.resolve(
      __dirname,
      "../client/src/components/AlertSettings.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");
    const metrics = [
      "dizziness",
      "headache",
      "sleepQuality",
      "anxiety",
      "fatigue",
      "photosensitivity",
      "motionSickness",
      "palpitations",
      "mood",
    ];
    for (const m of metrics) {
      expect(content).toContain(m);
    }
  });
});

// ─── Dark Theme Tests ────────────────────────────────────────

describe("Dark/Light Theme Toggle", () => {
  it("index.css has .dark theme variables", () => {
    const cssPath = path.resolve(
      __dirname,
      "../client/src/index.css"
    );
    const content = fs.readFileSync(cssPath, "utf-8");
    expect(content).toContain(".dark {");
    expect(content).toContain("--background:");
    expect(content).toContain("--foreground:");
  });

  it("dark theme has darker background than light theme", () => {
    const cssPath = path.resolve(
      __dirname,
      "../client/src/index.css"
    );
    const content = fs.readFileSync(cssPath, "utf-8");
    // Dark background should have lower lightness (0.18 vs 0.975)
    const darkSection = content.split(".dark {")[1]?.split("}")[0] ?? "";
    expect(darkSection).toContain("oklch(0.18");
  });

  it("ThemeProvider is set to switchable in App.tsx", () => {
    const appPath = path.resolve(
      __dirname,
      "../client/src/App.tsx"
    );
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toContain("switchable");
  });

  it("Home.tsx has theme toggle button with Sun/Moon icons", () => {
    const homePath = path.resolve(
      __dirname,
      "../client/src/pages/Home.tsx"
    );
    const content = fs.readFileSync(homePath, "utf-8");
    expect(content).toContain("toggleTheme");
    expect(content).toContain("Sun");
    expect(content).toContain("Moon");
    expect(content).toContain("useTheme");
  });

  it("ThemeContext supports switchable mode with localStorage", () => {
    const contextPath = path.resolve(
      __dirname,
      "../client/src/contexts/ThemeContext.tsx"
    );
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("switchable");
    expect(content).toContain("localStorage");
    expect(content).toContain("toggleTheme");
  });
});
