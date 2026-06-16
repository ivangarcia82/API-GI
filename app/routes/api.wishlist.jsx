/* ============================================================
   Generando Ideas — Wishlist resource route
   POST  /api/wishlist  -> toggle (form field: productId)
   GET   /api/wishlist  -> list current user's product GIDs
   Server-only: assertSameOrigin + requireUser gate the action.
   ============================================================ */
import {data} from 'react-router';
import {getDb} from '~/lib/db/client';
import {requireUser} from '~/lib/auth/guard';
import {getSessionUser} from '~/lib/auth/session';
import {assertSameOrigin} from '~/lib/http/csrf';
import {toggleWishlist, listWishlist, mergeWishlist} from '~/lib/wishlist/repo';

/**
 * @param {import('react-router').ActionFunctionArgs & {context: any}} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const {userId} = await requireUser(context);
  const form = await request.formData();
  const intent = String(form.get('intent') || 'toggle');
  const db = getDb(context.env);

  if (intent === 'merge') {
    const raw = String(form.get('productIds') || '[]');
    let ids = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) ids = parsed.map((x) => String(x));
    } catch {
      ids = [];
    }
    await mergeWishlist(db, userId, ids);
    const favs = await listWishlist(db, userId);
    return data({favs});
  }

  const productId = String(form.get('productId') || '').trim();
  if (!productId) {
    return data({error: 'productId required'}, {status: 400});
  }
  const added = await toggleWishlist(db, userId, productId);
  const favs = await listWishlist(db, userId);
  return data({added, favs});
}

/**
 * @param {import('react-router').LoaderFunctionArgs & {context: any}} args
 */
export async function loader({context}) {
  const sessionUser = getSessionUser(context.session);
  if (!sessionUser) return data({favs: []});
  const db = getDb(context.env);
  const favs = await listWishlist(db, sessionUser.userId);
  return data({favs});
}
