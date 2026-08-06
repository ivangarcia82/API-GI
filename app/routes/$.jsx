import {useLocation} from 'react-router';
import {RouteError} from '~/components/gi/RouteError';
import {terminoDesdeRuta} from '~/root.jsx';

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request}) {
  throw new Response(`${new URL(request.url).pathname} not found`, {
    status: 404,
  });
}

export default function CatchAllPage() {
  return null;
}

/* El 404 genérico se resuelve aquí y no en el boundary de root para que la
   página conserve el shell: cabecera, buscador y cotización siguen a mano en
   vez de dejar al visitante en una pantalla suelta. El boundary de root queda
   como red para los fallos que sí se llevan la app entera. */
export function ErrorBoundary() {
  const location = useLocation();
  const termino = terminoDesdeRuta(location?.pathname);

  return (
    <div className="container">
      <RouteError
        titulo="Página no encontrada"
        descripcion={
          termino
            ? `No encontramos “${termino}” en esta dirección. Puede que haya cambiado de nombre.`
            : 'La página que buscas no existe o fue movida.'
        }
        acciones={
          <div style={{display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap'}}>
            {termino ? (
              <a
                className="btn btn-accent"
                href={`/search?q=${encodeURIComponent(termino)}`}
              >
                Buscar “{termino}”
              </a>
            ) : null}
            <a className="btn btn-primary" href="/catalogo">
              Ver catálogo
            </a>
            <a className="btn btn-ghost" href="/contacto">
              Hablar con un asesor
            </a>
          </div>
        }
      />
    </div>
  );
}

/** @typedef {import('./+types/$').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
