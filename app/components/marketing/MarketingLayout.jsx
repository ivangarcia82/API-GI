import {useEffect} from 'react';
import {useLocation} from 'react-router';
import {initMotion} from '~/lib/motion';

/** Port de la lógica isActive() de Nav.astro/MobileMenu.astro. */
export function isNavActive(href, pathname) {
  const path = (pathname || '/').replace(/\/$/, '') || '/';
  if (href === '/' || href === '/servicios') return path === href;
  return path === href || path.startsWith(href + '/');
}

/** Reemplaza el IntersectionObserver `.reveal` del Layout.astro. Corre por navegación. */
export function useMarketingReveal() {
  const {pathname} = useLocation();
  useEffect(() => {
    const els = document.querySelectorAll('.gi-mkt .reveal:not(.in)');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      {threshold: 0.12},
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
}

export default function MarketingLayout({children, className = ''}) {
  useEffect(() => {
    initMotion();
  }, []);
  useMarketingReveal();
  return <div className={`gi-mkt ${className}`.trim()}>{children}</div>;
}
