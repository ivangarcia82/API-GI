import {redirect, data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {createUser, EmailTakenError} from '~/lib/auth/users';
import {linkSignupCustomer} from '~/lib/auth/signup-link';
import {claimedAdvisorHandle} from '~/lib/auth/advisor-choice';
import {AREAS, UBICACIONES, esOpcionValida, esOrigenValido} from './registro.catalogos.js';
import {sendVerificationEmail} from '~/lib/auth/verify-link';
import {safeRedirectTo} from '~/lib/auth/redirect-to';
import {isCollaboratorEmail} from '~/lib/auth/collaborator';

/**
 * @param {import('./+types/auth.signup').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const firstName = String(form.get('firstName') ?? '') || null;
  const lastName = String(form.get('lastName') ?? '') || null;
  const company = String(form.get('company') ?? '') || null;
  const razonSocial = String(form.get('razonSocial') ?? '') || null;
  const phone = String(form.get('phone') ?? '') || null;
  const volume = String(form.get('volume') ?? '') || null;
  const needs = String(form.get('needs') ?? '') || null;
  const position = String(form.get('position') ?? '') || null;
  const area = String(form.get('area') ?? '') || null;
  const heardAbout = String(form.get('heardAbout') ?? '') || null;
  const location = String(form.get('location') ?? '') || null;
  const esCliente = String(form.get('esCliente') ?? '') || null;
  const newsletterOptIn = String(form.get('newsletter') ?? '') === '1';
  // Una sola casilla cubre ambos documentos; se guarda una fecha por cada uno
  // para que la evidencia siga siendo por documento si mañana se separan.
  const legalOk = String(form.get('legal') ?? '') === '1';

  // El asesor viaja como handle y ya NO se asigna: marketing valida la
  // asignación en el admin de Shopify. Aquí sólo se guarda lo que el usuario
  // reclamó, para que el aviso a marketing pueda mostrarlo.
  const advisorHandle = claimedAdvisorHandle({
    esCliente: String(form.get('esCliente') ?? ''),
    advisor: String(form.get('advisor') ?? ''),
  });

  if (!email || password.length < 8) {
    return data({error: 'Correo y contraseña (mínimo 8 caracteres) son obligatorios.'}, {status: 400});
  }

  // El navegador ya lo valida, pero el action es la única puerta que cuenta:
  // hasta hoy el checkbox ni siquiera llegaba al servidor.
  if (!legalOk) {
    return data(
      {error: 'Debes aceptar el aviso de privacidad y los términos y condiciones.'},
      {status: 400},
    );
  }

  // Un valor fuera de catálogo sólo puede venir de un formulario manipulado:
  // los selects no ofrecen nada más. Vacío sí se acepta (queda NULL).
  const fueraDeCatalogo =
    (area && !esOpcionValida(area, AREAS)) ||
    (heardAbout && !esOrigenValido(heardAbout)) ||
    (location && !esOpcionValida(location, UBICACIONES));
  if (fueraDeCatalogo) {
    return data({error: 'Alguna de las opciones seleccionadas no es válida.'}, {status: 400});
  }

  const now = new Date().toISOString();

  const db = getDb(context.env);

  let user;
  try {
    user = await createUser(db, context.env, {
      email,
      password,
      firstName,
      lastName,
      company,
      razonSocial,
      phone,
      volume,
      needs,
      position,
      area,
      heardAbout,
      location,
      esCliente,
      advisorHandle,
      privacyAcceptedAt: now,
      termsAcceptedAt: now,
      newsletterOptIn,
      newsletterOptInAt: newsletterOptIn ? now : null,
      role: 'quoter',
    });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return data({error: 'Ese correo ya está registrado.'}, {status: 409});
    }
    throw err;
  }

  // Link to Shopify (best-effort; reconciled later if it fails). Ya no se
  // asigna asesor: el customer queda etiquetado como `lead-pendiente` y
  // marketing valida la asignación en el admin.
  // Un colaborador se registra para las páginas internas, no como lead: sin
  // customer en Shopify, marketing no lo ve con `lead-pendiente` por asignar.
  const shopifyGid = isCollaboratorEmail(email)
    ? null
    : await linkSignupCustomer(db, context.env, user, {newsletterOptIn});
  user.shopifyCustomerGid = shopifyGid;

  // Send the verification email (best-effort; signup succeeds even if it fails).
  await sendVerificationEmail(db, context.env, user, new URL(request.url).origin);

  // Account access requires a verified email — do NOT create a session here.
  // The user verifies via the emailed link (which logs them in), then can sign in.
  // El invitado venía armando su cotización: el destino viaja hasta el login
  // para que al entrar caiga en la página donde se quedó y no en /account.
  const volverA = safeRedirectTo(form.get('redirectTo'), '');
  const destino = volverA
    ? `/login?registrado=1&redirectTo=${encodeURIComponent(volverA)}`
    : '/login?registrado=1';
  return redirect(destino);
}
