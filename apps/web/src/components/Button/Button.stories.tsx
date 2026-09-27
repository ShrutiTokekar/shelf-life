import { Button } from './Button';
import { UploadIcon } from '../icons';

export const Variants = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Button>Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Delete account</Button>
    <Button size="sm" icon={<UploadIcon size={20} />}>
      Upload receipt
    </Button>
    <Button loading>Continue with Google</Button>
    <Button disabled>Disabled</Button>
  </div>
);
