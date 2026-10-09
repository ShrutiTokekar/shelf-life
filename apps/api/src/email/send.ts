import type { Env } from '../env';

/** One email, as plain text and HTML (SRS 8.8, Milestone 9b). */
export type Email = { to: string; subject: string; text: string; html: string };
export type EmailSender = (email: Email) => Promise<void>;

/**
 * Brevo's free plan (300 emails a day), via its HTTP API. The key lives only in Render's
 * environment (SEC-4). Failures throw without the response body, which can echo the address.
 */
export function brevoSender(
  apiKey: string,
  from: { email: string; name: string },
  fetchImpl: typeof fetch = fetch,
): EmailSender {
  return async (email) => {
    const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: from,
        to: [{ email: email.to }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });
    if (!res.ok) throw new Error(`Brevo refused the email (HTTP ${res.status})`);
  };
}

/**
 * Development and tests: emails are kept here instead of sent (E2E reads them through the
 * test-only route). Never used in production.
 */
export const outbox: Email[] = [];

export function outboxSender(opts: { log?: boolean } = {}): EmailSender {
  return async (email) => {
    outbox.push(email);
    if (outbox.length > 200) outbox.shift();
    // Development only: the link is in the text, so you can click it from the terminal.
    if (opts.log) console.log(`[email] "${email.subject}"\n${email.text}\n`);
  };
}

/**
 * Brevo when its key and sender are set; otherwise the outbox in development and tests, and
 * nothing in production (email accounts are then off; Google sign-in still works).
 */
export function emailSenderFromEnv(env: Env): EmailSender | null {
  if (env.BREVO_API_KEY && env.EMAIL_FROM)
    return brevoSender(env.BREVO_API_KEY, { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME });
  if (env.NODE_ENV === 'production') return null;
  return outboxSender({ log: env.NODE_ENV === 'development' });
}
