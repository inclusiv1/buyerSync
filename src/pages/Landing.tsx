import { motion, useMotionTemplate, useMotionValue, type Variants } from 'framer-motion';
import { ArrowRight, CalendarDays, Check, ChevronRight, CircleDollarSign, FileText, Heart, MessageSquareText, Play, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { type MouseEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import InteractiveListingPreview from '@/components/marketing/InteractiveListingPreview';
import ProductTour from '@/components/marketing/ProductTour';
import { useThemeStore } from '@/store/useThemeStore';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.2, 0.8, 0.2, 1] } },
};

const SpotlightCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(420px circle at ${x}px ${y}px, rgba(199, 179, 125, 0.12), transparent 70%)`;

  const trackPointer = (event: MouseEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - bounds.left);
    y.set(event.clientY - bounds.top);
  };

  return <motion.article onMouseMove={trackPointer} style={{ backgroundImage: background }} className={`hearth-card group ${className}`}>{children}</motion.article>;
};

const Landing = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  const theme = useThemeStore(state => state.theme);

  return (
    <div className="hearth-page min-h-screen overflow-hidden font-sans text-foreground">
      <div className="hearth-grid pointer-events-none fixed inset-0 z-0 opacity-40" />
      <header className="fixed inset-x-0 top-4 z-50 px-4">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-foreground/10 bg-background/85 px-4 shadow-glass backdrop-blur-2xl sm:px-6">
          <Link to="/" aria-label="Home Buyer Sync home" className="group flex items-center">
            <BrandLogo variant={theme === 'dark' ? 'on-dark' : 'default'} className="h-11 w-auto transition group-hover:scale-[1.02]" />
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-medium text-muted-foreground md:flex" aria-label="Primary navigation">
            <a href="#platform" className="transition hover:text-white">How it works</a>
            <a href="#live-demo" className="transition hover:text-white">Live demo</a>
            <a href="#security" className="transition hover:text-white">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="mr-2 hidden items-center sm:flex" aria-label="Three co-buyers active now">
              <div className="flex -space-x-2">
                {['D', 'M', 'A'].map((name, index) => <span key={name} className={`grid h-7 w-7 place-items-center rounded-full border-2 border-background text-[0.55rem] font-bold ${index === 0 ? 'bg-violet-500 text-white' : index === 1 ? 'bg-cyan-400 text-black' : 'bg-emerald-400 text-black'}`}>{name}</span>)}
              </div>
              <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            </div>
            <Link to="/login" className="hidden px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:block">Sign in</Link>
            <Link to="/signup" className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[#090a0f] transition hover:bg-champagne">Start syncing</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="relative pb-24 pt-36 sm:pt-44 lg:min-h-[58rem] lg:pb-32">
          <div className="hearth-orb hearth-orb-gold" />
          <div className="hearth-orb hearth-orb-violet" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="relative z-10 max-w-2xl">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/[0.08] px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-emerald-200 backdrop-blur-xl">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>
                Live multiplayer house hunting
              </motion.div>
              <motion.h1 variants={fadeUp} className="mt-7 max-w-3xl font-sans text-[3.4rem] font-semibold leading-[0.94] tracking-[-0.065em] sm:text-7xl lg:text-[5.4rem]">
                Find home,<br /><span className="metallic-text">in sync.</span>
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-7 max-w-xl text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
                The shared operating system for co-buyers. Align wishlists, budgets, notes, tours, and your trusted team—without the spreadsheet spiral.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className="shimmer-button group flex items-center justify-center gap-2 rounded-xl bg-champagne px-5 py-3.5 text-sm font-semibold text-[#11100d] shadow-gold-glow">
                  Create your shared space <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
                <button onClick={() => setDemoOpen(true)} className="flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.035] px-5 py-3.5 text-sm font-semibold text-white/75 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10"><Play className="ml-0.5 h-3 w-3 fill-current" /></span> Watch 90-sec demo
                </button>
              </motion.div>
              <motion.div variants={fadeUp} className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[0.68rem] text-white/35">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Free shared workspace</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Private by default</span>
              </motion.div>
            </motion.div>
            <div className="relative lg:translate-x-8 lg:rotate-[1.5deg]">
              <div className="absolute -inset-16 -z-10 bg-[radial-gradient(circle,rgba(124,92,255,0.17),transparent_65%)] blur-2xl" />
              <InteractiveListingPreview />
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/[0.07] px-5 sm:px-8 lg:grid-cols-4">
            {[['$1.2B+', 'shared homes coordinated'], ['14 days', 'saved per closing'], ['92%', 'faster shortlist alignment'], ['4.9/5', 'from buying teams']].map(([value, label]) => (
              <div key={label} className="px-4 py-8 text-center sm:py-10"><p className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">{value}</p><p className="mt-2 text-[0.58rem] uppercase tracking-[0.17em] text-white/30">{label}</p></div>
            ))}
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={fadeUp} className="max-w-2xl">
            <p className="hearth-eyebrow">One journey · one source of truth</p>
            <h2 className="mt-5 font-sans text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">From first save<br />to <span className="text-white/35">“this is the one.”</span></h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/40">Every step feeds the next: shared decisions shape your shortlist, financials keep it grounded, tours capture what you learn, and your team stays current.</p>
          </motion.div>

          <div className="mt-14 grid gap-4 lg:grid-cols-2">
            <SpotlightCard className="min-h-[28rem] p-6 sm:p-8">
              <div className="flex items-start justify-between"><div><p className="hearth-eyebrow">01 · Decisions</p><h3 className="mt-3 font-sans text-2xl font-semibold">Real-time dual ranking</h3><p className="mt-3 max-w-md text-sm leading-6 text-white/40">Score independently, reveal together, and turn two perspectives into one confident shortlist.</p></div><Users className="h-5 w-5 text-violet-300" /></div>
              <div className="relative mt-9 grid grid-cols-3 gap-3">
                {['Ridge House', 'Willow Bend', 'Cedar Studio'].map((home, index) => <motion.div whileHover={{ y: -6 }} key={home} className={`relative overflow-hidden rounded-2xl border p-2 ${index === 0 ? 'border-emerald-300/30 bg-emerald-400/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}><div className={`h-28 rounded-xl bg-cover bg-center grayscale-[15%] ${index === 0 ? 'feature-home-one' : index === 1 ? 'feature-home-two' : 'feature-home-three'}`} /><p className="mt-3 truncate text-xs font-medium">{home}</p><div className="mt-2 flex items-center justify-between"><div className="flex -space-x-1.5"><span className="h-5 w-5 rounded-full border-2 border-[#121520] bg-violet-500" /><span className="h-5 w-5 rounded-full border-2 border-[#121520] bg-cyan-400" /></div><Heart className={`h-3.5 w-3.5 ${index === 0 ? 'fill-emerald-300 text-emerald-300' : 'text-white/25'}`} /></div>{index === 0 && <span className="absolute right-3 top-3 rounded-full bg-emerald-300 px-2 py-1 text-[0.45rem] font-bold uppercase tracking-wider text-[#06110d]">Top pick</span>}</motion.div>)}
              </div>
            </SpotlightCard>

            <SpotlightCard className="min-h-[28rem] p-6 sm:p-8">
              <div className="flex items-start justify-between"><div><p className="hearth-eyebrow">02 · Financials</p><h3 className="mt-3 font-sans text-2xl font-semibold">Shared financial clarity</h3><p className="mt-3 max-w-md text-sm leading-6 text-white/40">See the monthly reality together—from pre-approval and split to HOA and comfort zone.</p></div><CircleDollarSign className="h-5 w-5 text-emerald-300" /></div>
              <div className="mt-9 rounded-2xl border border-white/10 bg-black/15 p-5"><div className="flex items-end justify-between"><div><p className="text-[0.58rem] uppercase tracking-[0.18em] text-white/30">Comfortable monthly</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">$4,280</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[0.58rem] font-semibold text-emerald-300">In sync</span></div><div className="mt-8 h-1.5 rounded-full bg-white/10"><motion.div initial={{ width: 0 }} whileInView={{ width: '72%' }} viewport={{ once: true }} transition={{ duration: 1 }} className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_18px_rgba(52,211,153,0.4)]"><span className="absolute -right-2 -top-1.5 h-4 w-4 rounded-full border-4 border-[#18201f] bg-emerald-200" /></motion.div></div><div className="mt-6 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-sm font-medium">58%</p><p className="mt-1 text-[0.52rem] text-white/30">Dave</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-sm font-medium">42%</p><p className="mt-1 text-[0.52rem] text-white/30">Marlene</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-sm font-medium">$386</p><p className="mt-1 text-[0.52rem] text-white/30">HOA + fees</p></div></div></div>
            </SpotlightCard>

            <SpotlightCard className="p-6 sm:p-8">
              <div className="flex items-start justify-between"><div><p className="hearth-eyebrow">03 · Tours</p><h3 className="mt-3 font-sans text-2xl font-semibold">One timeline, zero crossed wires</h3></div><CalendarDays className="h-5 w-5 text-cyan-300" /></div>
              <div className="mt-8 space-y-2">{[['09:30', 'Ridge House', '12 min drive'], ['11:15', 'Cedar Studio', 'Agent confirmed'], ['14:00', 'Willow Bend', 'Add to Saturday']].map(([time, title, meta], index) => <div key={title} className={`flex items-center gap-4 rounded-xl border p-3 ${index === 0 ? 'border-cyan-300/20 bg-cyan-400/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'}`}><span className="font-mono text-[0.6rem] text-white/35">{time}</span><span className="h-7 w-px bg-white/10" /><div className="flex-1"><p className="text-xs font-medium">{title}</p><p className="mt-1 text-[0.55rem] text-white/30">{meta}</p></div><ChevronRight className="h-3.5 w-3.5 text-white/20" /></div>)}</div>
            </SpotlightCard>

            <SpotlightCard className="p-6 sm:p-8">
              <div className="flex items-start justify-between"><div><p className="hearth-eyebrow">04 · Your team</p><h3 className="mt-3 font-sans text-2xl font-semibold">Agent and lender, in the loop</h3></div><MessageSquareText className="h-5 w-5 text-champagne" /></div>
              <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-champagne to-amber-700 text-xs font-bold text-black">AR</span><div><p className="text-xs font-medium">Alex Rivera · Agent</p><p className="mt-0.5 text-[0.55rem] text-emerald-300">Online now</p></div></div><p className="mt-4 rounded-xl bg-white/[0.045] p-3 text-xs leading-5 text-white/50">I added the disclosures and inspection window. Both of you can review before Saturday.</p><div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.07] p-3"><FileText className="h-4 w-4 text-violet-300" /><div className="flex-1"><p className="text-[0.65rem] font-medium">Ridge_House_Disclosures.pdf</p><p className="mt-0.5 text-[0.5rem] text-white/25">2.4 MB · Shared with everyone</p></div><Check className="h-3.5 w-3.5 text-emerald-300" /></div></div>
            </SpotlightCard>
          </div>
        </section>

        <section id="live-demo" className="relative border-y border-foreground/10 bg-card py-24 lg:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(52,211,153,0.07),transparent_45%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr]">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={fadeUp}>
              <p className="hearth-eyebrow text-emerald-300">Try the sync</p>
              <h2 className="mt-5 font-sans text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">Feel the moment<br />you both agree.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/40">Upvote the listing or flag a concern. Home Buyer Sync turns every signal into shared context—instantly, without a side text thread.</p>
              <div className="mt-8 space-y-3 text-xs text-white/50"><p className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-violet-300" /> Presence and reactions in real time</p><p className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Private votes until everyone is ready</p><p className="flex items-center gap-3"><MessageSquareText className="h-4 w-4 text-cyan-300" /> Concerns flow straight into tour notes</p></div>
            </motion.div>
            <InteractiveListingPreview compact />
          </div>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-5 py-24 text-center sm:px-8 lg:py-32">
          <ShieldCheck className="mx-auto h-7 w-7 text-champagne" />
          <p className="hearth-eyebrow mt-6">Built around your trust</p>
          <h2 className="mx-auto mt-5 max-w-3xl font-sans text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-6xl">A calmer way to make<br /><span className="metallic-text">a life-changing choice.</span></h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/40">Your ratings, finances, and conversations remain yours. Invite only the people you trust, control what they see, and move forward together.</p>
          <Link to="/signup" className="shimmer-button group mx-auto mt-9 inline-flex items-center gap-2 rounded-xl bg-champagne px-6 py-4 text-sm font-semibold text-[#11100d] shadow-gold-glow">Start your shared search <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>
        </section>
      </main>

      {demoOpen && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/85 p-3 backdrop-blur-xl sm:p-6" role="dialog" aria-modal="true" aria-label="Home Buyer Sync 90-second product tour"><button onClick={() => setDemoOpen(false)} className="absolute inset-0 cursor-default" aria-label="Close demo" /><motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative my-auto w-full max-w-5xl"><ProductTour onClose={() => setDemoOpen(false)} /></motion.div></div>}
    </div>
  );
};

export default Landing;