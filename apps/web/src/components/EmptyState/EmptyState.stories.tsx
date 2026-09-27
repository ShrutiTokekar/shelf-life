import { Button } from '../Button/Button';
import { ErrorState } from '../ErrorState/ErrorState';
import { OfflineBanner } from '../OfflineBanner/OfflineBanner';
import { PageSkeleton } from '../Skeleton/Skeleton';
import { EmptyState } from './EmptyState';

export const Empty = () => (
  <EmptyState
    title="Your shelves are empty"
    body="Scan a grocery receipt and we’ll tell you what to use first."
    action={<Button>Scan your first receipt</Button>}
  />
);
export const Error = () => (
  <ErrorState
    message="Something went wrong. Check your connection and try again."
    onRetry={() => undefined}
  />
);
export const Offline = () => <OfflineBanner forceShow />;
export const Loading = () => <PageSkeleton />;
