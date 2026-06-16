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
import {updateProfile, findById} from '~/lib/auth/users';

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

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const {userId} = await requireUser(context);
  const db = getDb(context.env);
  const form = await request.formData();

  const firstName = String(form.get('firstName') ?? '') || null;
  const lastName = String(form.get('lastName') ?? '') || null;
  const company = String(form.get('company') ?? '') || null;
  const rfc = String(form.get('rfc') ?? '') || null;

  try {
    await updateProfile(db, userId, {firstName, lastName, company, rfc});
    const user = await findById(db, userId);
    return {error: null, user};
  } catch (error) {
    return data({error: error.message, user: null}, {status: 400});
  }
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
            <label htmlFor="rfc">RFC</label>
            <input
              className="input"
              id="rfc"
              name="rfc"
              type="text"
              placeholder="XAXX010101000"
              defaultValue={user?.rfc ?? ''}
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
