import {describe, it, expect} from 'vitest';
import {MANAGERS, managerFor} from './managers.js';

const TABLA = {
  'laura@generandoideas.com': 'antonio@generandoideas.com',
  'pedro@generandoideas.com': 'jesus@generandoideas.com',
};

describe('managerFor', () => {
  it('devuelve el manager de un ejecutivo conocido', () => {
    expect(managerFor('laura@generandoideas.com', TABLA)).toBe('antonio@generandoideas.com');
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    expect(managerFor('  LAURA@Generandoideas.com  ', TABLA)).toBe(
      'antonio@generandoideas.com',
    );
  });

  it('devuelve null para un ejecutivo que no está en la matriz', () => {
    expect(managerFor('ajena@generandoideas.com', TABLA)).toBeNull();
  });

  it('devuelve null para entradas vacías', () => {
    expect(managerFor('', TABLA)).toBeNull();
    expect(managerFor('   ', TABLA)).toBeNull();
    expect(managerFor(null, TABLA)).toBeNull();
    expect(managerFor(undefined, TABLA)).toBeNull();
  });

  it('no hereda claves del prototipo de Object', () => {
    // Un correo llamado "constructor" no debe resolver a una función.
    expect(managerFor('constructor', TABLA)).toBeNull();
  });

  it('funciona contra la matriz real sin explotar cuando está vacía', () => {
    expect(managerFor('quien-sea@generandoideas.com')).toBeNull();
  });
});

describe('MANAGERS', () => {
  it('tiene todas sus llaves normalizadas', () => {
    // Si alguien pega la matriz con mayúsculas o espacios, el CC fallaría en
    // silencio. Esta prueba lo convierte en un fallo ruidoso.
    for (const clave of Object.keys(MANAGERS)) {
      expect(clave).toBe(clave.trim().toLowerCase());
    }
  });

  it('no apunta a nadie con un correo vacío', () => {
    for (const valor of Object.values(MANAGERS)) {
      expect(String(valor).trim()).not.toBe('');
    }
  });

  it('todas las direcciones, de ambos lados, son de generandoideas.com', () => {
    // Atrapa un typo al pegar la matriz: un dominio raro haría que el CC se
    // fuera a una dirección inexistente y Resend lo rechazara en producción.
    for (const [ejecutivo, lider] of Object.entries(MANAGERS)) {
      expect(ejecutivo).toMatch(/^[^\s@]+@generandoideas\.com$/);
      expect(lider).toMatch(/^[^\s@]+@generandoideas\.com$/);
    }
  });

  it('resuelve el correo que llegó con mayúscula inicial', () => {
    // La matriz se capturó con "Mquintanilla@"; se guardó en minúsculas porque
    // managerFor normaliza. Si alguien "arregla" la llave a mayúsculas, esto
    // truena.
    expect(managerFor('Mquintanilla@generandoideas.com')).toBe('jrios@generandoideas.com');
    expect(managerFor('mquintanilla@generandoideas.com')).toBe('jrios@generandoideas.com');
  });

  it('ningún líder es a su vez ejecutivo de otro', () => {
    // Hoy los cinco líderes están fuera de la matriz como llaves. Si eso
    // cambiara habría que decidir si el CC sube en cadena, y esta prueba obliga
    // a tomar esa decisión a conciencia en vez de descubrirla en un correo.
    const lideres = new Set(Object.values(MANAGERS));
    for (const ejecutivo of Object.keys(MANAGERS)) {
      expect(lideres.has(ejecutivo)).toBe(false);
    }
  });
});
