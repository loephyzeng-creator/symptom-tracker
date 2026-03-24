import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getMedicationReminders } from "../db";

/**
 * Drowsiness risk analysis router — analyzes user's current medications
 * against known drowsiness-causing drug categories using LLM.
 */
export const drowsinessAnalysisRouter = router({
  /**
   * Analyze current medications for drowsiness risk.
   * Returns personalized risk assessment for each medication.
   */
  analyze: protectedProcedure.mutation(async ({ ctx }) => {
    const reminders = await getMedicationReminders(ctx.user.id);
    const activeMeds = reminders.filter((r) => r.enabled);

    if (activeMeds.length === 0) {
      return {
        results: [],
        summary: null,
        message: "暂无正在服用的药物，无法进行嗜睡风险分析",
      };
    }

    const medList = activeMeds.map(
      (r) => `${r.medicationName}${r.dosage ? ` (${r.dosage})` : ""}`
    );

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `你是一位拥有20年临床经验的药理学专家，精通药物副作用评估。请基于循证医学证据，严谨分析每种药品的嗜睡/白天困倦风险。

## 核心分析原则（必须严格遵守）

### 1. 复方制剂必须整体评估
- 复方制剂（如氟哌噻吨美利曲辛片/黛力新）必须作为一个整体评估，不能简单地将各成分的副作用叠加
- 必须考虑各成分之间的协同或拮抗作用
- 例如：黛力新中低剂量氟哌噻吨(0.5mg)作用于突触前D2受体→增加多巴胺释放→产生兴奋/激活作用，与常规抗精神病剂量(>3mg)的镇静作用完全不同

### 2. 剂量决定效应
- 同一药物在不同剂量下可能有完全相反的作用
- 低剂量氟哌噻吨(0.5mg)：突触前受体阻断→DA释放增加→兴奋
- 常规/高剂量氟哌噻吨(>3mg)：突触后受体阻断→DA传递减少→镇静
- 必须根据药品名称中隐含的实际剂量（如"片"通常为标准剂量）来判断

### 3. 以药品说明书和临床数据为准
- 优先参考药品说明书中列出的不良反应发生率
- 如果说明书明确指出"最常见不良反应是失眠"，则不应将嗜睡标为高风险
- 如果说明书建议"不宜晚间服用"，说明该药有兴奋作用而非镇静作用

### 4. 常见药品的准确分类参考
- 氟哌噻吨美利曲辛片（黛力新/Deanxit）：低剂量复方制剂，最常见副作用是失眠(6%)而非嗜睡，疲劳仅1%（不常见），嗜睡风险应为"low"或"none"
- 第一代抗组胺药（氯苯那敏、苯海拉明等）：嗜睡风险"high"
- 第二代抗组胺药（氯雷他定、西替利嗪等）：嗜睡风险"low"
- 苯二氮䓬类（地西泮、阿普唑仑等）：嗜睡风险"high"
- SSRI类（氟西汀、舍曲林等）：嗜睡风险"low"到"moderate"
- β受体阻滞剂（美托洛尔等）：嗜睡风险"low"到"moderate"
- 加巴喷丁/普瑞巴林：嗜睡风险"high"
- 阿片类（曲马多、可待因等）：嗜睡风险"high"

## 输出要求

请以JSON格式返回分析结果：
1. results: 数组，每个元素对应一种药品：
   - medicationName: 药品名称（与输入一致）
   - riskLevel: 嗜睡风险等级 ("high" | "moderate" | "low" | "none")
   - category: 该药品的准确药理类别（复方制剂需注明"复方制剂"并说明各成分）
   - mechanism: 与嗜睡相关的药理机制（准确描述，20字以内。如果嗜睡风险低，说明为什么低）
   - peakDrowsinessTime: 如有嗜睡风险，说明高峰时段；如嗜睡风险低/无，填写"不适用"或"罕见"
   - suggestion: 基于该药品实际特性的个性化建议（如黛力新应建议"早晨服用，避免晚间服用以防失眠"）

2. summary: 综合评估：
   - overallRisk: 综合嗜睡风险 ("high" | "moderate" | "low")
   - combinedEffect: 多药联用的嗜睡风险叠加说明（30字以内，如无叠加风险如实说明）
   - topRecommendation: 最重要的一条建议（40字以内）
   - drivingWarning: 是否建议避免驾驶（仅当有高风险药物时为true）

## 严格禁止
- 禁止仅根据药物类别名称推断风险，必须考虑实际剂量和制剂特性
- 禁止将复方制剂的各成分风险简单相加
- 禁止编造不存在的副作用或夸大风险
- 禁止忽略"低剂量"和"常规剂量"的区别`,
          },
          {
            role: "user",
            content: `请严谨分析以下药品的嗜睡风险（注意：必须考虑实际剂量和制剂特性，不要简单按药物类别归类）：\n${medList.join("\n")}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "drowsiness_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      medicationName: { type: "string" },
                      riskLevel: {
                        type: "string",
                        enum: ["high", "moderate", "low", "none"],
                      },
                      category: { type: "string" },
                      mechanism: { type: "string" },
                      peakDrowsinessTime: { type: "string" },
                      suggestion: { type: "string" },
                    },
                    required: [
                      "medicationName",
                      "riskLevel",
                      "category",
                      "mechanism",
                      "peakDrowsinessTime",
                      "suggestion",
                    ],
                    additionalProperties: false,
                  },
                },
                summary: {
                  type: "object",
                  properties: {
                    overallRisk: {
                      type: "string",
                      enum: ["high", "moderate", "low"],
                    },
                    combinedEffect: { type: "string" },
                    topRecommendation: { type: "string" },
                    drivingWarning: { type: "boolean" },
                  },
                  required: [
                    "overallRisk",
                    "combinedEffect",
                    "topRecommendation",
                    "drivingWarning",
                  ],
                  additionalProperties: false,
                },
              },
              required: ["results", "summary"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        return { results: [], summary: null, message: "分析结果为空" };
      }

      const parsed = JSON.parse(content);
      return {
        results: parsed.results || [],
        summary: parsed.summary || null,
        message: `分析完成，已评估 ${activeMeds.length} 种药品的嗜睡风险`,
      };
    } catch (err) {
      console.error("[DrowsinessAnalysis] LLM analysis error:", err);
      return { results: [], summary: null, message: "分析失败，请稍后重试" };
    }
  }),
});
