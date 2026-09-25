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
import {getDb} from '~/lib/db/client';
import {
  createMochilaRequest,
  deleteMochilaRequest,
  findMochilaRequest,
} from '~/lib/mochilas/requests';
import MochilasLanding from '~/components/mochilas/MochilasLanding';
import mochilasStyles from '~/styles/gi-mochilas.css?url';

const PATH = '/campana-mochilas';
const NO_STORE = {'Cache-Control': 'no-cache, no-store, must-revalidate'};

export const meta = () => [
  {title: 'Campaña de mochilas · Generando Ideas'},
  {name: 'robots', content: 'noindex, nofollow'},
];

export const links = () => [{rel: 'stylesheet', href: mochilasStyles}];

/**
 * @param {import('./+types/campana-mochilas').Route.LoaderArgs} args
 */
export async function loader({context}) {
  const {user, allowed} = await loadCollaborator(context, PATH);
  if (!allowed) return data({denied: true}, {status: 403, headers: NO_STORE});

  const collaborator = {
    email: user.email,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
  };
  // Quien ya pidió sólo ve su solicitud: el catálogo no le sirve de nada.
  const existing = await findMochilaRequest(getDb(context.env), user.id);
  if (existing) return data({denied: false, collaborator, existing}, {headers: NO_STORE});

  const lines = await fetchCatalog(context.storefront);
  return data({denied: false, collaborator, existing: null, lines}, {headers: NO_STORE});
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

  // Primero se aparta el lugar: la llave primaria decide quién ya pidió, aun
  // con dos envíos simultáneos. El correo sale sólo si esto entró.
  const db = getDb(context.env);
  const {values} = result;
  const {created} = await createMochilaRequest(db, {
    userId: user.id,
    email: user.email,
    line: match.line.name,
    model: match.product.name,
    color: match.variant.color,
    variantId: match.variant.id,
    image: match.variant.image,
    foraneo: values.foraneo,
    details: {
      fullName: values.fullName,
      position: values.position,
      phone: values.phone,
      shipping: values.shipping,
    },
  });
  if (!created) {
    return data(
      {
        ok: false,
        formError: 'Ya enviaste tu solicitud.',
        existing: await findMochilaRequest(db, user.id),
      },
      {status: 409},
    );
  }

  const {subject, html} = buildMochilaEmail({email: user.email, values, ...match});
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
    // Sin correo, igarcia@ no se entera: se libera para que el colaborador reintente.
    await deleteMochilaRequest(db, user.id);
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
      image: match.variant.image,
      foraneo: values.foraneo,
    },
  });
}

export default function CampanaMochilas() {
  const loaderData = useLoaderData();
  if (loaderData.denied) {
    return (
      <main className="mc-denied">
        <span className="eyebrow">Acceso restringido</span>
        <h1 className="display">Esta página es sólo para colaboradores.</h1>
        <p className="mc-muted">
          Entra con tu correo @generandoideas.com para elegir tu mochila.
        </p>
        <form method="post" action="/auth/logout">
          <button type="submit" className="mc-submit">
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }
  return <MochilasLanding lines={loaderData.lines} collaborator={loaderData.collaborator} />;
}
