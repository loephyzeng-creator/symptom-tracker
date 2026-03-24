/**
 * 药物嗜睡风险分析 — 结合用户当前用药进行个性化分析
 * 数据来源: LLM 药理学分析 + WebMD, GoodRx, 美国睡眠医学会
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon,
  ChevronDown,
  AlertTriangle,
  Info,
  Lightbulb,
  Pill,
  Car,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/* ── Types ── */
interface AnalysisResult {
  medicationName: string;
  riskLevel: "high" | "moderate" | "low" | "none";
  category: string;
  mechanism: string;
  peakDrowsinessTime: string;
  suggestion: string;
}

interface AnalysisSummary {
  overallRisk: "high" | "moderate" | "low";
  combinedEffect: string;
  topRecommendation: string;
  drivingWarning: boolean;
}

/* ── Static reference data ── */
interface DrugCategory {
  name: string;
  risk: "high" | "moderate" | "low";
  description: string;
  examples: string[];
  mechanism: string;
}

const DRUG_CATEGORIES: DrugCategory[] = [
  {
    name: "抗组胺药（第一代）",
    risk: "high",
    description: "第一代抗过敏药透过血脑屏障，直接抑制中枢神经",
    examples: ["苯海拉明(Benadryl)", "氯苯那敏(扑尔敏)", "羟嗪(Atarax)", "异丙嗪(非那根)"],
    mechanism: "阻断中枢H1受体，抑制觉醒系统",
  },
  {
    name: "苯二氮䓬类（抗焦虑/安眠）",
    risk: "high",
    description: "增强GABA抑制作用，产生镇静催眠效果",
    examples: ["阿普唑仑(Xanax)", "地西泮(Valium)", "氯硝西泮(Klonopin)", "劳拉西泮(Ativan)"],
    mechanism: "增强GABA-A受体活性，全面抑制中枢神经",
  },
  {
    name: "三环类抗抑郁药",
    risk: "high",
    description: "具有强抗组胺和抗胆碱作用，嗜睡是常见副作用",
    examples: ["阿米替林", "多塞平(Silenor)", "丙米嗪(Tofranil)", "曲米帕明"],
    mechanism: "阻断组胺H1受体和毒蕈碱受体",
  },
  {
    name: "阿片类止痛药",
    risk: "high",
    description: "作用于中枢阿片受体，产生镇痛和镇静效果",
    examples: ["吗啡", "羟考酮(OxyContin)", "芬太尼", "氢可酮(Vicodin)"],
    mechanism: "激活μ-阿片受体，抑制中枢神经系统",
  },
  {
    name: "抗癫痫药/抗惊厥药",
    risk: "moderate",
    description: "通过多种机制稳定神经元，可能导致嗜睡",
    examples: ["卡马西平(Tegretol)", "丙戊酸(Depakote)", "托吡酯(Topamax)", "加巴喷丁"],
    mechanism: "抑制神经元过度放电，影响多种神经递质",
  },
  {
    name: "β受体阻滞剂（降压药）",
    risk: "moderate",
    description: "减慢心率、降低血压，可能引起疲倦和嗜睡",
    examples: ["美托洛尔(Lopressor)", "普萘洛尔(Inderal)", "阿替洛尔(Tenormin)", "比索洛尔"],
    mechanism: "阻断β-肾上腺素受体，降低交感神经活性",
  },
  {
    name: "肌肉松弛剂",
    risk: "moderate",
    description: "作用于中枢神经使肌肉放松，常伴随嗜睡",
    examples: ["环苯扎林(Flexeril)", "替扎尼定(Zanaflex)", "巴氯芬", "美索巴莫"],
    mechanism: "抑制脊髓和脑干的神经传导",
  },
  {
    name: "抗精神病药",
    risk: "moderate",
    description: "阻断多巴胺和组胺受体，镇静作用明显",
    examples: ["奥氮平(Zyprexa)", "喹硫平(Seroquel)", "利培酮", "氯氮平"],
    mechanism: "阻断D2和H1受体，降低中枢兴奋性",
  },
  {
    name: "部分SSRI/SNRI抗抑郁药",
    risk: "low",
    description: "新型抗抑郁药嗜睡风险较低，但部分人仍可能出现",
    examples: ["帕罗西汀(Paxil)", "氟伏沙明", "米氮平(Remeron)", "曲唑酮"],
    mechanism: "调节5-HT/NE再摄取，个体差异较大",
  },
  {
    name: "抗组胺药（第二代）",
    risk: "low",
    description: "新型抗过敏药较少透过血脑屏障，嗜睡风险低",
    examples: ["西替利嗪(仙特明)", "氯雷他定(开瑞坦)", "非索非那定(Allegra)"],
    mechanism: "选择性外周H1受体拮抗，较少影响中枢",
  },
];

const COPING_TIPS = [
  { icon: "⏰", text: "与医生商量将嗜睡药物改为睡前服用" },
  { icon: "🚶", text: "白天适量运动（快走、拉伸）帮助提神" },
  { icon: "☕", text: "适量咖啡因（咖啡/茶），但注意与药物的相互作用" },
  { icon: "💊", text: "询问医生是否有「非嗜睡」版本的替代药物" },
  { icon: "📝", text: "记录嗜睡发生的时间和程度，帮助医生调整方案" },
  { icon: "⚠️", text: "切勿自行停药或调整剂量，务必咨询医生" },
];

/* ── Risk config ── */
const RISK_CONFIG = {
  high: {
    label: "高风险",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    border: "border-red-200 dark:border-red-800/40",
    bg: "bg-red-50 dark:bg-red-950/20",
    icon: "text-red-500",
  },
  moderate: {
    label: "中等风险",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/40",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    icon: "text-amber-500",
  },
  low: {
    label: "低风险",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    border: "border-green-200 dark:border-green-800/40",
    bg: "bg-green-50 dark:bg-green-950/20",
    icon: "text-green-500",
  },
  none: {
    label: "无风险",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700/40",
    bg: "bg-gray-50 dark:bg-gray-950/20",
    icon: "text-gray-400",
  },
};

/* ── Component ── */
export default function DrowsinessReference() {
  const [expanded, setExpanded] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  // Personalized analysis mutation
  const analyzeMutation = trpc.drowsinessAnalysis.analyze.useMutation();

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const results: AnalysisResult[] = (analyzeMutation.data?.results || []) as AnalysisResult[];
  const summary = (analyzeMutation.data?.summary || null) as AnalysisSummary | null;
  const hasResults = results.length > 0;
  const riskyMeds = results.filter((r: AnalysisResult) => r.riskLevel !== "none");

  return (
    <div>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-serif font-semibold text-sm">药物嗜睡风险分析</h3>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Disclaimer */}
            <div className="flex items-start gap-1.5 mt-3 p-2.5 bg-muted/50 rounded-lg">
              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                基于您当前正在服用的药物进行个性化嗜睡风险分析。
                分析结果仅供参考，如有嗜睡困扰请咨询您的主治医生。
              </p>
            </div>

            {/* Analyze button */}
            <div className="mt-3">
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                variant="outline"
                className="w-full gap-2 h-9"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在分析您的药物...
                  </>
                ) : hasResults ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    重新分析
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    分析我的药物嗜睡风险
                  </>
                )}
              </Button>
            </div>

            {/* Error state */}
            {analyzeMutation.isError && (
              <div className="mt-3 p-2.5 bg-destructive/5 rounded-lg border border-destructive/10">
                <p className="text-xs text-destructive">
                  分析失败，请稍后重试
                </p>
              </div>
            )}

            {/* No medications message */}
            {hasResults && results.length === 0 && analyzeMutation.data?.message && (
              <div className="mt-3 p-3 bg-muted/30 rounded-xl text-center">
                <Pill className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">
                  {analyzeMutation.data.message}
                </p>
              </div>
            )}

            {/* ═══ Personalized Analysis Results ═══ */}
            {hasResults && summary && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 space-y-3"
              >
                {/* Overall summary card */}
                <div
                  className={`rounded-xl border p-3 ${
                    RISK_CONFIG[summary.overallRisk].border
                  } ${RISK_CONFIG[summary.overallRisk].bg}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert
                      className={`w-4 h-4 ${
                        RISK_CONFIG[summary.overallRisk].icon
                      }`}
                    />
                    <span className="text-sm font-semibold">综合嗜睡风险评估</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ml-auto ${
                        RISK_CONFIG[summary.overallRisk].color
                      }`}
                    >
                      {RISK_CONFIG[summary.overallRisk].label}
                    </Badge>
                  </div>

                  <p className="text-xs text-foreground/80 leading-relaxed mb-2">
                    {summary.combinedEffect}
                  </p>

                  <div className="flex items-start gap-1.5 p-2 bg-background/60 rounded-lg">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-foreground/70 leading-relaxed">
                      {summary.topRecommendation}
                    </p>
                  </div>

                  {summary.drivingWarning && (
                    <div className="flex items-center gap-1.5 mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200/50 dark:border-red-800/30">
                      <Car className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                        建议避免驾驶或操作重型机械
                      </p>
                    </div>
                  )}
                </div>

                {/* Per-medication analysis */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground px-1">
                    各药品嗜睡风险详情
                  </h4>
                  {results.map((med, i) => {
                    const config =
                      RISK_CONFIG[med.riskLevel as keyof typeof RISK_CONFIG] ||
                      RISK_CONFIG.none;
                    const isOpen = expandedMed === med.medicationName;

                    return (
                      <motion.div
                        key={med.medicationName}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-xl border ${config.border} overflow-hidden`}
                      >
                        <button
                          onClick={() =>
                            setExpandedMed(isOpen ? null : med.medicationName)
                          }
                          className="w-full p-2.5 flex items-center gap-2 text-left hover:bg-muted/20 transition-colors"
                        >
                          <Pill className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">
                            {med.medicationName}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 shrink-0 ${config.color}`}
                          >
                            {config.label}
                          </Badge>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="px-2.5 pb-2.5 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-muted/30 rounded-lg">
                                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                                      药理类别
                                    </span>
                                    <span className="text-xs font-medium">
                                      {med.category}
                                    </span>
                                  </div>
                                  <div className="p-2 bg-muted/30 rounded-lg">
                                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                                      嗜睡高峰
                                    </span>
                                    <span className="text-xs font-medium flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {med.peakDrowsinessTime}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    作用机制：
                                  </span>
                                  <span className="text-[11px] text-foreground/70">
                                    {med.mechanism}
                                  </span>
                                </div>

                                <div className="flex items-start gap-1.5 p-2 bg-sage/5 dark:bg-sage/10 rounded-lg">
                                  <Lightbulb className="w-3 h-3 text-sage shrink-0 mt-0.5" />
                                  <span className="text-[11px] text-foreground/70 leading-relaxed">
                                    {med.suggestion}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Risk count summary */}
                {riskyMeds.length > 0 && (
                  <div className="flex items-center gap-3 px-1 text-[11px] text-muted-foreground">
                    <span>
                      共 {results.length} 种药品：
                    </span>
                    {results.filter((r) => r.riskLevel === "high").length > 0 && (
                      <span className="text-red-500">
                        {results.filter((r) => r.riskLevel === "high").length} 高风险
                      </span>
                    )}
                    {results.filter((r) => r.riskLevel === "moderate").length > 0 && (
                      <span className="text-amber-500">
                        {results.filter((r) => r.riskLevel === "moderate").length} 中等
                      </span>
                    )}
                    {results.filter((r) => r.riskLevel === "low").length > 0 && (
                      <span className="text-green-500">
                        {results.filter((r) => r.riskLevel === "low").length} 低风险
                      </span>
                    )}
                    {results.filter((r) => r.riskLevel === "none").length > 0 && (
                      <span className="text-gray-400">
                        {results.filter((r) => r.riskLevel === "none").length} 无风险
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ Coping Tips ═══ */}
            <button
              onClick={() => setShowTips(!showTips)}
              className="w-full mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-sage/10 dark:bg-sage/5 hover:bg-sage/20 transition-colors"
            >
              <Lightbulb className="w-4 h-4 text-sage" />
              <span className="text-sm font-medium text-sage">应对嗜睡的建议</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-sage ml-auto transition-transform ${
                  showTips ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {showTips && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1.5">
                    {COPING_TIPS.map((tip, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/30"
                      >
                        <span className="text-sm shrink-0">{tip.icon}</span>
                        <span className="text-xs text-foreground/80 leading-relaxed">
                          {tip.text}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══ Generic Reference (collapsible) ═══ */}
            <button
              onClick={() => setShowReference(!showReference)}
              className="w-full mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                通用药物嗜睡风险参考
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform ${
                  showReference ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {showReference && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-2">
                    {DRUG_CATEGORIES.map((cat, i) => {
                      const config = RISK_CONFIG[cat.risk];
                      const isOpen = expandedCategory === cat.name;

                      return (
                        <motion.div
                          key={cat.name}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`rounded-xl border ${config.border} overflow-hidden`}
                        >
                          <button
                            onClick={() =>
                              setExpandedCategory(isOpen ? null : cat.name)
                            }
                            className="w-full p-2.5 flex items-center gap-2 text-left hover:bg-muted/20 transition-colors"
                          >
                            <Pill className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium flex-1 min-w-0 truncate">
                              {cat.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 shrink-0 ${config.color}`}
                            >
                              {config.label}
                            </Badge>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="px-2.5 pb-2.5 space-y-2">
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {cat.description}
                                  </p>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground font-medium">
                                      作用机制：
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {cat.mechanism}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground font-medium block mb-1">
                                      常见药品：
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {cat.examples.map((ex) => (
                                        <Badge
                                          key={ex}
                                          variant="outline"
                                          className="text-[10px] py-0 border-border/50"
                                        >
                                          {ex}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}

                    <p className="text-[10px] text-muted-foreground px-1 pt-1">
                      数据来源：WebMD、GoodRx、美国睡眠医学会
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Important warning */}
            <div className="mt-3 flex items-start gap-1.5 p-2.5 bg-destructive/5 dark:bg-destructive/10 rounded-lg border border-destructive/10">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-[11px] text-destructive/80 dark:text-destructive/90 leading-relaxed">
                如果药物嗜睡严重影响日常生活，请尽快联系您的医生。
                切勿自行停药或调整剂量。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
