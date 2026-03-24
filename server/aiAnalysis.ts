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
  painkillerTaken: number;
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

/** Build painkiller-headache correlation analysis data */
function buildPainkillerHeadacheCorrelation(entries: SymptomEntryForAnalysis[]): string {
  if (entries.length < 3) return "";

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Days with painkiller vs without
  const withPainkiller = sorted.filter(e => e.painkillerTaken === 1);
  const withoutPainkiller = sorted.filter(e => e.painkillerTaken !== 1);

  if (withPainkiller.length === 0) return "";

  // Average headache score on painkiller days vs non-painkiller days
  const avgHeadacheWith = withPainkiller.length > 0
    ? Math.round((withPainkiller.reduce((s, e) => s + e.headache, 0) / withPainkiller.length) * 10) / 10
    : 0;
  const avgHeadacheWithout = withoutPainkiller.length > 0
    ? Math.round((withoutPainkiller.reduce((s, e) => s + e.headache, 0) / withoutPainkiller.length) * 10) / 10
    : 0;

  // Headache attack level distribution on painkiller days
  const attackLevelOnPainkiller = [0, 0, 0, 0]; // none, mild, moderate, severe
  for (const e of withPainkiller) {
    const level = Math.min(3, Math.max(0, e.severeHeadache));
    attackLevelOnPainkiller[level]++;
  }

  // Headache attack level distribution on non-painkiller days
  const attackLevelNoPainkiller = [0, 0, 0, 0];
  for (const e of withoutPainkiller) {
    const level = Math.min(3, Math.max(0, e.severeHeadache));
    attackLevelNoPainkiller[level]++;
  }

  // Next-day effect: compare headache on day after taking painkiller
  let nextDayBetter = 0;
  let nextDayWorse = 0;
  let nextDaySame = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].painkillerTaken === 1) {
      const todayH = sorted[i].headache;
      const nextH = sorted[i + 1].headache;
      if (nextH < todayH) nextDayBetter++;
      else if (nextH > todayH) nextDayWorse++;
      else nextDaySame++;
    }
  }

  // Weekly painkiller usage pattern
  const weeklyUsage: Record<string, { total: number; painkiller: number }> = {};
  for (const e of sorted) {
    const weekStart = getWeekStart(e.date);
    if (!weeklyUsage[weekStart]) weeklyUsage[weekStart] = { total: 0, painkiller: 0 };
    weeklyUsage[weekStart].total++;
    if (e.painkillerTaken === 1) weeklyUsage[weekStart].painkiller++;
  }

  // Consecutive painkiller usage detection
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  for (const e of sorted) {
    if (e.painkillerTaken === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  // Average other symptoms on painkiller days vs non-painkiller days
  const otherSymptoms = ["dizziness", "anxiety", "fatigue", "sleepQuality", "mood"] as const;
  const symptomComparison: string[] = [];
  const labels: Record<string, string> = {
    dizziness: "头晕", anxiety: "焦虑", fatigue: "疲劳", sleepQuality: "睡眠质量", mood: "心情",
  };
  for (const f of otherSymptoms) {
    const avgWith = withPainkiller.length > 0
      ? Math.round((withPainkiller.reduce((s, e) => s + (e[f] ?? 0), 0) / withPainkiller.length) * 10) / 10
      : 0;
    const avgWithout = withoutPainkiller.length > 0
      ? Math.round((withoutPainkiller.reduce((s, e) => s + (e[f] ?? 0), 0) / withoutPainkiller.length) * 10) / 10
      : 0;
    symptomComparison.push(`  ${labels[f]}: 服药日 ${avgWith} vs 未服药日 ${avgWithout}`);
  }

  let section = "\n\n止疼药使用与头痛关联分析数据：\n";
  section += `- 止疼药使用天数：${withPainkiller.length} 天（共 ${sorted.length} 天记录）\n`;
  section += `- 服药日平均头痛评分：${avgHeadacheWith}，未服药日平均头痛评分：${avgHeadacheWithout}\n`;
  section += `- 服药日头痛发作等级分布：无${attackLevelOnPainkiller[0]}天 / 轻微${attackLevelOnPainkiller[1]}天 / 明显${attackLevelOnPainkiller[2]}天 / 严重${attackLevelOnPainkiller[3]}天\n`;
  section += `- 未服药日头痛发作等级分布：无${attackLevelNoPainkiller[0]}天 / 轻微${attackLevelNoPainkiller[1]}天 / 明显${attackLevelNoPainkiller[2]}天 / 严重${attackLevelNoPainkiller[3]}天\n`;

  if (nextDayBetter + nextDayWorse + nextDaySame > 0) {
    section += `- 服药次日效果：好转${nextDayBetter}次 / 加重${nextDayWorse}次 / 持平${nextDaySame}次\n`;
  }

  if (maxConsecutive > 1) {
    section += `- 最长连续服药天数：${maxConsecutive} 天\n`;
  }

  section += "- 服药日 vs 未服药日其他症状对比：\n";
  section += symptomComparison.join("\n") + "\n";

  // Weekly usage trend
  const weeks = Object.entries(weeklyUsage).sort((a, b) => a[0].localeCompare(b[0]));
  if (weeks.length > 1) {
    section += "- 每周止疼药使用频率：\n";
    for (const [week, data] of weeks.slice(-8)) {
      section += `  ${week}周: ${data.painkiller}/${data.total}天\n`;
    }
  }

  return section;
}

/** Get ISO week start date string */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
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

  // Headache attack count
  const attackCount = sorted.filter((e) => e.severeHeadache > 0).length;
  const severeCount = sorted.filter((e) => e.severeHeadache >= 2).length;
  const painkillerDays = sorted.filter((e) => e.painkillerTaken === 1).length;

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
  dataTable += "日期 | 头晕 | 头痛 | 睡眠 | 焦虑 | 疲劳 | 畏光 | 运动敏感 | 心慌 | 心情 | 头痛发作 | 止疼药 | 诱因 | 用药 | 备注\n";
  for (const e of recentEntries) {
    const meds = normMeds(e.medications).map((m) => m.dosage ? `${m.name}(${m.dosage})` : m.name).join(",") || "-";
    const trigs = normTriggers(e.triggers).join(",") || "-";
    const attackLevel = e.severeHeadache === 0 ? "无" : e.severeHeadache === 1 ? "轻微" : e.severeHeadache === 2 ? "明显" : "严重";
    const painkiller = e.painkillerTaken === 1 ? "是" : "否";
    dataTable += `${e.date} | ${e.dizziness} | ${e.headache} | ${e.sleepQuality} | ${e.anxiety} | ${e.fatigue} | ${e.photosensitivity} | ${e.motionSickness} | ${e.palpitations} | ${e.mood} | ${attackLevel} | ${painkiller} | ${trigs} | ${meds} | ${e.notes || "-"}\n`;
  }

  const triggerStr = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}(${c}次)`)
    .join("、") || "无";

  const medStr = Object.entries(medCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => `${m}(${c}次)`)
    .join("、") || "无";

  // Build painkiller-headache correlation section
  const painkillerCorrelation = buildPainkillerHeadacheCorrelation(entries);

  return `数据概览：
- 记录范围：${dateRange}，共 ${totalDays} 天
- 头痛发作天数：${attackCount} 天（其中明显/严重 ${severeCount} 天）
- 止疼药使用天数：${painkillerDays} 天

各指标平均值（0-10分）：
  头晕脑胀: ${avgs.dizziness}  |  头痛程度: ${avgs.headache}  |  睡眠质量: ${avgs.sleepQuality}
  焦虑程度: ${avgs.anxiety}  |  疲劳程度: ${avgs.fatigue}  |  畏光程度: ${avgs.photosensitivity}
  运动敏感: ${avgs.motionSickness}  |  心慌程度: ${avgs.palpitations}  |  整体心情: ${avgs.mood}

常见诱因：${triggerStr}
常用药物：${medStr}${trendSection}${painkillerCorrelation}${dataTable}`;
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
- 负面指标（分数越高表示症状越严重）：头晕脑胀、头痛程度、焦虑程度、疲劳程度、畏光程度、运动敏感、心慌程度
- 正面指标（分数越高表示状态越好）：睡眠质量（10=睡得很好）、整体心情（10=心情很好）

此外，用户还记录了：
- 头痛发作等级（无/轻微/明显/严重）
- 是否服用止疼药（每日标记）
- 诱因标签（如天气变化、压力、睡眠不足、白天嗜睡等）
- 当日用药记录（药品名称和剂量）

## 核心分析原则（必须严格遵守）

### 1. 基于数据说话
- 所有结论必须有数据支撑，明确引用具体数值和日期
- 不要做没有数据支持的推测
- 如果数据量不足以得出可靠结论，必须明确说明

### 2. 药物分析的准确性
- 分析用药效果时，必须考虑药物的实际药理特性
- 复方制剂（如氟哌噻吨美利曲辛片/黛力新）应按其实际临床用途和剂量评估，不要简单按成分类别归类
- 不要将所有药物笼统称为"药物"，应具体到药品名称
- 区分"日常维持用药"（如抗抑郁药、预防性用药）和"急性止疼药"（如布洛芬、对乙酰氨基酚、曲坦类）

### 3. 止疼药过度使用的准确判断标准
- 不同类型止疼药的MOH（药物过度使用性头痛）风险阈值不同：
  - 曲坦类、阿片类、复方止疼药：每月≥10天
  - 单一成分NSAIDs（布洛芬、萘普生等）、对乙酰氨基酚：每月≥15天
- 判断MOH风险时必须同时满足：使用频率超过阈值 + 头痛频率或程度有加重趋势
- 如果数据中无法确定止疼药的具体类型，应说明"根据止疼药类型不同，安全使用频率为每月10-15天"

### 4. 避免过度解读
- 短期数据（<14天）的趋势分析可靠性有限，需说明
- 相关性不等于因果关系，用"可能相关"而非"导致"
- 单日异常值不代表趋势

## 分析要求

1. **症状模式识别**：发现症状之间的关联模式（如哪些症状经常同时出现或此消彼长），引用具体数据
2. **诱因关联分析**：分析特定诱因出现时各症状的变化规律
3. **用药效果评估**：分析日常维持用药期间症状的整体变化趋势，区分不同药物的可能贡献
4. **止疼药使用与头痛关联分析**（重点章节）：
   - 统计止疼药使用频率，并根据上述准确标准评估是否合理
   - 对比服药日与未服药日的头痛评分和发作等级差异
   - 评估止疼药的即时效果和次日效果
   - 基于准确的MOH判断标准评估风险（不要一刀切使用"月超10天"标准）
   - 分析服药日其他症状的变化
   - 给出止疼药使用的具体建议
5. **用药依从性与症状关联**：如果有依从性数据，分析服药规律与症状改善之间的相关性
6. **时间规律发现**：发现是否存在周期性波动
7. **个性化建议**：基于数据给出具体、可操作的健康管理建议

## 输出格式

请使用 Markdown 格式输出，包含清晰的标题和段落。语言风格应温和、专业、鼓励性。
不要使用过于绝对的医学诊断语言，而是用"数据显示"、"可能存在"、"建议关注"等表述。
如果数据量较少，请如实说明分析的局限性。
**必须**包含一个独立的"止疼药使用与头痛关联分析"章节，即使止疼药使用天数为0也要说明。
如果提供了用药依从性数据，请在报告中单独设置一个"用药依从性与症状关联分析"章节。

## 免责声明（必须包含）

报告末尾**必须**包含以下免责声明（可适当调整措辞但核心内容不变）：
> ⚠️ 本分析由AI基于您的症状记录数据生成，仅供个人健康管理参考，不构成医学诊断或治疗建议。药物使用、剂量调整等决策请务必咨询您的主治医生或药剂师。`;

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

/** Export buildDataSummary and buildPainkillerHeadacheCorrelation for testing */
export { buildDataSummary, buildPainkillerHeadacheCorrelation };
