/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Main page with tab navigation: Record / Stats / History / Report / Settings
 * Colors: warm cream bg, terracotta accents, sage green, dusty blue
 * Typography: Noto Serif SC (headings), Noto Sans SC (body)
 */
import { useState, useMemo, useEffect } from "react";
import { useSymptomData } from "@/hooks/useSymptomData";
import { useCustomTriggers } from "@/hooks/useCustomTriggers";
import SymptomForm from "@/components/SymptomForm";
import QuickRecord from "@/components/QuickRecord";
import TodayWidget from "@/components/TodayWidget";
import StatsView from "@/components/StatsView";
import HistoryView from "@/components/HistoryView";
import DailyReminder from "@/components/DailyReminder";
import AlertSettings from "@/components/AlertSettings";
import MedicationReminders from "@/components/MedicationReminders";
import MedicationGroupManager from "@/components/MedicationGroupManager";
import MedicationStock from "@/components/MedicationStock";
import MedicationView from "@/components/MedicationView";
import BackupRestore from "@/components/BackupRestore";
import SyncStatus from "@/components/SyncStatus";
import CustomMetricsManager from "@/components/CustomMetricsManager";
import PainkillerLimitSetting from "@/components/PainkillerLimitSetting";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Database, Shield, Activity, Palette, Pill, RotateCcw
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { zhCN } from "date-fns/locale";
import { useTheme } from "@/contexts/ThemeContext";

type TabKey = "record" | "medication" | "stats" | "history" | "settings";

const TABS: { key: TabKey; label: string; icon: typeof PenLine }[] = [
  { key: "record", label: "记录", icon: PenLine },
  { key: "medication", label: "用药", icon: Pill },
  { key: "stats", label: "统计", icon: BarChart3 },
  { key: "history", label: "历史", icon: Clock },
  { key: "settings", label: "设置", icon: Settings },
];

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
}

function dateStrToDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

function dateToDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DatePicker({ date, onDateChange, existingEntry }: {
  date: string;
  onDateChange: (date: string) => void;
  existingEntry?: any;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selectedDate = useMemo(() => dateStrToDate(date), [date]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = dateToDateStr(today);
  const isToday = date === todayStr;

  const handleCalendarSelect = (day: Date | undefined) => {
    if (day) {
      onDateChange(dateToDateStr(day));
      setCalendarOpen(false);
    }
  };

  const handlePrevDay = () => {
    const d = dateStrToDate(date);
    d.setDate(d.getDate() - 1);
    onDateChange(dateToDateStr(d));
  };

  const handleNextDay = () => {
    const d = dateStrToDate(date);
    d.setDate(d.getDate() + 1);
    if (d <= today) {
      onDateChange(dateToDateStr(d));
    }
  };

  const handleBackToToday = () => {
    onDateChange(todayStr);
  };

  // Format date parts for display
  const d = new Date(date + "T00:00:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;
  const weekday = `星期${weekdays[d.getDay()]}`;
  const canGoNext = (() => {
    const next = dateStrToDate(date);
    next.setDate(next.getDate() + 1);
    return next <= today;
  })();

  return (
    <div className="flex flex-col items-center gap-2 mb-4">
      {/* Main date row */}
      <div className="flex items-center gap-1">
        {/* Prev day arrow */}
        <button
          onClick={handlePrevDay}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-terracotta hover:bg-terracotta/10 transition-all active:scale-90"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Date display - clickable to open calendar */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="group flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-terracotta/20 transition-all active:scale-[0.98]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-terracotta/15 to-terracotta/5 flex items-center justify-center">
                <CalendarDays className="w-[18px] h-[18px] text-terracotta" />
              </div>
              <div className="text-left">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-[17px] font-semibold text-foreground tracking-tight">
                    {monthDay}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {weekday}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isToday && (
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-sage/15 text-sage font-semibold">今天</span>
                  )}
                  {existingEntry && (
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-terracotta/10 text-terracotta font-semibold">✓ 已记录</span>
                  )}
                  {!isToday && !existingEntry && (
                    <span className="text-[10px] text-muted-foreground/60">点击选择日期</span>
                  )}
                </div>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-2xl shadow-lg border-border/40" align="center" sideOffset={8}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              locale={zhCN}
              disabled={{ after: today }}
              defaultMonth={selectedDate}
              className="rounded-2xl"
              classNames={{
                today: "bg-terracotta/15 text-terracotta font-bold rounded-lg",
                month_caption: "flex items-center justify-center h-10 w-full px-8 font-serif font-semibold",
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Next day arrow */}
        <button
          onClick={handleNextDay}
          disabled={!canGoNext}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            canGoNext
              ? "text-muted-foreground/60 hover:text-terracotta hover:bg-terracotta/10"
              : "text-muted-foreground/20 cursor-not-allowed"
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Back to today pill */}
      {!isToday && (
        <motion.button
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          onClick={handleBackToToday}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-terracotta/8 text-terracotta text-[11px] font-medium hover:bg-terracotta/15 transition-colors active:scale-95"
        >
          <RotateCcw className="w-3 h-3" />
          返回今天
        </motion.button>
      )}
    </div>
  );
}

/* ─── Settings Section Card ─── */
function SettingsSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: typeof Bell;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-xl border border-border/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-terracotta" />
          </div>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1">{children}</div>
      )}
    </div>
  );
}

/* ─── Settings Tab Content ─── */
function SettingsView() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-3">
      {/* Appearance */}
      <div className="bg-card rounded-xl border border-border/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
              <Palette className="w-4 h-4 text-terracotta" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">外观模式</p>
              <p className="text-xs text-muted-foreground">
                {theme === "light" ? "浅色模式" : "深色模式"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-lg bg-accent/50 hover:bg-accent flex items-center justify-center transition-colors"
            title={theme === "light" ? "切换深色模式" : "切换浅色模式"}
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 text-foreground" />
            ) : (
              <Sun className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Notification & Reminders */}

      <SettingsSection title="用药提醒" icon={Clock} defaultOpen={false}>
        <MedicationReminders />
      </SettingsSection>

      <SettingsSection title="药品分组" icon={Database} defaultOpen={false}>
        <MedicationGroupManager />
      </SettingsSection>

      <SettingsSection title="药品库存" icon={Shield} defaultOpen={false}>
        <MedicationStock />
      </SettingsSection>

      <SettingsSection title="异常预警" icon={Bell} defaultOpen={false}>
        <AlertSettings />
      </SettingsSection>

      <SettingsSection title="止疼药用量控制" icon={Pill} defaultOpen={false}>
        <PainkillerLimitSetting />
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title="数据状态" icon={Database} defaultOpen={false}>
        <SyncStatus />
      </SettingsSection>

      <SettingsSection title="备份与恢复" icon={Shield} defaultOpen={false}>
        <BackupRestore />
      </SettingsSection>

      <SettingsSection title="自定义指标" icon={Activity} defaultOpen={false}>
        <CustomMetricsManager />
      </SettingsSection>

      {/* App Info */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">症状日记 v2.0 · 本地存储版</p>
        <p className="text-[10px] text-muted-foreground mt-1">数据存储在您的设备上，记录每一天，看见每一步改善</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    // Support deep linking from notifications via ?tab=medication etc.
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["record", "medication", "stats", "history", "settings"].includes(tab)) {
      return tab as TabKey;
    }
    return "record";
  });

  // Listen for URL changes (e.g., from notification clicks navigating to /?tab=medication)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && ["record", "medication", "stats", "history", "settings"].includes(tab)) {
        setActiveTab(tab as TabKey);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [quickMode, setQuickMode] = useState(() => {
    try { return localStorage.getItem("record-mode") === "quick"; } catch { return false; }
  });
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr());

  const {
    entries,
    addEntry,
    deleteEntry,
    getEntryByDate,
    exportData,
    exportCSV,
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

  const todayStr = useMemo(() => getLocalDateStr(), []);
  const hasRecordedToday = useMemo(
    () => !!getEntryByDate(todayStr),
    [getEntryByDate, todayStr]
  );

  const handleGoToRecord = () => {
    setSelectedDate(todayStr);
    setActiveTab("record");
  };

  const handleSelectDateFromHistory = (date: string) => {
    setSelectedDate(date);
    setActiveTab("record");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header — simplified */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/30">
        <div className="container max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-terracotta/15 flex items-center justify-center">
                <Pill className="w-4 h-4 text-terracotta" />
              </div>
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
        {/* Daily reminder - show on all tabs except record and settings when not recorded today */}
        {activeTab !== "record" && activeTab !== "settings" && activeTab !== "medication" && (
          <DailyReminder
            hasRecordedToday={hasRecordedToday}
            totalEntries={entries.length}
            onGoToRecord={handleGoToRecord}
          />
        )}
        {/* Also show on record tab if viewing a different date */}
        {activeTab === "record" && selectedDate !== todayStr && (
          <DailyReminder
            hasRecordedToday={hasRecordedToday}
            totalEntries={entries.length}
            onGoToRecord={handleGoToRecord}
          />
        )}
        <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "record" && (
                <>
                  {/* Today Widget - overview card */}
                  {selectedDate === todayStr && (
                    <TodayWidget entries={entries} />
                  )}
                  {/* Shared Date Picker - above mode toggle */}
                  <DatePicker
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                    existingEntry={existingEntry}
                  />
                  {/* Mode toggle */}
                  <div className="flex items-center justify-center gap-1 mb-4">
                    <button
                      onClick={() => { setQuickMode(false); localStorage.setItem("record-mode", "full"); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-medium transition-all border ${
                        !quickMode
                          ? "border-terracotta/40 bg-terracotta/10 text-terracotta"
                          : "border-border/40 bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <PenLine className="w-3 h-3" />
                      完整记录
                    </button>
                    <button
                      onClick={() => { setQuickMode(true); localStorage.setItem("record-mode", "quick"); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-r-lg text-xs font-medium transition-all border ${
                        quickMode
                          ? "border-terracotta/40 bg-terracotta/10 text-terracotta"
                          : "border-border/40 bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      快捷记录
                    </button>
                  </div>
                  {quickMode ? (
                    <QuickRecord
                      date={selectedDate}
                      existingEntry={existingEntry}
                      onSave={addEntry}
                      onSwitchToMedication={() => setActiveTab("medication")}
                    />
                  ) : (
                    <SymptomForm
                      date={selectedDate}
                      existingEntry={existingEntry}
                      onSave={addEntry}
                      onDateChange={setSelectedDate}
                      allTriggers={allTriggers}
                      customTriggers={customTriggers}
                      onAddTrigger={addTrigger}
                      onRemoveTrigger={removeTrigger}
                      onSwitchToMedication={() => setActiveTab("medication")}
                    />
                  )}
                </>
              )}
              {activeTab === "medication" && <MedicationView />}
              {activeTab === "stats" && <StatsView entries={entries} />}
              {activeTab === "history" && (
                <HistoryView
                  entries={entries}
                  onDelete={deleteEntry}
                  onExport={exportData}
                  onExportCSV={exportCSV}
                  onImport={importData}
                  onSelectDate={handleSelectDateFromHistory}
                />
              )}
              {activeTab === "settings" && (
                <SettingsView />
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
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
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
