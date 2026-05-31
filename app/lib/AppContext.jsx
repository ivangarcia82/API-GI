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
import {Icon} from '~/components/gi/Icon';

const STORE = {
  role: 'gi_role',
  quote: 'gi_quote',
  favs: 'gi_favs',
  tweaks: 'gi_tweaks',
};

const DEFAULT_TWEAKS = {
  accent: '#f5b800',
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

export function AppProvider({children, isLoggedIn = false}) {
  // hydrated=false during SSR + first client paint to avoid mismatch
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState('buyer'); // 'buyer' | 'quoter'
  const [quote, setQuote] = useState([]);
  const [favs, setFavs] = useState([]);
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const [toasts, setToasts] = useState([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setRole(read(STORE.role, 'buyer'));
    setQuote(read(STORE.quote, []));
    setFavs(read(STORE.favs, []));
    setTweaks({...DEFAULT_TWEAKS, ...read(STORE.tweaks, {})});
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.role, JSON.stringify(role));
  }, [role, hydrated]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.quote, JSON.stringify(quote));
  }, [quote, hydrated]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.favs, JSON.stringify(favs));
  }, [favs, hydrated]);
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
  const toggleFav = useCallback((id) => {
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }, []);

  // ---- Tweaks ----
  const setTweak = useCallback((key, value) => {
    setTweaks((t) => ({...t, [key]: value}));
  }, []);

  // ---- Toasts ----
  const pushToast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
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
