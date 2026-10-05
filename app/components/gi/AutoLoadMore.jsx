/* Generando Ideas — carga automática de la siguiente página del catálogo.
 *
 * Un sentinela invisible al final de la lista: cuando entra en pantalla (un
 * poco antes, por el rootMargin) navega a la siguiente página igual que el
 * botón "Cargar más" de <Pagination>, que se queda como respaldo para teclado
 * y para navegadores sin IntersectionObserver.
 */
import {useEffect, useRef} from 'react';
import {useNavigate} from 'react-router';

// Se adelanta media pantalla: la siguiente página llega antes de que el
// usuario vea el final.
const ANTICIPO = '0px 0px 600px 0px';

/**
 * @param {{nextPageUrl: string, state: unknown, isLoading: boolean}} props
 *   los mismos que entrega el render prop de <Pagination> de Hydrogen
 */
export function AutoLoadMore({nextPageUrl, state, isLoading}) {
  const navigate = useNavigate();
  const ref = useRef(null);
  // El callback del observer vive más que un render: lee siempre lo último.
  const ultimo = useRef({nextPageUrl, state, isLoading});
  ultimo.current = {nextPageUrl, state, isLoading};
  /* Una página por cada llegada al final. Tras cargar, el navegador puede
     dejar el final a la vista (scroll anchoring) y el sentinela seguiría
     pidiendo páginas solo; se rearma únicamente cuando sale de la vista, es
     decir, cuando el usuario sigue bajando. */
  const armado = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.IntersectionObserver !== 'function') return undefined;
    const observer = new window.IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) {
          armado.current = true;
          return;
        }
        const {nextPageUrl: url, state: estado, isLoading: cargando} = ultimo.current;
        if (!armado.current || cargando || !url) return;
        armado.current = false;
        navigate(url, {replace: true, preventScrollReset: true, state: estado});
      },
      {rootMargin: ANTICIPO},
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [navigate]);

  return <div ref={ref} className="auto-load-sentinel" aria-hidden="true" />;
}
