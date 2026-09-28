import { buildSamplePantry, newId, todayIso, type MeResponse } from '@shelf-life/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type * as Y from 'yjs';
import { Button } from '../../components/Button/Button';
import { useToast } from '../../components/Toast/Toast';
import { getDoc, listDocName } from '../../lib/sync/docs';
import { addListItem } from '../../lib/sync/listStore';
import { addItems } from '../../lib/sync/pantryStore';

/**
 * Development only (never rendered in production builds): fills this device's pantry with the
 * shared sample so the shelves, labels and filters can be seen without scanning a receipt.
 */
export function DevSeedButton({ doc, me }: { doc: Y.Doc; me: MeResponse }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const pantryLists = me.lists.filter((l) => l.pantryId === me.pantry!.id);
    const home = pantryLists.find((l) => l.isHome)!;
    const others = pantryLists.filter((l) => !l.isHome);
    const memberIds = [
      me.user.id,
      ...new Set(
        me.lists.flatMap((l) => l.members.map((m) => m.userId)).filter((id) => id !== me.user.id),
      ),
    ];
    const sample = buildSamplePantry({
      pantryId: me.pantry!.id,
      today: todayIso(),
      listIds: [home.id, ...others.map((l) => l.id)],
      memberIds: memberIds as [string, ...string[]],
      newId,
    });
    // List entries first, so ran-out jars show "On the list" from their first render.
    try {
      for (const entry of sample.listItems) {
        const handle = getDoc(listDocName(entry.listId));
        await handle.ready;
        addListItem(handle.doc, entry);
      }
    } catch {
      // A list's storage didn't open; the pantry items still load.
    }
    addItems(doc, sample.items);
    toast({ message: t('pantry.toast.sampleLoaded') });
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="ghost" loading={busy} onClick={() => void load()}>
        {t('pantry.loadSample')}
      </Button>
      <p className="max-w-sm text-center text-[0.8125rem] text-secondary">
        {t('pantry.sampleHint')}
      </p>
    </div>
  );
}
