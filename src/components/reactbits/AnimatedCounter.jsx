import { useEffect, useRef, useState } from 'react';

/**
 * ReactBits-inspired AnimatedCounter.
 * Smoothly animates from 0 (or previous value) to target value.
 */
export default function AnimatedCounter({
  value = 0,
  duration = 1200,
  decimals = 0,
  className = '',
  prefix = '',
  suffix = '',
}) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}
