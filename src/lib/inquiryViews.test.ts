import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import InquiryTermsSummary from '../components/inquiry/InquiryTermsSummary';
import InquiryStatusTimeline from '../components/inquiry/InquiryStatusTimeline';

describe('inquiry views', () => {
  it('renders unknown terms without inventing zero charges or a final price', () => {
    const html = renderToStaticMarkup(createElement(InquiryTermsSummary, { terms: null }));
    expect(html).toContain('total not yet confirmed');
    expect(html).toContain('Pending confirmation');
    expect(html).not.toContain('₹0');
    expect(html).toContain('External payment');
  });
  it('shows previous and current counteroffer estimates and explicit lack of acceptance', () => {
    const html = renderToStaticMarkup(createElement(InquiryTermsSummary, { terms: { version: 2, estimate: 2500.50, previous_estimate: 2000 } }));
    expect(html).toContain('₹2,500.5'); expect(html).toContain('₹2,000');
    expect(html).toContain('You have not accepted it here');
    expect(html).toContain('Proposal version 2');
  });
  it('operations rejection does not claim host receipt or response', () => {
    const html = renderToStaticMarkup(createElement(InquiryStatusTimeline, { variant: 'track', displayStatus: 'review_declined' }));
    expect(html).toContain('Closed during operations review'); expect(html).not.toContain('Sent to host');
  });
});
