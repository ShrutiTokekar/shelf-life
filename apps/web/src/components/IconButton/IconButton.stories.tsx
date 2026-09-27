import { Badge } from '../Badge/Badge';
import { BellIcon, ContrastIcon } from '../icons';
import { IconButton } from './IconButton';

export const Default = () => (
  <div className="flex gap-3">
    <IconButton icon={<ContrastIcon size={22} />} label="High contrast" />
    <IconButton
      icon={<BellIcon size={22} />}
      label="Reminders, 2 unread"
      adornment={<Badge count={2} tone="terra" className="absolute -right-2 -top-2" />}
    />
  </div>
);
