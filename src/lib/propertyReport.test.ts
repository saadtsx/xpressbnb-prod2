import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  isReportReason,
  normalizeReportDetails,
} from './propertyReport';

const SRC_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PROJECT_ROOT = join(SRC_ROOT, '..');
const read = (p: string) => readFileSync(join(SRC_ROOT, p), 'utf8');

describe('property report (application)', () => {
  it('allowlists reasons and rejects unknown ones', () => {
    expect(REPORT_REASONS.map((r) => r.id)).toEqual([
      'inaccurate', 'not_available', 'scam', 'unsafe', 'inappropriate', 'other',
    ]);
    expect(isReportReason('scam')).toBe(true);
    expect(isReportReason('drop table')).toBe(false);
  });

  it('normalizes details: trims, nulls empty, caps length', () => {
    expect(normalizeReportDetails('   ')).toBeNull();
    expect(normalizeReportDetails(' hi ')).toBe('hi');
    expect(normalizeReportDetails('x'.repeat(900))).toHaveLength(REPORT_DETAILS_MAX);
  });
});

describe('property report UI wiring (static)', () => {
  it('HostCard no longer has the WhatsApp concierge and shows a red report button', () => {
    const card = read('components/HostCard.tsx');
    expect(card).not.toMatch(/buildTeamWhatsAppLink|handleConcierge|Text us on WhatsApp/);
    expect(card).toMatch(/Report this property/);
    expect(card).toMatch(/#DC2626/);
    expect(read('pages/PropertyPage.tsx')).toMatch(/propertyId=\{property\.id\}/);
  });

  it('report submit goes through the RPC only (no direct table access from guests)', () => {
    const lib = read('lib/propertyReport.ts');
    expect(lib).toMatch(/rpc\('report_property'/);
    expect(lib).not.toMatch(/\.from\(/);
  });
});

describe('property_reports migration (static — not live RLS proof)', () => {
  const sql = readFileSync(
    join(PROJECT_ROOT, 'supabase/migrations/20261007100000_property_reports.sql'),
    'utf8',
  );

  it('keeps the table private: no anon/authenticated write grants or insert policies', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.property_reports FROM anon/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL) ON TABLE public\.property_reports TO (anon|authenticated)/);
    expect(sql).not.toMatch(/FOR INSERT/);
  });

  it('RPC validates, requires an active property, rate-limits, and is anon-executable', () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/is_active = true/);
    expect(sql).toMatch(/>= 5/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.report_property\(uuid, text, text, text\) TO anon, authenticated/);
  });

  it('reports never alter listing visibility', () => {
    expect(sql).not.toMatch(/UPDATE\s+public\.properties/i);
  });

  it('only admins can read, and the table is in the realtime publication', () => {
    expect(sql).toMatch(/USING \(public\.is_ops_admin\(\)\)/);
    expect(sql).toMatch(/ADD TABLE public\.property_reports/);
  });
});
