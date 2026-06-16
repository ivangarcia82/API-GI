/* Generando Ideas — floating tweaks panel (accent color + density).
   A lightweight UI-preference panel; persists to localStorage via AppContext. */
import {useState} from 'react';
import {Icon} from './Icon';
import {useApp} from '~/lib/AppContext';

const ACCENTS = ['#ff8300', '#d97757', '#1f8a5b', '#2a6fdb', '#7a4ee0'];

/** Floating tweaks panel (accent color, density, role, banner). */
export function TweaksPanel() {
  const {tweaks, setTweak} = useApp();
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
