import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeadersFor } from '../_shared/cors.ts';
import {
  formatDateRange,
  guestInquiryAcceptedMessage,
  guestInquiryRejectedMessage,
  hostCounterAcceptedMessage,
  hostCounterDeclinedMessage,
  guestInquirySentMessage,
  hostNewInquiryMessage,
  normalizeIndiaE164,
  type InquiryMessageContext,
  type Locale,
} from '../_shared/inquiry-messages.ts';
import { sendWhatsAppText } from '../_shared/whatsapp-meta.ts';

/**
 * send-inquiry-notification
 *
 * Provider: Meta WhatsApp Cloud API (not Twilio — Twilio remains for SMS OTP).
 *
 * Processes booking_notification_queue rows and writes public.notifications for audit/retry.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_DEV_MODE=true,
 *      HOST_DASHBOARD_URL (e.g. https://www.xpressbnb.com/host/bookings),
 *      NOTIFICATION_DISPATCH_SECRET (optional; matches integration_settings for pg_net)
 *
 * Body: { queue_id?: string, process_pending?: boolean, limit?: number }
 */

type RequestBody = {
  queue_id?: string;
  process_pending?: boolean;
  limit?: number;
};

type BookingRow = {
  id: string;
  property_id: string;
  host_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string | null;
  status: string;
  inquiry_type: string;
  customer_reference: string | null;
  phone_verified: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  response_version: number;
};

function inquiryContactReleased(booking: BookingRow): boolean {
  return (
    booking.phone_verified === true &&
    booking.reviewed_at != null &&
    booking.reviewed_by != null &&
    booking.status !== 'inquiry_preparing' &&
    booking.status !== 'inquiry_pending'
  );
}

type PropertyRow = { title: string };
type HostRow = { name: string; phone: string };

type QueueRow = {
  id: string;
  booking_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
};

type NotificationInsert = {
  booking_id: string;
  queue_id: string;
  recipient_role: 'guest' | 'host';
  recipient_phone: string;
  event_type: string;
  locale: Locale;
  message_body: string;
  status: string;
  provider_message_id?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
};

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && bearer === serviceKey) return true;
  const dispatchSecret = Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
  if (dispatchSecret && bearer === dispatchSecret) return true;
  return false;
}

async function rest<T>(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<T> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase not configured');

  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  if (init.prefer) headers.Prefer = init.prefer;

  const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`REST ${path}: ${r.status} ${text}`);
  if (!text) return [] as T;
  return JSON.parse(text) as T;
}

async function loadContext(bookingId: string): Promise<{
  booking: BookingRow;
  propertyTitle: string;
  hostName: string;
  hostPhone: string;
  ctx: InquiryMessageContext;
}> {
  const bookings = await rest<BookingRow[]>(
    `bookings?id=eq.${bookingId}&select=id,property_id,host_id,guest_name,guest_email,guest_phone,check_in_date,check_out_date,status,inquiry_type,customer_reference,phone_verified,reviewed_at,reviewed_by,response_version&limit=1`,
  );
  const booking = bookings[0];
  if (!booking) throw new Error('Booking not found');

  const properties = await rest<PropertyRow[]>(
    `properties?id=eq.${booking.property_id}&select=title&limit=1`,
  );
  const propertyTitle = properties[0]?.title ?? 'Property';

  let hostName = 'Host';
  let hostPhone = '';
  if (booking.host_id) {
    const hosts = await rest<HostRow[]>(
      `hosts?id=eq.${booking.host_id}&select=name,phone&limit=1`,
    );
    if (hosts[0]) {
      hostName = hosts[0].name?.trim() || 'Host';
      hostPhone = hosts[0].phone?.replace(/\D/g, '').slice(-10) ?? '';
    }
  }

  const dashboardBase =
    Deno.env.get('HOST_DASHBOARD_URL') ?? 'https://www.xpressbnb.com/host/bookings';
  const dateRange = formatDateRange(
    booking.check_in_date,
    booking.check_out_date ?? booking.check_in_date,
  );

  const ctx: InquiryMessageContext = {
    propertyTitle,
    dateRange,
    guestName: booking.guest_name,
    guestPhone: booking.guest_phone,
    hostName,
    hostPhone: hostPhone || '—',
    dashboardLink: dashboardBase,
    customerReference: booking.customer_reference,
  };

  return { booking, propertyTitle, hostName, hostPhone, ctx };
}

async function insertNotification(row: NotificationInsert): Promise<string> {
  const rows = await rest<{ id: string }[]>('notifications', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({
      booking_id: row.booking_id,
      queue_id: row.queue_id,
      channel: 'whatsapp',
      recipient_role: row.recipient_role,
      recipient_phone: row.recipient_phone,
      event_type: row.event_type,
      locale: row.locale,
      message_body: row.message_body,
      status: row.status,
      provider: 'meta_whatsapp',
      provider_message_id: row.provider_message_id ?? null,
      error_message: row.error_message ?? null,
      sent_at: row.sent_at ?? null,
    }),
  });
  return rows[0]?.id ?? '';
}

async function sendAndRecord(opts: {
  bookingId: string;
  queueId: string;
  eventType: string;
  role: 'guest' | 'host';
  phoneDigits: string;
  body: string;
  locale: Locale;
}): Promise<{ sent: boolean; notificationId: string }> {
  const e164 = normalizeIndiaE164(opts.phoneDigits);
  if (!e164) {
    const id = await insertNotification({
      booking_id: opts.bookingId,
      queue_id: opts.queueId,
      recipient_role: opts.role,
      recipient_phone: opts.phoneDigits,
      event_type: opts.eventType,
      locale: opts.locale,
      message_body: opts.body,
      status: 'failed',
      error_message: 'Invalid phone number',
    });
    return { sent: false, notificationId: id };
  }

  const result = await sendWhatsAppText(e164, opts.body);
  const now = new Date().toISOString();

  if (result.ok) {
    const status = result.mode === 'dev_logged' ? 'dev_logged' : 'sent';
    const id = await insertNotification({
      booking_id: opts.bookingId,
      queue_id: opts.queueId,
      recipient_role: opts.role,
      recipient_phone: e164,
      event_type: opts.eventType,
      locale: opts.locale,
      message_body: opts.body,
      status,
      provider_message_id: result.messageId,
      sent_at: result.mode === 'api' ? now : null,
    });
    return { sent: result.mode === 'api', notificationId: id };
  }

  const id = await insertNotification({
    booking_id: opts.bookingId,
    queue_id: opts.queueId,
    recipient_role: opts.role,
    recipient_phone: e164,
    event_type: opts.eventType,
    locale: opts.locale,
    message_body: opts.body,
    status: 'failed',
    error_message: result.error,
  });
  return { sent: false, notificationId: id };
}

async function processQueueItem(queue: QueueRow): Promise<{ messages: number; ok: boolean }> {
  if (queue.status !== 'pending') {
    return { messages: 0, ok: true };
  }

  const claimed = await rest<QueueRow[]>(`booking_notification_queue?id=eq.${queue.id}&status=eq.pending`, {
    method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ status: 'processing' }),
  });
  if (claimed.length === 0) return { messages: 0, ok: true };

  const { booking, hostPhone, ctx } = await loadContext(queue.booking_id);
  const contactReleased = inquiryContactReleased(booking);
  if (!contactReleased || (queue.payload.response_version != null && Number(queue.payload.response_version) !== booking.response_version)) {
    await rest(`booking_notification_queue?id=eq.${queue.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', processed_at: new Date().toISOString() }) });
    return { messages: 0, ok: false };
  }
  const locale: Locale = 'en';
  let sentCount = 0;
  let anyFailed = false;

  const tasks: Array<{
    role: 'guest' | 'host';
    phone: string;
    eventSuffix: string;
    body: string;
  }> = [];

  switch (queue.event_type) {
    case 'inquiry_verified':
      tasks.push({
        role: 'guest',
        phone: booking.guest_phone,
        eventSuffix: 'guest_sent',
        body: guestInquirySentMessage(ctx, locale),
      });
      if (contactReleased) {
        tasks.push({
          role: 'host',
          phone: hostPhone,
          eventSuffix: 'host_new',
          body: hostNewInquiryMessage(ctx, locale),
        });
      }
      break;
    case 'inquiry_host_accepted':
      tasks.push({
        role: 'guest',
        phone: booking.guest_phone,
        eventSuffix: 'guest_accepted',
        body: guestInquiryAcceptedMessage(ctx, locale),
      });
      break;
    case 'inquiry_host_countered':
      tasks.push({ role: 'guest', phone: booking.guest_phone, eventSuffix: 'guest_countered',
        body: `The host proposed a different price for your inquiry. Review the latest proposal at https://www.xpressbnb.com/track-inquiry with your reference and email. This is not a confirmed booking.` });
      break;
    case 'inquiry_guest_accepted_counter':
      tasks.push({ role: 'host', phone: hostPhone, eventSuffix: 'host_counter_accepted', body: hostCounterAcceptedMessage(ctx) });
      break;
    case 'inquiry_guest_declined_counter':
      tasks.push({ role: 'host', phone: hostPhone, eventSuffix: 'host_counter_declined', body: hostCounterDeclinedMessage(ctx) });
      break;
    case 'inquiry_host_rejected':
      tasks.push({
        role: 'guest',
        phone: booking.guest_phone,
        eventSuffix: 'guest_rejected',
        body: guestInquiryRejectedMessage(ctx, locale),
      });
      break;
    default:
      anyFailed = true;
  }

  for (const t of tasks) {
    if (!t.phone || t.phone === '—') {
      anyFailed = true;
      await insertNotification({
        booking_id: booking.id,
        queue_id: queue.id,
        recipient_role: t.role,
        recipient_phone: t.phone || 'missing',
        event_type: `${queue.event_type}:${t.eventSuffix}`,
        locale,
        message_body: t.body,
        status: 'failed',
        error_message: 'Missing recipient phone',
      });
      continue;
    }

    const r = await sendAndRecord({
      bookingId: booking.id,
      queueId: queue.id,
      eventType: `${queue.event_type}:${t.eventSuffix}`,
      role: t.role,
      phoneDigits: t.phone,
      body: t.body,
      locale,
    });
    if (r.sent) sentCount += 1;
    else anyFailed = true;
  }

  const finalStatus = anyFailed || tasks.length === 0 ? 'failed' : 'sent';
  await rest(`booking_notification_queue?id=eq.${queue.id}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      status: finalStatus,
      processed_at: new Date().toISOString(),
    }),
  });

  return { messages: sentCount, ok: !anyFailed && tasks.length > 0 };
}

async function fetchPendingQueue(limit: number): Promise<QueueRow[]> {
  return rest<QueueRow[]>(
    `booking_notification_queue?status=eq.pending&order=created_at.asc&limit=${limit}&select=id,booking_id,event_type,payload,status`,
  );
}

async function fetchQueueById(id: string): Promise<QueueRow | null> {
  const rows = await rest<QueueRow[]>(
    `booking_notification_queue?id=eq.${id}&select=id,booking_id,event_type,payload,status&limit=1`,
  );
  return rows[0] ?? null;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeadersFor(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const results: Array<{ queue_id: string; messages: number; ok: boolean }> = [];

    if (body.queue_id) {
      const item = await fetchQueueById(body.queue_id);
      if (!item) {
        return new Response(JSON.stringify({ error: 'Queue item not found' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      const r = await processQueueItem(item);
      results.push({ queue_id: item.id, ...r });
    } else if (body.process_pending) {
      const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);
      const pending = await fetchPendingQueue(limit);
      for (const item of pending) {
        const r = await processQueueItem(item);
        results.push({ queue_id: item.id, ...r });
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide queue_id or process_pending: true' }),
        {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch {
    console.error('Notification processing failed; inspect restricted queue records.');
    return new Response(
      JSON.stringify({ error: 'Notification processing failed' }),
      {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    );
  }
});
