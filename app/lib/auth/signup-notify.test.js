import {describe, it, expect, vi, beforeEach} from 'vitest';
import {notifyAdvisorOfSignup} from './signup-notify.js';

const env = {
  PRIVATE_ADMIN_API_TOKEN: 't',
  PUBLIC_STORE_DOMAIN: 'development-gi.myshopify.com',
};

const user = {
  id: 'u1',
  email: 'mariana@empresa.mx',
  firstName: 'Mariana',
  lastName: 'Ruiz',
  company: 'Acme Corp',
  phone: '55 1234 5678',
  shopifyCustomerGid: 'gid://shopify/Customer/123',
};

let getCustomerAdvisor;
let getAdvisorByHandle;
let sendEmail;

function deps(over = {}) {
  return {getCustomerAdvisor, getAdvisorByHandle, sendEmail, ...over};
}

/** The message handed to sendEmail on the first call. */
function sentMessage() {
  return sendEmail.mock.calls[0][1];
}

beforeEach(() => {
  getCustomerAdvisor = vi.fn().mockResolvedValue({
    email: 'agamboa@generandoideas.com',
    fields: {nombre: 'Ailine Gamboa', correo: 'agamboa@generandoideas.com'},
  });
  getAdvisorByHandle = vi.fn().mockResolvedValue({
    gid: 'gid://shopify/Metaobject/194049835311',
    handle: 'marketing',
    nombre: 'Marketing',
    puesto: 'Marketing',
    correo: 'marketing@generandoideas.com',
  });
  sendEmail = vi.fn().mockResolvedValue({stub: false, id: 'e1'});
});

describe('notifyAdvisorOfSignup', () => {
  it('emails the advisor assigned to the customer', async () => {
    const out = await notifyAdvisorOfSignup(env, {user}, deps());

    expect(out).toEqual({sent: true, to: 'agamboa@generandoideas.com'});
    expect(sentMessage().to).toBe('agamboa@generandoideas.com');
    expect(getAdvisorByHandle).not.toHaveBeenCalled();
  });

  it('greets the advisor by name and names the new customer', async () => {
    await notifyAdvisorOfSignup(env, {user}, deps());

    const {subject, html} = sentMessage();
    expect(subject).toBe('Nuevo registro — Mariana Ruiz');
    expect(html).toContain('Hola Ailine Gamboa');
  });


  it('falls back to marketing when the customer has no advisor', async () => {
    getCustomerAdvisor.mockResolvedValue({email: null, fields: {}});

    const out = await notifyAdvisorOfSignup(env, {user}, deps());

    expect(getAdvisorByHandle).toHaveBeenCalledWith(env, 'marketing');
    expect(out).toEqual({sent: true, to: 'marketing@generandoideas.com'});
  });

  it('falls back to marketing when the advisor lookup blows up', async () => {
    getCustomerAdvisor.mockRejectedValue(new Error('admin down'));

    const out = await notifyAdvisorOfSignup(env, {user}, deps());

    expect(out).toEqual({sent: true, to: 'marketing@generandoideas.com'});
  });

  it('falls back to marketing when the signup never linked a Shopify customer', async () => {
    const out = await notifyAdvisorOfSignup(
      env,
      {user: {...user, shopifyCustomerGid: null}},
      deps(),
    );

    expect(out.to).toBe('marketing@generandoideas.com');
    // Sin customer no hay a quién enlazar en el admin.
    expect(sentMessage().html).not.toContain('Ver cliente en Shopify');
  });

  it('sends nothing when neither the advisor nor marketing resolve', async () => {
    getCustomerAdvisor.mockResolvedValue({email: null, fields: {}});
    getAdvisorByHandle.mockResolvedValue(null);

    const out = await notifyAdvisorOfSignup(env, {user}, deps());

    expect(out).toEqual({sent: false, to: null});
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('never throws when the email fails to send', async () => {
    sendEmail.mockRejectedValue(new Error('resend down'));

    const out = await notifyAdvisorOfSignup(env, {user}, deps());

    expect(out).toEqual({sent: false, to: 'agamboa@generandoideas.com'});
  });

  it('never throws when the marketing fallback itself blows up', async () => {
    getCustomerAdvisor.mockResolvedValue({email: null, fields: {}});
    getAdvisorByHandle.mockRejectedValue(new Error('metaobject down'));

    const out = await notifyAdvisorOfSignup(env, {user}, deps());

    expect(out).toEqual({sent: false, to: null});
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyAdvisorOfSignup · reclamo', () => {
  it('resuelve el handle reclamado a un nombre para el correo', async () => {
    const send = vi.fn().mockResolvedValue({});
    await notifyAdvisorOfSignup(
      {},
      {
        user: {
          email: 'ana@acme.mx',
          shopifyCustomerGid: null,
          advisorHandle: 'laura-vega',
          esCliente: 'si',
        },
      },
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        getAdvisorByHandle: async (_env, handle) =>
          handle === 'laura-vega'
            ? {correo: 'laura@gi.com', nombre: 'Laura Vega'}
            : {correo: 'marketing@gi.com', nombre: 'Marketing'},
        sendEmail: send,
      },
    );
    expect(send.mock.calls[0][1].html).toContain('Laura Vega');
  });

  it('cae al handle crudo si no se puede resolver el nombre', async () => {
    const send = vi.fn().mockResolvedValue({});
    await notifyAdvisorOfSignup(
      {},
      {
        user: {
          email: 'ana@acme.mx',
          shopifyCustomerGid: null,
          advisorHandle: 'laura-vega',
          esCliente: 'si',
        },
      },
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        getAdvisorByHandle: async (_env, handle) =>
          handle === 'laura-vega' ? null : {correo: 'marketing@gi.com', nombre: 'Marketing'},
        sendEmail: send,
      },
    );
    expect(send.mock.calls[0][1].html).toContain('laura-vega');
  });
});

describe('notifyAdvisorOfSignup · sin reclamo no hay copias', () => {
  it('no busca líder ni copia a nadie cuando no se señaló ejecutivo', async () => {
    const send = vi.fn().mockResolvedValue({});
    const managerFor = vi.fn().mockReturnValue('sjimenez@generandoideas.com');
    await notifyAdvisorOfSignup(
      {},
      {user: {email: 'ana@acme.mx', shopifyCustomerGid: null, advisorHandle: null}},
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        getAdvisorByHandle: async () => ({correo: 'marketing@gi.com', nombre: 'Marketing'}),
        managerFor,
        sendEmail: send,
      },
    );
    expect(managerFor).not.toHaveBeenCalled();
    expect('cc' in send.mock.calls[0][1]).toBe(false);
  });
});

describe('notifyAdvisorOfSignup · copia al ejecutivo reclamado', () => {
  function correr({managerFor = () => null} = {}) {
    const send = vi.fn().mockResolvedValue({});
    return notifyAdvisorOfSignup(
      {},
      {
        user: {
          email: 'ana@acme.mx',
          shopifyCustomerGid: null,
          advisorHandle: 'laura-vega',
          esCliente: 'si',
        },
      },
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        getAdvisorByHandle: async (_e, h) =>
          h === 'laura-vega'
            ? {correo: 'lvega@generandoideas.com', nombre: 'Laura Vega'}
            : {correo: 'marketing@generandoideas.com', nombre: 'Marketing'},
        managerFor,
        sendEmail: send,
      },
    ).then(() => send);
  }

  it('copia al ejecutivo y a su líder', async () => {
    const send = await correr({managerFor: () => 'sjimenez@generandoideas.com'});
    expect(send.mock.calls[0][1].cc).toEqual([
      'lvega@generandoideas.com',
      'sjimenez@generandoideas.com',
    ]);
  });

  it('copia sólo al ejecutivo cuando no tiene líder en la matriz', async () => {
    const send = await correr();
    expect(send.mock.calls[0][1].cc).toEqual(['lvega@generandoideas.com']);
  });

  it('no repite una dirección que ya es el destinatario', async () => {
    const send = await correr({managerFor: () => 'marketing@generandoideas.com'});
    expect(send.mock.calls[0][1].cc).toEqual(['lvega@generandoideas.com']);
  });

  it('no duplica si el líder es el propio ejecutivo', async () => {
    const send = await correr({managerFor: () => 'lvega@generandoideas.com'});
    expect(send.mock.calls[0][1].cc).toEqual(['lvega@generandoideas.com']);
  });
});
