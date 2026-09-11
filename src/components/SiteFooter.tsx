import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { useAuthStore } from '@/store/useAuthStore';

const SiteFooter = () => {
  const { pathname } = useLocation();
  const { token } = useAuthStore();
  const isPublicLanding = pathname === '/' && !token;
  const isDark = isPublicLanding || Boolean(token) || pathname === '/login' || pathname === '/signup' || pathname.startsWith('/invite/');

  return (
    <footer className={isDark ? 'relative z-10 border-t border-white/[0.07] bg-[#090a0f] text-white' : 'border-t border-foreground/10 bg-background'} aria-label="Site footer">
      <div className={`editorial-container flex flex-col gap-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between ${isDark ? 'text-white/35' : 'text-muted-foreground'}`}>
        <div className="flex flex-col gap-2">
          <BrandLogo variant={isDark ? 'on-dark' : 'default'} className={`${isDark ? 'h-11' : 'mb-2 h-16'} w-auto self-start`} />
          <span>&copy; {new Date().getFullYear()} Home Buyer Sync. All rights reserved.</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal and account links">
          <Link to="/disclaimer" className={isDark ? 'transition hover:text-white' : 'transition hover:text-foreground'}>Disclaimer &amp; Privacy</Link>
          <Link to="/login" className={isDark ? 'transition hover:text-white' : 'transition hover:text-foreground'}>Sign in</Link>
          <Link to="/advertise/signup" className={isDark ? 'transition hover:text-white' : 'transition hover:text-foreground'}>Advertise</Link>
        </nav>
      </div>
    </footer>
  );
};

export default SiteFooter;