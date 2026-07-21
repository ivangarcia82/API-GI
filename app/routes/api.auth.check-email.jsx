import {findByEmail, normalizeEmail} from '~/lib/auth/users';
import {getDb} from '~/lib/db/client';

/**
 * @param {import('react-router').LoaderFunctionArgs & {context: any}} args
 */
export async function loader({request, context}) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get('email') ?? '');
  if (!email) return Response.json({disponible: false});

  const db = getDb(context.env);
  const existente = await findByEmail(db, email);
  return Response.json({disponible: !existente});
}
