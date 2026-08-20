/* Guardas sobre el CSS del cajón de filtros en móvil.
 *
 * Son afirmaciones sobre la hoja de estilos y no sobre el DOM porque jsdom no
 * calcula layout: el fallo que cubren no se puede reproducir sin un motor de
 * render. Lo que se protege es un caso que rompió el cajón por completo y que
 * no da ningún síntoma visible en las pruebas de componente. */
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./gi-screens.css', import.meta.url)), 'utf8');

/** El cuerpo de una regla dentro del bloque `@media (max-width: 880px)`. */
function reglaMovil(selector) {
  const media = css.slice(css.indexOf('@media (max-width: 880px)'));
  const i = media.indexOf(`\n  ${selector} {`);
  if (i === -1) return null;
  return media.slice(i, media.indexOf('\n  }', i));
}

describe('cajón de filtros en móvil', () => {
  it('se estira de arriba a abajo en vez de tomar el alto de su contenido', () => {
    /* La regla base trae `align-self: start` para la columna sticky de
       escritorio. Heredado por la caja fija del móvil, impide que se estire
       entre top:0 y bottom:0: el panel medía lo que su contenido (~1.700px
       sobre un viewport de 713px), no había scroll interno y el pie con "Ver
       N productos" quedaba fuera de la pantalla, así que no se podían aplicar
       los filtros. */
    const regla = reglaMovil('.cf-panel');
    expect(regla).not.toBeNull();
    expect(regla).toMatch(/align-self:\s*stretch/);
    expect(regla).toContain('position: fixed');
  });

  it('deja que el panel scrollee por dentro', () => {
    // El scroll del fondo está bloqueado mientras el cajón está abierto
    // (~/lib/dialog), así que sin overflow propio el contenido es inalcanzable.
    const base = css.slice(css.indexOf('.cf-panel {'), css.indexOf('.cf-mobile-head,'));
    expect(base).toMatch(/overflow-y:\s*auto/);
  });
});

describe('widget de chat', () => {
  it('se retira mientras haya un modal abierto', () => {
    // Brevo se pinta con z-index 9999, por encima de cualquier cajón: sobre un
    // modal tapaba justo el botón de acción del pie.
    const regla = css.slice(css.indexOf('body:has(.cf-panel.open) #brevo-conversations'));
    const cuerpo = regla.slice(0, regla.indexOf('}'));
    expect(cuerpo).toContain('.qd-overlay.open');
    expect(cuerpo).toContain('.gis-overlay.open');
    expect(cuerpo).toContain('.sort-sheet');
    expect(cuerpo).toMatch(/display:\s*none/);
  });

  it('sube por encima de las barras fijas del catálogo', () => {
    const regla = reglaMovil('body:has(.cat-mobile-bar) #brevo-conversations,\n  body:has(.bulk-bar) #brevo-conversations');
    expect(regla ?? css).toMatch(/body:has\(\.bulk-bar\) #brevo-conversations[\s\S]{0,120}bottom:\s*calc\(80px/);
  });
});
