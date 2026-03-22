/**
 * Headache Attack Frequency & Painkiller Usage Trend Chart
 * Shows daily headache attack levels and painkiller usage
 * Only shows dates with relevant data (headache > 0 or painkiller taken)
 * Supports: date range from parent, brand/dosage tooltip, export to image
 */
import { useMemo, useState, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { Brain, Pill, AlertTriangle, Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getLocalDateStr } from "@shared/timezone";

const HEADACHE_LEVELS = [
  { value: 0, label: "\u65e0", color: "#d4d4d4" },
  { value: 1, label: "\u8f7b\u5fae", color: "#f0c674" },
  { value: 2, label: "\u660e\u663e", color: "#e8944a" },
  { value: 3, label: "\u4e25\u91cd", color: "#c45c5c" },
];

interface HeadachePainkillerChartProps {
  entries: SymptomEntry[];
  rangeDays?: number; // from parent StatsView range selector
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"];
  return `${d.getMonth() + 1}\u6708${d.getDate()}\u65e5 \u661f\u671f${weekdays[d.getDay()]}`;
}

interface DayData {
  date: string;
  dateLabel: string;
  fullDate: string;
  headacheLevel: number;
  headacheLevelLabel: string;
  painkillerTaken: boolean;
  painkillerBrand?: string | null;
  painkillerDosage?: string | null;
}

function HeadacheTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as DayData;
  const level = HEADACHE_LEVELS[data.headacheLevel] || HEADACHE_LEVELS[0];
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-serif text-sm font-semibold mb-1">{data.fullDate}</p>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: level.color }} />
        <span className="text-muted-foreground">{"\u5934\u75db\u7b49\u7ea7\uff1a"}</span>
        <span className="font-medium">{level.label}</span>
      </div>
      {data.painkillerTaken && (
        <div className="flex items-center gap-2 mt-1">
          <Pill className="w-2.5 h-2.5 text-[#e8944a]" />
          <span className="text-muted-foreground">{"\u5df2\u670d\u6b62\u75bc\u836f"}</span>
        </div>
      )}
    </div>
  );
}

function PainkillerTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as DayData;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs max-w-[220px]">
      <p className="font-serif text-sm font-semibold mb-1.5">{data.fullDate}</p>
      <div className="flex items-center gap-2">
        <Pill className="w-2.5 h-2.5 text-[#e8944a] shrink-0" />
        <span className="text-muted-foreground">{"\u6b62\u75bc\u836f\uff1a"}</span>
        <span className="font-medium">{data.painkillerTaken ? "\u5df2\u670d\u7528" : "\u672a\u670d\u7528"}</span>
      </div>
      {data.painkillerBrand && (
        <div className="flex items-center gap-2 mt-1.5 pl-[18px]">
          <span className="text-muted-foreground">{"\u54c1\u724c\uff1a"}</span>
          <span className="font-medium">{data.painkillerBrand}</span>
        </div>
      )}
      {data.painkillerDosage && (
        <div className="flex items-center gap-2 mt-1 pl-[18px]">
          <span className="text-muted-foreground">{"\u5242\u91cf\uff1a"}</span>
          <span className="font-medium">{data.painkillerDosage}</span>
        </div>
      )}
      {data.headacheLevel > 0 && (
        <div className="flex items-center gap-2 mt-1.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: HEADACHE_LEVELS[data.headacheLevel]?.color }} />
          <span className="text-muted-foreground">{"\u5934\u75db\u7b49\u7ea7\uff1a"}{HEADACHE_LEVELS[data.headacheLevel]?.label}</span>
        </div>
      )}
    </div>
  );
}

function getRangeLabel(days: number): string {
  if (days >= 9999) return "\u5168\u90e8";
  return `\u8fd1${days}\u5929`;
}

export default function HeadachePainkillerChart({ entries, rangeDays = 30 }: HeadachePainkillerChartProps) {
  const [today] = useState(() => getLocalDateStr());
  const painkillerUsage = trpc.entries.painkillerUsage.useQuery({ date: today });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const rangeLabel = getRangeLabel(rangeDays);

  // All daily data sorted by date — entries are already filtered by parent StatsView
  const dailyData = useMemo(() => {
    if (entries.length === 0) return [];

    return [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        date: e.date,
        dateLabel: formatDateLabel(e.date),
        fullDate: formatFullDate(e.date),
        headacheLevel: e.severeHeadache ?? 0,
        headacheLevelLabel: HEADACHE_LEVELS[e.severeHeadache ?? 0]?.label ?? "\u65e0",
        painkillerTaken: !!(e as any).painkillerTaken,
        painkillerBrand: (e as any).painkillerBrand ?? null,
        painkillerDosage: (e as any).painkillerDosage ?? null,
      }));
  }, [entries]);

  // Filtered data: only dates with headache attacks (level > 0)
  const headacheData = useMemo(() => {
    return dailyData.filter((d) => d.headacheLevel > 0);
  }, [dailyData]);

  // Filtered data: only dates with painkiller usage
  const painkillerData = useMemo(() => {
    return dailyData.filter((d) => d.painkillerTaken);
  }, [dailyData]);

  // Calculate summary stats from ALL daily data (not filtered)
  const summary = useMemo(() => {
    const attackDays = dailyData.filter((d) => d.headacheLevel > 0).length;
    const severeDays = dailyData.filter((d) => d.headacheLevel >= 3).length;
    const painkillerDays = dailyData.filter((d) => d.painkillerTaken).length;
    const avgLevel = dailyData.length > 0
      ? Math.round(dailyData.reduce((sum, d) => sum + d.headacheLevel, 0) / dailyData.length * 10) / 10
      : 0;

    return { attackDays, severeDays, painkillerDays, totalDays: dailyData.length, avgLevel };
  }, [dailyData]);

  // Export chart as image
  const handleExport = useCallback(async () => {
    if (!chartContainerRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: "#faf8f5",
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const link = document.createElement("a");
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      link.download = `\u75c7\u72b6\u62a5\u544a_${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("\u56fe\u8868\u5df2\u5bfc\u51fa\u4e3a\u56fe\u7247");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("\u5bfc\u51fa\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5");
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  if (entries.length === 0) return null;

  const limit = painkillerUsage.data?.limit ?? 10;

  // Custom Y axis tick for headache levels
  const headacheLevelTick = (value: number) => {
    const labels: Record<number, string> = { 0: "\u65e0", 1: "\u8f7b\u5fae", 2: "\u660e\u663e", 3: "\u4e25\u91cd" };
    return labels[value] ?? "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="space-y-4"
    >
      {/* Export button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 rounded-full border-border"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          {exporting ? "\u5bfc\u51fa\u4e2d..." : "\u5bfc\u51fa\u56fe\u8868"}
        </Button>
      </div>

      {/* Exportable container */}
      <div ref={chartContainerRef} className="space-y-4">
        {/* Export header (only visible in export) */}
        <div className="hidden export-header text-center pb-2">
          <h2 className="font-serif text-lg font-bold">{"\u75c7\u72b6\u65e5\u8bb0 \u2014 \u5934\u75db\u4e0e\u6b62\u75bc\u836f\u62a5\u544a"}</h2>
          <p className="text-xs text-muted-foreground">{rangeLabel} {"\u00b7"} {"\u5bfc\u51fa\u65f6\u95f4"}: {new Date().toLocaleDateString("zh-CN")}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-3 border border-border/50 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="w-4 h-4 text-[#c45c5c]" />
              <span className="text-xs text-muted-foreground">{"\u5934\u75db\u53d1\u4f5c"}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-serif font-bold text-[#c45c5c]">{summary.attackDays}</span>
              <span className="text-xs text-muted-foreground mb-1">{"\u5929"}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {rangeLabel} {"\u00b7"} {"\u4e25\u91cd"} {summary.severeDays} {"\u5929"} {"\u00b7"} {"\u5747\u503c"} {summary.avgLevel}
            </div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/50 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Pill className="w-4 h-4 text-[#e8944a]" />
              <span className="text-xs text-muted-foreground">{"\u6b62\u75bc\u836f\u4f7f\u7528"}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-serif font-bold ${summary.painkillerDays >= limit ? "text-destructive" : summary.painkillerDays >= limit * 0.7 ? "text-[#e8944a]" : "text-[#7a9e7e]"}`}>
                {summary.painkillerDays}
              </span>
              <span className="text-xs text-muted-foreground mb-1">/ {limit} {"\u5929\u4e0a\u9650"}</span>
            </div>
            {summary.painkillerDays >= limit && (
              <div className="flex items-center gap-1 text-[10px] text-destructive mt-1">
                <AlertTriangle className="w-3 h-3" />
                {"\u5df2\u8fbe\u4e0a\u9650\uff0c\u5efa\u8bae\u54a8\u8be2\u533b\u751f"}
              </div>
            )}
            {summary.painkillerDays < limit && (
              <div className="text-[10px] text-muted-foreground mt-1">
                {rangeLabel} {"\u00b7"} {"\u5269\u4f59"} {limit - summary.painkillerDays} {"\u5929\u989d\u5ea6"}
              </div>
            )}
          </div>
        </div>

        {/* Headache Attack Level by Day - only shows dates with headache attacks */}
        <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-serif font-semibold text-sm">{"\u5934\u75db\u53d1\u4f5c\u7b49\u7ea7\uff08\u6309\u65e5\uff09"}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">{rangeLabel}{"\u5934\u75db\u53d1\u4f5c\u65e5\u7684\u7b49\u7ea7\u5206\u5e03"}</p>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-3">
            {HEADACHE_LEVELS.slice(1).map((l) => (
              <div key={l.value} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>

          {headacheData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headacheData} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval={headacheData.length > 15 ? Math.floor(headacheData.length / 8) : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    domain={[0, 3]}
                    ticks={[0, 1, 2, 3]}
                    tickFormatter={headacheLevelTick}
                    width={36}
                  />
                  <Tooltip content={<HeadacheTooltip />} />
                  <Bar dataKey="headacheLevel" radius={[3, 3, 0, 0]}>
                    {headacheData.map((d, index) => (
                      <Cell
                        key={index}
                        fill={HEADACHE_LEVELS[d.headacheLevel]?.color ?? "#d4d4d4"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground">
              {rangeLabel}{"\u65e0\u5934\u75db\u53d1\u4f5c\u8bb0\u5f55"}
            </div>
          )}
        </div>

        {/* Painkiller Usage by Day - only shows dates with painkiller usage */}
        <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Pill className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-serif font-semibold text-sm">{"\u6b62\u75bc\u836f\u4f7f\u7528\uff08\u6309\u65e5\uff09"}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">{rangeLabel}{"\u6b62\u75bc\u836f\u670d\u7528\u65e5\u671f\uff0c\u60ac\u505c\u67e5\u770b\u54c1\u724c\u4e0e\u5242\u91cf"}</p>

          {painkillerData.length > 0 ? (
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={painkillerData} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval={painkillerData.length > 15 ? Math.floor(painkillerData.length / 8) : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    domain={[0, 1]}
                    ticks={[0, 1]}
                    tickFormatter={(v: number) => v === 1 ? "\u662f" : "\u5426"}
                    width={24}
                  />
                  <Tooltip content={<PainkillerTooltip />} />
                  <Bar dataKey={() => 1} name={"\u6b62\u75bc\u836f"} radius={[3, 3, 0, 0]}>
                    {painkillerData.map((_d, index) => (
                      <Cell
                        key={index}
                        fill="#e8944a"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[80px] flex items-center justify-center text-xs text-muted-foreground">
              {rangeLabel}{"\u65e0\u6b62\u75bc\u836f\u4f7f\u7528\u8bb0\u5f55"}
            </div>
          )}

          {/* Monthly limit indicator */}
          <div className="text-center text-[10px] text-muted-foreground mt-2">
            {"\u6708\u5ea6\u4e0a\u9650"} {limit} {"\u5929"} {"\u00b7"} {"\u5df2\u4f7f\u7528"} {summary.painkillerDays} {"\u5929"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
