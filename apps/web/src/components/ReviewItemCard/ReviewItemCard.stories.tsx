import { todayIso } from '@shelf-life/shared';
import { sampleDraft } from '../../stories/receiptSample';
import { ReviewItemCard } from './ReviewItemCard';

const noop = () => undefined;
const handlers = { onToggle: noop, onConfirm: noop, onEdit: noop };

export const MatchedAndUnsure = () => (
  <ul className="flex max-w-md flex-col gap-3">
    <ReviewItemCard item={sampleDraft().items[0]!} today={todayIso()} {...handlers} />
    <ReviewItemCard item={sampleDraft(0.55).items[1]!} today={todayIso()} {...handlers} />
    <ReviewItemCard
      item={{ ...sampleDraft().items[2]!, included: false }}
      today={todayIso()}
      {...handlers}
    />
  </ul>
);
