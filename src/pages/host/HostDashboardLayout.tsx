import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Home,
  Building2,
  Tag,
  Calendar,
  BookOpen,
  DollarSign,
  Activity,
  Star,
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { XPRESSBNB_LOGO_NAV_IMG_CLASS, XPRESSBNB_LOGO_PATH } from '../../lib/branding';
import { theme } from '../../lib/theme';

interface HostDashboardLayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  hostId: string;
}

/**
 * HostDashboardLayout — light Gen Z sidebar shell for the host area.
 * Clean white sidebar, almost-black ink, warm orange brand accent.
 * Mobile uses a frosted-white slide-in drawer.
 */
export default function HostDashboardLayout({
  children,
  currentPage,
  onNavigate,
  hostId,
}: HostDashboardLayoutProps) {
  const { host, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingInquiryCount, setPendingInquiryCount] = useState(0);

  useEffect(() => {
    if (!host?.id) {
      setPendingInquiryCount(0);
      return;
    }

    const loadPendingCount = async () => {
      const { count, error } = await supabase
        .from('host_inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', host.id)
        .in('status', ['inquiry_preparing', 'inquiry_pending', 'pending_host']);

      if (!error) setPendingInquiryCount(count ?? 0);
    };

    void loadPendingCount();

    const channel = supabase
      .channel(`host-nav-pending-${host.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `host_id=eq.${host.id}`,
        },
        () => {
          void loadPendingCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [host?.id]);

  const navigation = [
    { id: 'overview', name: 'Overview', icon: Home, path: `/host/${hostId}/dashboard/overview` },
    { id: 'properties', name: 'Properties', icon: Building2, path: `/host/${hostId}/dashboard/properties` },
    { id: 'brand', name: 'Brand', icon: Tag, path: `/host/${hostId}/dashboard/brand` },
    { id: 'calendar', name: 'Calendar', icon: Calendar, path: `/host/${hostId}/dashboard/calendar` },
    { id: 'bookings', name: 'Inquiries', icon: BookOpen, path: `/host/${hostId}/dashboard/bookings` },
    { id: 'earnings', name: 'Earnings', icon: DollarSign, path: `/host/${hostId}/dashboard/earnings` },
    { id: 'realtime', name: 'Analytics', icon: Activity, path: `/host/${hostId}/dashboard/realtime` },
    { id: 'reviews', name: 'Reviews', icon: Star, path: `/host/${hostId}/dashboard/reviews` },
    { id: 'subscription', name: 'Subscription', icon: CreditCard, path: `/host/${hostId}/dashboard/subscription` },
    { id: 'settings', name: 'Settings', icon: Settings, path: `/host/${hostId}/dashboard/settings` },
    { id: 'support', name: 'Support', icon: HelpCircle, path: `/host/${hostId}/dashboard/support` },
  ];

  const handleSignOut = async () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await signOut();
  };

  const initial = host?.name?.charAt(0).toUpperCase() ?? 'H';

  return (
    <div className="min-h-screen xpx-page">
      {/* Mobile topbar — frosted white glass */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          borderBottom: '1px solid var(--xpx-border)',
          boxShadow: '0 -4px 24px rgba(15,23,42,0.04)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-base leading-none">
            <img
              src={XPRESSBNB_LOGO_PATH}
              alt=""
              className={XPRESSBNB_LOGO_NAV_IMG_CLASS}
              width={44}
              height={44}
              decoding="async"
            />
            <div>
              <p className="font-extrabold tracking-tight text-xpx-text leading-none">
                Xpress<span style={{ color: theme.accent }}>BnB</span>
              </p>
              <p className="text-[10px] uppercase tracking-wider text-xpx-subtle mt-0.5">
                Host Dashboard
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-lg text-xpx-text hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 z-30 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 z-40 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--xpx-surface)',
          borderRight: '1px solid var(--xpx-border)',
        }}
      >
        <div className="h-full flex flex-col">
          {/* Brand */}
          <div className="p-6" style={{ borderBottom: '1px solid var(--xpx-border)' }}>
            <div className="flex items-center gap-2.5 text-lg leading-none">
              <img
                src={XPRESSBNB_LOGO_PATH}
                alt=""
                className={XPRESSBNB_LOGO_NAV_IMG_CLASS}
                width={48}
                height={48}
                decoding="async"
              />
              <div>
                <p className="font-extrabold tracking-tight text-xpx-text leading-none">
                  Xpress<span style={{ color: theme.accent }}>BnB</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-xpx-subtle mt-1">
                  Host Dashboard
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Host card */}
            <div
              className="mb-6 p-3 rounded-xl flex items-center gap-3"
              style={{ background: 'var(--xpx-surface-light)', border: '1px solid var(--xpx-border)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base"
                style={{ background: theme.accent, color: '#ffffff' }}
              >
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-xpx-text truncate">{host?.name}</p>
                <p className="text-xs text-xpx-subtle truncate">{host?.email}</p>
              </div>
            </div>

            <p className="px-2 mb-2 xpx-eyebrow">Manage</p>
            <nav className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={
                      isActive
                        ? { background: theme.accent, color: '#ffffff' }
                        : { color: 'rgba(15,23,42,0.75)' }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = '';
                    }}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {item.id === 'bookings' && pendingInquiryCount > 0 && (
                      <span
                        className="min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-center"
                        style={{ background: 'rgba(220,38,38,0.12)', color: '#B91C1C' }}
                        aria-label={`${pendingInquiryCount} new inquiries`}
                      >
                        {pendingInquiryCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4" style={{ borderTop: '1px solid var(--xpx-border)' }}>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-xpx-muted hover:bg-slate-100 hover:text-xpx-text transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
