import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { schema } from '../src/db/client';
import { brevoSender, type Email, type EmailSender } from '../src/email/send';
import { hibpCheck } from '../src/email/pwned';
import { deleteUnconfirmedAccounts } from '../src/jobs/cleanup';
import { APP_ORIGIN, setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
afterEach(async () => {
  await t?.close();
  t = undefined as never;
});

const PASSWORD = 'correct horse battery';
type Body = { emailSignIn?: boolean; user: { displayName: string }; error: { code: string } };
const json = (r: Response) => r.json() as Promise<Body>;

function mailbox() {
  const sent: Email[] = [];
  const send: EmailSender = async (e) => void sent.push(e);
  /** The link in the last email to this address, as a path on the API. */
  const link = (to: string) => {
    const mail = [...sent].reverse().find((e) => e.to === to);
    const url = /https?:\/\/\S+/.exec(mail?.text ?? '')?.[0];
    if (!url) throw new Error(`no link for ${to}`);
    return url.replace(APP_ORIGIN, '');
  };
  return { sent, send, link };
}

const post = (path: string, body: unknown, cookie?: string) =>
  t.request(`/api/v1/auth${path}`, { method: 'POST', body: JSON.stringify(body), cookie });

const signUp = (email: string, password = PASSWORD, name = 'Maya Rao') =>
  post('/sign-up/email', { email, password, name, callbackURL: `${APP_ORIGIN}/email-verified` });

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

describe('Milestone 9b email + password accounts', () => {
  it('sign up → confirm by email → signed in; no account works before it’s confirmed', async () => {
    const mail = mailbox();
    t = await setup({ email: mail.send });
    expect(await json(await t.request('/api/v1/config'))).toEqual({ emailSignIn: true });

    expect((await signUp('maya@example.com')).status).toBe(200);
    expect(mail.sent.map((e) => e.subject)).toEqual(['Confirm your email for Shelf Life']);
    expect(mail.sent[0]!.html).toContain('Hi Maya,');

    // Signing in first is refused, and sends a fresh link.
    const early = await post('/sign-in/email', {
      email: 'maya@example.com',
      password: PASSWORD,
      callbackURL: `${APP_ORIGIN}/email-verified`,
    });
    expect(early.status).toBe(403);
    expect(mail.sent).toHaveLength(2);

    const verified = await t.request(mail.link('maya@example.com'));
    expect(verified.status).toBe(302);
    expect(verified.headers.get('location')).toBe(`${APP_ORIGIN}/email-verified`);
    const me = await t.request('/api/v1/me', { cookie: cookieOf(verified) });
    expect(me.status).toBe(200);
    expect((await json(me)).user.displayName).toBe('Maya Rao');

    const signIn = await post('/sign-in/email', { email: 'maya@example.com', password: PASSWORD });
    expect(signIn.status).toBe(200);
  });

  it('passwords: at least 12 characters and not from a known breach', async () => {
    const mail = mailbox();
    t = await setup({ email: mail.send });
    expect((await signUp('a@example.com', 'short pass')).status).toBe(400);
    const breached = await signUp('a@example.com', 'password1234');
    expect(breached.status).toBe(400);
    expect((await json(breached)).error.code).toBe('password_breached');
    expect(mail.sent).toEqual([]);
  });

  it('signing up with a taken address looks the same and emails the owner instead', async () => {
    const mail = mailbox();
    t = await setup({ email: mail.send });
    await signUp('maya@example.com');
    const again = await signUp('maya@example.com', 'another long password', 'Someone Else');
    expect(again.status).toBe(200);
    expect(mail.sent.map((e) => e.subject)).toEqual([
      'Confirm your email for Shelf Life',
      'You already have a Shelf Life account',
    ]);
    expect(await t.db.select().from(schema.user)).toHaveLength(1);
  });

  it('forgot password: a 1-hour link sets a new one and signs out everywhere else', async () => {
    const mail = mailbox();
    t = await setup({ email: mail.send });
    await signUp('maya@example.com');
    const verified = await t.request(mail.link('maya@example.com'));
    const oldCookie = cookieOf(verified);

    // The same answer for unknown addresses.
    expect(
      (
        await post('/request-password-reset', {
          email: 'nobody@example.com',
          redirectTo: `${APP_ORIGIN}/reset-password`,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post('/request-password-reset', {
          email: 'maya@example.com',
          redirectTo: `${APP_ORIGIN}/reset-password`,
        })
      ).status,
    ).toBe(200);
    expect(mail.sent.at(-1)!.subject).toBe('Reset your Shelf Life password');
    const opened = await t.request(mail.link('maya@example.com'));
    const to = new URL(opened.headers.get('location')!);
    expect(to.pathname).toBe('/reset-password');
    const token = to.searchParams.get('token')!;

    expect((await post('/reset-password', { newPassword: 'password1234', token })).status).toBe(
      400,
    );
    expect(
      (await post('/reset-password', { newPassword: 'a brand new password', token })).status,
    ).toBe(200);
    expect((await t.request('/api/v1/me', { cookie: oldCookie })).status).toBe(401);
    expect(
      (
        await post('/sign-in/email', {
          email: 'maya@example.com',
          password: 'a brand new password',
        })
      ).status,
    ).toBe(200);
    // A link works once.
    expect(
      (await post('/reset-password', { newPassword: 'yet another password', token })).status,
    ).toBe(400);
  });

  it('8 wrong passwords lock that account for 15 minutes, from any IP', async () => {
    let now = Date.now();
    const mail = mailbox();
    t = await setup({ email: mail.send, now: () => new Date(now) });
    await signUp('maya@example.com');
    await t.request(mail.link('maya@example.com'));
    for (let i = 0; i < 8; i++)
      expect(
        (await post('/sign-in/email', { email: 'maya@example.com', password: `wrong guess ${i}!` }))
          .status,
      ).toBe(401);
    const locked = await post('/sign-in/email', { email: 'Maya@Example.com', password: PASSWORD });
    expect(locked.status).toBe(429);
    now += 16 * 60_000;
    expect(
      (await post('/sign-in/email', { email: 'maya@example.com', password: PASSWORD })).status,
    ).toBe(200);
  });

  it('without an email service, email accounts are off and Google sign-in still works', async () => {
    t = await setup({ email: null });
    expect(await json(await t.request('/api/v1/config'))).toEqual({ emailSignIn: false });
    expect((await signUp('maya@example.com')).status).toBeGreaterThanOrEqual(400);
  });

  it('sign-ups never confirmed are removed after 24 hours; confirmed and Google ones stay', async () => {
    const mail = mailbox();
    t = await setup({ email: mail.send });
    await signUp('never@example.com');
    await signUp('done@example.com');
    await t.request(mail.link('done@example.com'));
    await t.signIn('google@example.com', 'Google Person');
    expect(await deleteUnconfirmedAccounts(t.db, new Date(Date.now() + 23 * 3600_000))).toBe(0);
    expect(await deleteUnconfirmedAccounts(t.db, new Date(Date.now() + 25 * 3600_000))).toBe(1);
    const left = (await t.db.select({ email: schema.user.email }).from(schema.user)).map(
      (u) => u.email,
    );
    expect(left.sort()).toEqual(['done@example.com', 'google@example.com']);
    expect(
      await t.db.select().from(schema.user).where(eq(schema.user.email, 'never@example.com')),
    ).toEqual([]);
  });
});

describe('Milestone 9b email + breach-check services', () => {
  it('Brevo gets the message; a refusal throws without echoing the response', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = brevoSender(
      'key',
      { email: 'hello@example.com', name: 'Shelf Life' },
      async (url, init) => {
        calls.push({ url: String(url), init: init! });
        return new Response('{}', { status: 201 });
      },
    );
    await ok({ to: 'maya@example.com', subject: 'Hi', text: 't', html: '<p>h</p>' });
    expect(calls[0]!.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0]!.init.headers as Record<string, string>)['api-key']).toBe('key');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      sender: { email: 'hello@example.com', name: 'Shelf Life' },
      to: [{ email: 'maya@example.com' }],
      subject: 'Hi',
      textContent: 't',
      htmlContent: '<p>h</p>',
    });
    const bad = brevoSender(
      'key',
      { email: 'a@b.co', name: 'x' },
      async () => new Response('maya@example.com is blocked', { status: 400 }),
    );
    await expect(bad({ to: 'maya@example.com', subject: '', text: '', html: '' })).rejects.toThrow(
      'Brevo refused the email (HTTP 400)',
    );
  });

  it('the breach check sends only the first 5 characters of the hash; an outage lets sign-up go on', async () => {
    // SHA-1("password1234") = E6B6AFBD6D76BB5D2041542D7D2E3FAC5BB05593
    const asked: string[] = [];
    const check = hibpCheck(async (url) => {
      asked.push(String(url));
      return new Response(
        'FBD6D76BB5D2041542D7D2E3FAC5BB05593:12\r\n0000000000000000000000000000000000A:0',
      );
    });
    expect(await check('password1234')).toBe(true);
    expect(asked).toEqual(['https://api.pwnedpasswords.com/range/E6B6A']);
    expect(await hibpCheck(async () => new Response('', { status: 503 }))('password1234')).toBe(
      false,
    );
  });
});
