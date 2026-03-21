/**
 * AI-powered symptom analysis using LLM.
 * Builds a structured prompt from user's historical symptom data,
 * sends it to the LLM, and returns a structured analysis report.
 */
import { invokeLLM } from "./_core/llm";

interface SymptomEntryForAnalysis {
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
  medications: { name: string; dosage: string }[] | string | null;
  triggers: string[] | string | null;
  notes: string | null;
}

/** Normalize medications to array */
function normMeds(meds: any): { name: string; dosage: string }[] {
  if (!meds) return [];
  if (Array.isArray(meds)) return meds;
  if (typeof meds === "string") {
    try { return JSON.parse(meds); } catch { return []; }
  }
  return [];
}

/** Normalize triggers to array */
function normTriggers(triggers: any): string[] {
  if (!triggers) return [];
  if (Array.isArray(triggers)) return triggers;
  if (typeof triggers === "string") {
    try { return JSON.parse(triggers); } catch { return []; }
  }
  return [];
}

/** Build a concise data summary for the LLM prompt */
function buildDataSummary(entries: SymptomEntryForAnalysis[]): string {
  if (entries.length === 0) return "暂无数据记录。";

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const dateRange = `${sorted[0].date} 至 ${sorted[sorted.length - 1].date}`;
  const totalDays = sorted.length;

  // Compute averages
  const fields = [
    "dizziness", "headache", "sleepQuality", "anxiety", "fatigue",
    "photosensitivity", "motionSickness", "palpitations", "mood",
  ] as const;

  const avgs: Record<string, number> = {};
  for (const f of fields) {
    const sum = sorted.reduce((s, e) => s + (e[f] ?? 0), 0);
    avgs[f] = Math.round((sum / totalDays) * 10) / 10;
  }

  // Severe headache count
  const severeCount = sorted.filter((e) => e.severeHeadache === 1).length;

  // Trigger frequency
  const triggerCounts: Record<string, number> = {};
  for (const e of sorted) {
    for (const t of normTriggers(e.triggers)) {
      triggerCounts[t] = (triggerCounts[t] || 0) + 1;
    }
  }

  // Medication frequency
  const medCounts: Record<string, number> = {};
  for (const e of sorted) {
    for (const m of normMeds(e.medications)) {
      if (m.name.trim()) {
        const key = m.dosage ? `${m.name} ${m.dosage}` : m.name;
        medCounts[key] = (medCounts[key] || 0) + 1;
      }
    }
  }

  // Recent trend (last 7 days vs previous 7 days)
  const recent7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);

  let trendSection = "";
  if (prev7.length >= 3 && recent7.length >= 3) {
    const recentAvg: Record<string, number> = {};
    const prevAvg: Record<string, number> = {};
    for (const f of fields) {
      recentAvg[f] = Math.round((recent7.reduce((s, e) => s + (e[f] ?? 0), 0) / recent7.length) * 10) / 10;
      prevAvg[f] = Math.round((prev7.reduce((s, e) => s + (e[f] ?? 0), 0) / prev7.length) * 10) / 10;
    }
    trendSection = "\n\n近期趋势（最近7天 vs 之前7天）：\n";
    const labels: Record<string, string> = {
      dizziness: "头晕", headache: "头痛", sleepQuality: "睡眠",
      anxiety: "焦虑", fatigue: "疲劳", photosensitivity: "畏光",
      motionSickness: "运动敏感", palpitations: "心慌", mood: "心情",
    };
    for (const f of fields) {
      const diff = recentAvg[f] - prevAvg[f];
      const arrow = diff > 0.5 ? "↑" : diff < -0.5 ? "↓" : "→";
      trendSection += `  ${labels[f]}: ${prevAvg[f]} → ${recentAvg[f]} ${arrow}\n`;
    }
  }

  // Build per-day data table (last 30 entries max for token efficiency)
  const recentEntries = sorted.slice(-30);
  let dataTable = "\n\n最近记录明细（最多30天）：\n";
  dataTable += "日期 | 头晕 | 头痛 | 睡眠 | 焦虑 | 疲劳 | 畏光 | 运动敏感 | 心慌 | 心情 | 剧烈头痛 | 诱因 | 用药 | 备注\n";
  for (const e of recentEntries) {
    const meds = normMeds(e.medications).map((m) => m.dosage ? `${m.name}(${m.dosage})` : m.name).join(",") || "-";
    const trigs = normTriggers(e.triggers).join(",") || "-";
    dataTable += `${e.date} | ${e.dizziness} | ${e.headache} | ${e.sleepQuality} | ${e.anxiety} | ${e.fatigue} | ${e.photosensitivity} | ${e.motionSickness} | ${e.palpitations} | ${e.mood} | ${e.severeHeadache ? "是" : "否"} | ${trigs} | ${meds} | ${e.notes || "-"}\n`;
  }

  const triggerStr = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}(${c}次)`)
    .join("、") || "无";

  const medStr = Object.entries(medCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => `${m}(${c}次)`)
    .join("、") || "无";

  return `数据概览：
- 记录范围：${dateRange}，共 ${totalDays} 天
- 剧烈头痛天数：${severeCount} 天

各指标平均值（0-10分）：
  头晕脑胀: ${avgs.dizziness}  |  头痛程度: ${avgs.headache}  |  睡眠质量: ${avgs.sleepQuality}
  焦虑程度: ${avgs.anxiety}  |  疲劳程度: ${avgs.fatigue}  |  畏光程度: ${avgs.photosensitivity}
  运动敏感: ${avgs.motionSickness}  |  心慌程度: ${avgs.palpitations}  |  整体心情: ${avgs.mood}

常见诱因：${triggerStr}
常用药物：${medStr}${trendSection}${dataTable}`;
}

interface AdherenceData {
  overallRate: number;
  perMedication: Array<{ name: string; expected: number; taken: number; rate: number }>;
  dailyData: Array<{ date: string; expected: number; taken: number; rate: number }>;
}

interface StockItem {
  reminderId: number;
  medicationName: string;
  dosage: string;
  stockQuantity: number;
  dailyDosageCount: number;
  daysRemaining: number;
  estimatedRunOutDate: string;
  alertDays: number;
  isLow: boolean;
  enabled: number;
}

/** Build medication adherence summary for AI prompt */
function buildAdherenceSummary(adherence: AdherenceData | null): string {
  if (!adherence || adherence.perMedication.length === 0) return "";

  let summary = "\n\n用药依从性数据：\n";
  summary += `- 总体依从率：${adherence.overallRate}%\n`;
  summary += "- 各药品依从率：\n";
  for (const med of adherence.perMedication) {
    summary += `  ${med.name}: ${med.rate}% (${med.taken}/${med.expected}天)\n`;
  }

  // Identify periods of poor adherence
  const poorDays = adherence.dailyData.filter(d => d.rate < 50);
  if (poorDays.length > 0) {
    summary += `- 依从率低于50%的天数：${poorDays.length}天\n`;
    if (poorDays.length <= 10) {
      summary += `  日期：${poorDays.map(d => d.date).join(", ")}\n`;
    }
  }

  return summary;
}

/** Build stock status summary for AI prompt */
function buildStockSummary(stockData: StockItem[] | null): string {
  if (!stockData || stockData.length === 0) return "";

  let summary = "\n\n药品库存状态：\n";
  for (const item of stockData) {
    const status = item.isLow ? "⚠️ 库存不足" : "✅ 充足";
    summary += `- ${item.medicationName}: 剩余${item.stockQuantity}剂，预计${item.daysRemaining}天后用完 (${status})\n`;
  }
  return summary;
}

/** Run AI analysis on symptom data */
export async function analyzeSymptoms(
  entries: SymptomEntryForAnalysis[],
  adherenceData?: AdherenceData | null,
  stockData?: StockItem[] | null
): Promise<string> {
  if (entries.length === 0) {
    return "暂无足够的数据进行分析。请至少记录几天的症状数据后再尝试 AI 分析。";
  }

  const dataSummary = buildDataSummary(entries);

  const adherenceSummary = buildAdherenceSummary(adherenceData ?? null);
  const stockSummary = buildStockSummary(stockData ?? null);

  const systemPrompt = `你是一位专业的健康数据分析助手，擅长分析症状日记数据并提供有价值的洞察。

用户正在使用一款症状追踪应用，记录了以下9项指标（0-10分）：
- 负面指标（越低越好）：头晕脑胀、头痛程度、焦虑程度、疲劳程度、畏光程度、运动敏感、心慌程度
- 正面指标（越高越好）：睡眠质量、整体心情

请基于用户的历史数据，提供以下分析：

## 分析要求

1. **症状模式识别**：发现症状之间的关联模式（如哪些症状经常同时出现或此消彼长）
2. **诱因关联分析**：分析特定诱因出现时各症状的变化规律
3. **用药效果评估**：分析用药前后症状的变化趋势
4. **用药依从性与症状关联**：如果有依从性数据，分析服药规律与症状改善之间的相关性。特别关注：
   - 漏服天数与症状加重的时间关系
   - 依从率较低的药品是否影响了治疗效果
   - 连续服药期间与间断服药期间的症状对比
5. **时间规律发现**：发现是否存在周期性波动（如周末vs工作日、月初vs月末等）
6. **个性化建议**：基于数据给出具体、可操作的健康管理建议，包括用药依从性改善建议

## 输出格式

请使用 Markdown 格式输出，包含清暙的标题和段落。语言风格应温和、专业、鼓励性。
不要使用过于绝对的医学诊断语言，而是用“数据显示”、“可能存在”、“建议关注”等表述。
如果数据量较少，请如实说明分析的局限性。
如果提供了用药依从性数据，请在报告中单独设置一个“用药依从性与症状关联分析”章节。

重要：你是数据分析助手，不是医生。请在报告末尾提醒用户，AI分析仅供参考，不能替代专业医疗建议。`;

  const userPrompt = `请分析以下症状日记数据并提供深度分析报告：

${dataSummary}${adherenceSummary}${stockSummary}`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 4096,
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 分析未返回有效结果，请稍后重试。");
  }

  // Handle content that may be string or array
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }

  return String(content);
}

/** Export buildDataSummary for testing */
export { buildDataSummary };
