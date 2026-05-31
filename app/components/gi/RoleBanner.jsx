/* Generando Ideas — role banner + tweaks panel
   The banner lets you switch the simulated B2B role (buyer/quoter)
   live; the tweaks panel mirrors the prototype's accent/density toggles. */
import {useState} from 'react';
import {Icon} from './Icon';
import {useApp} from '~/lib/AppContext';

export function RoleBanner() {
  const {role, setRole, isLoggedIn} = useApp();
  if (!isLoggedIn) return null;
  return (
    <div className="role-banner">
      <div className="container">
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{opacity: 0.7}}>Modo simulación · sesión iniciada como</span>
          <span className="role-tag">
            {role === 'buyer' ? 'CLIENTE COMPRADOR' : 'CLIENTE COTIZADOR'}
          </span>
        </div>
        <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
          <span style={{opacity: 0.5}}>Cambiar rol:</span>
          {[
            ['buyer', 'COMPRADOR'],
            ['quoter', 'COTIZADOR'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setRole(value)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: role === value ? 'var(--accent)' : 'transparent',
                color: role === value ? 'var(--accent-ink)' : 'rgba(244,242,236,0.7)',
                border: `1px solid ${
                  role === value ? 'var(--accent)' : 'rgba(244,242,236,0.2)'
                }`,
                fontWeight: 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const ACCENTS = ['#f5b800', '#d97757', '#1f8a5b', '#2a6fdb', '#7a4ee0'];

/** Floating tweaks panel (accent color, density, role, banner). */
export function TweaksPanel() {
  const {tweaks, setTweak, role, setRole, isLoggedIn} = useApp();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Tweaks"
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          zIndex: 9998,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--ink)',
          color: 'var(--accent)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <Icon name="settings" size={20} />
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 24,
            zIndex: 9998,
            width: 260,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-3)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-4)',
            }}
          >
            // Tweaks
          </div>

          {isLoggedIn && (
            <TweakGroup label="Rol simulado">
              <Segmented
                value={role}
                onChange={setRole}
                options={[
                  {value: 'buyer', label: 'Comprador'},
                  {value: 'quoter', label: 'Cotizador'},
                ]}
              />
            </TweakGroup>
          )}

          <TweakGroup label="Color de acento">
            <div style={{display: 'flex', gap: 8}}>
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTweak('accent', c)}
                  aria-label={c}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: c,
                    border: '2px solid var(--bg-elev)',
                    boxShadow:
                      tweaks.accent === c
                        ? '0 0 0 2px var(--ink)'
                        : '0 0 0 1px var(--line)',
                  }}
                />
              ))}
            </div>
          </TweakGroup>

          <TweakGroup label="Densidad">
            <Segmented
              value={tweaks.density}
              onChange={(v) => setTweak('density', v)}
              options={[
                {value: 'comfortable', label: 'Cómodo'},
                {value: 'compact', label: 'Compacto'},
              ]}
            />
          </TweakGroup>

          <TweakGroup label="Banner de simulación">
            <Segmented
              value={tweaks.showRoleBanner ? 'on' : 'off'}
              onChange={(v) => setTweak('showRoleBanner', v === 'on')}
              options={[
                {value: 'on', label: 'Visible'},
                {value: 'off', label: 'Oculto'},
              ]}
            />
          </TweakGroup>
        </div>
      )}
    </>
  );
}

function TweakGroup({label, children}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
      <label
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--ink-4)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Segmented({value, onChange, options}) {
  return (
    <div className="customizer-segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
