/**
 * Vitest global setup for test stability.
 * 
 * - Increases default test timeout for DB-dependent tests
 * - Provides a helper to retry DB connections with exponential backoff
 */
import { getDb } from "./db";

/**
 * Retry a DB operation with exponential backoff.
 * Useful for tests that depend on TiDB availability.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTransient =
        errMsg.includes("No available TiDB") ||
        errMsg.includes("ECONNREFUSED") ||
        errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("Connection lost") ||
        errMsg.includes("ER_UNKNOWN_ERROR");

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(
        `[TestRetry] Attempt ${attempt + 1}/${maxRetries + 1} failed (${errMsg.slice(0, 80)}), retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Check if the database is available. Returns true if connected, false otherwise.
 * Can be used in beforeAll to skip DB-dependent test suites gracefully.
 */
export async function isDbAvailable(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    // Simple connectivity check
    await db.execute(new (await import("drizzle-orm")).SQL(["SELECT 1"]));
    return true;
  } catch {
    return false;
  }
}
