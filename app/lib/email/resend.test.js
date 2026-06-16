import {describe, it, expect, vi, afterEach} from 'vitest';
import {sendEmail, isEmailStubMode} from './resend.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('email/resend', () => {
  it('is in stub mode when RESEND_API_KEY is absent', () => {
    expect(isEmailStubMode({})).toBe(true);
    expect(isEmailStubMode({RESEND_API_KEY: 'x'})).toBe(false);
  });

  it('stub mode logs and does not call fetch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await sendEmail(
      {EMAIL_FROM: 'GI <no-reply@x.com>'},
      {to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>'},
    );
    expect(res).toEqual({stub: true, id: null});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('posts to the Resend API with bearer auth and EMAIL_FROM', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({id: 'msg_123'}),
    });
    const env = {
      RESEND_API_KEY: 'sk_test',
      EMAIL_FROM: 'Generando Ideas <no-reply@notificaciones.generandoideas.com>',
    };
    const res = await sendEmail(env, {to: 'a@b.com', subject: 'Hola', html: '<p>x</p>'});
    expect(res).toEqual({stub: false, id: 'msg_123'});
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer sk_test');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({
      from: 'Generando Ideas <no-reply@notificaciones.generandoideas.com>',
      to: 'a@b.com',
      subject: 'Hola',
      html: '<p>x</p>',
    });
  });

  it('throws when the Resend API returns a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({message: 'invalid from'}),
    });
    await expect(
      sendEmail({RESEND_API_KEY: 'sk', EMAIL_FROM: 'x'}, {to: 'a@b.com', subject: 's', html: 'h'}),
    ).rejects.toThrow(/Resend API error/);
  });
});
