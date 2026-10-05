// Bloques de las páginas de servicio. Cada servicio declara en site-content
// qué bloques lleva y en qué orden (SERVICE_DETAILS[id].blocks); aquí vive
// cómo se pinta cada tipo. Ver el typedef ServiceBlock.
import {useState} from 'react';
import {ServiceIcon} from './ServiceIcons';
import {WORLD_DOTS, projectLonLat} from '~/lib/world-dots';

/** Título con su palabra en naranja. */
function Heading({heading, className = 'display svc-h2'}) {
  if (!heading) return null;
  const {pre, accent, post} = heading;
  return (
    <h2 className={className}>
      {pre ? `${pre} ` : null}
      <span className="text-accent">{accent}</span>
      {post ? (post.startsWith('?') || post.startsWith('.') ? post : ` ${post}`) : null}
    </h2>
  );
}

function Head({block, center = false}) {
  return (
    <div className={`svc-block-head${center ? ' is-center' : ''}`}>
      {block.eyebrow ? <span className="eyebrow">{block.eyebrow}</span> : null}
      <Heading heading={block.heading} />
      {block.intro ? <p className="svc-intro-copy">{block.intro}</p> : null}
    </div>
  );
}

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

function LeadBlock({block, color}) {
  const conDetalle = block.features?.some((f) => f.d);
  return (
    <section className="section svc-includes">
      <div className="wrap svc-includes-grid reveal">
        <div className="svc-includes-lead">
          {block.eyebrow ? <span className="eyebrow">{block.eyebrow}</span> : null}
          <Heading heading={block.heading} />
          {block.intro ? <p className="svc-intro-copy">{block.intro}</p> : null}
          {block.chips?.length ? (
            <div className="svc-examples">
              {block.chips.map((e) => (
                <span className="svc-chip" key={e}>
                  {e}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {block.table ? (
          <div className="svc-table-wrap">
            <table className="svc-table">
              <thead>
                <tr>
                  {block.table.cols.map((c) => (
                    <th scope="col" key={c}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.table.rows.map(([tecnica, uso]) => (
                  <tr key={tecnica}>
                    <th scope="row">{tecnica}</th>
                    <td>{uso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {block.features?.length && conDetalle ? (
          <ul className="svc-features" style={{'--svc-color': color}}>
            {block.features.map((f, i) => (
              <li className="svc-feature" key={f.t}>
                <span className="svc-feature-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="svc-feature-t">{f.t}</h3>
                <p className="svc-feature-d">{f.d}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {block.features?.length && !conDetalle ? (
          <ul className="svc-checklist">
            {block.features.map((f) => (
              <li key={f.t}>
                <span className="svc-check" aria-hidden="true">
                  <Check />
                </span>
                {f.t}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function ExperiencesBlock({block}) {
  return (
    <section className="section svc-experiences">
      <div className="wrap reveal">
        <Head block={block} />
        <ul className="svc-exp-grid">
          {block.items.map((it, i) => (
            <li className="svc-exp" key={it.t}>
              <span className="svc-exp-icon">
                <ServiceIcon name={it.icon} size={30} />
              </span>
              <span className="svc-feature-num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="svc-exp-t">{it.t}</h3>
              <p className="svc-exp-d">{it.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProcessBlock({block}) {
  return (
    <section className="section section-alt svc-flow">
      <div className="wrap reveal">
        <Head block={block} center />
        <ol className="svc-flow-row" style={{'--svc-steps': block.steps.length}}>
          {block.steps.map((s, i) => (
            <li className="svc-flow-step" key={s.t}>
              <span className="svc-flow-icon">
                <ServiceIcon name={s.icon} />
              </span>
              <span className="svc-flow-t">
                <span className="svc-flow-n">{i + 1}.</span> {s.t}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function IconCardsBlock({block}) {
  return (
    <section className="section svc-icards">
      <div className="wrap reveal">
        <Head block={block} center />
        <ul className="svc-icard-grid" style={{'--svc-cards': block.items.length}}>
          {block.items.map((it) => (
            <li className="svc-icard" key={it.t}>
              <span className="svc-icard-icon">
                <ServiceIcon name={it.icon} size={40} />
              </span>
              <span className="svc-icard-t">{it.t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TimelineBlock({block}) {
  return (
    <section className="section svc-timeline">
      <div className="wrap reveal">
        <Head block={block} />
        <ol className="svc-tl">
          {block.steps.map((s, i) => (
            <li className="svc-tl-step" key={s.t}>
              <span className="svc-tl-n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="svc-tl-body">
                <h3 className="svc-tl-t">{s.t}</h3>
                <p className="svc-tl-sub">{s.sub}</p>
                {s.d ? <p className="svc-tl-d">{s.d}</p> : null}
                {s.list?.length ? (
                  <ul className="svc-tl-list">
                    {s.list.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : null}
                {s.note ? <p className="svc-tl-note">{s.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
        {block.result ? (
          <div className="svc-result">
            <span className="svc-result-mark" aria-hidden="true">
              ✦
            </span>
            <div>
              <h3 className="svc-result-t">{block.result.t}</h3>
              <p className="svc-result-d">{block.result.d}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* Arco de un origen a México: la curva sube por encima de la recta, más
   cuanto más larga es, para que las rutas no se encimen sobre el mapa. */
function arco([x1, y1], [x2, y2]) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const lift = Math.hypot(x2 - x1, y2 - y1) * 0.28;
  return `M${x1} ${y1} Q${mx} ${my - lift} ${x2} ${y2}`;
}

const pct = ([x, y]) => ({
  left: `${(x / WORLD_DOTS.width) * 100}%`,
  top: `${(y / WORLD_DOTS.height) * 100}%`,
});

function MapBlock({block}) {
  const [activo, setActivo] = useState(null);
  const destino = projectLonLat(block.dest.lon, block.dest.lat);
  const origenes = block.origins.map((o) => ({...o, xy: projectLonLat(o.lon, o.lat)}));

  return (
    <section className="section section-alt svc-map">
      <div className="wrap reveal">
        <Head block={block} center />
        <div className="svc-map-stage">
          <svg
            className="svc-map-svg"
            viewBox={`0 0 ${WORLD_DOTS.width} ${WORLD_DOTS.height}`}
            role="img"
            aria-label={`Mapa de presencia internacional de Generando Ideas: importamos desde ${block.origins
              .map((o) => o.name)
              .join(', ')} hasta ${block.dest.name}.`}
          >
            <path className="svc-map-land" d={WORLD_DOTS.d} />
            {origenes.map((o) => (
              <path
                key={o.id}
                className={`svc-map-route${activo === o.id ? ' is-active' : ''}`}
                d={arco(o.xy, destino)}
              />
            ))}
          </svg>

          <span className="svc-map-pin is-dest" style={pct(destino)}>
            <span className="svc-map-dot" aria-hidden="true" />
            <span className="svc-map-label">{block.dest.name}</span>
          </span>

          {origenes.map((o) => (
            <div
              key={o.id}
              className={`svc-map-pin${activo === o.id ? ' is-open' : ''}${o.labelTop ? ' is-label-top' : ''}`}
              style={pct(o.xy)}
              onMouseEnter={() => setActivo(o.id)}
              onMouseLeave={() => setActivo((a) => (a === o.id ? null : a))}
            >
              <button
                type="button"
                className="svc-map-dot"
                aria-label={o.ports?.length ? `${o.name}: ver puertos` : o.name}
                aria-expanded={activo === o.id}
                aria-controls={`svc-map-tip-${o.id}`}
                onFocus={() => setActivo(o.id)}
                onBlur={() => setActivo((a) => (a === o.id ? null : a))}
                onClick={() => setActivo((a) => (a === o.id ? null : o.id))}
              />
              <span className="svc-map-label">{o.name}</span>
              <div className="svc-map-tip" id={`svc-map-tip-${o.id}`} role="tooltip">
                <strong>{o.name}</strong>
                {o.ports?.length ? (
                  <>
                    <span className="svc-map-tip-h">Puertos principales</span>
                    <ul>
                      {o.ports.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <span className="svc-map-tip-h">Fabricantes aliados</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* En pantallas táctiles no hay hover: la misma información, fija bajo
            el mapa. Oculta a lectores de pantalla porque ya la anuncian los
            puntos del mapa. */}
        <ul className="svc-map-legend" aria-hidden="true">
          {block.origins.map((o) => (
            <li key={o.id}>
              <strong>{o.name}</strong>
              {o.ports?.length ? <span>{o.ports.join(' · ')}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FactsBlock({block}) {
  return (
    <section className="section svc-facts">
      <div className="wrap reveal">
        <div className="svc-facts-box">
          <span className="svc-facts-eyebrow">{block.eyebrow}</span>
          <ul className="svc-facts-list">
            {block.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const BLOCKS = {
  lead: LeadBlock,
  experiences: ExperiencesBlock,
  process: ProcessBlock,
  iconCards: IconCardsBlock,
  timeline: TimelineBlock,
  map: MapBlock,
  facts: FactsBlock,
};

/**
 * Pinta los bloques de un servicio en orden. Un tipo desconocido se ignora:
 * una errata en site-content no puede tumbar la página.
 * @param {{blocks: Array<{type: string}>, color?: string}} props
 */
export function ServiceBlocks({blocks = [], color}) {
  return blocks.map((block) => {
    const Bloque = BLOCKS[block.type];
    // Tipo + título: único dentro de un servicio (Print Shop lleva dos "lead").
    const key = `${block.type}:${block.heading?.accent ?? block.eyebrow ?? ''}`;
    return Bloque ? <Bloque key={key} block={block} color={color} /> : null;
  });
}
