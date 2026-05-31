import {useLoaderData, data, useNavigate} from 'react-router';
import {CartForm, Money, Image} from '@shopify/hydrogen';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: `Carrito · Generando Ideas`}];
};

/**
 * @type {HeadersFunction}
 */
export const headers = ({actionHeaders}) => actionHeaders;

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = formDiscountCode ? [formDiscountCode] : [];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesAdd: {
      const formGiftCardCode = inputs.giftCardCode;

      const giftCardCodes = formGiftCardCode ? [formGiftCardCode] : [];

      result = await cart.addGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesRemove: {
      const appliedGiftCardIds = inputs.giftCardCodes;
      result = await cart.removeGiftCardCodes(appliedGiftCardIds);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    status = 303;
    headers.set('Location', redirectTo);
  }

  return data(
    {
      cart: cartResult,
      errors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {cart} = context;
  return await cart.get();
}

export default function Cart() {
  /** @type {LoaderReturnData} */
  const cart = useLoaderData();
  const navigate = useNavigate();
  const lines = cart?.lines?.nodes || [];

  if (lines.length === 0) {
    return (
      <div className="container" style={{padding: '60px 0 80px'}} data-screen-label="07 Cart empty">
        <div className="empty">
          <Icon name="cart" size={32} className="muted-2" />
          <h3>Tu carrito está vacío</h3>
          <p>Explora el catálogo y añade productos para comprar directamente.</p>
          <Button variant="accent" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
            Explorar catálogo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" data-screen-label="07 Cart">
      <div style={{padding: '32px 0 16px'}}>
        <div className="eyebrow">// Carrito · /carrito</div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(36px, 5vw, 64px)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            margin: '12px 0 8px',
          }}
        >
          Tu carrito · {cart.totalQuantity} pz
        </h1>
        <p style={{color: 'var(--ink-3)', margin: 0}}>
          Revisa tu pedido y procede al pago seguro de Shopify cuando estés listo.
        </p>
      </div>

      <div className="cart-page">
        <div className="cart-list">
          {lines.map((line) => (
            <CartItem key={line.id} line={line} />
          ))}
          <div style={{marginTop: 8}}>
            <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
              Seguir comprando
            </Button>
          </div>
        </div>

        <aside className="cart-summary">
          <h3>Resumen</h3>
          <div className="cart-summary-line">
            <span>Piezas</span>
            <span className="mono">{cart.totalQuantity}</span>
          </div>
          <div className="cart-summary-line">
            <span>Subtotal</span>
            <span className="mono">
              {cart.cost?.subtotalAmount ? <Money data={cart.cost.subtotalAmount} /> : '—'}
            </span>
          </div>
          {cart.cost?.totalTaxAmount && (
            <div className="cart-summary-line">
              <span>Impuestos</span>
              <span className="mono">
                <Money data={cart.cost.totalTaxAmount} />
              </span>
            </div>
          )}
          <div className="cart-summary-line total">
            <span>Total</span>
            <span className="mono">
              {cart.cost?.totalAmount ? <Money data={cart.cost.totalAmount} /> : '—'}
            </span>
          </div>

          {cart.checkoutUrl && (
            <a
              href={cart.checkoutUrl}
              className="btn btn-accent btn-lg"
              style={{width: '100%', justifyContent: 'center', marginTop: 20}}
            >
              Ir al pago <Icon name="arrow_right" size={18} />
            </a>
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 20,
              fontSize: 12,
              color: 'var(--ink-3)',
            }}
          >
            <span style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <Icon name="shield" size={14} className="muted-2" /> Pago seguro Shopify
            </span>
            <span style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <Icon name="receipt" size={14} className="muted-2" /> Facturación CFDI 4.0
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CartItem({line}) {
  const {merchandise, quantity, cost} = line;
  const image = merchandise?.image;
  return (
    <div className="cart-item">
      {image ? (
        <Image data={image} aspectRatio="1/1" sizes="100px" className="gi-img" style={{width: 100, height: 100, borderRadius: 'var(--r-md)'}} />
      ) : (
        <div className="ph ph-square" style={{width: 100, borderRadius: 'var(--r-md)'}} />
      )}
      <div className="cart-item-info">
        <div className="cart-item-meta">{merchandise?.sku || merchandise?.product?.handle}</div>
        <div className="cart-item-name">{merchandise?.product?.title}</div>
        {merchandise?.selectedOptions?.length > 0 && (
          <div style={{display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap'}}>
            {merchandise.selectedOptions
              .filter((o) => o.value !== 'Default Title')
              .map((o) => (
                <span key={o.name} className="tag">
                  {o.name}: {o.value}
                </span>
              ))}
          </div>
        )}
      </div>
      <div className="cart-item-controls">
        <div className="pdp-qty" style={{borderRadius: 999}}>
          <CartLineUpdate lineId={line.id} quantity={Math.max(1, quantity - 1)}>
            <Icon name="minus" size={12} />
          </CartLineUpdate>
          <input value={quantity} readOnly />
          <CartLineUpdate lineId={line.id} quantity={quantity + 1}>
            <Icon name="plus" size={12} />
          </CartLineUpdate>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {cost?.totalAmount ? <Money data={cost.totalAmount} /> : null}
        </div>
        <CartForm
          route="/cart"
          action={CartForm.ACTIONS.LinesRemove}
          inputs={{lineIds: [line.id]}}
        >
          <button
            type="submit"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon name="trash" size={12} /> Quitar
          </button>
        </CartForm>
      </div>
    </div>
  );
}

function CartLineUpdate({lineId, quantity, children}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines: [{id: lineId, quantity}]}}
    >
      <button type="submit">{children}</button>
    </CartForm>
  );
}

/** @typedef {import('react-router').HeadersFunction} HeadersFunction */
/** @typedef {import('./+types/cart').Route} Route */
/** @typedef {import('@shopify/hydrogen').CartQueryDataReturn} CartQueryDataReturn */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
