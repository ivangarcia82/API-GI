import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

/**
 * @param {Request} request
 * @param {number} responseStatusCode
 * @param {Headers} responseHeaders
 * @param {EntryContext} reactRouterContext
 * @param {HydrogenRouterContextProvider} context
 */
export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
  context,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    // Allow Google Fonts (Gantari / Open Sans / Bebas Neue — tipografías de marca)
    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.shopify.com', 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    // img-src falls back to default-src (self + cdn.shopify.com), which blocks
    // the editorial/lifestyle imagery served from Unsplash (lookbook grid,
    // hero, reviews). Allow it explicitly while keeping Shopify product images.
    // Also allow Google Analytics (tracking pixel) and Brevo (avatars/assets).
    imgSrc: [
      "'self'",
      'data:',
      'https://cdn.shopify.com',
      'https://images.unsplash.com',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://*.brevo.com',
    ],
    // Allow Google Tag Manager / Analytics and Brevo Conversations widget scripts.
    scriptSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://conversations-widget.brevo.com',
    ],
    // Allow GA beacon/config requests and the Brevo Conversations API/websocket.
    connectSrc: [
      "'self'",
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://conversations-widget.brevo.com',
      'https://api.brevo.com',
      'https://*.brevo.com',
    ],
    // Allow the Brevo Conversations widget iframe.
    frameSrc: ["'self'", 'https://conversations-widget.brevo.com'],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

/** @typedef {import('@shopify/hydrogen').HydrogenRouterContextProvider} HydrogenRouterContextProvider */
/** @typedef {import('react-router').EntryContext} EntryContext */
