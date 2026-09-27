import type { TextSize } from '@shelf-life/shared';
import { useState } from 'react';
import { NavHeader } from './NavHeader';

export const Default = () => {
  const [textSize, setTextSize] = useState<TextSize>('large');
  const [hc, setHc] = useState(false);
  return (
    <NavHeader
      active="today"
      listHref="/lists/home"
      listCount={4}
      remindersCount={2}
      userName="Shruti"
      userInitial="S"
      textSize={textSize}
      onTextSizeChange={setTextSize}
      highContrast={hc}
      onHighContrastChange={setHc}
    />
  );
};
