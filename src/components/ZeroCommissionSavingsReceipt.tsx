import { useEffect } from 'react';
import { pickExternalListingForDisplay, formatInr } from '../lib/externalListingProof';
import { trackXpressEvent } from '../lib/analytics';
import type { Json } from '../lib/database.types';

type Props = { estimatedTotal?: number; compact?: boolean; externalListings?: Json | null };
export default function ZeroCommissionSavingsReceipt({ estimatedTotal, compact = false, externalListings }: Props) {
  const external = pickExternalListingForDisplay(externalListings);
  useEffect(() => { trackXpressEvent('price_comparison_unavailable', { action: 'equivalent_total_unavailable' }); }, []);
  return <section className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-3.5' : 'p-5'} space-y-3 text-left`} aria-label="Price transparency">
    <h4 className="text-sm font-bold text-xpx-text">Price transparency</h4>
    <p className="text-sm text-xpx-text">Accommodation estimate: {estimatedTotal != null && estimatedTotal > 0 ? formatInr(estimatedTotal) : 'Pending'}</p>
    <p className="text-xs text-xpx-muted">The final payable total, taxes, mandatory charges, deposit and advance are not yet confirmed. Request the complete written terms from the host before paying.</p>
    <p className="text-xs text-xpx-muted">Equivalent competitor totals for your dates, guest count, room and mandatory charges are unavailable. We cannot establish savings.</p>
    {external && <div className="rounded-xl border border-slate-200 p-3 space-y-2">
      <p className="text-xs font-semibold">{external.platform} — host-entered reference, not a live comparable quote</p>
      <p className="text-xs text-xpx-muted">Entered price: {formatInr(external.listedPrice)}. {external.lastChecked ? `Host-reported check time: ${external.lastChecked}.` : 'Check time not supplied.'} Dates, occupancy and included charges have not been verified.</p>
      <a className="text-xs font-semibold underline" href={external.url} target="_blank" rel="noopener noreferrer nofollow sponsored">Open source listing</a>
    </div>}
    <p className="text-xs text-xpx-muted">Submitting an inquiry or receiving a host response does not confirm a reservation or payment.</p>
  </section>;
}
