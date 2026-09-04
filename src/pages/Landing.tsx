import { ArrowRight, Check, Heart, Home, MessageCircle, Scale, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const benefits = [
  {
    icon: Search,
    title: 'Every home in one place',
    copy: 'Create searches for each area you love, collect promising homes, and keep the details easy to revisit.',
  },
  {
    icon: Users,
    title: 'Decide with your people',
    copy: 'Invite your partner, family, or agent so everyone can contribute without losing the thread.',
  },
  {
    icon: Scale,
    title: 'Compare what matters',
    copy: 'Score homes independently, see where you agree, and compare the trade-offs side by side.',
  },
  {
    icon: Heart,
    title: 'Move forward together',
    copy: 'Turn scattered opinions into a shared shortlist and a decision everyone understands.',
  },
];

const steps = [
  ['01', 'Start a free search', 'Create an account and name a search for a neighborhood, city, or new chapter.'],
  ['02', 'Bring homes together', 'Save each property with its photos, facts, notes, and the details that caught your eye.'],
  ['03', 'Invite your team', 'Add the people buying with you and include your real estate agent when you are ready.'],
  ['04', 'Score and compare', 'Review homes separately, discover shared favorites, and choose with confidence.'],
];

const Landing = () => (
  <div className="landing-page min-h-screen overflow-hidden bg-background">
    <header className="absolute inset-x-0 top-0 z-30 border-b border-white/20 text-white">
      <div className="editorial-container flex h-20 items-center justify-between">
        <Link to="/" className="font-serif text-3xl font-medium">Buyer Sync</Link>
        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Account navigation">
          <Link to="/login" className="hidden text-xs font-medium uppercase tracking-[0.16em] text-white/85 transition hover:text-white sm:block">Sign in</Link>
          <Button asChild size="sm" className="bg-white text-foreground hover:bg-primary hover:text-white">
            <Link to="/signup">Start for free <ArrowRight /></Link>
          </Button>
        </nav>
      </div>
    </header>

    <main>
      <section className="landing-hero flex min-h-[46rem] items-end text-white md:min-h-screen">
        <div className="editorial-container pb-16 pt-36 md:pb-24">
          <div className="max-w-3xl">
            <p className="mb-5 flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.28em] text-white/75"><Home className="h-4 w-4" /> A calmer way to buy a home</p>
            <h1 className="font-serif text-6xl font-medium leading-[0.87] tracking-[-0.045em] sm:text-7xl md:text-[6.8rem]">Find the place<br /><em>you both love.</em></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/82 md:text-lg">Buyer Sync brings listings, notes, scores, and the people you trust into one thoughtful home search—from the first favorite to the front-door keys.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="bg-white text-foreground hover:bg-primary hover:text-white"><Link to="/signup">Create your free account <ArrowRight /></Link></Button>
              <a href="#how-it-works" className="border-b border-white/60 pb-1 text-xs font-medium uppercase tracking-[0.16em] transition hover:border-white">See how it works</a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-white/70"><Check className="h-3.5 w-3.5" /> 100% free—no plans, subscriptions, credit card, or surprise charges.</p>
          </div>
        </div>
      </section>

      <section className="editorial-container py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="eyebrow">Why Buyer Sync</p>
            <h2 className="mt-4 font-serif text-5xl leading-[0.95] md:text-6xl">A shared place for a life-changing choice.</h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">Home buying gets complicated when links, reactions, and priorities live in different places. Buyer Sync keeps the whole conversation together.</p>
          </div>
          <div className="grid border-l border-t border-foreground/10 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="border-b border-r border-foreground/10 p-7 md:p-9">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-8 font-serif text-3xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-foreground text-background">
        <div className="grid lg:grid-cols-2">
          <div className="landing-agent-image min-h-[32rem] lg:min-h-[52rem]" role="img" aria-label="A couple talking through their home search with a real estate professional" />
          <div className="flex items-center px-6 py-20 sm:px-12 lg:px-16 xl:px-24">
            <div className="w-full max-w-xl">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.26em] text-background/55">How it works</p>
              <h2 className="mt-4 font-serif text-5xl leading-[0.94] md:text-6xl">From “what about this one?” to “this is the one.”</h2>
              <div className="mt-10 divide-y divide-background/15 border-y border-background/15">
                {steps.map(([number, title, copy]) => (
                  <article key={number} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5">
                    <span className="pt-1 text-xs text-background/45">{number}</span>
                    <div><h3 className="font-serif text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-background/60">{copy}</p></div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="editorial-container py-20 md:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div className="grid grid-cols-2 gap-3">
            <div className="landing-moving-image min-h-[29rem]" role="img" aria-label="A couple beginning life together in their new home" />
            <div className="landing-home-image mt-12 min-h-[29rem]" role="img" aria-label="A welcoming modern home ready for its new owners" />
          </div>
          <div>
            <MessageCircle className="h-6 w-6 text-primary" />
            <p className="eyebrow mt-8">Built for real conversations</p>
            <h2 className="mt-4 font-serif text-5xl leading-[0.95] md:text-6xl">Less tab chaos. More clarity.</h2>
            <p className="mt-6 text-sm leading-7 text-muted-foreground">Everyone gets room to form an honest opinion, then Buyer Sync makes the common ground visible. Keep your search organized, understand each other’s priorities, and spend more time imagining life in the right home.</p>
            <Button asChild size="lg" className="mt-8"><Link to="/signup">Start searching together <ArrowRight /></Link></Button>
          </div>
        </div>
      </section>

      <section className="landing-cta mx-5 mb-5 flex min-h-[32rem] items-center justify-center px-6 py-20 text-center text-white md:mx-10 md:mb-10">
        <div className="max-w-2xl">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.26em] text-white/65">Your next chapter</p>
          <h2 className="mt-4 font-serif text-5xl leading-[0.94] sm:text-6xl">The right home is better when you find it together.</h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-white/75">Create your completely free Buyer Sync account and turn your home search into one shared, confident decision. There is nothing to purchase after signup.</p>
          <Button asChild size="lg" className="mt-8 bg-white text-foreground hover:bg-primary hover:text-white"><Link to="/signup">Sign up free <ArrowRight /></Link></Button>
        </div>
      </section>
    </main>

  </div>
);

export default Landing;