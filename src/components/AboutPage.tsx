import TelAvivEditorialFrame from './editorial/TelAvivEditorialFrame';
import { TEAM_EMAIL } from '../lib/team';
import { navigateTo } from '../lib/navigation';

interface AboutPageProps {
  onClose: () => void;
}

const PRINCIPLES = [
  {
    n: '01',
    title: 'Inquiry first',
    body: 'Guests send a request. Hosts reply. There is no instant checkout and no surprise platform fee on the guest side.',
  },
  {
    n: '02',
    title: 'Zero guest commission',
    body: 'The nightly rate you see is the host’s rate. XpressBnB is paid by hosts as software — not by taking a cut of your stay.',
  },
  {
    n: '03',
    title: 'Cities we actually cover',
    body: 'Delhi NCR and Rishikesh. Private, couple-friendly short stays with ops review on every inquiry.',
  },
];

const FAQS = [
  {
    q: 'Do I book and pay on the site?',
    a: 'No. You send an inquiry with dates and contact details. The host (or our line after review) responds. Payment is agreed after the stay is accepted — not as a guest checkout cart.',
  },
  {
    q: 'Is there a guest service fee?',
    a: 'No guest commission. Hosts pay for the SaaS listing. The price on the property is the host’s nightly rate.',
  },
  {
    q: 'Which cities do you list?',
    a: 'Delhi, Gurgaon, Noida, Greater Noida, Ghaziabad, and Rishikesh. We do not invent inventory outside those markets.',
  },
  {
    q: 'Are listings verified?',
    a: 'Premium listing badges mean the host has an active paid plan. Ops reviews inquiries. Always read house rules on the property page.',
  },
  {
    q: 'Can I install XpressBnB like an app?',
    a: 'Yes. Android Chrome → Install app. iPhone Safari → Share → Add to Home Screen. Laptop: the install icon in the address bar.',
  },
  {
    q: 'How do I reach support?',
    a: `Email ${TEAM_EMAIL}. We reply on inquiries and listing questions — we do not publish host phones on the public listing.`,
  },
];

export default function AboutPage({ onClose }: AboutPageProps) {
  return (
    <TelAvivEditorialFrame kicker="About" onClose={onClose}>
      <section>
        <div
          className="relative h-[42vh] min-h-[260px] sm:h-[52vh] sm:min-h-[360px]"
          style={{ background: '#8a8074' }}
        >
          <img
            src="/images/editorial/about-hero.png?v=2"
            alt="Tel Aviv White City façade"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="xpx-container py-10 sm:py-14" style={{ background: '#FAFAF8' }}>
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-emerald-800">About</p>
          <h1 className="mt-3 max-w-3xl text-[2.25rem] sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight leading-[1.1] text-xpx-text">
            Built for how people actually stay.
          </h1>
          <p className="mt-4 max-w-xl text-sm sm:text-base text-xpx-muted leading-relaxed">
            White-city calm. Marketplace honesty. Inquiry, then a human reply.
          </p>
        </div>
      </section>

      <section className="xpx-container py-16 sm:py-20">
        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          {PRINCIPLES.map((item) => (
            <article key={item.n} className="border-t border-black/10 pt-6">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-700">{item.n}</p>
              <h2 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-xpx-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="xpx-container pb-16 sm:pb-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-xpx-subtle">
              The house
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              A short-stay desk for Delhi NCR and the Ganges foothills.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-xpx-muted">
              XpressBnB is an inquiry-first marketplace. Guests browse real homes, pick dates, and send a
              request. Hosts run the listing. We review the queue. No invented amenities, no guest
              checkout tax, no hotel-lobby chrome.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('/explore')}
              className="mt-8 inline-flex min-h-12 items-center rounded-full px-6 text-sm font-semibold text-white"
              style={{ background: '#059669' }}
            >
              Explore stays
            </button>
          </div>
          <div className="overflow-hidden rounded-sm aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]">
            <img
              src="/images/editorial/about-hero.png?v=2"
              alt="White City architecture — reference for XpressBnB editorial"
              className="h-full w-full object-cover object-right"
            />
          </div>
        </div>
      </section>

      <section className="xpx-container pb-20">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Questions, answered simply</h2>
        <div className="mt-8 divide-y divide-black/10 border-y border-black/10">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="cursor-pointer list-none font-semibold text-[15px] sm:text-base">
                {faq.q}
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-xpx-muted">{faq.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-xpx-muted">
          More help:{' '}
          <a href={`mailto:${TEAM_EMAIL}`} className="font-semibold text-emerald-800 underline-offset-4 hover:underline">
            {TEAM_EMAIL}
          </a>
        </p>
      </section>
    </TelAvivEditorialFrame>
  );
}
