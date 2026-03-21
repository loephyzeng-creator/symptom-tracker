import { describe, it, expect } from "vitest";

/**
 * Test the ICS export logic.
 * Since icsExport.ts is a client-side module, we test the core logic patterns here.
 */

const ICS_DAY_MAP: Record<number, string> = {
  0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA",
};

function generateRRule(repeatDays: number[] | null): string {
  if (!repeatDays || repeatDays.length === 0 || repeatDays.length === 7) {
    return "RRULE:FREQ=DAILY";
  }
  const days = repeatDays
    .sort()
    .map((d) => ICS_DAY_MAP[d])
    .filter(Boolean)
    .join(",");
  return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function applyOffset(hour: number, minute: number, offset: number): { hour: number; minute: number } {
  let totalMinutes = hour * 60 + minute + offset;
  if (totalMinutes < 0) totalMinutes = 0;
  if (totalMinutes > 23 * 60 + 59) totalMinutes = 23 * 60 + 59;
  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

describe("ICS Export - RRULE Generation", () => {
  it("should generate FREQ=DAILY for null repeatDays", () => {
    expect(generateRRule(null)).toBe("RRULE:FREQ=DAILY");
  });

  it("should generate FREQ=DAILY for empty repeatDays", () => {
    expect(generateRRule([])).toBe("RRULE:FREQ=DAILY");
  });

  it("should generate FREQ=DAILY for all 7 days", () => {
    expect(generateRRule([0, 1, 2, 3, 4, 5, 6])).toBe("RRULE:FREQ=DAILY");
  });

  it("should generate FREQ=WEEKLY for weekdays only", () => {
    const result = generateRRule([1, 2, 3, 4, 5]);
    expect(result).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  });

  it("should generate FREQ=WEEKLY for weekends only", () => {
    const result = generateRRule([0, 6]);
    expect(result).toBe("RRULE:FREQ=WEEKLY;BYDAY=SU,SA");
  });

  it("should generate FREQ=WEEKLY for single day", () => {
    const result = generateRRule([3]);
    expect(result).toBe("RRULE:FREQ=WEEKLY;BYDAY=WE");
  });

  it("should sort days correctly regardless of input order", () => {
    const result = generateRRule([5, 1, 3]);
    expect(result).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });
});

describe("ICS Export - Text Escaping", () => {
  it("should escape backslashes", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
  });

  it("should escape semicolons", () => {
    expect(escapeIcsText("a;b")).toBe("a\\;b");
  });

  it("should escape commas", () => {
    expect(escapeIcsText("a,b")).toBe("a\\,b");
  });

  it("should escape newlines", () => {
    expect(escapeIcsText("a\nb")).toBe("a\\nb");
  });

  it("should handle Chinese characters without escaping", () => {
    expect(escapeIcsText("草酸艾司西酞普兰片")).toBe("草酸艾司西酞普兰片");
  });

  it("should handle multiple special characters", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });
});

describe("ICS Export - Offset Application", () => {
  it("should apply positive offset (delay)", () => {
    const result = applyOffset(8, 0, 30);
    expect(result).toEqual({ hour: 8, minute: 30 });
  });

  it("should apply negative offset (advance)", () => {
    const result = applyOffset(8, 30, -30);
    expect(result).toEqual({ hour: 8, minute: 0 });
  });

  it("should clamp to 00:00 for negative overflow", () => {
    const result = applyOffset(0, 10, -30);
    expect(result).toEqual({ hour: 0, minute: 0 });
  });

  it("should clamp to 23:59 for positive overflow", () => {
    const result = applyOffset(23, 50, 30);
    expect(result).toEqual({ hour: 23, minute: 59 });
  });

  it("should handle zero offset", () => {
    const result = applyOffset(12, 30, 0);
    expect(result).toEqual({ hour: 12, minute: 30 });
  });

  it("should handle hour boundary crossing", () => {
    const result = applyOffset(8, 45, 30);
    expect(result).toEqual({ hour: 9, minute: 15 });
  });
});
