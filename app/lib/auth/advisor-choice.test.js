import {describe, it, expect} from 'vitest';
import {MARKETING_HANDLE, UNKNOWN_ADVISOR, claimedAdvisorHandle} from './advisor-choice.js';

describe('claimedAdvisorHandle', () => {
  it('devuelve el handle cuando un cliente existente señala a alguien', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: 'ailine-gamboa'})).toBe(
      'ailine-gamboa',
    );
  });

  it('devuelve null cuando el cliente no conoce a su asesor', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: UNKNOWN_ADVISOR})).toBeNull();
  });

  it('devuelve null cuando el cliente deja el select vacío', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: ''})).toBeNull();
  });

  it('devuelve null cuando la persona todavía no es cliente', () => {
    expect(claimedAdvisorHandle({esCliente: 'no', advisor: 'ailine-gamboa'})).toBeNull();
  });

  it('devuelve null cuando la pregunta nunca se respondió', () => {
    expect(claimedAdvisorHandle({})).toBeNull();
  });

  it('nunca devuelve marketing como un reclamo del usuario', () => {
    // marketing es el entry de respaldo y jamás se ofrece en el select; que
    // llegue en el POST significa formulario manipulado, no una elección.
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: MARKETING_HANDLE})).toBeNull();
  });

  it('recorta espacios del handle recibido', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: '  laura-vega  '})).toBe(
      'laura-vega',
    );
  });
});
