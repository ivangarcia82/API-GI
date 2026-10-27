import {useEffect, useRef, useState} from 'react';
import {Icon} from '~/components/gi/Icon';
import {DESTINOS} from '~/lib/mochilas/destinos';

function Field({label, name, error, className = '', children, ...input}) {
  const id = `mc-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className={`mc-field${error ? ' has-error' : ''} ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {children ?? (
        <input
          id={id}
          name={name}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          {...input}
        />
      )}
      {error ? (
        <p id={errorId} className="mc-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const ENTREGAS = [
  {value: 'no', icon: 'home', title: 'En la oficina', desc: 'La recoges con el equipo.'},
  {value: 'si', icon: 'truck', title: 'Envío foráneo', desc: 'Te la mandamos a tu sede.'},
];

/**
 * @param {{fetcher: any, collaborator: {email: string, fullName: string},
 *   selection: null | {line: {name: string}, product: {name: string},
 *     variant: {id: string, color: string, image?: string|null, imageAlt?: string|null}},
 *   onChange: () => void}} props
 */
export function MochilaForm({fetcher, collaborator, selection, onChange}) {
  const [foraneo, setForaneo] = useState('');
  const [destino, setDestino] = useState('');
  const formRef = useRef(null);
  const busy = fetcher.state !== 'idle';
  const result = fetcher.data;
  const errors = result?.errors ?? {};

  // Tras un 400, el foco va al primer campo con error para que se anuncie.
  useEffect(() => {
    if (!result?.errors) return;
    const first = formRef.current?.querySelector('[aria-invalid="true"], [data-invalid="true"]');
    first?.focus();
  }, [result]);

  return (
    <fetcher.Form method="post" className="mc-form" ref={formRef} noValidate>
      {result?.formError ? (
        <p className="mc-form-error" role="alert">
          {result.formError}
        </p>
      ) : null}

      <div className={`mc-choice${selection ? '' : ' is-empty'}`}>
        {selection ? (
          <>
            <input type="hidden" name="variantId" value={selection.variant.id} />
            <div className="mc-choice-thumb">
              {selection.variant.image ? (
                <img src={selection.variant.image} alt="" width="96" height="120" />
              ) : null}
            </div>
            <div className="mc-choice-text">
              <span className="mc-choice-label">Tu mochila</span>
              <strong>{`${selection.line.name} ${selection.product.name}`}</strong>
              <span>{selection.variant.color}</span>
            </div>
            <button type="button" className="mc-btn mc-btn-quiet" onClick={onChange}>
              Cambiar
            </button>
          </>
        ) : (
          <>
            <div className="mc-choice-thumb" aria-hidden="true">
              <Icon name="bag" size={28} />
            </div>
            <div className="mc-choice-text">
              <strong>Aún no eliges tu mochila</strong>
              <span>Escoge un modelo y aquí aparece.</span>
            </div>
            <button type="button" className="mc-btn mc-btn-quiet" onClick={onChange}>
              Ver modelos
            </button>
          </>
        )}
        {errors.variantId ? <p className="mc-error mc-choice-error">{errors.variantId}</p> : null}
      </div>

      <div className="mc-grid-2">
        <Field
          label="Nombre completo"
          name="fullName"
          required
          autoComplete="name"
          defaultValue={collaborator.fullName}
          error={errors.fullName}
        />
        <div className="mc-field">
          <label htmlFor="mc-email">Correo</label>
          <input id="mc-email" type="email" value={collaborator.email} readOnly />
        </div>
        <Field
          label="Área o puesto"
          name="position"
          required
          autoComplete="organization-title"
          error={errors.position}
        />
        <Field
          label="Teléfono (WhatsApp)"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="10 dígitos"
          required
          error={errors.phone}
        />
        <Field
          label="Iniciales para grabar"
          name="initials"
          required
          maxLength={3}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Ej. IGP"
          className="mc-initials"
          error={errors.initials}
        />
      </div>

      <fieldset className="mc-delivery" aria-describedby={errors.foraneo ? 'mc-foraneo-error' : undefined}>
        <legend>¿Dónde la recibes?</legend>
        <div className="mc-delivery-options">
          {ENTREGAS.map((o) => (
            <label key={o.value} className={`mc-delivery-option${foraneo === o.value ? ' is-on' : ''}`}>
              <input
                type="radio"
                name="foraneo"
                value={o.value}
                checked={foraneo === o.value}
                onChange={() => setForaneo(o.value)}
                data-invalid={errors.foraneo ? 'true' : undefined}
              />
              <Icon name={o.icon} size={22} />
              <span className="mc-delivery-title">{o.title}</span>
              <span className="mc-delivery-desc">{o.desc}</span>
            </label>
          ))}
        </div>
        {errors.foraneo ? (
          <p id="mc-foraneo-error" className="mc-error">
            {errors.foraneo}
          </p>
        ) : null}
      </fieldset>

      {foraneo === 'si' ? (
        <fieldset
          className="mc-delivery mc-destinos"
          aria-describedby={errors.destino ? 'mc-destino-error' : undefined}
        >
          <legend>¿A qué sede te la enviamos?</legend>
          <div className="mc-delivery-options">
            {DESTINOS.map((d) => (
              <label key={d.clave} className={`mc-delivery-option${destino === d.clave ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="destino"
                  value={d.clave}
                  checked={destino === d.clave}
                  onChange={() => setDestino(d.clave)}
                  data-invalid={errors.destino ? 'true' : undefined}
                />
                <Icon name="package" size={22} />
                <span className="mc-delivery-title">{d.estado}</span>
                <span className="mc-delivery-desc">{d.entrega}</span>
              </label>
            ))}
          </div>
          {errors.destino ? (
            <p id="mc-destino-error" className="mc-error">
              {errors.destino}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <button type="submit" className="mc-btn mc-btn-primary mc-btn-lg mc-submit" disabled={busy || !selection}>
        {busy ? 'Enviando…' : 'Enviar mi elección'}
      </button>
    </fetcher.Form>
  );
}
