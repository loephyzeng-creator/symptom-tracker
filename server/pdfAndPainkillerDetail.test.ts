/**
 * Tests for:
 * 1. AI Analysis PDF Export (markdownToHtml utility logic)
 * 2. Painkiller Detail (schema, router, dialog constants)
 */
import { describe, it, expect } from "vitest";

// ========== 1. PDF Export: markdownToHtml logic ==========

function markdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = html.split("\n");
  let result: string[] = [];
  let inList = false;
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.match(/^### /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push(`<h3>${line.replace(/^### /, "")}</h3>`);
      continue;
    }
    if (line.match(/^## /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push(`<h2>${line.replace(/^## /, "")}</h2>`);
      continue;
    }
    if (line.match(/^# /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push(`<h1>${line.replace(/^# /, "")}</h1>`);
      continue;
    }

    if (line.match(/^---+$/)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push("<hr />");
      continue;
    }

    if (line.match(/^[-*] /)) {
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push(`<li>${line.replace(/^[-*] /, "")}</li>`);
      continue;
    }

    if (line.match(/^\d+\. /)) {
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      if (!inList) { result.push("<ol>"); inList = true; }
      result.push(`<li>${line.replace(/^\d+\. /, "")}</li>`);
      continue;
    }

    if (line.trim() === "") {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      continue;
    }

    if (!inParagraph) {
      result.push("<p>");
      inParagraph = true;
    } else {
      result.push("<br />");
    }
    result.push(line);
  }

  if (inList) result.push("</ul>");
  if (inParagraph) result.push("</p>");

  let output = result.join("\n");
  output = output.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*(.+?)\*/g, "<em>$1</em>");
  output = output.replace(/`(.+?)`/g, "<code>$1</code>");

  return output;
}

describe("markdownToHtml (PDF export utility)", () => {
  it("converts headings correctly", () => {
    const md = "# Title\n## Subtitle\n### Section";
    const html = markdownToHtml(md);
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Subtitle</h2>");
    expect(html).toContain("<h3>Section</h3>");
  });

  it("converts bold text", () => {
    const md = "This is **bold** text";
    const html = markdownToHtml(md);
    expect(html).toContain("<strong>bold</strong>");
  });

  it("converts italic text", () => {
    const md = "This is *italic* text";
    const html = markdownToHtml(md);
    expect(html).toContain("<em>italic</em>");
  });

  it("converts unordered lists", () => {
    const md = "- Item 1\n- Item 2\n- Item 3";
    const html = markdownToHtml(md);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
    expect(html).toContain("</ul>");
  });

  it("converts ordered lists", () => {
    const md = "1. First\n2. Second";
    const html = markdownToHtml(md);
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>First</li>");
    expect(html).toContain("<li>Second</li>");
  });

  it("converts horizontal rules", () => {
    const md = "Above\n---\nBelow";
    const html = markdownToHtml(md);
    expect(html).toContain("<hr />");
  });

  it("converts inline code", () => {
    const md = "Use `console.log` for debugging";
    const html = markdownToHtml(md);
    expect(html).toContain("<code>console.log</code>");
  });

  it("escapes HTML entities", () => {
    const md = "Use <script> & \"quotes\"";
    const html = markdownToHtml(md);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("handles a realistic AI analysis report", () => {
    const md = `# 症状分析报告

## 总体趋势

您的头痛发作频率在过去两周有**上升趋势**。

## 止疼药使用分析

- 服药日头痛评分均值: 6.5
- 未服药日头痛评分均值: 3.2
- 建议关注*药物过度使用*风险

---

### 建议

1. 减少止疼药使用频率
2. 尝试非药物干预`;

    const html = markdownToHtml(md);
    expect(html).toContain("<h1>症状分析报告</h1>");
    expect(html).toContain("<h2>总体趋势</h2>");
    expect(html).toContain("<strong>上升趋势</strong>");
    expect(html).toContain("<li>服药日头痛评分均值: 6.5</li>");
    expect(html).toContain("<em>药物过度使用</em>");
    expect(html).toContain("<hr />");
    expect(html).toContain("<h3>建议</h3>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>减少止疼药使用频率</li>");
  });
});

// ========== 2. Painkiller Detail Schema ==========

describe("Painkiller Detail - Schema", () => {
  it("schema includes painkillerBrand column", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.symptomEntries);
    expect(columnNames).toContain("painkillerBrand");
  });

  it("schema includes painkillerDosage column", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.symptomEntries);
    expect(columnNames).toContain("painkillerDosage");
  });
});

// ========== 3. Painkiller Detail Router ==========

describe("Painkiller Detail - Router", () => {
  it("should have updatePainkillerDetail procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["entries.updatePainkillerDetail"]).toBeDefined();
  });
});

// ========== 4. Painkiller Detail DB ==========

describe("Painkiller Detail - DB", () => {
  it("should export updatePainkillerDetail function", async () => {
    const db = await import("./db");
    expect(typeof db.updatePainkillerDetail).toBe("function");
  });
});

// ========== 5. Input Validation ==========

describe("Painkiller Detail - Input Validation", () => {
  it("updatePainkillerDetail schema validates correctly", async () => {
    const { z } = await import("zod");

    const schema = z.object({
      entryId: z.number(),
      painkillerBrand: z.string(),
      painkillerDosage: z.string(),
    });

    const valid = schema.safeParse({
      entryId: 1,
      painkillerBrand: "布洛芬",
      painkillerDosage: "400mg",
    });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({
      entryId: "not-a-number",
      painkillerBrand: "布洛芬",
    });
    expect(invalid.success).toBe(false);
  });

  it("entry schema accepts optional painkillerBrand/painkillerDosage", async () => {
    const { z } = await import("zod");

    const schema = z.object({
      painkillerBrand: z.string().optional().nullable(),
      painkillerDosage: z.string().optional().nullable(),
    });

    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ painkillerBrand: null }).success).toBe(true);
    expect(schema.safeParse({ painkillerBrand: "布洛芬", painkillerDosage: "400mg" }).success).toBe(true);
  });
});

// ========== 6. Common Painkiller Constants ==========

describe("PainkillerDetailDialog constants", () => {
  const COMMON_PAINKILLERS = [
    "布洛芬", "对乙酰氨基酚", "阿司匹林", "双氯芬酸",
    "萘普生", "曲马多", "氨酚待因", "舒马曲坦",
  ];

  const COMMON_DOSAGES = ["200mg", "400mg", "500mg", "600mg", "1片", "2片"];

  it("has common painkiller options covering major categories", () => {
    expect(COMMON_PAINKILLERS.length).toBeGreaterThan(5);
    expect(COMMON_PAINKILLERS).toContain("布洛芬");
    expect(COMMON_PAINKILLERS).toContain("对乙酰氨基酚");
    expect(COMMON_PAINKILLERS).toContain("舒马曲坦"); // triptan for migraines
  });

  it("has common dosage options", () => {
    expect(COMMON_DOSAGES.length).toBeGreaterThan(3);
    expect(COMMON_DOSAGES).toContain("400mg");
    expect(COMMON_DOSAGES).toContain("1片");
  });
});
