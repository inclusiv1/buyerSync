import { Link } from 'react-router-dom';

const SiteFooter = () => (
  <footer className="border-t border-foreground/10 bg-background" aria-label="Site footer">
    <div className="editorial-container flex flex-col gap-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-serif text-xl text-foreground">Buyer Sync</span>
        <span>&copy; {new Date().getFullYear()} Buyer Sync. All rights reserved.</span>
      </div>
      <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal and account links">
        <Link to="/disclaimer" className="transition hover:text-foreground">Disclaimer &amp; Privacy</Link>
        <Link to="/login" className="transition hover:text-foreground">Sign in</Link>
        <Link to="/advertise/signup" className="transition hover:text-foreground">Advertise</Link>
      </nav>
    </div>
  </footer>
);

export default SiteFooter;