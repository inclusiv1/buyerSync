import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Check, Heart, MessageSquareText, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ProductAreaTabs, { type ProductArea } from '@/components/navigation/ProductAreaTabs';

const DURATION = 90;
const chapters = [
  { start: 0, end: 22, label: 'Decisions' },
  { start: 22, end: 45, label: 'Financials' },
  { start: 45, end: 67, label: 'Tours' },
  { start: 67, end: 90, label: 'Your team' },
] as const;

const homes = [
  { name: 'Ridge House', score: 96, status: 'Top pick', image: 'feature-home-one' },
  { name: 'Willow Bend', score: 87, status: 'Aligned', image: 'feature-home-two' },
  { name: 'Cedar Studio', score: 74, status: 'Review', image: 'feature-home-three' },
];

const Scene = ({ chapter, elapsed }: { chapter: number; elapsed: number }) => {
  if (chapter === 0) return (
    <div className="grid h-full gap-4 p-5 sm:grid-cols-[0.75fr_1.25fr] sm:p-8">
      <div className="flex flex-col justify-center">
        <p className="hearth-eyebrow text-violet-300">01 · Decisions</p>
        <h3 className="mt-3 font-sans text-3xl font-semibold sm:text-5xl">Two opinions.<br /><span className="text-white/35">One clear choice.</span></h3>
        <p className="mt-4 max-w-sm text-xs leading-5 text-white/45 sm:text-sm">Rate privately, reveal together, and see where your priorities naturally align.</p>
      </div>
      <div className="flex flex-col justify-center gap-2">
        {homes.map((home, index) => (
          <motion.div key={home.name} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.12 }} className={`flex items-center gap-3 rounded-2xl border p-2.5 ${index === 0 && elapsed > 8 ? 'border-emerald-300/35 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.035]'}`}>
            <div className={`h-14 w-20 shrink-0 rounded-xl bg-cover bg-center ${home.image}`} />
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold sm:text-sm">{home.name}</p><p className="mt-1 text-[0.55rem] uppercase tracking-wider text-white/30">{home.status}</p></div>
            <div className="text-right"><motion.p key={elapsed > 8 ? home.score : '--'} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-xl font-semibold text-emerald-300">{elapsed > 8 ? `${home.score}%` : '—'}</motion.p><div className="mt-1 flex -space-x-1"><span className="h-4 w-4 rounded-full border border-[#121520] bg-violet-500" /><span className="h-4 w-4 rounded-full border border-[#121520] bg-cyan-400" /></div></div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  if (chapter === 1) return (
    <div className="grid h-full gap-4 p-5 sm:grid-cols-[0.8fr_1.2fr] sm:p-8">
      <div className="flex flex-col justify-center"><p className="hearth-eyebrow text-emerald-300">02 · Financials</p><h3 className="mt-3 font-sans text-3xl font-semibold sm:text-5xl">Know the monthly<br /><span className="text-white/35">before the maybe.</span></h3><p className="mt-4 text-xs leading-5 text-white/45 sm:text-sm">Price, down payment, HOA, and shared comfort—all in one honest view.</p></div>
      <div className="my-auto rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-7">
        <div className="flex items-end justify-between"><div><p className="text-[0.55rem] uppercase tracking-[0.2em] text-white/30">Estimated monthly</p><p className="mt-2 text-3xl font-semibold sm:text-5xl">$4,280</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[0.6rem] font-semibold text-emerald-300">Within range</span></div>
        <div className="mt-7 h-2 rounded-full bg-white/10"><motion.div initial={{ width: '18%' }} animate={{ width: elapsed > 31 ? '72%' : '42%' }} transition={{ duration: 1.2 }} className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_18px_rgba(52,211,153,.4)]" /></div>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">{[['$710k', 'Purchase'], ['$142k', 'Down'], ['$386', 'HOA + fees']].map(([value, label]) => <div key={label} className="rounded-xl bg-white/[0.04] p-3"><p className="text-sm font-semibold">{value}</p><p className="mt-1 text-[0.5rem] uppercase tracking-wider text-white/30">{label}</p></div>)}</div>
      </div>
    </div>
  );

  if (chapter === 2) return (
    <div className="grid h-full gap-4 p-5 sm:grid-cols-[0.72fr_1.28fr] sm:p-8">
      <div className="flex flex-col justify-center"><p className="hearth-eyebrow text-cyan-300">03 · Tours</p><h3 className="mt-3 font-sans text-3xl font-semibold sm:text-5xl">One Saturday.<br /><span className="text-white/35">Zero crossed wires.</span></h3><p className="mt-4 text-xs leading-5 text-white/45 sm:text-sm">Turn shortlisted homes into a shared tour plan with context attached.</p></div>
      <div className="my-auto space-y-2">
        {[
          ['09:30', 'Ridge House', 'Confirmed · Alex joining'],
          ['11:15', 'Cedar Studio', '12 min drive · Bring checklist'],
          ['14:00', 'Willow Bend', 'Awaiting confirmation'],
        ].map(([time, title, meta], index) => <motion.div key={title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.14 }} className={`flex items-center gap-4 rounded-2xl border p-4 ${index === 0 && elapsed > 53 ? 'border-cyan-300/30 bg-cyan-400/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}><span className="font-mono text-xs text-cyan-200">{time}</span><span className="h-9 w-px bg-white/10" /><div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-[0.55rem] text-white/35">{meta}</p></div>{index < 2 ? <Check className="h-4 w-4 text-emerald-300" /> : <CalendarDays className="h-4 w-4 text-white/25" />}</motion.div>)}
      </div>
    </div>
  );

  return (
    <div className="grid h-full gap-4 p-5 sm:grid-cols-[0.72fr_1.28fr] sm:p-8">
      <div className="flex flex-col justify-center"><p className="hearth-eyebrow text-champagne">04 · Your team</p><h3 className="mt-3 font-sans text-3xl font-semibold sm:text-5xl">Everyone informed.<br /><span className="text-white/35">Nothing scattered.</span></h3><p className="mt-4 text-xs leading-5 text-white/45 sm:text-sm">Buyers, agent, and lender move from the same source of truth.</p></div>
      <div className="my-auto rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-champagne to-amber-700 text-xs font-bold text-black">AR</span><div><p className="text-sm font-semibold">Alex Rivera · Agent</p><p className="text-[0.55rem] text-emerald-300">Online now</p></div><div className="ml-auto flex -space-x-2"><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#151824] bg-violet-500 text-[0.5rem] font-bold">D</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#151824] bg-cyan-400 text-[0.5rem] font-bold text-black">M</span></div></div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: elapsed > 75 ? 1 : 0.35, y: 0 }} className="mt-5 rounded-2xl bg-white/[0.05] p-4 text-xs leading-5 text-white/55">I added the disclosures and confirmed Saturday at 9:30. You both have the latest details.</motion.div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.08] p-3"><MessageSquareText className="h-4 w-4 text-violet-300" /><div className="flex-1"><p className="text-xs font-medium">Ridge House workspace</p><p className="mt-1 text-[0.5rem] text-white/30">3 people · Everything up to date</p></div><Check className="h-4 w-4 text-emerald-300" /></div>
      </div>
    </div>
  );
};

export default function ProductTour({ onClose }: { onClose?: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const previousTime = useRef<number | null>(null);
  const chapter = useMemo(() => chapters.reduce((current, item, index) => elapsed >= item.start ? index : current, 0), [elapsed]);

  useEffect(() => {
    let frame = 0;
    const tick = (time: number) => {
      if (previousTime.current !== null && playing) setElapsed(current => Math.min(DURATION, current + (time - previousTime.current!) / 1000));
      previousTime.current = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => { if (elapsed >= DURATION) setPlaying(false); }, [elapsed]);

  const seek = (value: number) => { setElapsed(Math.max(0, Math.min(DURATION, value))); previousTime.current = null; };

  return (
    <div className="theme-dark-surface overflow-hidden rounded-3xl border border-white/15 bg-[#0d1018] shadow-2xl">
      <div className="flex h-12 items-center border-b border-white/[0.08] px-4">
        <BrandMark /><div className="mx-auto flex items-center gap-2 text-[0.58rem] uppercase tracking-[0.18em] text-white/35"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> 90-second product tour</div>
        {onClose && <button type="button" onClick={onClose} className="rounded-full p-2 text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Close product tour"><X className="h-4 w-4" /></button>}
      </div>
      <div className="relative aspect-video min-h-[24rem] sm:min-h-0">
        <AnimatePresence mode="wait"><motion.div key={chapter} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.01 }} transition={{ duration: 0.45 }} className="absolute inset-0"><Scene chapter={chapter} elapsed={elapsed} /></motion.div></AnimatePresence>
      </div>
      <div className="border-t border-white/[0.08] bg-black/20 px-4 pb-4 pt-3 sm:px-5">
        <ProductAreaTabs compact active={(['decisions', 'financials', 'tours', 'team'] as ProductArea[])[chapter]} onSelect={area => { const index = ['decisions', 'financials', 'tours', 'team'].indexOf(area); seek(chapters[index].start); setPlaying(true); }} className="mb-3" />
        <input aria-label="Product tour progress" className="h-1 w-full cursor-pointer accent-[#d8c58f]" type="range" min="0" max={DURATION} step="0.1" value={elapsed} onChange={event => seek(Number(event.target.value))} />
        <div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-1"><button type="button" className="rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white" onClick={() => elapsed >= DURATION ? (seek(0), setPlaying(true)) : setPlaying(value => !value)} aria-label={playing ? 'Pause product tour' : 'Play product tour'}>{elapsed >= DURATION ? <RotateCcw className="h-4 w-4" /> : playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}</button><span className="font-mono text-[0.6rem] text-white/35">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')} / 1:30</span></div><span className="text-[0.55rem] text-white/30">Choose any chapter to explore</span></div>
      </div>
    </div>
  );
}

const BrandMark = () => <div className="flex items-center gap-2 text-[0.65rem] font-semibold"><span className="grid h-6 w-6 place-items-center rounded-lg bg-champagne/10 text-champagne"><Heart className="h-3 w-3 fill-current" /></span><span className="hidden sm:inline">Home Buyer Sync</span></div>;