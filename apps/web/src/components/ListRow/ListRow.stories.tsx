import { newListItem } from '@shelf-life/shared';
import { ClockIcon, EmptyJarIcon, PlusIcon, WarnIcon } from '../icons';
import { ListGroup } from '../ListGroup/ListGroup';
import { ListRow } from './ListRow';

const ctx = { listId: 'l', userId: 'u', now: new Date().toISOString() };
const noop = () => undefined;
const handlers = { onCheck: noop, onClaim: noop, onEdit: noop };
const eggs = newListItem({ name: 'Eggs', quantity: 12, unit: '' }, ctx);
const onions = newListItem({ name: 'Onions', quantity: 2, unit: '' }, ctx);
const atta = newListItem({ name: 'Atta', quantity: 20, unit: 'lb' }, ctx);

export const Groups = () => (
  <div className="flex max-w-xl flex-col gap-5">
    <ListGroup
      tone="today"
      icon={<WarnIcon size={20} />}
      title="Needed today"
      helper="Ran out, or needed for tonight"
    >
      <ListRow
        {...handlers}
        item={eggs}
        canEdit
        claimer={null}
        reason={{ icon: <EmptyJarIcon size={15} />, text: 'Ran out this morning · added by Maya' }}
      />
    </ListGroup>
    <ListGroup
      tone="week"
      icon={<ClockIcon size={20} />}
      title="This week"
      helper="Before the weekend"
    >
      <ListRow
        {...handlers}
        item={onions}
        canEdit
        claimer={{ name: 'Arjun', initial: 'A', tone: 'peach', isYou: false }}
        reason={{ icon: <PlusIcon size={15} />, text: 'Added by Maya' }}
      />
      <ListRow
        {...handlers}
        item={atta}
        canEdit
        claimer={{ name: 'Shruti', initial: 'S', tone: 'periwinkle', isYou: true }}
        reason={{ icon: <PlusIcon size={15} />, text: 'Added by you' }}
      />
    </ListGroup>
  </div>
);

export const WebRows = () => (
  <ul className="max-w-3xl rounded-card border-2 border-line bg-white">
    <ListRow
      {...handlers}
      wide
      item={eggs}
      canEdit
      claimer={null}
      reason={{ icon: <EmptyJarIcon size={15} />, text: 'Ran out this morning' }}
    />
    <ListRow
      {...handlers}
      wide
      item={onions}
      canEdit={false}
      claimer={{ name: 'Arjun', initial: 'A', tone: 'peach', isYou: false }}
      reason={{ icon: <PlusIcon size={15} />, text: 'View only' }}
    />
  </ul>
);

export const ShoppingMode = () => (
  <ul className="max-w-xl divide-y-2 divide-line bg-white">
    <ListRow
      {...handlers}
      large
      item={eggs}
      canEdit
      claimer={null}
      reason={{ icon: <EmptyJarIcon size={18} />, text: 'Nobody yet' }}
    />
    <ListRow
      {...handlers}
      large
      item={{ ...atta, checked: true }}
      canEdit
      claimer={null}
      reason={{ icon: <PlusIcon size={18} />, text: 'In the cart' }}
    />
  </ul>
);
