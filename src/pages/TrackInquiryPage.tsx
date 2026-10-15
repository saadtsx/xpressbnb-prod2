import InquiryHostContactCard from '../components/inquiry/success/InquiryHostContactCard';
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import SEOHead from '../components/SEOHead';
import CustomerReferenceField from '../components/inquiry/CustomerReferenceField';
import InquiryStatusTimeline from '../components/inquiry/InquiryStatusTimeline';
import InquiryTermsSummary from '../components/inquiry/InquiryTermsSummary';
import { inquiryTrackStatusLabel, trackInquiryByReference, type InquiryTrackResult } from '../lib/inquirySubmit';
import { notificationStatusLabel } from '../lib/inquiryJourney';
import { updateGuestInquiryFromTrack } from '../lib/guestTrustStorage';
import { loadInquirySuccessSnapshot } from '../lib/inquirySuccessStorage';
import { navigateTo } from '../lib/navigation';

function initialLookup() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get('ref')?.trim().toUpperCase() ?? '';
  const email = params.get('email')?.trim() || loadInquirySuccessSnapshot(reference)?.guestEmail || '';
  return { reference, email };
}

export default function TrackInquiryPage() {
  const [initial] = useState(initialLookup);
  const [reference, setReference] = useState(initial.reference);
  const [email, setEmail] = useState(initial.email);
  const [lookup, setLookup] = useState(initial.reference && initial.email ? initial : null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InquiryTrackResult | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('email')) {
      url.searchParams.delete('email');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, []);

  useEffect(() => {
    if (!lookup) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await trackInquiryByReference(lookup.reference, lookup.email);
        if (cancelled) return;
        if (!response.ok) throw new Error('Lookup failed');
        setResult(response.result);
        updateGuestInquiryFromTrack(response.result);
        setCheckedAt(new Date().toLocaleTimeString('en-IN'));
        setError(null);
      } catch {
        if (!cancelled) setError('Could not refresh. Check your connection, reference and email. Any result below is from the last successful check.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [lookup, refresh]);

  useEffect(() => {
    const reload = () => { if (document.visibilityState === 'visible') setRefresh(n => n + 1); };
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    document.addEventListener('visibilitychange', reload);
    const timer = window.setInterval(reload, 30000);
    return () => {
      window.removeEventListener('focus', reload);
      window.removeEventListener('online', reload);
      document.removeEventListener('visibilitychange', reload);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--xpx-page, #F8FAFC)' }}>
      <SEOHead config={{ title: 'Track your inquiry | XpressBNB', robots: 'noindex, nofollow', description: 'Check the latest recorded response to your inquiry.' }} />
      <Header onAboutClick={() => navigateTo('/?page=about')} onBlogClick={() => navigateTo('/?page=blog')} onHostLoginClick={() => navigateTo('/auth/login')} />
      <main className="max-w-xl mx-auto px-4 py-8 pb-28 space-y-5">
        <h1 className="text-2xl font-extrabold text-xpx-text">Track inquiry</h1>
        <p className="text-sm text-xpx-muted">Use your inquiry reference and email. No account is needed. Status refreshes when you return or reconnect.</p>
        <form className="rounded-2xl border bg-white p-5 space-y-4" onSubmit={event => {
          event.preventDefault();
          setResult(null); setCheckedAt(null); setError(null);
          setLookup({ reference: reference.trim().toUpperCase(), email: email.trim() });
        }}>
          <label className="block text-sm font-semibold">Customer reference<input className="xpx-input mt-2" value={reference} onChange={e => setReference(e.target.value.toUpperCase())} required autoComplete="off" maxLength={80} /></label>
          <label className="block text-sm font-semibold">Email<input className="xpx-input mt-2" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" maxLength={254} /></label>
          <button className="w-full rounded-xl bg-emerald-700 text-white font-bold p-3 disabled:opacity-50" disabled={loading} type="submit">{loading ? 'Checking…' : 'View latest status'}</button>
        </form>
        {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        {result && <div className="space-y-4">
          <CustomerReferenceField reference={result.customerReference} />
          <section className="rounded-2xl border bg-white p-5 space-y-4">
            <h2 className="font-bold text-xpx-text" aria-live="polite">{inquiryTrackStatusLabel(result.displayStatus)}</h2>
            <p className="text-xs text-xpx-muted">Last checked {checkedAt}. This inquiry is not a final booking confirmation.</p>
            <InquiryStatusTimeline variant="track" displayStatus={result.displayStatus} />
            {result.hostDecisionNote && <p className="text-sm"><strong>Host response:</strong> {result.hostDecisionNote}</p>}
            <p className="text-sm text-xpx-muted">{notificationStatusLabel(result.notificationStatus)}</p>
          </section>
          <p className="text-sm">Requested stay: {result.checkInDate} to {result.checkOutDate ?? 'pending'}{result.numGuests != null ? ` · ${result.numGuests} guests` : ''}</p>
          <InquiryTermsSummary terms={result.terms} />
          {result.hostContact && <InquiryHostContactCard hostName={result.hostContact.name} hostPhoneDigits={result.hostContact.phone} propertyTitle={result.terms?.property_title ?? 'Requested property'} />}

          <section className="rounded-2xl border bg-white p-5 text-sm space-y-2">
            <h2 className="font-bold">Xpress Score: verified facts first</h2>
            <p>{result.reviewedAt ? 'An operations review is recorded for this inquiry.' : 'Operations review is pending.'} This is not identity verification or a safety guarantee.</p>
            <p>A numerical trust score and verified-stay reviews are unavailable until completed stays can be reliably verified.</p>
            <a className="font-semibold underline" href="mailto:support@xpressbnb.com">Report a problem or challenge an inaccurate record</a>
          </section>
        </div>}
      </main>
    </div>
  );
}
