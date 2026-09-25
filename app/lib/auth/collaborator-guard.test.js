import {describe, it, expect, vi, beforeEach} from 'vitest';

const getSessionUser = vi.fn();
const requireUser = vi.fn();
const findById = vi.fn();

vi.mock('~/lib/auth/session', () => ({getSessionUser: (...a) => getSessionUser(...a)}));
vi.mock('~/lib/auth/guard', () => ({requireUser: (...a) => requireUser(...a)}));
vi.mock('~/lib/auth/users', () => ({findById: (...a) => findById(...a)}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));

import {loadCollaborator} from './collaborator-guard.js';

const context = {env: {}, session: {}};
const PATH = '/campana-mochilas';
const LOGIN = '/login?redirectTo=%2Fcampana-mochilas';

async function thrown(p) {
  try {
    await p;
  } catch (err) {
    return err;
  }
  throw new Error('esperaba que lanzara');
}

beforeEach(() => {
  getSessionUser.mockReset().mockReturnValue({userId: 'u1', sessionVersion: 1});
  requireUser.mockReset().mockResolvedValue({userId: 'u1', sessionVersion: 1});
  findById.mockReset().mockResolvedValue({id: 'u1', email: 'ana@generandoideas.com'});
});

describe('loadCollaborator', () => {
  it('sin sesión manda a login con regreso a la página', async () => {
    getSessionUser.mockReturnValue(null);
    const res = await thrown(loadCollaborator(context, PATH));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(LOGIN);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('sesión caducada también regresa a la página, no a /login pelón', async () => {
    requireUser.mockRejectedValue(new Response(null, {status: 302, headers: {Location: '/login'}}));
    const res = await thrown(loadCollaborator(context, PATH));
    expect(res.headers.get('Location')).toBe(LOGIN);
  });

  it('usuario borrado manda a login', async () => {
    findById.mockResolvedValue(null);
    const res = await thrown(loadCollaborator(context, PATH));
    expect(res.headers.get('Location')).toBe(LOGIN);
  });

  it('propaga errores que no son redirect', async () => {
    requireUser.mockRejectedValue(new Error('db caída'));
    const err = await thrown(loadCollaborator(context, PATH));
    expect(err.message).toBe('db caída');
  });

  it('colaborador: allowed true', async () => {
    const r = await loadCollaborator(context, PATH);
    expect(r).toEqual({user: {id: 'u1', email: 'ana@generandoideas.com'}, allowed: true});
  });

  it('otro dominio: allowed false', async () => {
    findById.mockResolvedValue({id: 'u1', email: 'ana@empresa.mx'});
    const r = await loadCollaborator(context, PATH);
    expect(r.allowed).toBe(false);
  });
});
