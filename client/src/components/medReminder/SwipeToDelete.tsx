import { useState, useRef, useCallback } from "react";
import { Trash2 } from "lucide-react";

const DELETE_THRESHOLD = 80;

export default function SwipeToDelete({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [showDelete, setShowDelete] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = startXRef.current - e.touches[0].clientX;
    currentXRef.current = diff;
    if (diff > 0) {
      setOffset(Math.min(diff, DELETE_THRESHOLD));
    } else {
      setOffset(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (currentXRef.current >= DELETE_THRESHOLD) {
      setOffset(DELETE_THRESHOLD);
      setShowDelete(true);
    } else {
      setOffset(0);
      setShowDelete(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setOffset(0);
    setShowDelete(false);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl" ref={containerRef}>
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-white transition-all"
        style={{ width: `${DELETE_THRESHOLD}px`, opacity: offset / DELETE_THRESHOLD }}
      >
        <button
          onClick={() => {
            onDelete();
            handleReset();
          }}
          className="flex flex-col items-center gap-1 px-3"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-xs font-medium">删除</span>
        </button>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(-${offset}px)`,
          transition: currentXRef.current === 0 ? "transform 0.2s ease" : "none",
        }}
        className="relative bg-card"
      >
        {children}
      </div>
      {showDelete && (
        <div
          className="absolute inset-0"
          style={{ right: `${DELETE_THRESHOLD}px` }}
          onClick={handleReset}
        />
      )}
    </div>
  );
}
