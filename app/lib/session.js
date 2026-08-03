import {createCookieSessionStorage} from 'react-router';

/**
 * This is a custom session implementation for your Hydrogen shop.
 * Feel free to customize it to your needs, add helper methods, or
 * swap out the cookie-based implementation with something else!
 */
export class AppSession {
  /**
   * @public
   * @default false
   */
  isPending = false;

  #sessionStorage;
  #session;

  /**
   * @param {SessionStorage} sessionStorage
   * @param {Session} session
   */
  constructor(sessionStorage, session) {
    this.#sessionStorage = sessionStorage;
    this.#session = session;
  }

  /**
   * @static
   * @param {Request} request
   * @param {string[]} secrets
   */
  static async init(request, secrets) {
    const storage = createCookieSessionStorage({
      cookie: {
        name: 'session',
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        // Secure in every environment except local http dev.
        secure: process.env.NODE_ENV !== 'development',
        secrets,
      },
    });

    const session = await storage
      .getSession(request.headers.get('Cookie'))
      .catch(() => storage.getSession());

    return new this(storage, session);
  }

  get has() {
    return this.#session.has;
  }

  get get() {
    return this.#session.get;
  }

  get flash() {
    return this.#session.flash;
  }

  get unset() {
    this.isPending = true;
    return this.#session.unset;
  }

  get set() {
    this.isPending = true;
    return this.#session.set;
  }

  destroy() {
    return this.#sessionStorage.destroySession(this.#session);
  }

  commit() {
    this.isPending = false;
    return this.#sessionStorage.commitSession(this.#session);
  }
}

/**
 * Attaches the session cookie to a response, if one is needed.
 *
 * A route that sets its own `Set-Cookie` — logout does, with the cookie that
 * EXPIRES the session — always wins. Committing on top of it would serialize
 * the still-populated in-memory session and silently resurrect the user:
 * `destroy()` returns an expiring cookie but does NOT clear the session object.
 *
 * This matters because `isPending` is not a reliable signal of intent. `set`
 * and `unset` are getters that flip it on mere property ACCESS, so any code
 * that merely reaches for them — Hydrogen's customerAccount client does, to
 * clear or refresh its tokens — marks the session dirty without changing
 * anything the route cares about.
 *
 * @param {Response} response
 * @param {AppSession} session
 */
export async function finalizeSessionCookie(response, session) {
  if (response.headers.has('Set-Cookie')) {
    // The route spoke for itself. Clear the flag so nothing commits later.
    session.isPending = false;
    return;
  }
  if (session.isPending) {
    response.headers.set('Set-Cookie', await session.commit());
  }
}

/** @typedef {import('@shopify/hydrogen').HydrogenSession} HydrogenSession */
/** @typedef {import('react-router').SessionStorage} SessionStorage */
/** @typedef {import('react-router').Session} Session */
