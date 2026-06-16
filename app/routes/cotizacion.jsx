import {useEffect} from 'react';
import {useNavigate} from 'react-router';
import {useApp} from '~/lib/AppContext';

export const meta = () => [{title: 'Cotización · Generando Ideas'}];

/**
 * The quote now lives entirely in the cart-style drawer (see QuoteDrawer).
 * This legacy route just opens the drawer and sends the visitor to the catalog
 * behind it, so old links / bookmarks to /cotizacion still surface the quote.
 */
export default function Cotizacion() {
  const navigate = useNavigate();
  const {openQuoteDrawer} = useApp();
  useEffect(() => {
    openQuoteDrawer();
    navigate('/catalogo', {replace: true});
  }, [openQuoteDrawer, navigate]);
  return <div className="container" style={{minHeight: '50vh'}} />;
}
