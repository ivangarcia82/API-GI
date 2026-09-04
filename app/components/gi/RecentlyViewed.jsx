/* Generando Ideas — "Vistos recientemente" strip for the PDP.
   Client-only: records the current product in localStorage history on mount and
   renders the previously viewed products (excluding the current one). Renders
   nothing on the server / first paint to avoid hydration mismatch. */
import {useEffect, useState} from 'react';
import {ProductCard} from '~/components/gi/ProductCard';
import {getRecentlyViewed, pushRecentlyViewed} from '~/lib/recentlyViewed';
import {useApp} from '~/lib/AppContext';
import {productMatchesBrand} from '~/lib/brand-colors';

/**
 * @param {object} props
 * @param {{id: string} & Record<string, any>} props.current - snapshot of the product being viewed
 * @param {number} [props.max] - max cards to show
 */
export function RecentlyViewed({current, max = 4}) {
  const [items, setItems] = useState([]);
  const {brandColors = []} = useApp();

  useEffect(() => {
    if (current?.id) pushRecentlyViewed(current);
    // Client requirement: hide products with no image everywhere, including
    // this history strip (it builds its own snapshot shape in
    // products.$handle.jsx, bypassing normalizeProduct — see recentSnapshot).
    // El historial es de localStorage: puede traer productos vistos antes de
    // que le asignaran la paleta, o desde otra cuenta en el mismo navegador.
    setItems(
      getRecentlyViewed(current?.id)
        .filter((p) => p?.image && productMatchesBrand(p, brandColors))
        .slice(0, max),
    );
    // Re-run only when the viewed product changes (not on variant tweaks).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, max, brandColors]);

  if (items.length === 0) return null;

  return (
    <section className="section container" style={{paddingTop: 8}}>
      <div className="section-head">
        <div>
          <div className="eyebrow">// Tu historial</div>
          <h2>Vistos recientemente</h2>
        </div>
      </div>
      <div className="product-grid">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
