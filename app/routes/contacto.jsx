// Port de contacto.astro (gi-website-final/src/pages/contacto.astro).
// The vanilla-JS form (FormData + manual DOM error toggling) becomes a
// controlled React form: `values`/`errors`/`status` state, inline validation
// mirroring `validateContact` from ~/lib/contact (same rules/regex/min length,
// just friendlier per-field copy for fidelity with the source), and a
// fetch('/api/contact') submit that matches app/routes/api.contact.jsx's
// contract (`{ok:true}` on success, `{ok:false, fields}` + 422 on server-side
// validation failure). `.reveal` fade-ins are handled globally by
// MarketingLayout's useMarketingReveal(); the field-stagger GSAP is omitted
// (decorative, optional per task brief). Map/office sync uses the same
// `active`/`setActive` state passed to both <MexicoMap> and the office card.
import {useRef, useState} from 'react';
import {MexicoMap} from '~/components/marketing/MexicoMap';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {OFFICES, BUSINESS_HOURS, ROUTES} from '~/lib/site-content';
import {validateContact} from '~/lib/contact';

const FIELDS = ['name', 'company', 'role', 'email', 'phone', 'service', 'source', 'message'];

const INITIAL_VALUES = {
  name: '',
  company: '',
  role: '',
  email: '',
  phone: '',
  service: '',
  source: '',
  message: '',
};

// Friendlier per-field copy from the source's inline <script>. `validateContact`
// (server-side source of truth) returns short codes ('requerido' | 'inválido' |
// 'muy corto'); this maps field+code -> the exact string the Astro page showed.
const FIELD_MESSAGES = {
  name: {requerido: 'Nombre requerido'},
  company: {requerido: 'Empresa requerida'},
  role: {requerido: 'Cargo o área requerido'},
  email: {requerido: 'Correo requerido', inválido: 'Correo inválido'},
  phone: {requerido: 'Celular requerido'},
  service: {requerido: 'Selecciona un servicio'},
  source: {requerido: 'Selecciona una opción'},
  message: {'muy corto': 'Cuéntanos un poco más (min 10 caracteres)'},
};

function toFriendlyErrors(codes) {
  const errors = {};
  for (const field of Object.keys(codes)) {
    errors[field] = FIELD_MESSAGES[field]?.[codes[field]] ?? 'Revisa este campo';
  }
  return errors;
}

// E.164-ish formatted numbers for structured data (source's `phoneMap`);
// `OFFICES[].phone` is the human-readable display format shown on the card.
const PHONE_MAP = {
  cdmx: '+52-55-7098-8100',
  sonora: '+52-662-789-0012',
  yucatan: '+52-999-456-7890',
};

const localBusinessGraph = {
  '@context': 'https://schema.org',
  '@graph': OFFICES.map((o) => ({
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': `https://generandoideas.com/contacto#office-${o.id}`,
    name: `Generando Ideas — ${o.name}`,
    url: 'https://generandoideas.com/contacto',
    telephone: PHONE_MAP[o.id] ?? o.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: o.address,
      addressLocality: o.state,
      addressRegion: o.state,
      addressCountry: 'MX',
    },
    areaServed: {'@type': 'Country', name: 'México'},
    parentOrganization: {'@id': 'https://generandoideas.com/#organization'},
  })),
};

export const meta = () => [
  {title: 'Contacto | Productos Promocionales y Regalos Corporativos | Generando Ideas'},
  {
    name: 'description',
    content:
      'Cuéntanos tu idea. Te ayudamos a encontrar la mejor solución para tu marca y respondemos en menos de 48 horas hábiles.',
  },
  {'script:ld+json': localBusinessGraph},
];

export default function Contacto() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [active, setActive] = useState('cdmx');
  const fieldRefs = useRef({});

  const office = OFFICES.find((o) => o.id === 'cdmx');

  function handleChange(field) {
    return (e) => setValues((v) => ({...v, [field]: e.target.value}));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const codes = validateContact(values);
    const nextErrors = toFriendlyErrors(codes);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstField = FIELDS.find((f) => nextErrors[f]);
      fieldRefs.current[firstField]?.focus();
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.ok) {
        setStatus('success');
        return;
      }

      if (res.status === 422 && json.fields) {
        const serverErrors = {};
        Object.keys(json.fields).forEach((f) => {
          serverErrors[f] = 'Revisa este campo';
        });
        setErrors(serverErrors);
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  const sending = status === 'sending';

  return (
    <MarketingLayout>
      <div className="page contacto">
        <section className="section" style={{paddingBottom: 40}}>
          <div className="wrap">
            <span className="eyebrow reveal">Contacto</span>
            <h1 className="contact-h1 display reveal">
              Cuéntanos tu <span className="text-grad-word">idea.</span>
            </h1>
            <p className="contact-lead reveal">
              Te ayudaremos a encontrar la mejor solución para tu marca. Respondemos en menos de 48 horas
              hábiles con una propuesta inicial, tiempos de entrega y presupuesto estimado.
            </p>
          </div>
        </section>

        <section className="section" style={{paddingTop: 0}}>
          <div className="wrap contact-grid reveal">
            <div className="contact-col">
              <h2 className="contact-h2 display">Cuéntanos tu idea</h2>

              {status === 'success' ? (
                <div className="form-success shadow-diffuse" role="status" aria-live="polite">
                  <span className="success-check" aria-hidden="true">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <h3 className="display success-title">¡Gracias, {values.name.split(' ')[0]}!</h3>
                  <p className="success-copy">
                    Hemos recibido tu mensaje y uno de nuestros especialistas se pondrá en contacto contigo
                    lo antes posible para dar seguimiento a tu solicitud.
                  </p>
                </div>
              ) : (
                <form className="form-grid" noValidate onSubmit={onSubmit}>
                  <div className={`field${errors.name ? ' error' : ''}`} data-field="name">
                    <label htmlFor="cf-name">Nombre completo *</label>
                    <input
                      id="cf-name"
                      name="name"
                      placeholder="Nombre y Apellido"
                      autoComplete="name"
                      value={values.name}
                      onChange={handleChange('name')}
                      ref={(el) => (fieldRefs.current.name = el)}
                      aria-invalid={errors.name ? 'true' : undefined}
                      aria-describedby={errors.name ? 'cf-name-err' : undefined}
                    />
                    <span className="err-msg" id="cf-name-err" hidden={!errors.name}>
                      {errors.name}
                    </span>
                  </div>
                  <div className={`field${errors.company ? ' error' : ''}`} data-field="company">
                    <label htmlFor="cf-company">Empresa *</label>
                    <input
                      id="cf-company"
                      name="company"
                      placeholder="Nombre comercial"
                      autoComplete="organization"
                      value={values.company}
                      onChange={handleChange('company')}
                      ref={(el) => (fieldRefs.current.company = el)}
                      aria-invalid={errors.company ? 'true' : undefined}
                      aria-describedby={errors.company ? 'cf-company-err' : undefined}
                    />
                    <span className="err-msg" id="cf-company-err" hidden={!errors.company}>
                      {errors.company}
                    </span>
                  </div>
                  <div className={`field${errors.role ? ' error' : ''}`} data-field="role">
                    <label htmlFor="cf-role">Cargo / Área *</label>
                    <input
                      id="cf-role"
                      name="role"
                      placeholder="Puesto o área"
                      autoComplete="organization-title"
                      value={values.role}
                      onChange={handleChange('role')}
                      ref={(el) => (fieldRefs.current.role = el)}
                      aria-invalid={errors.role ? 'true' : undefined}
                      aria-describedby={errors.role ? 'cf-role-err' : undefined}
                    />
                    <span className="err-msg" id="cf-role-err" hidden={!errors.role}>
                      {errors.role}
                    </span>
                  </div>
                  <div className={`field${errors.email ? ' error' : ''}`} data-field="email">
                    <label htmlFor="cf-email">Correo *</label>
                    <input
                      id="cf-email"
                      type="email"
                      name="email"
                      placeholder="nombre@dominio.com"
                      autoComplete="email"
                      value={values.email}
                      onChange={handleChange('email')}
                      ref={(el) => (fieldRefs.current.email = el)}
                      aria-invalid={errors.email ? 'true' : undefined}
                      aria-describedby={errors.email ? 'cf-email-err' : undefined}
                    />
                    <span className="err-msg" id="cf-email-err" hidden={!errors.email}>
                      {errors.email}
                    </span>
                  </div>
                  <div className={`field${errors.phone ? ' error' : ''}`} data-field="phone">
                    <label htmlFor="cf-phone">Celular *</label>
                    <input
                      id="cf-phone"
                      name="phone"
                      type="tel"
                      placeholder="+52 55 1234 5678"
                      autoComplete="tel"
                      value={values.phone}
                      onChange={handleChange('phone')}
                      ref={(el) => (fieldRefs.current.phone = el)}
                      aria-invalid={errors.phone ? 'true' : undefined}
                      aria-describedby={errors.phone ? 'cf-phone-err' : undefined}
                    />
                    <span className="err-msg" id="cf-phone-err" hidden={!errors.phone}>
                      {errors.phone}
                    </span>
                  </div>
                  <div className={`field${errors.service ? ' error' : ''}`} data-field="service">
                    <label htmlFor="cf-service">Servicio *</label>
                    <select
                      id="cf-service"
                      name="service"
                      value={values.service}
                      onChange={handleChange('service')}
                      ref={(el) => (fieldRefs.current.service = el)}
                      aria-invalid={errors.service ? 'true' : undefined}
                      aria-describedby={errors.service ? 'cf-service-err' : undefined}
                    >
                      <option value="">Selecciona...</option>
                      <option>Promocionales</option>
                      <option>Promotional Workshop</option>
                      <option>Print Shop</option>
                      <option>Digital Evolution</option>
                      <option>Importaciones</option>
                      <option>Otro</option>
                    </select>
                    <span className="err-msg" id="cf-service-err" hidden={!errors.service}>
                      {errors.service}
                    </span>
                  </div>
                  <div className={`field${errors.source ? ' error' : ''}`} data-field="source">
                    <label htmlFor="cf-source">¿Cómo llegó con nosotros? *</label>
                    <select
                      id="cf-source"
                      name="source"
                      value={values.source}
                      onChange={handleChange('source')}
                      ref={(el) => (fieldRefs.current.source = el)}
                      aria-invalid={errors.source ? 'true' : undefined}
                      aria-describedby={errors.source ? 'cf-source-err' : undefined}
                    >
                      <option value="">Selecciona...</option>
                      <option>Recomendación</option>
                      <option>Internet</option>
                      <option>Redes Sociales</option>
                      <option>Otro</option>
                    </select>
                    <span className="err-msg" id="cf-source-err" hidden={!errors.source}>
                      {errors.source}
                    </span>
                  </div>
                  <div className={`field full${errors.message ? ' error' : ''}`} data-field="message">
                    <label htmlFor="cf-message">Mensaje *</label>
                    <textarea
                      id="cf-message"
                      name="message"
                      placeholder="Volumen estimado, fechas clave, objetivo de la campaña..."
                      value={values.message}
                      onChange={handleChange('message')}
                      ref={(el) => (fieldRefs.current.message = el)}
                      aria-invalid={errors.message ? 'true' : undefined}
                      aria-describedby={errors.message ? 'cf-message-err' : undefined}
                    />
                    <span className="err-msg" id="cf-message-err" hidden={!errors.message}>
                      {errors.message}
                    </span>
                  </div>
                  <div className="field full">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      style={{alignSelf: 'start'}}
                      disabled={sending}
                    >
                      {sending ? 'Enviando...' : 'Enviar solicitud'}
                      {!sending && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      )}
                    </button>
                    {status === 'error' && (
                      <p className="form-error" role="alert">
                        No pudimos enviar tu solicitud. Inténtalo de nuevo o escríbenos a{' '}
                        <a href="mailto:marketing@generandoideas.com">marketing@generandoideas.com</a>.
                      </p>
                    )}
                    <p className="form-privacy">
                      Tus datos están seguros con nosotros y únicamente serán utilizados para atender tu
                      solicitud. No compartimos tu información con terceros. Consulta nuestro{' '}
                      <a href={ROUTES.privacy} target="_blank" rel="noopener noreferrer">
                        aviso de privacidad
                      </a>
                      .
                    </p>
                  </div>
                </form>
              )}
            </div>

            <div className="contact-col">
              <h2 className="contact-h2 display">Nuestras sucursales</h2>
              <p className="contact-hours">{BUSINESS_HOURS}</p>
              <div className="offices-wrap" style={{gridTemplateColumns: '1fr', gap: 24}}>
                <MexicoMap activeId={active} onSelect={setActive} />
                <div className="offices-list">
                  {office && (
                    <div
                      className={`office${active === office.id ? ' active' : ''}`}
                      data-office={office.id}
                      onClick={() => setActive(office.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActive(office.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <h3 className="office-name">{office.name}</h3>
                      <p>{office.state}</p>
                      <p>{office.address}</p>
                      <p className="office-phone">{office.phone}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
