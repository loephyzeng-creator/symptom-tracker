import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

const DEFAULT_TRIGGERS = [
  "睡眠不足", "压力大", "天气变化", "饮食不当", "运动过量",
  "久坐", "强光刺激", "噪音", "情绪波动", "月经期",
  "未戴眼镜", "坐车", "熬夜", "中午未午睡", "临时工作汇报",
  "白天嗜睡", "注意力下降", "头昏沉",
];

export function useCustomTriggers() {
  const utils = trpc.useUtils();

  const triggersQuery = trpc.triggers.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const addMutation = trpc.triggers.add.useMutation({
    onSuccess: () => {
      utils.triggers.list.invalidate();
    },
  });

  const deleteMutation = trpc.triggers.delete.useMutation({
    onSuccess: () => {
      utils.triggers.list.invalidate();
    },
  });

  const customTriggers = useMemo(() => {
    if (!triggersQuery.data) return [];
    return triggersQuery.data.map((t) => t.name);
  }, [triggersQuery.data]);

  const customTriggerIds = useMemo(() => {
    if (!triggersQuery.data) return new Map<string, number>();
    const map = new Map<string, number>();
    triggersQuery.data.forEach((t) => map.set(t.name, t.id));
    return map;
  }, [triggersQuery.data]);

  const allTriggers = [...DEFAULT_TRIGGERS, ...customTriggers];

  const addTrigger = useCallback(
    async (trigger: string) => {
      const trimmed = trigger.trim();
      if (!trimmed) return false;
      if (allTriggers.includes(trimmed)) return false;
      try {
        await addMutation.mutateAsync({ name: trimmed });
        return true;
      } catch {
        return false;
      }
    },
    [allTriggers, addMutation]
  );

  const removeTrigger = useCallback(
    async (trigger: string) => {
      const id = customTriggerIds.get(trigger);
      if (id) {
        await deleteMutation.mutateAsync({ id });
      }
    },
    [customTriggerIds, deleteMutation]
  );

  return {
    defaultTriggers: DEFAULT_TRIGGERS,
    customTriggers,
    allTriggers,
    addTrigger,
    removeTrigger,
    isLoading: triggersQuery.isLoading,
  };
}
