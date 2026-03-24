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
            content: `你是一位拥有丰富临床经验的药学专家，精通药物相互作用评估。请基于循证医学证据，严谨分析用户正在同时服用的药品之间可能存在的相互作用。

## 核心分析原则（必须严格遵守）

### 1. 只报告有临床意义的相互作用
- 只报告在实际临床中可能影响疗效或安全性的相互作用
- 不要报告仅存在理论可能但无临床报道的相互作用
- 如果两种药物之间没有已知的有临床意义的相互作用，不要勉强编造

### 2. 复方制剂的处理
- 复方制剂（如氟哌噻吨美利曲辛片/黛力新）需要分析其各活性成分与其他药物的相互作用
- 但必须考虑复方制剂中各成分的实际剂量——低剂量成分的相互作用风险通常远低于常规剂量
- 例如：黛力新含氟哌噻吨0.5mg（远低于抗精神病常规剂量3-15mg），其多巴胺受体相关的相互作用风险极低

### 3. 剂量决定风险
- 相互作用的临床意义与药物剂量密切相关
- 如果用户服用的是低剂量，即使存在理论上的相互作用，实际风险也可能很低
- 必须在描述中说明剂量对风险的影响

### 4. 严重程度定义标准
- **severe（严重）**：可能危及生命或造成不可逆损害，通常应避免联用。例如：MAO抑制剂+SSRI（5-HT综合征风险）、QT延长药物叠加
- **moderate（中等）**：可能需要调整剂量、加强监测或考虑替代方案。例如：SSRI+NSAIDs（出血风险增加）、CYP酶抑制导致的血药浓度升高
- **mild（轻微）**：有理论风险但临床意义较小，一般无需特殊处理，了解即可。例如：轻微的药效叠加、可忽略的药代动力学影响

### 5. 证据等级
- 基于药品说明书、权威药物相互作用数据库（如Lexicomp、Micromedex）和临床指南
- 如果某个相互作用仅来自个案报道或体外实验，应在描述中说明证据有限

## 严格禁止
- 禁止编造不存在的药物相互作用
- 禁止将同类药物的相互作用简单套用到不同药物上（如不能将高剂量氟哌噻吨的相互作用套用到黛力新中的低剂量氟哌噻吨）
- 禁止夸大低剂量药物的相互作用风险
- 禁止忽略"该药物在复方制剂中的实际剂量"这一关键因素
- 禁止将药理学理论推导等同于临床实际风险`,
          },
          {
            role: "user",
            content: `请严谨分析以下药品组合的相互作用（注意：必须考虑实际剂量和制剂特性，只报告有临床意义的相互作用）：\n${medNames.join("\n")}`,
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
                      severity: {
                        type: "string",
                        enum: ["mild", "moderate", "severe"],
                      },
                      description: {
                        type: "string",
                        description:
                          "相互作用描述，需包含机制和剂量因素的考量",
                      },
                      recommendation: {
                        type: "string",
                        description: "具体可操作的建议措施",
                      },
                      evidenceLevel: {
                        type: "string",
                        enum: ["high", "moderate", "low"],
                        description:
                          "证据等级：high=药品说明书/权威指南明确记载，moderate=多项临床研究支持，low=个案报道或理论推导",
                      },
                    },
                    required: [
                      "drugA",
                      "drugB",
                      "severity",
                      "description",
                      "recommendation",
                      "evidenceLevel",
                    ],
                    additionalProperties: false,
                  },
                },
                disclaimer: {
                  type: "string",
                  description:
                    "固定免责声明：药物相互作用分析仅供参考，不能替代专业医疗建议。如有疑虑，请咨询您的医生或药剂师。",
                },
              },
              required: ["interactions", "disclaimer"],
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

      return {
        interactions,
        disclaimer: parsed.disclaimer || "药物相互作用分析仅供参考，不能替代专业医疗建议。",
        message: `分析完成，发现 ${interactions.length} 个潜在交互`,
      };
    } catch (err) {
      console.error("[DrugInteractions] LLM analysis error:", err);
      return { interactions: [], message: "分析失败，请稍后重试" };
    }
  }),
});
