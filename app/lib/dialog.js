/* Generando Ideas — comportamiento compartido de los cajones modales.
 *
 * Un cajón que se abre encima de la página tiene tres obligaciones que no se
 * ven en el diseño y que es fácil implementar a medias: el fondo no puede
 * seguir desplazándose debajo (en móvil el dedo arrastra la página, no la
 * lista de filtros), Escape tiene que cerrarlo, y el foco tiene que entrar al
 * panel y volver a quien lo abrió. Vive aquí porque la cotización, los filtros
 * y el orden del catálogo lo necesitan igual, y tres copias divergen.
 */
import {useEffect} from 'react';

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * @param {object} opts
 * @param {boolean} opts.open        si el cajón está visible
 * @param {() => void} opts.onClose  se llama al pulsar Escape
 * @param {{current: HTMLElement|null}} opts.panelRef  el panel que recibe el foco
 */
export function useDialogBehavior({open, onClose, panelRef}) {
  /* Se guarda el valor anterior en vez de asumir '': con un cajón abierto
     sobre otro (orden encima de filtros), restaurar a vacío desbloquearía el
     fondo mientras el de abajo sigue abierto. */
  useEffect(() => {
    if (typeof document === 'undefined' || !open) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const alPulsar = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;

    // Quién tenía el foco antes de abrir: ahí vuelve al cerrar.
    const disparador = document.activeElement;
    /* La lista se recalcula en cada Tab y no se cachea: dentro del panel hay
       grupos plegables y un "ver más", así que el primero y el último cambian
       mientras el cajón sigue abierto. */
    const enfocables = () => Array.from(panel.querySelectorAll(ENFOCABLES));
    enfocables()[0]?.focus();

    const alTabular = (e) => {
      if (e.key !== 'Tab') return;
      const items = enfocables();
      if (items.length === 0) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    panel.addEventListener('keydown', alTabular);
    return () => {
      panel.removeEventListener('keydown', alTabular);
      /* Safari (iOS incluido) no enfoca un <button> al tocarlo, así que aquí
         `disparador` suele ser el <body>: devolverle el foco reiniciaría el
         orden de tabulación al principio del documento en vez de dejarlo
         donde estaba. Mejor no tocar el foco que empeorarlo. */
      if (disparador && disparador !== document.body && disparador.isConnected) {
        disparador.focus?.();
      }
    };
  }, [open, panelRef]);
}
