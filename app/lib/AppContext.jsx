/* ============================================================
   Generando Ideas — Client app state
   Role (buyer/quoter), quote list, favorites, toasts, tweaks.
   The Shopify cart + auth live server-side (Hydrogen); this layer
   adds the B2B quote flow and UI preferences on top.
   ============================================================ */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {useFetcher} from 'react-router';
import {mergeQuoteState, quotePieceCount} from '~/lib/quote-state';
import {Icon} from '~/components/gi/Icon';

const STORE = {
  quote: 'gi_quote',
  favs: 'gi_favs',
  tweaks: 'gi_tweaks',
};

const DEFAULT_TWEAKS = {
  accent: '#ff8300',
  density: 'comfortable',
  showRoleBanner: true,
};

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const AppCtx = createContext(null);
const ToastCtx = createContext(() => {});

export function AppProvider({
  children,
  isLoggedIn = false,
  role: roleProp = 'quoter',
  quote: quoteProp = [],
  favs: favsProp = [],
}) {
  // hydrated=false during SSR + first client paint to avoid mismatch
  const [hydrated, setHydrated] = useState(false);
  // role is READ-ONLY: it comes from the Turso user via the loader, never from the client.
  const role = roleProp;
  const [quote, setQuote] = useState(quoteProp);
  const [favs, setFavs] = useState(favsProp);
  const wishlistFetcher = useFetcher();
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const [toasts, setToasts] = useState([]);
  // Quote drawer (cart-style) open/close — the single quote surface.
  const [quoteDrawerOpen, setQuoteDrawerOpen] = useState(false);
  const openQuoteDrawer = useCallback(() => setQuoteDrawerOpen(true), []);
  const closeQuoteDrawer = useCallback(() => setQuoteDrawerOpen(false), []);

  // Tracks an in-flight quote mutation so consumers can surface a
  // spinner/disabled state while a /api/quote/* POST is settling.
  const [quotePending, setQuotePending] = useState(false);

  // POST to an /api/quote/* route as form-encoded fields and reconcile the
  // returned authoritative draft into client state. Server recomputes prices.
  const postQuote = useCallback(
    async (action, fields) => {
      const body = new URLSearchParams();
      Object.entries(fields).forEach(([k, v]) => body.set(k, v == null ? '' : String(v)));
      setQuotePending(true);
      try {
        const res = await fetch(`/api/quote/${action}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body,
        });
        const data = await res.json().catch(() => null);
        if (!data || data.ok === false) {
          throw new Error((data && data.error) || 'No se pudo actualizar la cotización');
        }
        // Phase 4 routes return the authoritative item list at the top level
        // ({ok, quoteId, items}); wrap it into the {items} shape the reducer expects.
        setQuote((prev) => mergeQuoteState(prev, {items: data.items}));
        return data.items;
      } finally {
        setQuotePending(false);
      }
    },
    [],
  );

  // Hydrate UI-only prefs from localStorage on mount.
  // quote/favs come from loader props when authenticated; localStorage is the
  // anonymous-only fallback (server is authoritative once logged in).
  useEffect(() => {
    if (!isLoggedIn) {
      setQuote(read(STORE.quote, []));
      setFavs(read(STORE.favs, []));
    }
    setTweaks({...DEFAULT_TWEAKS, ...read(STORE.tweaks, {})});
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist UI prefs. quote/favs only mirror to localStorage when anonymous.
  useEffect(() => {
    if (hydrated && !isLoggedIn)
      window.localStorage.setItem(STORE.quote, JSON.stringify(quote));
  }, [quote, hydrated, isLoggedIn]);
  useEffect(() => {
    if (hydrated && !isLoggedIn)
      window.localStorage.setItem(STORE.favs, JSON.stringify(favs));
  }, [favs, hydrated, isLoggedIn]);

  // One-shot localStorage -> server migration after first authenticated load.
  const [migratedFavs, setMigratedFavs] = useState(false);
  useEffect(() => {
    if (!hydrated || !isLoggedIn || migratedFavs) return;
    setMigratedFavs(true);
    const local = read(STORE.favs, []);
    if (Array.isArray(local) && local.length > 0) {
      const body = new FormData();
      body.set('intent', 'merge');
      body.set('productIds', JSON.stringify(local));
      wishlistFetcher.submit(body, {method: 'POST', action: '/api/wishlist'});
    }
    window.localStorage.removeItem(STORE.favs);
  }, [hydrated, isLoggedIn, migratedFavs, wishlistFetcher]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.tweaks, JSON.stringify(tweaks));
  }, [tweaks, hydrated]);

  // Apply accent / density / banner to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', tweaks.accent);
    root.style.setProperty('--accent-deep', darkenHex(tweaks.accent, 0.15));
    root.style.setProperty('--accent-soft', lightenHex(tweaks.accent, 0.85));
    root.dataset.density = tweaks.density;
    root.dataset.banner = tweaks.showRoleBanner ? 'on' : 'off';
  }, [tweaks]);

  // ---- Quote list (server-backed when authenticated) ----
  const addToQuote = useCallback(
    (item) => {
      if (!isLoggedIn) {
        setQuote((q) => {
          const key = (i) => i.variantId === item.variantId;
          const found = q.find(key);
          if (found) return q.map((i) => (key(i) ? {...i, qty: i.qty + item.qty} : i));
          return [...q, {...item, addedAt: Date.now()}];
        });
        return Promise.resolve();
      }
      return postQuote('add', {
        variantId: item.variantId,
        technique: item.technique ?? 'Sin decorado',
        surface: item.surface ?? '',
        size: item.size ?? '',
        qty: item.qty,
      });
    },
    [isLoggedIn, postQuote],
  );
  const updateQuoteQty = useCallback(
    (itemId, qty) => {
      const nextQty = Math.max(1, qty);
      if (!isLoggedIn) {
        setQuote((q) => q.map((i) => (i.id === itemId ? {...i, qty: nextQty} : i)));
        return Promise.resolve();
      }
      // optimistic: patch qty locally, server reconciles effectiveUnitPrice
      setQuote((q) => q.map((i) => (i.id === itemId ? {...i, qty: nextQty} : i)));
      return postQuote('update', {itemId, qty: nextQty});
    },
    [isLoggedIn, postQuote],
  );
  const removeFromQuote = useCallback(
    (itemId) => {
      if (!isLoggedIn) {
        setQuote((q) => q.filter((i) => i.id !== itemId));
        return Promise.resolve();
      }
      setQuote((q) => q.filter((i) => i.id !== itemId)); // optimistic
      return postQuote('remove', {itemId});
    },
    [isLoggedIn, postQuote],
  );
  const clearQuote = useCallback(() => {
    if (!isLoggedIn) {
      setQuote([]);
      return Promise.resolve();
    }
    const ids = quote.map((i) => i.id);
    setQuote([]); // optimistic
    return Promise.all(ids.map((itemId) => postQuote('remove', {itemId}))).then(
      () => undefined,
    );
  }, [isLoggedIn, quote, postQuote]);

  // ---- Favorites ----
  const toggleFav = useCallback(
    (id) => {
      setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
      if (isLoggedIn) {
        const body = new FormData();
        body.set('intent', 'toggle');
        body.set('productId', id);
        wishlistFetcher.submit(body, {method: 'POST', action: '/api/wishlist'});
      }
    },
    [isLoggedIn, wishlistFetcher],
  );

  // Reconcile optimistic favs with the authoritative server response.
  useEffect(() => {
    if (wishlistFetcher.data && Array.isArray(wishlistFetcher.data.favs)) {
      setFavs((current) => reconcileFavs(wishlistFetcher.data.favs, current));
    }
  }, [wishlistFetcher.data]);

  // ---- Tweaks ----
  const setTweak = useCallback((key, value) => {
    setTweaks((t) => ({...t, [key]: value}));
  }, []);

  // ---- Toasts ----
  const pushToast = useCallback((message, opts = {}) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, {id, message, ...opts}]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      opts.duration || 3500,
    );
  }, []);

  const quoteCount = quotePieceCount(quote);

  const value = {
    hydrated,
    isLoggedIn,
    role,
    canBuy: role === 'buyer',
    quote,
    quoteCount,
    quotePending,
    addToQuote,
    updateQuoteQty,
    removeFromQuote,
    clearQuote,
    quoteDrawerOpen,
    openQuoteDrawer,
    closeQuoteDrawer,
    favs,
    toggleFav,
    tweaks,
    setTweak,
  };

  return (
    <AppCtx.Provider value={value}>
      <ToastCtx.Provider value={pushToast}>
        {children}
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.accent ? 'toast-accent' : ''}`}>
              {t.icon && <Icon name={t.icon} size={16} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useToast() {
  return useContext(ToastCtx);
}

/**
 * Pick the authoritative favorites list after a wishlist mutation.
 * The server response wins when it is an array; otherwise keep the
 * optimistic local list.
 * @param {unknown} serverFavs
 * @param {string[]} optimisticFavs
 * @returns {string[]}
 */
export function reconcileFavs(serverFavs, optimisticFavs) {
  return Array.isArray(serverFavs) ? serverFavs : optimisticFavs;
}

/* ---- color helpers ---- */
export function darkenHex(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = (x) => Math.round(x * (1 - amt));
  return `#${[f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
export function lightenHex(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = (x) => Math.round(x + (255 - x) * amt);
  return `#${[f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
