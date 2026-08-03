import {describe, it, expect} from 'vitest';
import {AppSession, finalizeSessionCookie} from './session.js';
import {loginSession} from './auth/session.js';

const SECRETS = ['test-secret'];

// Builds a session that already carries a logged-in user, and returns the
// serialized cookie so the next request can present it.
async function loggedInCookie() {
  const session = await AppSession.init(new Request('http://localhost/'), SECRETS);
  loginSession(session, {
    userId: 'u1',
    role: 'quoter',
    gid: null,
    sessionVersion: 1,
  });
  return session.commit();
}

function isExpired(cookie) {
  return /Expires=Thu, 01 Jan 1970/.test(String(cookie));
}

describe('AppSession', () => {
  it('flips isPending merely by ACCESSING set/unset, without calling them', async () => {
    const session = await AppSession.init(new Request('http://localhost/'), SECRETS);
    expect(session.isPending).toBe(false);

    // Reading the property is enough — this is the trap that broke logout.
    // Hydrogen's customerAccount client does exactly this to clear its tokens.
    expect(typeof session.unset).toBe('function');

    expect(session.isPending).toBe(true);
  });
});

describe('finalizeSessionCookie', () => {
  it('keeps a Set-Cookie the route already attached, even when isPending is true', async () => {
    const request = new Request('http://localhost/auth/logout', {
      method: 'POST',
      headers: {Cookie: await loggedInCookie()},
    });
    const session = await AppSession.init(request, SECRETS);

    // Something during the request touched the session (e.g. Hydrogen clearing
    // customer-account tokens). This is what silently resurrected the session.
    session.unset('customerAccount');
    expect(session.isPending).toBe(true);

    // The route attached the expiring cookie itself.
    const expired = await session.destroy();
    const response = new Response(null, {
      status: 302,
      headers: {Location: '/', 'Set-Cookie': expired},
    });

    await finalizeSessionCookie(response, session);

    const finalCookie = response.headers.get('Set-Cookie');
    expect(isExpired(finalCookie)).toBe(true);
    expect(finalCookie).not.toContain('gi_user');
    expect(session.isPending).toBe(false);
  });

  it('commits the session when isPending and the route attached no cookie', async () => {
    const session = await AppSession.init(new Request('http://localhost/'), SECRETS);
    loginSession(session, {
      userId: 'u2',
      role: 'quoter',
      gid: null,
      sessionVersion: 3,
    });
    const response = new Response(null, {status: 200});

    await finalizeSessionCookie(response, session);

    const cookie = response.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();
    expect(isExpired(cookie)).toBe(false);
    expect(session.isPending).toBe(false);
  });

  it('leaves the response untouched when nothing changed the session', async () => {
    const session = await AppSession.init(new Request('http://localhost/'), SECRETS);
    const response = new Response(null, {status: 200});

    await finalizeSessionCookie(response, session);

    expect(response.headers.get('Set-Cookie')).toBe(null);
  });
});
