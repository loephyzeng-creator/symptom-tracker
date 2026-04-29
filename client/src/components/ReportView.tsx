import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { zhCN } from "date-fns/locale";
import {
  FileText, CalendarDays, Download, Loader2, AlertCircle, Printer, ArrowLeft, Sparkles, RefreshCw, Copy, Check,
  GitCompareArrows,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function strToDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function formatDateCN(dateStr: string): string {
  const d = strToDate(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

type DateRange = { from: Date; to: Date };

type QuickRange = 
  | { label: string; type: "days"; days: number }
  | { label: string; type: "preset"; getRange: (today: Date) => { from: Date; to: Date } };

function getThisWeekRange(today: Date): { from: Date; to: Date } {
  const day = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return { from: monday, to: today };
}

function getThisMonthRange(today: Date): { from: Date; to: Date } {
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from, to: today };
}

function getLastMonthRange(today: Date): { from: Date; to: Date } {
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0); // last day of prev month
  return { from, to };
}

const QUICK_RANGES: QuickRange[] = [
  { label: "本周", type: "preset", getRange: getThisWeekRange },
  { label: "本月", type: "preset", getRange: getThisMonthRange },
  { label: "上月", type: "preset", getRange: getLastMonthRange },
  { label: "最近7天", type: "days", days: 7 },
  { label: "最近14天", type: "days", days: 14 },
  { label: "最近30天", type: "days", days: 30 },
  { label: "最近90天", type: "days", days: 90 },
];

/* ─── Date Range Picker Sub-component ─── */
interface DateRangePickerProps {
  label: string;
  range: DateRange;
  setRange: (r: DateRange) => void;
  activePresetLabel: string | null;
  setActivePresetLabel: (l: string | null) => void;
  today: Date;
  onRangeChange?: () => void;
  accentClass?: string;
}

function DateRangePicker({
  label,
  range,
  setRange,
  activePresetLabel,
  setActivePresetLabel,
  today,
  onRangeChange,
  accentClass = "bg-terracotta text-white border-terracotta",
}: DateRangePickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);

  const startStr = dateToStr(range.from);
  const endStr = dateToStr(range.to);
  const daysDiff = useMemo(() => {
    return Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [range]);

  const handleQuickRange = (qr: QuickRange) => {
    if (qr.type === "days") {
      const from = new Date(today);
      from.setDate(from.getDate() - (qr.days - 1));
      setRange({ from, to: today });
    } else {
      const r = qr.getRange(today);
      setRange(r);
    }
    setActivePresetLabel(qr.label);
    onRangeChange?.();
  };

  const handleCalendarSelect = (
    selected: { from?: Date; to?: Date } | undefined,
    triggerDate: Date
  ) => {
    if (!selected) return;

    if (selectingStart) {
      setRange({ from: triggerDate, to: triggerDate });
      setSelectingStart(false);
      setActivePresetLabel(null);
      onRangeChange?.();
    } else {
      const from = range.from;
      let newFrom = from;
      let newTo = triggerDate;
      if (triggerDate < from) {
        newFrom = triggerDate;
        newTo = from;
      }
      setRange({ from: newFrom, to: newTo });
      setSelectingStart(true);
      onRangeChange?.();
      setCalendarOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="text-xs font-medium text-muted-foreground px-1">{label}</div>

      {/* Quick Range Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_RANGES.map((qr) => (
          <button
            key={qr.label}
            onClick={() => handleQuickRange(qr)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
              activePresetLabel === qr.label
                ? accentClass
                : "bg-card text-muted-foreground border-border/50 hover:border-terracotta/40"
            }`}
          >
            {qr.label}
          </button>
        ))}
      </div>

      {/* Date Range Display + Calendar */}
      <div className="bg-card rounded-xl p-3 shadow-sm border border-border/50">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{formatDateCN(startStr)} — {formatDateCN(endStr)}</span>
            <span className="text-xs text-muted-foreground ml-1.5">({daysDiff}天)</span>
          </div>
          <Popover open={calendarOpen} onOpenChange={(open) => {
            setCalendarOpen(open);
            if (open) setSelectingStart(true);
          }}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors">
                <CalendarDays className="w-3.5 h-3.5" />
                自定义
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
              <Calendar
                mode="range"
                selected={selectingStart ? undefined : { from: range.from, to: range.to }}
                onSelect={handleCalendarSelect as any}
                locale={zhCN}
                disabled={{ after: today }}
                numberOfMonths={1}
                defaultMonth={range.from}
                className="rounded-xl"
                classNames={{
                  today: "bg-terracotta/15 text-terracotta font-bold rounded-md",
                  range_start: "bg-terracotta text-white rounded-l-md",
                  range_end: "bg-terracotta text-white rounded-r-md",
                  range_middle: "bg-terracotta/10",
                  month_caption: "flex items-center justify-center h-10 w-full px-8 font-serif font-semibold",
                }}
              />
              <div className="px-3 py-2 text-xs text-center text-muted-foreground border-t border-border/50">
                {selectingStart
                  ? "请选择开始日期"
                  : `开始：${formatDateCN(dateToStr(range.from))}，请选择结束日期`}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/* ─── Report Preview Sub-component ─── */
interface ReportPreviewProps {
  label?: string;
  reportHtml: string;
  entryCount: number;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  startStr: string;
  endStr: string;
}

function ReportPreview({ label, reportHtml, entryCount, iframeRef, startStr, endStr }: ReportPreviewProps) {
  const handlePrint = () => {
    if (!reportHtml || !iframeRef.current) return;
    try {
      const iframeWindow = iframeRef.current.contentWindow;
      if (iframeWindow) {
        iframeWindow.print();
      }
    } catch {
      const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `就诊报告_${startStr}_${endStr}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.info("已下载报告文件，请在浏览器中打开后打印");
    }
  };

  if (entryCount === 0) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">该时间段内没有症状记录</p>
        <p className="text-xs text-muted-foreground mt-1">请先在记录页面添加数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={handlePrint} variant="outline" className="flex-1 rounded-xl h-9 text-xs">
          <Printer className="w-3.5 h-3.5 mr-1.5" />
          打印 / 保存PDF
        </Button>
        <Button onClick={handlePrint} className="flex-1 rounded-xl h-9 text-xs bg-sage hover:bg-sage/90 text-white">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          导出报告
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        点击上方按钮后，在打印对话框中选择「另存为 PDF」即可保存
      </p>

      {/* Preview iframe */}
      <div className="bg-card rounded-xl shadow-sm border border-border/50 overflow-hidden">
        <div className="bg-muted/50 px-3 py-1.5 border-b border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {label ? `${label} · ` : ""}报告预览（共 {entryCount} 条记录）
          </span>
        </div>
        <iframe
          ref={iframeRef}
          srcDoc={reportHtml}
          className="w-full border-0"
          style={{ height: "500px" }}
          title={`${label || ""}就诊报告预览`}
        />
      </div>
    </div>
  );
}

/* ─── Main ReportView Component ─── */
export default function ReportView() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 13);

  // ── Compare mode toggle ──
  const [compareMode, setCompareMode] = useState(false);

  // ── Period A state ──
  const [rangeA, setRangeA] = useState<DateRange>({ from: defaultFrom, to: today });
  const [presetA, setPresetA] = useState<string | null>(null);
  const [reportHtmlA, setReportHtmlA] = useState<string | null>(null);
  const [entryCountA, setEntryCountA] = useState(0);
  const iframeRefA = useRef<HTMLIFrameElement>(null);

  // ── Period B state (for comparison) ──
  const lastMonthRange = getLastMonthRange(today);
  const [rangeB, setRangeB] = useState<DateRange>(lastMonthRange);
  const [presetB, setPresetB] = useState<string | null>("上月");
  const [reportHtmlB, setReportHtmlB] = useState<string | null>(null);
  const [entryCountB, setEntryCountB] = useState(0);
  const iframeRefB = useRef<HTMLIFrameElement>(null);

  // ── AI Analysis ──
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const aiMutation = trpc.ai.analyze.useMutation({
    onSuccess: (data) => {
      setAiAnalysis(data.analysis);
      setAiError(null);
    },
    onError: (err) => {
      setAiError(err.message || "分析失败，请稍后重试");
      setAiAnalysis(null);
    },
  });

  const handleAiAnalyze = () => {
    setAiError(null);
    aiMutation.mutate();
  };

  const handleCopyAnalysis = async () => {
    if (!aiAnalysis) return;
    try {
      await navigator.clipboard.writeText(aiAnalysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = aiAnalysis;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Generate mutations ──
  const generateMutationA = trpc.report.generate.useMutation({
    onSuccess: (data) => {
      setReportHtmlA(data.html);
      setEntryCountA(data.entryCount);
      if (data.entryCount === 0) toast.info("A期间内没有记录");
    },
    onError: () => toast.error("生成A期间报告失败，请重试"),
  });

  const generateMutationB = trpc.report.generate.useMutation({
    onSuccess: (data) => {
      setReportHtmlB(data.html);
      setEntryCountB(data.entryCount);
      if (data.entryCount === 0) toast.info("B期间内没有记录");
    },
    onError: () => toast.error("生成B期间报告失败，请重试"),
  });

  const startStrA = dateToStr(rangeA.from);
  const endStrA = dateToStr(rangeA.to);
  const startStrB = dateToStr(rangeB.from);
  const endStrB = dateToStr(rangeB.to);

  const handleGenerate = useCallback(() => {
    setReportHtmlA(null);
    setReportHtmlB(null);
    setAiAnalysis(null);
    setAiError(null);
    generateMutationA.mutate({ startDate: startStrA, endDate: endStrA });
    if (compareMode) {
      generateMutationB.mutate({ startDate: startStrB, endDate: endStrB });
    }
  }, [startStrA, endStrA, startStrB, endStrB, compareMode]);

  const isPending = generateMutationA.isPending || (compareMode && generateMutationB.isPending);
  const hasReport = compareMode ? (reportHtmlA !== null && reportHtmlB !== null) : reportHtmlA !== null;

  // ── Print single-mode report ──
  const handlePrintSingle = () => {
    if (!reportHtmlA || !iframeRefA.current) return;
    try {
      const iframeWindow = iframeRefA.current.contentWindow;
      if (iframeWindow) iframeWindow.print();
    } catch {
      const blob = new Blob([reportHtmlA], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `就诊报告_${startStrA}_${endStrA}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.info("已下载报告文件，请在浏览器中打开后打印");
    }
  };

  // ── Toggle compare mode ──
  const toggleCompareMode = () => {
    setCompareMode((prev) => !prev);
    setReportHtmlA(null);
    setReportHtmlB(null);
    setAiAnalysis(null);
    setAiError(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-3"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-xl border border-border/50 shadow-sm">
          <FileText className="w-5 h-5 text-terracotta" />
          <span className="font-serif font-semibold">就诊报告</span>
        </div>
      </motion.div>

      {/* Compare Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="flex justify-center"
      >
        <button
          onClick={toggleCompareMode}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
            compareMode
              ? "bg-violet-600 text-white border-violet-600 shadow-sm"
              : "bg-card text-muted-foreground border-border/50 hover:border-violet-400/50 hover:text-violet-600"
          }`}
        >
          <GitCompareArrows className="w-3.5 h-3.5" />
          {compareMode ? "退出对比模式" : "对比模式"}
        </button>
      </motion.div>

      {/* Date Range Pickers */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-3"
      >
        {compareMode ? (
          /* ── Compare Mode: Two pickers ── */
          <div className="space-y-3">
            <div className="bg-card rounded-xl p-3 shadow-sm border border-violet-200/50">
              <DateRangePicker
                label="A 期间"
                range={rangeA}
                setRange={setRangeA}
                activePresetLabel={presetA}
                setActivePresetLabel={setPresetA}
                today={today}
                onRangeChange={() => { setReportHtmlA(null); setReportHtmlB(null); }}
                accentClass="bg-terracotta text-white border-terracotta"
              />
            </div>
            <div className="flex justify-center">
              <div className="text-xs text-muted-foreground font-medium px-3 py-0.5 bg-muted/50 rounded-full">
                VS
              </div>
            </div>
            <div className="bg-card rounded-xl p-3 shadow-sm border border-violet-200/50">
              <DateRangePicker
                label="B 期间"
                range={rangeB}
                setRange={setRangeB}
                activePresetLabel={presetB}
                setActivePresetLabel={setPresetB}
                today={today}
                onRangeChange={() => { setReportHtmlA(null); setReportHtmlB(null); }}
                accentClass="bg-violet-600 text-white border-violet-600"
              />
            </div>
          </div>
        ) : (
          /* ── Normal Mode: Single picker ── */
          <>
            {/* Quick Range Buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_RANGES.map((qr) => (
                <button
                  key={qr.label}
                  onClick={() => {
                    if (qr.type === "days") {
                      const from = new Date(today);
                      from.setDate(from.getDate() - (qr.days - 1));
                      setRangeA({ from, to: today });
                    } else {
                      const r = qr.getRange(today);
                      setRangeA(r);
                    }
                    setPresetA(qr.label);
                    setReportHtmlA(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    presetA === qr.label
                      ? "bg-terracotta text-white border-terracotta"
                      : "bg-card text-muted-foreground border-border/50 hover:border-terracotta/40"
                  }`}
                >
                  {qr.label}
                </button>
              ))}
            </div>

            {/* Date Range Picker */}
            <div className="bg-card rounded-xl p-4 shadow-sm border border-border/50">
              <DateRangePickerInline
                range={rangeA}
                setRange={setRangeA}
                setActivePresetLabel={setPresetA}
                today={today}
                onRangeChange={() => setReportHtmlA(null)}
              />
            </div>
          </>
        )}
      </motion.div>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Button
          onClick={handleGenerate}
          disabled={isPending}
          className={`w-full h-12 text-base font-medium rounded-xl text-white ${
            compareMode
              ? "bg-gradient-to-r from-terracotta to-violet-600 hover:from-terracotta/90 hover:to-violet-600/90"
              : "bg-terracotta hover:bg-terracotta/90"
          }`}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              {compareMode ? "生成对比报告" : "生成就诊报告"}
            </>
          )}
        </Button>
      </motion.div>

      {/* Report Preview & Actions */}
      <AnimatePresence mode="wait">
        {hasReport && (
          <motion.div
            key={compareMode ? "compare" : "single"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Back button */}
            <button
              onClick={() => { setReportHtmlA(null); setReportHtmlB(null); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回重新配置
            </button>

            {compareMode ? (
              /* ── Compare Mode: Two reports ── */
              <div className="space-y-4">
                {/* Period A Report */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-terracotta" />
                    <span className="text-sm font-medium">A 期间：{formatDateCN(startStrA)} — {formatDateCN(endStrA)}</span>
                  </div>
                  {reportHtmlA && (
                    <ReportPreview
                      label="A期间"
                      reportHtml={reportHtmlA}
                      entryCount={entryCountA}
                      iframeRef={iframeRefA}
                      startStr={startStrA}
                      endStr={endStrA}
                    />
                  )}
                </div>

                {/* Period B Report */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-violet-600" />
                    <span className="text-sm font-medium">B 期间：{formatDateCN(startStrB)} — {formatDateCN(endStrB)}</span>
                  </div>
                  {reportHtmlB && (
                    <ReportPreview
                      label="B期间"
                      reportHtml={reportHtmlB}
                      entryCount={entryCountB}
                      iframeRef={iframeRefB}
                      startStr={startStrB}
                      endStr={endStrB}
                    />
                  )}
                </div>

                {/* Comparison Summary */}
                {entryCountA > 0 && entryCountB > 0 && (
                  <div className="bg-card rounded-xl p-4 shadow-sm border border-violet-200/50">
                    <div className="flex items-center gap-2 mb-2">
                      <GitCompareArrows className="w-4 h-4 text-violet-600" />
                      <span className="text-sm font-serif font-semibold">对比摘要</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-muted/30 rounded-lg p-2.5">
                        <div className="text-[10px] text-muted-foreground mb-0.5">A 期间记录</div>
                        <div className="text-lg font-semibold text-terracotta">{entryCountA}</div>
                        <div className="text-[10px] text-muted-foreground">{formatDateCN(startStrA)}–{formatDateCN(endStrA)}</div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5">
                        <div className="text-[10px] text-muted-foreground mb-0.5">B 期间记录</div>
                        <div className="text-lg font-semibold text-violet-600">{entryCountB}</div>
                        <div className="text-[10px] text-muted-foreground">{formatDateCN(startStrB)}–{formatDateCN(endStrB)}</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      上下滚动两份报告，对比各项症状评分和诱因变化
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* ── Normal Mode: Single report ── */
              <>
                {reportHtmlA && entryCountA === 0 ? (
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 text-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">该时间段内没有症状记录</p>
                    <p className="text-xs text-muted-foreground mt-1">请先在记录页面添加数据</p>
                  </div>
                ) : reportHtmlA ? (
                  <>
                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button onClick={handlePrintSingle} variant="outline" className="flex-1 rounded-xl h-10">
                        <Printer className="w-4 h-4 mr-2" />
                        打印 / 保存PDF
                      </Button>
                      <Button onClick={handlePrintSingle} className="flex-1 rounded-xl h-10 bg-sage hover:bg-sage/90 text-white">
                        <Download className="w-4 h-4 mr-2" />
                        导出报告
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      点击上方按钮后，在打印对话框中选择「另存为 PDF」即可保存
                    </p>

                    {/* AI Analysis Section */}
                    <div className="bg-card rounded-xl p-4 shadow-sm border border-border/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <h4 className="font-serif font-semibold text-sm">智能分析</h4>
                          <p className="text-[10px] text-muted-foreground">基于您的记录数据，AI 生成症状趋势解读和就诊建议</p>
                        </div>
                      </div>

                      {!aiAnalysis && !aiMutation.isPending && !aiError && (
                        <Button
                          onClick={handleAiAnalyze}
                          className="w-full h-10 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-sm font-medium"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          一键生成智能分析
                        </Button>
                      )}

                      {aiMutation.isPending && (
                        <div className="flex flex-col items-center gap-3 py-6">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-violet-600 animate-pulse" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-ping" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">AI 正在分析您的数据...</p>
                            <p className="text-xs text-muted-foreground mt-1">识别症状模式、分析诱因关联、评估用药效果</p>
                          </div>
                        </div>
                      )}

                      {aiError && !aiMutation.isPending && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{aiError}</span>
                          </div>
                          <Button onClick={handleAiAnalyze} variant="outline" className="w-full rounded-xl">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            重试
                          </Button>
                        </div>
                      )}

                      {aiAnalysis && !aiMutation.isPending && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Button onClick={handleAiAnalyze} variant="outline" size="sm" className="rounded-lg text-xs">
                              <RefreshCw className="w-3 h-3 mr-1" />
                              重新分析
                            </Button>
                            <Button onClick={handleCopyAnalysis} variant="outline" size="sm" className="rounded-lg text-xs">
                              {copied ? (
                                <><Check className="w-3 h-3 mr-1" />已复制</>
                              ) : (
                                <><Copy className="w-3 h-3 mr-1" />复制分析</>
                              )}
                            </Button>
                          </div>
                          <div className="bg-muted/50 rounded-xl p-4 text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                            <Streamdown>{aiAnalysis}</Streamdown>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Preview iframe */}
                    <div className="bg-card rounded-xl shadow-sm border border-border/50 overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 border-b border-border/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">报告预览（共 {entryCountA} 条记录）</span>
                      </div>
                      <iframe
                        ref={iframeRefA}
                        srcDoc={reportHtmlA}
                        className="w-full border-0"
                        style={{ height: "500px" }}
                        title="就诊报告预览"
                      />
                    </div>
                  </>
                ) : null}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips */}
      {!hasReport && !isPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-6"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            {compareMode ? (
              <>
                选择两个时间段后点击「生成对比报告」<br />
                两份报告将上下排列，方便对比症状变化<br />
                适合复诊时展示治疗前后的改善情况
              </>
            ) : (
              <>
                选择时间范围后点击「生成就诊报告」<br />
                报告包含症状评分汇总、诱因统计、用药记录等<br />
                可直接打印或保存为 PDF 带给医生
              </>
            )}
          </p>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Inline Date Range Picker (for normal mode) ─── */
interface DateRangePickerInlineProps {
  range: DateRange;
  setRange: (r: DateRange) => void;
  setActivePresetLabel: (l: string | null) => void;
  today: Date;
  onRangeChange?: () => void;
}

function DateRangePickerInline({ range, setRange, setActivePresetLabel, today, onRangeChange }: DateRangePickerInlineProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);

  const startStr = dateToStr(range.from);
  const endStr = dateToStr(range.to);
  const daysDiff = useMemo(() => {
    return Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [range]);

  const handleCalendarSelect = (
    selected: { from?: Date; to?: Date } | undefined,
    triggerDate: Date
  ) => {
    if (!selected) return;

    if (selectingStart) {
      setRange({ from: triggerDate, to: triggerDate });
      setSelectingStart(false);
      setActivePresetLabel(null);
      onRangeChange?.();
    } else {
      const from = range.from;
      let newFrom = from;
      let newTo = triggerDate;
      if (triggerDate < from) {
        newFrom = triggerDate;
        newTo = from;
      }
      setRange({ from: newFrom, to: newTo });
      setSelectingStart(true);
      onRangeChange?.();
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm">
        <span className="text-muted-foreground">报告周期：</span>
        <span className="font-medium">{formatDateCN(startStr)} — {formatDateCN(endStr)}</span>
        <span className="text-xs text-muted-foreground ml-2">({daysDiff}天)</span>
      </div>
      <Popover open={calendarOpen} onOpenChange={(open) => {
        setCalendarOpen(open);
        if (open) setSelectingStart(true);
      }}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors">
            <CalendarDays className="w-4 h-4" />
            自定义
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
          <Calendar
            mode="range"
            selected={selectingStart ? undefined : { from: range.from, to: range.to }}
            onSelect={handleCalendarSelect as any}
            locale={zhCN}
            disabled={{ after: today }}
            numberOfMonths={1}
            defaultMonth={range.from}
            className="rounded-xl"
            classNames={{
              today: "bg-terracotta/15 text-terracotta font-bold rounded-md",
              range_start: "bg-terracotta text-white rounded-l-md",
              range_end: "bg-terracotta text-white rounded-r-md",
              range_middle: "bg-terracotta/10",
              month_caption: "flex items-center justify-center h-10 w-full px-8 font-serif font-semibold",
            }}
          />
          <div className="px-3 py-2 text-xs text-center text-muted-foreground border-t border-border/50">
            {selectingStart
              ? "请选择开始日期"
              : `开始：${formatDateCN(dateToStr(range.from))}，请选择结束日期`}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Export helpers for testing
export { getThisWeekRange, getThisMonthRange, getLastMonthRange, dateToStr, formatDateCN };
