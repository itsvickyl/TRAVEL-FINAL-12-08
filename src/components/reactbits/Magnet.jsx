import { useRef, useCallback } from 'react';

/**
 * ReactBits-inspired Magnet effect.
 * Element follows cursor position within a defined range on hover.
 */
export default function Magnet({
  children,
  strength = 0.3,
  className = '',
  ...props
}) {
  const ref = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = (e.clientX - centerX) * strength;
    const dy = (e.clientY - centerY) * strength;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  }, [strength]);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translate(0, 0)';
    el.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    setTimeout(() => {
      if (el) el.style.transition = '';
    }, 400);
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-block', willChange: 'transform' }}
      {...props}
    >
      {children}
    </div>
  );
}
