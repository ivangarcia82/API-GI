import {useEffect, useRef, useState} from 'react';
import {Icon} from '~/components/gi/Icon';

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
  {value: 'si', icon: 'truck', title: 'Envío a domicilio', desc: 'Si eres foráneo, te la mandamos.'},
];

/**
 * @param {{fetcher: any, collaborator: {email: string, fullName: string},
 *   selection: null | {line: {name: string}, product: {name: string},
 *     variant: {id: string, color: string, image?: string|null, imageAlt?: string|null}},
 *   onChange: () => void}} props
 */
export function MochilaForm({fetcher, collaborator, selection, onChange}) {
  const [foraneo, setForaneo] = useState('');
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
        <div className="mc-shipping">
          <div className="mc-grid-2">
            <Field
              label="Calle y número"
              name="street"
              required
              autoComplete="address-line1"
              error={errors.street}
              className="mc-span-2"
            />
            <Field label="Colonia" name="neighborhood" required error={errors.neighborhood} />
            <Field
              label="Código postal"
              name="zip"
              required
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              autoComplete="postal-code"
              error={errors.zip}
            />
            <Field label="Ciudad" name="city" required autoComplete="address-level2" error={errors.city} />
            <Field label="Estado" name="state" required autoComplete="address-level1" error={errors.state} />
            <Field
              label="Quién recibe (opcional)"
              name="recipient"
              placeholder="Si no eres tú"
              className="mc-span-2"
            />
            <Field label="Referencias (opcional)" name="references" className="mc-span-2">
              <textarea
                id="mc-references"
                name="references"
                rows={2}
                placeholder="Entre calles, color de fachada…"
              />
            </Field>
          </div>
        </div>
      ) : null}

      <button type="submit" className="mc-btn mc-btn-primary mc-btn-lg mc-submit" disabled={busy || !selection}>
        {busy ? 'Enviando…' : 'Enviar mi elección'}
      </button>
    </fetcher.Form>
  );
}
