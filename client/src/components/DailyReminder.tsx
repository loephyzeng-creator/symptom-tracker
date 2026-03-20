import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, PenLine, Sparkles } from "lucide-react";

interface DailyReminderProps {
  /** Whether today's entry has been recorded */
  hasRecordedToday: boolean;
  /** Total number of entries */
  totalEntries: number;
  /** Callback to switch to record tab */
  onGoToRecord: () => void;
}

const ENCOURAGEMENTS = [
  "坚持记录是了解身体的第一步",
  "每一次记录都让你更了解自己",
  "今天的记录，明天的参考",
  "记录不需要完美，真实就好",
  "身体的变化值得被记住",
  "小小的记录，大大的帮助",
];

const STREAK_MESSAGES: Record<string, string> = {
  "0": "开始你的记录之旅吧",
  "1": "很好的开始！",
  "3": "已连续记录 3 天，继续保持！",
  "7": "一周坚持，了不起！",
  "14": "两周记录达人！",
  "30": "一个月的坚持，为你骄傲！",
};

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  if (hour < 22) return "晚上好";
  return "夜深了";
}

const DISMISS_KEY = "daily-reminder-dismissed";

export default function DailyReminder({
  hasRecordedToday,
  totalEntries,
  onGoToRecord,
}: DailyReminderProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check if already dismissed today
  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) {
      const today = new Date().toISOString().slice(0, 10);
      if (stored === today) {
        setDismissed(true);
      }
    }
  }, []);

  const encouragement = useMemo(() => {
    const idx = Math.floor(Math.random() * ENCOURAGEMENTS.length);
    return ENCOURAGEMENTS[idx];
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DISMISS_KEY, today);
  };

  // Don't show if already recorded today or dismissed
  if (hasRecordedToday || dismissed) return null;

  const greeting = getTimeGreeting();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mb-5"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-terracotta/10 via-terracotta/5 to-sage/10 border border-terracotta/15 p-4">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-terracotta/5 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-terracotta/15 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-terracotta" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {greeting}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    今天还没有记录哦
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Encouragement */}
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3 h-3 text-terracotta/60" />
              <p className="text-xs text-muted-foreground italic">
                {encouragement}
              </p>
            </div>

            {/* Action button */}
            <button
              onClick={onGoToRecord}
              className="w-full flex items-center justify-center gap-2 bg-terracotta/90 hover:bg-terracotta text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              <PenLine className="w-4 h-4" />
              开始今日记录
            </button>

            {/* Stats hint */}
            {totalEntries > 0 && (
              <p className="text-center text-[10px] text-muted-foreground/60 mt-2">
                已累计记录 {totalEntries} 天
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
