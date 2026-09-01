/* Generando Ideas — small shared UI primitives */
import {useState, useEffect, useLayoutEffect, useRef} from 'react';
import {Icon} from './Icon';
import {hasUserScrolled, prefersReducedMotion} from '~/lib/reveal';

/* useLayoutEffect avisa en SSR; en el servidor cae a useEffect, donde no corre. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function Button({
  children,
  variant = 'primary',
  size,
  icon,
  iconRight,
  className = '',
  as: As = 'button',
  ...rest
}) {
  const cn = `btn btn-${variant} ${
    size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : ''
  } ${className}`;
  const iconSize = size === 'lg' ? 18 : size === 'sm' ? 14 : 16;
  return (
    <As className={cn} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </As>
  );
}

/**
 * Animated number that counts up to `to` when it scrolls into view.
 *
 * Arranca en `to`, no en 0, y sólo cuenta si el usuario ha hecho scroll: el
 * HTML del servidor y cualquier render que no se desplace (captura de página
 * completa, impresión, exportar a PDF) muestran la cifra real. La banda de
 * estadísticas de la home se publicaba como "+0 / +0 / +0 / 0.0" por arrancar
 * en cero. El reset a 0 va en un layout effect, antes del primer pintado, para
 * que no se vea el valor final parpadear antes de la cuenta.
 */
export function CountUp({to, suffix = '', prefix = '', duration = 1400}) {
  const ref = useRef(null);
  const [val, setVal] = useState(to);
  useIsoLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    let raf;
    const animar = () => {
      setVal(0);
      let start;
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        if (start === undefined) start = now;
        const t = Math.min(1, (now - start) / duration);
        setVal(Math.round(to * ease(t)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (hasUserScrolled()) animar();
      },
      {threshold: 0.6},
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString('es-MX')}
      {suffix}
    </span>
  );
}

/**
 * Reveal children on scroll into view.
 *
 * Anima SÓLO transform, nunca opacidad. Un reveal que apaga la opacidad
 * esconde el contenido hasta que el IntersectionObserver dispara, y hay
 * renders donde no dispara nunca: capturas de página completa, impresión,
 * exportar a PDF, pestañas en segundo plano. La home salía con cinco
 * secciones en blanco por esto. Con transform sólo, lo peor que pasa es que
 * un bloque queda 24px desplazado, que nadie nota y todo el mundo puede leer.
 */
export function ScrollReveal({children, delay = 0, className = ''}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    // jsdom (unit tests) doesn't implement IntersectionObserver — degrade
    // gracefully by showing content immediately instead of crashing.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      {threshold: 0.15},
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** IntersectionObserver hook used by parallax / reveals. */
export function useInView(opts = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      {threshold: 0.15, ...opts},
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
    // Observe once on mount; `opts` is a per-render literal and would otherwise
    // re-create the observer every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, inView];
}

/**
 * Placeholder/real image with a tinted fallback (ported PH component).
 * Used everywhere product imagery is shown.
 */
export function PH({
  tint,
  label,
  className = '',
  aspect = '',
  src,
  alt = '',
  zoom = false,
  style,
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  /* El navegador puede terminar de cargar la imagen ANTES de que React hidrate
     y enganche onLoad — pasa siempre que viene de caché. Ese evento ya ocurrió
     y nadie lo escucha, así que `loaded` se quedaba en false y la imagen
     invisible (opacity 0) mostrando el placeholder hasta refrescar.
     `complete` + `naturalWidth` recuperan el estado real al montar.
     Depende de `src` para reiniciarse cuando la tarjeta cambia de imagen. */
  useEffect(() => {
    setError(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
  }, [src]);

  return (
    <div
      className={`ph ${tint || 'ph-tinted-stone'} ${aspect} ${className} ${
        zoom ? 'ph-zoom' : ''
      }`}
      style={style}
    >
      {src && !error && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition:
              'opacity 400ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      )}
      {label && (!src || !loaded || error) && (
        <span className="ph-label">{label}</span>
      )}
    </div>
  );
}
