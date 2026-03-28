/**
 * TriggerTips — Shows contextual health tips when specific triggers are selected.
 * Supports multiple triggers, each with recommended/avoid items and a summary tip.
 * Users can customize tips via the settings page (stored in DB); defaults are built-in.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import {
  Flame,
  Moon,
  Brain,
  CloudRain,
  UtensilsCrossed,
  Coffee,
  Droplets,
  Ban,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";

/* ─── Built-in trigger tip data ─── */
export interface TriggerTipData {
  trigger: string;
  icon: LucideIcon;
  title: string;
  colorScheme: {
    border: string;
    bg: string;
    titleText: string;
    chevron: string;
    tipText: string;
  };
  recommended: string[];
  avoid: string[];
  tip: string;
}

export const DEFAULT_TRIGGER_TIPS: TriggerTipData[] = [
  {
    trigger: "上火",
    icon: Flame,
    title: "上火可加重头晕，注意饮食调理",
    colorScheme: {
      border: "border-orange-300/40 dark:border-orange-700/30",
      bg: "bg-orange-50/60 dark:bg-orange-950/20",
      titleText: "text-orange-800 dark:text-orange-300",
      chevron: "text-orange-400",
      tipText: "text-orange-600/70 dark:text-orange-400/60",
    },
    recommended: [
      "薄荷水", "菊花茶", "金银花茶", "绿豆汤", "莲子心茶",
      "苦瓜", "黄瓜", "冬瓜", "莲藕", "梨", "西瓜", "百合银耳",
    ],
    avoid: ["辛辣食物", "油炸煎烤", "羊肉", "荔枝", "龙眼", "榴莲", "浓茶咖啡", "酒精"],
    tip: "多喝温水，饮食清淡，规律作息。薄荷性凉，有清利头目的作用，对上火引起的头晕尤其有帮助。如症状持续请咨询医生。",
  },
  {
    trigger: "睡眠不足",
    icon: Moon,
    title: "睡眠不足会加重头晕和注意力下降",
    colorScheme: {
      border: "border-indigo-300/40 dark:border-indigo-700/30",
      bg: "bg-indigo-50/60 dark:bg-indigo-950/20",
      titleText: "text-indigo-800 dark:text-indigo-300",
      chevron: "text-indigo-400",
      tipText: "text-indigo-600/70 dark:text-indigo-400/60",
    },
    recommended: [
      "热牛奶", "酸枣仁茶", "百合莲子粥", "香蕉", "核桃",
      "小米粥", "蜂蜜水", "樱桃", "猕猴桃",
    ],
    avoid: ["咖啡", "浓茶", "可乐", "巧克力", "酒精", "辛辣食物", "高糖食物"],
    tip: "睡前1小时避免屏幕蓝光，保持卧室凉爽安静。热牛奶和酸枣仁茶有助于安神助眠。尝试固定作息时间，周末也不要晚起超过1小时。",
  },
  {
    trigger: "压力大",
    icon: Brain,
    title: "精神压力会加重头痛和焦虑",
    colorScheme: {
      border: "border-violet-300/40 dark:border-violet-700/30",
      bg: "bg-violet-50/60 dark:bg-violet-950/20",
      titleText: "text-violet-800 dark:text-violet-300",
      chevron: "text-violet-400",
      tipText: "text-violet-600/70 dark:text-violet-400/60",
    },
    recommended: [
      "洋甘菊茶", "薰衣草茶", "深海鱼", "坚果", "黑巧克力",
      "香蕉", "菠菜", "牛油果", "蓝莓",
    ],
    avoid: ["高糖零食", "过量咖啡因", "酒精", "加工食品", "高盐食物"],
    tip: "尝试4-7-8呼吸法（吸气4秒、屏息7秒、呼气8秒）缓解紧张。适度运动如散步20分钟可有效减压。洋甘菊茶和深海鱼富含的Omega-3有助于情绪调节。",
  },
  {
    trigger: "熬夜",
    icon: Coffee,
    title: "熬夜损伤恢复力，次日症状易加重",
    colorScheme: {
      border: "border-amber-300/40 dark:border-amber-700/30",
      bg: "bg-amber-50/60 dark:bg-amber-950/20",
      titleText: "text-amber-800 dark:text-amber-300",
      chevron: "text-amber-400",
      tipText: "text-amber-600/70 dark:text-amber-400/60",
    },
    recommended: [
      "温水", "蜂蜜柠檬水", "红枣枸杞茶", "小米粥", "鸡蛋",
      "燕麦", "葡萄", "番茄", "胡萝卜",
    ],
    avoid: ["继续熬夜补觉", "大量咖啡提神", "油腻早餐", "冷饮", "甜食"],
    tip: "熬夜后次日中午补睡20-30分钟（不超过1小时），多喝温水帮助代谢。红枣枸杞茶有助于恢复元气。尽量在接下来几天恢复正常作息。",
  },
  {
    trigger: "天气变化",
    icon: CloudRain,
    title: "气压/温差变化可诱发头晕头痛",
    colorScheme: {
      border: "border-sky-300/40 dark:border-sky-700/30",
      bg: "bg-sky-50/60 dark:bg-sky-950/20",
      titleText: "text-sky-800 dark:text-sky-300",
      chevron: "text-sky-400",
      tipText: "text-sky-600/70 dark:text-sky-400/60",
    },
    recommended: [
      "姜茶", "红糖水", "温热汤品", "山药", "红枣",
      "桂圆", "羊肉汤（寒冷时）", "热粥",
    ],
    avoid: ["冷饮", "生冷食物", "过度吹空调", "冰淇淋"],
    tip: "气压骤降时注意保暖，适当活动促进血液循环。姜茶可以驱寒暖胃。天气变化前后注意增减衣物，避免温差过大刺激。",
  },
  {
    trigger: "饮食不当",
    icon: UtensilsCrossed,
    title: "不规律饮食会影响整体状态",
    colorScheme: {
      border: "border-emerald-300/40 dark:border-emerald-700/30",
      bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
      titleText: "text-emerald-800 dark:text-emerald-300",
      chevron: "text-emerald-400",
      tipText: "text-emerald-600/70 dark:text-emerald-400/60",
    },
    recommended: [
      "清粥小菜", "蒸煮食物", "新鲜蔬果", "温开水",
      "山药", "南瓜", "红薯", "白萝卜",
    ],
    avoid: ["暴饮暴食", "过于油腻", "生冷刺激", "过饱过饥", "深夜进食"],
    tip: "饮食不当后建议下一餐清淡为主，少量多餐让肠胃恢复。山药和南瓜有健脾养胃的作用。保持三餐规律，细嚼慢咽。",
  },
];

/* ─── Single tip card component ─── */
function TriggerTipCard({ data }: { data: TriggerTipData }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = data.icon;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-2 first:mt-3"
    >
      <div className={`rounded-lg border ${data.colorScheme.border} ${data.colorScheme.bg} overflow-hidden`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        >
          <Icon className={`w-4 h-4 shrink-0 ${data.colorScheme.chevron}`} />
          <span className={`text-xs font-medium flex-1 ${data.colorScheme.titleText}`}>
            {data.title}
          </span>
          {expanded ? (
            <ChevronUp className={`w-3.5 h-3.5 ${data.colorScheme.chevron}`} />
          ) : (
            <ChevronDown className={`w-3.5 h-3.5 ${data.colorScheme.chevron}`} />
          )}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-3 pb-3 space-y-2.5"
          >
            {/* Recommended */}
            {data.recommended.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Droplets className="w-3 h-3 text-emerald-500" />
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    推荐
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.recommended.map((item) => (
                    <span
                      key={item}
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Avoid */}
            {data.avoid.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Ban className="w-3 h-3 text-red-400" />
                  <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                    应避免
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.avoid.map((item) => (
                    <span
                      key={item}
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-red-100/80 text-red-600 dark:bg-red-900/30 dark:text-red-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            {data.tip && (
              <div className="flex items-start gap-1.5 pt-0.5">
                <Lightbulb className={`w-3 h-3 mt-0.5 shrink-0 ${data.colorScheme.chevron}`} />
                <p className={`text-[10px] leading-relaxed ${data.colorScheme.tipText}`}>
                  {data.tip}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main container: renders tips for all selected triggers ─── */
export default function TriggerTips({ selectedTriggers }: { selectedTriggers: string[] }) {
  // Fetch user custom tips (overrides defaults)
  const customTipsQuery = trpc.triggerTips.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const activeTips = selectedTriggers
    .map((trigger) => {
      // Check for user custom tip first
      const custom = customTipsQuery.data?.find((ct) => ct.trigger === trigger);
      if (custom) {
        // Find the default to get icon and color scheme
        const defaultTip = DEFAULT_TRIGGER_TIPS.find((d) => d.trigger === trigger);
        return {
          ...defaultTip,
          trigger: custom.trigger,
          title: custom.title || defaultTip?.title || `${trigger} 调理建议`,
          recommended: custom.recommended,
          avoid: custom.avoid,
          tip: custom.tip || defaultTip?.tip || "",
          icon: defaultTip?.icon || Lightbulb,
          colorScheme: defaultTip?.colorScheme || DEFAULT_TRIGGER_TIPS[0].colorScheme,
        } as TriggerTipData;
      }
      // Fall back to built-in default
      return DEFAULT_TRIGGER_TIPS.find((d) => d.trigger === trigger);
    })
    .filter((t): t is TriggerTipData => !!t);

  if (activeTips.length === 0) return null;

  return (
    <AnimatePresence>
      {activeTips.map((tip) => (
        <TriggerTipCard key={tip.trigger} data={tip} />
      ))}
    </AnimatePresence>
  );
}
