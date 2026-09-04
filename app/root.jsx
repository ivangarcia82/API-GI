import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useLocation,
  useRouteError,
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import resetStyles from '~/styles/reset.css?url';
import giTokens from '~/styles/gi-tokens.css?url';
import giScreens from '~/styles/gi-screens.css?url';
import giSections from '~/styles/gi-sections.css?url';
import giMarketing from '~/styles/gi-marketing.css?url';
import {PageLayout} from './components/PageLayout';
import {AppProvider} from '~/lib/AppContext';
import {getSessionUser} from '~/lib/auth/session';
import {getBrandColors} from '~/lib/brand-colors.server';
import {getDb} from '~/lib/db/client';
import {listWishlist} from '~/lib/wishlist/repo';
import {getOrCreateDraftQuote, getQuoteWithItems} from '~/lib/quotes/repo';

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 * @type {ShouldRevalidateFunction}
 */
export const shouldRevalidate = ({formMethod, currentUrl, nextUrl}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
/**
 * Brand SEO defaults. React Router renders the deepest route's meta, so this
 * applies as a fallback to routes that don't export their own meta.
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  const origin = data?.origin ?? '';
  return [
    {title: 'Generando Ideas · Artículos promocionales y regalos corporativos B2B'},
    {
      name: 'description',
      content:
        'Catálogo B2B de artículos promocionales y regalos corporativos personalizados en México. Cotiza en línea con precios por proyecto.',
    },
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Generando Ideas',
        description:
          'Catálogo B2B de artículos promocionales y regalos corporativos personalizados en México.',
        ...(origin ? {url: origin, logo: `${origin}/brand/gi-logo-horizontal.svg`} : {}),
        areaServed: 'MX',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'sales',
          email: 'marketing@generandoideas.com',
          telephone: '+525570988100',
          availableLanguage: 'Spanish',
        },
      },
    },
  ];
};

export function links() {
  return [
    {rel: 'preconnect', href: 'https://cdn.shopify.com'},
    {rel: 'preconnect', href: 'https://shop.app'},
    {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous'},
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Gantari:wght@300;400;500;600;700;800&family=Open+Sans:wght@300;400;500;600;700;800&family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600&display=swap',
    },
    {rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg'},
  ];
}

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;

  return {
    ...deferredData,
    ...criticalData,
    origin: new URL(args.request.url).origin,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context}) {
  const {storefront, session} = context;
  const sessionUser = getSessionUser(session);

  const [header, marca] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // La tira de "vistos recientemente" vive en localStorage y se pinta en
    // cliente: necesita la paleta para no enseñar lo que ninguna lista
    // enseñaría. El memo por request hace que esto no cueste una llamada extra.
    getBrandColors(context),
  ]);

  let favs = [];
  let quote = [];
  if (sessionUser) {
    try {
      const db = getDb(context.env);
      // Server-authoritative draft: get-or-create the user's draft quote, then
      // hydrate its line items (keyed by server item.id) for AppProvider.
      const [favIds, draft] = await Promise.all([
        listWishlist(db, sessionUser.userId),
        getOrCreateDraftQuote(db, sessionUser.userId),
      ]);
      favs = favIds ?? [];
      const {items} = await getQuoteWithItems(db, draft.id);
      quote = items ?? [];
    } catch {
      favs = [];
      quote = [];
    }
  }

  return {
    header,
    isLoggedIn: Boolean(sessionUser),
    brandColors: marca?.families || [],
    favs,
    quote,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  const {storefront, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    footer,
  };
}

/**
 * @param {{children?: React.ReactNode}}
 */
export function Layout({children}) {
  const nonce = useNonce();

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,viewport-fit=cover"
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Generando Ideas" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={giTokens}></link>
        <link rel="stylesheet" href={giScreens}></link>
        <link rel="stylesheet" href={giSections}></link>
        <link rel="stylesheet" href={giMarketing}></link>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-4Z8RFG1DT0"
          nonce={nonce}
        ></script>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-4Z8RFG1DT0');",
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "(function(d,w,c){w.BrevoConversationsID='5e8cd971af0ac252357152dc';w[c]=w[c]||function(){(w[c].q=w[c].q||[]).push(arguments);};var s=d.createElement('script');s.async=true;s.src='https://conversations-widget.brevo.com/brevo-conversations.js';if(d.head)d.head.appendChild(s);})(document,window,'BrevoConversations');",
          }}
        />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  /** @type {RootLoader} */
  const data = useRouteLoaderData('root');

  if (!data) {
    return <Outlet />;
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <AppProvider
        isLoggedIn={data.isLoggedIn}
        brandColors={data.brandColors}
        quote={data.quote}
        favs={data.favs}
      >
        <PageLayout {...data}>
          <Outlet />
        </PageLayout>
      </AppProvider>
    </Analytics.Provider>
  );
}

/**
 * Un 404 suele llegar desde un enlace viejo en un correo del asesor, con un
 * SKU o un nombre de producto en la URL. Mandar sólo a la portada obliga a
 * empezar de cero: aquí se rescata ese texto y se ofrece como búsqueda, más
 * las dos salidas que de verdad se usan (catálogo y contacto).
 * @param {string} pathname
 * @returns {string} término aprovechable, o '' si no hay nada rescatable
 */
export function terminoDesdeRuta(pathname = '') {
  const ultimo = decodeURIComponent(String(pathname))
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .pop();
  if (!ultimo) return '';
  const limpio = ultimo
    .replace(/\.[a-z0-9]{2,5}$/i, '') // extensión de archivo
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Un id o un hash no le sirven de nada a nadie como término de búsqueda.
  if (limpio.length < 3 || /^\d+$/.test(limpio)) return '';
  return limpio;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
  }
  const isNotFound = errorStatus === 404;
  const termino = isNotFound ? terminoDesdeRuta(location?.pathname) : '';

  return (
    <div className="container" style={{padding: '96px 0', textAlign: 'center'}}>
      <div className="eyebrow">// Error {errorStatus}</div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 'clamp(32px, 5vw, 56px)',
          letterSpacing: '-0.03em',
          margin: '12px 0 12px',
        }}
      >
        {isNotFound ? 'Página no encontrada' : 'Algo salió mal'}
      </h1>
      <p style={{color: 'var(--ink-3)', maxWidth: 520, margin: '0 auto 24px'}}>
        {isNotFound
          ? termino
            ? `No encontramos “${termino}” en esta dirección. Puede que el producto haya cambiado de nombre.`
            : 'La página que buscas no existe o fue movida.'
          : 'Ocurrió un error inesperado. Intenta de nuevo en unos momentos.'}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {termino ? (
          <a className="btn btn-accent" href={`/search?q=${encodeURIComponent(termino)}`}>
            Buscar “{termino}”
          </a>
        ) : null}
        <a className="btn btn-primary" href="/catalogo">
          Ver catálogo
        </a>
        <a className="btn btn-ghost" href="/contacto">
          Hablar con un asesor
        </a>
      </div>
    </div>
  );
}

/** @typedef {LoaderReturnData} RootLoader */

/** @typedef {import('react-router').ShouldRevalidateFunction} ShouldRevalidateFunction */
/** @typedef {import('./+types/root').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
