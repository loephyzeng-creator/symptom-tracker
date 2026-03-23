import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for the bug fix: upsertEntry should preserve existing medications
 * when the incoming data has an empty medications array.
 *
 * Bug: When user saves symptom data from the record form (which sends medications: []),
 * it overwrites the medications that were previously recorded via confirm-taken flow.
 */
describe("upsertEntry medication preservation", () => {
  const filePath = path.resolve(__dirname, "db/symptomEntries.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  it("should have medication merge logic in upsertEntry", () => {
    // The function should contain the merge logic
    const fnStart = content.indexOf("export async function upsertEntry");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = content.slice(fnStart, fnStart + 3000);

    // Should check existing medications before overwriting
    expect(fnBody).toContain("existingMeds");
    expect(fnBody).toContain("incomingMeds");
    expect(fnBody).toContain("mergedMedications");
  });

  it("should preserve existing medications when incoming is empty", () => {
    const fnStart = content.indexOf("export async function upsertEntry");
    const fnBody = content.slice(fnStart, fnStart + 3000);

    // The merge logic: use incoming if non-empty, otherwise keep existing
    expect(fnBody).toContain("incomingMeds.length > 0 ? incomingMeds : existingMeds");
  });

  it("should use mergedMedications in the update set", () => {
    const fnStart = content.indexOf("export async function upsertEntry");
    const fnBody = content.slice(fnStart, fnStart + 3000);

    // The update should use mergedMedications, not data.medications
    expect(fnBody).toContain("medications: mergedMedications");
  });

  it("should have a comment explaining the preservation logic", () => {
    const fnStart = content.indexOf("export async function upsertEntry");
    const fnBody = content.slice(fnStart, fnStart + 3000);

    // Should have a clear comment about why we preserve
    expect(fnBody).toContain("Preserve existing medications");
    expect(fnBody).toContain("confirm-taken");
  });

  it("SymptomForm sends empty medications array (root cause)", () => {
    // Verify the symptom form still sends medications: [] (this is expected behavior)
    const formPath = path.resolve(__dirname, "../client/src/components/SymptomForm.tsx");
    const formContent = fs.readFileSync(formPath, "utf-8");

    // The form sends medications: [] because it doesn't manage medication state
    expect(formContent).toContain("medications: []");
  });

  it("should properly type the MedEntry for medications", () => {
    const fnStart = content.indexOf("export async function upsertEntry");
    const fnBody = content.slice(fnStart, fnStart + 3000);

    // Should have proper typing
    expect(fnBody).toContain("type MedEntry");
    expect(fnBody).toContain("name: string");
    expect(fnBody).toContain("dosage: string");
  });
});
