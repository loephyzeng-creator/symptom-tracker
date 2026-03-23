/**
 * Tests to verify that the History page export now uses the v2 backup API
 * instead of the old entries-only export.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Unified Export - History page uses v2 backup API", () => {
  const hookSource = readFileSync(
    resolve(__dirname, "../client/src/hooks/useSymptomData.ts"),
    "utf-8"
  );

  it("exportData should call backup.export API instead of raw entries", () => {
    // The old code was: JSON.stringify(entries, null, 2)
    // The new code should call: utils.backup.export.fetch()
    expect(hookSource).toContain("utils.backup.export.fetch()");
  });

  it("exportData should be async", () => {
    // The function should be async to await the API call
    expect(hookSource).toMatch(/const exportData = useCallback\(async \(\)/);
  });

  it("export filename should include '完整备份'", () => {
    // The download filename should indicate it's a complete backup
    expect(hookSource).toContain("症状日记_完整备份_");
  });

  it("should have a fallback to entries-only export on error", () => {
    // In case the backup API fails, it should fall back to entries-only
    expect(hookSource).toContain("catch (error");
    // The fallback should still use the old format
    expect(hookSource).toContain("JSON.stringify(entries, null, 2)");
  });

  it("should depend on utils in useCallback deps", () => {
    // The useCallback should include utils in its dependency array
    expect(hookSource).toContain("[entries, utils]");
  });

  // Verify HistoryView label update
  const historySource = readFileSync(
    resolve(__dirname, "../client/src/components/HistoryView.tsx"),
    "utf-8"
  );

  it("HistoryView export button should say '导出完整备份' instead of '导出 JSON'", () => {
    expect(historySource).toContain("导出完整备份");
    expect(historySource).not.toContain("导出 JSON");
  });

  // Verify BackupRestore still uses the same API
  const backupSource = readFileSync(
    resolve(__dirname, "../client/src/components/BackupRestore.tsx"),
    "utf-8"
  );

  it("BackupRestore should also use backup.export API", () => {
    expect(backupSource).toContain("utils.backup.export.fetch()");
  });

  it("both export paths should produce files with '完整备份' in the name", () => {
    expect(hookSource).toContain("症状日记_完整备份_");
    expect(backupSource).toContain("症状日记_完整备份_");
  });

  // Verify export summary toast
  it("useSymptomData exportData should show summary toast with data counts", () => {
    expect(hookSource).toContain('toast.success("备份文件已下载"');
    expect(hookSource).toContain('已导出：');
    expect(hookSource).toContain('条记录');
    expect(hookSource).toContain('个用药提醒');
  });

  it("BackupRestore should show summary toast with data counts", () => {
    expect(backupSource).toContain('toast.success("备份文件已下载"');
    expect(backupSource).toContain('已导出：');
  });

  it("fallback export should show toast indicating entries-only", () => {
    expect(hookSource).toContain('仅症状记录');
  });
});
