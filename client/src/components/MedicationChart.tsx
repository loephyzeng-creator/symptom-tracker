/**
 * Medication Frequency Bar Chart — Recharts horizontal bar chart
 * Shows top medications by usage frequency
 */
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { Pill } from "lucide-react";

interface MedicationChartProps {
  entries: SymptomEntry[];
}

const BAR_COLORS = [
  "#7a9e7e", "#7a9eb8", "#b87a4b", "#9b6b8a", "#c49a3c",
  "#c45c5c", "#6b8e7a", "#8a7eb8", "#b8704b", "#7b6b9a",
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg text-xs">
      <p className="font-medium mb-1">{data.name}</p>
      {data.dosage && <p className="text-muted-foreground">用量：{data.dosage}</p>}
      <p className="text-muted-foreground">使用 {data.count} 天</p>
    </div>
  );
}

export default function MedicationChart({ entries }: MedicationChartProps) {
  const chartData = useMemo(() => {
    if (entries.length === 0) return [];

    const medMap = new Map<string, { name: string; dosage: string; count: number }>();
    entries.forEach((e) => {
      if (Array.isArray(e.medications)) {
        e.medications.forEach((m: any) => {
          if (m.name?.trim()) {
            const key = m.name.trim();
            const existing = medMap.get(key);
            if (!existing) {
              medMap.set(key, { name: key, dosage: m.dosage || "", count: 1 });
            } else {
              existing.count += 1;
              if (!existing.dosage && m.dosage) existing.dosage = m.dosage;
            }
          }
        });
      }
    });

    return Array.from(medMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [entries]);

  if (chartData.length === 0) return null;

  // Dynamically calculate Y axis width based on longest drug name
  const maxNameLength = Math.max(...chartData.map((d) => d.name.length), 0);
  const yAxisWidth = Math.max(maxNameLength * 14, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <Pill className="w-4 h-4 text-sage" />
        <h3 className="font-serif font-semibold text-sm">用药频率统计</h3>
        <span className="text-xs text-muted-foreground">
          （共 {entries.length} 天记录）
        </span>
      </div>

      <div style={{ height: Math.max(chartData.length * 36, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--foreground)" }}
              tickLine={false}
              axisLine={false}
              width={yAxisWidth}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
