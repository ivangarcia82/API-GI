/* Los motores de búsqueda y los de IA arman la ficha de la empresa con el
   bloque Organization. Cuatro plantillas (contacto, servicios, blog) ya apuntan
   a su @id: si el @id cambia o el bloque pierde las redes, esas referencias
   quedan colgando de nada. */
import {describe, it, expect} from 'vitest';
import {ORGANIZATION_ID, organizationSchema, jsonLd} from './seo.js';
import {SOCIAL_LINKS} from './site-content.js';

describe('organizationSchema', () => {
  it('se identifica con el @id al que apuntan las demás plantillas', () => {
    const org = organizationSchema();
    expect(org['@type']).toBe('Organization');
    expect(org['@id']).toBe('https://generandoideas.com/#organization');
    expect(org['@id']).toBe(ORGANIZATION_ID);
  });

  it('enlaza los perfiles oficiales, que es como se confirma que es la misma empresa', () => {
    expect(organizationSchema().sameAs).toEqual([
      SOCIAL_LINKS.instagram,
      SOCIAL_LINKS.facebook,
      SOCIAL_LINKS.linkedin,
    ]);
  });

  it('da la URL y el logo con el dominio público, no con el del servidor que responde', () => {
    const org = organizationSchema();
    expect(org.url).toBe('https://generandoideas.com');
    expect(org.logo).toBe('https://generandoideas.com/brand/gi-logo-horizontal.svg');
  });
});

describe('jsonLd', () => {
  it('no deja cerrar la etiqueta script desde un texto', () => {
    const salida = jsonLd({name: '</script><b>x'});
    expect(salida).not.toContain('<');
    expect(JSON.parse(salida).name).toBe('</script><b>x');
  });
});
