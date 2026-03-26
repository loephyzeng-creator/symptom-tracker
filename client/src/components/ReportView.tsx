import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";
import { zhCN } from "date-fns/locale";
import {
  FileText, CalendarDays, Download, Loader2, AlertCircle, Printer, ArrowLeft, Sparkles, RefreshCw, Copy, Check,
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

const QUICK_RANGES = [
  { label: "最近7天", days: 7 },
  { label: "最近14天", days: 14 },
  { label: "最近30天", days: 30 },
  { label: "最近90天", days: 90 },
];

export default function ReportView() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 13);

  const [range, setRange] = useState<DateRange>({ from: defaultFrom, to: today });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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

  const generateMutation = trpc.report.generate.useMutation({
    onSuccess: (data) => {
      setReportHtml(data.html);
      setEntryCount(data.entryCount);
      if (data.entryCount === 0) {
        toast.info("该时间段内没有记录");
      }
    },
    onError: () => {
      toast.error("生成报告失败，请重试");
    },
  });

  const startStr = dateToStr(range.from);
  const endStr = dateToStr(range.to);

  const handleGenerate = () => {
    setReportHtml(null);
    generateMutation.mutate({ startDate: startStr, endDate: endStr });
  };

  const handleQuickRange = (days: number) => {
    const from = new Date(today);
    from.setDate(from.getDate() - (days - 1));
    setRange({ from, to: today });
    setReportHtml(null);
  };

  const handlePrint = () => {
    if (!reportHtml || !iframeRef.current) return;
    try {
      const iframeWindow = iframeRef.current.contentWindow;
      if (iframeWindow) {
        iframeWindow.print();
      }
    } catch {
      // Fallback: download as HTML file if iframe print fails
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

  const handleCalendarSelect = (selected: { from?: Date; to?: Date } | undefined) => {
    if (selected?.from) {
      setRange({
        from: selected.from,
        to: selected.to ?? selected.from,
      });
      setReportHtml(null);
      if (selected.to) {
        setCalendarOpen(false);
      }
    }
  };

  const daysDiff = useMemo(() => {
    return Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [range]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-xl border border-border/50 shadow-sm">
          <FileText className="w-5 h-5 text-terracotta" />
          <span className="font-serif font-semibold">就诊报告</span>
        </div>
      </motion.div>

      {/* Quick Range Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-2 justify-center"
      >
        {QUICK_RANGES.map((qr) => (
          <button
            key={qr.days}
            onClick={() => handleQuickRange(qr.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              daysDiff === qr.days
                ? "bg-terracotta text-white border-terracotta"
                : "bg-card text-muted-foreground border-border/50 hover:border-terracotta/40"
            }`}
          >
            {qr.label}
          </button>
        ))}
      </motion.div>

      {/* Date Range Picker */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">报告周期：</span>
            <span className="font-medium">{formatDateCN(startStr)} — {formatDateCN(endStr)}</span>
            <span className="text-xs text-muted-foreground ml-2">({daysDiff}天)</span>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors">
                <CalendarDays className="w-4 h-4" />
                自定义
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
              <Calendar
                mode="range"
                selected={{ from: range.from, to: range.to }}
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
            </PopoverContent>
          </Popover>
        </div>
      </motion.div>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="w-full h-12 text-base font-medium rounded-xl bg-terracotta hover:bg-terracotta/90 text-white"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              生成就诊报告
            </>
          )}
        </Button>
      </motion.div>

      {/* Report Preview & Actions */}
      {reportHtml && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Back button */}
          <button
            onClick={() => setReportHtml(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回重新配置
          </button>

          {entryCount === 0 ? (
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">该时间段内没有症状记录</p>
              <p className="text-xs text-muted-foreground mt-1">请先在记录页面添加数据</p>
            </div>
          ) : (
            <>
              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  className="flex-1 rounded-xl h-10"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  打印 / 保存PDF
                </Button>
                <Button
                  onClick={handlePrint}
                  className="flex-1 rounded-xl h-10 bg-sage hover:bg-sage/90 text-white"
                >
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
                    <Button
                      onClick={handleAiAnalyze}
                      variant="outline"
                      className="w-full rounded-xl"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重试
                    </Button>
                  </div>
                )}

                {aiAnalysis && !aiMutation.isPending && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAiAnalyze}
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        重新分析
                      </Button>
                      <Button
                        onClick={handleCopyAnalysis}
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs"
                      >
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
                  <span className="text-xs text-muted-foreground">报告预览（共 {entryCount} 条记录）</span>
                </div>
                <iframe
                  ref={iframeRef}
                  srcDoc={reportHtml}
                  className="w-full border-0"
                  style={{ height: "500px" }}
                  title="就诊报告预览"
                />
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Tips */}
      {!reportHtml && !generateMutation.isPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-6"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            选择时间范围后点击「生成就诊报告」<br />
            报告包含症状评分汇总、诱因统计、用药记录等<br />
            可直接打印或保存为 PDF 带给医生
          </p>
        </motion.div>
      )}
    </div>
  );
}
