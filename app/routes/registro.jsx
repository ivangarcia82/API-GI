import {useState} from 'react';
import {Form, useActionData, useLoaderData} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {ROUTES} from '~/lib/site-content';
import {listAdvisors} from '~/lib/admin/operations';
import {MARKETING_HANDLE, UNKNOWN_ADVISOR} from '~/lib/auth/advisor-choice';
import {AREAS, COMO_NOS_CONOCISTE, UBICACIONES} from './registro.catalogos.js';
import {validateStep} from './registro.validation.js';

export {action} from './auth.signup.jsx';

export const meta = () => [{title: 'Crear cuenta · Generando Ideas'}];

/**
 * Feeds the "¿quién es tu ejecutivo de venta?" select. Degrades to an empty
 * list rather than failing the page: no advisor list must never block signup.
 * @param {import('./+types/registro').Route.LoaderArgs} args
 */
export async function loader({context}) {
  let advisors = [];
  try {
    advisors = await listAdvisors(context.env);
  } catch (err) {
    console.error('[registro] advisor list failed (non-fatal):', err);
  }
  return {advisors};
}

export default function Registro() {
  const actionData = useActionData();
  // `?? {}` sostiene el render si el loader no corrió (p.ej. en tests de otros
  // pasos); la lista vacía tiene su propio camino más abajo.
  const {advisors = []} = useLoaderData() ?? {};
  // Blindaje del contrato del select: marketing es el respaldo, nunca una
  // opción. El loader ya lo filtra; esto lo sostiene si eso cambiara.
  const asesores = advisors.filter((a) => a.handle !== MARKETING_HANDLE);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    email: '',
    password: '',
    company: '',
    phone: '',
    razonSocial: '',
    needs: '',
    volume: '',
    esCliente: '',
    advisor: '',
    position: '',
    area: '',
    heardAbout: '',
    location: '',
    privacy: false,
    terms: false,
    newsletter: false,
  });
  const [errores, setErrores] = useState({});
  const [revisandoEmail, setRevisandoEmail] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const setField = (k, v) => setForm((f) => ({...f, [k]: v}));

  // Los tres checks del paso 3 comparten presentación; se define una vez para
  // no repetir el objeto de estilos en cada uno.
  const estiloCheck = {
    display: 'flex',
    alignItems: 'start',
    gap: 10,
    fontSize: 13,
    color: 'var(--ink-3)',
    lineHeight: 1.5,
    marginTop: 8,
    cursor: 'pointer',
  };

  // Responder la pregunta reinicia el asesor, para que un "sí -> elijo a Laura
  // -> no" no deje colgado un handle que ya no aplica. Si no hay lista que
  // ofrecer, un "sí" equivale a no conocer al asesor: así el registro no se
  // atora esperando una elección imposible.
  function setEsCliente(valor) {
    setForm((f) => ({
      ...f,
      esCliente: valor,
      advisor: valor === 'si' && asesores.length === 0 ? UNKNOWN_ADVISOR : '',
    }));
  }

  async function continuar() {
    const errs = validateStep(step, form);
    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      return;
    }
    if (step === 1) {
      setRevisandoEmail(true);
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(form.email)}`);
        // Fail-open y explícito: solo bloqueamos cuando la respuesta fue
        // exitosa Y el cuerpo dice disponible === false. Cualquier otra cosa
        // (res no ok, JSON sin la clave, shape inesperado, error de red) deja
        // avanzar; el servidor vuelve a validar al enviar, así que no
        // bloqueamos el registro por un fallo del chequeo en sí.
        if (res.ok) {
          const body = await res.json();
          if (body?.disponible === false) {
            setErrores({email: 'Ese correo ya está registrado.'});
            return;
          }
        }
      } catch {
        // Ver comentario arriba: red caída, JSON malformado, etc. -> avanzar.
      } finally {
        setRevisandoEmail(false);
      }
    }
    setErrores({});
    setStep(step + 1);
  }

  return (
    <div className="auth-wrap" data-screen-label="03 Register">
      <div className="auth-form-col">
        <div className="eyebrow">// Registro · paso {step}/3</div>
        <h1>Crea tu cuenta.</h1>
        <p>Cuéntanos sobre ti. Toma menos de 2 minutos. Cuenta lista en 24 horas hábiles.</p>

        <div style={{display: 'flex', gap: 4, marginBottom: 24}}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: s <= step ? 'var(--ink)' : 'var(--line)',
                transition: 'background 300ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          ))}
        </div>

        <Form
          className="auth-form"
          method="post"
          onSubmit={(e) => {
            // El paso 3 es el único que se envía en vez de "continuar", así que
            // su validación vive aquí. El servidor la repite: es la que manda.
            const errs = validateStep(3, form);
            if (Object.keys(errs).length > 0) {
              e.preventDefault();
              setErrores(errs);
            }
          }}
        >
          {/* Hidden mirrors so values from non-active wizard steps still post. */}
          <input type="hidden" name="firstName" value={form.name} />
          <input type="hidden" name="lastName" value={form.lastName} />
          <input type="hidden" name="email" value={form.email} />
          <input type="hidden" name="password" value={form.password} />
          <input type="hidden" name="company" value={form.company} />
          <input type="hidden" name="razonSocial" value={form.razonSocial} />
          <input type="hidden" name="phone" value={form.phone} />
          <input type="hidden" name="volume" value={form.volume} />
          <input type="hidden" name="needs" value={form.needs} />
          <input type="hidden" name="esCliente" value={form.esCliente} />
          <input type="hidden" name="advisor" value={form.advisor} />
          <input type="hidden" name="position" value={form.position} />
          <input type="hidden" name="area" value={form.area} />
          <input type="hidden" name="heardAbout" value={form.heardAbout} />
          <input type="hidden" name="location" value={form.location} />
          <input type="hidden" name="privacy" value={form.privacy ? '1' : ''} />
          <input type="hidden" name="terms" value={form.terms ? '1' : ''} />
          <input type="hidden" name="newsletter" value={form.newsletter ? '1' : ''} />

          {step === 1 && (
            <>
              <div className="row-fields">
                <div className="field">
                  <label htmlFor="reg-first">Nombre</label>
                  <input
                    id="reg-first"
                    className="input"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                    placeholder="Mariana"
                  />
                  {errores.name && (
                    <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                      {errores.name}
                    </span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="reg-last">Apellido</label>
                  <input
                    id="reg-last"
                    className="input"
                    value={form.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    required
                    placeholder="Ruiz"
                  />
                  {errores.lastName && (
                    <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                      {errores.lastName}
                    </span>
                  )}
                </div>
              </div>
              <div className="field">
                <label htmlFor="reg-email">Correo corporativo</label>
                <input
                  id="reg-email"
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  required
                  placeholder="mariana@empresa.mx"
                />
                <span className="help-msg">
                  Usa el correo de la empresa para acelerar la aprobación.
                </span>
                {errores.email && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.email}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="reg-password">Contraseña</label>
                <div style={{position: 'relative'}}>
                  <input
                    id="reg-password"
                    className="input"
                    type={verPassword ? 'text' : 'password'}
                    minLength={8}
                    required
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    style={{paddingRight: 44}}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={verPassword}
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
                    <Icon name={verPassword ? 'eye_off' : 'eye'} size={18} />
                  </button>
                </div>
                {errores.password && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.password}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="reg-phone">Teléfono</label>
                <input
                  id="reg-phone"
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="55 1234 5678"
                  required
                />
                {errores.phone && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.phone}
                  </span>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="field">
                <label htmlFor="reg-company">Empresa</label>
                <input
                  id="reg-company"
                  className="input"
                  value={form.company}
                  onChange={(e) => setField('company', e.target.value)}
                  required
                  placeholder="Acme Corp"
                />
                {errores.company && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.company}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="reg-razon-social">Razón social</label>
                <input
                  id="reg-razon-social"
                  className="input"
                  value={form.razonSocial}
                  onChange={(e) => setField('razonSocial', e.target.value)}
                  placeholder="Acme Corporativo S.A. de C.V."
                  required
                />
                <span className="help-msg">
                  Como aparece en tu constancia de situación fiscal.
                </span>
                {errores.razonSocial && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.razonSocial}
                  </span>
                )}
              </div>
              <div className="row-fields">
                <div className="field">
                  <label htmlFor="reg-position">Cargo</label>
                  <input
                    id="reg-position"
                    className="input"
                    value={form.position}
                    onChange={(e) => setField('position', e.target.value)}
                    placeholder="Gerente de compras"
                    required
                  />
                  {errores.position && (
                    <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                      {errores.position}
                    </span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="reg-area">Área</label>
                  <select
                    id="reg-area"
                    className="input"
                    value={form.area}
                    onChange={(e) => setField('area', e.target.value)}
                    required
                  >
                    <option value="">Selecciona…</option>
                    {AREAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  {errores.area && (
                    <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                      {errores.area}
                    </span>
                  )}
                </div>
              </div>
              <div className="field">
                <label htmlFor="reg-volume">Volumen mensual estimado</label>
                <select
                  id="reg-volume"
                  className="input"
                  value={form.volume}
                  onChange={(e) => setField('volume', e.target.value)}
                  required
                >
                  <option value="">Selecciona…</option>
                  <option>Menos de $50,000 MXN</option>
                  <option>$50,000 – $200,000 MXN</option>
                  <option>$200,000 – $500,000 MXN</option>
                  <option>Más de $500,000 MXN</option>
                </select>
                {errores.volume && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.volume}
                  </span>
                )}
              </div>

              <div style={{height: 1, background: 'var(--line)', margin: '4px 0'}} />

              <fieldset className="field" style={{border: 'none', padding: 0, margin: 0}}>
                <legend style={{padding: 0, marginBottom: 8}}>
                  ¿Ya eres cliente de Generando Ideas?
                </legend>
                <div style={{display: 'flex', gap: 20, flexWrap: 'wrap'}}>
                  {[
                    {id: 'reg-cliente-si', value: 'si', texto: 'Sí, ya soy cliente'},
                    {id: 'reg-cliente-no', value: 'no', texto: 'No, es mi primera vez'},
                  ].map((op) => (
                    <label
                      key={op.value}
                      htmlFor={op.id}
                      style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}
                    >
                      <input
                        id={op.id}
                        type="radio"
                        /* El valor viaja en el mirror oculto `esCliente`; este
                           name solo agrupa los radios para el teclado. */
                        name="esClienteRadio"
                        value={op.value}
                        checked={form.esCliente === op.value}
                        onChange={() => setEsCliente(op.value)}
                      />
                      <span>{op.texto}</span>
                    </label>
                  ))}
                </div>
                {errores.esCliente && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.esCliente}
                  </span>
                )}
              </fieldset>

              {form.esCliente === 'si' && asesores.length > 0 && (
                <div className="field">
                  <label htmlFor="reg-advisor">Tu ejecutivo de venta asignado</label>
                  <select
                    id="reg-advisor"
                    className="input"
                    value={form.advisor}
                    onChange={(e) => setField('advisor', e.target.value)}
                  >
                    <option value="">Selecciona…</option>
                    {asesores.map((a) => (
                      <option key={a.handle} value={a.handle}>
                        {a.puesto ? `${a.nombre} — ${a.puesto}` : a.nombre}
                      </option>
                    ))}
                    <option value={UNKNOWN_ADVISOR}>No conozco a mi asesor asignado</option>
                  </select>
                  <span className="help-msg">
                    Así dirigimos tus cotizaciones a la persona correcta desde el primer día.
                  </span>
                  {errores.advisor && (
                    <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                      {errores.advisor}
                    </span>
                  )}
                </div>
              )}

              {form.esCliente === 'si' && asesores.length === 0 && (
                <span className="help-msg">
                  No pudimos cargar la lista de ejecutivos en este momento. Te asignaremos con
                  nuestro equipo y ellos te canalizarán con tu asesor.
                </span>
              )}
            </>
          )}

          {step === 3 && (
            <>
              {/* Sin `required`: el botón del paso 3 es submit, así que la
                  validación nativa se adelantaría a validateStep y mostraría un
                  mensaje del navegador en vez del nuestro. */}
              <div className="field">
                <label htmlFor="reg-heard-about">¿Cómo nos conociste?</label>
                <select
                  id="reg-heard-about"
                  className="input"
                  value={form.heardAbout}
                  onChange={(e) => setField('heardAbout', e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {COMO_NOS_CONOCISTE.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                {errores.heardAbout && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.heardAbout}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="reg-location">¿Dónde te encuentras ubicado?</label>
                <select
                  id="reg-location"
                  className="input"
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {UBICACIONES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                {errores.location && (
                  <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                    {errores.location}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="reg-needs">¿Qué buscas? (opcional)</label>
                <textarea
                  id="reg-needs"
                  className="input"
                  rows="3"
                  value={form.needs}
                  onChange={(e) => setField('needs', e.target.value)}
                  placeholder="Ej: kit de bienvenida para 200 colaboradores, ago/2026"
                  style={{resize: 'vertical', fontFamily: 'inherit'}}
                />
              </div>

              <div style={{height: 1, background: 'var(--line)', margin: '16px 0 4px'}} />

              <label htmlFor="reg-privacy" style={estiloCheck}>
                <input
                  id="reg-privacy"
                  type="checkbox"
                  checked={form.privacy}
                  onChange={(e) => setField('privacy', e.target.checked)}
                  style={{marginTop: 3}}
                />
                <span>
                  Acepto el{' '}
                  <a
                    href={ROUTES.privacy}
                    target="_blank"
                    rel="noreferrer"
                    style={{color: 'var(--accent)', textDecoration: 'underline'}}
                  >
                    Aviso de privacidad
                  </a>
                  .
                </span>
              </label>
              {errores.privacy && (
                <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                  {errores.privacy}
                </span>
              )}

              <label htmlFor="reg-terms" style={estiloCheck}>
                <input
                  id="reg-terms"
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => setField('terms', e.target.checked)}
                  style={{marginTop: 3}}
                />
                <span>
                  Acepto los{' '}
                  <a
                    href={ROUTES.terms}
                    target="_blank"
                    rel="noreferrer"
                    style={{color: 'var(--accent)', textDecoration: 'underline'}}
                  >
                    Términos y condiciones
                  </a>
                  .
                </span>
              </label>
              {errores.terms && (
                <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                  {errores.terms}
                </span>
              )}

              <div style={{height: 1, background: 'var(--line)', margin: '12px 0 4px'}} />

              <label htmlFor="reg-newsletter" style={estiloCheck}>
                <input
                  id="reg-newsletter"
                  type="checkbox"
                  checked={form.newsletter}
                  onChange={(e) => setField('newsletter', e.target.checked)}
                  style={{marginTop: 3}}
                />
                <span>Quiero recibir novedades y promociones de Generando Ideas.</span>
              </label>
            </>
          )}

          {actionData?.error && (
            <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
              {actionData.error}
            </span>
          )}

          <div style={{display: 'flex', gap: 10, marginTop: 16}}>
            {step > 1 && (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                Atrás
              </Button>
            )}
            <Button
              type={step === 3 ? 'submit' : 'button'}
              variant="primary"
              className="grow"
              iconRight={step === 3 ? 'check' : 'arrow_right'}
              onClick={step === 3 ? undefined : continuar}
              disabled={revisandoEmail}
              style={{flex: 1, justifyContent: 'center'}}
            >
              {step === 3 ? 'Crear cuenta' : revisandoEmail ? 'Verificando…' : 'Continuar'}
            </Button>
          </div>
        </Form>

        <div style={{marginTop: 32, fontSize: 13, color: 'var(--ink-3)'}}>
          ¿Ya tienes cuenta?{' '}
          <a href="/login" style={{color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline'}}>
            Inicia sesión
          </a>
        </div>
      </div>

      <aside className="auth-side">
        <div style={{position: 'relative'}}>
          <div className="eyebrow" style={{color: 'var(--accent)'}}>
            // Únete
          </div>
          <h2>Estás a un clic de tus <em>beneficios</em>.</h2>
        </div>
        <div className="auth-perks">
          {[
            'Sin costo de apertura ni mensualidad',
            'Catálogo completo con precios visibles',
            'Línea de crédito disponible*',
          ].map((p) => (
            <div key={p} className="p">
              <Icon name="check" size={16} />
              {p}
            </div>
          ))}
        </div>
        <div style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(244,242,236,0.9)', marginTop: 24}}>
          * SUJETA A APROBACIÓN COMERCIAL
        </div>
      </aside>
    </div>
  );
}
