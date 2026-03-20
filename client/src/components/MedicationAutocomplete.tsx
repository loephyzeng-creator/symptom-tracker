/**
 * Medication autocomplete input component.
 * Shows suggestions based on historical medication records.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Pill, Clock } from "lucide-react";

interface MedicationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is selected, providing both name and dosage */
  onSelectSuggestion?: (name: string, dosage: string) => void;
  placeholder?: string;
  className?: string;
  field: "name" | "dosage";
  /** Current medication name — used to filter dosage suggestions */
  currentMedName?: string;
}

interface MedHistoryItem {
  name: string;
  dosage: string;
  count: number;
}

export default function MedicationAutocomplete({
  value,
  onChange,
  onSelectSuggestion,
  placeholder,
  className,
  field,
  currentMedName,
}: MedicationAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: medHistory } = trpc.medications.history.useQuery(undefined as any, {
    refetchOnWindowFocus: false,
    staleTime: 60_000, // Cache for 1 minute
  });

  // Compute suggestions based on field type
  const suggestions = useCallback(() => {
    if (!medHistory || medHistory.length === 0) return [];

    if (field === "name") {
      // Get unique medication names
      const nameMap = new Map<string, number>();
      for (const item of medHistory) {
        const existing = nameMap.get(item.name) ?? 0;
        nameMap.set(item.name, existing + item.count);
      }
      const uniqueNames = Array.from(nameMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, dosage: "", count }));

      // Filter by input
      if (!value.trim()) return uniqueNames;
      const lower = value.toLowerCase();
      return uniqueNames.filter((item) =>
        item.name.toLowerCase().includes(lower)
      );
    } else {
      // Dosage suggestions: filter by current medication name
      if (!currentMedName?.trim()) return [];
      const dosages = medHistory
        .filter(
          (item) =>
            item.name === currentMedName.trim() &&
            item.dosage.trim() !== ""
        )
        .sort((a, b) => b.count - a.count);

      // Deduplicate dosages
      const seen = new Set<string>();
      const unique: MedHistoryItem[] = [];
      for (const d of dosages) {
        if (!seen.has(d.dosage)) {
          seen.add(d.dosage);
          unique.push(d);
        }
      }

      if (!value.trim()) return unique;
      const lower = value.toLowerCase();
      return unique.filter((item) =>
        item.dosage.toLowerCase().includes(lower)
      );
    }
  }, [medHistory, value, field, currentMedName]);

  const filteredSuggestions = suggestions();

  const handleFocus = () => {
    setShowSuggestions(true);
    setFocusIndex(-1);
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion
    blurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
      setFocusIndex(-1);
    }, 200);
  };

  const handleSelect = (item: MedHistoryItem) => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (field === "name") {
      onChange(item.name);
      // Also fill dosage if available
      const bestDosage = medHistory?.find(
        (m) => m.name === item.name && m.dosage.trim() !== ""
      );
      if (onSelectSuggestion) {
        onSelectSuggestion(item.name, bestDosage?.dosage ?? "");
      }
    } else {
      onChange(item.dosage);
    }
    setShowSuggestions(false);
    setFocusIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
      );
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      handleSelect(filteredSuggestions[focusIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-suggestion]");
      items[focusIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const hasSuggestions = filteredSuggestions.length > 0;

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
          setFocusIndex(-1);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {showSuggestions && hasSuggestions && (
        <div
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
        >
          <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground border-b border-border/50 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            历史用药
          </div>
          {filteredSuggestions.map((item, idx) => (
            <button
              key={`${item.name}-${item.dosage}-${idx}`}
              data-suggestion
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                idx === focusIndex
                  ? "bg-terracotta/10 text-foreground"
                  : "hover:bg-muted/50 text-foreground"
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                handleSelect(item);
              }}
            >
              <Pill className="w-3.5 h-3.5 text-dusty-blue shrink-0" />
              <span className="truncate">
                {field === "name" ? item.name : item.dosage}
              </span>
              {field === "name" && item.count > 0 && (
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                  {item.count}次
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
