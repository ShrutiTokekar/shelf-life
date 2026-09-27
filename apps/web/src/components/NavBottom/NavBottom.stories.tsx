import { NavBottom } from './NavBottom';

export const States = () => (
  <div className="flex flex-col gap-4">
    {(['today', 'pantry', 'list', 'recipes', 'none'] as const).map((active) => (
      <div key={active} className="relative h-24 max-w-[24.375rem]">
        <NavBottom
          className="!absolute"
          active={active}
          listHref="/lists/home"
          listCount={active === 'list' ? 4 : 0}
        />
      </div>
    ))}
  </div>
);
