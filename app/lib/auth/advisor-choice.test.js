import {describe, it, expect} from 'vitest';
import {MARKETING_HANDLE, UNKNOWN_ADVISOR, advisorHandleFromForm} from './advisor-choice.js';

describe('advisorHandleFromForm', () => {
  it('returns the chosen handle when an existing customer picks an advisor', () => {
    expect(advisorHandleFromForm({esCliente: 'si', advisor: 'ailine-gamboa'})).toBe(
      'ailine-gamboa',
    );
  });

  it('falls back to marketing when an existing customer does not know their advisor', () => {
    expect(advisorHandleFromForm({esCliente: 'si', advisor: UNKNOWN_ADVISOR})).toBe(
      MARKETING_HANDLE,
    );
  });

  it('falls back to marketing when an existing customer leaves the select empty', () => {
    expect(advisorHandleFromForm({esCliente: 'si', advisor: ''})).toBe(MARKETING_HANDLE);
  });

  it('falls back to marketing when the user is not a customer yet', () => {
    expect(advisorHandleFromForm({esCliente: 'no', advisor: 'ailine-gamboa'})).toBe(
      MARKETING_HANDLE,
    );
  });

  it('falls back to marketing when the question was never answered', () => {
    expect(advisorHandleFromForm({})).toBe(MARKETING_HANDLE);
  });

  it('never returns marketing as a pickable advisor handle', () => {
    // Guards the select contract: marketing is hidden, so a client posting it
    // explicitly is treated as "no advisor" rather than a real pick.
    expect(advisorHandleFromForm({esCliente: 'si', advisor: MARKETING_HANDLE})).toBe(
      MARKETING_HANDLE,
    );
  });

  it('trims surrounding whitespace from the posted handle', () => {
    expect(advisorHandleFromForm({esCliente: 'si', advisor: '  laura-vega  '})).toBe(
      'laura-vega',
    );
  });
});
