import {describe, it, expect} from 'vitest';
import * as roles from './roles.js';

describe('roles', () => {
  it('define los dos roles que el código distingue', () => {
    expect(roles.BUYER_ROLE).toBe('quoter');
    expect(roles.ADVISOR_ROLE).toBe('asesor');
  });

  it('no expone nada más: es el contrato entre rutas y scripts', () => {
    expect(Object.keys(roles).sort()).toEqual(['ADVISOR_ROLE', 'BUYER_ROLE']);
  });
});
