/**
 * TriggerTimelineAnalysis — Analyzes symptom changes over time after a trigger event.
 * Shows D+0 to D+N symptom trajectory and estimates recovery period.
 */
import { useMemo, useState } from "react";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Target,
  Zap,
  Info,
} from "lucide-react";

interface Props {
  entries: SymptomEntry[];
  trigger?: string; // Default to "上火"
}

const TRACKED_SYMPTOMS = [
  { key: "dizziness", label: "头晕", color: "#b87a4b" },
  { key: "headache", label: "头痛", color: "#c45c5c" },
  { key: "fatigue", label: "疲劳", color: "#7a9e7e" },
  { key: "anxiety", label: "焦虑", color: "#9b6b8a" },
  { key: "sleepQuality", label: "睡眠", color: "#7a9eb8" },
  { key: "mood", label: "心情", color: "#8b6bbf" },
];

/** Parse YYYY-MM-DD to Date at midnight UTC */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Calculate day difference between two YYYY-MM-DD strings */
function dayDiff(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

interface TriggerEpisode {
  startDate: string;
  endDate: string;
  durationDays: number;
  peakDay: number; // D+N where symptoms were worst
  recoveryDay: number | null; // D+N where symptoms returned to baseline (null if not recovered)
  dailyData: { day: number; date: string; [key: string]: number | string }[];
}

export default function TriggerTimelineAnalysis({ entries, trigger = "上火" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState("dizziness");

  const analysis = useMemo(() => {
    if (entries.length < 5) return null;

    // Sort entries by date
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

    // Build date-indexed map
    const dateMap = new Map<string, SymptomEntry>();
    sorted.forEach((e) => dateMap.set(e.date, e));

    // Find trigger episodes: consecutive or nearby days with the trigger
    const triggerDates = sorted
      .filter((e) => e.triggers.includes(trigger))
      .map((e) => e.date);

    if (triggerDates.length < 1) return null;

    // Group trigger dates into episodes (gap > 3 days = new episode)
    const episodes: { startDate: string; triggerDates: string[] }[] = [];
    let currentEpisode: string[] = [];

    triggerDates.forEach((date) => {
      if (currentEpisode.length === 0) {
        currentEpisode = [date];
      } else {
        const lastDate = currentEpisode[currentEpisode.length - 1];
        if (dayDiff(lastDate, date) <= 3) {
          currentEpisode.push(date);
        } else {
          episodes.push({ startDate: currentEpisode[0], triggerDates: [...currentEpisode] });
          currentEpisode = [date];
        }
      }
    });
    if (currentEpisode.length > 0) {
      episodes.push({ startDate: currentEpisode[0], triggerDates: [...currentEpisode] });
    }

    // For each episode, track symptoms from D+0 to D+7 (or until data runs out)
    const MAX_TRACK_DAYS = 7;
    const processedEpisodes: TriggerEpisode[] = [];

    episodes.forEach((ep) => {
      const startDate = ep.startDate;
      const dailyData: { day: number; date: string; [key: string]: number | string }[] = [];

      for (let d = 0; d <= MAX_TRACK_DAYS; d++) {
        const targetDate = new Date(parseDate(startDate));
        targetDate.setDate(targetDate.getDate() + d);
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

        const entry = dateMap.get(dateStr);
        if (entry) {
          const row: any = { day: d, date: dateStr };
          TRACKED_SYMPTOMS.forEach((s) => {
            row[s.key] = (entry as any)[s.key] ?? 0;
          });
          row.hasTrigger = entry.triggers.includes(trigger) ? 1 : 0;
          dailyData.push(row);
        }
      }

      if (dailyData.length >= 2) {
        // Find peak day (highest dizziness)
        let peakDay = 0;
        let peakVal = 0;
        dailyData.forEach((d) => {
          if ((d.dizziness as number) > peakVal) {
            peakVal = d.dizziness as number;
            peakDay = d.day as number;
          }
        });

        // Find recovery day: first day after peak where dizziness drops below baseline avg
        const baselineEntries = sorted.filter((e) => !e.triggers.includes(trigger));
        const baselineDizziness =
          baselineEntries.length > 0
            ? baselineEntries.reduce((s, e) => s + e.dizziness, 0) / baselineEntries.length
            : 3;

        let recoveryDay: number | null = null;
        for (let i = 0; i < dailyData.length; i++) {
          const d = dailyData[i];
          if ((d.day as number) > peakDay && (d.dizziness as number) <= baselineDizziness + 0.5) {
            recoveryDay = d.day as number;
            break;
          }
        }

        processedEpisodes.push({
          startDate,
          endDate: dailyData[dailyData.length - 1].date as string,
          durationDays: dailyData.length,
          peakDay,
          recoveryDay,
          dailyData,
        });
      }
    });

    if (processedEpisodes.length < 1) return null;

    // Aggregate: average symptom values across all episodes for each D+N
    const aggregated: { day: number; [key: string]: number }[] = [];
    for (let d = 0; d <= MAX_TRACK_DAYS; d++) {
      const row: any = { day: d };
      TRACKED_SYMPTOMS.forEach((s) => {
        const values = processedEpisodes
          .map((ep) => ep.dailyData.find((dd) => dd.day === d))
          .filter(Boolean)
          .map((dd) => dd![s.key] as number);
        row[s.key] = values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
      });
      // Count how many episodes have data for this day
      row.sampleCount = processedEpisodes.filter((ep) => ep.dailyData.some((dd) => dd.day === d)).length;
      if (row.sampleCount > 0) aggregated.push(row);
    }

    // Baseline: average of non-trigger days
    const baselineEntries = sorted.filter((e) => !e.triggers.includes(trigger));
    const baseline: Record<string, number> = {};
    TRACKED_SYMPTOMS.forEach((s) => {
      baseline[s.key] =
        baselineEntries.length > 0
          ? Math.round(
              (baselineEntries.reduce((sum, e) => sum + ((e as any)[s.key] ?? 0), 0) / baselineEntries.length) * 10
            ) / 10
          : 0;
    });

    // Recovery stats
    const recoveredEpisodes = processedEpisodes.filter((ep) => ep.recoveryDay !== null);
    const avgRecoveryDays =
      recoveredEpisodes.length > 0
        ? Math.round(
            (recoveredEpisodes.reduce((s, ep) => s + (ep.recoveryDay ?? 0), 0) / recoveredEpisodes.length) * 10
          ) / 10
        : null;

    const avgPeakDay =
      processedEpisodes.length > 0
        ? Math.round(
            (processedEpisodes.reduce((s, ep) => s + ep.peakDay, 0) / processedEpisodes.length) * 10
          ) / 10
        : 0;

    return {
      episodes: processedEpisodes,
      aggregated,
      baseline,
      avgRecoveryDays,
      avgPeakDay,
      totalEpisodes: processedEpisodes.length,
      recoveredCount: recoveredEpisodes.length,
    };
  }, [entries, trigger]);

  if (!analysis) return null;

  const currentSymptom = TRACKED_SYMPTOMS.find((s) => s.key === selectedSymptom) ?? TRACKED_SYMPTOMS[0];
  const baselineValue = analysis.baseline[selectedSymptom] ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">{trigger}后症状变化时间线</h3>
            <p className="text-[11px] text-muted-foreground">
              {analysis.totalEpisodes} 次{trigger}事件
              {analysis.avgRecoveryDays !== null && (
                <span className="text-sage ml-1">
                  · 平均 {analysis.avgRecoveryDays} 天恢复
                </span>
              )}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/50"
          >
            <div className="p-4 space-y-5">
              {/* Key metrics row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-muted/50 rounded-lg text-center">
                  <Zap className="w-3.5 h-3.5 mx-auto mb-1 text-orange-500" />
                  <div className="text-base font-bold text-foreground">
                    D+{analysis.avgPeakDay}
                  </div>
                  <div className="text-[10px] text-muted-foreground">症状峰值日</div>
                </div>
                <div className="p-2.5 bg-muted/50 rounded-lg text-center">
                  <Target className="w-3.5 h-3.5 mx-auto mb-1 text-sage" />
                  <div className="text-base font-bold text-foreground">
                    {analysis.avgRecoveryDays !== null ? `D+${analysis.avgRecoveryDays}` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">恢复基线日</div>
                </div>
                <div className="p-2.5 bg-muted/50 rounded-lg text-center">
                  <Activity className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
                  <div className="text-base font-bold text-foreground">
                    {analysis.recoveredCount}/{analysis.totalEpisodes}
                  </div>
                  <div className="text-[10px] text-muted-foreground">已恢复次数</div>
                </div>
              </div>

              {/* Symptom selector */}
              <div className="flex flex-wrap gap-1.5">
                {TRACKED_SYMPTOMS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSelectedSymptom(s.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                      selectedSymptom === s.key
                        ? "text-white font-medium shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                    style={
                      selectedSymptom === s.key
                        ? { backgroundColor: s.color }
                        : undefined
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Timeline chart */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {trigger}后 {currentSymptom.label} 变化轨迹（D+0 = {trigger}当天，基于 {analysis.totalEpisodes} 次事件平均）
                  </span>
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={analysis.aggregated}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id={`gradient-${selectedSymptom}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={currentSymptom.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={currentSymptom.color} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        tickFormatter={(v) => `D+${v}`}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: 11,
                        }}
                        formatter={(value: number) => [
                          value,
                          currentSymptom.label,
                        ]}
                        labelFormatter={(label) => {
                          const item = analysis.aggregated.find((a) => a.day === label);
                          return `${trigger}后第 ${label} 天（${item?.sampleCount ?? 0} 次数据）`;
                        }}
                      />
                      {/* Baseline reference line */}
                      <ReferenceLine
                        y={baselineValue}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.6}
                        label={{
                          value: `基线 ${baselineValue}`,
                          position: "right",
                          style: { fontSize: 9, fill: "var(--muted-foreground)" },
                        }}
                      />
                      {/* Area fill */}
                      <Area
                        type="monotone"
                        dataKey={selectedSymptom}
                        fill={`url(#gradient-${selectedSymptom})`}
                        stroke="none"
                        connectNulls
                      />
                      {/* Main line */}
                      <Line
                        type="monotone"
                        dataKey={selectedSymptom}
                        stroke={currentSymptom.color}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: currentSymptom.color, strokeWidth: 2, stroke: "var(--card)" }}
                        activeDot={{ r: 6, fill: currentSymptom.color }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Episode details */}
              {analysis.episodes.length > 1 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      各次{trigger}事件详情
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {analysis.episodes.map((ep, i) => (
                      <div
                        key={ep.startDate}
                        className="flex items-center justify-between py-1.5 px-2.5 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-5">#{i + 1}</span>
                          <span className="text-xs">{ep.startDate.slice(5)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-muted-foreground">
                            峰值 D+{ep.peakDay}
                          </span>
                          <span
                            className={
                              ep.recoveryDay !== null
                                ? "text-sage font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {ep.recoveryDay !== null
                              ? `D+${ep.recoveryDay} 恢复`
                              : "未恢复"}
                          </span>
                          <span className="text-muted-foreground">
                            {ep.durationDays}天数据
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary insight */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {analysis.avgRecoveryDays !== null ? (
                    <span>
                      基于 {analysis.totalEpisodes} 次{trigger}事件分析：症状通常在
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        {" "}D+{analysis.avgPeakDay} 天达到峰值
                      </span>
                      ，之后逐步缓解，平均
                      <span className="text-sage font-medium">
                        {" "}{analysis.avgRecoveryDays} 天后恢复到基线水平
                      </span>
                      。{analysis.avgRecoveryDays > 3
                        ? "恢复周期较长，建议在上火初期就开始饮食调理（清热降火饮品+清淡饮食），可能有助于缩短恢复时间。"
                        : "恢复速度较快，说明身体调节能力良好。继续保持健康的饮食习惯。"}
                    </span>
                  ) : analysis.totalEpisodes < 2 ? (
                    <span>
                      目前仅有 {analysis.totalEpisodes} 次{trigger}事件记录，需要更多数据才能准确预判恢复周期。
                      建议每次{trigger}时都记录诱因，并在之后几天持续记录症状变化。
                    </span>
                  ) : (
                    <span>
                      基于 {analysis.totalEpisodes} 次{trigger}事件，症状在
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        {" "}D+{analysis.avgPeakDay} 天达到峰值
                      </span>
                      ，但在跟踪期内未明显恢复到基线水平。建议延长记录天数（{trigger}后持续记录 7 天以上），
                      并注意饮食调理以加速恢复。
                    </span>
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
