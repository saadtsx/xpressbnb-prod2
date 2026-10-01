import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, User, Phone, AlertCircle, ArrowRight } from 'lucide-react';
import AuthShell, { type AuthVisual } from './AuthShell';
import { theme } from '../../lib/theme';
import HostValueProp from '../../components/host/HostValueProp';

const REGISTER_VISUAL: AuthVisual = {
  image: '/images/homepage/city-moods/rishikesh-960.webp',
  imageAlt: '',
  kicker: 'For hosts',
  headline: 'List it. Own it. Keep it.',
  caption: 'Zero platform commission — guests pay you directly, every single time.',
  trustLines: ['Free to list your first stay', 'You set the price, you keep it'],
};

interface RegisterPageProps {
  onNavigate: (page: 'login') => void;
}

export default function RegisterPage({ onNavigate }: RegisterPageProps) {
  const { signUp, signInWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(formData.email, formData.password, formData.name, formData.phone);
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Become a host"
      title="0% commission — guests pay you directly"
      subtitle="List your first property free. Upgrade later for calendar sync and a verified badge."
      visual={REGISTER_VISUAL}
      footer={
        <>
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('login')}
            className="font-bold text-xpx-text hover:opacity-80 transition-opacity"
          >
            Sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.32)' }}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#B91C1C' }} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-xpx-subtle" />
            <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} required className="xpx-input pl-12" placeholder="John Doe" autoComplete="name" />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-xpx-subtle" />
            <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="xpx-input pl-12" placeholder="you@example.com" autoComplete="email" />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-xpx-subtle" />
            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="xpx-input pl-12" placeholder="+91 98765 43210" autoComplete="tel" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-xpx-subtle" />
              <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required className="xpx-input pl-12" placeholder="6+ chars" autoComplete="new-password" />
            </div>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs uppercase tracking-wide font-bold text-xpx-muted mb-2">
              Confirm
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-xpx-subtle" />
              <input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required className="xpx-input pl-12" placeholder="Re-enter" autoComplete="new-password" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="group w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: theme.accent, color: '#ffffff', boxShadow: '0 8px 32px rgba(80,200,120,0.35)' }}
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Creating account…
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </span>
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full xpx-divider"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="px-4 text-xpx-subtle" style={{ background: '#FFFFFF' }}>
            Or continue with
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading || googleLoading}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-xpx-text transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#FFFFFF', border: '1px solid var(--xpx-border-strong)' }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {googleLoading ? 'Connecting…' : 'Sign up with Google'}
      </button>

      <div className="mt-6 -mx-2 sm:-mx-0">
        <HostValueProp
          variant="minimal"
          showHeader={false}
          showComparison
          showSocialProof={false}
          showUpgradeNudge={false}
        />
      </div>
    </AuthShell>
  );
}
