// Keyboard steering check: the same scripted surfer plays with an analog thumb, with arrow keys (the real key path,
// held-to-lean), and with old-style on/off keys (full lean the instant a key is down). Also times the lean ramp.
//   const K = await import('./test/keys.js?v=1'); K.compare(['medium','hard'], 6)
import { brain } from './sim2.js';
const G = () => window.__g;

function play(mode, n, how) {
  const g = G(); g.paused = true; g.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
  g.spawnRider(); g.keys.clear();
  const br = brain({}), out = { made: 0, scores: [], turns: 0, why: {} };
  let guard = 0, dir = 0;
  while (out.scores.length < n && guard++ < 30 * 60 * 6) {
    const r = g.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') {
      const R = r.ride; out.scores.push(+R.score || 0); out.turns += R.turns;
      if (r.state === 'OUT') out.made++; out.why[r.why] = (out.why[r.why] || 0) + 1;
      g.keys.clear(); dir = 0; g.spawnRider(); continue;
    }
    const o = br(r);
    // keys: a player holds an arrow while they want to turn and lets go when they're lined up (a little hysteresis)
    if (how !== 'thumb') { const on = Math.abs(o.steer) > (dir ? 0.1 : 0.25); dir = on ? Math.sign(o.steer) : 0; }
    if (how === 'thumb') g.input.test = o.steer;
    else if (how === 'old' || !r.standing) g.input.test = dir;   // (lying down both key styles turn at once)
    else { g.input.test = null; g.keys.delete('ArrowLeft'); g.keys.delete('ArrowRight'); if (dir) { const flip = (g.mirror ? -1 : 1) * (g.tubeK > 0.5 ? -1 : 1); g.keys.add(dir * flip > 0 ? 'ArrowRight' : 'ArrowLeft'); } }   // (the keys follow the screen: a mirrored spot and the barrel view swap them, as for a player)
    g.input.paddleBtn = r.standing ? o.pump : o.paddle;
    g.step(1 / 30, 1 / 30, false);
  }
  g.input.test = null; g.input.paddleBtn = false; g.keys.clear();
  const avg = out.scores.reduce((a, b) => a + b, 0) / Math.max(1, out.scores.length);
  return `${how.padEnd(5)} made ${out.made}/${out.scores.length} avg ${avg.toFixed(2)} best ${Math.max(...out.scores).toFixed(1)} turns ${out.turns} | ${JSON.stringify(out.why)}`;
}

export function compare(modes = ['medium'], n = 6) {
  const lines = [];
  for (const m of modes) for (const how of ['thumb', 'keys', 'old']) lines.push(`${m.padEnd(8)} ${play(m, n, how)}`);
  return lines.join('\n');
}

// hold an arrow for `secs` once standing and report the steering it reached
export function ramp(mode = 'medium') {
  const g = G(), res = [];
  for (const secs of [0.1, 0.2, 0.3, 0.45, 0.8]) {
    g.paused = true; g.setMode(mode); g.spawnRider(); g.keys.clear();
    const br = brain({}); let guard = 0;
    while (!(g.rider.standing && g.rider.state === 'RIDE' && g.rider.stateT > 1) && guard++ < 30 * 90) {
      const r = g.rider, o = br(r); if (r.state === 'WIPE' || r.state === 'OUT') { g.spawnRider(); continue; }
      g.input.test = o.steer; g.input.paddleBtn = r.standing ? o.pump : o.paddle; g.step(1 / 30, 1 / 30, false);
    }
    g.input.test = null; g.input.paddleBtn = false; g.keys.add('ArrowRight');
    for (let t = 0; t < secs - 1e-6; t += 1 / 60) g.step(1 / 60, 1 / 60, false);
    const held = g.input.steer; g.keys.clear();
    let back = 0; while (Math.abs(g.input.steer) > 0.05 && back < 60) { g.step(1 / 60, 1 / 60, false); back++; }
    res.push(`hold ${secs}s -> steer ${held.toFixed(2)}, back to straight in ${(back / 60).toFixed(2)}s`);
  }
  return res.join('\n');
}

// how much a key press turns the board: hold an arrow for each duration (or a thumb at a fixed amount), measure the
// heading change until the board runs straight again, the peak g on the rail and the peak lean
export function turnTable(mode = 'medium', boards = ['short', 'fish', 'long', 'gun'], holds = [0.08, 0.15, 0.25, 0.4, 0.6, 1.0], thumbs = [0.25, 0.5, 1]) {
  const g = G(), rows = [];
  const standUp = () => {
    g.paused = true; g.setMode(mode); g.spawnRider(); g.keys.clear();
    const br = brain({}); let guard = 0;
    while (!(g.rider.standing && g.rider.state === 'RIDE' && g.rider.stateT > 1.2) && guard++ < 30 * 120) {
      const r = g.rider, o = br(r); if (r.state === 'WIPE' || r.state === 'OUT') { g.spawnRider(); continue; }
      g.input.test = o.steer; g.input.paddleBtn = r.standing ? o.pump : o.paddle; g.step(1 / 30, 1 / 30, false);
    }
    g.input.paddleBtn = false; g.input.test = 0; for (let i = 0; i < 20; i++) g.step(1 / 60, 1 / 60, false);   // settle straight
    g.input.test = null;
  };
  const measure = (drive, secs) => {
    const r = g.rider, th0 = r.th, v0 = r.v; let gPk = 0, lPk = 0, t = 0;
    const key = (g.mirror ? -1 : 1) > 0 ? 'ArrowRight' : 'ArrowLeft';
    for (; t < secs; t += 1 / 60) { drive(key, t); g.step(1 / 60, 1 / 60, false); gPk = Math.max(gPk, Math.abs(r.turn) * r.v / 9.81); lPk = Math.max(lPk, Math.abs(r.lean)); if (r.state !== 'RIDE') break; }
    g.keys.clear(); g.input.test = null;
    for (let k = 0; k < 90 && Math.abs(r.turn) > 0.05 && r.state === 'RIDE'; k++) g.step(1 / 60, 1 / 60, false);
    const d = Math.atan2(Math.sin(r.th - th0), Math.cos(r.th - th0)) * 180 / Math.PI;
    return `turned ${Math.abs(d).toFixed(0).padStart(3)} deg  peak ${gPk.toFixed(1)} g  lean ${(lPk * 57.3).toFixed(0)} deg  at ${(v0 * 3.6).toFixed(0)} km/h${r.state !== 'RIDE' ? '  (' + r.state + ')' : ''}`;
  };
  for (const b of boards) {
    g.useBoard(b);
    for (const h of holds) { standUp(); rows.push(`${b.padEnd(5)} key ${String(h).padEnd(4)}s  ${measure((k) => g.keys.add(k), h)}`); }
    for (const a of thumbs) { standUp(); rows.push(`${b.padEnd(5)} thumb ${String(a).padEnd(4)} 0.4s ${measure(() => { g.input.test = a; }, 0.4)}`); }
  }
  g.useBoard('short');
  return rows.join('\n');
}
