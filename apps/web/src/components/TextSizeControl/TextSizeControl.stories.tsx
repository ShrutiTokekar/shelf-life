import type { TextSize } from '@shelf-life/shared';
import { useState } from 'react';
import { TextSizeControl } from './TextSizeControl';

export const Default = () => {
  const [value, setValue] = useState<TextSize>('default');
  return <TextSizeControl value={value} onChange={setValue} />;
};
