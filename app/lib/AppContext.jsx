/* ============================================================
   Generando Ideas — Client app state
   Quote list, favorites, toasts, tweaks. Quote-only (no purchase flow).
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
import {
  normalizeGuestLine,
  addGuestLine,
  parseGuestQuote,
  serializeGuestQuote,
  guestMergePayload,
  guestMergeOutcome,
  priceGuestLine,
} from '~/lib/quote-guest';
import {Icon} from '~/components/gi/Icon';

const STORE = {
  quote: 'gi_quote',
  // Se marca cuando un invitado toca "enviar cotización" y lo mandamos a
  // crear cuenta: al volver con sesión, el cajón se abre solo y ve que su
  // lista sigue ahí. Sobrevive al rodeo del correo de verificación, que es
  // donde se perdía el hilo.
  quoteIntent: 'gi_quote_intent',
  favs: 'gi_favs',
  tweaks: 'gi_tweaks',
};

const DEFAULT_TWEAKS = {
  accent: '#ff8300',
  density: 'comfortable',
  showRoleBanner: true,
};

// Referencia estable para el default de la prop `brandColors`: un literal `[]`
// en la firma se re-crea en cada render del provider, y eso invalida sin
// necesidad los `useEffect` que la traen en sus dependencias (p. ej. la tira
// de vistos recientemente).
const DEFAULT_BRAND_COLORS = [];

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/* El carrito del invitado se re-tarifica al leerlo: `normalizeGuestLine` sólo
   conserva intención, así que el precio por pieza se recalcula con el mismo
   motor que usa el servidor en vez de confiar en lo que quedó guardado. */
function readGuestQuote() {
  if (typeof window === 'undefined') return [];
  return parseGuestQuote(window.localStorage.getItem(STORE.quote), Date.now()).map(
    priceGuestLine,
  );
}

const AppCtx = createContext(null);
const ToastCtx = createContext(() => {});

export function AppProvider({
  children,
  isLoggedIn = false,
  brandColors = DEFAULT_BRAND_COLORS,
  quote: quoteProp = [],
  favs: favsProp = [],
}) {
  // hydrated=false during SSR + first client paint to avoid mismatch
  const [hydrated, setHydrated] = useState(false);
  const [quote, setQuote] = useState(quoteProp);
  const [favs, setFavs] = useState(favsProp);
  const wishlistFetcher = useFetcher();
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const [toasts, setToasts] = useState([]);
  // Quote drawer (cart-style) open/close — the single quote surface.
  const [quoteDrawerOpen, setQuoteDrawerOpen] = useState(false);
  const openQuoteDrawer = useCallback(() => setQuoteDrawerOpen(true), []);
  const closeQuoteDrawer = useCallback(() => setQuoteDrawerOpen(false), []);

  // Predictive search modal open/close — search stays in-page (no navigation).
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

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
        // The /api/quote/* routes signal failure with a non-2xx status + {error}
        // (no `ok:false`). Checking res.ok is what makes those errors surface
        // instead of being silently treated as success.
        if (!res.ok || !data || data.ok === false) {
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
      setQuote(readGuestQuote());
      setFavs(read(STORE.favs, []));
    }
    setTweaks({...DEFAULT_TWEAKS, ...read(STORE.tweaks, {})});
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist UI prefs. quote/favs only mirror to localStorage when anonymous.
  useEffect(() => {
    if (hydrated && !isLoggedIn)
      window.localStorage.setItem(STORE.quote, serializeGuestQuote(quote, Date.now()));
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
        // Sin sesión el carrito vive en localStorage y se re-tarifica entero:
        // sumar piezas puede cruzar la cantidad mínima del decorado y abaratar
        // el precio por pieza de esa línea.
        const ahora = Date.now();
        setQuote((q) =>
          addGuestLine(q, normalizeGuestLine(item, ahora), ahora).map(priceGuestLine),
        );
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
        setQuote((q) =>
          q.map((i) => (i.id === itemId ? priceGuestLine({...i, qty: nextQty}) : i)),
        );
        return Promise.resolve();
      }
      // optimistic: patch qty locally, server reconciles effectiveUnitPrice
      const prev = quote;
      setQuote((q) => q.map((i) => (i.id === itemId ? {...i, qty: nextQty} : i)));
      return postQuote('update', {itemId, qty: nextQty}).catch((err) => {
        setQuote(prev); // roll back the optimistic qty if the server rejected
        throw err;
      });
    },
    [isLoggedIn, postQuote, quote],
  );
  const removeFromQuote = useCallback(
    (itemId) => {
      if (!isLoggedIn) {
        setQuote((q) => q.filter((i) => i.id !== itemId));
        return Promise.resolve();
      }
      const prev = quote;
      setQuote((q) => q.filter((i) => i.id !== itemId)); // optimistic
      return postQuote('remove', {itemId}).catch((err) => {
        setQuote(prev); // restore the item if the delete failed
        throw err;
      });
    },
    [isLoggedIn, postQuote, quote],
  );
  const clearQuote = useCallback(() => {
    if (!isLoggedIn) {
      setQuote([]);
      return Promise.resolve();
    }
    const prev = quote;
    setQuote([]); // optimistic
    // Single authoritative clear (clear=true) instead of N per-item removes.
    return postQuote('remove', {clear: 'true'}).catch((err) => {
      setQuote(prev);
      throw err;
    });
  }, [isLoggedIn, postQuote, quote]);

  // Copy a past (submitted) quote's items back into the active draft. The server
  // recomputes pricing and returns the authoritative draft item list.
  const reorderQuote = useCallback(
    (sourceQuoteId) => postQuote('reorder', {sourceQuoteId}),
    [postQuote],
  );

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

  /* El comprador B2B compara con varias pestañas abiertas. Cuando entra en
     una, esa migra el carrito y borra la clave; esta sigue creyéndose invitada
     y con las mismas líneas en memoria. Sin soltarlas, su primera interacción
     las vuelve a escribir y el siguiente recargue las migra OTRA VEZ: el
     cliente vería su cotización duplicada. */
  useEffect(() => {
    if (isLoggedIn) return undefined;
    const alCambiarOtraPestaña = (e) => {
      if (e.key === STORE.quote && e.newValue == null) setQuote([]);
    };
    window.addEventListener('storage', alCambiarOtraPestaña);
    return () => window.removeEventListener('storage', alCambiarOtraPestaña);
  }, [isLoggedIn]);

  /* Marca "venía a cotizar" antes de mandarlo a crear cuenta. Va en
     localStorage y no en la URL porque el registro pasa por un correo de
     verificación: el link aterriza en /account y ahí ya no queda rastro de
     dónde venía. */
  const markQuoteIntent = useCallback(() => {
    try {
      window.localStorage.setItem(STORE.quoteIntent, '1');
    } catch {
      /* modo privado sin cuota: la migración funciona igual, sólo no se
         reabre el cajón solo. */
    }
  }, []);

  /* Migración de un solo tiro del carrito de invitado, tras la primera carga
     con sesión. Va aquí y no en el `action` del login porque tiene que cubrir
     los tres caminos —login normal, link de verificación y sesión ya abierta—
     y el correo puede abrirse en otro navegador que no tiene este carrito. */
  const [migratedQuote, setMigratedQuote] = useState(false);
  useEffect(() => {
    if (!hydrated || !isLoggedIn || migratedQuote) return;
    setMigratedQuote(true);

    const abrirSiVeniaACotizar = () => {
      if (window.localStorage.getItem(STORE.quoteIntent)) {
        window.localStorage.removeItem(STORE.quoteIntent);
        openQuoteDrawer();
      }
    };

    const locales = readGuestQuote();
    if (locales.length === 0) {
      window.localStorage.removeItem(STORE.quote);
      abrirSiVeniaACotizar();
      return;
    }

    const body = new URLSearchParams();
    body.set('lines', JSON.stringify(guestMergePayload(locales)));
    setQuotePending(true);
    fetch('/api/quote/merge', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body,
    })
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        const resultado = guestMergeOutcome(data);
        // Sólo se borra contra una respuesta buena: si falló, el carrito sigue
        // en el navegador y el siguiente intento lo vuelve a subir.
        if (resultado.clearLocal) window.localStorage.removeItem(STORE.quote);
        if (data?.items) setQuote((prev) => mergeQuoteState(prev, {items: data.items}));
        if (resultado.message)
          pushToast(resultado.message, {
            icon: resultado.isError ? 'alert' : 'quote',
            accent: !resultado.isError,
          });
        if (!resultado.isError) abrirSiVeniaACotizar();
      })
      .catch(() => {
        const fallo = guestMergeOutcome(null);
        pushToast(fallo.message, {icon: 'alert'});
      })
      .finally(() => setQuotePending(false));
  }, [hydrated, isLoggedIn, migratedQuote, openQuoteDrawer, pushToast]);

  const quoteCount = quotePieceCount(quote);

  const value = {
    hydrated,
    isLoggedIn,
    brandColors,
    quote,
    quoteCount,
    quotePending,
    addToQuote,
    updateQuoteQty,
    removeFromQuote,
    clearQuote,
    reorderQuote,
    markQuoteIntent,
    quoteDrawerOpen,
    openQuoteDrawer,
    closeQuoteDrawer,
    searchOpen,
    openSearch,
    closeSearch,
    favs,
    toggleFav,
    tweaks,
    setTweak,
  };

  return (
    <AppCtx.Provider value={value}>
      <ToastCtx.Provider value={pushToast}>
        {children}
        {/* Los toasts son el único canal de confirmación y de error del flujo
            de cotización, así que la región tiene que anunciarse: sin esto un
            lector de pantalla no se entera ni de "producto añadido" ni de
            "no se pudo actualizar la cantidad". */}
        <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
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
