import { describe, expect, it } from 'vitest';
import {
  createListInputSchema,
  DEFAULT_HOME_LIST_NAME,
  isUuidV7,
  LIST_NAME_MAX_LENGTH,
  newId,
} from '../src';

describe('createListInputSchema', () => {
  it('WEL-4 accepts the default home list name and a list color', () => {
    const parsed = createListInputSchema.parse({ name: DEFAULT_HOME_LIST_NAME, color: 'navy' });
    expect(parsed).toEqual({ name: 'Home', color: 'navy', isPrivate: false });
  });

  it('WEL-4 trims whitespace and rejects an empty name', () => {
    expect(createListInputSchema.parse({ name: '  Apartment 4B ', color: 'olive' }).name).toBe(
      'Apartment 4B',
    );
    expect(createListInputSchema.safeParse({ name: '   ', color: 'olive' }).success).toBe(false);
  });

  it('rejects names over the max length', () => {
    const name = 'x'.repeat(LIST_NAME_MAX_LENGTH + 1);
    expect(createListInputSchema.safeParse({ name, color: 'navy' }).success).toBe(false);
  });

  it('only allows list color tokens, never raw hex', () => {
    expect(createListInputSchema.safeParse({ name: 'Home', color: '#4D5C9F' }).success).toBe(false);
  });

  it('validates the optional shop-by date', () => {
    expect(
      createListInputSchema.safeParse({ name: 'Party', color: 'amber', shopBy: '2026-10-20' })
        .success,
    ).toBe(true);
    expect(
      createListInputSchema.safeParse({ name: 'Party', color: 'amber', shopBy: 'tomorrow' })
        .success,
    ).toBe(false);
  });
});

describe('newId', () => {
  it('generates UUID v7 ids that sort by creation time', () => {
    const a = newId();
    const b = newId();
    expect(isUuidV7(a)).toBe(true);
    expect(isUuidV7(b)).toBe(true);
    expect(a < b).toBe(true);
    expect(isUuidV7('not-a-uuid')).toBe(false);
  });
});
