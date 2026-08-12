import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('lollyd_theme') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lollyd_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}
