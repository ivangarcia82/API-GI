import {createHydrogenContext, createWithCache} from '@shopify/hydrogen';
import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';

// Define the additional context object
const additionalContext = {
  // Additional context for custom properties, CMS clients, 3P SDKs, etc.
  // These will be available as both context.propertyName and context.get(propertyContext)
  // Example of complex objects that could be added:
  // cms: await createCMSClient(env),
  // reviews: await createReviewsClient(env),
};

/**
 * Creates Hydrogen context for React Router 7.9.x
 * Returns HydrogenRouterContextProvider with hybrid access patterns
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} executionContext
 */
export async function createHydrogenRouterContext(
  request,
  env,
  executionContext,
) {
  /**
   * Open a cache instance in the worker and a custom session instance.
   */
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  // Caché de subrequest para lo que no pasa por la Storefront API. La usa
  // getBrandColors: leer la paleta del cliente por Admin API en cada carga de
  // cada página sería un round trip de más en toda la aplicación.
  const withCache = createWithCache({cache, waitUntil, request});

  const hydrogenContext = createHydrogenContext(
    {
      env,
      request,
      cache,
      waitUntil,
      session,
      // Mexican storefront: Storefront API queries run @inContext(country: MX,
      // language: ES) so prices come back in MXN to match the es-MX UI.
      i18n: {language: 'ES', country: 'MX'},
      cart: {
        queryFragment: CART_QUERY_FRAGMENT,
      },
    },
    {...additionalContext, withCache},
  );

  return hydrogenContext;
}

/** @typedef {Class<additionalContext>} AdditionalContextType */
