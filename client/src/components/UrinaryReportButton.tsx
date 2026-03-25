/**
 * UrinaryReportButton — Generates a printable urinary symptom-medication correlation report.
 * Placed in the MedicationView alongside other analysis tools.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Droplets,
  Calendar,
  ChevronDown,
  ChevronUp,
  Printer,
} from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "近 7 天", days: 7 },
  { label: "近 14 天", days: 14 },
  { label: "近 30 天", days: 30 },
  { label: "近 60 天", days: 60 },
  { label: "近 90 天", days: 90 },
];

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

export default function UrinaryReportButton() {
  const [expanded, setExpanded] = useState(false);
  const [selectedDays, setSelectedDays] = useState(30);
  const [generating, setGenerating] = useState(false);

  const generateReport = trpc.report.generateUrinary.useMutation();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { startDate, endDate } = getDateRange(selectedDays);
      const result = await generateReport.mutateAsync({ startDate, endDate });

      if (result.entryCount === 0) {
        toast.error("所选时间段内没有记录数据", {
          description: "请先记录一些症状数据后再生成报告",
        });
        return;
      }

      // Open the HTML report in a new tab for printing
      const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        toast.error("无法打开报告窗口", {
          description: "请检查浏览器是否阻止了弹出窗口",
        });
      } else {
        toast.success("泌尿症状报告已生成", {
          description: `包含近 ${selectedDays} 天的 ${result.entryCount} 条记录`,
        });
      }
    } catch (err: any) {
      toast.error("生成报告失败", {
        description: err.message || "请稍后重试",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              泌尿症状-用药关联报告
            </h3>
            <p className="text-xs text-muted-foreground">
              生成可打印报告，复诊时给医生参考
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Period selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              <Calendar className="w-3 h-3 inline mr-1" />
              选择报告时间范围
            </label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setSelectedDays(opt.days)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedDays === opt.days
                      ? "bg-blue-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Report description */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
            <p>报告包含以下内容：</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>泌尿症状频率分布（排尿困难、尿等待、夜尿增多等）</li>
              <li>当前用药泌尿系统风险评估（含药理机制）</li>
              <li>泌尿症状日 vs 无症状日用药对比分析</li>
              <li>每周趋势变化</li>
              <li>泌尿症状出现日明细</li>
              <li>复诊建议要点</li>
            </ul>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在生成报告...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                生成泌尿症状报告
              </>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            报告将在新窗口打开，可直接打印或保存为 PDF
          </p>
        </div>
      )}
    </div>
  );
}
