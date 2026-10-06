import {flatRoutes} from '@react-router/fs-routes';
import {hydrogenRoutes} from '@shopify/hydrogen';
import {route} from '@react-router/dev/routes';

export default hydrogenRoutes([
  // Co-located test files (e.g. `*.shape.test.js`) live under app/routes/ but
  // must NOT be registered as routes — otherwise flatRoutes turns them into
  // real URLs and bundles `vitest` into the production server build. Vitest
  // still discovers them via its own glob, independent of this config.
  // Módulos auxiliares co-localizados con su ruta: son datos y lógica pura que
  // consumen tanto el formulario como el `action`, no rutas. Sin ignorarlos,
  // flatRoutes publica URLs muertas (`/registro/validation`) que revientan al
  // visitarlas, porque el módulo no exporta componente ni loader.
  ...(await flatRoutes({
    ignoredRouteFiles: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/registro.validation.js',
      '**/registro.catalogos.js',
    ],
  })),
  // Landing de temporada: es el mismo módulo del catálogo con la colección de
  // la campaña fija. Se registra aquí, con otro id, en vez de con un archivo de
  // ruta que importe del catálogo: importar de otra ruta mete sus módulos
  // .server en el bundle del cliente.
  route('temporada/:handle', 'routes/catalogo.jsx', {id: 'routes/temporada'}),
  // Manual route definitions can be added to this array, in addition to or instead of using the `flatRoutes` file-based routing convention.
  // See https://reactrouter.com/api/framework-conventions/routes.ts#routests
]);

/** @typedef {import('@react-router/dev/routes').RouteConfig} RouteConfig */
