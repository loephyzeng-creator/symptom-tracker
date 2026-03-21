/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * History list with card-based entries
 */
import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { formatMedications } from "@/hooks/useSymptomData";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2, Download, Upload, ChevronDown, ChevronUp, FileText, FileSpreadsheet,
  CalendarDays, List, Pill, Filter, ArrowUpDown, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import CalendarView from "./CalendarView";
import MedicationTimeline from "./MedicationTimeline";
import MedicationCheckInSummary from "./MedicationCheckInSummary";

interface HistoryViewProps {
  entries: SymptomEntry[];
  onDelete: (id: number) => void;
  onExport: () => void;
  onExportCSV?: () => void;
  onImport: (json: string) => Promise<boolean> | boolean;
  onSelectDate: (date: string) => void;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}/${d.getDate()} 周${weekdays[d.getDay()]}`;
}

function getOverallScore(entry: SymptomEntry): { score: number; label: string; color: string } {
  const badAvg = (entry.dizziness + entry.headache + entry.anxiety + entry.fatigue +
    entry.photosensitivity + entry.motionSickness + entry.palpitations) / 7;
  const goodAvg = (entry.sleepQuality + entry.mood) / 2;
  const score = Math.round(((10 - badAvg) * 0.6 + goodAvg * 0.4) * 10) / 10;

  if (score >= 7) return { score, label: "状态不错", color: "text-sage" };
  if (score >= 5) return { score, label: "状态一般", color: "text-chart-4" };
  if (score >= 3) return { score, label: "状态较差", color: "text-terracotta" };
  return { score, label: "状态很差", color: "text-destructive" };
}

type MedFilter = "all" | "full" | "partial" | "missed";

const FILTER_OPTIONS: { key: MedFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "full", label: "全部已服" },
  { key: "partial", label: "部分漏服" },
  { key: "missed", label: "全部漏服" },
];

export default function HistoryView({ entries, onDelete, onExport, onExportCSV, onImport, onSelectDate }: HistoryViewProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "medication">("list");
  const [medFilter, setMedFilter] = useState<MedFilter>("all");
  const [showFilter, setShowFilter] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Collect all dates from entries for the batch query
  const allDates = useMemo(() => entries.map((e) => e.date), [entries]);

  // Query medication completion for all entry dates
  const { data: completionData, isLoading: isCompletionLoading } =
    trpc.medReminders.completionByDates.useQuery(
      { dates: allDates },
      {
        enabled: allDates.length > 0,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      }
    );

  const isFilterLoading = medFilter !== "all" && isCompletionLoading;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = await onImport(ev.target?.result as string);
      if (result) {
        toast.success("数据导入成功");
      } else {
        toast.error("导入失败，请检查文件格式");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const reversedEntries = useMemo(() => [...entries].reverse(), [entries]);

  // Apply search filter
  const searchedEntries = useMemo(() => {
    if (!searchQuery.trim()) return reversedEntries;
    const q = searchQuery.trim().toLowerCase();
    return reversedEntries.filter((entry) => {
      if (entry.notes && entry.notes.toLowerCase().includes(q)) return true;
      if (entry.triggers && entry.triggers.some((t: string) => t.toLowerCase().includes(q))) return true;
      if (entry.medications) {
        const medStr = typeof entry.medications === "string" ? entry.medications : JSON.stringify(entry.medications);
        if (medStr.toLowerCase().includes(q)) return true;
      }
      if (entry.date.includes(q)) return true;
      return false;
    });
  }, [reversedEntries, searchQuery]);

  // Apply medication filter
  const filteredEntries = useMemo(() => {
    if (medFilter === "all" || !completionData) return searchedEntries;
    return searchedEntries.filter((entry) => {
      const status = completionData[entry.date];
      if (!status || status === "no-schedule") {
        return false;
      }
      switch (medFilter) {
        case "full":
          return status === "all-taken";
        case "partial":
          return status === "partial";
        case "missed":
          return status === "missed";
        default:
          return true;
      }
    });
  }, [searchedEntries, medFilter, completionData]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663299884726/7CnBeGxyBasxbKLjVrJzxx/empty-state-WiuDqierovtEb9Njh8Jbbn.webp"
          alt="空状态"
          className="w-40 h-40 mx-auto mb-4 opacity-80"
        />
        <p className="font-serif text-lg text-muted-foreground">还没有记录</p>
        <p className="text-sm text-muted-foreground mt-1">开始记录后，这里会显示历史记录</p>
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={handleImportClick} className="rounded-full">
            <Upload className="w-4 h-4 mr-1" /> 导入数据
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">共 </span>
            {entries.length}
            <span className="hidden sm:inline"> 条记录</span>
            <span className="sm:hidden"> 条</span>
          </span>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 rounded-md transition-colors ${viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="列表视图"
            >
              <List className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-1 rounded-md transition-colors ${viewMode === "calendar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="日历视图"
            >
              <CalendarDays className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode("medication")}
              className={`p-1 rounded-md transition-colors ${viewMode === "medication" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="用药时间线"
            >
              <Pill className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Search toggle */}
          <button
            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
            className={`p-1.5 rounded-lg border transition-colors ${
              showSearch
                ? "border-terracotta/40 bg-terracotta/5 text-terracotta"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
            title="搜索"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          {/* Import/Export dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDataMenu(!showDataMenu)}
              className="rounded-full text-xs"
            >
              <ArrowUpDown className="w-3 h-3 mr-1" /> 导入/导出
            </Button>
            {showDataMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDataMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border/50 rounded-xl shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={() => { handleImportClick(); setShowDataMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-muted-foreground" /> 导入数据
                  </button>
                  <div className="border-t border-border/30 my-1" />
                  <button
                    onClick={() => { onExport(); setShowDataMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-muted-foreground" /> 导出 JSON
                  </button>
                  {onExportCSV && (
                    <button
                      onClick={() => { onExportCSV(); setShowDataMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> 导出 CSV
                    </button>
                  )}
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          </div>
        </div>
      </div>

      {/* Search bar */}
      {viewMode === "list" && showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索备注、诱因、药品名..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-terracotta/30 placeholder:text-muted-foreground/50"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <CalendarView entries={entries} onSelectDate={onSelectDate} />
      )}

      {/* Medication Timeline View */}
      {viewMode === "medication" && (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4">
          <MedicationTimeline />
        </div>
      )}

      {/* Entry List */}
      {viewMode === "list" && (
      <div className="space-y-3">
        {/* Medication completion filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              medFilter !== "all"
                ? "border-terracotta/40 bg-terracotta/5 text-terracotta"
                : "border-border/50 text-muted-foreground hover:border-border"
            }`}
          >
            <Filter className="w-3 h-3" />
            服药筛选
            {medFilter !== "all" && (
              <span className="text-[10px] bg-terracotta/20 px-1 rounded">
                {FILTER_OPTIONS.find((f) => f.key === medFilter)?.label}
              </span>
            )}
          </button>
          {showFilter && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1"
            >
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setMedFilter(opt.key);
                    if (opt.key === "all") setShowFilter(false);
                  }}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    medFilter === opt.key
                      ? "bg-foreground/10 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
          {/* Search result count */}
          {searchQuery && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              找到 {filteredEntries.length} 条
            </span>
          )}
        </div>

        {isFilterLoading && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            加载服药数据中...
          </div>
        )}

        {!isFilterLoading && (medFilter !== "all" || searchQuery) && filteredEntries.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            没有符合条件的记录
          </div>
        )}

        {!isFilterLoading && (
        <AnimatePresence>
          {filteredEntries.map((entry) => {
            const overall = getOverallScore(entry);
            const isExpanded = expandedId === entry.id;
            const medStatus = completionData?.[entry.date];
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-serif font-bold ${overall.color}`}>
                      {overall.score}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{formatDateShort(entry.date)}</div>
                      <div className={`text-xs ${overall.color}`}>{overall.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Medication status badge in list */}
                    {medStatus && medStatus !== "no-schedule" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        medStatus === "all-taken"
                          ? "bg-sage/10 text-sage"
                          : medStatus === "partial"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            : "bg-destructive/10 text-destructive"
                      }`}>
                        {medStatus === "all-taken" ? "全服" : medStatus === "partial" ? "部分" : "漏服"}
                      </span>
                    )}
                    <div className="text-right text-xs text-muted-foreground hidden sm:block">
                      <div>头晕 {entry.dizziness} · 头痛 {entry.headache}</div>
                      <div>睡眠 {entry.sleepQuality} · 焦虑 {entry.anxiety}</div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/50"
                    >
                      <div className="p-4 space-y-3">
                        {/* All scores */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">头晕</span><span className="font-medium">{entry.dizziness}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">头痛</span><span className="font-medium">{entry.headache}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">睡眠</span><span className="font-medium">{entry.sleepQuality}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">焦虑</span><span className="font-medium">{entry.anxiety}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">疲劳</span><span className="font-medium">{entry.fatigue}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">畏光</span><span className="font-medium">{entry.photosensitivity}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">运动敏感</span><span className="font-medium">{entry.motionSickness}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">心慌</span><span className="font-medium">{entry.palpitations}/10</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">心情</span><span className="font-medium">{entry.mood}/10</span></div>
                        </div>

                        {/* Severe Headache */}
                        {entry.severeHeadache === 1 && (
                          <div className="text-xs font-medium text-destructive flex items-center gap-1">
                            ⚠️ 当日发生剧烈头痛
                          </div>
                        )}

                        {/* Triggers */}
                        {entry.triggers && entry.triggers.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">诱因：</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {entry.triggers.map((t: string) => (
                                <Badge key={t} variant="outline" className="text-[10px] py-0 border-terracotta/30 text-terracotta">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Medication Check-in Status */}
                        <MedicationCheckInSummary date={entry.date} />

                        {/* Medications (manual) */}
                        {formatMedications(entry.medications) && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">额外用药：</span>
                            <span className="ml-1">{formatMedications(entry.medications)}</span>
                          </div>
                        )}

                        {/* Notes */}
                        {entry.notes && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">备注：</span>
                            <span className="ml-1">{entry.notes}</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-full"
                            onClick={() => onSelectDate(entry.date)}
                          >
                            <FileText className="w-3 h-3 mr-1" /> 编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-full text-destructive hover:text-destructive"
                            onClick={() => {
                              onDelete(entry.id);
                              setExpandedId(null);
                              toast.success("记录已删除");
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> 删除
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
        )}
      </div>
      )}
    </div>
  );
}
