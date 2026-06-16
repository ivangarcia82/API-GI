import {flatRoutes} from '@react-router/fs-routes';
import {hydrogenRoutes} from '@shopify/hydrogen';

export default hydrogenRoutes([
  // Co-located test files (e.g. `*.shape.test.js`) live under app/routes/ but
  // must NOT be registered as routes — otherwise flatRoutes turns them into
  // real URLs and bundles `vitest` into the production server build. Vitest
  // still discovers them via its own glob, independent of this config.
  ...(await flatRoutes({
    ignoredRouteFiles: ['**/*.test.{js,jsx,ts,tsx}'],
  })),
  // Manual route definitions can be added to this array, in addition to or instead of using the `flatRoutes` file-based routing convention.
  // See https://reactrouter.com/api/framework-conventions/routes.ts#routests
]);

/** @typedef {import('@react-router/dev/routes').RouteConfig} RouteConfig */
