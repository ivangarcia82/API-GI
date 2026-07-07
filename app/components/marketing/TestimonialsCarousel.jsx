// Port de TestimonialsCarousel.astro (gi-website-final/src/components/TestimonialsCarousel.astro),
// consolidating its own auto-advance <script> with the generic carousel
// prev/next button wiring that lived in the Astro Layout.
import {useEffect, useRef} from 'react';
import {TESTIMONIALS} from '~/lib/site-content';
import {prefersReducedMotion} from '~/lib/motion';

function initials(name) {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function TestimonialsCarousel() {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const barRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;
    const bar = barRef.current;
    const root = rootRef.current;
    if (!track || !bar || prefersReducedMotion()) return undefined;

    const card = track.querySelector('.testimonial');
    const step = (card?.offsetWidth || 440) + 24;
    const PERIOD = 5000;

    let paused = false;
    let elapsed = 0;
    let rafId = 0;
    let last = performance.now();

    const loop = (now) => {
      const dt = now - last;
      last = now;
      if (!paused) {
        elapsed += dt;
        bar.style.transform = `scaleX(${Math.min(elapsed / PERIOD, 1)})`;
        if (elapsed >= PERIOD) {
          elapsed = 0;
          bar.style.transform = 'scaleX(0)';
          const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
          track.scrollTo({
            left: atEnd ? 0 : track.scrollLeft + step,
            behavior: 'smooth',
          });
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        paused = !entry.isIntersecting;
      },
      {threshold: 0.2},
    );
    io.observe(track);

    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
    };
    // Bind to the carousel root (not just the track) so focusing the prev/next
    // buttons — which sit outside the track — also pauses the auto-advance.
    const interaction = root ?? track;
    ['mouseenter', 'focusin'].forEach((evt) => interaction.addEventListener(evt, pause));
    ['mouseleave', 'focusout'].forEach((evt) => interaction.addEventListener(evt, resume));

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
      ['mouseenter', 'focusin'].forEach((evt) => interaction.removeEventListener(evt, pause));
      ['mouseleave', 'focusout'].forEach((evt) => interaction.removeEventListener(evt, resume));
    };
  }, []);

  const handlePrev = () => trackRef.current?.scrollBy({left: -460, behavior: 'smooth'});
  const handleNext = () => trackRef.current?.scrollBy({left: 460, behavior: 'smooth'});

  return (
    <div ref={rootRef}>
      <div className="testimonials">
        <div className="testimonial-track" ref={trackRef}>
          {TESTIMONIALS.map((t) => (
            <div className="testimonial" key={t.quote}>
              <blockquote>&quot;{t.quote}&quot;</blockquote>
              <cite>
                <div className="avatar">{initials(t.company)}</div>
                <div className="testimonial-meta">
                  <strong>{t.company}</strong>
                </div>
              </cite>
            </div>
          ))}
        </div>
      </div>
      <div className="testi-progress" aria-hidden="true">
        <i ref={barRef} />
      </div>
      <div className="carousel-nav">
        <button type="button" className="carousel-btn" onClick={handlePrev} aria-label="Anterior">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </button>
        <button type="button" className="carousel-btn" onClick={handleNext} aria-label="Siguiente">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
