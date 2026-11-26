/* Una llave de más o de menos en una hoja de estilos no la nota el servidor
   de desarrollo ni ninguna prueba de componentes, pero tumba la compilación
   de producción (el minificador sí la rechaza). Pasó con gi-marketing.css:
   esta prueba lo atrapa antes del deploy. */
import {describe, it, expect} from 'vitest';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const DIR = 'app/styles';
const hojas = readdirSync(DIR).filter((f) => f.endsWith('.css'));

function desbalance(css) {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, (c) => '\n'.repeat(c.split('\n').length - 1));
  let profundidad = 0;
  let linea = 1;
  for (const ch of sinComentarios) {
    if (ch === '\n') linea += 1;
    else if (ch === '{') profundidad += 1;
    else if (ch === '}') {
      profundidad -= 1;
      if (profundidad < 0) return `cierre de más en la línea ${linea}`;
    }
  }
  return profundidad === 0 ? null : `${profundidad} llave(s) sin cerrar`;
}

describe('hojas de estilos', () => {
  it.each(hojas)('%s tiene sus llaves balanceadas', (hoja) => {
    expect(desbalance(readFileSync(join(DIR, hoja), 'utf8'))).toBeNull();
  });

  it('la revisión sí detecta una llave de más', () => {
    expect(desbalance('a { b: c; }\n}\n')).toBe('cierre de más en la línea 2');
    expect(desbalance('a { b: c;')).toBe('1 llave(s) sin cerrar');
  });
});
