/** GA4 funnel events — no PII. gtag loads deferred via initDeferredAnalytics(). */

import type { CookieConsentState } from './cookieConsent';

export const GA4_MEASUREMENT_ID = 'G-HLZN3RJKTN';

/** Google Ads conversion tag — configured when marketing cookie consent is granted. */
export const GOOGLE_ADS_ID = 'AW-17923088071';

export type XpressEventName =
  | 'price_terms_viewed'
  | 'price_comparison_unavailable'
  | 'property_view'
  | 'property_card_click'
  | 'city_page_view'
  | 'request_to_book_click'
  | 'booking_form_started'
  | 'otp_send_requested'
  | 'otp_send_success'
  | 'otp_verify_success'
  | 'otp_verify_failed'
  | 'inquiry_submit_started'
  | 'inquiry_submit_success'
  | 'inquiry_submit_failed'
  | 'inquiry_whatsapp_fallback'
  | 'inquiry_success'
  | 'host_whatsapp_click'
  | 'host_call_click'
  | 'property_load_failed'
  | 'property_list_load_failed'
  | 'pwa_update_available'
  | 'pwa_update_applied'
  | 'location_prompt_shown'
  | 'location_permission_granted'
  | 'location_permission_denied'
  | 'nearby_results_loaded'
  | 'nearby_fallback_shown'
  | 'nearby_city_detected'
  | 'nearby_card_clicked'
  | 'nearby_booking_started'
  | 'nearby_booking_completed'
  | 'auto_scroll_triggered'
  | 'booking_step_completed'
  | 'booking_abandonment'
  | 'nearby_feed_viewed'
  | 'map_opened'
  | 'map_property_clicked'
  | 'property_recommended'
  | 'destination_recommended'
  | 'booking_progress_step'
  | 'nearby_returning_user'
  | 'check_availability_click'
  | 'share_clicked'
  | 'booking_calendar_open'
  | 'property_scroll_depth'
  | 'amenities_toggled'
  | 'gallery_opened'
  | 'save_clicked';

export type InquiryType = 'book_pay_later' | 'make_offer';

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type AppMode = 'browser' | 'standalone_pwa';

export type XpressEventParams = {
  property_id?: string;
  property_slug?: string;
  city?: string;
  inquiry_type?: InquiryType;
  source_route?: string;
  device_class?: DeviceClass;
  app_mode?: AppMode;
  booking_step?: string;
  error_category?: string;
  response_time_bucket?: string;
  distance_km_bucket?: string;
  nearby_source?: string;
  abandonment_step?: string;
  feed_rail?: string;
  recommendation_type?: string;
  share_method?: string;
  photo_index?: number | string;
  photo_total?: number | string;
  scroll_depth?: number | string;
  action?: string;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type GtagLoadOptions = {
  ga4: boolean;
  ads: boolean;
};

let gtagScriptLoaded = false;
let gtagScriptLoading = false;
let gtagLoadAborted = false;
let gtagLoadScheduled = false;
let pendingLoad: GtagLoadOptions = { ga4: false, ads: false };
const configuredIds = new Set<string>();

/** In-memory gtag stub — queues commands until googletagmanager.com script loads. */
export function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
}

function mergePendingLoad(options: GtagLoadOptions): void {
  pendingLoad = {
    ga4: pendingLoad.ga4 || options.ga4,
    ads: pendingLoad.ads || options.ads,
  };
}

function scheduleDeferredGtagLoad(options: GtagLoadOptions): void {
  if (typeof window === 'undefined' || gtagLoadAborted) return;
  if (!options.ga4 && !options.ads) return;

  mergePendingLoad(options);

  if (gtagScriptLoaded) {
    applyGtagConfigs(pendingLoad);
    return;
  }

  if (gtagLoadScheduled) return;
  gtagLoadScheduled = true;

  const run = () => {
    if (gtagLoadAborted) return;
    void loadGtagScript();
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.addEventListener('load', () => window.setTimeout(run, 1), { once: true });
  }
}

function applyGtagConfigs(options: GtagLoadOptions): void {
  if (typeof window.gtag !== 'function') return;

  if (options.ga4 && !configuredIds.has(GA4_MEASUREMENT_ID)) {
    window.gtag('config', GA4_MEASUREMENT_ID);
    configuredIds.add(GA4_MEASUREMENT_ID);
  }

  if (options.ads && !configuredIds.has(GOOGLE_ADS_ID)) {
    window.gtag('config', GOOGLE_ADS_ID, { anonymize_ip: true });
    configuredIds.add(GOOGLE_ADS_ID);
  }
}

async function loadGtagScript(): Promise<void> {
  if (gtagScriptLoaded || gtagScriptLoading || gtagLoadAborted) return;
  if (!pendingLoad.ga4 && !pendingLoad.ads) return;

  gtagScriptLoading = true;
  ensureGtagStub();

  const loaderId = pendingLoad.ga4 ? GA4_MEASUREMENT_ID : GOOGLE_ADS_ID;

  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${loaderId}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('gtag.js failed to load'));
      document.head.appendChild(script);
    });

    window.gtag!('js', new Date());
    applyGtagConfigs(pendingLoad);
    gtagScriptLoaded = true;
  } catch {
    /* non-fatal — analytics must never break booking */
  } finally {
    gtagScriptLoading = false;
  }
}

/** Prevent a scheduled idle load when the user opts out of analytics. */
export function abortDeferredGtagLoad(): void {
  gtagLoadAborted = true;
}

/** Apply cookie consent to GA4 / Google Ads loading (called from cookieConsent). */
export function applyGtagConsent(analytics: boolean, marketing: boolean): void {
  ensureGtagStub();

  if (!analytics) {
    abortDeferredGtagLoad();
    return;
  }

  gtagLoadAborted = false;
  scheduleDeferredGtagLoad({ ga4: true, ads: marketing });
}

/**
 * Boot-time analytics init — stub gtag immediately (no network), load library on idle.
 * Called from initCookieConsent() before React render.
 */
export function initDeferredAnalytics(stored: CookieConsentState | null): void {
  ensureGtagStub();

  if (stored) {
    if (stored.analytics) {
      applyGtagConsent(stored.analytics, stored.marketing);
    }
    return;
  }

  // No consent decision yet — defer GA4 off the critical path; Ads wait for marketing consent.
  scheduleDeferredGtagLoad({ ga4: true, ads: false });
}

export function getDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function getAppMode(): AppMode {
  if (typeof window === 'undefined') return 'browser';
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  ) {
    return 'standalone_pwa';
  }
  return 'browser';
}

export function bucketResponseMs(ms: number): string {
  if (ms < 1000) return 'under_1s';
  if (ms < 3000) return '1s_3s';
  if (ms < 8000) return '3s_8s';
  return 'over_8s';
}

export function categorizeBookingError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('date') || m.includes('check-in') || m.includes('check-out')) return 'dates';
  if (m.includes('phone') || m.includes('otp') || m.includes('verify')) return 'verification';
  if (m.includes('unavailable')) return 'availability';
  if (m.includes('schema') || m.includes('database')) return 'server_config';
  if (m.includes('payment') || m.includes('total')) return 'pricing';
  return 'unknown';
}

export function trackXpressEvent(
  name: XpressEventName,
  params?: Partial<XpressEventParams>,
): void {
  try {
    if (typeof window === 'undefined') return;
    ensureGtagStub();
    if (typeof window.gtag !== 'function') return;

    const payload: Record<string, string> = {
      device_class: getDeviceClass(),
      app_mode: getAppMode(),
      source_route: window.location.pathname,
    };

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          payload[key] = String(value);
        }
      }
    }

    window.gtag('event', name, {
      send_to: GA4_MEASUREMENT_ID,
      ...payload,
    });
  } catch {
    /* fail safely — analytics must never break booking */
  }
}

export type AnalyticsScope = Pick<
  XpressEventParams,
  'property_id' | 'property_slug' | 'city' | 'inquiry_type'
>;
