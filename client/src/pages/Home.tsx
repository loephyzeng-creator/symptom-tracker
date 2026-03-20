/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Main page with tab navigation: Record / Stats / History
 * Colors: warm cream bg, terracotta accents, sage green, dusty blue
 * Typography: Noto Serif SC (headings), Noto Sans SC (body)
 */
import { useState, useMemo } from "react";
import { useSymptomData } from "@/hooks/useSymptomData";
import { useCustomTriggers } from "@/hooks/useCustomTriggers";
import SymptomForm from "@/components/SymptomForm";
import StatsView from "@/components/StatsView";
import HistoryView from "@/components/HistoryView";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, BarChart3, Clock, BookOpen } from "lucide-react";

type TabKey = "record" | "stats" | "history";

const TABS: { key: TabKey; label: string; icon: typeof PenLine }[] = [
  { key: "record", label: "记录", icon: PenLine },
  { key: "stats", label: "统计", icon: BarChart3 },
  { key: "history", label: "历史", icon: Clock },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("record");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const {
    entries,
    addEntry,
    deleteEntry,
    getEntryByDate,
    exportData,
    importData,
  } = useSymptomData();

  const {
    allTriggers,
    customTriggers,
    addTrigger,
    removeTrigger,
  } = useCustomTriggers();

  const existingEntry = useMemo(
    () => getEntryByDate(selectedDate),
    [getEntryByDate, selectedDate]
  );

  const handleSelectDateFromHistory = (date: string) => {
    setSelectedDate(date);
    setActiveTab("record");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/30">
        <div className="container max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663299884726/7CnBeGxyBasxbKLjVrJzxx/wellness-icon-6VW4Dy8xn7zsxPdzmdLqpc.webp"
                alt="logo"
                className="w-8 h-8 rounded-lg"
              />
              <div>
                <h1 className="font-serif text-base font-bold leading-tight text-foreground">
                  症状日记
                </h1>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  记录每一天，看见每一步改善
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{entries.length} 条</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container max-w-lg mx-auto px-4 py-5 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "record" && (
              <SymptomForm
                date={selectedDate}
                existingEntry={existingEntry}
                onSave={addEntry}
                onDateChange={setSelectedDate}
                allTriggers={allTriggers}
                customTriggers={customTriggers}
                onAddTrigger={addTrigger}
                onRemoveTrigger={removeTrigger}
              />
            )}
            {activeTab === "stats" && <StatsView entries={entries} />}
            {activeTab === "history" && (
              <HistoryView
                entries={entries}
                onDelete={deleteEntry}
                onExport={exportData}
                onImport={importData}
                onSelectDate={handleSelectDateFromHistory}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-t border-border/30">
        <div className="container max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around h-16">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
                    isActive
                      ? "text-terracotta"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-all ${isActive ? "scale-110" : ""}`} />
                    {isActive && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-terracotta"
                      />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${isActive ? "font-semibold" : ""}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Safe area for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
