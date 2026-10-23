import { useCallback, useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Link2, Trash2 } from 'lucide-react';
import {
  EXTERNAL_PLATFORMS,
  invalidatePriceComparisons,
  listExternalListings,
  platformLabel,
  removeExternalListing,
  submitExternalListing,
  type ExternalListingRecord,
  type ExternalPlatform,
} from '../../lib/priceComparison';

const STATUS_COPY: Record<ExternalListingRecord['status'], { label: string; className: string }> = {
  pending: { label: 'Waiting for XpressBnB check', className: 'bg-amber-100 text-amber-900' },
  verified: { label: 'Verified — shown to guests', className: 'bg-emerald-100 text-emerald-900' },
  rejected: { label: 'Not verified', className: 'bg-slate-100 text-slate-700' },
};

/**
 * Host adds the same property's links on other platforms. Nothing is shown to
 * guests until operations open the link and verify it; any edit re-enters review.
 */
export default function ExternalListingsManager({ propertyId }: { propertyId: string }) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ExternalListingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState<ExternalPlatform>('airbnb');
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');
  const [includesFees, setIncludesFees] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listExternalListings(propertyId));
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const nightly = Number(price);
    if (!Number.isFinite(nightly) || nightly <= 0) {
      setMessage({ kind: 'err', text: 'Enter the nightly price shown on that platform.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await submitExternalListing({ propertyId, platform, url, nightlyPrice: nightly, includesFees });
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: 'err', text: result.error });
      return;
    }
    setUrl('');
    setPrice('');
    setIncludesFees(false);
    setMessage({ kind: 'ok', text: 'Saved. Our team will check the link before guests see it.' });
    invalidatePriceComparisons(propertyId);
    await load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const ok = await removeExternalListing(id);
    setBusy(false);
    if (ok) {
      invalidatePriceComparisons(propertyId);
      await load();
    } else {
      setMessage({ kind: 'err', text: 'Could not remove the link. Try again.' });
    }
  };

  const example = EXTERNAL_PLATFORMS.find((p) => p.id === platform)?.example ?? 'https://…';

  return (
    <div className="mt-4 pt-4 xpx-divider">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={formId}
        className="w-full min-h-[44px] flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-xpx-text">
          <Link2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          Listed on Airbnb or other sites?
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-xpx-muted" /> : <ChevronDown className="w-4 h-4 text-xpx-muted" />}
      </button>

      {open && (
        <div id={formId} className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="text-xpx-muted">
            Add this same property&apos;s link on another platform and the nightly price shown there. After our team
            checks it, guests see the comparison on your listing. Only add links to this exact property.
          </p>

          {loading ? (
            <p className="text-xpx-muted">Loading…</p>
          ) : rows.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-xpx-text">
                      {platformLabel(row.platform)} · ₹{Math.round(row.nightly_price).toLocaleString('en-IN')}/night
                      {row.includes_fees ? ' incl. fees' : ''}
                    </p>
                    <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-emerald-800 underline break-all">
                      {row.url}
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COPY[row.status].className}`}>
                      {STATUS_COPY[row.status].label}
                    </span>
                    {row.status === 'rejected' && row.review_note && (
                      <p className="mt-1 text-xs text-xpx-muted">Reason: {row.review_note}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(row.id)}
                    disabled={busy}
                    aria-label={`Remove ${platformLabel(row.platform)} link`}
                    className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-lg text-xpx-muted hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xpx-muted">No other-platform links added yet.</p>
          )}

          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <label className="block text-xs font-semibold text-xpx-text">
                Platform
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as ExternalPlatform)}
                  className="xpx-input mt-1"
                >
                  {EXTERNAL_PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-xpx-text">
                Link to this property
                <input
                  type="url"
                  required
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={example}
                  maxLength={600}
                  className="xpx-input mt-1"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
              <label className="block text-xs font-semibold text-xpx-text">
                Price per night there (₹)
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="xpx-input mt-1"
                />
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-xpx-text">
                <input
                  type="checkbox"
                  checked={includesFees}
                  onChange={(e) => setIncludesFees(e.target.checked)}
                  className="h-5 w-5 accent-emerald-700"
                />
                This price includes that platform&apos;s service fees
              </label>
            </div>
            {message && (
              <p role={message.kind === 'err' ? 'alert' : 'status'} className={message.kind === 'err' ? 'text-red-700' : 'text-emerald-800'}>
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save link for review'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
