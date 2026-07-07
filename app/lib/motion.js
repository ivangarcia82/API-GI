// Portado de gi-website-final/src/lib/motion.ts — GSAP + Lenis, client-only.
import Lenis from 'lenis';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis = null;
let initialized = false;
const tickerCb = (time) => {
  if (lenis) lenis.raf(time * 1000);
};

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function initMotion() {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;
  if (prefersReducedMotion()) {
    ScrollTrigger.refresh();
    return;
  }
  lenis = new Lenis({duration: 1.1, smoothWheel: true});
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tickerCb);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.refresh();
}

export function destroyMotion() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.ticker.remove(tickerCb);
  if (lenis) lenis.destroy();
  lenis = null;
  initialized = false;
}

export {gsap, ScrollTrigger};
