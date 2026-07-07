// Port de ImpactBand.astro (gi-website-final/src/components/ImpactBand.astro).
// Dark stats strip built only from existing brand facts. Big Space-Grotesk
// numbers separated by 1px hairlines (no card boxes), count-up on scroll-in.
// The count-up itself (IntersectionObserver + rAF, reduced-motion guarded) is
// handled by the shared <CountUp> primitive instead of a bespoke GSAP effect.
import {CountUp} from './CountUp';

const STATS = [
  {prefix: '+', value: 12, suffix: '', decimals: 0, label: 'Años amplificando marcas'},
  {prefix: '+', value: 2700, suffix: '', decimals: 0, label: 'Clientes activos'},
  {prefix: '+', value: 67000, suffix: '', decimals: 0, label: 'Decorados diarios'},
  {prefix: '', value: 4.9, suffix: '', decimals: 1, label: 'Nivel de satisfacción'},
];

export function ImpactBand() {
  return (
    <section className="section section-dark impact">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">Por qué nos eligen</span>
            <h2>
              Números que <span className="text-accent">sostienen</span> la promesa.
            </h2>
          </div>
        </div>
        <div className="impact-grid">
          {STATS.map((s) => (
            <div className="impact-cell" key={s.label}>
              <strong className="impact-cell-n">
                <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
              </strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
