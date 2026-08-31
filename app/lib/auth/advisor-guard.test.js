import {describe, it, expect, vi, beforeEach} from 'vitest';

const requireUser = vi.fn();
const findById = vi.fn();

vi.mock('./guard.js', () => ({requireUser: (...a) => requireUser(...a)}));
vi.mock('~/lib/db/client.js', () => ({getDb: () => ({__db: true})}));
vi.mock('./users.js', () => ({findById: (...a) => findById(...a)}));

import {ADVISOR_ROLE} from './roles.js';
import {requireAdvisor} from './advisor-guard.js';

const context = {env: {}};

beforeEach(() => {
  requireUser.mockReset();
  findById.mockReset();
});

describe('requireAdvisor', () => {
  it('devuelve el usuario cuando tiene rol de asesor', async () => {
    requireUser.mockResolvedValue({userId: 'a1', role: ADVISOR_ROLE});
    findById.mockResolvedValue({id: 'a1', email: 'LVega@GI.com', role: ADVISOR_ROLE});

    const asesor = await requireAdvisor(context);

    expect(asesor.id).toBe('a1');
    // El correo se normaliza: es la llave contra quotes.advisor_email.
    expect(asesor.email).toBe('lvega@gi.com');
  });

  it('rechaza con 404 a un comprador', async () => {
    // 404 y no 403: un comprador no debe ni enterarse de que el portal existe.
    requireUser.mockResolvedValue({userId: 'u1', role: 'quoter'});
    findById.mockResolvedValue({id: 'u1', email: 'ana@acme.mx', role: 'quoter'});

    await expect(requireAdvisor(context)).rejects.toMatchObject({status: 404});
  });

  it('rechaza si el rol de la sesión ya no coincide con el de la base', async () => {
    // Una sesión vieja con rol 'asesor' no puede dar acceso si se le revocó.
    requireUser.mockResolvedValue({userId: 'a1', role: ADVISOR_ROLE});
    findById.mockResolvedValue({id: 'a1', email: 'lvega@gi.com', role: 'quoter'});

    await expect(requireAdvisor(context)).rejects.toMatchObject({status: 404});
  });

  it('rechaza si el usuario ya no existe', async () => {
    requireUser.mockResolvedValue({userId: 'a1', role: ADVISOR_ROLE});
    findById.mockResolvedValue(null);

    await expect(requireAdvisor(context)).rejects.toMatchObject({status: 404});
  });

  it('deja pasar el redirect a login de requireUser', async () => {
    requireUser.mockRejectedValue(new Response(null, {status: 302}));
    await expect(requireAdvisor(context)).rejects.toMatchObject({status: 302});
  });
});
