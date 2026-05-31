/* Generando Ideas — content page primitives (servicios, nosotros, contacto) */
import {useState} from 'react';
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
  const [sent, setSent] = useState(false);
  return (
    <div className="container" data-screen-label="10 Contact" style={{padding: '40px 0 80px'}}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56}} className="contact-grid">
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
              toast('Mensaje enviado · te contactaremos pronto', {icon: 'check', accent: true});
            }}
            style={{display: 'flex', flexDirection: 'column', gap: 14}}
          >
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
              <div className="field">
                <label>Nombre</label>
                <input className="input" required />
              </div>
              <div className="field">
                <label>Empresa</label>
                <input className="input" required />
              </div>
            </div>
            <div className="field">
              <label>Correo</label>
              <input className="input" type="email" required />
            </div>
            <div className="field">
              <label>¿En qué te ayudamos?</label>
              <textarea
                className="input"
                rows="5"
                style={{resize: 'vertical', fontFamily: 'inherit'}}
                placeholder="Cuéntanos sobre tu proyecto…"
                required
              />
            </div>
            <Button type="submit" variant="primary" size="lg" iconRight="arrow_right" style={{justifyContent: 'center'}}>
              {sent ? 'Mensaje enviado ✓' : 'Enviar mensaje'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
