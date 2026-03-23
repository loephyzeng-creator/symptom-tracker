import { Timer } from "lucide-react";
import { OFFSET_OPTIONS } from "./types";

export default function OffsetSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">提醒偏移</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent border border-border rounded-md px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        {OFFSET_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
