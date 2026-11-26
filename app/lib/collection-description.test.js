/* Las colecciones sin texto propio enseñaban todas la misma frase ("Una línea
   cuidadosamente seleccionada…") y la misma descripción para buscadores. Ahora
   cada una se describe con lo que la tienda sabe de ella en ese momento:
   cuántos productos tiene, de qué material son y qué técnicas admiten. Nada
   se escribe a mano ni se guarda: sale de las facetas de la propia colección. */
import {describe, it, expect} from 'vitest';
import {describirColeccion} from './collection-description.js';
import {TIEMPO_ENTREGA} from './quotes/notasImportantes.js';

const MATERIAL = 'filter.p.m.custom.material';
const TECNICA = 'filter.p.m.custom.tecnicas_de_impresion';
const faceta = (id, valores) => ({id, values: Object.entries(valores).map(([label, count]) => ({label, count}))});
const palabras = (s) => s.trim().split(/\s+/).length;

/* Bebidas, con números del orden de los reales: 1,238 productos. */
const BEBIDAS = [
  faceta(MATERIAL, {METAL: 640, PLÁSTICO: 420, VIDRIO: 110, CERÁMICA: 68}),
  faceta(TECNICA, {
    'SERIGRAFÍA': 380,
    'SERIGRAFÍA-GRABADO LÁSER': 420,
    'GRABADO LÁSER': 250,
    'SERIGRAFÍA-FULL COLOR': 188,
  }),
];

describe('describirColeccion', () => {
  it('dice cuántos productos hay, redondeando hacia abajo para no exagerar', () => {
    const {texto} = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    // 640 + 420 + 110 + 68 = 1,238 → "más de 1,230"
    expect(texto).toContain('La colección Bebidas de Generando Ideas reúne más de 1,230 artículos');
  });

  it('nombra los materiales que predominan', () => {
    const {texto} = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    expect(texto).toContain('Predominan los de metal y plástico.');
  });

  it('cuando casi todo es de un material, lo dice así', () => {
    const {texto} = describirColeccion({
      titulo: 'Gorras',
      facetas: [faceta(MATERIAL, {TEXTIL: 900, 'PLÁSTICO': 60}), faceta(TECNICA, {'SERIGRAFÍA': 800})],
    });
    expect(texto).toContain('La mayoría son de textil.');
  });

  it('no repite el material cuando ya es el nombre de la colección', () => {
    // "La colección Textil… La mayoría son de textil" no le dice nada a nadie.
    const {texto} = describirColeccion({
      titulo: 'Textil',
      facetas: [faceta(MATERIAL, {TEXTIL: 900, 'PLÁSTICO': 60}), faceta(TECNICA, {'SERIGRAFÍA': 800})],
    });
    expect(texto).not.toMatch(/La mayoría son de|Predominan/);
    expect(texto).toContain('La colección Textil de Generando Ideas reúne más de 950 artículos');
    expect(texto).toContain('admite serigrafía.');
  });

  it('con dos técnicas igual de presentes no repite el porcentaje', () => {
    const {texto} = describirColeccion({
      titulo: 'Termos',
      facetas: [
        faceta(MATERIAL, {METAL: 500, 'PLÁSTICO': 30}),
        faceta(TECNICA, {'SERIGRAFÍA-GRABADO LÁSER': 400, 'SERIGRAFÍA': 50, 'GRABADO LÁSER': 50}),
      ],
    });
    // Cada una en 450 de 530 = 85%; no se afirma que sean los mismos productos.
    // Una femenina y una masculina: "cada uno".
    expect(texto).toContain('La serigrafía y el grabado láser se pueden aplicar, cada uno, en el 85% de los productos.');
    expect(texto).not.toMatch(/85% admite/);
  });

  it('dice qué parte admite cada técnica, sumando las combinaciones', () => {
    const {texto} = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    // Serigrafía: 380 + 420 + 188 = 988 de 1,238 → 80%. Grabado: 420 + 250 = 670 → 54%.
    expect(texto).toContain('El 80% admite serigrafía y el 54%, grabado láser.');
  });

  it('concuerda en femenino cuando las dos técnicas lo son', () => {
    const {texto} = describirColeccion({
      titulo: 'Tazas',
      facetas: [faceta(MATERIAL, {'CERÁMICA': 100}), faceta(TECNICA, {'SERIGRAFÍA-SUBLIMACION': 60})],
    });
    expect(texto).toContain('La serigrafía y la sublimación se pueden aplicar, cada una, en el 60% de los productos.');
  });

  it('cuando una técnica aplica a todos, lo dice sin porcentaje', () => {
    const dos = describirColeccion({
      titulo: 'Mugs de viaje',
      facetas: [faceta(MATERIAL, {METAL: 30}), faceta(TECNICA, {'SERIGRAFÍA-FULL COLOR': 28, 'SERIGRAFÍA': 2})],
    });
    expect(dos.texto).toContain('Todos admiten serigrafía y el 93%, impresión a todo color.');
    const iguales = describirColeccion({
      titulo: 'Playeras',
      facetas: [faceta(MATERIAL, {TEXTIL: 21}), faceta(TECNICA, {'SERIGRAFÍA-BORDADO': 21})],
    });
    expect(iguales.texto).toContain('La serigrafía y el bordado se pueden aplicar en todos los productos.');
    expect(dos.texto + iguales.texto).not.toMatch(/100%/);
  });

  it('llama a la etiqueta FULL COLOR por su nombre en español', () => {
    const {texto} = describirColeccion({
      titulo: 'Textil',
      facetas: [
        faceta(MATERIAL, {TEXTIL: 100}),
        faceta(TECNICA, {'FULL COLOR': 60, 'SERIGRAFÍA-FULL COLOR': 30, BORDADO: 10}),
      ],
    });
    expect(texto).toContain('El 90% admite impresión a todo color');
    expect(texto).not.toMatch(/full color/i);
  });

  it('cierra con cómo se cotiza y el plazo de entrega de la cotización', () => {
    const {texto} = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    expect(texto).toContain(`Se cotizan en línea sin cantidad mínima y se entregan en ${TIEMPO_ENTREGA}.`);
  });

  it('una colección típica queda en una respuesta de 40 a 60 palabras', () => {
    const {texto} = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    expect(palabras(texto)).toBeGreaterThanOrEqual(40);
    expect(palabras(texto)).toBeLessThanOrEqual(60);
  });

  it('con pocos productos no presume un número', () => {
    const {texto} = describirColeccion({
      titulo: 'Edición especial',
      facetas: [faceta(MATERIAL, {METAL: 7}), faceta(TECNICA, {'GRABADO LÁSER': 7})],
    });
    expect(texto).not.toMatch(/más de/);
    expect(texto).toContain('La colección Edición especial de Generando Ideas reúne artículos promocionales');
    expect(texto).toContain('Todos admiten grabado láser.');
  });

  it('nunca pasa de 100% aunque a algún producto le falte el material', () => {
    const {texto} = describirColeccion({
      titulo: 'Oficina',
      facetas: [faceta(MATERIAL, {'PLÁSTICO': 90}), faceta(TECNICA, {'SERIGRAFÍA': 95})],
    });
    expect(texto).toContain('Todos admiten serigrafía.');
  });

  it('no menciona técnicas marginales', () => {
    const {texto} = describirColeccion({
      titulo: 'Oficina',
      facetas: [faceta(MATERIAL, {'PLÁSTICO': 200}), faceta(TECNICA, {'SERIGRAFÍA': 190, 'GOTA DE RESINA': 4})],
    });
    expect(texto).not.toMatch(/resina/);
  });

  it('sin facetas sigue describiendo la colección, sin inventar cifras', () => {
    for (const facetas of [undefined, [], [faceta(MATERIAL, {})]]) {
      const {texto, meta} = describirColeccion({titulo: 'Navidad', facetas});
      expect(texto).toContain('La colección Navidad de Generando Ideas reúne artículos promocionales');
      expect(texto).not.toMatch(/\d+%|más de/);
      expect(texto).toContain(TIEMPO_ENTREGA);
      expect(meta).toContain('Navidad');
    }
  });

  it('no publica importes', () => {
    const {texto, meta} = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    expect(texto + meta).not.toMatch(/\$/);
  });
});

describe('descripción para buscadores', () => {
  it('cabe en un resultado y dice cuántos, de qué y con qué técnica', () => {
    const {meta} = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    expect(meta.length).toBeLessThanOrEqual(160);
    expect(meta).toBe(
      'Más de 1,230 artículos promocionales de Bebidas, personalizables con serigrafía o grabado láser. Cotiza en línea sin cantidad mínima.',
    );
  });

  it('con un título largo se acorta antes que pasarse', () => {
    const {meta} = describirColeccion({
      titulo: 'Regalos corporativos ejecutivos para fin de año y reconocimientos',
      facetas: BEBIDAS,
    });
    expect(meta.length).toBeLessThanOrEqual(160);
    expect(meta).toContain('Regalos corporativos ejecutivos');
  });

  it('dos colecciones distintas no comparten descripción', () => {
    const a = describirColeccion({titulo: 'Bebidas', facetas: BEBIDAS});
    const b = describirColeccion({
      titulo: 'Textil',
      facetas: [faceta(MATERIAL, {TEXTIL: 1500}), faceta(TECNICA, {'SERIGRAFÍA': 1300, BORDADO: 440})],
    });
    expect(a.texto).not.toBe(b.texto);
    expect(a.meta).not.toBe(b.meta);
  });
});
