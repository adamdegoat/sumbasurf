// The owner's player alert on Telegram: ONE message per player, when they leave (his call 29 Sep 2026: nothing when
// they come in). The game (sumbasurf.app and the Wavedash copy) posts here when its page is hidden after some surfing:
//   { kind: new|back, who, dev, src, host, mins, waves, best, bestAt, spots, boards, again }
// and each one is also noted in KV for one summary message a day (sent by /api/digest, see digest.js).
// The bot key lives in the Cloudflare project's settings (the TG_TOKEN secret), never in code. Nothing a player sends
// reaches the chat as their own text: every name comes from a fixed list and every number is clamped.
export const SPOTS = ['Pantai Kuda', 'Tanjung Uma', 'Batu Hitam', 'Gunung Laut', 'Watu Kanan', 'Karang Hiu', 'Pantai Bintang', 'Sumba Ranch', 'the villa'];
export const BOARDS = { short: 'shortboard', fish: 'fish', long: 'longboard', gun: 'gun' };
export const SOURCES = ['Instagram', 'Facebook', 'TikTok', 'Google', 'another search engine', 'YouTube', 'X', 'Reddit', 'Telegram', 'WhatsApp', 'Wavedash', 'home screen app', 'a direct link', 'another website'];
const DEV = ['phone', 'tablet', 'computer', 'touchscreen computer'];
const ORIGIN = /^https:\/\/((www\.)?sumbasurf\.app|([a-z0-9-]+\.)?sumbasurf(-app)?\.pages\.dev|[a-z0-9-]+\.builds\.wavedashcdn\.com)$/;
export const tg = (env, chat, text) => fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) });
// which chat to message: set by hand (TG_CHAT), or found by itself: whoever pressed Start on the bot, remembered in KV
export async function chatId(env) {
  if (env.TG_CHAT) return env.TG_CHAT;
  let id = env.KV && await env.KV.get('chat'); if (id) return id;
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getUpdates`).then((x) => x.json()).catch(() => null);
  const u = r && r.ok && r.result.filter((m) => m.message && m.message.chat).pop();
  if (!u) return null;
  id = String(u.message.chat.id); if (env.KV) await env.KV.put('chat', id);
  await tg(env, id, 'SumbaSurf alerts are on. You will get a message here when someone plays.');
  return id;
}
// the day in Singapore time (the owner's), as 2026-09-29: the daily summary counts by it
export const sgDay = (ms = Date.now()) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
// one line in KV per player message, kept 3 days; the daily summary reads them back in one listing (the facts ride in the
// key's metadata). (KV can't count safely from two places at once; a line each can't lose one)
async function note(env, meta) {
  if (!env.KV) return;
  try { await env.KV.put(`e:${sgDay()}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, '', { expirationTtl: 3 * 86400, metadata: meta }); } catch (e) {}   // (the free plan's daily write limit reached: the alert still goes)
}
const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
const list = (a, ok) => (Array.isArray(a) ? [...new Set(a.filter((x) => ok.includes(x)))] : []).slice(0, 10);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export async function onRequestPost({ request, env }) {
  const none = new Response(null, { status: 204, headers: { 'cross-origin-resource-policy': 'cross-origin' } });   // (the Wavedash page only accepts replies marked shareable)
  if (!env.TG_TOKEN) return none;
  // only the game's own pages can send, and each connection at most once a minute (so nobody can flood the chat)
  if (!ORIGIN.test(request.headers.get('origin') || '')) return none;
  let b = {}; try { b = JSON.parse(await request.text()) || {}; } catch (e) {}   // (sent as plain text: the Wavedash copy lives on another address, and plain text needs no extra permission round trip)
  if (!b || typeof b !== 'object') b = {};
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (env.KV && ip) { if (await env.KV.get('ip:' + ip)) return none; await env.KV.put('ip:' + ip, '1', { expirationTtl: 60 }); }
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
    const text = `${test ? 'Claude testing: ' : ''}${top}\n${did}`;
    await tg(env, chat, text);
    if (!test) await note(env, { k: b.again ? 'again' : back ? 'back' : 'new', c: country, d: dev, s: wd ? 'Wavedash' : src, h: wd ? 'wavedash' : 'app', m: mins, n: waves, b: best, a: bestAt, p: spots });
  } catch (e) {}   // (Telegram down: the game never notices)
  return none;
}
