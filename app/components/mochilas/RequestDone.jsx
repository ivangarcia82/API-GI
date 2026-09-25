import {Icon} from '~/components/gi/Icon';
import {MOCHILAS_DEFAULT_TO} from '~/lib/mochilas/email';

const FECHA = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Mexico_City',
});

/**
 * Cierre de la campaña: lo ve quien acaba de enviar y quien vuelve después.
 * @param {{request: {line: string, model: string, color: string, image?: string|null,
 *   foraneo: boolean, createdAt?: string}, collaborator: {fullName: string, email: string}}} props
 */
export function RequestDone({request, collaborator}) {
  const firstName = collaborator.fullName.split(' ')[0];
  const enviada = request.createdAt ? FECHA.format(new Date(request.createdAt)) : null;

  return (
    <section className="mc-done" aria-labelledby="mc-done-title">
      <div className="mc-done-card">
        <div className="mc-done-media">
          {request.image ? (
            <img src={request.image} alt={`Mochila ${request.line} ${request.model} en ${request.color}`} />
          ) : null}
        </div>
        <div className="mc-done-body">
          <span className="mc-done-mark" aria-hidden="true">
            <Icon name="check" size={22} strokeWidth={2.6} />
          </span>
          <h1 id="mc-done-title" className="mc-done-title">
            {firstName ? `¡Listo, ${firstName}!` : '¡Listo!'} Tu mochila está apartada.
          </h1>
          <dl className="mc-done-facts">
            <div>
              <dt>Mochila</dt>
              <dd>{`${request.line} ${request.model}`}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>{request.color}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>{request.foraneo ? 'Envío a domicilio' : 'Entrega en oficina'}</dd>
            </div>
            {enviada ? (
              <div>
                <dt>Enviada</dt>
                <dd>{enviada}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mc-done-note">
            Te mandamos una copia a {collaborator.email}. Te avisaremos cuando esté lista para
            entregártela.
          </p>
          <p className="mc-done-note">
            ¿Necesitas cambiarla? Escribe a{' '}
            <a href={`mailto:${MOCHILAS_DEFAULT_TO}`}>{MOCHILAS_DEFAULT_TO}</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
