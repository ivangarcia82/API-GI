/* ============================================================
   Pure quote-state reconciliation (no I/O, no React).
   The server (/api/quote/*) is authoritative for prices and item ids;
   the client list is reconciled from the server draft after every fetch.
   Items are keyed by the server quote_items.id.
   ============================================================ */

/**
 * Reconcile the optimistic client quote against the server draft.
 * @param {Array} prev - current client items (may contain optimistic temp rows)
 * @param {{items?: Array}|null|undefined} serverQuote - response from getQuoteWithItems / /api/quote/*
 * @returns {Array} authoritative item list (server wins), or `prev` when the response is malformed
 */
export function mergeQuoteState(prev, serverQuote) {
  if (serverQuote === null) return [];
  if (!serverQuote || !Array.isArray(serverQuote.items)) return prev;
  // Server is the single source of truth: take its items verbatim, keyed by id.
  return serverQuote.items.map((it) => ({...it}));
}

/** Total pieces across the quote (NaN/missing qty counts as 0). */
export function quotePieceCount(items) {
  return (items || []).reduce((n, i) => n + (Number.isFinite(i.qty) ? i.qty : 0), 0);
}
