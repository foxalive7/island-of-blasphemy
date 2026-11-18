(() => {
  'use strict';
  let key = '';
  const $ = id => document.getElementById(id);
  const status = text => { $('status').textContent = text; };
  async function call(method, payload) {
    const response = await fetch('/api/guestbook/moderate', {
      method,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${key}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  function button(label, action, id, danger = false) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    if (danger) b.className = 'danger';
    b.addEventListener('click', async () => {
      if (action === 'delete' && !confirm(`Permanently delete message #${id}?`)) return;
      b.disabled = true; status(`Updating message #${id}…`);
      try { await call('POST', { action, id }); status(`Message #${id} ${action === 'delete' ? 'deleted' : action === 'approve' ? 'approved' : 'rejected'}.`); await load(true); }
      catch (e) { status(e.message); b.disabled = false; }
    });
    return b;
  }
  async function load(quiet = false) {
    if (!key) { status('Unlock with your admin key first.'); return; }
    const queue = $('queue');
    if (!quiet) status('Loading messages…');
    try {
      const response = await fetch(`/api/guestbook/moderate?status=${encodeURIComponent($('filter').value)}`, { cache: 'no-store', headers: { Authorization: `Bearer ${key}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
      queue.replaceChildren();
      if (!data.messages.length) { const p = document.createElement('p'); p.textContent = 'No messages in this category.'; queue.append(p); }
      for (const m of data.messages) {
        const card = document.createElement('article'); card.className = 'message';
        const heading = document.createElement('strong'); heading.textContent = `${m.display_name} · #${m.id}`;
        const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${m.created_at} UTC · ${m.status}`;
        const body = document.createElement('p'); body.textContent = m.message;
        const actions = document.createElement('div'); actions.className = 'actions';
        if (m.status !== 'approved') actions.append(button('Approve', 'approve', m.id));
        if (m.status !== 'rejected') actions.append(button('Reject', 'reject', m.id));
        actions.append(button('Delete', 'delete', m.id, true));
        card.append(heading, meta, body, actions); queue.append(card);
      }
      if (!quiet) status(`${data.messages.length} message(s) loaded. Showing up to 100.`);
    } catch (e) { status(e.message); if (e.message === 'Unauthorized') { key = ''; $('queue').textContent = 'Locked. Check your admin key.'; } }
  }
  $('login').addEventListener('submit', e => { e.preventDefault(); key = $('key').value; $('key').value = ''; load(); });
  $('lock').addEventListener('click', () => { key = ''; $('key').value = ''; $('queue').textContent = 'Locked.'; status('Key cleared from this tab.'); });
  $('refresh').addEventListener('click', () => load());
  $('filter').addEventListener('change', () => load());
})();
