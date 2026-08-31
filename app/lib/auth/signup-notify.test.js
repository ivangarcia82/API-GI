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

  it('links to the customer in the Shopify admin', async () => {
    await notifyAdvisorOfSignup(env, {user}, deps());

    expect(sentMessage().html).toContain(
      'https://admin.shopify.com/store/development-gi/customers/123',
    );
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

describe('notifyAdvisorOfSignup · copia al líder del asesor reclamado', () => {
  function correrCon({advisorHandle, correoAsesor, managerFor}) {
    const send = vi.fn().mockResolvedValue({});
    return notifyAdvisorOfSignup(
      {},
      {user: {email: 'ana@acme.mx', shopifyCustomerGid: null, advisorHandle, esCliente: 'si'}},
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        getAdvisorByHandle: async (_env, handle) =>
          handle === advisorHandle
            ? {correo: correoAsesor, nombre: 'Laura Vega'}
            : {correo: 'marketing@generandoideas.com', nombre: 'Marketing'},
        managerFor,
        sendEmail: send,
      },
    ).then(() => send);
  }

  it('copia al líder del ejecutivo que la persona dijo tener', async () => {
    const send = await correrCon({
      advisorHandle: 'laura-vega',
      correoAsesor: 'lvega@generandoideas.com',
      managerFor: (correo) =>
        correo === 'lvega@generandoideas.com' ? 'sjimenez@generandoideas.com' : null,
    });
    expect(send.mock.calls[0][1].cc).toBe('sjimenez@generandoideas.com');
  });

  it('no copia a nadie cuando el ejecutivo reclamado no tiene líder en la matriz', async () => {
    const send = await correrCon({
      advisorHandle: 'laura-vega',
      correoAsesor: 'lvega@generandoideas.com',
      managerFor: () => null,
    });
    expect('cc' in send.mock.calls[0][1]).toBe(false);
  });

  it('no busca líder cuando no hubo reclamo de asesor', async () => {
    const managerFor = vi.fn().mockReturnValue('sjimenez@generandoideas.com');
    const send = await correrCon({
      advisorHandle: null,
      correoAsesor: null,
      managerFor,
    });
    expect(managerFor).not.toHaveBeenCalled();
    expect('cc' in send.mock.calls[0][1]).toBe(false);
  });

  it('no se copia a sí mismo si el líder es el propio destinatario', async () => {
    // Evita un correo con el mismo buzón en Para y en CC.
    const send = await correrCon({
      advisorHandle: 'laura-vega',
      correoAsesor: 'lvega@generandoideas.com',
      managerFor: () => 'marketing@generandoideas.com',
    });
    expect('cc' in send.mock.calls[0][1]).toBe(false);
  });
});
