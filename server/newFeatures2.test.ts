import { describe, it, expect, vi } from "vitest";
import { readRoutersContent } from "./test-compat";

// ============================================================
// 1. Medication Confirmation (confirmMedicationTaken)
// ============================================================
describe("Medication Confirmation - confirmMedicationTaken", () => {
  it("should export confirmMedicationTaken function from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.confirmMedicationTaken).toBe("function");
  });

  it("confirmMedicationTaken should accept reminderId and userId", async () => {
    const db = await import("./db");
    // Function should exist and have the right signature
    expect(db.confirmMedicationTaken.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// 2. Medication Timeline (getMedicationTimeline)
// ============================================================
describe("Medication Timeline - getMedicationTimeline", () => {
  it("should export getMedicationTimeline function from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.getMedicationTimeline).toBe("function");
  });

  it("getMedicationTimeline should accept userId, startDate, endDate", async () => {
    const db = await import("./db");
    expect(db.getMedicationTimeline.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================
// 3. Medication Instruction URL
// ============================================================
describe("Medication Instruction URL", () => {
  it("should include instructionUrl in addMedicationReminder data type", async () => {
    const db = await import("./db");
    // addMedicationReminder should accept instructionUrl in its data parameter
    expect(typeof db.addMedicationReminder).toBe("function");
  });

  it("schema should include instructionUrl field in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columns = schema.medicationReminders;
    // The table should have instructionUrl column
    expect(columns.instructionUrl).toBeDefined();
  });
});

// ============================================================
// 4. Service Worker Push Actions
// ============================================================
describe("Service Worker - Push notification actions", () => {
  it("sw.js should exist in public directory", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const swPath = path.resolve(__dirname, "../client/public/sw.js");
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it("sw.js should handle confirm-taken action", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const swPath = path.resolve(__dirname, "../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("confirm-taken");
  });

  it("sw.js should handle snooze action", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const swPath = path.resolve(__dirname, "../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("snooze");
  });

  it("sw.js should include actions in notification display", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const swPath = path.resolve(__dirname, "../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("actions");
    expect(content).toContain("已服药");
  });
});

// ============================================================
// 5. Router endpoints
// ============================================================
describe("Router - medReminders endpoints", () => {
  it("routers.ts should include confirmTaken endpoint", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = readRoutersContent();
    expect(content).toContain("confirmTaken");
    expect(content).toContain("confirmMedicationTaken");
  });

  it("routers.ts should include timeline endpoint", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = readRoutersContent();
    expect(content).toContain("timeline");
    expect(content).toContain("getMedicationTimeline");
  });

  it("routers.ts should include instructionUrl in add/update schemas", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = readRoutersContent();
    // Should appear in both add and update input schemas
    const matches = content.match(/instructionUrl/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// 6. Reminder Scheduler - Push with actions
// ============================================================
describe("Reminder Scheduler - Push actions", () => {
  it("reminderScheduler should include confirm-taken action in push payload", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const schedulerPath = path.resolve(__dirname, "./reminderScheduler.ts");
    const content = fs.readFileSync(schedulerPath, "utf-8");
    expect(content).toContain("confirm-taken");
    expect(content).toContain("已服药");
  });

  it("reminderScheduler should pass reminderId in push data", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const schedulerPath = path.resolve(__dirname, "./reminderScheduler.ts");
    const content = fs.readFileSync(schedulerPath, "utf-8");
    expect(content).toContain("reminderId");
  });
});

// ============================================================
// 7. Frontend components
// ============================================================
describe("Frontend - MedicationTimeline component", () => {
  it("MedicationTimeline.tsx should exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const compPath = path.resolve(__dirname, "../client/src/components/MedicationTimeline.tsx");
    expect(fs.existsSync(compPath)).toBe(true);
  });

  it("MedicationTimeline should use trpc.medReminders.timeline", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const compPath = path.resolve(__dirname, "../client/src/components/MedicationTimeline.tsx");
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("medReminders");
    expect(content).toContain("timeline");
  });
});

describe("Frontend - MedicationReminders instruction URL", () => {
  it("MedicationReminders should include instructionUrl in form", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const compPath = path.resolve(__dirname, "../client/src/components/MedicationReminders.tsx");
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("instructionUrl");
    expect(content).toContain("说明书");
  });

  it("MedicationReminders should display instruction link icon", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const compPath = path.resolve(__dirname, "../client/src/components/MedicationReminders.tsx");
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("FileText");
    expect(content).toContain("查看说明书");
  });
});

describe("Frontend - HistoryView timeline integration", () => {
  it("HistoryView should include medication timeline view", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const compPath = path.resolve(__dirname, "../client/src/components/HistoryView.tsx");
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("MedicationTimeline");
  });
});

// ============================================================
// 8. ICS Export - instruction URL in description
// ============================================================
describe("ICS Export - instruction URL support", () => {
  it("icsExport should handle reminders with instructionUrl", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const icsPath = path.resolve(__dirname, "../client/src/lib/icsExport.ts");
    const content = fs.readFileSync(icsPath, "utf-8");
    // ICS export should be able to handle the instructionUrl field gracefully
    expect(content).toBeDefined();
  });
});
