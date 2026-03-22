import { useState, useEffect, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number; // ms
  className?: string;
}

/**
 * AnimatedNumber — smoothly animates between number values.
 * When the value changes, it counts up/down over the specified duration.
 * Also briefly flashes a color indicator: green for increase, red for decrease.
 */
export default function AnimatedNumber({
  value,
  duration = 400,
  className = "",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flashClass, setFlashClass] = useState("");
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const prevValue = prevValueRef.current;
    prevValueRef.current = value;

    // Skip animation on initial mount
    if (prevValue === value) return;

    // Determine direction for flash color
    const isIncrease = value > prevValue;
    setFlashClass(
      isIncrease
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400"
    );

    // Animate from prevValue to value
    const startTime = performance.now();
    const startVal = prevValue;
    const endVal = value;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Clear flash after animation completes
        setTimeout(() => setFlashClass(""), 300);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span
      className={`transition-colors duration-300 ${flashClass} ${className}`}
      data-testid="animated-number"
    >
      {displayValue}
    </span>
  );
}
