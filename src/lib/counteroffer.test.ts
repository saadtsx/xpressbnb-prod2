import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counterofferProposal, inquiryDecisionLabel } from './inquiryJourney';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ROOT = join(SRC, '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const terms = { check_in: '2026-11-10', check_out: '2026-11-13', estimate: 9000, previous_estimate: 9000 };

describe('counterofferProposal', () => {
  it('derives the exact per-night/total proposal for the shown version', () => {
    expect(counterofferProposal(terms, 2500, 2)).toEqual({ perNight: 2500, nights: 3, estimate: 7500, previousEstimate: 9000, version: 2 });
  });
  it('never guesses when any part is missing', () => {
    expect(counterofferProposal(null, 2500, 1)).toBeNull();
    expect(counterofferProposal(terms, null, 1)).toBeNull();
    expect(counterofferProposal(terms, 0, 1)).toBeNull();
    expect(counterofferProposal({ ...terms, check_out: '2026-11-10' }, 2500, 1)).toBeNull();
  });
});

describe('status copy keeps agreement distinct from confirmation', () => {
  it('labels guest decisions without claiming a booking', () => {
    expect(inquiryDecisionLabel('counter_accepted')).toMatch(/not confirmed/i);
    expect(inquiryDecisionLabel('counter_declined')).toMatch(/closed/i);
    expect(inquiryDecisionLabel('countered')).toMatch(/agreement needed/i);
  });
});

describe('respond_to_counteroffer migration (static — live behaviour verified separately)', () => {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/20261015120000_guest_counteroffer_response.sql'), 'utf8');
  it('authorises by reference + email and pins the proposal version', () => {
    expect(sql).toMatch(/customer_reference = upper\(trim\(p_customer_reference\)\)/);
    expect(sql).toMatch(/lower\(guest_email\) = lower\(trim\(p_guest_email\)\)/);
    expect(sql).toMatch(/b\.response_version <> p_expected_version/);
    expect(sql).toMatch(/UNIQUE \(booking_id, request_id\)/);
  });
  it('only acts on an open, released counteroffer and never confirms or collects payment', () => {
    expect(sql).toMatch(/b\.response_kind IS DISTINCT FROM 'countered'/);
    expect(sql).toMatch(/inquiry_contact_released\(b\)/);
    expect(sql).not.toMatch(/status = 'confirmed'/);
    expect(sql).toMatch(/'confirmed', false/);
    expect(sql).not.toMatch(/payment_status = 'paid'/);
  });
  it('keeps the audit table private and the RPC narrowly granted', () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.inquiry_guest_responses FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.respond_to_counteroffer\(text,text,text,integer,uuid\) TO anon, authenticated/);
  });
});

describe('UI wiring', () => {
  it('track page shows the decision only for an open counteroffer', () => {
    expect(read('pages/TrackInquiryPage.tsx')).toMatch(/displayStatus === 'countered' && lookup && \(\s*<CounterofferDecision/);
  });
  it('decision requires explicit consent and uses the RPC with a stable request id', () => {
    const c = read('components/inquiry/CounterofferDecision.tsx');
    expect(c).toMatch(/disabled=\{!consent \|\| busy !== null\}/);
    expect(c).toMatch(/requestIds\.current/);
    expect(read('lib/inquirySubmit.ts')).toMatch(/rpc\('respond_to_counteroffer'/);
  });
});
