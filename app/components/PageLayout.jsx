/* Generando Ideas — page layout shell */
import {GiHeader} from '~/components/gi/Header';
import {GiFooter} from '~/components/gi/Footer';
import {RoleBanner, TweaksPanel} from '~/components/gi/RoleBanner';
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
      <GiHeader cart={cart} isLoggedIn={isLoggedIn} />
      <RoleBanner />
      <main style={{minHeight: '60vh'}} className="fade-in">
        {children}
      </main>
      <GiFooter />
      <TweaksPanel />
      <QuoteDrawer />
    </>
  );
}
