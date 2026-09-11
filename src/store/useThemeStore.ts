import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const storedTheme = localStorage.getItem('home-buyer-sync-theme');
const initialTheme: Theme = storedTheme === 'dark' ? 'dark' : 'light';

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
};

applyTheme(initialTheme);

export const useThemeStore = create<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}>((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    localStorage.setItem('home-buyer-sync-theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),
}));