/* Datos estructurados de la empresa.
 *
 * Buscadores y asistentes de IA arman la ficha de "quién es Generando Ideas"
 * con este bloque. Contacto, servicios y blog ya declaran su proveedor, autor
 * u organización madre apuntando a ORGANIZATION_ID: aquí es donde ese @id se
 * define de verdad.
 *
 * Va con el dominio público y no con el origen de la petición: un @id tiene
 * que ser el mismo lo sirva producción, una vista previa o el servidor local.
 */
import {SOCIAL_LINKS} from './site-content.js';

export const SITE_URL = 'https://generandoideas.com';
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Generando Ideas',
    description:
      'Catálogo B2B de artículos promocionales y regalos corporativos personalizados en México.',
    url: SITE_URL,
    logo: `${SITE_URL}/brand/gi-logo-horizontal.svg`,
    areaServed: 'MX',
    // Los mismos perfiles que enlaza el pie; WhatsApp es un canal de contacto,
    // no un perfil de la empresa.
    sameAs: [SOCIAL_LINKS.instagram, SOCIAL_LINKS.facebook, SOCIAL_LINKS.linkedin],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'marketing@generandoideas.com',
      telephone: '+525570988100',
      availableLanguage: 'Spanish',
    },
  };
}

/**
 * Serializa un bloque para meterlo en <script type="application/ld+json">.
 * El "<" se escapa para que ningún texto pueda cerrar la etiqueta.
 * @param {object} datos
 */
export function jsonLd(datos) {
  return JSON.stringify(datos).replace(/</g, '\\u003c');
}
