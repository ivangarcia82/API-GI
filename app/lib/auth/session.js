// Server-only. Reads/writes a minimal user snapshot in the signed AppSession cookie
// to avoid a Turso round-trip on every protected navigation.
// loginSession sets state (which flips AppSession.isPending=true so server.js emits Set-Cookie).
// Logout uses session.destroy() directly in the route.

const KEY = 'gi_user';

export function loginSession(session, {userId, role, gid, sessionVersion}) {
  // session.set is a getter on AppSession that also sets isPending=true.
  session.set(KEY, {
    userId,
    role,
    gid: gid ?? null,
    sessionVersion: Number(sessionVersion),
  });
}

export function getSessionUser(session) {
  const snap = session.get(KEY);
  if (!snap || typeof snap.userId !== 'string') return null;
  return {
    userId: snap.userId,
    role: snap.role,
    gid: snap.gid ?? null,
    sessionVersion: Number(snap.sessionVersion),
  };
}
