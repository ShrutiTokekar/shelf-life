import { SummaryPill } from './SummaryPill';

export const Tones = () => (
  <div className="flex flex-wrap gap-2">
    <SummaryPill tone="matched">10 matched</SummaryPill>
    <SummaryPill tone="look">2 need a look</SummaryPill>
    <SummaryPill tone="skipped">2 skipped</SummaryPill>
    <SummaryPill tone="ai">2 AI matches you confirmed</SummaryPill>
  </div>
);
