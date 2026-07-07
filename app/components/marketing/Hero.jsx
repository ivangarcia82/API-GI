// Port de Hero.astro (gi-website-final/src/components/Hero.astro).
// The banner is shown with object-fit: contain and no parallax zoom, so it
// never upscales past its native size (no pixelation). Motion (Lenis/GSAP) is
// already initialized globally by MarketingLayout, so no effect is needed here.
export function Hero() {
  return (
    <section className="hero-cine">
      <div className="hero-stage">
        <img
          src="/bannerupdated.jpg"
          alt="Your one stop solution — productos promocionales personalizados de Generando Ideas"
          width={1440}
          height={400}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </div>
    </section>
  );
}
