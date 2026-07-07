import {useEffect, useRef, useState} from 'react';
import {formatCount} from '~/lib/format';
import {prefersReducedMotion} from '~/lib/motion';

export function CountUp({value, prefix = '', suffix = '', decimals = 0, duration = 1600}) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setV(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(value * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          io.disconnect();
        }
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
