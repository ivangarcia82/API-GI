// Landing interna: los colaboradores eligen su mochila de la campaña
// (Takayama o Wagner, regalo del proveedor). Sólo cuentas @generandoideas.com;
// la elección se manda por correo, no se guarda.
import {data, useLoaderData} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {loadCollaborator} from '~/lib/auth/collaborator-guard';
import {fetchCatalog, findVariant} from '~/lib/mochilas/catalog';
import {validateMochilaRequest} from '~/lib/mochilas/validate';
import {buildMochilaEmail, mochilasRecipient} from '~/lib/mochilas/email';
import {sendEmail} from '~/lib/email/resend';

const PATH = '/campana-mochilas';
const NO_STORE = {'Cache-Control': 'no-cache, no-store, must-revalidate'};

export const meta = () => [
  {title: 'Campaña de mochilas · Generando Ideas'},
  {name: 'robots', content: 'noindex, nofollow'},
];

/**
 * @param {import('./+types/campana-mochilas').Route.LoaderArgs} args
 */
export async function loader({context}) {
  const {user, allowed} = await loadCollaborator(context, PATH);
  if (!allowed) return data({denied: true}, {status: 403, headers: NO_STORE});

  const lines = await fetchCatalog(context.storefront);
  return data(
    {
      denied: false,
      collaborator: {
        email: user.email,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      },
      lines,
    },
    {headers: NO_STORE},
  );
}

/**
 * @param {import('./+types/campana-mochilas').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const {user, allowed} = await loadCollaborator(context, PATH);
  if (!allowed) {
    return data(
      {ok: false, formError: 'Esta página es sólo para colaboradores de Generando Ideas.'},
      {status: 403},
    );
  }

  const result = validateMochilaRequest(await request.formData());
  if (!result.ok) return data({ok: false, errors: result.errors}, {status: 400});

  // No se confía en el cliente: la variante debe seguir en una línea de la
  // campaña y con inventario al momento de enviar.
  const lines = await fetchCatalog(context.storefront);
  const match = findVariant(lines, result.values.variantId);
  if (!match) {
    return data(
      {ok: false, errors: {variantId: 'Esa mochila ya no está disponible. Elige otra.'}},
      {status: 400},
    );
  }

  const {subject, html} = buildMochilaEmail({email: user.email, values: result.values, ...match});
  try {
    await sendEmail(context.env, {
      to: mochilasRecipient(context.env),
      cc: user.email,
      replyTo: user.email,
      subject,
      html,
    });
  } catch (err) {
    console.error('[campana-mochilas] send failed:', err);
    return data(
      {ok: false, formError: 'No pudimos enviar tu elección, intenta de nuevo.'},
      {status: 502},
    );
  }

  return data({
    ok: true,
    summary: {
      line: match.line.name,
      model: match.product.name,
      color: match.variant.color,
      foraneo: result.values.foraneo,
    },
  });
}

export default function CampanaMochilas() {
  const loaderData = useLoaderData();
  if (loaderData.denied) return <p>Esta página es sólo para colaboradores de Generando Ideas.</p>;
  return <pre>{JSON.stringify(loaderData.lines.map((l) => l.name))}</pre>;
}
