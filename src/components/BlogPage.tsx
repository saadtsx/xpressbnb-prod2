import TelAvivEditorialFrame from './editorial/TelAvivEditorialFrame';
import { navigateTo } from '../lib/navigation';

interface BlogPageProps {
  onClose: () => void;
}

const FEATURED = {
  kicker: 'Field note',
  title: 'How an inquiry-first stay feels in Delhi NCR',
  dek: 'Dates, a name, a number — then a host who actually answers. No cart. No guest commission.',
  href: '/stays/delhi',
};

const STORIES = [
  {
    kicker: 'Rishikesh',
    title: 'Ganges mornings, private evenings',
    dek: 'Short stays above the river — still inquiry, still zero guest fee.',
    href: '/stays/rishikesh',
  },
  {
    kicker: 'Hosts',
    title: 'Why the listing is software, not a tax on guests',
    dek: 'Hosts pay for the desk. Guests send a request.',
    href: '/?page=about',
  },
  {
    kicker: 'Cities',
    title: 'Noida, Gurgaon, the ridge — one map',
    dek: 'We only publish markets we operate.',
    href: '/explore',
  },
];

export default function BlogPage({ onClose }: BlogPageProps) {
  return (
    <TelAvivEditorialFrame kicker="The Journal" onClose={onClose}>
      <section>
        <div
          className="relative h-[42vh] min-h-[260px] sm:h-[52vh] sm:min-h-[360px]"
          style={{ background: '#3d5348' }}
        >
          <img
            src="/images/editorial/journal-hero.png?v=2"
            alt="Mediterranean rooftop light"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="xpx-container py-10 sm:py-14" style={{ background: '#FAFAF8' }}>
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-emerald-800">
            The Journal
          </p>
          <h1 className="mt-3 max-w-3xl text-[2.15rem] sm:text-5xl lg:text-[3.35rem] font-semibold tracking-tight leading-[1.1] text-xpx-text">
            Notes from the white city of short stays.
          </h1>
        </div>
      </section>

      <section className="xpx-container py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:gap-14">
          <article>
            <button
              type="button"
              onClick={() => navigateTo(FEATURED.href)}
              className="group block w-full text-left"
            >
              <div className="overflow-hidden rounded-sm aspect-[16/10]">
                <img
                  src="/images/editorial/about-hero.png"
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <p className="mt-5 text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-700">
                {FEATURED.kicker}
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                {FEATURED.title}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-xpx-muted">{FEATURED.dek}</p>
            </button>
          </article>

          <div className="flex flex-col divide-y divide-black/10 border-y border-black/10">
            {STORIES.map((story) => (
              <button
                key={story.title}
                type="button"
                onClick={() => navigateTo(story.href)}
                className="py-6 text-left hover:opacity-80"
              >
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-xpx-subtle">
                  {story.kicker}
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{story.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-xpx-muted">{story.dek}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-16 border-t border-black/10 pt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-xpx-muted max-w-md">
            The journal is short on purpose. When you are ready, send an inquiry — not a cart.
          </p>
          <button
            type="button"
            onClick={() => navigateTo('/explore')}
            className="inline-flex min-h-12 items-center rounded-full px-6 text-sm font-semibold text-white"
            style={{ background: '#059669' }}
          >
            Browse stays
          </button>
        </div>
      </section>
    </TelAvivEditorialFrame>
  );
}
