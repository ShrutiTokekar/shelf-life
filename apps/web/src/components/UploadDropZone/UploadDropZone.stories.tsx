import { UploadDropZone } from './UploadDropZone';

export const Default = () => <UploadDropZone onFile={() => undefined} />;
export const WithError = () => (
  <UploadDropZone onFile={() => undefined} error="That photo is over 15 MB. Try a smaller one." />
);
