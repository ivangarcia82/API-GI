import {describe, it, expect, vi} from 'vitest';
import {resolveAdvisorRecipient, notifyQuoteSubmitted} from './notify.js';

describe('resolveAdvisorRecipient', () => {
  it('uses the advisor email when the customer has one assigned', () => {
    expect(resolveAdvisorRecipient('maria@generandoideas.com', {})).toBe(
      'maria@generandoideas.com',
    );
  });

  it('falls back to ventas@generandoideas.com when there is no advisor', () => {
    expect(resolveAdvisorRecipient(null, {})).toBe('ventas@generandoideas.com');
  });

  it('prefers SALES_EMAIL over the hardcoded default when no advisor', () => {
    expect(resolveAdvisorRecipient(null, {SALES_EMAIL: 'otro@generandoideas.com'})).toBe(
      'otro@generandoideas.com',
    );
  });

  it('treats a blank advisor email as no advisor', () => {
    expect(resolveAdvisorRecipient('   ', {})).toBe('ventas@generandoideas.com');
  });
});

const QUOTE = {id: 'q-123', notes: 'Entrega urgente', deadline: null};
const USER = {
  email: 'cliente@empresa.mx',
  firstName: 'Juan',
  lastName: 'Pérez',
  company: 'Empresa SA',
};
const ITEMS = [
  {title: 'Taza clásica', qty: 300, technique: 'SERIGRAFÍA', size: '4 x 4', effectiveUnitPrice: 29.97},
];

function args(overrides = {}) {
  return {
    quote: QUOTE,
    user: USER,
    items: ITEMS,
    invoiceUrl: 'https://shop/invoice/1',
    customerGid: 'gid://shopify/Customer/1',
    origin: 'https://generandoideas.com',
    ...overrides,
  };
}

function depsWith(advisorResult, sendEmail = vi.fn(async () => ({stub: false, id: 'e1'}))) {
  return {
    getCustomerAdvisor: vi.fn(async () => advisorResult),
    sendEmail,
  };
}

describe('notifyQuoteSubmitted', () => {
  it('emails both the advisor and the buyer', async () => {
    const deps = depsWith({email: 'maria@generandoideas.com'});
    const result = await notifyQuoteSubmitted({}, args(), deps);

    expect(deps.sendEmail).toHaveBeenCalledTimes(2);
    const recipients = deps.sendEmail.mock.calls.map((c) => c[1].to);
    expect(recipients).toContain('maria@generandoideas.com');
    expect(recipients).toContain('cliente@empresa.mx');
    expect(result.advisorSent).toBe(true);
    expect(result.customerSent).toBe(true);
  });

  it('routes the internal copy to ventas@ when the customer has no advisor', async () => {
    const deps = depsWith({email: null});
    const result = await notifyQuoteSubmitted({}, args(), deps);

    expect(result.advisorTo).toBe('ventas@generandoideas.com');
    const recipients = deps.sendEmail.mock.calls.map((c) => c[1].to);
    expect(recipients).toContain('ventas@generandoideas.com');
  });

  it('still notifies ventas@ when the advisor lookup throws', async () => {
    const deps = depsWith(null);
    deps.getCustomerAdvisor = vi.fn(async () => {
      throw new Error('Shopify down');
    });

    const result = await notifyQuoteSubmitted({}, args(), deps);

    expect(result.advisorTo).toBe('ventas@generandoideas.com');
    expect(result.advisorSent).toBe(true);
    expect(result.customerSent).toBe(true);
  });

  it('sets the buyer reply-to to whoever received the internal copy', async () => {
    const deps = depsWith({email: 'maria@generandoideas.com'});
    await notifyQuoteSubmitted({}, args(), deps);

    const customerMsg = deps.sendEmail.mock.calls.find(
      (c) => c[1].to === 'cliente@empresa.mx',
    )[1];
    expect(customerMsg.replyTo).toBe('maria@generandoideas.com');
  });

  it('links the buyer to the quote on their account', async () => {
    const deps = depsWith({email: 'maria@generandoideas.com'});
    await notifyQuoteSubmitted({}, args(), deps);

    const customerMsg = deps.sendEmail.mock.calls.find(
      (c) => c[1].to === 'cliente@empresa.mx',
    )[1];
    expect(customerMsg.html).toContain('https://generandoideas.com/account/cotizaciones/q-123');
  });

  it('never leaks the Shopify invoice url to the buyer', async () => {
    const deps = depsWith({email: 'maria@generandoideas.com'});
    await notifyQuoteSubmitted({}, args(), deps);

    const customerMsg = deps.sendEmail.mock.calls.find(
      (c) => c[1].to === 'cliente@empresa.mx',
    )[1];
    expect(customerMsg.html).not.toContain('https://shop/invoice/1');
  });

  it('still emails the buyer when the advisor email fails', async () => {
    const sendEmail = vi.fn(async (_env, msg) => {
      if (msg.to === 'maria@generandoideas.com') throw new Error('Resend 422');
      return {stub: false, id: 'e1'};
    });
    const deps = depsWith({email: 'maria@generandoideas.com'}, sendEmail);

    const result = await notifyQuoteSubmitted({}, args(), deps);

    expect(result.advisorSent).toBe(false);
    expect(result.customerSent).toBe(true);
  });

  it('still emails the advisor when the buyer email fails', async () => {
    const sendEmail = vi.fn(async (_env, msg) => {
      if (msg.to === 'cliente@empresa.mx') throw new Error('Resend 422');
      return {stub: false, id: 'e1'};
    });
    const deps = depsWith({email: 'maria@generandoideas.com'}, sendEmail);

    const result = await notifyQuoteSubmitted({}, args(), deps);

    expect(result.advisorSent).toBe(true);
    expect(result.customerSent).toBe(false);
  });

  it('does not throw when every send fails', async () => {
    const sendEmail = vi.fn(async () => {
      throw new Error('Resend unreachable');
    });
    const deps = depsWith({email: 'maria@generandoideas.com'}, sendEmail);

    await expect(notifyQuoteSubmitted({}, args(), deps)).resolves.toMatchObject({
      advisorSent: false,
      customerSent: false,
    });
  });
});

describe('notifyQuoteSubmitted · copia al manager', () => {
  it('copia al manager cuando el cliente tiene ejecutivo asignado', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => ({email: 'laura@generandoideas.com', fields: {}}),
      managerFor: () => 'antonio@generandoideas.com',
      sendEmail,
    });
    const interno = sendEmail.mock.calls.find(
      ([, msg]) => msg.to === 'laura@generandoideas.com',
    );
    expect(interno[1].cc).toBe('antonio@generandoideas.com');
  });

  it('no copia a nadie cuando el ejecutivo no está en la matriz', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => ({email: 'laura@generandoideas.com', fields: {}}),
      managerFor: () => null,
      sendEmail,
    });
    const interno = sendEmail.mock.calls.find(
      ([, msg]) => msg.to === 'laura@generandoideas.com',
    );
    expect('cc' in interno[1]).toBe(false);
  });

  it('no busca manager cuando la cotización cae en el buzón de ventas', async () => {
    // Sin ejecutivo no hay a quién copiar, aunque ventas@ estuviera en la
    // matriz: el requisito es "si la cotización TIENE ejecutivo".
    const sendEmail = vi.fn().mockResolvedValue({});
    const managerFor = vi.fn().mockReturnValue('nadie@generandoideas.com');
    await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => ({email: null, fields: {}}),
      managerFor,
      sendEmail,
    });
    expect(managerFor).not.toHaveBeenCalled();
    const interno = sendEmail.mock.calls.find(
      ([, msg]) => msg.to === 'ventas@generandoideas.com',
    );
    expect('cc' in interno[1]).toBe(false);
  });
});

describe('notifyQuoteSubmitted · enlace del correo interno', () => {
  it('manda al portal cuando hay ejecutivo asignado', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => ({email: 'lvega@generandoideas.com', fields: {}}),
      managerFor: () => null,
      sendEmail,
    });
    const interno = sendEmail.mock.calls.find(
      ([, m]) => m.to === 'lvega@generandoideas.com',
    );
    expect(interno[1].html).toContain('/asesor/cotizaciones/q-123');
    expect(interno[1].html).not.toContain('shop/invoice');
  });

  it('conserva el enlace de Shopify cuando cae en el buzón general', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => ({email: null, fields: {}}),
      managerFor: () => null,
      sendEmail,
    });
    const interno = sendEmail.mock.calls.find(
      ([, m]) => m.to === 'ventas@generandoideas.com',
    );
    expect(interno[1].html).toContain('shop/invoice');
    expect(interno[1].html).not.toContain('/asesor/cotizaciones/');
  });
});

describe('notifyQuoteSubmitted · el buzón de marketing no es un ejecutivo', () => {
  // El entry `marketing` es el respaldo del metaobject, no una persona: no
  // tiene cuenta en el portal, así que mandarle el enlace da 404.
  const comoMarketing = {
    email: 'marketing@generandoideas.com',
    handle: 'marketing',
    fields: {},
  };

  it('no enlaza al portal cuando el asesor es el entry de marketing', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => comoMarketing,
      managerFor: () => null,
      sendEmail,
    });
    const interno = sendEmail.mock.calls.find(
      ([, m]) => m.to === 'marketing@generandoideas.com',
    );
    expect(interno[1].html).not.toContain('/asesor/cotizaciones/');
    expect(interno[1].html).toContain('shop/invoice');
  });

  it('el correo sigue llegando a marketing: es el destinatario correcto', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    const res = await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => comoMarketing,
      managerFor: () => null,
      sendEmail,
    });
    expect(res.advisorTo).toBe('marketing@generandoideas.com');
  });

  it('sí enlaza al portal con un ejecutivo de verdad', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted({}, args(), {
      getCustomerAdvisor: async () => ({
        email: 'lvega@generandoideas.com',
        handle: 'laura-vega',
        fields: {},
      }),
      managerFor: () => null,
      sendEmail,
    });
    const interno = sendEmail.mock.calls.find(
      ([, m]) => m.to === 'lvega@generandoideas.com',
    );
    expect(interno[1].html).toContain('/asesor/cotizaciones/q-123');
  });
});
