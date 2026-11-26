/* Decisión del negocio (26-nov-2026): sólo se publica la dirección de la
   sucursal de CDMX. Los datos estructurados de Contacto declaraban además la
   dirección y el teléfono de Sonora y Yucatán, que no se ven en la página
   pero sí los leen buscadores y asistentes de IA. */
import {describe, it, expect, vi} from 'vitest';

vi.mock('~/lib/motion', () => ({initMotion: () => {}, destroyMotion: () => {}}));

import {meta} from './contacto.jsx';

const ld = meta({}).find((d) => d['script:ld+json'])['script:ld+json'];

describe('contacto · datos estructurados', () => {
  it('declara una sola sucursal con dirección: CDMX', () => {
    expect(ld['@graph']).toHaveLength(1);
    expect(ld['@graph'][0]['@id']).toBe('https://generandoideas.com/contacto#office-cdmx');
    expect(ld['@graph'][0].address.streetAddress).toMatch(/Antonio Maceo 67/);
    expect(ld['@graph'][0].telephone).toBe('+52-55-7098-8100');
  });

  it('no publica direcciones ni teléfonos de Sonora o Yucatán', () => {
    expect(JSON.stringify(ld)).not.toMatch(/Navarrete|Calle 60|662|999|Hermosillo|Mérida/);
  });
});
