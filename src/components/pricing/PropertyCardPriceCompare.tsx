import { comparePrices, formatCheckedDate, platformLabel, usePriceComparisons } from '../../lib/priceComparison';

/**
 * One-line, ops-verified comparison on a property card. Renders nothing unless a
 * verified comparison from the last 30 days exists (cards look exactly as before).
 */
export default function PropertyCardPriceCompare({
  propertyId,
  ourNightly,
}: {
  propertyId: string;
  ourNightly: number;
}) {
  const rows = usePriceComparisons(propertyId);
  if (!rows || rows.length === 0) return null;

  // Prefer the like-for-like comparison with the largest genuine saving; else the first.
  const ranked = rows
    .map((row) => ({ row, ...comparePrices(ourNightly, row) }))
    .sort((a, b) => (b.savingsPerNight ?? -1) - (a.savingsPerNight ?? -1));
  const best = ranked[0];
  const label = platformLabel(best.row.platform);

  return (
    <p
      className="mx-4 -mt-1 mb-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] leading-snug text-emerald-900"
      title={`${label} price checked by XpressBnB on ${formatCheckedDate(best.row.checkedAt)}. Prices change.`}
    >
      <span className="font-semibold">Also on {label}</span>
      {' · '}₹{Math.round(best.row.nightlyPrice).toLocaleString('en-IN')}/night there
      {best.savingsPerNight != null && (
        <span className="font-bold"> · ₹{best.savingsPerNight.toLocaleString('en-IN')} less here</span>
      )}
      <span className="text-emerald-800/80"> · checked {formatCheckedDate(best.row.checkedAt)}</span>
    </p>
  );
}
