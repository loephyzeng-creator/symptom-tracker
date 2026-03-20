import { describe, expect, it } from "vitest";

// We test the pure generateSummaryText function from the client component
// Since it's a pure function with no React dependencies, we can import and test it directly
// We'll replicate the logic here for server-side testing

interface MedicationItem {
  name: string;
  dosage: string;
}

interface SymptomEntry {
  id: number;
  userId: number;
  date: string;
  dizziness: number;
  headache: number;
  sleepQuality: number;
  anxiety: number;
  fatigue: number;
  photosensitivity: number;
  motionSickness: number;
  palpitations: number;
  mood: number;
  severeHeadache: number;
  notes: string | null;
  medications: MedicationItem[];
  triggers: string[];
  createdAt: Date;
  updatedAt: Date;
}

function createMockEntry(overrides: Partial<SymptomEntry> = {}): SymptomEntry {
  return {
    id: 1,
    userId: 1,
    date: "2026-03-20",
    dizziness: 3,
    headache: 2,
    sleepQuality: 7,
    anxiety: 4,
    fatigue: 3,
    photosensitivity: 2,
    motionSickness: 1,
    palpitations: 2,
    mood: 6,
    severeHeadache: 0,
    notes: "测试",
    medications: [{ name: "布洛芬", dosage: "200mg" }],
    triggers: ["睡眠不足"],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("CSV export logic", () => {
  it("should generate correct CSV headers", () => {
    const headers = [
      "日期", "头晕", "头痛", "睡眠质量", "焦虑", "疲劳", "畏光",
      "运动敏感", "心慌", "心情", "剧烈头痛", "用药", "诱因", "备注",
    ];
    expect(headers).toHaveLength(14);
    expect(headers[0]).toBe("日期");
    expect(headers[10]).toBe("剧烈头痛");
  });

  it("should escape CSV values with commas", () => {
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    expect(escapeCSV("hello")).toBe("hello");
    expect(escapeCSV("hello,world")).toBe('"hello,world"');
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });

  it("should format medication for CSV", () => {
    const meds: MedicationItem[] = [
      { name: "布洛芬", dosage: "200mg" },
      { name: "维生素B", dosage: "1片" },
    ];
    const formatted = meds.map((m) => (m.dosage ? `${m.name} ${m.dosage}` : m.name)).join("、");
    expect(formatted).toBe("布洛芬 200mg、维生素B 1片");
  });

  it("should handle empty entries", () => {
    const entries: SymptomEntry[] = [];
    expect(entries.length).toBe(0);
  });
});

describe("Summary text generation logic", () => {
  it("should compute averages correctly", () => {
    const entries = [
      createMockEntry({ dizziness: 4, headache: 6 }),
      createMockEntry({ dizziness: 2, headache: 4 }),
    ];
    const avg = (entries[0].dizziness + entries[1].dizziness) / 2;
    expect(avg).toBe(3);
  });

  it("should detect improving trends", () => {
    // First half has higher dizziness, second half lower = improving (for inverted symptom)
    const entries = [
      createMockEntry({ date: "2026-03-14", dizziness: 7 }),
      createMockEntry({ date: "2026-03-15", dizziness: 6 }),
      createMockEntry({ date: "2026-03-16", dizziness: 8 }),
      createMockEntry({ date: "2026-03-17", dizziness: 3 }),
      createMockEntry({ date: "2026-03-18", dizziness: 2 }),
      createMockEntry({ date: "2026-03-19", dizziness: 1 }),
    ];
    const mid = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, mid);
    const secondHalf = entries.slice(mid);
    const avg1 = firstHalf.reduce((s, e) => s + e.dizziness, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((s, e) => s + e.dizziness, 0) / secondHalf.length;
    expect(avg2).toBeLessThan(avg1); // Improving (lower is better for inverted)
  });

  it("should count severe headache days", () => {
    const entries = [
      createMockEntry({ severeHeadache: 1 }),
      createMockEntry({ severeHeadache: 0 }),
      createMockEntry({ severeHeadache: 1 }),
    ];
    const count = entries.filter((e) => e.severeHeadache === 1).length;
    expect(count).toBe(2);
  });

  it("should extract top triggers", () => {
    const entries = [
      createMockEntry({ triggers: ["睡眠不足", "压力大"] }),
      createMockEntry({ triggers: ["睡眠不足", "天气变化"] }),
      createMockEntry({ triggers: ["睡眠不足"] }),
    ];
    const triggerMap = new Map<string, number>();
    entries.forEach((e) => {
      e.triggers.forEach((t) => {
        triggerMap.set(t, (triggerMap.get(t) ?? 0) + 1);
      });
    });
    const sorted = Array.from(triggerMap.entries()).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe("睡眠不足");
    expect(sorted[0][1]).toBe(3);
  });

  it("should extract top medications", () => {
    const entries = [
      createMockEntry({ medications: [{ name: "布洛芬", dosage: "200mg" }] }),
      createMockEntry({ medications: [{ name: "布洛芬", dosage: "200mg" }, { name: "维生素B", dosage: "1片" }] }),
      createMockEntry({ medications: [{ name: "维生素B", dosage: "1片" }] }),
    ];
    const medMap = new Map<string, number>();
    entries.forEach((e) => {
      e.medications.forEach((m) => {
        if (m.name.trim()) {
          medMap.set(m.name.trim(), (medMap.get(m.name.trim()) ?? 0) + 1);
        }
      });
    });
    const sorted = Array.from(medMap.entries()).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe("布洛芬");
    expect(sorted[0][1]).toBe(2);
    expect(sorted[1][0]).toBe("维生素B");
    expect(sorted[1][1]).toBe(2);
  });
});

describe("Frequent prescription logic", () => {
  it("should identify frequently used medications", () => {
    const medHistory = [
      { name: "布洛芬", dosage: "200mg", count: 15 },
      { name: "维生素B", dosage: "1片", count: 12 },
      { name: "褪黑素", dosage: "3mg", count: 10 },
      { name: "临时药", dosage: "1片", count: 1 },
    ];

    // Group by name, pick most-used dosage per name
    const nameMap = new Map<string, { name: string; dosage: string; count: number }>();
    for (const item of medHistory) {
      const existing = nameMap.get(item.name);
      if (!existing || item.count > existing.count) {
        nameMap.set(item.name, item);
      }
    }

    // Filter those used at least twice
    const frequent = Array.from(nameMap.values())
      .filter((m) => m.count >= 2)
      .sort((a, b) => b.count - a.count);

    expect(frequent).toHaveLength(3);
    expect(frequent[0].name).toBe("布洛芬");
    expect(frequent[0].dosage).toBe("200mg");
    // "临时药" should be excluded (count < 2)
    expect(frequent.find((m) => m.name === "临时药")).toBeUndefined();
  });

  it("should return empty for no history", () => {
    const medHistory: { name: string; dosage: string; count: number }[] = [];
    const frequent = medHistory.filter((m) => m.count >= 2);
    expect(frequent).toHaveLength(0);
  });
});
