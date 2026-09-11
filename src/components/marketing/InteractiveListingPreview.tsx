import { AnimatePresence, motion } from 'framer-motion';
import { Bath, BedDouble, Flag, Heart, MapPin, Maximize2, Sparkles } from 'lucide-react';
import { useState } from 'react';

type VoteState = 'idle' | 'upvoted' | 'concern';

type InteractiveListingPreviewProps = {
  compact?: boolean;
};

const statusCopy: Record<VoteState, { eyebrow: string; title: string; detail: string }> = {
  idle: {
    eyebrow: 'Live decision room',
    title: 'You’re both viewing',
    detail: 'Vote privately. Alignment appears when you’re ready.',
  },
  upvoted: {
    eyebrow: 'Top pick unlocked',
    title: 'You both love this one',
    detail: 'Marlene upvoted 12 seconds ago. Your wishlists are 98% aligned.',
  },
  concern: {
    eyebrow: 'Concern shared',
    title: 'Workshop size needs a look',
    detail: 'Added to your shared tour questions for Alex, your agent.',
  },
};

const InteractiveListingPreview = ({ compact = false }: InteractiveListingPreviewProps) => {
  const [vote, setVote] = useState<VoteState>('idle');
  const status = statusCopy[vote];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={`relative mx-auto w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#10131d]/90 shadow-[0_40px_120px_-35px_rgba(0,0,0,0.95)] backdrop-blur-2xl ${compact ? 'max-w-xl' : 'max-w-2xl'}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/50">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_14px_#34d399]" />
          Shortlist room · 2 active
        </div>
        <div className="flex -space-x-2" aria-label="Dave and Marlene are active">
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#10131d] bg-violet-500 text-[0.6rem] font-bold text-white">D</span>
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#10131d] bg-cyan-500 text-[0.6rem] font-bold text-[#061116]">M</span>
        </div>
      </div>

      <div className="relative m-2 overflow-hidden rounded-[1.3rem] sm:m-3">
        <img
          src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=90"
          alt="Mountain-modern home with warm wood details"
          className={`w-full object-cover ${compact ? 'h-56 sm:h-64' : 'h-64 sm:h-[22rem]'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-transparent to-black/10" />
        <div className="absolute left-4 top-4 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-emerald-200 backdrop-blur-xl">
          98% match for both
        </div>
        <motion.div animate={{ x: [0, 8, 2], y: [0, 5, 12] }} transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse' }} className="absolute right-[18%] top-[30%]">
          <div className="h-0 w-0 border-b-[14px] border-l-[7px] border-r-[7px] border-b-violet-400 border-l-transparent border-r-transparent -rotate-45" />
          <span className="mt-1 block rounded-full bg-violet-500 px-2 py-1 text-[0.55rem] font-semibold text-white shadow-lg">Dave</span>
        </motion.div>
        <motion.div animate={{ x: [0, -10, -4], y: [0, 8, 3] }} transition={{ duration: 4.5, repeat: Infinity, repeatType: 'reverse' }} className="absolute left-[22%] top-[48%]">
          <div className="h-0 w-0 border-b-[14px] border-l-[7px] border-r-[7px] border-b-cyan-300 border-l-transparent border-r-transparent -rotate-45" />
          <span className="mt-1 block rounded-full bg-cyan-300 px-2 py-1 text-[0.55rem] font-semibold text-[#061116] shadow-lg">Marlene</span>
        </motion.div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[0.62rem] text-white/75 backdrop-blur-lg">Loved the screened porch</span>
            <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[0.62rem] text-white/75 backdrop-blur-lg">Within budget</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">Asheville, North Carolina</p>
              <h3 className="mt-1 font-sans text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">The Ridge House</h3>
            </div>
            <p className="text-lg font-semibold text-champagne">$824,000</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
          <span className="flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" /> 3 beds</span>
          <span className="flex items-center gap-1.5"><Bath className="h-3.5 w-3.5" /> 2.5 baths</span>
          <span className="flex items-center gap-1.5"><Maximize2 className="h-3.5 w-3.5" /> 2,480 sq ft</span>
          <span className="ml-auto hidden items-center gap-1 text-emerald-300 sm:flex"><MapPin className="h-3.5 w-3.5" /> 8 min to downtown</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={vote} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="my-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
            <p className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-emerald-300"><Sparkles className="h-3 w-3" /> {status.eyebrow}</p>
            <p className="mt-1.5 text-sm font-medium text-white">{status.title}</p>
            <p className="mt-1 text-xs leading-5 text-white/45">{status.detail}</p>
          </motion.div>
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setVote(vote === 'upvoted' ? 'idle' : 'upvoted')} aria-pressed={vote === 'upvoted'} className={`group flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${vote === 'upvoted' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:bg-white/[0.08]'}`}>
            <Heart className={`h-4 w-4 transition group-hover:scale-110 ${vote === 'upvoted' ? 'fill-current' : ''}`} /> Upvote
          </button>
          <button onClick={() => setVote(vote === 'concern' ? 'idle' : 'concern')} aria-pressed={vote === 'concern'} className={`group flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${vote === 'concern' ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:bg-white/[0.08]'}`}>
            <Flag className={`h-4 w-4 transition group-hover:scale-110 ${vote === 'concern' ? 'fill-current' : ''}`} /> Flag concern
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default InteractiveListingPreview;