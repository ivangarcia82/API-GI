import {describe, it, expect, vi} from 'vitest';
import {sendVerificationEmail} from './verify-link.js';

describe('auth/verify-link', () => {
  it('creates a verify token and sends an email with the verify URL', async () => {
    const fakeDb = {};
    const deps = {
      createToken: vi.fn(async () => ({token: 'tok123'})),
      sendEmail: vi.fn(async () => ({stub: true, id: null})),
    };
    const res = await sendVerificationEmail(
      fakeDb,
      {RESEND_API_KEY: undefined},
      {id: 'u1', email: 'a@b.com'},
      'https://gi.com',
      deps,
    );
    expect(res).toBe(true);
    expect(deps.createToken).toHaveBeenCalledWith(fakeDb, {userId: 'u1', type: 'verify', ttlMs: 24 * 60 * 60 * 1000});
    const msg = deps.sendEmail.mock.calls[0][1];
    expect(msg.to).toBe('a@b.com');
    expect(msg.html).toContain('https://gi.com/auth/verify?token=tok123');
  });

  it('returns false and does not throw when token creation fails', async () => {
    const deps = {
      createToken: vi.fn(async () => {
        throw new Error('db down');
      }),
      sendEmail: vi.fn(),
    };
    const res = await sendVerificationEmail({}, {}, {id: 'u1', email: 'a@b.com'}, 'https://gi.com', deps);
    expect(res).toBe(false);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
});
