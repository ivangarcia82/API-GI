/* Generando Ideas — "Vistos recientemente" storage.
   A lightweight client-only history of viewed products. We persist a compact
   snapshot (the same shape ProductCard renders) so the strip can render without
   an extra round-trip. Most-recent first, de-duplicated by id, capped at MAX. */

const KEY = 'gi_recently_viewed';
const MAX = 12;

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Return the stored history, optionally excluding one product id. */
export function getRecentlyViewed(excludeId) {
  const list = read();
  return excludeId ? list.filter((p) => p && p.id !== excludeId) : list;
}

/**
 * Push a product snapshot to the front of the history.
 * @param {{id: string} & Record<string, any>} snapshot
 */
export function pushRecentlyViewed(snapshot) {
  if (typeof window === 'undefined' || !snapshot?.id) return;
  const next = [snapshot, ...read().filter((p) => p && p.id !== snapshot.id)].slice(
    0,
    MAX,
  );
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full / unavailable — non-critical, ignore.
  }
}
