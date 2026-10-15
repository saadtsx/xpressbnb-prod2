import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Star, MessageSquare, User } from 'lucide-react';

// `external_reviews` is in database.types.ts but is currently scoped to a
// dedicated Insert/Update path. We re-derive the Row shape here for clarity
// and to keep this page resilient if optional columns drift.
interface ExternalReviewRow {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  review_date: string;
  provider: string;
  source_url: string | null;
  created_at: string | null;
}

export default function ReviewsPage() {
  const { host } = useAuth();
  const [reviews, setReviews] = useState<ExternalReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avgRating: 0,
    totalReviews: 0,
    ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

  useEffect(() => {
    if (host?.id) {
      loadReviews();
    }
  }, [host?.id]);

  const loadReviews = async () => {
    if (!host?.id) return;

    try {
      const { data, error } = await supabase
        .from('external_reviews')
        .select('*')
        .eq('host_id', host.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reviewsData = data || [];
      setReviews(reviewsData);

      if (reviewsData.length > 0) {
        const total = reviewsData.length;
        const sum = reviewsData.reduce((acc, r) => acc + Number(r.rating || 0), 0);
        const avgRating = sum / total;

        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviewsData.forEach((r) => {
          const rating = Math.round(r.rating);
          if (rating >= 1 && rating <= 5) {
            breakdown[rating as keyof typeof breakdown]++;
          }
        });

        setStats({ avgRating, totalReviews: total, ratingBreakdown: breakdown });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className="w-5 h-5"
        style={{
          color: i < rating ? '#D97706' : 'rgba(15,23,42,0.18)',
          fill: i < rating ? '#D97706' : 'transparent',
        }}
      />
    ));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--xpx-warm)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="xpx-eyebrow">Trust</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-xpx-text tracking-tight mt-1">Reviews</h1>
        <p className="text-xpx-muted mt-2">Imported review records — not verified XpressBNB stays</p>
      </div>

      <p className="rounded-xl border p-4 text-sm text-xpx-muted">Verified-stay reviews are not available: this inquiry workflow does not verify arrival, checkout or settled payments. Imported reviews do not establish completed stays. Report inaccurate records or request moderation at <a className="underline" href="mailto:support@xpressbnb.com">support@xpressbnb.com</a>.</p>
      {stats.totalReviews > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className="rounded-2xl p-6"
            style={{
              background:
                'linear-gradient(135deg, rgba(80,200,120,0.06) 0%, var(--xpx-surface) 100%)',
              border: '1px solid var(--xpx-border-strong)',
              boxShadow: '0 12px 40px rgba(15,23,42,0.06)',
            }}
          >
            <div className="text-center">
              <p className="text-4xl sm:text-5xl font-extrabold text-xpx-text">{stats.avgRating.toFixed(1)}</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                {renderStars(Math.round(stats.avgRating))}
              </div>
              <p className="text-sm text-xpx-muted mt-2">{stats.totalReviews} reviews</p>
            </div>
          </div>

          <div
            className="lg:col-span-2 rounded-2xl p-6"
            style={{ background: 'var(--xpx-surface)', border: '1px solid var(--xpx-border)', boxShadow: '0 12px 40px rgba(15,23,42,0.06)' }}
          >
            <h3 className="font-bold text-xpx-text mb-4">Rating Breakdown</h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.ratingBreakdown[rating as keyof typeof stats.ratingBreakdown];
                const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-xpx-muted w-12">{rating} star</span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--xpx-surface-light)' }}>
                      <div className="h-full" style={{ width: `${percentage}%`, background: 'var(--xpx-warm)' }} />
                    </div>
                    <span className="text-sm text-xpx-muted w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--xpx-surface)', border: '1px solid var(--xpx-border)', boxShadow: '0 12px 40px rgba(15,23,42,0.06)' }}
      >
        <h2 className="text-xl font-bold text-xpx-text mb-6">All Reviews</h2>
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-xpx-subtle mx-auto mb-4" />
            <h3 className="text-xl font-bold text-xpx-text mb-2">No reviews yet</h3>
            <p className="text-xpx-muted">Reviews from external platforms will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <div key={review.id} className="pb-6 last:pb-0" style={{ borderBottom: '1px solid var(--xpx-border)' }}>
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--xpx-surface-light)' }}
                  >
                    <User className="w-6 h-6 text-xpx-subtle" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-xpx-text">{review.reviewer_name || 'Anonymous'}</p>
                        <p className="text-xs text-xpx-subtle">
                          {review.created_at
                            ? new Date(review.created_at).toLocaleDateString()
                            : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">{renderStars(Math.round(review.rating))}</div>
                    </div>
                    {/* Column is named `comment` / `provider` in the DB; the
                        old code referenced `review_text` / `platform`, which
                        never resolved at runtime and silently hid review
                        content. */}
                    {review.comment && (
                      <p className="text-xpx-muted mt-2">{review.comment}</p>
                    )}
                    {review.provider && (
                      <span
                        className="inline-block mt-2 px-2 py-1 text-[10px] uppercase tracking-wider rounded-full font-bold"
                        style={{ background: 'rgba(37,99,235,0.10)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.30)' }}
                      >
                        From {review.provider}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
