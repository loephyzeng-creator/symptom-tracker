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
            content: `你是一位资深临床药师，擅长药物副作用评估。用户正在服用以下药品，请逐一分析每种药品的嗜睡/白天困倦风险。

请以JSON格式返回分析结果，包含：
1. results: 数组，每个元素对应一种药品：
   - medicationName: 药品名称（与输入一致）
   - riskLevel: 嗜睡风险等级 ("high" | "moderate" | "low" | "none")
   - category: 该药品所属药理类别（如"第一代抗组胺药"、"β受体阻滞剂"等）
   - mechanism: 导致嗜睡的药理机制（简洁，20字以内）
   - peakDrowsinessTime: 服药后嗜睡高峰时段（如"服药后1-3小时"）
   - suggestion: 针对该药品的个性化建议（如"建议睡前服用"、"可换用第二代抗组胺药"等）

2. summary: 综合评估对象：
   - overallRisk: 综合嗜睡风险 ("high" | "moderate" | "low")
   - combinedEffect: 多药联用是否会叠加嗜睡风险的说明（30字以内）
   - topRecommendation: 最重要的一条建议（40字以内）
   - drivingWarning: 是否建议避免驾驶或操作机械（boolean）

注意：
- 只分析已知有嗜睡副作用的药品，没有嗜睡风险的药品 riskLevel 设为 "none"
- 基于药品的药理学特性进行分析，不要编造不存在的副作用
- 如果多种药品联用会叠加嗜睡效果，务必在 combinedEffect 中说明
- 只返回JSON，不要包含其他文字`,
          },
          {
            role: "user",
            content: `请分析以下药品的嗜睡风险：\n${medList.join("\n")}`,
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
