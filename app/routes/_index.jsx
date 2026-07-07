import MarketingLayout from '~/components/marketing/MarketingLayout';
import {Hero} from '~/components/marketing/Hero';
import {ServicesShowcase} from '~/components/marketing/ServicesShowcase';
import {ProcessSection} from '~/components/marketing/ProcessSection';
import {ImpactBand} from '~/components/marketing/ImpactBand';
import {TestimonialsCarousel} from '~/components/marketing/TestimonialsCarousel';
import {ClosingCTA} from '~/components/marketing/ClosingCTA';

export const meta = () => [
  {title: 'Generando Ideas - Your one stop solution'},
  {
    name: 'description',
    content:
      'Generando Ideas, expertos en artículos promocionales, regalos corporativos y soluciones de branding para fortalecer la presencia de tu marca.',
  },
];

export default function Homepage() {
  return (
    <MarketingLayout>
      <Hero />

      <section className="section">
        <div className="wrap reveal">
          <div className="section-head">
            <div>
              <span className="eyebrow">Servicios</span>
              <h2>
                Cinco servicios, <span className="text-accent">una sola relación.</span>
              </h2>
            </div>
            <p>
              Tu promocional puede ser una pieza o puede ser una solución integral
              completa: producción, almacenamiento, envío y experiencia. Elige hasta
              donde quieras llegar.
            </p>
          </div>
          <ServicesShowcase layout="mosaic" />
        </div>
      </section>

      <ProcessSection />
      <ImpactBand />

      <section className="section">
        <div className="wrap reveal">
          <div className="section-head">
            <div>
              <span className="eyebrow">Lo que dicen nuestros clientes</span>
              <h2>
                Relaciones que <span className="text-accent">duran años.</span>
              </h2>
            </div>
          </div>
          <TestimonialsCarousel />
        </div>
      </section>

      <ClosingCTA />
    </MarketingLayout>
  );
}
