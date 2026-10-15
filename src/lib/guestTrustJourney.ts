/**
 * Guest trust journey — progressive stages backed by real product events only.
 * No gamification, levels, or invented milestones.
 */

import { getOnboardingEngagement } from './guestOnboarding';
import type { FrequentAmigoStatus } from './inquiryHostContact';
import { getGuestTrustStore, type GuestInquiryRecord } from './guestTrustStorage';
import { listSavedListings } from './savedListingsStorage';

export type GuestTrustStageId =
  | 'visit'
  | 'browse'
  | 'save'
  | 'inquiry'
  | 'guest_id'
  | 'track'
  | 'trusted_guest'
  | 'first_stay'
  | 'verified_traveller'
  | 'repeat_stays'
  | 'preferred_guest';

export type GuestTrustStage = {
  id: GuestTrustStageId;
  label: string;
  description: string;
};

export const GUEST_TRUST_STAGES: GuestTrustStage[] = [
  {
    id: 'visit',
    label: 'Visit',
    description: 'You arrived on XpressBnB — no account needed.',
  },
  {
    id: 'browse',
    label: 'Browse',
    description: 'You explored real listings with transparent host pricing.',
  },
  {
    id: 'save',
    label: 'Save listings',
    description: 'Stays you saved stay on this device for easy return visits.',
  },
  {
    id: 'inquiry',
    label: 'Send inquiry',
    description: 'You shared dates and a note — privately reviewed before the host sees you.',
  },
  {
    id: 'guest_id',
    label: 'Guest ID',
    description: 'Your private reference for this and future inquiries.',
  },
  {
    id: 'track',
    label: 'Track inquiry',
    description: 'Follow progress anytime with your Guest ID and email.',
  },
  {
    id: 'trusted_guest',
    label: 'Inquiry reviewed',
    description: 'An inquiry passed quality review — host contact was released.',
  },
  {
    id: 'first_stay',
    label: 'First completed stay',
    description: 'Unavailable until stay completion can be reliably verified.',
  },
  {
    id: 'verified_traveller',
    label: 'Verified traveller',
    description: 'You have a completed stay and inquiry history with us.',
  },
  {
    id: 'repeat_stays',
    label: 'Multiple successful stays',
    description: 'More than one completed stay on record.',
  },
  {
    id: 'preferred_guest',
    label: 'Preferred guest',
    description: 'Unavailable until a fair evidence and appeal policy exists.',
  },
];

export type GuestTrustContextInput = {
  inquiries?: GuestInquiryRecord[];
  hasTrackedPage?: boolean;
  savedCount?: number;
  listingBrowseCount?: number;
  frequentAmigo?: FrequentAmigoStatus | null;
};

export type GuestTrustStageState = GuestTrustStage & {
  reached: boolean;
  current: boolean;
};


function hasTrustedInquiry(inquiries: GuestInquiryRecord[]): boolean {
  return inquiries.some(
    (row) => row.phoneVerified === true && Boolean(row.reviewedAt),
  );
}

/** Build trust context from storage + optional overrides (e.g. fresh inquiry). */
export function buildGuestTrustContext(
  overrides: GuestTrustContextInput = {},
): Required<GuestTrustContextInput> & {
  inquiryCount: number;
  completedStayCount: number;
  primaryGuestId: string | null;
  hasTrustedInquiry: boolean;
} {
  const store = getGuestTrustStore();
  const engagement = getOnboardingEngagement();
  const inquiries = overrides.inquiries ?? store.inquiries;
  const inquiryCount = inquiries.length;
  const completedStayCount = 0; // Browser history and legacy status do not prove a stay.
  const sorted = [...inquiries].sort((a, b) => b.submittedAt - a.submittedAt);

  return {
    inquiries,
    hasTrackedPage: overrides.hasTrackedPage ?? store.hasTrackedPage,
    savedCount: overrides.savedCount ?? listSavedListings().length,
    listingBrowseCount: overrides.listingBrowseCount ?? engagement.listingBrowseCount,
    frequentAmigo: overrides.frequentAmigo ?? null,
    inquiryCount,
    completedStayCount,
    primaryGuestId: sorted[0]?.customerReference ?? null,
    hasTrustedInquiry: hasTrustedInquiry(inquiries),
  };
}

function isStageReached(id: GuestTrustStageId, ctx: ReturnType<typeof buildGuestTrustContext>): boolean {
  switch (id) {
    case 'visit':
      return true;
    case 'browse':
      return ctx.listingBrowseCount > 0 || ctx.inquiryCount > 0;
    case 'save':
      return ctx.savedCount > 0;
    case 'inquiry':
      return ctx.inquiryCount > 0;
    case 'guest_id':
      return Boolean(ctx.primaryGuestId);
    case 'track':
      return ctx.hasTrackedPage;
    case 'trusted_guest':
      return ctx.hasTrustedInquiry;
    case 'first_stay':
    case 'verified_traveller':
    case 'repeat_stays':
    case 'preferred_guest':
      return false;
    default:
      return false;
  }
}

/** Ordered stage states for UI — exactly one `current` when any progress exists. */
export function resolveGuestTrustStages(
  input: GuestTrustContextInput = {},
): GuestTrustStageState[] {
  const ctx = buildGuestTrustContext(input);
  const reachedFlags = GUEST_TRUST_STAGES.map((stage) => isStageReached(stage.id, ctx));
  let currentIndex = -1;
  for (let i = reachedFlags.length - 1; i >= 0; i -= 1) {
    if (reachedFlags[i]) {
      currentIndex = i;
      break;
    }
  }

  return GUEST_TRUST_STAGES.map((stage, index) => ({
    ...stage,
    reached: reachedFlags[index],
    current: index === currentIndex,
  }));
}

/** Compact subset for post-inquiry success — omits future-only stages in collapsed view. */
export function resolvePostInquiryTrustStages(
  customerReference: string,
  frequentAmigo?: FrequentAmigoStatus | null,
): GuestTrustStageState[] {
  const ctx = buildGuestTrustContext({
    inquiries: [
      ...(getGuestTrustStore().inquiries.filter(
        (row) => row.customerReference !== customerReference.trim().toUpperCase(),
      )),
      { customerReference: customerReference.trim().toUpperCase(), submittedAt: Date.now() },
    ],
    frequentAmigo,
  });
  return resolveGuestTrustStages({
    inquiries: ctx.inquiries,
    frequentAmigo,
  }).filter((stage) =>
    ['inquiry', 'guest_id', 'track', 'trusted_guest', 'first_stay'].includes(stage.id)
      ? true
      : stage.reached,
  );
}
