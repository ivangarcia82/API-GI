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

  return (
    <div className="account-profile">
      <h2>Mi perfil</h2>
      <br />
      <Form method="PUT">
        <legend>Información personal</legend>
        <fieldset>
          <label htmlFor="firstName">Nombre</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder="Nombre"
            aria-label="Nombre"
            defaultValue={user?.firstName ?? ''}
            minLength={2}
          />
          <label htmlFor="lastName">Apellido</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Apellido"
            aria-label="Apellido"
            defaultValue={user?.lastName ?? ''}
            minLength={2}
          />
          <label htmlFor="company">Empresa</label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            placeholder="Empresa"
            aria-label="Empresa"
            defaultValue={user?.company ?? ''}
          />
          <label htmlFor="rfc">RFC</label>
          <input
            id="rfc"
            name="rfc"
            type="text"
            placeholder="RFC"
            aria-label="RFC"
            defaultValue={user?.rfc ?? ''}
          />
        </fieldset>
        {actionData?.error ? (
          <p>
            <mark>
              <small>{actionData.error}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        <button type="submit" disabled={state !== 'idle'}>
          {state !== 'idle' ? 'Guardando' : 'Guardar'}
        </button>
      </Form>
    </div>
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
