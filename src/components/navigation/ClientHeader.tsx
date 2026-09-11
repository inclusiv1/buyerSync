import { ExternalLink, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import ProductAreaTabs, { type ProductArea } from '@/components/navigation/ProductAreaTabs';
import { Button } from '@/components/ui/button';
import { isTestMode } from '@/lib/authStorage';
import { useAuthStore } from '@/store/useAuthStore';

export default function ClientHeader({ active = 'decisions', onAreaSelect }: {
  active?: ProductArea;
  onAreaSelect?: (area: ProductArea) => void;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const selectArea = (area: ProductArea) => {
    if (onAreaSelect) onAreaSelect(area);
    else navigate(`/?area=${area}#workspace`);
  };

  return (
    <header className="client-nav sticky top-0 z-40 border-b border-white/[0.07] bg-[#090a0f]/88 backdrop-blur-2xl">
      <div className="editorial-container flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="Home Buyer Sync workspace" className="shrink-0">
          <BrandLogo variant="on-dark" className="h-10 w-auto sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 text-white/55">
          <span className="hidden text-[0.6rem] uppercase tracking-[0.14em] lg:inline">{user?.name}</span>
          {isTestMode && <Button variant="outline" size="sm" className="hidden border-white/15 text-white/65 hover:bg-white hover:text-black sm:flex" onClick={() => window.open('/login', '_blank', 'noopener,noreferrer')}><ExternalLink /> Another user</Button>}
          <button type="button" onClick={logout} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="editorial-container pb-2">
        <ProductAreaTabs active={active} onSelect={selectArea} compact />
      </div>
    </header>
  );
}