import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('shotlab-theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
      return saved;
    }
  }
  document.documentElement.setAttribute('data-theme', 'dark');
  return 'dark';
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),

  toggleTheme: () =>
    set((state) => {
      const nextTheme: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('shotlab-theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      return { theme: nextTheme };
    }),

  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('shotlab-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));
