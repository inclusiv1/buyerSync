import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import ProductAreaTabs, { type ProductArea } from '@/components/navigation/ProductAreaTabs';

export default function AuthLayout({ children, eyebrow, title, description, image }: {
  children: ReactNode;
  eyebrow: string;
  title: ReactNode;
  description: string;
  image: string;
}) {
  const [activeArea, setActiveArea] = useState<ProductArea>('decisions');

  return (
    <div className="client-theme hearth-page relative min-h-screen overflow-hidden bg-obsidian text-white">
      <div className="hearth-grid pointer-events-none fixed inset-0 opacity-35" />
      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/[0.08] lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-10 xl:p-14">
          <div className="absolute inset-0 bg-cover bg-center opacity-55" style={{ backgroundImage: `url('${image}')` }} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,10,15,.5),rgba(9,10,15,.94)_85%),linear-gradient(90deg,rgba(9,10,15,.25),rgba(9,10,15,.75))]" />
          <Link to="/" className="relative z-10 w-fit"><BrandLogo variant="on-dark" className="h-12 w-auto" /></Link>
          <div className="relative z-10 max-w-2xl pb-5">
            <p className="hearth-eyebrow text-champagne">{eyebrow}</p>
            <h1 className="mt-5 max-w-xl font-sans text-5xl font-semibold leading-[0.98] tracking-[-0.055em] xl:text-7xl">{title}</h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-white/52">{description}</p>
            <ProductAreaTabs active={activeArea} onSelect={setActiveArea} className="mt-9" />
          </div>
        </section>
        <section className="relative flex min-h-screen items-center justify-center px-5 pb-12 pt-28 sm:px-8 lg:px-12 lg:py-16">
          <div className="absolute left-5 right-5 top-5 flex items-center justify-between lg:hidden">
            <Link to="/"><BrandLogo variant="on-dark" className="h-11 w-auto" /></Link>
            <Link to="/" className="flex items-center gap-2 text-[0.62rem] uppercase tracking-widest text-white/40 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Home</Link>
          </div>
          <div className="hearth-orb hearth-orb-violet opacity-50" />
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#121520]/80 p-6 shadow-glass backdrop-blur-2xl sm:p-8">
            {children}
            <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/[0.07] pt-5 text-[0.58rem] uppercase tracking-[0.15em] text-white/25"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300/70" /> Private and secure by default</div>
          </div>
        </section>
      </div>
    </div>
  );
}