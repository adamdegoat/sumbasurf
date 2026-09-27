// Real-time performance: the game runs its own loop (real frames, CSS overlays, sound, HUD, all of it) while a bot
// surfs; every frame's time is logged against what's happening (lineup, pop-up, riding, barrel, close-out, wipeout),
// plus the browser's own long-task reports. Run it CPU-throttled (CDP Emulation.setCPUThrottlingRate) to act like a phone.
//   const P = await import('./test/rtperf.js'); await P.session('medium', 90)
import { brain } from './sim2.js';
const G = () => window.__g;
export function session(mode = 'medium', secs = 90) {
  return new Promise((done) => {
    const g = G(); g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
    g.spawnRider(); g.paused = false;
    const b = brain({}), frames = [], longT = []; let last = performance.now(), t0 = last, endAt = -1;
    let po = null; try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) longT.push([+(e.startTime - t0).toFixed(0), +e.duration.toFixed(0), phase()]); }); po.observe({ entryTypes: ['longtask'] }); } catch (e) {}
    const phase = () => { const r = g.rider; if (!r) return '-'; if (r.state === 'RIDE') return r.inBarrel ? 'barrel' : r.wave && r.wave.closing ? 'closeout' : 'ride'; return r.state === 'LIE' ? (r.paddling ? 'paddle' : 'lineup') : r.state; };
    const loop = (now) => {
      const r = g.rider, dt = now - last; last = now;
      frames.push([+(now - t0).toFixed(0), +dt.toFixed(1), phase(), g.waves.length]);
      if (r) { const o = b(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
      if (r && (r.state === 'OUT' || r.state === 'WIPE')) { if (endAt < 0) endAt = now; else if (now - endAt > 6000) { g.spawnRider(); endAt = -1; } }
      if (now - t0 < secs * 1000) requestAnimationFrame(loop);
      else { g.input.test = null; g.input.paddleBtn = false; g.paused = true; if (po) po.disconnect(); done(summ(frames, longT)); }
    };
    requestAnimationFrame(loop);
  });
}
function summ(frames, longT) {
  const by = {};
  for (const [, dt, ph] of frames.slice(5)) (by[ph] ||= []).push(dt);
  const out = {};
  for (const [ph, a] of Object.entries(by)) { const s = [...a].sort((x, y) => x - y); out[ph] = { frames: a.length, fps: +(1000 / (a.reduce((p, x) => p + x, 0) / a.length)).toFixed(1), med: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], over50ms: a.filter((x) => x > 50).length, over100ms: a.filter((x) => x > 100).length }; }
  const worst = [...frames].sort((a, b) => b[1] - a[1]).slice(0, 12);
  return { byPhase: out, worst, longTasks: longT.length, longTop: [...longT].sort((a, b) => b[1] - a[1]).slice(0, 10) };
}
