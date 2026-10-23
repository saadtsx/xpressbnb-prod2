import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparePrices, parseComparisonRow } from './priceComparison';
import { CARD_LISTING_SELECT, DETAIL_LISTING_SELECT } from './publicListings';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ROOT = join(SRC, '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('comparePrices — only honest savings claims', () => {
  it('claims savings only when the other price includes fees and ours is lower', () => {
    expect(comparePrices(3000, { nightlyPrice: 3600, includesFees: true })).toEqual({ savingsPerNight: 600, likeForLike: true });
  });
  it('never claims savings against a before-fees price', () => {
    expect(comparePrices(3000, { nightlyPrice: 3600, includesFees: false }).savingsPerNight).toBeNull();
  });
  it('never claims savings when we are equal or more expensive', () => {
    expect(comparePrices(3600, { nightlyPrice: 3600, includesFees: true }).savingsPerNight).toBeNull();
    expect(comparePrices(4000, { nightlyPrice: 3600, includesFees: true }).savingsPerNight).toBeNull();
  });
  it('makes no claim when our price is missing', () => {
    expect(comparePrices(0, { nightlyPrice: 3600, includesFees: true }).savingsPerNight).toBeNull();
  });
});

describe('parseComparisonRow — rejects anything unsafe or malformed', () => {
  const ok = { property_id: 'p1', platform: 'airbnb', url: 'https://www.airbnb.co.in/rooms/1', nightly_price: '3600.00', includes_fees: true, checked_at: '2026-10-20T00:00:00Z' };
  it('accepts a valid verified row', () => {
    expect(parseComparisonRow(ok)?.nightlyPrice).toBe(3600);
  });
  it('rejects non-https, javascript: and unknown platforms', () => {
    expect(parseComparisonRow({ ...ok, url: 'http://airbnb.com/x' })).toBeNull();
    expect(parseComparisonRow({ ...ok, url: 'javascript:alert(1)' })).toBeNull();
    expect(parseComparisonRow({ ...ok, platform: 'evil' })).toBeNull();
    expect(parseComparisonRow({ ...ok, nightly_price: 0 })).toBeNull();
  });
});

describe('contracts', () => {
  it('public listing projections are unchanged (comparison is a separate request)', () => {
    expect(CARD_LISTING_SELECT).not.toMatch(/comparison|external_listings_v2|nightly_price/);
    expect(DETAIL_LISTING_SELECT).not.toMatch(/comparison|nightly_price/);
    expect(read('lib/publicListings.ts')).not.toMatch(/priceComparison|property_external_listings/);
  });
  it('guest UI reads comparisons only through the verified public RPC', () => {
    for (const f of ['components/pricing/PropertyCardPriceCompare.tsx', 'components/pricing/PropertyPriceComparisonPanel.tsx']) {
      const src = read(f);
      expect(src).toMatch(/usePriceComparisons/);
      expect(src).not.toMatch(/\.from\(|supabase/);
    }
    expect(read('lib/priceComparison.ts')).toMatch(/rpc\('get_property_price_comparisons'/);
  });
  it('external links open safely', () => {
    expect(read('components/pricing/PropertyPriceComparisonPanel.tsx')).toMatch(/rel="noopener noreferrer nofollow"/);
  });
});

describe('migration (static — live behaviour verified separately)', () => {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/20261024100000_property_price_comparisons.sql'), 'utf8');
  it('public RPC returns verified, recent, active-property rows only and no submitter data', () => {
    expect(sql).toMatch(/e\.status = 'verified'/);
    expect(sql).toMatch(/e\.reviewed_at > now\(\) - interval '30 days'/);
    expect(sql).toMatch(/p\.is_active IS TRUE/);
    const ret = sql.match(/RETURNS TABLE \(([^)]*)\)/)?.[1] ?? '';
    expect(ret).not.toMatch(/submitted_by|reviewed_by|review_note/);
  });
  it('host edits always re-enter review; platform must match the URL domain', () => {
    expect(sql).toMatch(/status = 'pending', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL/);
    expect(sql).toMatch(/external_listing_url_matches\(p_platform, v_url\)/);
  });
  it('only ops can verify; no direct client writes', () => {
    expect(sql).toMatch(/IF NOT public\.is_ops_admin\(\) THEN RAISE EXCEPTION 'Ops access required'/);
    expect(sql).toMatch(/REVOKE ALL ON public\.property_external_listings FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL) ON public\.property_external_listings TO (anon|authenticated)/);
  });
});
