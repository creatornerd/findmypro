import { useEffect, useState } from 'react';

const THEME_KEY = 'findmypro_theme';

/* Reads the stored preference, falling back to the OS setting. */
export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved === 'dark';
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/* Shared across every route so /, /chat and /about stay in the same theme. */
export function useTheme() {
  const [darkMode, setDarkMode] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    root.style.colorScheme = darkMode ? 'dark' : 'light';

    // Keep the mobile browser chrome in step with the page.
    let tc = document.querySelector('meta[name="theme-color"]');
    if (!tc) {
      tc = document.createElement('meta');
      tc.setAttribute('name', 'theme-color');
      document.head.appendChild(tc);
    }
    tc.setAttribute('content', darkMode ? '#1a1917' : '#faf9f6');

    try { localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light'); }
    catch { /* storage unavailable */ }
  }, [darkMode]);

  return [darkMode, setDarkMode];
}
