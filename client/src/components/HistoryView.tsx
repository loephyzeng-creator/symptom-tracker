/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * History list with card-based entries
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { formatMedications } from "@/hooks/useSymptomData";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2, Download, Upload, ChevronDown, ChevronUp, FileText, FileSpreadsheet, CalendarDays, List, Pill,
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

export default function HistoryView({ entries, onDelete, onExport, onExportCSV, onImport, onSelectDate }: HistoryViewProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "medication">("list");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const reversedEntries = [...entries].reverse();

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
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">共 {entries.length} 条记录</span>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="列表视图"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="日历视图"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("medication")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "medication" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="用药时间线"
            >
              <Pill className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportClick} className="rounded-full text-xs">
            <Upload className="w-3 h-3 mr-1" /> 导入
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} className="rounded-full text-xs">
            <Download className="w-3 h-3 mr-1" /> JSON
          </Button>
          {onExportCSV && (
            <Button variant="outline" size="sm" onClick={onExportCSV} className="rounded-full text-xs">
              <FileSpreadsheet className="w-3 h-3 mr-1" /> CSV
            </Button>
          )}
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

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
        <AnimatePresence>
          {reversedEntries.map((entry) => {
            const overall = getOverallScore(entry);
            const isExpanded = expandedId === entry.id;
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
      </div>
      )}
    </div>
  );
}
