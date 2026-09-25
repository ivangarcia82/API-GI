import {describe, it, expect} from 'vitest';
import {isCollaboratorEmail, COLLABORATOR_DOMAIN} from './collaborator.js';

describe('isCollaboratorEmail', () => {
  it('acepta el dominio corporativo', () => {
    expect(COLLABORATOR_DOMAIN).toBe('generandoideas.com');
    expect(isCollaboratorEmail('igarcia@generandoideas.com')).toBe(true);
  });

  it('ignora mayúsculas y espacios', () => {
    expect(isCollaboratorEmail('  IGarcia@GenerandoIdeas.com ')).toBe(true);
  });

  it('rechaza otros dominios, subdominios y parecidos', () => {
    expect(isCollaboratorEmail('ana@empresa.mx')).toBe(false);
    expect(isCollaboratorEmail('ana@mail.generandoideas.com')).toBe(false);
    expect(isCollaboratorEmail('ana@generandoideas.com.mx')).toBe(false);
    expect(isCollaboratorEmail('ana@xgenerandoideas.com')).toBe(false);
    expect(isCollaboratorEmail('x@evil.com@generandoideas.com')).toBe(false);
  });

  it('rechaza vacíos', () => {
    expect(isCollaboratorEmail('')).toBe(false);
    expect(isCollaboratorEmail(null)).toBe(false);
    expect(isCollaboratorEmail(undefined)).toBe(false);
    expect(isCollaboratorEmail('@generandoideas.com')).toBe(false);
  });
});
