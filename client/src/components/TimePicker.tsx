import { useState, useRef, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";

/**
 * Custom time picker for mobile-friendly time selection.
 * Uses a dropdown with hour/minute selectors instead of native <input type="time">
 * which has inconsistent behavior on iOS Safari (auto-closes on scroll).
 */

interface TimePickerProps {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function TimePicker({ hour, minute, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempHour, setTempHour] = useState(hour);
  const [tempMinute, setTempMinute] = useState(minute);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Snap minute to nearest 5-minute interval for display
  const nearestMinute = MINUTES.reduce((prev, curr) =>
    Math.abs(curr - minute) < Math.abs(prev - minute) ? curr : prev
  );

  // Sync temp values when props change
  useEffect(() => {
    setTempHour(hour);
    setTempMinute(nearestMinute);
  }, [hour, nearestMinute]);

  // Scroll to selected values when opening
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (hourListRef.current) {
          const selected = hourListRef.current.querySelector("[data-selected=true]");
          if (selected) {
            selected.scrollIntoView({ block: "center", behavior: "instant" });
          }
        }
        if (minuteListRef.current) {
          const selected = minuteListRef.current.querySelector("[data-selected=true]");
          if (selected) {
            selected.scrollIntoView({ block: "center", behavior: "instant" });
          }
        }
      });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick as any);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick as any);
    };
  }, [open]);

  const handleConfirm = useCallback(() => {
    onChange(tempHour, tempMinute);
    setOpen(false);
  }, [tempHour, tempMinute, onChange]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Display button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-transparent border border-border rounded-md px-3 py-1.5 text-sm hover:border-terracotta/50 focus:outline-none focus:ring-1 focus:ring-terracotta transition-colors"
      >
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium tabular-nums">{pad(hour)}:{pad(minute)}</span>
      </button>

      {/* Dropdown picker */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex">
            {/* Hour column */}
            <div className="w-16">
              <div className="text-center text-xs text-muted-foreground py-1.5 border-b border-border/50 font-medium">
                时
              </div>
              <div
                ref={hourListRef}
                className="h-40 overflow-y-auto overscroll-contain"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-selected={h === tempHour}
                    onClick={() => setTempHour(h)}
                    className={`w-full py-2 text-center text-sm transition-colors ${
                      h === tempHour
                        ? "bg-terracotta/15 text-terracotta font-semibold"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {pad(h)}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-border/50" />

            {/* Minute column */}
            <div className="w-16">
              <div className="text-center text-xs text-muted-foreground py-1.5 border-b border-border/50 font-medium">
                分
              </div>
              <div
                ref={minuteListRef}
                className="h-40 overflow-y-auto overscroll-contain"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-selected={m === tempMinute}
                    onClick={() => setTempMinute(m)}
                    className={`w-full py-2 text-center text-sm transition-colors ${
                      m === tempMinute
                        ? "bg-terracotta/15 text-terracotta font-semibold"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {pad(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Confirm button */}
          <div className="border-t border-border/50 p-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-1.5 text-sm font-medium text-white bg-terracotta hover:bg-terracotta/90 rounded-lg transition-colors"
            >
              确认 {pad(tempHour)}:{pad(tempMinute)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
