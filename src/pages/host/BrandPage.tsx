import { useCallback, useEffect, useState } from 'react';
import { Building2, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import BrandOnboardingFlow from '../../components/host/BrandOnboardingFlow';
import {
  HOST_BRAND_DESCRIPTION_MAX,
  HOST_BRAND_NAME_MAX,
  HOST_BRAND_SAVE_ERROR,
  listHostBrandPropertyIds,
  loadHostBrandState,
  saveHostBrandPropertyIds,
  upsertHostBrand,
  validateHostBrandInput,
  withPropertyLinked,
  withPropertyUnlinked,
  type HostBrandIdentity,
} from '../../lib/hostBrand';
import type { HostBrandListingOption } from '../../lib/hostBrandUi';
import { listPropertyImages, propertyCardImageUrl } from '../../lib/propertyImages';

type OwnedProperty = HostBrandListingOption & { isActive: boolean };

const card = {
  background: 'var(--xpx-surface)',
  border: '1px solid var(--xpx-border)',
} as const;

const inputStyle = { border: '1px solid var(--xpx-border-strong, #cbd5e1)' } as const;
const primaryStyle = { background: 'var(--xpx-warm, #50C878)' } as const;

export default function BrandPage() {
  const { host } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [brand, setBrand] = useState<HostBrandIdentity | null>(null);
  const [properties, setProperties] = useState<OwnedProperty[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  const hostId = host?.id;

  const load = useCallback(async () => {
    if (!hostId) return;
    setLoading(true);
    const [brandResult, propsResult] = await Promise.all([
      loadHostBrandState(hostId),
      supabase
        .from('properties')
        .select('id, title, city, images, is_active')
        .eq('host_id', hostId)
        .order('created_at', { ascending: false }),
    ]);
    const rows = propsResult.data ?? [];
    setProperties(
      rows.map((p) => {
        const cover = listPropertyImages(p.images)[0] ?? null;
        return {
          id: p.id,
          title: p.title || 'Untitled listing',
          city: p.city || '',
          coverUrl: cover ? propertyCardImageUrl(cover, 128) : null,
          isActive: p.is_active === true,
        };
      }),
    );
    setLoadError(brandResult.error || Boolean(propsResult.error));
    setBrand(brandResult.brand);
    setName(brandResult.brand?.businessName ?? '');
    setDescription(brandResult.brand?.businessDescription ?? '');
    setLinkedIds(brandResult.brand ? await listHostBrandPropertyIds(brandResult.brand.id) : []);
    setLoading(false);
  }, [hostId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hostId) return null;

  const saveIdentity = async () => {
    setNotice(null);
    const issues = validateHostBrandInput({ businessName: name, businessDescription: description });
    if (issues.length > 0) {
      setFieldError(issues[0].message);
      return;
    }
    setFieldError(null);
    setBusy(true);
    const result = await upsertHostBrand(hostId, {
      businessName: name,
      businessDescription: description,
    });
    setBusy(false);
    if (result.error || !result.brand) {
      setFieldError(result.error ?? HOST_BRAND_SAVE_ERROR);
      return;
    }
    setBrand(result.brand);
    setNotice('Saved.');
  };

  const changeLinks = async (next: string[]) => {
    if (!brand) return;
    setNotice(null);
    setBusy(true);
    const result = await saveHostBrandPropertyIds(brand.id, next);
    setBusy(false);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setLinkedIds(result.propertyIds);
  };

  const linked = properties.filter((p) => linkedIds.includes(p.id));
  const eligible = properties.filter((p) => !linkedIds.includes(p.id));

  const propertyRow = (p: OwnedProperty, action: { label: string; onClick: () => void }) => (
    <li key={p.id} className="flex items-center gap-3 py-3">
      <div
        className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center"
        aria-hidden="true"
      >
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Building2 className="h-5 w-5 text-xpx-subtle" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-xpx-text">{p.title}</p>
        <p className="flex items-center gap-1 text-xs text-xpx-muted">
          {p.city && (
            <>
              <MapPin className="h-3 w-3" aria-hidden="true" />
              <span className="truncate">{p.city}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{p.isActive ? 'Live' : 'Not live'}</span>
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={action.onClick}
        aria-label={`${action.label} ${p.title}`}
        className="min-h-[44px] shrink-0 rounded-xl px-3 text-sm font-semibold text-xpx-text disabled:opacity-50"
        style={inputStyle}
      >
        {action.label}
      </button>
    </li>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="xpx-eyebrow">Business</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-xpx-text">
          Brand
        </h1>
        <p className="mt-2 text-xpx-muted">
          The hospitality name behind your stays. Guests see it on linked live listings as
          &ldquo;Operated by {brand?.businessName || 'your brand'}&rdquo;. Your listings stay on
          your host account.
        </p>
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl animate-pulse bg-slate-200/60" />
      ) : loadError ? (
        <div className="rounded-2xl p-5" style={card} role="alert">
          <p className="text-sm text-xpx-muted">
            We couldn&rsquo;t load your Brand. Please try again.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 min-h-[44px] rounded-xl px-4 text-sm font-bold text-white"
            style={primaryStyle}
          >
            Retry
          </button>
        </div>
      ) : !brand ? (
        <div className="rounded-2xl p-5 sm:p-6" style={card}>
          <h2 className="text-lg font-extrabold text-xpx-text">No Brand yet</h2>
          <p className="mt-1 text-sm text-xpx-muted">
            Optional. Add a business name if you operate stays under one name.
          </p>
          <button
            type="button"
            onClick={() => setFlowOpen(true)}
            className="mt-4 min-h-[44px] rounded-xl px-5 text-sm font-bold text-white"
            style={primaryStyle}
          >
            Add a business name
          </button>
        </div>
      ) : (
        <>
          <section className="rounded-2xl p-5 sm:p-6" style={card} aria-labelledby="brand-identity">
            <h2 id="brand-identity" className="text-lg font-extrabold text-xpx-text">
              Identity
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="brand-name" className="block text-sm font-semibold text-xpx-text">
                  Business name
                </label>
                <input
                  id="brand-name"
                  value={name}
                  maxLength={HOST_BRAND_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl px-3 text-base"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="brand-desc" className="block text-sm font-semibold text-xpx-text">
                  Short description (optional)
                </label>
                <textarea
                  id="brand-desc"
                  rows={3}
                  value={description}
                  maxLength={HOST_BRAND_DESCRIPTION_MAX}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-base"
                  style={inputStyle}
                />
              </div>
              {fieldError && (
                <p className="text-sm text-red-600" role="alert">
                  {fieldError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveIdentity()}
                  className="min-h-[44px] rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50"
                  style={primaryStyle}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                {notice && (
                  <span className="text-sm text-xpx-muted" role="status">
                    {notice}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl p-5 sm:p-6" style={card} aria-labelledby="brand-props">
            <h2 id="brand-props" className="text-lg font-extrabold text-xpx-text">
              Listings under this Brand
            </h2>
            {linked.length === 0 ? (
              <p className="mt-2 text-sm text-xpx-muted">No listings linked yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200/70">
                {linked.map((p) =>
                  propertyRow(p, {
                    label: 'Remove',
                    onClick: () => void changeLinks(withPropertyUnlinked(linkedIds, p.id)),
                  }),
                )}
              </ul>
            )}

            <h3 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-xpx-subtle">
              Your other listings
            </h3>
            {eligible.length === 0 ? (
              <p className="mt-2 text-sm text-xpx-muted">
                {properties.length === 0
                  ? 'You have no listings yet. Add one under Properties.'
                  : 'All your listings are linked.'}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200/70">
                {eligible.map((p) =>
                  propertyRow(p, {
                    label: 'Add',
                    onClick: () => void changeLinks(withPropertyLinked(linkedIds, p.id)),
                  }),
                )}
              </ul>
            )}
            <p className="mt-4 text-xs text-xpx-subtle">
              Linking does not make a listing live or verified.
            </p>
          </section>
        </>
      )}

      <BrandOnboardingFlow
        open={flowOpen}
        mode="create"
        hostId={hostId}
        hostName={host?.name ?? 'Host'}
        properties={properties}
        existingBrand={brand}
        onClose={() => {
          setFlowOpen(false);
          void load();
        }}
        onCompleted={() => {
          setFlowOpen(false);
          void load();
        }}
      />
    </div>
  );
}
