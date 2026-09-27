/** List colors a user can pick for a pantry label (SRS 4.1). Values are token names, not hex. */
export const LIST_COLORS = ['navy', 'olive', 'amber', 'terra', 'gray'] as const;
export type ListColor = (typeof LIST_COLORS)[number];

/** Roles on a list (SRS 10, ListMember). */
export const LIST_ROLES = ['owner', 'edit', 'view'] as const;
export type ListRole = (typeof LIST_ROLES)[number];

export const TEXT_SIZES = ['default', 'large', 'largest'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const DEFAULT_HOME_LIST_NAME = 'Home';
export const LIST_NAME_MAX_LENGTH = 40;

/** Invite links expire after 14 days (SRS 10, ListInvite). */
export const INVITE_TTL_DAYS = 14;
