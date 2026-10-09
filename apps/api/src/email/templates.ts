import type { Email } from './send';

/*
 * Account emails (Milestone 9b). Short, plain words, the action as a real link, and the same
 * content as plain text. Email clients ignore stylesheets, so the few colors are inline; they
 * are tokens.css values (cream, navy, ink, slate).
 */

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there';

function layout(
  paragraphs: string[],
  action?: { label: string; url: string },
  after: string[] = [],
) {
  const p = (t: string) =>
    `<p style="margin:0 0 16px;font:16px/1.5 Arial,sans-serif;color:#2b3360">${escape(t)}</p>`;
  const button = action
    ? `<p style="margin:24px 0"><a href="${escape(action.url)}" style="display:inline-block;padding:14px 24px;background:#4d5c9f;color:#ffffff;border-radius:12px;font:600 16px Arial,sans-serif;text-decoration:none">${escape(action.label)}</a></p>
<p style="margin:0 0 16px;font:14px/1.5 Arial,sans-serif;color:#555c80">Or copy this link: ${escape(action.url)}</p>`
    : '';
  return `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#fffbf3">
<p style="margin:0 0 24px;font:700 20px Arial,sans-serif;color:#4d5c9f">Shelf Life</p>
${paragraphs.map(p).join('\n')}
${button}
${after.map(p).join('\n')}
</body></html>`;
}

const text = (
  paragraphs: string[],
  action?: { label: string; url: string },
  after: string[] = [],
) => [...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []), ...after].join('\n\n');

function email(
  to: string,
  subject: string,
  paragraphs: string[],
  action?: { label: string; url: string },
  after: string[] = [],
): Email {
  return {
    to,
    subject,
    text: text(paragraphs, action, after),
    html: layout(paragraphs, action, after),
  };
}

/** Sign-up: confirm the address before the account works (link valid 24 hours). */
export const verifyEmail = (to: string, name: string, url: string) =>
  email(
    to,
    'Confirm your email for Shelf Life',
    [
      `Hi ${firstName(name)},`,
      'Confirm your email address to finish creating your Shelf Life account.',
    ],
    { label: 'Confirm my email', url },
    ['This link works for 24 hours. If you didn’t sign up, you can ignore this email.'],
  );

/** Forgot password (link valid 1 hour). */
export const resetPasswordEmail = (to: string, name: string, url: string) =>
  email(
    to,
    'Reset your Shelf Life password',
    [`Hi ${firstName(name)},`, 'Someone asked to reset the password for your Shelf Life account.'],
    { label: 'Choose a new password', url },
    [
      'This link works for 1 hour and signs you out on your other devices. If it wasn’t you, ignore this email: your password stays the same.',
    ],
  );

/** Someone tried to sign up with an address that already has an account (no account is made). */
export const existingAccountEmail = (to: string, name: string, appUrl: string) =>
  email(
    to,
    'You already have a Shelf Life account',
    [
      `Hi ${firstName(name)},`,
      'Someone tried to create a Shelf Life account with this email address. You already have one, so nothing changed.',
      'If it was you, sign in instead. You can use Google, or reset your password to sign in with email.',
    ],
    { label: 'Sign in', url: `${appUrl}/sign-in` },
    ['If it wasn’t you, you can ignore this email.'],
  );
