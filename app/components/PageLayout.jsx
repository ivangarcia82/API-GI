/* Generando Ideas — page layout shell */
import {GiHeader} from '~/components/gi/Header';
import {GiFooter} from '~/components/gi/Footer';
import {QuoteDrawer} from '~/components/gi/QuoteDrawer';

/**
 * @param {object} props
 * @param {Promise<any>} [props.cart]
 * @param {boolean} [props.isLoggedIn]
 * @param {React.ReactNode} props.children
 */
export function PageLayout({cart, isLoggedIn = false, children}) {
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <GiHeader cart={cart} isLoggedIn={isLoggedIn} />
      <main id="main" tabIndex={-1} style={{minHeight: '60vh'}} className="fade-in">
        {children}
      </main>
      <GiFooter />
      <QuoteDrawer />
    </>
  );
}
