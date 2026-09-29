// The owner's daily summary on Telegram: yesterday (Singapore time) in one message, read back from the lines ping.js
// notes in KV. A small Cloudflare Worker (../../digest-worker) calls this every morning at 9 am Singapore time.
// Safe for anyone to call: it only ever sends each day's summary once, and only for a day that is over.
import { chatId, tg, sgDay } from './ping.js';
const top = (m, n = 4) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(', ');
const add = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
export async function onRequest({ env }) {
  const done = (s) => new Response(s, { headers: { 'content-type': 'text/plain' } });
  if (!env.TG_TOKEN || !env.KV) return done('off');
  const day = sgDay(Date.now() - 86400e3);
  if (await env.KV.get('digest:' + day)) return done('already sent ' + day);
  await env.KV.put('digest:' + day, '1', { expirationTtl: 7 * 86400 });   // (first, so two calls at once can't both send)
  const rows = []; let cursor;
  do { const r = await env.KV.list({ prefix: `e:${day}:`, cursor }); for (const k of r.keys) if (k.metadata) rows.push(k.metadata); cursor = r.list_complete ? null : r.cursor; } while (cursor);
  let text;
  if (!rows.length) text = 'Yesterday: no players';
  else {
    // ("Same player again" lines are the same person after a break: their time and waves count, not a second player)
    const people = rows.filter((r) => r.k !== 'again'), fresh = people.filter((r) => r.k === 'new').length;
    const src = new Map(), spot = new Map();
    for (const r of people) add(src, r.s || 'unknown');
    for (const r of rows) for (const p of r.p || []) add(spot, p);
    const mins = rows.reduce((a, r) => a + (r.m || 0), 0);
    const best = rows.reduce((a, r) => (r.b || 0) > (a.b || 0) ? r : a, {});
    // short, his call: three lines
    const first = (m) => top(m, 1).replace(/ \d+$/, '');
    text = `Yesterday: ${people.length} player${people.length === 1 ? '' : 's'} (${fresh} new)`
      + `\nMost from ${first(src)}${spot.size ? `, most played ${first(spot)}` : ''}`
      + `\nAverage ${Math.round(mins / Math.max(1, people.length))} min${best.b > 0 ? `, best wave ${best.b.toFixed(1)}` : ''}`;
  }
  const chat = await chatId(env); if (!chat) return done('no chat');
  await tg(env, chat, text);
  return done('sent ' + day);
}
