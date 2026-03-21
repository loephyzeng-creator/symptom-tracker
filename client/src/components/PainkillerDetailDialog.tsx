/**
 * PainkillerDetailDialog — prompts user to record painkiller brand and dosage
 * after saving an entry with painkillerTaken=1.
 * Shows common painkiller options as quick-select badges, with custom input.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pill, Check } from "lucide-react";

const COMMON_PAINKILLERS = [
  "布洛芬",
  "对乙酰氨基酚",
  "阿司匹林",
  "双氯芬酸",
  "萘普生",
  "曲马多",
  "氨酚待因",
  "舒马曲坦",
];

const COMMON_DOSAGES = [
  "200mg",
  "400mg",
  "500mg",
  "600mg",
  "1片",
  "2片",
];

interface PainkillerDetailDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (brand: string, dosage: string) => void;
  initialBrand?: string;
  initialDosage?: string;
}

export default function PainkillerDetailDialog({
  open,
  onClose,
  onSave,
  initialBrand,
  initialDosage,
}: PainkillerDetailDialogProps) {
  const [brand, setBrand] = useState(initialBrand || "");
  const [dosage, setDosage] = useState(initialDosage || "");

  useEffect(() => {
    if (open) {
      setBrand(initialBrand || "");
      setDosage(initialDosage || "");
    }
  }, [open, initialBrand, initialDosage]);

  const handleSave = () => {
    onSave(brand.trim(), dosage.trim());
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
              <Pill className="w-4.5 h-4.5 text-rose-600" />
            </div>
            <DialogTitle className="font-serif text-base">
              记录止疼药详情
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            记录止疼药品牌和剂量，方便后续分析不同药物的效果差异。可跳过。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Brand Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              药品名称
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_PAINKILLERS.map((p) => (
                <Badge
                  key={p}
                  variant={brand === p ? "default" : "outline"}
                  className={`cursor-pointer text-xs transition-all ${
                    brand === p
                      ? "bg-terracotta text-white hover:bg-terracotta/90 border-terracotta"
                      : "hover:bg-muted border-border"
                  }`}
                  onClick={() => setBrand(brand === p ? "" : p)}
                >
                  {brand === p && <Check className="w-3 h-3 mr-0.5" />}
                  {p}
                </Badge>
              ))}
            </div>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="或输入其他药品名称..."
              className="bg-muted/50 border-0 text-sm h-9"
            />
          </div>

          {/* Dosage Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              剂量
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_DOSAGES.map((d) => (
                <Badge
                  key={d}
                  variant={dosage === d ? "default" : "outline"}
                  className={`cursor-pointer text-xs transition-all ${
                    dosage === d
                      ? "bg-terracotta text-white hover:bg-terracotta/90 border-terracotta"
                      : "hover:bg-muted border-border"
                  }`}
                  onClick={() => setDosage(dosage === d ? "" : d)}
                >
                  {dosage === d && <Check className="w-3 h-3 mr-0.5" />}
                  {d}
                </Badge>
              ))}
            </div>
            <Input
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="或输入其他剂量..."
              className="bg-muted/50 border-0 text-sm h-9"
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="flex-1 h-10 text-sm"
          >
            跳过
          </Button>
          <Button
            onClick={handleSave}
            disabled={!brand.trim()}
            className="flex-1 h-10 text-sm bg-terracotta hover:bg-terracotta/90 text-white"
          >
            <Pill className="w-3.5 h-3.5 mr-1.5" />
            保存详情
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
