/**
 * PainkillerLimitSetting — 止疼药使用阈值设置（localStorage 版本）
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pill, Check, Info } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "painkiller_day_limit";
function getPainkillerLimit() {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? parseInt(v, 10) : 10; } catch { return 10; }
}

export default function PainkillerLimitSetting() {
  const [currentLimit, setCurrentLimit] = useState(() => getPainkillerLimit());
  const [localLimit, setLocalLimit] = useState(() => getPainkillerLimit());
  const [dirty, setDirty] = useState(false);

  const handleSave = () => {
    try { localStorage.setItem(STORAGE_KEY, String(localLimit)); } catch {}
    setCurrentLimit(localLimit);
    setDirty(false);
    toast.success("止疼药阈值已更新", { description: `30天内用量上限设为 ${localLimit} 天` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/30">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          设置30天内服用止疼药的天数上限。当累计天数接近或超过此值时，记录页面会显示警告提醒。
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-chart-4/10 flex items-center justify-center">
            <Pill className="w-3.5 h-3.5 text-chart-4" />
          </div>
          <span className="text-sm font-medium">报警阈值</span>
        </div>
        <span className={`text-lg font-bold tabular-nums ${
          localLimit <= 5 ? "text-destructive" : localLimit <= 8 ? "text-terracotta" : "text-foreground"
        }`}>
          {localLimit} <span className="text-xs font-normal text-muted-foreground">天 / 30天</span>
        </span>
      </div>

      <div className="px-1">
        <Slider
          value={[localLimit]}
          onValueChange={(v) => { setLocalLimit(v[0]); setDirty(v[0] !== currentLimit); }}
          min={1} max={30} step={1} className="w-full"
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">1天</span>
          <span className="text-[10px] text-muted-foreground">30天</span>
        </div>
      </div>

      <div className="flex gap-2">
        {[5, 8, 10, 15].map((preset) => (
          <button
            key={preset}
            onClick={() => { setLocalLimit(preset); setDirty(preset !== currentLimit); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              localLimit === preset
                ? "bg-terracotta/10 text-terracotta border-terracotta/30"
                : "bg-card border-border/50 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {preset}天
          </button>
        ))}
      </div>

      {dirty && (
        <Button onClick={handleSave} className="w-full bg-terracotta hover:bg-terracotta/90 text-white" size="sm">
          <Check className="w-4 h-4 mr-1.5" />保存设置
        </Button>
      )}
    </div>
  );
}
