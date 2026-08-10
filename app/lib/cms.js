/**
 * CMS client — fetches dynamic content from the Generando Ideas CMS.
 *
 * Falls back to the hardcoded data in site-content.js when the CMS is
 * unreachable so the site never breaks, just serves stale data.
 */
import {JOBS as STATIC_JOBS, RECRUITMENT as STATIC_RECRUITMENT, RECRUITMENT_DISCLAIMER as STATIC_DISCLAIMER} from './site-content';

const CMS_URL = typeof process !== 'undefined'
  ? (process.env.CMS_API_URL || 'http://localhost:4000')
  : 'http://localhost:4000';

const TIMEOUT_MS = 3_000;

/**
 * Internal fetch with timeout + error handling. Returns null on failure.
 */
async function cmsFetch(path) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${CMS_URL}${path}`, {
      signal: controller.signal,
      headers: {Accept: 'application/json'},
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // CMS down or timeout — caller uses fallback
    return null;
  }
}

/**
 * Fetch all active vacantes from the CMS.
 * Falls back to the static JOBS array from site-content.js.
 *
 * @returns {Promise<import('./site-content').Job[]>}
 */
export async function getJobs() {
  const data = await cmsFetch('/api/vacantes/public');
  if (!data || !Array.isArray(data) || data.length === 0) {
    return STATIC_JOBS;
  }
  return data;
}

/**
 * Fetch a single vacante by ID from the CMS.
 * Falls back to the static JOBS array.
 *
 * @param {string|number} id
 * @returns {Promise<import('./site-content').Job|undefined>}
 */
export async function getJobById(id) {
  const data = await cmsFetch(`/api/vacantes/public/${id}`);
  if (data && data.id) {
    return data;
  }
  // Fallback: search in static array
  return STATIC_JOBS.find((j) => String(j.id) === String(id));
}

/**
 * Fetch recruitment settings from the CMS.
 * Falls back to the static RECRUITMENT constants.
 *
 * @returns {Promise<{recruitment: typeof STATIC_RECRUITMENT, disclaimer: string}>}
 */
export async function getRecruitmentSettings() {
  const data = await cmsFetch('/api/vacantes/public/settings');
  if (data && data.recruitment_email) {
    return {
      recruitment: {
        email: data.recruitment_email,
        altEmail: data.recruitment_alt_email || STATIC_RECRUITMENT.altEmail,
        phone: data.recruitment_phone || STATIC_RECRUITMENT.phone,
      },
      disclaimer: data.recruitment_disclaimer || STATIC_DISCLAIMER,
    };
  }
  return {
    recruitment: STATIC_RECRUITMENT,
    disclaimer: STATIC_DISCLAIMER,
  };
}
