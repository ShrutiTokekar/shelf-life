/** SRS 8.1 step 1: HEIC photos (iPhone) are converted to JPEG in the browser. heic2any loads only when needed. */
export function isHeic(file: Blob & { name?: string }): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name ?? '');
}

export async function heicToJpeg(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0]! : out;
}
