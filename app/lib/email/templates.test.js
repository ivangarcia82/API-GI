import {describe, it, expect} from 'vitest';
import {verifyEmailTemplate, resetPasswordTemplate} from './templates.js';

describe('email/templates', () => {
  it('verify template embeds the link and returns subject + html', () => {
    const t = verifyEmailTemplate('https://gi.com/auth/verify?token=abc');
    expect(t.subject).toMatch(/verifica/i);
    expect(t.html).toContain('https://gi.com/auth/verify?token=abc');
  });

  it('reset template embeds the link and returns subject + html', () => {
    const t = resetPasswordTemplate('https://gi.com/auth/reset?token=xyz');
    expect(t.subject).toMatch(/contrase/i);
    expect(t.html).toContain('https://gi.com/auth/reset?token=xyz');
  });

  it('escapes the URL so it cannot break out of the href attribute', () => {
    const t = resetPasswordTemplate('https://gi.com/auth/reset?token=a"b<c');
    expect(t.html).not.toContain('a"b<c');
    expect(t.html).toContain('a&quot;b&lt;c');
  });
});

describe('email/templates · marca', () => {
  it('verificación y restablecer contraseña usan el diseño de la marca', async () => {
    const {LOGO_PATH} = await import('./layout.js');
    for (const t of [
      verifyEmailTemplate('https://generandoideas.com/auth/verify?token=abc'),
      resetPasswordTemplate('https://generandoideas.com/auth/reset?token=xyz'),
    ]) {
      expect(t.html).toContain(LOGO_PATH);
      expect(t.html).toContain('YOUR ONE STOP SOLUTION');
      expect(t.html).toMatch(/background-color:#ff8300/);
    }
  });
});
