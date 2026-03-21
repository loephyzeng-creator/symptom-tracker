/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Main page with tab navigation: Record / Stats / History / Report / Settings
 * Colors: warm cream bg, terracotta accents, sage green, dusty blue
 * Typography: Noto Serif SC (headings), Noto Sans SC (body)
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useSymptomData } from "@/hooks/useSymptomData";
import { useCustomTriggers } from "@/hooks/useCustomTriggers";
import SymptomForm from "@/components/SymptomForm";
import QuickRecord from "@/components/QuickRecord";
import TodayWidget from "@/components/TodayWidget";
import StatsView from "@/components/StatsView";
import HistoryView from "@/components/HistoryView";
import ReportView from "@/components/ReportView";
import DailyReminder from "@/components/DailyReminder";
import NotificationSettings from "@/components/NotificationSettings";
import AlertSettings from "@/components/AlertSettings";
import MedicationReminders from "@/components/MedicationReminders";
import MissedMedicationAlert from "@/components/MissedMedicationAlert";
import MedicationStock from "@/components/MedicationStock";
import MedicationCheckInCalendar from "@/components/MedicationCheckInCalendar";
import BackupRestore from "@/components/BackupRestore";
import SyncStatus from "@/components/SyncStatus";
import CustomMetricsManager from "@/components/CustomMetricsManager";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenLine, BarChart3, Clock, BookOpen, LogIn, LogOut, Loader2,
  FileText, Bell, Settings, Sun, Moon, Zap, CalendarDays, User,
  ChevronRight, Database, Shield, Activity, Palette
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { zhCN } from "date-fns/locale";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

type TabKey = "record" | "stats" | "history" | "report" | "settings";

const TABS: { key: TabKey; label: string; icon: typeof PenLine }[] = [
  { key: "record", label: "记录", icon: PenLine },
  { key: "stats", label: "统计", icon: BarChart3 },
  { key: "history", label: "历史", icon: Clock },
  { key: "report", label: "报告", icon: FileText },
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

  return (
    <div className="flex items-center justify-center mb-4">
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all">
            <CalendarDays className="w-5 h-5 text-terracotta" />
            <div className="text-center">
              <h2 className="font-serif text-lg font-semibold text-foreground leading-tight">
                {formatDateCN(date)}
              </h2>
              <div className="flex items-center justify-center gap-2">
                {isToday && (
                  <span className="text-xs text-sage font-medium">今天</span>
                )}
                {existingEntry && (
                  <span className="text-xs text-terracotta font-medium">已记录</span>
                )}
                {!isToday && !existingEntry && (
                  <span className="text-xs text-muted-foreground">点击选择日期</span>
                )}
              </div>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            locale={zhCN}
            disabled={{ after: today }}
            defaultMonth={selectedDate}
            className="rounded-xl"
            classNames={{
              today: "bg-terracotta/15 text-terracotta font-bold rounded-md",
              month_caption: "flex items-center justify-center h-10 w-full px-8 font-serif font-semibold",
            }}
          />
        </PopoverContent>
      </Popover>
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
    <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Settings Tab Content ─── */
function SettingsView({
  user,
  onLogout,
}: {
  user: { name?: string | null; avatarUrl?: string; openId?: string } | null;
  onLogout: () => void;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-3">
      {/* User Profile Card */}
      <div className="bg-card rounded-xl border border-border/40 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-terracotta" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {user?.name ?? "用户"}
            </p>
            <p className="text-xs text-muted-foreground">已登录</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出
          </Button>
        </div>
      </div>

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
      <SettingsSection title="推送通知" icon={Bell} defaultOpen={false}>
        <NotificationSettings />
      </SettingsSection>

      <SettingsSection title="用药提醒" icon={Clock} defaultOpen={false}>
        <MedicationReminders />
      </SettingsSection>

      <SettingsSection title="药品库存" icon={Shield} defaultOpen={false}>
        <MedicationStock />
      </SettingsSection>

      <SettingsSection title="异常预警" icon={Bell} defaultOpen={false}>
        <AlertSettings />
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title="数据同步" icon={Database} defaultOpen={false}>
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
        <p className="text-xs text-muted-foreground">症状日记 v1.0</p>
        <p className="text-[10px] text-muted-foreground mt-1">记录每一天，看见每一步改善</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("record");
  const [quickMode, setQuickMode] = useState(() => {
    try { return localStorage.getItem("record-mode") === "quick"; } catch { return false; }
  });
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const {
    entries,
    addEntry,
    deleteEntry,
    getEntryByDate,
    exportData,
    exportCSV,
    importData,
    isLoading: dataLoading,
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

  const todayStr = new Date().toISOString().slice(0, 10);
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

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta mb-4" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    );
  }

  // Not logged in — show login prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663299884726/7CnBeGxyBasxbKLjVrJzxx/wellness-icon-6VW4Dy8xn7zsxPdzmdLqpc.webp"
            alt="logo"
            className="w-16 h-16 rounded-2xl mx-auto mb-4"
          />
          <h1 className="font-serif text-2xl font-bold text-foreground mb-2">
            症状日记
          </h1>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            记录每一天的身体状况，发现症状规律，<br />
            数据安全存储在云端，随时随地访问。
          </p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-terracotta hover:bg-terracotta/90 text-white rounded-xl h-12 px-8 text-base"
          >
            <LogIn className="w-5 h-5 mr-2" />
            登录开始记录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header — simplified */}
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
        {/* Daily reminder - show on all tabs except record and settings when not recorded today */}
        {!dataLoading && activeTab !== "record" && activeTab !== "settings" && (
          <DailyReminder
            hasRecordedToday={hasRecordedToday}
            totalEntries={entries.length}
            onGoToRecord={handleGoToRecord}
          />
        )}
        {/* Also show on record tab if viewing a different date */}
        {!dataLoading && activeTab === "record" && selectedDate !== todayStr && (
          <DailyReminder
            hasRecordedToday={hasRecordedToday}
            totalEntries={entries.length}
            onGoToRecord={handleGoToRecord}
          />
        )}
        {dataLoading && activeTab !== "settings" ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-terracotta mb-3" />
            <p className="text-sm text-muted-foreground">加载数据中...</p>
          </div>
        ) : (
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
                  {/* Missed Medication Alert */}
                  {selectedDate === todayStr && !dataLoading && (
                    <MissedMedicationAlert />
                  )}
                  {/* Today Widget - overview card */}
                  {selectedDate === todayStr && !dataLoading && (
                    <TodayWidget entries={entries} />
                  )}
                  {/* Medication Check-in Calendar */}
                  {selectedDate === todayStr && !dataLoading && (
                    <div className="mb-4">
                      <MedicationCheckInCalendar />
                    </div>
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
                    />
                  )}
                </>
              )}
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
              {activeTab === "report" && <ReportView />}
              {activeTab === "settings" && (
                <SettingsView user={user} onLogout={logout} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
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
