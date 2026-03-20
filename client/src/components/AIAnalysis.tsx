/**
 * AI Analysis Component
 * Triggers LLM-powered deep analysis of symptom data and renders the result.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RefreshCw, Copy, Check, AlertCircle } from "lucide-react";
import { Streamdown } from "streamdown";

interface AIAnalysisProps {
  entryCount: number;
}

export default function AIAnalysis({ entryCount }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const analyzeMutation = trpc.ai.analyze.useMutation({
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "分析失败，请稍后重试。");
      setAnalysis(null);
    },
  });

  const handleAnalyze = () => {
    setError(null);
    analyzeMutation.mutate();
  };

  const handleCopy = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = analysis;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLoading = analyzeMutation.isPending;
  const hasEnoughData = entryCount >= 3;

  return (
    <div className="space-y-4">
      {/* Header & Trigger */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-5 shadow-sm border border-border/50"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-base text-foreground">
              AI 智能分析
            </h3>
            <p className="text-xs text-muted-foreground">
              基于 {entryCount} 天的记录数据进行深度分析
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          AI 将分析您的症状模式、诱因关联、用药效果和时间规律，
          并提供个性化的健康管理建议。分析过程可能需要 10-20 秒。
        </p>

        {!hasEnoughData ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>需要至少 3 天的记录数据才能进行有效分析。当前仅有 {entryCount} 天数据。</span>
          </div>
        ) : (
          <Button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-sm font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                AI 正在分析中...
              </>
            ) : analysis ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                重新分析
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                开始 AI 分析
              </>
            )}
          </Button>
        )}
      </motion.div>

      {/* Loading Animation */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card rounded-xl p-6 shadow-sm border border-border/50"
          >
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-violet-600 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">
                  AI 正在深度分析您的数据...
                </p>
                <p className="text-xs text-muted-foreground">
                  正在识别症状模式、分析诱因关联、评估用药效果
                </p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-violet-500"
                    style={{
                      animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                      opacity: 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 rounded-xl p-4 border border-destructive/20"
        >
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            onClick={handleAnalyze}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            重试
          </Button>
        </motion.div>
      )}

      {/* Analysis Result */}
      <AnimatePresence>
        {analysis && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card rounded-xl shadow-sm border border-border/50 overflow-hidden"
          >
            {/* Result Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-medium text-foreground">
                  分析报告
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-sage" />
                    <span className="text-sage">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>

            {/* Markdown Content */}
            <div className="px-5 py-4 prose prose-sm max-w-none dark:prose-invert prose-headings:font-serif prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-violet-600">
              <Streamdown>{analysis}</Streamdown>
            </div>

            {/* Disclaimer */}
            <div className="px-5 py-3 bg-muted/30 border-t border-border/30">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5" />
                AI 分析仅供参考，不能替代专业医疗建议。如有健康疑虑，请咨询医生。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
