/* Generando Ideas — small shared UI primitives */
import {useState, useEffect, useRef} from 'react';
import {Icon} from './Icon';

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

/** Animated number that counts up to `to` once on mount. */
export function CountUp({to, suffix = '', prefix = '', duration = 1400}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      if (start === undefined) start = now;
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(to * ease(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return (
    <span>
      {prefix}
      {val.toLocaleString('es-MX')}
      {suffix}
    </span>
  );
}

/** Reveal children on scroll into view. */
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
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
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
  return (
    <div
      className={`ph ${tint || 'ph-tinted-stone'} ${aspect} ${className} ${
        zoom ? 'ph-zoom' : ''
      }`}
      style={style}
    >
      {src && !error && (
        <img
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
