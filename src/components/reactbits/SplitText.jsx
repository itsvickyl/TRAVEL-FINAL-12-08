import { useEffect, useRef } from 'react';

/**
 * ReactBits-inspired SplitText animation.
 * Splits text into individual characters and animates them in sequence.
 */
export default function SplitText({
  text = '',
  className = '',
  delay = 30,
  direction = 'up',
  as: Tag = 'span',
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chars = el.querySelectorAll('.split-char');
    chars.forEach((char, i) => {
      char.style.animationDelay = `${i * delay}ms`;
      char.classList.add('split-animate');
    });
  }, [text, delay]);

  const translateDir = direction === 'up' ? '20px' : direction === 'down' ? '-20px' : '0';

  return (
    <>
      <style>{`
        .split-char {
          display: inline-block;
          opacity: 0;
          transform: translateY(${translateDir});
          will-change: transform, opacity;
        }
        .split-char.split-animate {
          animation: splitReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .split-char.space {
          width: 0.3em;
        }
        @keyframes splitReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <Tag ref={containerRef} className={className} aria-label={text}>
        {text.split('').map((char, i) => (
          <span
            key={i}
            className={`split-char${char === ' ' ? ' space' : ''}`}
            aria-hidden="true"
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </Tag>
    </>
  );
}
