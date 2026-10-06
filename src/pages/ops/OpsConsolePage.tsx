import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  Home,
  Phone,
  RefreshCw,
  Shield,
  Users,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  approveOpsInquiry,
  deactivateOpsProperty,
  fetchOpsSnapshot,
  rejectOpsInquiry,
  type OpsFunnelWindow,
  type OpsInquiryRow,
  type OpsSnapshot,
} from '../../lib/opsConsole';
import OpsLiveReports from './OpsLiveReports';

type OpsConsolePageProps = {
  onNavigate: (path: string) => void;
};

function Badge({
  tone,
  children,
}: {
  tone: 'live' | 'inactive' | 'warn' | 'pending' | 'verified' | 'neutral';
  children: ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    live: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-slate-100 text-slate-600',
    warn: 'bg-amber-100 text-amber-800',
    pending: 'bg-orange-100 text-orange-800',
    verified: 'bg-sky-100 text-sky-800',
    neutral: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function FunnelPanel({ title, metrics }: { title: string; metrics: OpsFunnelWindow }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-900 mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Reviewed inquiries" value={metrics.verified_inquiries} />
        <StatCard label="Pending host" value={metrics.pending_host} />
        <StatCard
          label="Median host response"
          value={
            metrics.median_host_response_minutes != null
              ? `${metrics.median_host_response_minutes}m`
              : '—'
          }
        />
        <StatCard label="Property views (DB)" value={metrics.property_views} />
      </div>
    </div>
  );
}

function propertyHref(id: string, slug: string | null) {
  return slug ? `/property/${slug}` : `/property/${id}`;
}

export default function OpsConsolePage({ onNavigate }: OpsConsolePageProps) {
  const { user, sessionReady, signOut } = useAuth();
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [inquiryActionId, setInquiryActionId] = useState<string | null>(null);
  const [reviewQuery, setReviewQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    const result = await fetchOpsSnapshot();
    if (result.ok && result.data) {
      setSnapshot(result.data);
    } else if (result.status === 'denied') {
      setAccessDenied(true);
      setSnapshot(null);
    } else {
      setError(result.error ?? 'Failed to load');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (sessionReady && user) {
      void load();
    } else if (sessionReady && !user) {
      setLoading(false);
    }
  }, [sessionReady, user, load]);

  const handleDeactivate = async (propertyId: string, title: string) => {
    const ok = window.confirm(
      `Deactivate "${title}"?\n\nThis hides the listing from guests. You can reactivate from the host dashboard.`,
    );
    if (!ok) return;
    setDeactivatingId(propertyId);
    const result = await deactivateOpsProperty(propertyId);
    setDeactivatingId(null);
    if (!result.ok) {
      alert(result.error ?? 'Failed to deactivate');
      return;
    }
    await load();
  };

  const handleApproveInquiry = async (inq: OpsInquiryRow) => {
    const ok = window.confirm(
      `Approve & send inquiry ${inq.customer_reference ?? inq.id} to the host?`,
    );
    if (!ok) return;
    setInquiryActionId(inq.id);
    const result = await approveOpsInquiry(inq.id);
    setInquiryActionId(null);
    if (!result.ok) {
      alert(result.error ?? 'Failed to approve');
      return;
    }
    await load();
  };

  const handleRejectInquiry = async (inq: OpsInquiryRow) => {
    const reason = window.prompt('Optional note for internal records (guest is not shown this):');
    if (reason === null) return;
    setInquiryActionId(inq.id);
    const result = await rejectOpsInquiry(inq.id, reason || undefined);
    setInquiryActionId(null);
    if (!result.ok) {
      alert(result.error ?? 'Failed to reject');
      return;
    }
    await load();
  };

  const handleCallCustomer = (inq: OpsInquiryRow) => {
    const raw = inq.guest_phone ?? inq.guest_phone_masked;
    const digits = raw.replace(/\D/g, '').slice(-10);
    if (digits.length === 10) {
      window.location.href = `tel:+91${digits}`;
    } else {
      alert('Phone not available for this inquiry.');
    }
  };

  const handleWhatsAppGuest = (inq: OpsInquiryRow) => {
    const raw = inq.guest_phone ?? '';
    const digits = raw.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      alert('Phone not available for this inquiry.');
      return;
    }
    const text = `Hi ${inq.guest_name ?? 'there'}, this is XpressBNB about your inquiry ${inq.customer_reference ?? ''} for ${inq.property_title}.`;
    window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyReference = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
    } catch {
      /* ignore */
    }
  };

  const filteredPendingReview = (snapshot?.pending_review ?? []).filter((inq) => {
    const q = reviewQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (inq.customer_reference ?? '').toLowerCase().includes(q) ||
      (inq.guest_name ?? '').toLowerCase().includes(q) ||
      (inq.guest_email ?? '').toLowerCase().includes(q) ||
      inq.property_title.toLowerCase().includes(q) ||
      inq.city.toLowerCase().includes(q)
    );
  });

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Shield className="w-10 h-10 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900">XpressBNB Ops Console</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in with an internal ops account to continue.</p>
          <button
            type="button"
            onClick={() => onNavigate('/auth/login')}
            className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900">Ops access denied</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account is not on the ops allowlist. Contact the founder to add your email to{' '}
            <code className="text-xs">admin_users</code> or <code className="text-xs">OPS_ALLOWED_EMAILS</code>.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to site
          </button>
        </div>
      </div>
    );
  }

  const health = snapshot?.health;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Internal</p>
            <h1 className="text-xl font-bold">XpressBNB Ops Console</h1>
            <p className="text-xs text-slate-500">
              Launch control · {user.email}
              {snapshot?.generated_at && (
                <> · refreshed {new Date(snapshot.generated_at).toLocaleString()}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Site
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && !snapshot ? (
          <div className="flex justify-center py-24">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : health ? (
          <>
            {/* A. Launch Health */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Launch health
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                <StatCard label="Live properties" value={health.active_properties} />
                <StatCard label="Inactive" value={health.inactive_properties} />
                <StatCard label="Hosts" value={health.total_hosts} />
                <StatCard label="Hosts missing phone" value={health.hosts_missing_phone} />
                <StatCard label="Reviewed today" value={health.verified_inquiries_today} />
                <StatCard label="Pending host" value={health.pending_host_inquiries} />
                <StatCard
                  label="Cities live"
                  value={Object.keys(health.active_by_city).length}
                  sub={Object.entries(health.active_by_city)
                    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([c, n]) => `${c} (${n})`)
                    .join(' · ')}
                />
              </div>
            </section>

            {snapshot?.funnel_24h && snapshot?.funnel_7d ? (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                  Funnel snapshot
                </h2>
                <p className="mb-3 text-xs text-slate-500 leading-relaxed">
                  {snapshot.view_events_caveat ??
                    'Property views are session-deduped DB events, not GA4 totals.'}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <FunnelPanel title="Last 24 hours" metrics={snapshot.funnel_24h} />
                  <FunnelPanel title="Last 7 days" metrics={snapshot.funnel_7d} />
                </div>
              </section>
            ) : null}

            <OpsLiveReports
              titleById={Object.fromEntries((snapshot?.properties ?? []).map((p) => [p.id, p.title]))}
            />

            {/* E. Stuck Lead Alert */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Needs attention
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <AlertPanel
                  title="Pending host 15+ min"
                  items={snapshot!.alerts.stuck_pending_host.map((a) => ({
                    key: a.id,
                    label: `${a.property_title} · ${a.minutes_old}m`,
                    href: a.host_id ? `/host/${a.host_id}/dashboard/bookings` : undefined,
                  }))}
                  empty="No stuck inquiries"
                />
                <AlertPanel
                  title="Live · host phone missing"
                  items={snapshot!.alerts.active_missing_host_phone.map((a) => ({
                    key: a.id,
                    label: a.title,
                    href: propertyHref(a.id, null),
                  }))}
                  empty="All live listings have host phone"
                />
                <AlertPanel
                  title="Live · images missing"
                  items={snapshot!.alerts.active_missing_images.map((a) => ({
                    key: a.id,
                    label: `${a.title} (${a.city})`,
                    href: propertyHref(a.id, null),
                  }))}
                  empty="All live listings have images"
                />
                <AlertPanel
                  title="Live · invalid price"
                  items={snapshot!.alerts.active_invalid_price.map((a) => ({
                    key: a.id,
                    label: `${a.title} (${a.city})`,
                    href: propertyHref(a.id, null),
                  }))}
                  empty="All live listings have price"
                />
              </div>
            </section>

            {/* B. Property Readiness */}
            <section>
              <h2 className="mb-4 text-lg font-bold">Property readiness</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Host</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Images</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshot!.properties.slice(0, 100).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium">{p.title}</td>
                        <td className="px-4 py-3">{p.city}</td>
                        <td className="px-4 py-3">{p.host_name}</td>
                        <td className="px-4 py-3">
                          {p.is_active ? <Badge tone="live">Live</Badge> : <Badge tone="inactive">Inactive</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          {p.host_phone_present ? (
                            <Badge tone="verified">Present</Badge>
                          ) : (
                            <Badge tone="warn">Missing phone</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.images_present ? <Badge tone="neutral">OK</Badge> : <Badge tone="warn">Missing</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          {p.price_present ? <Badge tone="neutral">OK</Badge> : <Badge tone="warn">Missing</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <LinkBtn href={propertyHref(p.id, p.slug)} onNavigate={onNavigate} />
                            {p.is_active && (
                              <button
                                type="button"
                                disabled={deactivatingId === p.id}
                                onClick={() => void handleDeactivate(p.id, p.title)}
                                className="text-xs font-semibold text-amber-700 hover:underline disabled:opacity-50"
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* C. Host Readiness */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Users className="w-5 h-5 text-emerald-600" />
                Host readiness
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Host</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Live listings</th>
                      <th className="px-4 py-3">Subscription</th>
                      <th className="px-4 py-3">Dashboard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshot!.hosts.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium">{h.name}</td>
                        <td className="px-4 py-3 text-slate-600">{h.email}</td>
                        <td className="px-4 py-3">
                          {h.phone_present ? (
                            <Badge tone="verified">Present</Badge>
                          ) : (
                            <Badge tone="warn">Missing phone</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">{h.active_property_count}</td>
                        <td className="px-4 py-3">
                          {h.subscription_active ? (
                            <Badge tone="live">Active</Badge>
                          ) : (
                            <Badge tone="neutral">{h.subscription_status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <LinkBtn
                            href={`/host/${h.id}/dashboard/overview`}
                            onNavigate={onNavigate}
                            label="Open"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* C. Quality review queue */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                New inquiries — quality review
              </h2>
              <div className="mb-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <input
                  type="search"
                  value={reviewQuery}
                  onChange={(e) => setReviewQuery(e.target.value)}
                  placeholder="Search reference, guest, property…"
                  className="w-full sm:max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  aria-label="Search inquiries awaiting review"
                />
                <p className="text-xs text-slate-500 shrink-0">
                  {filteredPendingReview.length} awaiting review
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Guest</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(snapshot!.pending_review ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No inquiries awaiting review.
                        </td>
                      </tr>
                    ) : filteredPendingReview.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No inquiries match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredPendingReview.map((inq) => (
                        <tr key={inq.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {inq.created_at ? new Date(inq.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-bold">
                            {inq.customer_reference ? (
                              <button
                                type="button"
                                onClick={() => void handleCopyReference(inq.customer_reference!)}
                                className="hover:text-emerald-700 underline underline-offset-2"
                                title="Copy reference"
                              >
                                {inq.customer_reference}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{inq.guest_name ?? '—'}</p>
                            <p className="text-xs text-slate-500">{inq.guest_email ?? ''}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{inq.property_title}</p>
                            <p className="text-xs text-slate-500">{inq.city}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone="pending">Preparing</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {(inq.spam_score ?? 0) >= 50 ? (
                              <Badge tone="warn">{inq.spam_score}</Badge>
                            ) : (
                              <span className="text-slate-600">{inq.spam_score ?? 0}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={inquiryActionId === inq.id}
                                onClick={() => void handleApproveInquiry(inq)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve & Send
                              </button>
                              <button
                                type="button"
                                disabled={inquiryActionId === inq.id}
                                onClick={() => void handleRejectInquiry(inq)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCallCustomer(inq)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Call
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWhatsAppGuest(inq)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                              >
                                WhatsApp
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* D. Inquiry Control */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Home className="w-5 h-5 text-emerald-600" />
                Recent inquiries sent to hosts
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Guest phone</th>
                      <th className="px-4 py-3">Host</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshot!.inquiries.map((inq) => (
                      <tr key={inq.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {inq.created_at ? new Date(inq.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium">{inq.property_title}</td>
                        <td className="px-4 py-3">{inq.city}</td>
                        <td className="px-4 py-3">
                          {inq.status === 'inquiry_preparing' ? (
                            <Badge tone="pending">Preparing</Badge>
                          ) : inq.status === 'pending_host' ? (
                            <Badge tone="pending">Sent to host</Badge>
                          ) : inq.phone_verified ? (
                            <Badge tone="verified">Quality reviewed</Badge>
                          ) : (
                            <Badge tone="neutral">{inq.status ?? '—'}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{inq.guest_phone_masked}</td>
                        <td className="px-4 py-3">{inq.host_name}</td>
                        <td className="px-4 py-3">
                          {inq.amount != null ? `₹${Number(inq.amount).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <LinkBtn href={propertyHref(inq.property_id, null)} onNavigate={onNavigate} />
                            {inq.host_id && (
                              <LinkBtn
                                href={`/host/${inq.host_id}/dashboard/bookings`}
                                onNavigate={onNavigate}
                                label="Host"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function AlertPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: { key: string; label: string; href?: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.slice(0, 8).map((item) => (
            <li key={item.key}>
              {item.href ? (
                <a href={item.href} className="text-emerald-700 hover:underline">
                  {item.label}
                </a>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          ))}
          {items.length > 8 && (
            <li className="text-xs text-slate-400">+{items.length - 8} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

function LinkBtn({
  href,
  onNavigate,
  label = 'View',
}: {
  href: string;
  onNavigate: (path: string) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
    >
      {label}
      <ExternalLink className="w-3 h-3" />
    </button>
  );
}
