export function Logo({variant = 'color', className = 'logo'}) {
  const src = variant === 'blanco' ? '/brand/logo-horizontal-blanco.svg' : '/brand/logo-horizontal.svg';
  return <img className={className} src={src} alt="Generando Ideas" width={282} height={63} />;
}
