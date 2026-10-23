import { ExternalLink, ShieldCheck } from 'lucide-react';
import { comparePrices, formatCheckedDate, platformLabel, usePriceComparisons } from '../../lib/priceComparison';

/**
 * Same-property comparison on the property page. Only ops-verified links checked
 * in the last 30 days are shown; nothing renders otherwise.
 */
export default function PropertyPriceComparisonPanel({
  propertyId,
  ourNightly,
}: {
  propertyId: string;
  ourNightly: number;
}) {
  const rows = usePriceComparisons(propertyId);
  if (!rows || rows.length === 0) return null;

  return (
    <section aria-labelledby="price-compare-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 id="price-compare-title" className="xpx-property-section-h2">Same stay, other platforms</h2>
      <p className="mt-1 text-sm text-xpx-muted">
        This exact property is also listed elsewhere. Our team opened each link and checked the price on the date shown.
      </p>

      <ul className="mt-4 divide-y divide-slate-200">
        <li className="flex items-center justify-between gap-3 py-3">
          <span className="font-bold text-xpx-text">XpressBnB</span>
          <span className="text-right">
            <span className="font-bold tabular-nums text-xpx-text">₹{Math.round(ourNightly).toLocaleString('en-IN')}</span>
            <span className="block text-xs text-xpx-muted">per night · 0% guest commission</span>
          </span>
        </li>
        {rows.map((row) => {
          const { savingsPerNight, likeForLike } = comparePrices(ourNightly, row);
          const label = platformLabel(row.platform);
          return (
            <li key={row.platform} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="font-semibold text-xpx-text">{label}</span>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-0.5 flex min-h-[32px] items-center gap-1 text-xs font-semibold text-emerald-800 underline"
                >
                  View this listing on {label}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </span>
              <span className="text-right">
                <span className="font-bold tabular-nums text-xpx-text">₹{Math.round(row.nightlyPrice).toLocaleString('en-IN')}</span>
                <span className="block text-xs text-xpx-muted">
                  per night · {likeForLike ? `incl. ${label} fees` : `before ${label} fees`} · checked {formatCheckedDate(row.checkedAt)}
                </span>
                {savingsPerNight != null && (
                  <span className="mt-0.5 block text-xs font-bold text-emerald-800">
                    ₹{savingsPerNight.toLocaleString('en-IN')} less per night here
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex gap-2 text-xs leading-relaxed text-xpx-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        Why it can differ: XpressBnB doesn&apos;t add a guest service fee and you deal with the host directly. Other
        platforms set their own fees and prices change, so check the latest price before you decide. Savings are only shown
        when the other price includes its fees.
      </p>
    </section>
  );
}
