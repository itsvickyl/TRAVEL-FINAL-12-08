import { useEffect, useCallback } from 'react';

/**
 * ReactBits-inspired ClickSpark effect.
 * Spawns particle sparks at click position anywhere on the page.
 */
export default function ClickSpark({ sparkCount = 8, colors = ['#5dade2', '#34d399', '#f59e0b', '#f5f7fa'] }) {
  const createSpark = useCallback((x, y) => {
    const container = document.createElement('div');
    container.className = 'click-spark';
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;

    for (let i = 0; i < sparkCount; i++) {
      const spark = document.createElement('div');
      spark.className = 'spark';
      const angle = (360 / sparkCount) * i + Math.random() * 30;
      const distance = 20 + Math.random() * 40;
      const tx = Math.cos((angle * Math.PI) / 180) * distance;
      const ty = Math.sin((angle * Math.PI) / 180) * distance;
      spark.style.setProperty('--tx', `${tx}px`);
      spark.style.setProperty('--ty', `${ty}px`);
      spark.style.background = colors[i % colors.length];
      spark.style.width = `${3 + Math.random() * 3}px`;
      spark.style.height = spark.style.width;
      container.appendChild(spark);
    }

    document.body.appendChild(container);
    setTimeout(() => container.remove(), 700);
  }, [sparkCount, colors]);

  useEffect(() => {
    const handler = (e) => createSpark(e.clientX, e.clientY);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [createSpark]);

  return null;
}
