import {useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {useApp} from '~/lib/AppContext';

export default function AccountFavoritos() {
  const navigate = useNavigate();
  const {favs} = useApp();

  return (
    <>
      <h1>Favoritos</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Productos que guardaste para revisar o cotizar más tarde.
      </p>

      {favs.length === 0 ? (
        <div className="empty">
          <Icon name="heart_outline" size={32} className="muted-2" />
          <h3>Aún no tienes favoritos</h3>
          <p>Marca el corazón en cualquier producto para guardarlo aquí.</p>
          <Button variant="accent" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
            Explorar catálogo
          </Button>
        </div>
      ) : (
        <div
          style={{
            padding: 20,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          <p style={{margin: 0, fontSize: 15}}>
            Tienes <strong>{favs.length}</strong>{' '}
            {favs.length === 1 ? 'producto guardado' : 'productos guardados'}. Búscalos en el
            catálogo para añadirlos a tu carrito o cotización.
          </p>
          <div style={{marginTop: 16}}>
            <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
              Ir al catálogo
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
