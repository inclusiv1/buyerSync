import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';

export default function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={floating
        ? 'fixed bottom-5 right-5 z-[60] flex h-11 items-center gap-2 rounded-full border border-foreground/15 bg-background/95 px-4 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        : 'flex w-full items-center justify-between rounded-xl border border-foreground/15 bg-background/60 p-3 text-sm transition hover:border-primary/60 hover:bg-accent'}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      <span className="flex items-center gap-2">
        {isLight ? <Sun className="h-4 w-4 text-amber-600" /> : <Moon className="h-4 w-4 text-indigo-300" />}
        {floating ? `${isLight ? 'Light' : 'Dark'} mode` : 'Appearance'}
      </span>
      {!floating && <span className="text-xs text-muted-foreground">{isLight ? 'Light' : 'Dark'}</span>}
    </button>
  );
}