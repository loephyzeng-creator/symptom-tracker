import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import {
  getMedicationReminders,
  getDrugInteractions,
  saveDrugInteractions,
  checkDrugInteractionsForMed,
} from "../db";

export const drugInteractionsRouter = router({
  /** Get all saved interactions for current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getDrugInteractions(ctx.user.id);
  }),

  /** Check interactions for a specific medication */
  checkForMed: protectedProcedure
    .input(z.object({ medicationName: z.string() }))
    .query(async ({ ctx, input }) => {
      return checkDrugInteractionsForMed(ctx.user.id, input.medicationName);
    }),

  /** Analyze all current medications using LLM and save results */
  analyze: protectedProcedure.mutation(async ({ ctx }) => {
    // Get all active medication reminders
    const reminders = await getMedicationReminders(ctx.user.id);
    const activeMeds = reminders.filter((r) => r.enabled);

    if (activeMeds.length < 2) {
      return { interactions: [], message: "至少需要2种药品才能进行交互检查" };
    }

    const medNames = activeMeds.map((r) => `${r.medicationName} (${r.dosage})`);

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `你是一位专业的临床药师。用户正在同时服用以下药品，请分析它们之间可能存在的药物相互作用。

请以JSON数组格式返回结果，每个元素包含：
- drugA: 药品A名称
- drugB: 药品B名称  
- severity: 严重程度 ("mild" | "moderate" | "severe")
- description: 相互作用描述（中文，简洁明了）
- recommendation: 建议措施（中文）

如果没有已知的相互作用，返回空数组 []。
只返回有临床意义的相互作用，不要编造不存在的相互作用。

重要：只返回JSON数组，不要包含其他文字。`,
          },
          {
            role: "user",
            content: `请分析以下药品组合的相互作用：\n${medNames.join("\n")}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "drug_interactions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                interactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      drugA: { type: "string" },
                      drugB: { type: "string" },
                      severity: { type: "string", enum: ["mild", "moderate", "severe"] },
                      description: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["drugA", "drugB", "severity", "description", "recommendation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["interactions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        return { interactions: [], message: "分析结果为空" };
      }

      const parsed = JSON.parse(content as string);
      const interactions = parsed.interactions || [];

      // Save to database
      await saveDrugInteractions(ctx.user.id, interactions);

      return { interactions, message: `分析完成，发现 ${interactions.length} 个潜在交互` };
    } catch (err) {
      console.error("[DrugInteractions] LLM analysis error:", err);
      return { interactions: [], message: "分析失败，请稍后重试" };
    }
  }),
});
