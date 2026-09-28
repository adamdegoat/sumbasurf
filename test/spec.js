// Contest watch check: one game surfs (a scripted rider), another watches it through the contest feed, both on this Mac
// (test/duo.html puts the two side by side; the feed goes over a BroadcastChannel instead of Wavedash P2P).
//   in the left frame: (await import('./test/spec.js')).surf('medium')    in the right: (await import('./test/spec.js')).watch('medium')
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
const bc = new BroadcastChannel('ss-spec');
export const stats = { sent: 0, bytes: 0, maxBytes: 0, got: 0 };
export function surf(mode = 'medium') {
  const g = G(); g.hold = true; g.selSpot(mode); g.start(mode, true);
  const br = brain({}), cb = carveBrain({ hi: 0.8, lo: 0.16, gain: 3.4 });
  const loop = () => { const r = g.rider; if (r) { let o = br(r); if (r.state === 'RIDE' && r.wave && r.stateT > 1) { o = cb(r); o.pump = r.v < r.wave.cond.speed * 0.85; }
    g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; } requestAnimationFrame(loop); };
  loop();
  setInterval(() => { const s = g.contestSnap(); if (s) { bc.postMessage(s); stats.sent++; stats.bytes += s.length; stats.maxBytes = Math.max(stats.maxBytes, s.length); } }, 1000 / 15);
  return 'surfing';
}
export function watch(mode = 'medium') { const g = G(); g.specStart(mode); bc.onmessage = (e) => { stats.got++; g.specFeed(e.data); }; return 'watching'; }
