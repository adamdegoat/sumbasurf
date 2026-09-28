// The owner's player alert: the game posts here when someone starts playing, and this sends a one-line Telegram
// message. The bot key lives in the Cloudflare project's settings (the TG_TOKEN secret), never in code.
const SPOTS = ['Pantai Kuda', 'Tanjung Uma', 'Batu Hitam', 'Gunung Laut', 'Watu Kanan', 'Karang Hiu', 'Surf Ranch', 'the villa'];
// which chat to message: set by hand (TG_CHAT), or found by itself: whoever pressed Start on the bot, remembered in KV
async function chatId(env) {
  if (env.TG_CHAT) return env.TG_CHAT;
  let id = env.KV && await env.KV.get('chat'); if (id) return id;
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getUpdates`).then((x) => x.json()).catch(() => null);
  const u = r && r.ok && r.result.filter((m) => m.message && m.message.chat).pop();
  if (!u) return null;
  id = String(u.message.chat.id); if (env.KV) await env.KV.put('chat', id);
  await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: id, text: 'SumbaSurf alerts are on. You will get a message here when someone plays.' }) });
  return id;
}
export async function onRequestPost({ request, env }) {
  const none = new Response(null, { status: 204 });
  if (!env.TG_TOKEN) return none;
  // only the game's own page can ping, and each connection at most once every 5 minutes (so nobody can flood the chat)
  const from = request.headers.get('origin') || ''; if (!/^https:\/\/((www\.)?sumbasurf\.app|([a-z0-9-]+\.)?sumbasurf(-app)?\.pages\.dev)$/.test(from)) return none;
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (env.KV && ip) { if (await env.KV.get('ip:' + ip)) return none; await env.KV.put('ip:' + ip, '1', { expirationTtl: 300 }); }
  let b = {}; try { b = (await request.json()) || {}; } catch (e) {}
  if (typeof b !== 'object') b = {};
  try {
  const chat = await chatId(env); if (!chat) return none;
  const where = SPOTS.includes(b.where) ? b.where : 'the menu';   // (only known names get through: nobody can send you their own text)
  let country = request.cf && request.cf.country || '';
  try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country; } catch (e) {}
  // (the device: what the game itself saw, from a fixed list, else a guess from the browser's name)
  const ua = request.headers.get('user-agent') || '', DEV = ['phone', 'tablet', 'computer', 'touchscreen computer'];
  const dev = DEV.includes(b.dev) ? b.dev : /iPad|Tablet/i.test(ua) ? 'tablet' : /iPhone|Android|Mobile/i.test(ua) ? 'phone' : 'computer';
  const text = `${b.who === 'claude' ? 'Claude testing: ' : ''}${b.kind === 'back' ? 'A player is back' : 'New player'} at ${where}${country ? ` (${country}, ${dev})` : ` (${dev})`}`;
  await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) });
  } catch (e) {}   // (Telegram down: the game never notices)
  return none;
}
