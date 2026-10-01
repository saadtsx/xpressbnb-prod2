import { Home, Compass, Bookmark, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GlassSurface from './glass/GlassSurface';

interface MobileBottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const TABS = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'explore', label: 'Explore', icon: Compass, path: '/explore' },
  { id: 'saved', label: 'Saved', icon: Bookmark, path: '/saved' },
  { id: 'profile', label: 'Profile', icon: User, path: '/auth/login' },
] as const;

export default function MobileBottomNav({ currentPath, onNavigate }: MobileBottomNavProps) {
  const { user, host } = useAuth();

  const shouldHide =
    currentPath.startsWith('/auth') ||
    currentPath.startsWith('/host/') ||
    currentPath.startsWith('/ops') ||
    currentPath.startsWith('/track-inquiry') ||
    currentPath.startsWith('/inquiry/success/') ||
    currentPath.startsWith('/guest/welcome/') ||
    currentPath.includes('/property/') ||
    currentPath.startsWith('/booking/') ||
    ['about', 'blog', 'privacy', 'terms'].includes(
      new URLSearchParams(window.location.search).get('page') ?? '',
    );

  if (shouldHide) return null;

  const getActiveTab = () => {
    if (currentPath === '/saved') return 'saved';
    if (currentPath === '/' || currentPath === '') return 'home';
    if (currentPath === '/explore' || currentPath.startsWith('/stays/')) return 'explore';
    return 'home';
  };

  const activeTab = getActiveTab();

  const handleTabClick = (tab: typeof TABS[number]) => {
    if (tab.id === 'home') {
      if (currentPath === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        onNavigate('/');
      }
    } else if (tab.id === 'profile') {
      if (user && host) {
        onNavigate(`/host/${host.id}/dashboard/overview`);
      } else {
        onNavigate('/auth/login');
      }
    } else {
      onNavigate(tab.path);
    }
  };

  return (
    <nav
      className="xpx-glass-dock fixed bottom-0 left-0 right-0 z-40 md:hidden"
      data-homepage={currentPath === '/' || currentPath === '' ? 'true' : undefined}
      aria-label="Primary"
    >
      <GlassSurface className="xpx-bottom-glass" radius={currentPath === '/' || currentPath === '' ? 0 : 28}>
        <div className="flex items-stretch justify-around px-2" style={{ minHeight: 64 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className="relative flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl motion-reduce:transition-none motion-reduce:active:scale-100 active:opacity-80 transition-opacity duration-150"
                style={{
                  color: isActive ? '#046348' : '#46594f',
                  minHeight: 56,
                }}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tab.label}
              >
                {/* Active pill behind the icon — slides in with spring easing.
                    Subtle warm tint, never loud. */}
                <span
                  className="absolute inset-x-3 top-1.5 bottom-1.5 rounded-2xl transition-colors duration-200 motion-reduce:transition-none"
                  style={{
                    background: isActive ? 'rgba(5,150,105,0.1)' : 'transparent',
                  }}
                />
                <Icon
                  className="w-6 h-6 relative z-10"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span
                  className="relative z-10 text-xs leading-tight"
                  style={{ fontWeight: isActive ? 600 : 500 }}
                >
                  {tab.id === 'profile' && user ? 'Dashboard' : tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </GlassSurface>
    </nav>
  );
}
