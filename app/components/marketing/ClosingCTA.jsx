// Port de ClosingCTA.astro (gi-website-final/src/components/ClosingCTA.astro).
// The `.reveal` fade-in and the `.magnetic` pointer-follow hover are handled
// globally: reveal by MarketingLayout's useMarketingReveal(), magnetic by
// <MagneticButton> (shared primitive, same GSAP quickTo wiring as the source
// script's inline <script>).
import {Link} from 'react-router';
import {ROUTES} from '~/lib/site-content';
import {MagneticButton} from './MagneticButton';

export function ClosingCTA() {
  return (
    <section className="section closing">
      <div className="wrap closing-inner">
        <h2 className="closing-h reveal">
          ¿Listo para <span className="text-grad-word">impulsar</span> tu marca?
        </h2>
        <p className="closing-sub reveal">
          Cuéntanos qué traes en mente. Te respondemos con propuesta y cotización en menos de 48 horas.
        </p>
        <div className="closing-cta reveal">
          <MagneticButton>
            <Link to={ROUTES.contact} className="btn btn-accent btn-lg">
              Cotizar
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </MagneticButton>
          <Link to={ROUTES.estore} className="btn btn-ghost btn-lg">
            Ver e-store
          </Link>
        </div>
      </div>
    </section>
  );
}
