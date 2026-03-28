/**
 * InflammationDietTip — Collapsible diet tip shown when "上火" trigger is selected.
 * Provides recommended foods/drinks and items to avoid for reducing internal heat.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Droplets,
  Ban,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const RECOMMENDED = [
  "薄荷水", "菊花茶", "金银花茶", "绿豆汤", "莲子心茶",
  "苦瓜", "黄瓜", "冬瓜", "莲藕", "梨", "西瓜", "百合银耳",
];

const AVOID = [
  "辛辣食物", "油炸煎烤", "羊肉", "荔枝", "龙眼",
  "榴莲", "浓茶咖啡", "酒精",
];

export default function InflammationDietTip() {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-3"
    >
      <div className="rounded-lg border border-orange-300/40 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-700/30 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        >
          <Flame className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-xs font-medium text-orange-800 dark:text-orange-300 flex-1">
            上火可加重头晕，注意饮食调理
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-orange-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
          )}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-3 pb-3 space-y-2.5"
          >
            {/* Recommended */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Droplets className="w-3 h-3 text-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  推荐食物 / 饮品
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {RECOMMENDED.map((item) => (
                  <span
                    key={item}
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Avoid */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Ban className="w-3 h-3 text-red-400" />
                <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                  应避免
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {AVOID.map((item) => (
                  <span
                    key={item}
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-red-100/80 text-red-600 dark:bg-red-900/30 dark:text-red-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Extra tips */}
            <p className="text-[10px] text-orange-600/70 dark:text-orange-400/60 leading-relaxed pt-0.5">
              多喝温水，饮食清淡，规律作息。薄荷性凉，有清利头目的作用，对上火引起的头晕尤其有帮助。如症状持续请咨询医生。
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
