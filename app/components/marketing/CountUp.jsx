import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {formatCount} from '~/lib/format';
import {hasUserScrolled, prefersReducedMotion} from '~/lib/reveal';

/* El reset a 0 tiene que ocurrir antes del primer pintado del cliente, o se ve
   el número final parpadear antes de la cuenta. useLayoutEffect hace eso, pero
   avisa en SSR, así que en el servidor cae a useEffect (donde nunca corre). */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * El valor de partida es el valor FINAL, no 0, y sólo cuenta si el usuario ha
 * hecho scroll: así el HTML del servidor y cualquier render que no se desplace
 * (captura de página completa, impresión, exportar a PDF) muestran la cifra
 * real en vez de "+0".
 */
export function CountUp({value, prefix = '', suffix = '', decimals = 0, duration = 1600}) {
  const ref = useRef(null);
  const [v, setV] = useState(value);
  useIsoLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (!hasUserScrolled()) return;
        setV(0);
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setV(value * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      {threshold: 0.6},
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  const display = formatCount({
    prefix,
    value: decimals ? Number(v.toFixed(decimals)) : Math.round(v),
    suffix,
    decimals,
  });
  return <span ref={ref}>{display}</span>;
}
