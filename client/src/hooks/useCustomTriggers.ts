import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "symptom-tracker-custom-triggers";

const DEFAULT_TRIGGERS = [
  "睡眠不足", "压力大", "天气变化", "饮食不当", "运动过量",
  "久坐", "强光刺激", "噪音", "情绪波动", "月经期",
  "未戴眼镜", "坐车", "熬夜", "中午未午睡", "临时工作汇报",
];

function loadCustomTriggers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCustomTriggers(triggers: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(triggers));
}

export function useCustomTriggers() {
  const [customTriggers, setCustomTriggers] = useState<string[]>(() => loadCustomTriggers());

  useEffect(() => {
    saveCustomTriggers(customTriggers);
  }, [customTriggers]);

  const allTriggers = [...DEFAULT_TRIGGERS, ...customTriggers];

  const addTrigger = useCallback((trigger: string) => {
    const trimmed = trigger.trim();
    if (!trimmed) return false;
    if (allTriggers.includes(trimmed)) return false;
    setCustomTriggers((prev) => [...prev, trimmed]);
    return true;
  }, [allTriggers]);

  const removeTrigger = useCallback((trigger: string) => {
    setCustomTriggers((prev) => prev.filter((t) => t !== trigger));
  }, []);

  return {
    defaultTriggers: DEFAULT_TRIGGERS,
    customTriggers,
    allTriggers,
    addTrigger,
    removeTrigger,
  };
}
