import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePublicPropertyBrand } from './publicPropertyBrand';
import { withPropertyLinked, withPropertyUnlinked } from './hostBrand';
import {
  CARD_LISTING_FIELDS,
  CARD_LISTING_SELECT,
  DETAIL_LISTING_SELECT,
  PUBLIC_LISTING_CORE_FIELDS,
  PUBLIC_LISTING_OPTIONAL_FIELDS,
} from './publicListings';

const SRC_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PROJECT_ROOT = join(SRC_ROOT, '..');
const read = (p: string) => readFileSync(join(SRC_ROOT, p), 'utf8');

/*
 * STATIC / MIGRATION TESTS: these inspect SQL text and source. They do NOT prove
 * live RLS or function behavior — that still requires running the migration
 * against a real Supabase database (see final report).
 */
describe('get_public_property_brand migration (static)', () => {
  const sql = readFileSync(
    join(PROJECT_ROOT, 'supabase/migrations/20260908100000_public_property_brand.sql'),
    'utf8',
  );
  const body = sql.replace(/\/\*[\s\S]*?\*\//, '');

  it('defines the function as static SECURITY DEFINER with pinned search_path', () => {
    expect(body).toMatch(/FUNCTION public\.get_public_property_brand\(p_property_id uuid\)/);
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).not.toMatch(/EXECUTE\s+format|EXECUTE\s+'/i);
  });

  it('returns only brand_name and brand_description', () => {
    expect(body).toMatch(/RETURNS TABLE \(brand_name text, brand_description text\)/);
    expect(body).toMatch(/SELECT hb\.business_name, hb\.business_description\s+FROM/);
    const selectList = body.match(/SELECT([\s\S]*?)FROM/)?.[1] ?? '';
    expect(selectList).not.toMatch(/hb\.id|host_id|p\.id|hbp\.|hosts/i);
  });

  it('requires active property, an association, and same-host ownership', () => {
    expect(body).toMatch(/p\.is_active = true/);
    expect(body).toMatch(/JOIN public\.host_brand_properties hbp ON hbp\.property_id = p\.id/);
    expect(body).toMatch(/hb\.host_id = p\.host_id/);
    expect(body).toMatch(/LIMIT 1/);
  });

  it('grants execute to anon narrowly and adds no table grants or policies', () => {
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.get_public_property_brand\(uuid\) FROM PUBLIC/);
    expect(body).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_public_property_brand\(uuid\) TO anon, authenticated/,
    );
    expect(body).not.toMatch(/CREATE POLICY|ALTER TABLE|GRANT (SELECT|ALL) ON/i);
  });
});

describe('parsePublicPropertyBrand (application)', () => {
  it('maps a row to name + description only', () => {
    const out = parsePublicPropertyBrand([
      { brand_name: ' Riverstone Stays ', brand_description: ' A line ', host_id: 'x', brand_id: 'y' },
    ]);
    expect(out).toEqual({ name: 'Riverstone Stays', description: 'A line' });
    expect(Object.keys(out ?? {}).sort()).toEqual(['description', 'name']);
  });

  it('returns null for unbranded / empty / malformed results', () => {
    expect(parsePublicPropertyBrand([])).toBeNull();
    expect(parsePublicPropertyBrand(null)).toBeNull();
    expect(parsePublicPropertyBrand([{ brand_name: '  ' }])).toBeNull();
    expect(parsePublicPropertyBrand([{ brand_name: 5 }])).toBeNull();
  });

  it('normalizes empty description to null', () => {
    expect(parsePublicPropertyBrand([{ brand_name: 'A B', brand_description: '' }])?.description).toBeNull();
  });
});

describe('public listing contract stays Brand-free', () => {
  it('does not add Brand to any listing projection', () => {
    const all = [
      ...CARD_LISTING_FIELDS,
      ...PUBLIC_LISTING_CORE_FIELDS,
      ...PUBLIC_LISTING_OPTIONAL_FIELDS,
    ].join(' ');
    expect(all).not.toMatch(/brand|business/i);
    expect(CARD_LISTING_SELECT).not.toMatch(/brand/i);
    expect(DETAIL_LISTING_SELECT).not.toMatch(/brand/i);
  });

  it('publicListings.ts does not reference the Brand path', () => {
    expect(read('lib/publicListings.ts')).not.toMatch(/brand/i);
  });

  it('PropertyPage uses only the narrow public helper, not Brand tables', () => {
    const page = read('pages/PropertyPage.tsx');
    expect(page).toMatch(/getPublicPropertyBrand/);
    expect(page).not.toMatch(/host_brands|host_brand_properties|lib\/hostBrand'/);
    expect(page).toMatch(/Operated by/);
    expect(page).not.toMatch(/Verified Brand/i);
  });

  it('public helper calls only the RPC', () => {
    const helper = read('lib/publicPropertyBrand.ts');
    expect(helper).toMatch(/rpc\('get_public_property_brand'/);
    expect(helper).not.toMatch(/\.from\(/);
  });
});

describe('Brand management page (application)', () => {
  it('is routed at the existing host dashboard convention', () => {
    expect(read('AppRouter.tsx')).toMatch(/page === 'brand' && <BrandPage \/>/);
    expect(read('pages/host/HostDashboardLayout.tsx')).toMatch(/dashboard\/brand/);
  });

  it('uses domain helpers and upsert (no duplicate Brand rows) and does not query Brand tables', () => {
    const page = read('pages/host/BrandPage.tsx');
    expect(page).toMatch(/upsertHostBrand/);
    expect(page).toMatch(/saveHostBrandPropertyIds/);
    expect(page).not.toMatch(/\.from\('host_brands'\)|\.from\('host_brand_properties'\)/);
  });

  it('link/unlink helpers edit the association set', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    expect(withPropertyLinked([a], b)).toEqual([a, b]);
    expect(withPropertyLinked([a], a)).toEqual([a]);
    expect(withPropertyLinked([a], 'not-a-uuid')).toEqual([a]);
    expect(withPropertyUnlinked([a, b], a)).toEqual([b]);
  });
});
