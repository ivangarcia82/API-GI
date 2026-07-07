import {useEffect, useRef} from 'react';

export function MagneticButton({children, factor = 0.35, className = ''}) {
  const ref = useRef(null);
  useEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }
    let cleanup = () => {};
    import('~/lib/motion').then(({gsap}) => {
      const xTo = gsap.quickTo(wrap, 'x', {duration: 0.4, ease: 'power3'});
      const yTo = gsap.quickTo(wrap, 'y', {duration: 0.4, ease: 'power3'});
      const onMove = (e) => {
        const r = wrap.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * factor);
        yTo((e.clientY - (r.top + r.height / 2)) * factor);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };
      wrap.addEventListener('pointermove', onMove);
      wrap.addEventListener('pointerleave', onLeave);
      cleanup = () => {
        wrap.removeEventListener('pointermove', onMove);
        wrap.removeEventListener('pointerleave', onLeave);
        gsap.killTweensOf(wrap);
      };
    });
    return () => cleanup();
  }, [factor]);
  return (
    <span ref={ref} className={`magnetic ${className}`.trim()}>
      {children}
    </span>
  );
}
