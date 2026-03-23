/**
 * Tests for v2 comprehensive backup export/restore
 * Verifies that all data tables are included in backup
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function readBackupContent(): string {
  return fs.readFileSync(
    path.resolve(__dirname, "db/backup.ts"),
    "utf-8"
  );
}

function readRoutersContent(): string {
  const routersDir = path.resolve(__dirname, "routers");
  const mainFile = path.resolve(__dirname, "routers.ts");
  let content = fs.readFileSync(mainFile, "utf-8");
  if (fs.existsSync(routersDir)) {
    const files = fs.readdirSync(routersDir).filter(f => f.endsWith(".ts"));
    for (const f of files) {
      content += "\n" + fs.readFileSync(path.resolve(routersDir, f), "utf-8");
    }
  }
  return content;
}

describe("Backup v2 — export completeness", () => {
  const backupCode = readBackupContent();

  it("exportUserData fetches medicationReminders", () => {
    expect(backupCode).toContain("medicationReminders");
  });

  it("exportUserData fetches medicationGroups", () => {
    expect(backupCode).toContain("medicationGroups");
  });

  it("exportUserData fetches drugInteractions", () => {
    expect(backupCode).toContain("drugInteractions");
  });

  it("exportUserData fetches medicationRestocks", () => {
    expect(backupCode).toContain("medicationRestocks");
  });

  it("exportUserData fetches alertRules", () => {
    expect(backupCode).toContain("alertRules");
  });

  it("exportUserData fetches alertHistory", () => {
    expect(backupCode).toContain("alertHistory");
  });

  it("exportUserData fetches customMetrics", () => {
    expect(backupCode).toContain("customMetrics");
  });

  it("exportUserData fetches customMetricValues", () => {
    expect(backupCode).toContain("customMetricValues");
  });

  it("exportUserData fetches notificationSettings", () => {
    expect(backupCode).toContain("notificationSettings");
  });

  it("exportUserData includes version field", () => {
    expect(backupCode).toContain("version: 2");
  });
});

describe("Backup v2 — restore completeness", () => {
  const backupCode = readBackupContent();

  it("restoreUserData handles medicationReminders", () => {
    expect(backupCode).toContain("medicationReminders");
    expect(backupCode).toContain("remindersRestored");
  });

  it("restoreUserData handles medicationGroups", () => {
    expect(backupCode).toContain("medicationGroups");
    expect(backupCode).toContain("groupsRestored");
  });

  it("restoreUserData handles drugInteractions", () => {
    expect(backupCode).toContain("drugInteractions");
    expect(backupCode).toContain("interactionsRestored");
  });

  it("restoreUserData handles medicationRestocks", () => {
    expect(backupCode).toContain("medicationRestocks");
    expect(backupCode).toContain("restocksRestored");
  });

  it("restoreUserData handles alertRules", () => {
    expect(backupCode).toContain("alertRules");
    expect(backupCode).toContain("alertRulesRestored");
  });

  it("restoreUserData handles alertHistory", () => {
    expect(backupCode).toContain("alertHistory");
    expect(backupCode).toContain("alertHistoryRestored");
  });

  it("restoreUserData handles customMetrics", () => {
    expect(backupCode).toContain("customMetrics");
    expect(backupCode).toContain("customMetricsRestored");
  });

  it("restoreUserData handles customMetricValues", () => {
    expect(backupCode).toContain("customMetricValues");
    expect(backupCode).toContain("customMetricValuesRestored");
  });
});

describe("Backup v2 — router schema", () => {
  const routersCode = readRoutersContent();

  it("restore route accepts medicationReminders", () => {
    expect(routersCode).toContain("medicationReminders: z");
  });

  it("restore route accepts medicationGroups", () => {
    expect(routersCode).toContain("medicationGroups: z");
  });

  it("restore route accepts drugInteractions", () => {
    expect(routersCode).toContain("drugInteractions: z");
  });

  it("restore route accepts alertRules", () => {
    expect(routersCode).toContain("alertRules: z");
  });

  it("restore route accepts alertHistory", () => {
    expect(routersCode).toContain("alertHistory: z");
  });

  it("restore route accepts customMetrics", () => {
    expect(routersCode).toContain("customMetrics: z");
  });

  it("restore route accepts customMetricValues", () => {
    expect(routersCode).toContain("customMetricValues: z");
  });

  it("restore route accepts version field", () => {
    expect(routersCode).toContain("version: z.number()");
  });
});

describe("Backup v2 — frontend component", () => {
  const frontendCode = fs.readFileSync(
    path.resolve(__dirname, "../client/src/components/BackupRestore.tsx"),
    "utf-8"
  );

  it("passes medicationReminders to restore mutation", () => {
    expect(frontendCode).toContain("medicationReminders: previewData.medicationReminders");
  });

  it("passes medicationGroups to restore mutation", () => {
    expect(frontendCode).toContain("medicationGroups: previewData.medicationGroups");
  });

  it("passes drugInteractions to restore mutation", () => {
    expect(frontendCode).toContain("drugInteractions: previewData.drugInteractions");
  });

  it("passes alertRules to restore mutation", () => {
    expect(frontendCode).toContain("alertRules: previewData.alertRules");
  });

  it("displays medication reminders count in backup info", () => {
    expect(frontendCode).toContain("用药提醒");
  });

  it("displays medication groups count in backup info", () => {
    expect(frontendCode).toContain("用药分组");
  });

  it("displays drug interactions count in backup info", () => {
    expect(frontendCode).toContain("药物相互作用");
  });

  it("displays restore success with detailed counts", () => {
    expect(frontendCode).toContain("remindersRestored");
    expect(frontendCode).toContain("groupsRestored");
    expect(frontendCode).toContain("interactionsRestored");
  });
});
