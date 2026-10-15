import { Check, Circle } from 'lucide-react';
import type { InquiryTrackStatus } from '../../lib/inquirySubmit';

export type TimelineStep = {
  id: string;
  label: string;
  state: 'done' | 'active' | 'upcoming';
};

function mapTrackStatusToSteps(displayStatus: InquiryTrackStatus): TimelineStep[] {
  const order: Array<{ id: string; label: string }> = [
    { id: 'received', label: 'Inquiry received' },
    { id: 'review', label: 'Quality review in progress' },
    { id: 'sent', label: 'Sent to host' },
    { id: 'viewed', label: 'Host reviewing' },
  ];

  const responseLabels: Partial<Record<InquiryTrackStatus, string>> = {
    review_declined: 'Closed during operations review',
    accepted: 'Host accepted — final agreement pending', rejected: 'Host declined', countered: 'Counteroffer — guest agreement pending',
    counter_accepted: 'You accepted the counteroffer — final agreement pending', counter_declined: 'You declined the counteroffer',
    cancelled: 'Inquiry cancelled', legacy_unverified: 'Legacy status needs verification', host_responded: 'Host responded', completed: 'Completion needs verification',
  };
  if (displayStatus === 'review_declined') return [{ id: 'received', label: 'Inquiry received', state: 'done' }, { id: 'closed', label: 'Closed during operations review', state: 'active' }];
  const response = responseLabels[displayStatus];
  if (response) order.push({ id: 'response', label: response });
  const activeIndex = response ? 4 : displayStatus === 'viewed_by_host' ? 3 : displayStatus === 'sent_to_host' ? 2 : 1;
  return order.map((step, index) => ({ ...step, state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'upcoming' }));
}

type InquiryStatusTimelineProps = {
  displayStatus?: InquiryTrackStatus;
  /** Immediate post-submit: first two steps light up */
  variant?: 'submit' | 'track';
  className?: string;
};

export default function InquiryStatusTimeline({
  displayStatus = 'preparing',
  variant = 'submit',
  className = '',
}: InquiryStatusTimelineProps) {
  const steps =
    variant === 'submit'
      ? [
          { id: 'received', label: 'Inquiry received', state: 'done' as const },
          { id: 'review', label: 'Quality review in progress', state: 'active' as const },
          { id: 'sent', label: 'Sent to host', state: 'upcoming' as const },
          { id: 'viewed', label: 'Host reviewing', state: 'upcoming' as const },
        ]
      : mapTrackStatusToSteps(displayStatus);

  return (
    <ol
      className={`space-y-0 text-left ${className}`}
      aria-label="Inquiry progress"
    >
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <StepIcon state={step.state} />
            {index < steps.length - 1 && (
              <span
                className={`w-0.5 flex-1 min-h-[1.25rem] my-1 rounded-full ${
                  step.state === 'done' ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
                aria-hidden
              />
            )}
          </div>
          <div className={`pb-4 ${index === steps.length - 1 ? 'pb-0' : ''}`}>
            <p
              className={`text-sm font-semibold leading-snug ${
                step.state === 'upcoming'
                  ? 'text-slate-400'
                  : step.state === 'active'
                    ? 'text-xpx-text'
                    : 'text-emerald-800'
              }`}
            >
              {step.label}
            </p>
            {step.state === 'active' && variant === 'submit' && (
              <p className="text-xs text-xpx-muted mt-0.5 leading-relaxed">
                We&apos;re preparing your inquiry before sending it to the host.
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ state }: { state: TimelineStep['state'] }) {
  if (state === 'done') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600 bg-white"
        aria-hidden
      >
        <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse motion-reduce:animate-none" />
      </span>
    );
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-300"
      aria-hidden
    >
      <Circle className="h-3 w-3" />
    </span>
  );
}
