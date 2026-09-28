import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { UploadDropZone } from './UploadDropZone';

const photo = () => new File(['x'], 'receipt.jpg', { type: 'image/jpeg' });

describe('UploadDropZone', () => {
  it('SCN-2 keyboard users choose a photo with a labeled button', async () => {
    const onFile = vi.fn();
    render(<UploadDropZone onFile={onFile} />);
    const button = screen.getByRole('button', { name: 'Choose a photo' });
    expect(button).toHaveAccessibleDescription('JPG, PNG or HEIC, up to 15 MB');
    await userEvent.upload(screen.getByTestId('file-input'), photo());
    expect(onFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'receipt.jpg' }));
    // The input is cleared so the page doesn't keep a reference to the photo (SEC-5).
    expect((screen.getByTestId('file-input') as HTMLInputElement).value).toBe('');
  });

  it('accepts a dropped photo', () => {
    const onFile = vi.fn();
    render(<UploadDropZone onFile={onFile} />);
    const zone = screen.getByTestId('drop-zone');
    fireEvent.dragOver(zone, { dataTransfer: { files: [photo()] } });
    fireEvent.drop(zone, { dataTransfer: { files: [photo()] } });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it('shows errors as an alert linked to the button', () => {
    render(<UploadDropZone onFile={() => undefined} error="Choose a JPG, PNG or HEIC photo." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG, PNG or HEIC photo.');
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toHaveAccessibleDescription(
      /Choose a JPG, PNG or HEIC photo/,
    );
  });

  it('has no serious axe violations', async () => {
    const { container } = render(<UploadDropZone onFile={() => undefined} />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
