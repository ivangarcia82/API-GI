import {StubScreen} from '~/components/gi/Content';

export const meta = () => [{title: 'Servicios · Generando Ideas'}];

export default function Servicios() {
  return (
    <StubScreen
      title="Servicios"
      label="// Servicios · /servicios"
      desc="Promocionales · Fulfillment · Proyectos especiales · Talleres de personalizado · Fabricación textil & talabartería."
      items={[
        {t: 'Promocionales', d: 'Catálogo de 1,800+ productos personalizables con producción 8-15 días.'},
        {t: 'Fulfillment', d: 'Almacenaje, kitting y envíos individuales con tu identidad de marca.'},
        {t: 'Proyectos especiales', d: 'Producción a medida: empaques, displays, materiales POP corporativos.'},
        {t: 'Talleres de personalizado', d: 'Activaciones en vivo: serigrafía, grabado y bordado on-site para tus eventos.'},
        {t: 'Textil & Talabartería', d: 'Fabricación nacional de uniformes, accesorios de piel y artículos corporativos.'},
        {t: 'Diseño creativo', d: 'Dummies digitales y propuestas visuales sin costo para clientes registrados.'},
      ]}
    />
  );
}
