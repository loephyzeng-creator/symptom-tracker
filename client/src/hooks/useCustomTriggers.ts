import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

/* ─── Category definitions ─── */
export interface TriggerCategory {
  label: string;
  triggers: string[];
}

const TRIGGER_CATEGORIES: TriggerCategory[] = [
  {
    label: "睡眠相关",
    triggers: ["睡眠不足", "熬夜", "中午未午睡", "白天嗜睡"],
  },
  {
    label: "情绪与压力",
    triggers: ["压力大", "情绪波动", "临时工作汇报"],
  },
  {
    label: "环境因素",
    triggers: ["天气变化", "强光刺激", "噪音"],
  },
  {
    label: "身体与生活",
    triggers: ["饮食不当", "运动过量", "久坐", "坐车", "月经期", "未戴眼镜", "上火"],
  },
  {
    label: "神经与认知",
    triggers: ["注意力下降", "头昏沉"],
  },
  {
    label: "泌尿相关",
    triggers: ["排尿困难", "尿等待", "夜尿增多", "排尿不尽", "尿频", "尿急"],
  },
  {
    label: "社交相关",
    triggers: ["社交聚会", "公开发言", "与陌生人交流", "被关注/评价", "冲突对话"],
  },
];

const DEFAULT_TRIGGERS = TRIGGER_CATEGORIES.flatMap((c) => c.triggers);

export function useCustomTriggers() {
  const utils = trpc.useUtils();

  const triggersQuery = trpc.triggers.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const frequencyQuery = trpc.triggers.frequency.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000, // cache for 1 minute
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

  const renameMutation = trpc.triggers.rename.useMutation({
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

  const frequency = useMemo(() => {
    return (frequencyQuery.data as Record<string, number>) ?? {};
  }, [frequencyQuery.data]);

  const allTriggers = [...DEFAULT_TRIGGERS, ...customTriggers];

  /* ─── Sorted triggers: most frequently used first ─── */
  const sortedTriggers = useMemo(() => {
    return [...allTriggers].sort((a, b) => {
      const fa = frequency[a] ?? 0;
      const fb = frequency[b] ?? 0;
      return fb - fa; // descending by frequency
    });
  }, [allTriggers, frequency]);

  /* ─── Grouped triggers by category, each group sorted by frequency ─── */
  const groupedTriggers = useMemo(() => {
    const groups: TriggerCategory[] = TRIGGER_CATEGORIES.map((cat) => ({
      label: cat.label,
      triggers: [...cat.triggers].sort((a, b) => {
        const fa = frequency[a] ?? 0;
        const fb = frequency[b] ?? 0;
        return fb - fa;
      }),
    }));

    // Add custom triggers as a separate group
    if (customTriggers.length > 0) {
      groups.push({
        label: "自定义",
        triggers: [...customTriggers].sort((a, b) => {
          const fa = frequency[a] ?? 0;
          const fb = frequency[b] ?? 0;
          return fb - fa;
        }),
      });
    }

    return groups;
  }, [customTriggers, frequency]);

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

  const renameTrigger = useCallback(
    async (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return false;
      if (trimmed === oldName) return false;
      if (allTriggers.includes(trimmed)) return false;
      const id = customTriggerIds.get(oldName);
      if (!id) return false;
      try {
        await renameMutation.mutateAsync({ id, name: trimmed });
        return true;
      } catch {
        return false;
      }
    },
    [allTriggers, customTriggerIds, renameMutation]
  );

  return {
    defaultTriggers: DEFAULT_TRIGGERS,
    customTriggers,
    allTriggers,
    sortedTriggers,
    groupedTriggers,
    frequency,
    addTrigger,
    removeTrigger,
    renameTrigger,
    isLoading: triggersQuery.isLoading,
    isRenaming: renameMutation.isPending,
  };
}
