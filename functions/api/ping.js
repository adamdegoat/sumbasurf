// The owner's player alert on Telegram: two short lines when a player starts surfing or walks into the villa (his call
// 30 Sep 2026, to see the traffic as it happens; 1 Oct 2026: that alert only, the session report when they leave is off). The game (sumbasurf.app and the Wavedash copy) posts here when its page is hidden after some surfing:
//   { kind: new|back, who, dev, src, host, mins, waves, best, bestAt, spots, boards, again }
// The bot key lives in the Cloudflare project's settings (the TG_TOKEN secret), never in code. Nothing a player sends
// reaches the chat as their own text: every name comes from a fixed list and every number is clamped.
export const SPOTS = ['Pantai Kuda', 'Tanjung Uma', 'Batu Hitam', 'Gunung Laut', 'Watu Kanan', 'Karang Hiu', 'Pantai Bintang', 'Ombak Raksasa', 'Sumba Ranch', 'the villa', 'Free surf'];
export const BOARDS = { short: 'shortboard', fish: 'fish', long: 'longboard', gun: 'gun' };
export const SOURCES = ['Instagram', 'Facebook', 'TikTok', 'Google', 'another search engine', 'YouTube', 'X', 'Reddit', 'Telegram', 'WhatsApp', 'Wavedash', 'home screen app', 'a direct link', 'another website'];
const DEV = ['phone', 'tablet', 'computer', 'touchscreen computer'];
const ORIGIN = /^https:\/\/((www\.)?sumbasurf\.app|([a-z0-9-]+\.)?sumbasurf(-app)?\.pages\.dev|[a-z0-9-]+\.builds\.wavedashcdn\.com)$/;
// (1 Oct 2026, alerts stopped at 9:04 pm: when Telegram refuses a message, its reason goes to Cloudflare's logs, the
// bot key blanked out of anything written there; nothing else about the player is logged)
const hide = (env, v) => String(v).split(env.TG_TOKEN || '\u0000').join('<key>');
export const tg = (env, chat, text) => fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) })
  .then(async (r) => { if (!r.ok) { let d = ''; try { d = (await r.clone().json()).description || ''; } catch (e) {} console.log('alert: telegram refused', r.status, hide(env, d)); } return r; },
    (e) => { console.log('alert: telegram unreachable', hide(env, e && e.message || e)); throw e; });
// which chat to message: set by hand (TG_CHAT), or found by itself: whoever pressed Start on the bot, remembered in KV
export async function chatId(env) {
  if (env.TG_CHAT) return env.TG_CHAT;
  let id = env.KV && await env.KV.get('chat'); if (id) return id;
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getUpdates`).then((x) => x.json()).catch(() => null);
  const u = r && r.ok && r.result.filter((m) => m.message && m.message.chat).pop();
  if (!u) return null;
  id = String(u.message.chat.id); if (env.KV) try { await env.KV.put('chat', id); } catch (e) {}   // (a full KV must never stop the alert)
  await tg(env, id, 'SumbaSurf alerts are on. You will get a message here when someone plays.');
  return id;
}
// once a minute per connection and kind (so nobody can flood the chat), remembered in Cloudflare's edge cache, not in KV
// (1 Oct 2026: KV's free plan takes 1,000 writes a day; with more players it ran out and every alert after that threw
// before it reached Telegram). The cache has no daily limit; it's per data centre, which is plenty for a once-a-minute rule
async function seen(kind, ip) {
  if (!ip) return false;
  try { const c = caches.default, key = new Request(`https://sumbasurf.app/__rl/${kind}/${encodeURIComponent(ip)}`);
    if (await c.match(key)) return true;
    await c.put(key, new Response('1', { headers: { 'cache-control': 'max-age=60' } })); } catch (e) {}
  return false;
}
const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
const list = (a, ok) => (Array.isArray(a) ? [...new Set(a.filter((x) => ok.includes(x)))] : []).slice(0, 10);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export async function onRequestPost({ request, env }) {
  const none = new Response(null, { status: 204, headers: { 'cross-origin-resource-policy': 'cross-origin' } });   // (the Wavedash page only accepts replies marked shareable)
  if (!env.TG_TOKEN) return none;
  // only the game's own pages can send, and each connection at most once a minute (so nobody can flood the chat)
  const og = request.headers.get('origin') || '';
  if (!ORIGIN.test(og) && og !== 'null') { console.log('alert: skipped, from', og || 'nowhere'); return none; }   // ('null': the Wavedash copy, whose page now hides its address, 1 Oct 2026)
  let b = {}; try { b = JSON.parse(await request.text()) || {}; } catch (e) {}   // (sent as plain text: the Wavedash copy lives on another address, and plain text needs no extra permission round trip)
  if (!b || typeof b !== 'object') b = {};
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (b.kind === 'fb') {   // feedback from the menu: the player's own words (and any name they like) do reach the chat, cut to size, one a minute each
    if (await seen('fb', ip)) return none;
    const clean = (v, n) => String(v || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, n);
    const text = clean(b.text, 500), name = clean(b.name, 40).replace(/\n/g, ' ');
    if (text.length < 2) return none;
    try {
      const chat = await chatId(env); if (!chat) return none;
      let country = request.cf && request.cf.country || '';
      try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country; } catch (e) {}
      const dev = DEV.includes(b.dev) ? b.dev : '', where = [country, dev, b.host === 'wavedash' ? 'on Wavedash' : ''].filter(Boolean).join(', ');
      await tg(env, chat, `FEEDBACK\nFrom ${name || 'someone'}${where ? ` (${where})` : ''}:\n${text}`);   // (a label line first, so each kind of alert reads at a glance: his ask 1 Oct 2026)
    } catch (e) {}
    return none;
  }
  if (b.kind === 'in') {   // they just started surfing or walked into the villa: one short line (his call 30 Sep 2026), its own once-a-minute limit so the note when they leave still goes
    if (await seen('in', ip)) { console.log('alert: skipped, once a minute'); return none; }
    try {
      const chat = await chatId(env); if (!chat) { console.log('alert: no chat to send to'); return none; }
      let country = request.cf && request.cf.country || '';
      try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country; } catch (e) {}
      const dev = DEV.includes(b.dev) ? b.dev : '', src = SOURCES.includes(b.src) ? b.src : '', wd = b.host === 'wavedash';
      const where = SPOTS.includes(b.where) ? b.where : '', back = b.seen === 'back', test = b.who === 'claude';
      // two short lines to tell apart at a glance (his call 1 Oct 2026):
      //   NEW · Singapore · phone                          BACK · 5th visit · last 3 days ago
      //   from Instagram → Ombak Raksasa                  Malaysia · computer · Wavedash → Free surf, joined 2 friends
      const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
      const visits = Math.round(num(b.visits, 0, 99999)), ago = b.ago == null ? -1 : Math.round(num(b.ago, -1, 3650));
      const when = ago < 0 ? '' : ago === 0 ? 'last earlier today' : ago === 1 ? 'last yesterday' : `last ${ago} days ago`;
      let fs = ''; if (where === 'Free surf' && b.fs && typeof b.fs === 'object') { const n = Math.round(num(b.fs.n, 1, 6)); fs = b.fs.host ? (n > 1 ? `, own beach with ${plural(n - 1, 'friend')}` : ', own beach') : `, joined ${n > 1 ? plural(n - 1, 'friend') : 'a beach'}`; }
      const line1 = [back ? 'BACK' : 'NEW', ...(back ? [visits > 1 ? ord(visits) + ' visit' : '', when] : [country, dev])].filter(Boolean).join(' · ');
      const came = wd ? 'Wavedash' : src ? `from ${src}` : '', line2 = [...(back ? [country, dev] : []), [came, where ? where + fs : ''].filter(Boolean).join(' → ')].filter(Boolean).join(' · ');
      await tg(env, chat, `${test ? 'Claude testing: ' : ''}${line1}\n${line2}`);
    } catch (e) { console.log('alert: failed', hide(env, e && e.message || e)); }
    return none;
  }
  return none;   // (the session report when they leave is off, his call 1 Oct 2026: older copies of the game still in phones' caches send it, and it's dropped here)
  if (await seen('ip', ip)) return none;
  try {
    const chat = await chatId(env); if (!chat) return none;
    let country = request.cf && request.cf.country || '';
    try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country; } catch (e) {}
    // (the device: what the game itself saw, from a fixed list, else a guess from the browser's name)
    const ua = request.headers.get('user-agent') || '';
    const dev = DEV.includes(b.dev) ? b.dev : /iPad|Tablet/i.test(ua) ? 'tablet' : /iPhone|Android|Mobile/i.test(ua) ? 'phone' : 'computer';
    const src = SOURCES.includes(b.src) ? b.src : '', wd = b.host === 'wavedash', test = b.who === 'claude', back = b.kind === 'back';
    const mins = Math.round(num(b.mins, 0, 600)), waves = Math.round(num(b.waves, 0, 5000)), best = Math.round(num(b.best, 0, 10) * 10) / 10;
    const bestAt = SPOTS.includes(b.bestAt) ? b.bestAt : '', spots = list(b.spots, SPOTS), boards = list(b.boards, Object.keys(BOARDS)).map((k) => BOARDS[k]);
    // short, his call: "New player, Singapore, phone, from Instagram
    //                   14 min, 23 waves"
    const who = b.again ? 'Same player again' : back ? 'Returning player' : 'New player';
    const top = [who, country, dev, wd ? 'on Wavedash' : src ? `from ${src}` : ''].filter(Boolean).join(', ');
    const did = [mins < 1 ? 'under 1 min' : `${mins} min`, waves ? plural(waves, 'wave') : 'no waves'].join(', ');   // (play time and waves only: no score, no board, his call 30 Sep 2026)
    const text = `SESSION REPORT\n${test ? 'Claude testing: ' : ''}${top}\n${did}`;
    await tg(env, chat, text);
  } catch (e) {}   // (Telegram down: the game never notices)
  return none;
}
