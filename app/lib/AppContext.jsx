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
import {Icon} from '~/components/gi/Icon';

const STORE = {
  role: 'gi_role',
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

export function AppProvider({children, isLoggedIn = false, favs: initialFavs = []}) {
  // hydrated=false during SSR + first client paint to avoid mismatch
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState('buyer'); // 'buyer' | 'quoter'
  const [quote, setQuote] = useState([]);
  const [favs, setFavs] = useState(initialFavs);
  const wishlistFetcher = useFetcher();
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const [toasts, setToasts] = useState([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setRole(read(STORE.role, 'buyer'));
    setQuote(read(STORE.quote, []));
    if (!isLoggedIn) setFavs(read(STORE.favs, []));
    setTweaks({...DEFAULT_TWEAKS, ...read(STORE.tweaks, {})});
    setHydrated(true);
  }, [isLoggedIn]);

  // Persist
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.role, JSON.stringify(role));
  }, [role, hydrated]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.quote, JSON.stringify(quote));
  }, [quote, hydrated]);
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

  // ---- Quote list ----
  const addToQuote = useCallback((item) => {
    setQuote((q) => {
      const key = (i) => i.variantId === item.variantId;
      const found = q.find(key);
      if (found) {
        return q.map((i) => (key(i) ? {...i, qty: i.qty + item.qty} : i));
      }
      return [...q, {...item, addedAt: Date.now()}];
    });
  }, []);
  const updateQuoteQty = useCallback((variantId, qty) => {
    setQuote((q) =>
      q.map((i) => (i.variantId === variantId ? {...i, qty} : i)),
    );
  }, []);
  const removeFromQuote = useCallback((variantId) => {
    setQuote((q) => q.filter((i) => i.variantId !== variantId));
  }, []);
  const clearQuote = useCallback(() => setQuote([]), []);

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

  const quoteCount = quote.reduce((n, i) => n + i.qty, 0);

  const value = {
    hydrated,
    isLoggedIn,
    role,
    setRole,
    canBuy: role === 'buyer',
    quote,
    quoteCount,
    addToQuote,
    updateQuoteQty,
    removeFromQuote,
    clearQuote,
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
