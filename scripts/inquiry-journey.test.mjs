import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Disposable PostgreSQL fixtures. Executes the actual new migration and predecessor
// submission/review functions, not a JS imitation. No network or production data.
const sql = file => readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
let db;
const host = '11111111-1111-4111-8111-111111111111';
const user = '22222222-2222-4222-8222-222222222222';
const property = '33333333-3333-4333-8333-333333333333';
const outsider = '44444444-4444-4444-8444-444444444444';
const request = '55555555-5555-4555-8555-555555555555';
const scalar = async (query, args = []) => (await db.query(query, args)).rows[0];
async function asUser(id = user) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('SET ROLE authenticated');
}
async function createInquiry(offer = false) {
  await db.exec('RESET ROLE');
  const row = await scalar(offer
    ? `SELECT public.create_make_offer_inquiry($1,$2,'Guest','guest@example.test',current_date+2,current_date+4,900,'9876543210') AS result`
    : `SELECT public.create_pending_booking($1,$2,'Guest','guest@example.test','9876543210',current_date+2,current_date+4,2,1,1,99) AS result`, [property, host]);
  return row.result.booking_id;
}
async function release(id) {
  await db.exec('RESET ROLE');
  await db.query('SELECT public.approve_inquiry_for_host($1,$2)', [id, user]);
}
async function respond(id, action, version = 0, req = request, amount = null) {
  return scalar('SELECT public.respond_to_inquiry($1,$2,$3,$4,NULL,$5) AS result', [id, action, version, req, amount]);
}
async function track(id) {
  await db.exec('RESET ROLE');
  const { customer_reference } = await scalar('SELECT customer_reference FROM bookings WHERE id=$1', [id]);
  await db.exec('SET ROLE anon');
  return (await scalar('SELECT public.track_inquiry_by_reference($1,$2) AS result', [customer_reference, 'guest@example.test'])).result;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
    CREATE TABLE hosts(id uuid PRIMARY KEY, user_id uuid, name text, phone text, email text, bio text, payout_details jsonb, kyc_status text, total_bookings integer, created_at timestamptz DEFAULT now());
    ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can view public host profiles" ON hosts FOR SELECT USING (true);
    CREATE POLICY "Hosts view own profile" ON hosts FOR SELECT TO authenticated USING (user_id=auth.uid());
    CREATE POLICY "Hosts update own profile" ON hosts FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE TABLE properties(id uuid PRIMARY KEY, host_id uuid REFERENCES hosts, title text, is_active boolean, price_per_day numeric,
      price_full_day numeric, max_guests integer, accepts_local_ids boolean, is_verified boolean, rating numeric, total_reviews integer,
      is_premium boolean, premium_plan text, premium_expiry timestamptz);
    CREATE TABLE bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid REFERENCES properties, host_id uuid REFERENCES hosts,
      guest_name text, guest_email text, guest_phone text, check_in_date date, check_out_date date, checkin date, checkout date,
      num_guests integer, booking_type text, amount_total numeric, total_price numeric, nights integer, status text, payment_status text,
      inquiry_type text, phone_verified boolean, phone_verified_at timestamptz, special_requests text, include_decoration boolean,
      customer_reference text UNIQUE, spam_score integer, submission_ip text, device_fingerprint text, offer_amount numeric, offer_message text,
      reviewed_at timestamptz, reviewed_by uuid, review_reason text, approval_source text, host_decision_at timestamptz, host_decision_note text,
      host_viewed_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), payment_method text, paid_at timestamptz,
      time_slot text, source text);
    ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_open_read ON bookings FOR SELECT USING (true);
    CREATE POLICY legacy_open_write ON bookings FOR ALL USING (true) WITH CHECK (true);
    CREATE TABLE property_calendar(property_id uuid, date date, is_available boolean, price_override integer, minimum_stay integer);
    CREATE TABLE booking_notification_queue(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, booking_id uuid, event_type text, payload jsonb,
      status text DEFAULT 'pending', created_at timestamptz DEFAULT now(), processed_at timestamptz);
    CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(), booking_id uuid, queue_id uuid, recipient_role text, status text, created_at timestamptz DEFAULT now());
    CREATE TABLE external_reviews(id uuid PRIMARY KEY);
    CREATE TABLE host_subscriptions(id uuid PRIMARY KEY);
    CREATE TABLE property_subscriptions(id uuid PRIMARY KEY);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY, bucket_id text, owner_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can upload property images" ON storage.objects FOR INSERT WITH CHECK (true);
    CREATE POLICY "Anyone can delete property images" ON storage.objects FOR DELETE USING (true);
    CREATE TABLE inquiry_submission_log(submission_ip text,guest_email text,guest_phone text,property_id uuid,booking_id uuid);
    CREATE FUNCTION current_host_ids() RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT id FROM hosts WHERE user_id=auth.uid() $$;
    CREATE FUNCTION validate_guest_email(text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF $1 NOT LIKE '%@%' THEN RAISE EXCEPTION 'Invalid email'; END IF; END $$;
    CREATE FUNCTION is_property_available(uuid,date,date) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE FUNCTION compute_inquiry_spam_score(text,text,uuid,text,text,boolean) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
    CREATE FUNCTION generate_inquiry_customer_reference() RETURNS text LANGUAGE sql AS $$ SELECT 'XPX-' || upper(gen_random_uuid()::text) $$;
    CREATE FUNCTION frequent_amigo_status_for_phone(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    CREATE FUNCTION host_contact_json_for_host(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,anon;
    GRANT ALL ON storage.objects TO authenticated,anon;
  `);
  const predecessor = sql('20260626160000_production_trust_gate.sql');
  for (const name of ['inquiry_contact_released', 'create_pending_booking', 'create_make_offer_inquiry', 'approve_inquiry_for_host']) {
    const start = predecessor.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    const end = predecessor.indexOf('\n$$;', start) + 4;
    await db.exec(predecessor.slice(start, end));
  }
  // Fixture mirrors the existing host read view to test CREATE OR REPLACE compatibility.
  const viewStart = predecessor.indexOf('CREATE OR REPLACE VIEW public.host_inquiries');
  const viewEnd = predecessor.indexOf(';', viewStart) + 1;
  await db.exec(predecessor.slice(viewStart, viewEnd));
  await db.exec(sql('20261015100000_secure_inquiry_journey.sql'));
  await db.query('INSERT INTO hosts(id,user_id,name,phone) VALUES ($1,$2,\'Host\',\'9876543210\')', [host,user]);
  await db.query(`INSERT INTO properties(id,host_id,title,is_active,price_per_day,max_guests,accepts_local_ids) VALUES ($1,$2,'Test stay',true,1000,4,true)`, [property,host]);
}, 30000);
afterAll(async () => { await db?.close(); });

describe('inquiry journey in PostgreSQL', () => {
  it('derives nightly prices and nights instead of accepting client financial fields', async () => {
    await db.exec('RESET ROLE');
    await db.query('INSERT INTO property_calendar VALUES ($1,current_date+2,true,1500,1)', [property]);
    const id = await createInquiry();
    const b = await scalar('SELECT * FROM bookings WHERE id=$1', [id]);
    expect(b.nights).toBe(2); expect(Number(b.amount_total)).toBe(2500);
    expect(b.inquiry_terms.total_payable).toBeNull(); expect(b.inquiry_terms.payment_status).toBe('external_unverified');
    await db.exec('DELETE FROM property_calendar');
  });
  it('guest submission → masked queue → operations release → authorized accept → reopened guest status', async () => {
    const id = await createInquiry();
    await asUser();
    const hidden = await scalar('SELECT * FROM host_inquiries WHERE id=$1', [id]);
    expect(hidden.guest_email).toBeNull(); expect(hidden.special_requests).toBeNull();
    await expect(respond(id,'accepted')).rejects.toThrow(/current state/);
    await release(id); await asUser();
    expect((await scalar('SELECT * FROM host_inquiries WHERE id=$1',[id])).guest_email).toBe('guest@example.test');
    await respond(id,'accepted');
    const result = await track(id);
    expect(result.display_status).toBe('accepted'); expect(result.booking_status).toBe('not_confirmed');
    expect(result.payment_status).toBe('external_unverified'); expect(result.notification_status).toBe('pending');
  });
  it('denies cross-host actions and direct changes to booking/payment/review evidence', async () => {
    const id = await createInquiry(); await release(id); await asUser(outsider);
    expect((await db.query('SELECT * FROM host_inquiries WHERE id=$1',[id])).rows).toHaveLength(0);
    await expect(respond(id,'accepted')).rejects.toThrow(/not available/);
    await asUser();
    await expect(db.query("UPDATE bookings SET payment_status='paid',status='completed',reviewed_by=$2 WHERE id=$1",[id,user])).rejects.toThrow(/permission denied/);
    await expect(db.query('INSERT INTO external_reviews VALUES ($1)',[request])).rejects.toThrow(/permission denied/);
    await expect(db.query('UPDATE properties SET is_verified=true WHERE id=$1',[property])).rejects.toThrow(/managed by operations/);
    await expect(db.query("UPDATE hosts SET kyc_status='verified' WHERE id=$1",[host])).rejects.toThrow(/permission denied/);
    await expect(db.query('INSERT INTO property_subscriptions VALUES ($1)',[request])).rejects.toThrow(/permission denied/);
  });
  it('prevents a former owner responding after a property is reassigned', async () => {
    const id = await createInquiry(); await release(id); await db.exec('RESET ROLE');
    await db.query('UPDATE properties SET host_id=NULL WHERE id=$1',[property]); await asUser();
    await expect(respond(id,'accepted')).rejects.toThrow(/not available/);
    await db.exec('RESET ROLE'); await db.query('UPDATE properties SET host_id=$2 WHERE id=$1',[property,host]);
  });
  it('idempotent retries create one event and one notification, conflicting actions fail', async () => {
    const id = await createInquiry(); await release(id); await asUser();
    const first = await respond(id,'accepted'); expect(await respond(id,'accepted')).toEqual(first);
    await expect(respond(id,'rejected')).rejects.toThrow(/already used/);
    await db.exec('RESET ROLE');
    expect((await scalar('SELECT count(*)::int AS count FROM inquiry_response_events WHERE booking_id=$1',[id])).count).toBe(1);
    expect((await scalar('SELECT count(*)::int AS count FROM booking_notification_queue WHERE booking_id=$1',[id])).count).toBe(1);
  });
  it('counteroffers keep payment separate, preserve prior terms and reject stale versions', async () => {
    const id = await createInquiry(true); await release(id); await asUser();
    await respond(id,'countered',0,request,1100);
    await expect(respond(id,'countered',0,outsider,1200)).rejects.toThrow(/Refresh/);
    await expect(respond(id,'accepted',1,outsider)).rejects.toThrow(/guest agreement/);
    const result = await track(id);
    expect(result.display_status).toBe('countered'); expect(result.terms.estimate).toBe(2200);
    expect(result.terms.previous_estimate).toBe(1800); expect(result.terms.guest_consent).toBe('required');
    await db.exec('RESET ROLE');
    expect((await scalar('SELECT payment_status FROM bookings WHERE id=$1',[id])).payment_status).toBe('offer_pending');
    await asUser(); await respond(id,'rejected',1,outsider);
    expect((await track(id)).display_status).toBe('rejected');
  });
  it('rejects invalid ownership, count, dates, blocked inventory and counter amounts', async () => {
    await db.exec('RESET ROLE');
    const insert = `INSERT INTO bookings(property_id,host_id,inquiry_type,guest_name,guest_email,num_guests,check_in_date,check_out_date) VALUES ($1,$2,'book_pay_later','Guest','guest@example.test',$3,current_date+2,current_date+4)`;
    await expect(db.query(insert,[property,outsider,2])).rejects.toThrow(/Property not available/);
    await expect(db.query(insert,[property,host,8])).rejects.toThrow(/guest count/);
    await db.query('INSERT INTO property_calendar VALUES ($1,current_date+2,false,NULL,1)',[property]);
    await expect(createInquiry()).rejects.toThrow(/unavailable/); await db.exec('DELETE FROM property_calendar');
    const id = await createInquiry(true); await release(id); await asUser();
    await expect(respond(id,'countered',0,request,-1)).rejects.toThrow(/Invalid counteroffer/);
    await expect(respond(id,'confirmed')).rejects.toThrow(/Invalid response/);
  });
  it('tracking needs matching credentials and reports provider status without exposing contact data', async () => {
    const id = await createInquiry(); await release(id); await asUser(); await respond(id,'accepted');
    await db.exec('RESET ROLE');
    const b = await scalar('SELECT customer_reference FROM bookings WHERE id=$1',[id]);
    await db.query(`INSERT INTO notifications(booking_id,queue_id,recipient_role,status) SELECT booking_id,id,'guest','dev_logged' FROM booking_notification_queue WHERE booking_id=$1`,[id]);
    const result = await track(id);
    expect(result.notification_status).toBe('dev_logged'); expect(result.guest_email).toBeUndefined(); expect(result.guest_phone).toBeUndefined();
    await expect(db.query('SELECT track_inquiry_by_reference($1,$2)',[b.customer_reference,'wrong@example.test'])).rejects.toThrow(/not found/);
  });
  it('operations rejection is not attributed to the host and does not release contact', async () => {
    const id = await createInquiry();
    await db.query("UPDATE bookings SET status='rejected',reviewed_at=now(),reviewed_by=$2 WHERE id=$1", [id,user]);
    const result = await track(id);
    expect(result.display_status).toBe('review_declined'); expect(result.host_contact).toBeNull();
  });
  it('anonymous storage writes fail and hosts cannot delete another uploader’s object', async () => {
    await db.exec('RESET ROLE'); await db.query("INSERT INTO storage.objects VALUES ($1,'property-images',$2)",[request,outsider]);
    await db.exec('SET ROLE anon');
    await expect(db.query("INSERT INTO storage.objects VALUES ($1,'property-images',$2)",[host,user])).rejects.toThrow(/row-level security/);
    await asUser();
    expect((await db.query('DELETE FROM storage.objects WHERE id=$1 RETURNING id',[request])).rows).toHaveLength(0);
  });
  it('public cards cannot read host contact/payout rows and direct inquiry RPC bypass is denied', async () => {
    await db.exec('RESET ROLE'); await db.exec('SET ROLE anon');
    expect((await db.query('SELECT * FROM public_host_profiles')).rows[0].name).toBe('Host');
    await expect(db.query('SELECT phone,payout_details FROM hosts')).rejects.toThrow(/permission denied/);
    await expect(db.query(`SELECT create_pending_booking($1,$2,'Guest','guest@example.test','9876543210',current_date+2,current_date+4,1,1,1,2)`,[property,host])).rejects.toThrow(/permission denied/);
    await asUser(outsider);
    expect((await db.query('SELECT * FROM hosts')).rows).toHaveLength(0);
  });
});
