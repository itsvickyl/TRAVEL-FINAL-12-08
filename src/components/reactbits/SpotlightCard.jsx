import { useRef, useCallback } from 'react';

/**
 * ReactBits-inspired SpotlightCard.
 * Tracks mouse position and renders a radial gradient spotlight on hover.
 */
export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(93, 173, 226, 0.15)',
  ...props
}) {
  const cardRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--spot-x', `${x}px`);
    card.style.setProperty('--spot-y', `${y}px`);
  }, []);

  return (
    <>
      <style>{`
        .spotlight-card {
          position: relative;
          overflow: hidden;
        }
        .spotlight-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(
            350px circle at var(--spot-x, 50%) var(--spot-y, 50%),
            ${spotlightColor},
            transparent 70%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          z-index: 0;
        }
        .spotlight-card:hover::before {
          opacity: 1;
        }
        .spotlight-card > * {
          position: relative;
          z-index: 1;
        }
      `}</style>
      <div
        ref={cardRef}
        className={`spotlight-card ${className}`}
        onMouseMove={handleMouseMove}
        {...props}
      >
        {children}
      </div>
    </>
  );
}
