import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("PWA Configuration", () => {
  const publicDir = path.resolve(import.meta.dirname, "../client/public");

  it("manifest.json exists and has required fields", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe("症状日记");
    expect(manifest.short_name).toBe("症状日记");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.background_color).toBeDefined();
    expect(manifest.theme_color).toBeDefined();
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  it("manifest icons include 192x192 and 512x512 sizes", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const sizes = manifest.icons.map((icon: any) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("manifest icons have valid URLs", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^https?:\/\//);
      expect(icon.type).toBe("image/png");
    }
  });

  it("service worker file exists", () => {
    const swPath = path.join(publicDir, "sw.js");
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, "utf-8");
    expect(swContent).toContain("install");
    expect(swContent).toContain("activate");
    expect(swContent).toContain("fetch");
    expect(swContent).toContain("caches");
  });

  it("index.html has PWA meta tags", () => {
    const indexPath = path.resolve(import.meta.dirname, "../client/index.html");
    const html = fs.readFileSync(indexPath, "utf-8");

    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});

describe("Daily Reminder Component", () => {
  it("DailyReminder component file exists", () => {
    const componentPath = path.resolve(
      import.meta.dirname,
      "../client/src/components/DailyReminder.tsx"
    );
    expect(fs.existsSync(componentPath)).toBe(true);

    const content = fs.readFileSync(componentPath, "utf-8");
    // Should have the key props
    expect(content).toContain("hasRecordedToday");
    expect(content).toContain("onGoToRecord");
    expect(content).toContain("totalEntries");
    // Should have time-based greeting
    expect(content).toContain("getTimeGreeting");
    // Should have dismiss functionality
    expect(content).toContain("daily-reminder-dismissed");
  });

  it("PWAInstallPrompt component file exists", () => {
    const componentPath = path.resolve(
      import.meta.dirname,
      "../client/src/components/PWAInstallPrompt.tsx"
    );
    expect(fs.existsSync(componentPath)).toBe(true);

    const content = fs.readFileSync(componentPath, "utf-8");
    // Should detect iOS Safari
    expect(content).toContain("isIOSSafari");
    // Should have dismiss functionality
    expect(content).toContain("pwa-install-dismissed");
    // Should handle beforeinstallprompt
    expect(content).toContain("beforeinstallprompt");
  });

  it("Home.tsx integrates DailyReminder", () => {
    const homePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/Home.tsx"
    );
    const content = fs.readFileSync(homePath, "utf-8");

    expect(content).toContain("DailyReminder");
    expect(content).toContain("hasRecordedToday");
    expect(content).toContain("handleGoToRecord");
  });
});
