import {describe, it, expect} from 'vitest';
import {advisorCanSee} from './advisorAccess.js';

describe('advisorCanSee', () => {
  it('deja ver la cotización asignada a ese ejecutivo', () => {
    expect(advisorCanSee({advisorEmail: 'lvega@gi.com'}, 'lvega@gi.com')).toBe(true);
  });

  it('ignora mayúsculas y espacios de ambos lados', () => {
    expect(advisorCanSee({advisorEmail: ' LVega@GI.com '}, 'lvega@gi.com')).toBe(true);
    expect(advisorCanSee({advisorEmail: 'lvega@gi.com'}, ' LVEGA@gi.com ')).toBe(true);
  });

  it('niega la de otro ejecutivo', () => {
    expect(advisorCanSee({advisorEmail: 'otro@gi.com'}, 'lvega@gi.com')).toBe(false);
  });

  it('niega una cotización sin ejecutivo asignado', () => {
    // Si no, cualquier asesor abriría todas las que cayeron en ventas@.
    expect(advisorCanSee({advisorEmail: null}, 'lvega@gi.com')).toBe(false);
    expect(advisorCanSee({advisorEmail: '  '}, 'lvega@gi.com')).toBe(false);
    expect(advisorCanSee({}, 'lvega@gi.com')).toBe(false);
  });

  it('niega cuando falta el ejecutivo o la cotización', () => {
    expect(advisorCanSee({advisorEmail: 'lvega@gi.com'}, '')).toBe(false);
    expect(advisorCanSee({advisorEmail: 'lvega@gi.com'}, null)).toBe(false);
    expect(advisorCanSee(null, 'lvega@gi.com')).toBe(false);
  });
});
