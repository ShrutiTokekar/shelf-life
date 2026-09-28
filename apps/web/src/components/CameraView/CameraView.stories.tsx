import { createRef } from 'react';
import { CameraView } from './CameraView';

export const StartingCamera = () => (
  <div className="max-w-[24.375rem] bg-ink p-6">
    <CameraView
      videoRef={createRef()}
      live={false}
      scanning={false}
      placeholder="Starting the camera…"
    />
  </div>
);

export const Reading = () => (
  <div className="max-w-[24.375rem] bg-ink p-6">
    <CameraView videoRef={createRef()} live={false} scanning placeholder="" />
  </div>
);
