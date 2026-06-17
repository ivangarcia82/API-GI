// Server-only. Transactional email via Resend HTTP API (edge-safe fetch).
// Loud no-op stub when RESEND_API_KEY is absent (mirrors the Admin stub).
const RESEND_URL = 'https://api.resend.com/emails';

/**
 * @param {Record<string, any>} env
 * @returns {boolean} true when no RESEND_API_KEY -> stub mode
 */
export function isEmailStubMode(env) {
  return !(env && env.RESEND_API_KEY);
}

/**
 * Send an email. Returns {stub:boolean, id:string|null}.
 * @param {Record<string, any>} env
 * @param {{to: string, subject: string, html: string}} msg
 * @returns {Promise<{stub: boolean, id: string|null}>}
 */
export async function sendEmail(env, {to, subject, html, replyTo}) {
  if (isEmailStubMode(env)) {
    console.warn(
      '[email][STUB] sendEmail invoked (no RESEND_API_KEY). ' +
        `to=${to} subject=${JSON.stringify(subject)} — email NOT sent.`,
    );
    return {stub: true, id: null};
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(replyTo ? {reply_to: replyTo} : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Resend API error (status ${res.status}): ${json && json.message ? json.message : 'unknown'}`,
    );
  }
  return {stub: false, id: json.id ?? null};
}
