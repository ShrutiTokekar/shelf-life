import type { ListColor } from '@shelf-life/shared';
import { useState } from 'react';
import { ColorSwatchPicker } from './ColorSwatchPicker';

export const Default = () => {
  const [value, setValue] = useState<ListColor>('navy');
  return (
    <>
      <span id="lbl" className="font-semibold">
        Color label
      </span>
      <ColorSwatchPicker value={value} onChange={setValue} labelledBy="lbl" />
    </>
  );
};
