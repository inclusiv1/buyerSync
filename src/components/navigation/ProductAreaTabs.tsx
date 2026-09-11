import { CalendarDays, CheckCircle2, CircleDollarSign, Users } from 'lucide-react';
import type { ComponentType } from 'react';

export type ProductArea = 'decisions' | 'financials' | 'tours' | 'team';

const productAreas: Array<{
  id: ProductArea;
  label: string;
  number: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'decisions', label: 'Decisions', number: '01', description: 'Rank and compare', icon: CheckCircle2 },
  { id: 'financials', label: 'Financials', number: '02', description: 'Model the monthly', icon: CircleDollarSign },
  { id: 'tours', label: 'Tours', number: '03', description: 'Plan every visit', icon: CalendarDays },
  { id: 'team', label: 'Your team', number: '04', description: 'Keep everyone close', icon: Users },
];

export default function ProductAreaTabs({ active, onSelect, compact = false, className = '' }: {
  active: ProductArea;
  onSelect: (area: ProductArea) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-1 sm:grid-cols-4 ${className}`} role="tablist" aria-label="Home-buying workspace areas">
      {productAreas.map(area => {
        const Icon = area.icon;
        const selected = active === area.id;
        return (
          <button
            key={area.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(area.id)}
            className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 text-left transition duration-300 ${compact ? 'min-h-11 py-2' : 'min-h-[4.5rem] py-3'} ${selected ? 'border-champagne/30 bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_12px_35px_-24px_rgba(216,197,143,.7)]' : 'border-transparent text-white/38 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/70'}`}
          >
            <span className={`grid shrink-0 place-items-center rounded-lg transition ${compact ? 'h-7 w-7' : 'h-9 w-9'} ${selected ? 'bg-champagne/12 text-champagne' : 'bg-white/[0.04] text-white/35 group-hover:text-white/60'}`}>
              <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.13em] sm:text-[0.68rem]">{area.label}</span>
              {!compact && <span className="mt-1 hidden text-[0.55rem] text-white/28 lg:block">{area.number} · {area.description}</span>}
            </span>
            {selected && <span className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-champagne to-transparent" />}
          </button>
        );
      })}
    </div>
  );
}