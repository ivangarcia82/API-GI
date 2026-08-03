import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {
  updateProfile,
  findById,
  getPasswordRecord,
  updatePassword,
} from '~/lib/auth/users';
import {verifyPassword} from '~/lib/auth/password';
import {validatePasswordChange} from '~/lib/auth/password-policy';
import {loginSession} from '~/lib/auth/session';
import {
  clientIp,
  recentFailures,
  recordAttempt,
  MAX_ATTEMPTS,
} from '~/lib/auth/attempts';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Mi perfil · Generando Ideas'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await requireUser(context);
  return {};
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  const {userId} = await requireUser(context);
  const db = getDb(context.env);

  if (request.method === 'PUT') {
    return updateProfileAction({request, db, userId});
  }
  if (request.method === 'POST') {
    return changePasswordAction({request, context, db, userId});
  }
  return data({error: 'Method not allowed'}, {status: 405});
}

async function updateProfileAction({request, db, userId}) {
  const form = await request.formData();

  const firstName = String(form.get('firstName') ?? '') || null;
  const lastName = String(form.get('lastName') ?? '') || null;
  const company = String(form.get('company') ?? '') || null;
  const razonSocial = String(form.get('razonSocial') ?? '') || null;

  try {
    await updateProfile(db, userId, {firstName, lastName, company, razonSocial});
    const user = await findById(db, userId);
    return {error: null, user};
  } catch (error) {
    return data({error: error.message, user: null}, {status: 400});
  }
}

async function changePasswordAction({request, context, db, userId}) {
  const form = await request.formData();
  const current = String(form.get('currentPassword') ?? '');
  const next = String(form.get('newPassword') ?? '');
  const confirm = String(form.get('confirmPassword') ?? '');

  // La sesión sólo guarda el snapshot de la cookie; el correo (clave del
  // contador de intentos) y role/gid (para el re-login) vienen de la base.
  const user = await findById(db, userId);
  if (!user) {
    return data({error: 'Tu sesión ya no es válida.', passwordChanged: false}, {status: 401});
  }

  const ip = clientIp(request);
  if ((await recentFailures(db, user.email, ip)) >= MAX_ATTEMPTS) {
    return data(
      {error: 'Demasiados intentos. Intenta de nuevo en unos minutos.', passwordChanged: false},
      {status: 429},
    );
  }

  // Las reglas puras van primero: evitan un PBKDF2 de 100k iteraciones cuando
  // la petición ya es inválida por longitud, confirmación o repetición.
  const invalido = validatePasswordChange({current, next, confirm});
  if (invalido) {
    return data({error: invalido, passwordChanged: false}, {status: 400});
  }

  const rec = await getPasswordRecord(db, userId);
  const ok = rec ? await verifyPassword(current, rec, context.env) : false;
  if (!ok) {
    await recordAttempt(db, user.email, ip, false);
    return data(
      {error: 'La contraseña actual es incorrecta.', passwordChanged: false},
      {status: 401},
    );
  }

  // updatePassword sube session_version, lo que invalida TODA sesión con la
  // versión vieja — incluida esta. Re-emitir la cookie con la versión nueva es
  // lo que mantiene dentro a este navegador y deja fuera a los demás.
  const nuevaVersion = await updatePassword(db, context.env, userId, next);
  loginSession(context.session, {
    userId,
    role: user.role,
    gid: user.shopifyCustomerGid,
    sessionVersion: nuevaVersion,
  });

  return {error: null, passwordChanged: true};
}

export default function AccountProfile() {
  const {user: contextUser} = useOutletContext();
  const {state} = useNavigation();
  /** @type {ActionReturnData} */
  const actionData = useActionData();
  const user = actionData?.user ?? contextUser;
  const saved = Boolean(actionData && !actionData.error && actionData.user);

  return (
    <>
      <h1>Mi perfil</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Actualiza tus datos de contacto y facturación.
      </p>

      <Form method="PUT" className="acct-form">
        <div className="acct-form-grid">
          <div className="field">
            <label htmlFor="firstName">Nombre</label>
            <input
              className="input"
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Nombre"
              defaultValue={user?.firstName ?? ''}
              minLength={2}
            />
          </div>
          <div className="field">
            <label htmlFor="lastName">Apellido</label>
            <input
              className="input"
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Apellido"
              defaultValue={user?.lastName ?? ''}
              minLength={2}
            />
          </div>
          <div className="field acct-form-full">
            <label htmlFor="company">Empresa</label>
            <input
              className="input"
              id="company"
              name="company"
              type="text"
              autoComplete="organization"
              placeholder="Nombre de tu empresa"
              defaultValue={user?.company ?? ''}
            />
          </div>
          <div className="field acct-form-full">
            <label htmlFor="razonSocial">Razón social</label>
            <input
              className="input"
              id="razonSocial"
              name="razonSocial"
              type="text"
              placeholder="Acme Corporativo S.A. de C.V."
              defaultValue={user?.razonSocial ?? ''}
            />
          </div>
          <div className="field acct-form-full">
            <label htmlFor="email">Correo de acceso</label>
            <input className="input" id="email" type="email" defaultValue={user?.email ?? ''} disabled />
            <span className="help-msg">El correo de acceso no se cambia desde aquí.</span>
          </div>
        </div>

        {actionData?.error && (
          <p className="error-msg" role="alert">
            {actionData.error}
          </p>
        )}
        {saved && (
          <p className="help-msg" style={{color: 'var(--ok)'}} role="status">
            Cambios guardados.
          </p>
        )}

        <div className="acct-form-actions">
          <button type="submit" className="btn btn-accent" disabled={state !== 'idle'}>
            {state !== 'idle' ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </Form>
    </>
  );
}

/**
 * @typedef {{
 *   error: string | null;
 *   user: object | null;
 * }} ActionResponse
 */

/** @typedef {import('./+types/account.profile').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
