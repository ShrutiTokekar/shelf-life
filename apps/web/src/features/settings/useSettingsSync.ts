import { useEffect } from 'react';
import { patchSettings } from '../../lib/api';
import { useMe } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { useUiSettings } from '../../stores/uiSettings';

/**
 * PRO-4: display settings follow the account. A new device starts from the account's settings
 * (unless someone already chose some on it); changes save when online, and wait when offline.
 */
export function useSettingsSync() {
  const me = useMe();
  const online = useOnlineStatus();
  const s = useUiSettings();

  useEffect(() => {
    if (s.accountSynced || s.dirty) return;
    const chosenHere = s.textSize !== 'default' || s.highContrast || s.reduceMotion;
    if (chosenHere) useUiSettings.setState({ dirty: true });
    else
      s.adopt({
        textSize: me.settings.textSize,
        highContrast: me.settings.highContrast,
        reduceMotion: me.settings.reduceMotion,
      });
    // Once per account load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.user.id]);

  useEffect(() => {
    if (!online || !s.dirty) return;
    const sent = {
      textSize: s.textSize,
      highContrast: s.highContrast,
      reduceMotion: s.reduceMotion,
    };
    void patchSettings(sent)
      .then(() => {
        const now = useUiSettings.getState();
        if (
          now.textSize === sent.textSize &&
          now.highContrast === sent.highContrast &&
          now.reduceMotion === sent.reduceMotion
        )
          now.markSaved();
      })
      .catch(() => undefined);
  }, [online, s.dirty, s.textSize, s.highContrast, s.reduceMotion]);
}
