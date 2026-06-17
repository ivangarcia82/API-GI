/* Generando Ideas — content page primitives (contacto) */
import {useEffect} from 'react';
import {Form, useActionData, useNavigation} from 'react-router';
import {Icon} from './Icon';
import {Button} from './ui';
import {useToast} from '~/lib/AppContext';

export function StubScreen({title, label, desc, items}) {
  return (
    <div className="container" data-screen-label={title} style={{padding: '40px 0 80px'}}>
      <div className="eyebrow">{label}</div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 'clamp(48px, 7vw, 96px)',
          letterSpacing: '-0.035em',
          lineHeight: 0.95,
          margin: '12px 0 16px',
          maxWidth: 900,
        }}
      >
        {title}
      </h1>
      <p style={{color: 'var(--ink-3)', fontSize: 17, maxWidth: 600}}>{desc}</p>
      <div
        style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 56}}
        className="stagger"
      >
        {items.map((it, i) => (
          <div
            key={it.t}
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: 32,
            }}
            className="lift"
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-4)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {String(i + 1).padStart(2, '0')} · {it.t.split(' ')[0]}
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: '-0.015em',
                margin: '12px 0 8px',
              }}
            >
              {it.t}
            </h3>
            <p style={{color: 'var(--ink-3)', margin: 0, fontSize: 15, lineHeight: 1.55}}>{it.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactScreen() {
  const toast = useToast();
  const actionData = useActionData();
  const {state} = useNavigation();
  const submitting = state !== 'idle';
  const sent = Boolean(actionData && actionData.ok);

  useEffect(() => {
    if (!actionData) return;
    if (actionData.ok) {
      toast('Mensaje enviado · te contactaremos pronto', {icon: 'check', accent: true});
    } else if (actionData.error) {
      toast(actionData.error, {icon: 'alert'});
    }
  }, [actionData, toast]);

  return (
    <div className="container" data-screen-label="10 Contact" style={{padding: '40px 0 80px'}}>
      <div className="contact-grid">
        <div>
          <div className="eyebrow">// Contacto · /contacto</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(48px, 7vw, 96px)',
              letterSpacing: '-0.035em',
              lineHeight: 0.9,
              margin: '12px 0 16px',
            }}
          >
            Hablemos.
          </h1>
          <p style={{color: 'var(--ink-3)', fontSize: 17}}>
            Cuéntanos sobre tu proyecto. Un asesor responde en menos de 2 horas hábiles.
          </p>

          <div style={{marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16}}>
            {[
              {i: 'chat', l: 'WhatsApp', v: '+52 (55) 7098 8100'},
              {i: 'receipt', l: 'Correo', v: 'marketing@generandoideas.com'},
              {i: 'truck', l: 'Oficinas', v: 'CDMX · Yucatán · Sonora · Baja California Sur'},
            ].map((c) => (
              <div key={c.l} style={{display: 'flex', gap: 14, alignItems: 'center'}}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--bg-soft)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name={c.i} size={18} />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--ink-4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {c.l}
                  </div>
                  <div style={{fontWeight: 600, marginTop: 2}}>{c.v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: 32,
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 22,
              margin: '0 0 24px',
              letterSpacing: '-0.015em',
            }}
          >
            Envíanos un mensaje
          </h3>
          {sent ? (
            <div className="empty" style={{padding: '40px 24px'}}>
              <div className="qd-success-check" style={{margin: '0 auto 12px'}}>
                <Icon name="check" size={24} strokeWidth={2.5} />
              </div>
              <h3>¡Mensaje enviado!</h3>
              <p>Gracias por escribirnos. Un asesor te contactará pronto.</p>
            </div>
          ) : (
            <Form method="post" style={{display: 'flex', flexDirection: 'column', gap: 14}}>
              {/* Honeypot: invisible to humans; bots fill it and get silently dropped. */}
              <input
                type="text"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0}}
              />
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                <div className="field">
                  <label htmlFor="c-name">Nombre</label>
                  <input id="c-name" name="name" className="input" required />
                </div>
                <div className="field">
                  <label htmlFor="c-company">Empresa</label>
                  <input id="c-company" name="company" className="input" />
                </div>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                <div className="field">
                  <label htmlFor="c-email">Correo</label>
                  <input id="c-email" name="email" className="input" type="email" required />
                </div>
                <div className="field">
                  <label htmlFor="c-phone">Teléfono (opcional)</label>
                  <input id="c-phone" name="phone" className="input" type="tel" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="c-message">¿En qué te ayudamos?</label>
                <textarea
                  id="c-message"
                  name="message"
                  className="input"
                  rows="5"
                  style={{resize: 'vertical', fontFamily: 'inherit'}}
                  placeholder="Cuéntanos sobre tu proyecto…"
                  required
                />
              </div>
              {actionData?.error && (
                <p className="error-msg" role="alert">
                  {actionData.error}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                iconRight="arrow_right"
                disabled={submitting}
                style={{justifyContent: 'center'}}
              >
                {submitting ? 'Enviando…' : 'Enviar mensaje'}
              </Button>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
