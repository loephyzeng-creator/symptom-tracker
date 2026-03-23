/**
 * Tests for:
 *   1. Backup reminder — lastBackupAt column, lastBackupTime API, reminder UI
 *   2. Import preview dialog — shows data summary before confirming restore
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schemaSource = readFileSync(resolve(__dirname, "../drizzle/schema.ts"), "utf-8");
const routerSource = readFileSync(resolve(__dirname, "./routers.ts"), "utf-8");
const backupRestoreSource = readFileSync(resolve(__dirname, "../client/src/components/BackupRestore.tsx"), "utf-8");

describe("Backup Reminder Feature", () => {
  // ── Schema ──
  it("users table should have lastBackupAt column", () => {
    expect(schemaSource).toContain("lastBackupAt");
    expect(schemaSource).toContain('timestamp("lastBackupAt")');
  });

  // ── Router ──
  it("backup.export should update lastBackupAt timestamp", () => {
    expect(routerSource).toContain("lastBackupAt: new Date()");
  });

  it("should have backup.lastBackupTime procedure", () => {
    expect(routerSource).toContain("lastBackupTime: protectedProcedure");
  });

  it("lastBackupTime should return lastBackupAt field", () => {
    expect(routerSource).toContain("lastBackupAt: users.lastBackupAt");
  });

  // ── Frontend ──
  it("BackupRestore should query lastBackupTime", () => {
    expect(backupRestoreSource).toContain("trpc.backup.lastBackupTime.useQuery");
  });

  it("BackupRestore should show backup reminder when > 7 days", () => {
    expect(backupRestoreSource).toContain("建议尽快备份");
    expect(backupRestoreSource).toContain("建议定期备份");
  });

  it("BackupRestore should show '您还没有备份过数据' for first-time users", () => {
    expect(backupRestoreSource).toContain("您还没有备份过数据");
  });

  it("BackupRestore should invalidate lastBackupTime after export", () => {
    expect(backupRestoreSource).toContain("utils.backup.lastBackupTime.invalidate()");
  });

  it("BackupRestore should have formatRelativeTime helper", () => {
    expect(backupRestoreSource).toContain("function formatRelativeTime");
    expect(backupRestoreSource).toContain("今天");
    expect(backupRestoreSource).toContain("昨天");
    expect(backupRestoreSource).toContain("天前");
    expect(backupRestoreSource).toContain("周前");
  });
});

describe("Import Preview Dialog Feature", () => {
  it("BackupRestore should have ImportPreviewDialog component", () => {
    expect(backupRestoreSource).toContain("function ImportPreviewDialog");
  });

  it("ImportPreviewDialog should show file name", () => {
    expect(backupRestoreSource).toContain("fileName");
    expect(backupRestoreSource).toContain("previewFileName");
  });

  it("ImportPreviewDialog should show data summary with buildSummaryParts", () => {
    expect(backupRestoreSource).toContain("function buildSummaryParts");
    expect(backupRestoreSource).toContain("此文件包含");
  });

  it("ImportPreviewDialog should show format version", () => {
    expect(backupRestoreSource).toContain("格式：");
    expect(backupRestoreSource).toContain("旧版");
  });

  it("ImportPreviewDialog should show export date when available", () => {
    expect(backupRestoreSource).toContain("导出于");
    expect(backupRestoreSource).toContain("exportedAt");
  });

  it("ImportPreviewDialog should have confirm and cancel buttons", () => {
    expect(backupRestoreSource).toContain("确认恢复");
    expect(backupRestoreSource).toContain("取消");
    expect(backupRestoreSource).toContain("onConfirm");
    expect(backupRestoreSource).toContain("onCancel");
  });

  it("file selection should show preview instead of immediately restoring", () => {
    // The handleFileChange should set previewData, not call restoreMutation directly
    expect(backupRestoreSource).toContain("setPreviewData(data)");
    expect(backupRestoreSource).toContain("setPreviewFileName(file.name)");
  });

  it("confirm restore should call restoreMutation from preview data", () => {
    expect(backupRestoreSource).toContain("handleConfirmRestore");
    expect(backupRestoreSource).toContain("restoreMutation.mutate");
  });

  it("cancel should clear preview data", () => {
    expect(backupRestoreSource).toContain("handleCancelRestore");
    expect(backupRestoreSource).toContain("setPreviewData(null)");
  });

  it("should handle old format (array) in preview", () => {
    expect(backupRestoreSource).toContain("Array.isArray(data)");
    expect(backupRestoreSource).toContain("isOldFormat");
  });

  it("should show warning about non-destructive restore", () => {
    expect(backupRestoreSource).toContain("同名药品/同日期记录不会重复创建");
  });

  it("should use AnimatePresence for dialog animation", () => {
    expect(backupRestoreSource).toContain("AnimatePresence");
    expect(backupRestoreSource).toContain("previewData &&");
  });
});
