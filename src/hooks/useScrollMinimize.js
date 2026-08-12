import { useState, useEffect } from 'react';

export function useScrollMinimize(threshold = 50) {
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let lastY = 0;
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          setMinimized(currentY > threshold && currentY > lastY);
          lastY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return minimized;
}
