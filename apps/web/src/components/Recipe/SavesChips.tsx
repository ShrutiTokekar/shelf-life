import type { UsedItem } from '@shelf-life/ranking';
import { useTranslation } from 'react-i18next';
import { StatusTag } from '../StatusTag/StatusTag';

/** "Saves" chips (REC-3, REC-4): what a recipe uses up, with icon + words for urgency. */
export function SavesChips({
  saves,
  max = 3,
  short = false,
}: {
  saves: readonly UsedItem[];
  max?: number;
  /** "2d" instead of "2 days" (mobile). */
  short?: boolean;
}) {
  const { t } = useTranslation();
  if (saves.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('recipes.saves')}>
      {saves.slice(0, max).map((u) => {
        const today = u.daysLeft <= 0;
        return (
          <li key={u.item.id}>
            <StatusTag
              status={today ? 'today' : 'soon'}
              text={u.item.name}
              suffix={{
                visible: today
                  ? t('recipes.chip.today')
                  : t(short ? 'recipes.chip.daysShort' : 'recipes.chip.days', {
                      count: u.daysLeft,
                    }),
                spoken: `, ${today ? t('recipes.chip.todaySpoken') : t('recipes.chip.daysSpoken', { count: u.daysLeft })}`,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
