export async function onRequestGet({ env }) {
  const bindingPresent = !!env.DB;
  const siteKeyPresent = !!env.TURNSTILE_SITE_KEY;
  const secretPresent = !!env.TURNSTILE_SECRET;
  let databaseQuery = 'not_checked';
  if (bindingPresent) {
    try {
      await env.DB.prepare('SELECT COUNT(*) AS count FROM guestbook_messages').first();
      databaseQuery = 'ok';
    } catch {
      databaseQuery = 'failed';
    }
  }
  return Response.json({
    ready: bindingPresent && siteKeyPresent && secretPresent && databaseQuery === 'ok',
    checks: {
      database_binding: bindingPresent,
      database_query: databaseQuery,
      turnstile_site_key: siteKeyPresent,
      turnstile_secret: secretPresent
    },
    sitekey: env.TURNSTILE_SITE_KEY || ''
  }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
