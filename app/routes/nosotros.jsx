import {StubScreen} from '~/components/gi/Content';

export const meta = () => [{title: 'Nosotros · Generando Ideas'}];

export default function Nosotros() {
  return (
    <StubScreen
      title="Quiénes somos"
      label="// Conócenos · /nosotros"
      desc="Empresa 100% mexicana líder en la industria promocional desde 2013."
      items={[
        {t: 'Misión', d: 'Crear soluciones promocionales que generen impacto y memoria de marca.'},
        {t: 'Visión', d: 'Ser el aliado estratégico de las marcas que valoran calidad, diseño y propósito.'},
        {t: 'Valores', d: 'Calidad sin concesiones · Tiempo de respuesta · Innovación constante · Responsabilidad social.'},
        {t: 'Cobertura', d: 'Operaciones en CDMX, Yucatán, Sonora y Baja California Sur con alcance nacional.'},
      ]}
    />
  );
}
