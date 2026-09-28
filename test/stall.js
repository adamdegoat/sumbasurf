// Stall check: stand a test surfer up on a wave, ride a moment, then hold STALL (straight, no steering) for a while and
// log speed, where you are against the curl and what happens (still riding, caught by the lip, wave left you...).
//   const T = await import('./test/stall.js?v=' + Date.now()); T.run('medium', 'short', 3)
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
function standUp(mode, board) {
  const g = G(); g.paused = true; g.setMode(mode); g.useBoard(board); g.spawnRider(); g.keys.clear();
  const br = brain({}), cb = carveBrain({ hi: 0.75, lo: 0.2, gain: 3.4 }); let guard = 0;
  while (!(g.rider.standing && g.rider.state === 'RIDE' && g.rider.stateT > 2.5) && guard++ < 60 * 120) {
    const r = g.rider; if (r.state === 'WIPE' || r.state === 'OUT') { g.spawnRider(); continue; }
    let o = br(r); if (r.state === 'RIDE' && r.stateT > 1) { o = cb(r); o.pump = r.v < r.wave.cond.speed; }
    g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false);
  }
  g.input.paddleBtn = false;
}
// hold the stall for `secs` (or until the ride ends), then let go and ride on for 3 s
export function run(mode = 'medium', board = 'short', secs = 3) {
  const g = G(); standUp(mode, board); const r = g.rider, log = [];
  const v0 = r.v, s0 = r.s / r.wave.cond.H;
  for (let t = 0; t < secs + 3; t += 1 / 60) {
    const holding = t < secs;
    g.input.test = null; g.input.stick = { x: 0, y: holding ? 1 : 0 };   // (the stick's down = STALL held, as the scripted checks do)
    g.step(1 / 60, 1 / 60, false);
    if (Math.round(t * 60) % 15 === 0) log.push(`${t.toFixed(2)}s ${holding ? 'STALL' : 'free '} v ${r.v.toFixed(1)} m/s  s ${(r.s / (r.wave ? r.wave.cond.H : 1)).toFixed(2)}H  ${r.state}${r.inBarrel ? ' barrel' : ''}`);
    if (r.state !== 'RIDE') { log.push(`${t.toFixed(2)}s ENDED: ${r.why}`); break; }
  }
  g.input.stick = null; g.input.test = null;
  return `${mode} ${board} stall ${secs}s (start ${v0.toFixed(1)} m/s at ${s0.toFixed(2)}H ahead of the curl)\n` + log.join('\n');
}
