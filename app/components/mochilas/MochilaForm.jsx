import {useState} from 'react';
import {useFetcher} from 'react-router';

function Field({label, name, error, children, ...input}) {
  const id = `mc-${name}`;
  return (
    <div className={`mc-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children ?? <input id={id} name={name} aria-invalid={error ? 'true' : undefined} {...input} />}
      {error ? <p className="mc-error">{error}</p> : null}
    </div>
  );
}

/**
 * @param {{lines: any[], collaborator: {email: string, fullName: string},
 *   selectedVariantId: string, onSelectVariant: (id: string) => void}} props
 */
export function MochilaForm({lines, collaborator, selectedVariantId, onSelectVariant}) {
  const fetcher = useFetcher();
  const [foraneo, setForaneo] = useState('');
  const busy = fetcher.state !== 'idle';
  const result = fetcher.data;
  const errors = result?.errors ?? {};

  if (result?.ok) {
    const {line, model, color, foraneo: esForaneo} = result.summary;
    return (
      <div className="mc-done" role="status">
        <span className="eyebrow">Listo</span>
        <h3>¡Tu elección fue enviada!</h3>
        <p>
          Elegiste la <strong>{line} {model}</strong> en <strong>{color}</strong>.{' '}
          {esForaneo
            ? 'Te la enviaremos a la dirección que registraste.'
            : 'Te avisaremos cuando puedas recogerla en la oficina.'}
        </p>
        <p className="mc-muted">Te mandamos una copia a {collaborator.email}.</p>
      </div>
    );
  }

  return (
    <fetcher.Form method="post" className="mc-form">
      {result?.formError ? (
        <p className="mc-form-error" role="alert">
          {result.formError}
        </p>
      ) : null}

      <Field label="Mochila" name="variantId" error={errors.variantId}>
        <select
          id="mc-variantId"
          name="variantId"
          required
          value={selectedVariantId}
          onChange={(e) => onSelectVariant(e.target.value)}
        >
          <option value="">Elige tu mochila…</option>
          {lines.map((line) => (
            <optgroup key={line.id} label={line.name}>
              {line.products.flatMap((p) =>
                p.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {p.name} · {v.color}
                  </option>
                )),
              )}
            </optgroup>
          ))}
        </select>
      </Field>

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
          <span className="mc-label">Correo</span>
          <p className="mc-static">{collaborator.email}</p>
        </div>
        <Field label="Área o puesto" name="position" required error={errors.position} />
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

      <fieldset className="mc-field mc-choice">
        <legend>¿Eres foráneo?</legend>
        <label>
          <input
            type="radio"
            name="foraneo"
            value="no"
            required
            checked={foraneo === 'no'}
            onChange={() => setForaneo('no')}
          />
          No, recojo en oficina
        </label>
        <label>
          <input
            type="radio"
            name="foraneo"
            value="si"
            checked={foraneo === 'si'}
            onChange={() => setForaneo('si')}
          />
          Sí, necesito envío
        </label>
        {errors.foraneo ? <p className="mc-error">{errors.foraneo}</p> : null}
      </fieldset>

      {foraneo === 'si' ? (
        <div className="mc-shipping">
          <h4>Datos de envío</h4>
          <div className="mc-grid-2">
            <Field
              label="Calle y número"
              name="street"
              required
              autoComplete="address-line1"
              error={errors.street}
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
            <Field
              label="Ciudad"
              name="city"
              required
              autoComplete="address-level2"
              error={errors.city}
            />
            <Field
              label="Estado"
              name="state"
              required
              autoComplete="address-level1"
              error={errors.state}
            />
            <Field label="Quién recibe (opcional)" name="recipient" placeholder="Si no eres tú" />
          </div>
          <Field label="Referencias (opcional)" name="references">
            <textarea
              id="mc-references"
              name="references"
              rows={2}
              placeholder="Entre calles, color de fachada…"
            />
          </Field>
        </div>
      ) : null}

      <button type="submit" className="mc-submit" disabled={busy}>
        {busy ? 'Enviando…' : 'Enviar mi elección'}
      </button>
    </fetcher.Form>
  );
}
