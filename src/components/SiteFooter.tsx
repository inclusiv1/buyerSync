import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { useThemeStore } from '@/store/useThemeStore';

const SiteFooter = () => {
  const isDark = useThemeStore(state => state.theme === 'dark');

  return (
    <footer className="relative z-10 border-t border-foreground/10 bg-background text-foreground" aria-label="Site footer">
      <div className="editorial-container flex flex-col gap-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <BrandLogo variant={isDark ? 'on-dark' : 'default'} className={`${isDark ? 'h-11' : 'mb-2 h-16'} w-auto self-start`} />
          <span>&copy; {new Date().getFullYear()} Home Buyer Sync. All rights reserved.</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal and account links">
          <Link to="/disclaimer" className="transition hover:text-foreground">Disclaimer &amp; Privacy</Link>
          <Link to="/login" className="transition hover:text-foreground">Sign in</Link>
          <Link to="/advertise/signup" className="transition hover:text-foreground">Advertise</Link>
        </nav>
      </div>
    </footer>
  );
};

export default SiteFooter;