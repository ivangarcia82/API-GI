/* Generando Ideas — predictive search modal.
   Search stays in-page: clicking the header search icon opens this modal and
   results stream in as you type (no navigation away from the current page).
   Controlled by AppContext (searchOpen). Hits the same /search route in
   predictive mode that the rest of the app already uses. */
import {useEffect, useRef, useState} from 'react';
import {Link, useFetcher, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {PH} from '~/components/gi/ui';
import {useApp} from '~/lib/AppContext';
import {formatPrice, HOME_CATEGORIES} from '~/lib/gi';

const EMPTY_ITEMS = {
  articles: [],
  collections: [],
  pages: [],
  products: [],
  queries: [],
};

export function GiSearchModal() {
  const {searchOpen, closeSearch, isLoggedIn} = useApp();
  const navigate = useNavigate();
  const fetcher = useFetcher({key: 'gi-search'});
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const [term, setTerm] = useState('');

  const items = fetcher.data?.result?.items ?? EMPTY_ITEMS;
  const total = fetcher.data?.result?.total ?? 0;
  const loading = fetcher.state !== 'idle';
  const hasTerm = term.trim().length > 0;

  // Lock page scroll while the modal is open.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.style.overflow = searchOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [searchOpen]);

  // Focus the input on open, close on Escape, and reset the term on close.
  useEffect(() => {
    if (!searchOpen) {
      setTerm('');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return undefined;
    }
    const focus = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e) => {
      if (e.key === 'Escape') closeSearch();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focus);
      document.removeEventListener('keydown', onKey);
    };
  }, [searchOpen, closeSearch]);

  function runSearch(value) {
    setTerm(value);
    const q = value.trim();
    // Debounce so we don't fire a /search request on every keystroke.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) return;
    debounceRef.current = setTimeout(() => {
      fetcher.submit(
        {q, limit: 6, predictive: true},
        {method: 'GET', action: '/search'},
      );
    }, 220);
  }

  function goToResults() {
    const q = term.trim();
    if (!q) return;
    closeSearch();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  const products = items.products || [];
  const collections = items.collections || [];
  const queries = (items.queries || []).filter((q) => q && q.text);

  return (
    <div
      className={`gis-overlay ${searchOpen ? 'open' : ''}`}
      aria-hidden={!searchOpen}
    >
      <button
        type="button"
        className="gis-scrim"
        aria-label="Cerrar búsqueda"
        tabIndex={-1}
        onClick={closeSearch}
      />
      <div
        className="gis-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar productos"
        {...(searchOpen ? {} : {inert: ''})}
      >
        <form
          className="gis-head"
          onSubmit={(e) => {
            e.preventDefault();
            goToResults();
          }}
        >
          <Icon name="search" size={18} className="gis-head-icon" />
          <input
            ref={inputRef}
            type="search"
            className="gis-input"
            placeholder="Busca productos, categorías…"
            value={term}
            onChange={(e) => runSearch(e.target.value)}
            autoComplete="off"
            aria-label="Buscar"
          />
          <button
            type="button"
            className="gis-close"
            onClick={closeSearch}
            aria-label="Cerrar"
          >
            <Icon name="x" size={16} />
          </button>
        </form>

        <div className="gis-body">
          {!hasTerm && (
            <div className="gis-section">
              <div className="gis-section-label">Categorías populares</div>
              <div className="gis-chips">
                {HOME_CATEGORIES.map((c) => (
                  <Link
                    key={c.handle}
                    to={`/collections/${c.handle}`}
                    className="gis-chip"
                    onClick={closeSearch}
                  >
                    <Icon name={c.icon} size={13} />
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {hasTerm && queries.length > 0 && (
            <div className="gis-section">
              <div className="gis-chips">
                {queries.map((q) => (
                  <button
                    key={q.text}
                    type="button"
                    className="gis-chip"
                    onClick={() => runSearch(q.text)}
                  >
                    <Icon name="search" size={12} />
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasTerm && collections.length > 0 && (
            <div className="gis-section">
              <div className="gis-section-label">Colecciones</div>
              <div className="gis-chips">
                {collections.map((c) => (
                  <Link
                    key={c.id}
                    to={`/collections/${c.handle}`}
                    className="gis-chip"
                    onClick={closeSearch}
                  >
                    <Icon name="layers" size={13} />
                    {c.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {hasTerm && products.length > 0 && (
            <div className="gis-section">
              <div className="gis-section-label">Productos</div>
              <div className="gis-rows">
                {products.map((p) => {
                  const variant = p.selectedOrFirstAvailableVariant;
                  const image = variant?.image;
                  const price = variant?.price;
                  return (
                    <Link
                      key={p.id}
                      to={`/products/${p.handle}`}
                      className="gis-row"
                      onClick={closeSearch}
                    >
                      <PH
                        src={image?.url}
                        alt={image?.altText || p.title}
                        className="gis-thumb"
                      />
                      <div className="gis-row-main">
                        <div className="gis-row-title">{p.title}</div>
                        {isLoggedIn && price ? (
                          <div className="gis-row-price">
                            {formatPrice(price.amount, price.currencyCode)}
                          </div>
                        ) : (
                          <div className="gis-row-sub">
                            <Icon name="eye_off" size={11} /> Precio para clientes
                          </div>
                        )}
                      </div>
                      <Icon name="arrow_right" size={15} className="gis-row-arrow" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {hasTerm && !loading && total === 0 && (
            <div className="gis-empty">
              <Icon name="search" size={28} className="muted-2" />
              <p>
                Sin resultados para <q>{term.trim()}</q>
              </p>
            </div>
          )}
        </div>

        {hasTerm && (
          <button type="button" className="gis-foot" onClick={goToResults}>
            <span>
              Ver todos los resultados para <strong>{term.trim()}</strong>
            </span>
            <Icon name="arrow_right" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
