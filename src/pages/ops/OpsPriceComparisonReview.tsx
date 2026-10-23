import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Scale } from 'lucide-react';
import {
  listPendingExternalListings,
  platformLabel,
  reviewExternalListing,
  type ExternalListingRecord,
} from '../../lib/priceComparison';

/**
 * Ops verifies host-submitted other-platform links by opening them.
 * Only verified rows (checked in the last 30 days) reach guests.
 */
export default function OpsPriceComparisonReview({ titleById }: { titleById: Record<string, string> }) {
  const [rows, setRows] = useState<ExternalListingRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await listPendingExternalListings());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (row: ExternalListingRecord, decision: 'verified' | 'rejected') => {
    let note: string | undefined;
    if (decision === 'rejected') {
      note = window.prompt('Reason shown to the host (e.g. "Link is a different property", "Price differs"):') ?? undefined;
      if (note === undefined) return;
    }
    setBusyId(row.id);
    setError(null);
    const result = await reviewExternalListing(row.id, decision, note);
    setBusyId(null);
    if (!result.ok) setError(result.error ?? 'Review failed');
    await load();
  };

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
        <Scale className="w-5 h-5 text-emerald-600" />
        Price comparison checks
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Open each link. Verify only if it is the same property and the nightly price matches what the host entered
        (including fees if marked).
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No links waiting for review.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {titleById[row.property_id] ?? row.property_id} · {platformLabel(row.platform)} · ₹
                  {Math.round(row.nightly_price).toLocaleString('en-IN')}/night{row.includes_fees ? ' incl. fees' : ' before fees'}
                </p>
                <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-xs text-emerald-800 underline">
                  {row.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={busyId === row.id} onClick={() => void decide(row, 'verified')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                  Verify
                </button>
                <button type="button" disabled={busyId === row.id} onClick={() => void decide(row, 'rejected')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
