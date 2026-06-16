// Server-only. Best-effort verification email on signup. A failure here must
// NOT fail signup; returns true on success, false on any error. `deps` is
// injectable for unit tests (defaults to the real token/email modules).
import {createToken as realCreateToken} from './tokens.js';
import {sendEmail as realSendEmail} from '../email/resend.js';
import {verifyEmailTemplate} from '../email/templates.js';

/**
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string}} user
 * @param {string} origin  e.g. new URL(request.url).origin
 * @param {{createToken?: Function, sendEmail?: Function}} [deps]
 * @returns {Promise<boolean>}
 */
export async function sendVerificationEmail(db, env, user, origin, deps = {}) {
  const createToken = deps.createToken ?? realCreateToken;
  const sendEmail = deps.sendEmail ?? realSendEmail;
  try {
    const {token} = await createToken(db, {userId: user.id, type: 'verify', ttlMs: 24 * 60 * 60 * 1000});
    const url = new URL('/auth/verify', origin);
    url.searchParams.set('token', token);
    const tpl = verifyEmailTemplate(url.toString());
    await sendEmail(env, {to: user.email, subject: tpl.subject, html: tpl.html});
    return true;
  } catch (err) {
    console.warn(`[signup] verification email failed for ${user.id}: ${err && err.message}`);
    return false;
  }
}
