import { LeafIcon, WarnIcon } from '../icons';
import { Shelf } from './Shelf';

const jars = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <li
      key={i}
      className="flex h-40 w-40 items-center justify-center rounded-[1.125rem] bg-white bordered"
    >
      Jar {i + 1}
    </li>
  ));

export const UseToday = () => (
  <Shelf
    tone="today"
    icon={<WarnIcon size={18} />}
    title="Use today"
    helper="Expires before tomorrow"
    count={2}
  >
    {jars(2)}
  </Shelf>
);
export const GoodForNowWithMore = () => (
  <Shelf
    tone="fresh"
    icon={<LeafIcon size={18} />}
    title="Good for now"
    helper="No rush on these"
    count={9}
    limit={4}
  >
    {jars(9)}
  </Shelf>
);
export const Empty = () => (
  <Shelf
    tone="out"
    icon={<WarnIcon size={18} />}
    title="Ran out"
    helper="Restock or remove"
    count={0}
  >
    {[]}
  </Shelf>
);
