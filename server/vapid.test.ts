import { describe, expect, it } from "vitest";

describe("VAPID keys", () => {
  it("VAPID_PUBLIC_KEY is set and is a valid base64url string", () => {
    const key = process.env.VAPID_PUBLIC_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(20);
    // base64url characters only
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("VAPID_PRIVATE_KEY is set and is a valid base64url string", () => {
    const key = process.env.VAPID_PRIVATE_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("web-push can be configured with VAPID keys without error", async () => {
    const webpush = await import("web-push");
    const publicKey = process.env.VAPID_PUBLIC_KEY!;
    const privateKey = process.env.VAPID_PRIVATE_KEY!;

    expect(() => {
      webpush.setVapidDetails(
        "mailto:symptom-tracker@example.com",
        publicKey,
        privateKey
      );
    }).not.toThrow();
  });
});
