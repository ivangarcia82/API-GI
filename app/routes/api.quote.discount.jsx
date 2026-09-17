import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getDiscountByCode} from '~/lib/admin/operations';
import {getOrCreateDraftQuote, getQuoteWithItems, setQuoteDiscount} from '~/lib/quotes/repo';

/* El motivo por el que Shopify rechazó el cupón, en español y accionable. Un
   "código inválido" genérico haría que el comprador reescriba el mismo código
   tres veces cuando el problema es que venció. */
const MENSAJES = {
  'no-existe': 'Ese código no existe en nuestra tienda. Revísalo e inténtalo de nuevo.',
  inactivo: 'Ese cupón no está vigente. Si crees que es un error, pregúntale a tu ejecutivo.',
  'no-porcentaje':
    'Ese cupón no es un descuento por porcentaje, así que no podemos reflejarlo en la cotización. Tu ejecutivo puede aplicarlo por ti.',
  restringido:
    'Ese cupón tiene condiciones (productos específicos o monto mínimo) que no podemos calcular aquí. Tu ejecutivo puede aplicarlo por ti.',
};

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env} = context;
  const db = getDb(env);

  const form = await request.formData();
  const clear = String(form.get('clear') || '') === 'true';
  const code = String(form.get('code') || '').trim();

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);

  if (clear) {
    await setQuoteDiscount(db, quote.id, null);
    const after = await getQuoteWithItems(db, quote.id);
    return Response.json({ok: true, quoteId: quote.id, items: after.items, discount: null});
  }

  if (!code) return Response.json({error: 'Escribe un código de descuento.'}, {status: 400});

  // El porcentaje SIEMPRE lo decide Shopify. Aquí no hay ninguna tabla de
  // cupones que mantener: si mañana el 20% pasa a 15%, el sitio obedece solo.
  let resultado;
  try {
    resultado = await getDiscountByCode(env, code);
  } catch (err) {
    console.error('[quote.discount] lookup failed:', err);
    const detalle = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error:
          env.ENVIRONMENT === 'production'
            ? 'No pudimos validar el cupón con Shopify. Inténtalo de nuevo en un momento.'
            : `No pudimos validar el cupón: ${detalle}`,
      },
      {status: 502},
    );
  }

  if (!resultado.ok) {
    return Response.json({error: MENSAJES[resultado.reason] ?? MENSAJES['no-existe']}, {status: 422});
  }

  await setQuoteDiscount(db, quote.id, {
    code: resultado.code,
    percentage: resultado.percentage,
  });
  const after = await getQuoteWithItems(db, quote.id);
  return Response.json({
    ok: true,
    quoteId: quote.id,
    items: after.items,
    discount: {
      code: resultado.code,
      title: resultado.title,
      percentage: resultado.percentage,
    },
  });
}
