import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, GitCompareArrows, Mail, Pencil, SlidersHorizontal } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import ProductAreaTabs, { type ProductArea } from '@/components/navigation/ProductAreaTabs';

type Note = { id: string; body: string; visitDate?: string | null; author?: { name?: string } };
type Property = { id: string; address: string; price?: number | null; hoa?: number | null; score?: number | null; hasVeto?: boolean; notes?: Note[] };
type Contributor = { id: string; name: string; email: string; role: string; avatar?: string | null };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const estimatedMonthly = (property: Property, rate: number) => {
  const principal = (property.price ?? 0) * 0.8;
  if (!principal) return 0;
  const monthlyRate = rate / 100 / 12;
  const mortgage = monthlyRate ? principal * monthlyRate * (1 + monthlyRate) ** 360 / ((1 + monthlyRate) ** 360 - 1) : principal / 360;
  const taxesAndInsurance = (property.price ?? 0) * 0.0155 / 12;
  return mortgage + taxesAndInsurance + (property.hoa ?? 0);
};

export default function WorkspaceHub({ properties, contributors, rate, selectedIds, onSelect, activeArea, onAreaChange }: {
  properties: Property[];
  contributors: Contributor[];
  rate: number;
  selectedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  activeArea: ProductArea;
  onAreaChange: (area: ProductArea) => void;
}) {
  const queryClient = useQueryClient();
  const [comfort, setComfort] = useState(4500);
  const [tourPropertyId, setTourPropertyId] = useState('');
  const [tourDate, setTourDate] = useState('');
  const [tourTime, setTourTime] = useState('10:00');
  const [tourNote, setTourNote] = useState('');
  const selected = properties.filter(property => selectedIds.has(property.id));
  const ranked = [...properties].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const tours = useMemo(() => properties.flatMap(property => (property.notes ?? [])
    .filter(note => note.visitDate)
    .map(note => ({ ...note, property })))
    .sort((a, b) => new Date(a.visitDate!).getTime() - new Date(b.visitDate!).getTime()), [properties]);

  const scheduleTour = useMutation({
    mutationFn: () => api.post(`/properties/${tourPropertyId}/notes`, {
      body: tourNote.trim() || 'Scheduled home tour',
      visitDate: `${tourDate}T${tourTime}:00`,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setTourDate('');
      setTourNote('');
    },
  });

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#121520]/78 shadow-glass backdrop-blur-xl" aria-labelledby="workspace-heading">
      <div className="flex flex-col gap-2 border-b border-foreground/10 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-7">
        <div><p className="hearth-eyebrow text-champagne">Shared workspace</p><h2 id="workspace-heading" className="mt-2 font-sans text-3xl font-semibold tracking-[-0.035em]">One home-buying rhythm</h2></div>
        <p className="max-w-md text-xs leading-5 text-muted-foreground">Decide, model, tour, and coordinate without losing context between tools.</p>
      </div>
      <Tabs value={activeArea} onValueChange={value => onAreaChange(value as ProductArea)}>
        <div className="border-b border-white/[0.07] bg-black/15 p-2 sm:p-3">
          <ProductAreaTabs active={activeArea} onSelect={onAreaChange} />
        </div>

        <TabsContent value="decisions" className="m-0 p-5 md:p-7">
          <div className="grid gap-7 lg:grid-cols-[1.25fr_.75fr]">
            <div><div className="mb-4 flex items-center justify-between"><div><h3 className="font-serif text-2xl">Shared ranking</h3><p className="mt-1 text-xs text-muted-foreground">Select 2–4 homes to compare side by side.</p></div><span className="text-xs uppercase tracking-wider text-muted-foreground">{selected.length} selected</span></div>
              <div className="space-y-2">{ranked.slice(0, 4).map((property, index) => <div key={property.id} className={`flex items-center gap-3 border p-3 transition ${selectedIds.has(property.id) ? 'border-primary bg-primary/5' : 'border-foreground/10 hover:border-primary/35'}`}><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-4"><input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedIds.has(property.id)} disabled={!selectedIds.has(property.id) && selectedIds.size >= 4} onChange={event => onSelect(property.id, event.target.checked)} /><span className="text-xs text-muted-foreground">0{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{property.address}</span>{property.hasVeto ? <span className="text-[0.6rem] font-semibold uppercase text-red-300">Needs review</span> : <strong className="text-sm text-primary">{property.score == null ? 'Pending' : `${Math.round(property.score)}%`}</strong>}</label><Button variant="ghost" size="sm" asChild><Link to={`/property/${property.id}#scoring`}><Pencil className="mr-1 h-3.5 w-3.5" /> Review &amp; score</Link></Button></div>)}</div>
            </div>
            <div className="flex flex-col justify-between border border-foreground/10 bg-accent/35 p-5"><div><SlidersHorizontal className="h-5 w-5 text-primary" /><h3 className="mt-4 font-serif text-2xl">Make priorities explicit</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Weight commute, condition, layout, and your own dealbreakers before revealing the shared result.</p></div><div className="mt-6 grid gap-2"><Button variant="outline" asChild><Link to="/checklist">Edit criteria &amp; weights</Link></Button><Button disabled={selected.length < 2} asChild={selected.length >= 2}>{selected.length >= 2 ? <Link to={`/compare?ids=${selected.map(property => property.id).join(',')}`}><GitCompareArrows className="mr-2 h-4 w-4" /> Compare selected</Link> : <span>Select at least two homes</span>}</Button></div></div>
          </div>
        </TabsContent>

        <TabsContent value="financials" className="m-0 p-5 md:p-7">
          <div className="grid gap-7 lg:grid-cols-[.7fr_1.3fr]">
            <div className="border border-foreground/10 bg-accent/35 p-5"><p className="eyebrow">Shared comfort zone</p><p className="mt-3 font-serif text-4xl text-primary">{money.format(comfort)}<span className="text-base text-muted-foreground"> / mo</span></p><input aria-label="Comfortable monthly payment" type="range" min="1500" max="10000" step="100" value={comfort} onChange={event => setComfort(Number(event.target.value))} className="mt-6 w-full accent-primary" /><div className="mt-2 flex justify-between text-[0.6rem] text-muted-foreground"><span>$1,500</span><span>$10,000</span></div><p className="mt-5 text-xs leading-5 text-muted-foreground">Uses 20% down, a 30-year term, estimated taxes and insurance, plus listed HOA. Explore a home for detailed scenarios.</p></div>
            <div><div className="mb-4 flex items-center justify-between"><div><h3 className="font-serif text-2xl">Shortlist reality check</h3><p className="mt-1 text-xs text-muted-foreground">Illustrative at {rate.toFixed(3)}%.</p></div></div><div className="space-y-2">{ranked.slice(0, 4).map(property => { const monthly = estimatedMonthly(property, rate); const within = monthly > 0 && monthly <= comfort; return <Link key={property.id} to={`/property/${property.id}`} className="flex items-center gap-4 border border-foreground/10 p-4 transition hover:border-primary/40"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{property.address}</span><span className="mt-1 block text-xs text-muted-foreground">{money.format(property.price ?? 0)} purchase</span></span><span className="text-right"><strong className="block text-sm">{monthly ? `${money.format(monthly)}/mo` : 'Add price'}</strong>{monthly > 0 && <span className={`text-[0.6rem] font-medium uppercase ${within ? 'text-emerald-700' : 'text-amber-700'}`}>{within ? 'In range' : 'Above range'}</span>}</span></Link>; })}</div></div>
          </div>
        </TabsContent>

        <TabsContent value="tours" className="m-0 p-5 md:p-7">
          <div className="grid gap-7 lg:grid-cols-[.85fr_1.15fr]">
            <form className="border border-foreground/10 bg-accent/35 p-5" onSubmit={event => { event.preventDefault(); scheduleTour.mutate(); }}><CalendarDays className="h-5 w-5 text-primary" /><h3 className="mt-4 font-serif text-2xl">Schedule a tour</h3><p className="mt-2 text-xs text-muted-foreground">Attach a visit to a home so everyone sees the plan and notes.</p><div className="mt-5 space-y-3"><label className="block text-xs font-medium">Home<select className="mt-1.5 h-10 w-full border border-input bg-background px-3 text-sm" value={tourPropertyId} onChange={event => setTourPropertyId(event.target.value)} required><option value="">Choose a home</option>{properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Date<Input className="mt-1.5" type="date" value={tourDate} onChange={event => setTourDate(event.target.value)} required /></label><label className="text-xs font-medium">Time<Input className="mt-1.5" type="time" value={tourTime} onChange={event => setTourTime(event.target.value)} required /></label></div><label className="block text-xs font-medium">Shared note<Input className="mt-1.5" value={tourNote} onChange={event => setTourNote(event.target.value)} placeholder="Agent joining, check workshop…" /></label><Button className="w-full" type="submit" disabled={!tourPropertyId || !tourDate || scheduleTour.isPending}>{scheduleTour.isPending ? 'Adding to timeline…' : 'Add to tour timeline'}</Button>{scheduleTour.isSuccess && <p className="text-xs text-emerald-700">Tour added for everyone.</p>}{scheduleTour.isError && <p className="text-xs text-red-600">Tour could not be added. Please try again.</p>}</div></form>
            <div><h3 className="font-serif text-2xl">Tour timeline</h3><p className="mt-1 text-xs text-muted-foreground">All scheduled visits across this search.</p><div className="mt-4 space-y-2">{tours.length ? tours.map(tour => { const date = new Date(tour.visitDate!); return <Link key={tour.id} to={`/property/${tour.property.id}`} className="flex gap-4 border border-foreground/10 p-4 transition hover:border-primary/40"><div className="w-12 text-center"><span className="block text-[0.6rem] uppercase tracking-wider text-muted-foreground">{date.toLocaleDateString(undefined, { month: 'short' })}</span><strong className="font-serif text-2xl">{date.getDate()}</strong></div><span className="w-px bg-foreground/10" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{tour.property.address}</p><p className="mt-1 truncate text-xs text-muted-foreground">{tour.body}</p></div><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></Link>; }) : <div className="border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">No tours scheduled yet. Add the first visit to your shared timeline.</div>}</div></div>
          </div>
        </TabsContent>

        <TabsContent value="team" className="m-0 p-5 md:p-7">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{contributors.map(contributor => <div key={contributor.id} className="flex items-center gap-4 border border-foreground/10 p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-xl text-primary">{contributor.name.charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{contributor.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{contributor.email}</p></div><span className="text-[0.55rem] font-medium uppercase tracking-wider text-primary">{contributor.role.replace('_', ' ')}</span></div>)}<button type="button" onClick={() => document.getElementById('invite-team')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="flex min-h-20 items-center justify-center gap-2 border border-dashed border-primary/30 p-4 text-sm font-medium text-primary transition hover:bg-primary/5"><Mail className="h-4 w-4" /> Invite someone you trust</button></div>
        </TabsContent>
      </Tabs>
    </section>
  );
}