import { useCallback, useMemo, useState } from "react";
import {
  getTriggers,
  addTrigger as addTriggerToStorage,
  deleteTrigger as deleteTriggerFromStorage,
} from "@/lib/local-storage";

const DEFAULT_TRIGGERS = [
  "睡眠不足", "压力大", "天气变化", "饮食不当", "运动过量",
  "久坐", "强光刺激", "噪音", "情绪波动", "月经期",
  "未戴眼镜", "坐车", "熬夜", "中午未午睡", "临时工作汇报",
];

export function useCustomTriggers() {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const customTriggers = useMemo(() => {
    return getTriggers().map((t) => t.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const customTriggerIds = useMemo(() => {
    const map = new Map<string, number>();
    getTriggers().forEach((t) => map.set(t.name, t.id));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const allTriggers = [...DEFAULT_TRIGGERS, ...customTriggers];

  const addTrigger = useCallback(
    async (trigger: string) => {
      const trimmed = trigger.trim();
      if (!trimmed) return false;
      if (allTriggers.includes(trimmed)) return false;
      addTriggerToStorage(trimmed);
      refresh();
      return true;
    },
    [allTriggers, refresh]
  );

  const removeTrigger = useCallback(
    async (trigger: string) => {
      const id = customTriggerIds.get(trigger);
      if (id) {
        deleteTriggerFromStorage(id);
        refresh();
      }
    },
    [customTriggerIds, refresh]
  );

  return {
    defaultTriggers: DEFAULT_TRIGGERS,
    customTriggers,
    allTriggers,
    addTrigger,
    removeTrigger,
    isLoading: false,
  };
}
