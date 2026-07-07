import {describe, it, expect} from 'vitest';
import {validateContact, buildContactEmail} from '~/lib/contact';

const valid = {
  name: 'Ana', company: 'ACME', role: 'Marketing', email: 'ana@acme.com',
  phone: '5555555555', service: 'Promocionales', source: 'Internet',
  message: 'Necesito 500 termos personalizados para un evento.',
};

describe('validateContact', () => {
  it('passes a fully valid payload', () => {
    expect(validateContact(valid)).toEqual({});
  });
  it('flags missing and malformed fields', () => {
    const e = validateContact({...valid, email: 'nope', message: 'corto'});
    expect(e.email).toBeTruthy();
    expect(e.message).toBeTruthy();
  });
  it('requires all mandatory fields', () => {
    const e = validateContact({});
    ['name', 'company', 'role', 'email', 'phone', 'service', 'source', 'message']
      .forEach((f) => expect(e[f]).toBeTruthy());
  });
});

describe('buildContactEmail', () => {
  it('builds subject/html/text and escapes html', () => {
    const {subject, html, text} = buildContactEmail({...valid, name: '<b>Ana</b>'});
    expect(subject).toContain('ACME');
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(text).toContain('Necesito 500 termos');
  });
});
