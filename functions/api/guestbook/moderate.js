const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const reply = (body, status = 200) => Response.json(body, { status, headers });
const enc = new TextEncoder();
async function authorized(request, env) {
  const expected = env.GUESTBOOK_ADMIN_KEY;
  const given = request.headers.get('Authorization') || '';
  if (typeof expected !== 'string' || expected.length < 14 || !given.startsWith('Bearer ')) return false;
  const token = given.slice(7);
  // Hash before comparison so comparison lengths and timing do not reveal key characters.
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(expected)), crypto.subtle.digest('SHA-256', enc.encode(token))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !!origin && origin === new URL(request.url).origin;
}
export async function onRequestGet({ request, env }) {
  if (!(await authorized(request, env))) return reply({ error: 'Unauthorized' }, 401);
  if (!env.Guestbook) return reply({ error: 'Database unavailable' }, 503);
  const status = new URL(request.url).searchParams.get('status') || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) return reply({ error: 'Invalid status' }, 400);
  try {
    const { results } = await env.Guestbook.prepare('SELECT id, display_name, message, created_at, status, parent_id FROM guestbook_messages WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT 100').bind(status).all();
    return reply({ messages: results || [] });
  } catch { return reply({ error: 'Could not load messages' }, 503); }
}
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return reply({ error: 'Origin not allowed' }, 403);
  if (!(await authorized(request, env))) return reply({ error: 'Unauthorized' }, 401);
  if (!env.Guestbook) return reply({ error: 'Database unavailable' }, 503);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return reply({ error: 'JSON required' }, 415);
  if (Number(request.headers.get('Content-Length') || 0) > 2048) return reply({ error: 'Request too large' }, 413);
  let data;
  try { data = await request.json(); } catch { return reply({ error: 'Invalid JSON' }, 400); }
  const id = data?.id, action = data?.action;
  if (!Number.isSafeInteger(id) || id < 1 || !['approve', 'reject', 'delete'].includes(action)) return reply({ error: 'Invalid action or message ID' }, 400);
  try {
    let result;
    if (action === 'delete') result = await env.Guestbook.prepare('DELETE FROM guestbook_messages WHERE id = ?').bind(id).run();
    else result = await env.Guestbook.prepare('UPDATE guestbook_messages SET status = ? WHERE id = ?').bind(action === 'approve' ? 'approved' : 'rejected', id).run();
    if (!result.meta?.changes) return reply({ error: 'Message not found' }, 404);
    return reply({ ok: true });
  } catch { return reply({ error: 'Could not update message' }, 503); }
}
