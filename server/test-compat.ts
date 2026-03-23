/**
 * Test compatibility helper.
 * 
 * After splitting db.ts and routers.ts into sub-modules, old tests that
 * read these files via `fs.readFileSync(path.resolve(__dirname, "db.ts"))`
 * will fail with ENOENT.
 * 
 * This module provides functions that concatenate all sub-module contents
 * into a single string, simulating the old monolithic file content.
 * 
 * Usage in tests:
 *   import { readDbContent, readRoutersContent } from "./test-compat";
 *   const content = readDbContent(); // returns all db/*.ts concatenated
 */
import * as fs from "fs";
import * as path from "path";

const SERVER_DIR = path.resolve(import.meta.dirname);

/**
 * Read and concatenate all db/ sub-module files into a single string.
 * This simulates the old monolithic server/db.ts content.
 */
export function readDbContent(): string {
  const dbDir = path.join(SERVER_DIR, "db");
  const files = fs.readdirSync(dbDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  let combined = "";
  for (const file of files) {
    combined += fs.readFileSync(path.join(dbDir, file), "utf-8") + "\n";
  }
  return combined;
}

/**
 * Read the main routers.ts plus all routers/ sub-module files concatenated.
 * This simulates the old monolithic server/routers.ts content.
 */
export function readRoutersContent(): string {
  const mainRouters = fs.readFileSync(path.join(SERVER_DIR, "routers.ts"), "utf-8");
  const routersDir = path.join(SERVER_DIR, "routers");
  const files = fs.readdirSync(routersDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  let combined = mainRouters + "\n";
  for (const file of files) {
    combined += fs.readFileSync(path.join(routersDir, file), "utf-8") + "\n";
  }
  return combined;
}
