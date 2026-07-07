// Port de ProcessSection.astro (gi-website-final/src/components/ProcessSection.astro).
import {useEffect, useRef} from 'react';
import {gsap, ScrollTrigger, prefersReducedMotion} from '~/lib/motion';

const STEPS = [
  {n: '01', t: 'Briefing', d: 'Nos compartes objetivo, target, presupuesto y tiempos. Salimos con un norte claro.'},
  {n: '02', t: 'Propuesta', d: 'Cotizamos opciones del catálogo + ideas originales en menos de 48 horas.'},
  {n: '03', t: 'Producción', d: 'Fabricación y personalización de principio a fin.'},
  {n: '04', t: 'Entrega', d: 'A tu bodega o directo a tus destinatarios, a donde sea que estén.'},
];

export function ProcessSection() {
  const secRef = useRef(null);
  const lineRef = useRef(null);
  const stepRefs = useRef([]);
  stepRefs.current = [];

  const registerStep = (el) => {
    if (el) stepRefs.current.push(el);
  };

  useEffect(() => {
    const sec = secRef.current;
    const line = lineRef.current;
    const steps = stepRefs.current;
    if (!sec) return undefined;

    if (prefersReducedMotion()) {
      // Reduced motion / no-JS guard fallback: line fully drawn, steps visible.
      if (line) line.setAttribute('stroke-dashoffset', '0');
      steps.forEach((s) => {
        s.style.opacity = '1';
        s.style.transform = 'none';
      });
      return undefined;
    }

    if (line) {
      gsap.to(line, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sec,
          start: 'top 70%',
          end: 'bottom 60%',
          scrub: true,
        },
      });
    }

    gsap.to(steps, {
      opacity: 1,
      y: 0,
      stagger: 0.12,
      duration: 0.6,
      ease: 'power3.out',
      // Drop the compositor hint once the one-shot reveal has finished.
      onComplete: () => gsap.set(steps, {willChange: 'auto'}),
      scrollTrigger: {
        trigger: sec,
        start: 'top 70%',
        once: true,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === sec) t.kill();
      });
      gsap.killTweensOf(line);
      gsap.killTweensOf(steps);
    };
  }, []);

  return (
    <section className="section section-dark" ref={secRef} data-proc>
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">Cómo trabajamos</span>
            <h2>
              De la idea <span className="text-accent">al entregable.</span>
            </h2>
          </div>
          <p>Un proceso probado que funciona igual para 100 piezas que para 100,000.</p>
        </div>
        <div className="proc-rail">
          <svg className="proc-path" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path
              ref={lineRef}
              d="M20 60 H980"
              data-proc-line=""
              fill="none"
              stroke="var(--orange-500)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="process-list">
            {STEPS.map((s) => (
              <div className="process-step" data-proc-step="" key={s.n} ref={registerStep}>
                <span className="num">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
