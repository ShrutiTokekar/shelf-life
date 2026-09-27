import { uuidv7 } from 'uuidv7';

/** All entity IDs are UUID v7 (SRS 10). */
export function newId(): string {
  return uuidv7();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV7(value: string): boolean {
  return UUID_RE.test(value);
}
