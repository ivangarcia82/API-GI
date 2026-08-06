/* Error de una ruta concreta, no de toda la app.
 *
 * Sin un ErrorBoundary propio, cualquier fallo de un loader sube hasta el de
 * root y se lleva por delante el shell: cabecera, buscador, cotización y pie
 * desaparecen, y el comprador se queda sin ninguna salida que no sea el botón
 * de atrás. Con este, el fallo se queda dentro del <Outlet> y todo lo demás
 * sigue en pie.
 */
import {isRouteErrorResponse, useRouteError} from 'react-router';
import {Icon} from '~/components/gi/Icon';

/**
 * @param {object} props
 * @param {string} props.titulo        qué falló, en cristiano
 * @param {string} props.descripcion   qué puede hacer el usuario ahora
 * @param {React.ReactNode} [props.acciones] salidas concretas de esta pantalla
 */
export function RouteError({titulo, descripcion, acciones}) {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const esNoEncontrado = status === 404;

  return (
    <div className="empty" role="alert" style={{margin: '48px auto', maxWidth: 560}}>
      <Icon name={esNoEncontrado ? 'search' : 'alert'} size={32} className="muted-2" />
      <h3>{titulo}</h3>
      <p>{descripcion}</p>
      {acciones}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginTop: 16,
        }}
      >
        Error {status}
      </p>
    </div>
  );
}
