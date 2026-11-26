import {redirect} from 'react-router';
import {FAQ_PATH} from '~/lib/faq';

/* /pages/preguntas-frecuentes era una página de Shopify sin contenido (sólo el
   título). Las preguntas frecuentes viven ahora en /preguntas-frecuentes, con
   las demás páginas de la empresa; la dirección vieja se manda ahí de forma
   permanente para no dejar dos páginas con el mismo nombre. */
export async function loader() {
  return redirect(FAQ_PATH, 301);
}
