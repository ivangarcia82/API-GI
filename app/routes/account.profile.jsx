import {useEffect, useRef, useState} from 'react';
import {
  data,
  Form,
  useActionData,
  useFetcher,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {Icon} from '~/components/gi/Icon';
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

// Campo de contraseña con toggle de visibilidad. Mismo patrón que registro.jsx.
function PasswordField({id, name, label, autoComplete, help}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field acct-form-full">
      <label htmlFor={id}>{label}</label>
      <div style={{position: 'relative'}}>
        <input
          className="input"
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={8}
          required
          style={{paddingRight: 44}}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            color: 'var(--ink-3)',
          }}
        >
          <Icon name={visible ? 'eye_off' : 'eye'} size={18} />
        </button>
      </div>
      {help && <span className="help-msg">{help}</span>}
    </div>
  );
}

export default function AccountProfile() {
  const {user: contextUser} = useOutletContext();
  const {state} = useNavigation();
  /** @type {ActionReturnData} */
  const actionData = useActionData();
  const user = actionData?.user ?? contextUser;
  const saved = Boolean(actionData && !actionData.error && actionData.user);

  const pwFetcher = useFetcher();
  const pwBusy = pwFetcher.state !== 'idle';
  const pwChanged = pwFetcher.data?.passwordChanged === true;
  const pwFormRef = useRef(null);

  useEffect(() => {
    if (pwFetcher.state === 'idle' && pwFetcher.data?.passwordChanged) {
      pwFormRef.current?.reset();
    }
  }, [pwFetcher.state, pwFetcher.data]);

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

      <h2 style={{margin: '4px 0 -8px', fontSize: 18}}>Seguridad</h2>
      <pwFetcher.Form method="POST" className="acct-form" ref={pwFormRef}>
        <div className="acct-form-grid">
          <PasswordField
            id="currentPassword"
            name="currentPassword"
            label="Contraseña actual"
            autoComplete="current-password"
          />
          <PasswordField
            id="newPassword"
            name="newPassword"
            label="Nueva contraseña"
            autoComplete="new-password"
            help="Mínimo 8 caracteres."
          />
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmar nueva contraseña"
            autoComplete="new-password"
          />
        </div>

        {pwFetcher.data?.error && (
          <p className="error-msg" role="alert">
            {pwFetcher.data.error}
          </p>
        )}
        {pwChanged && (
          <p className="help-msg" style={{color: 'var(--ok)'}} role="status">
            Contraseña actualizada. Cerramos la sesión en tus otros dispositivos.
          </p>
        )}

        <div className="acct-form-actions">
          <button type="submit" className="btn btn-accent" disabled={pwBusy}>
            {pwBusy ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </pwFetcher.Form>
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
