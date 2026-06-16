// Server-only. CSRF default-deny: reject any request whose Origin (or Referer
// fallback) is not exactly the site origin, and reject when both are absent.
export function assertSameOrigin(request) {
  const target = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin) {
    if (origin === target) return;
    throw new Response('Forbidden', {status: 403});
  }
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      if (new URL(referer).origin === target) return;
    } catch {
      // malformed Referer -> fall through to deny
    }
  }
  throw new Response('Forbidden', {status: 403});
}
