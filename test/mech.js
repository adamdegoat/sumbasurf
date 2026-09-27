// Mechanics vet: controlled experiments on pump, stall and carving from the same starting moment.
//   const M = await import('./test/mech.js'); M.pump('medium')   M.stall('medium')   M.carve('medium')
import { moment } from './shots.js';
import { brain } from './sim2.js';
const G = () => window.__g;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// drive the rider for secs with ctrl(r, t) -> { steer, pump, stall }; returns a trace summary
function drive(ctrl, secs, fresh = true, stop = null) {
  const g = G(), r = g.rider, dt = 1 / 60; let t = 0, vSum = 0, n = 0, vMax = 0, vMin = 99, x0 = r.x, tube = 0, pumpT = 0;
  const vs = []; if (fresh) r.pumpHold = 0;   // (fresh legs: the setup ride pumps too)
  try {
    for (; t < secs; t += dt) {
      if (r.state !== 'RIDE') break;
      const c = ctrl(r, t);
      g.input.test = null; g.input.stick = { x: c.steer || 0, y: c.stall ? 1 : 0 }; g.input.paddleBtn = !!c.pump;
      g.step(dt, dt, false);
      vSum += r.v; n++; vMax = Math.max(vMax, r.v); vMin = Math.min(vMin, r.v); if (r.inBarrel) tube += dt; if (c.pump) pumpT += dt;
      if (n % 30 === 0) vs.push(+r.v.toFixed(1));
      if (stop && stop(r, t)) { t += dt; break; }
    }
  } finally { g.input.stick = null; g.input.paddleBtn = false; }
  return { lasted: +t.toFixed(1), end: r.state === 'RIDE' ? 'riding' : (r.why || r.state), vAvg: +(vSum / Math.max(1, n)).toFixed(2), vEnd: +r.v.toFixed(2), vMax: +vMax.toFixed(1), vMin: +vMin.toFixed(1), along: +(r.x - x0).toFixed(1), tube: +tube.toFixed(1), pumpHeld: +pumpT.toFixed(1), speeds: vs.join(' ') };
}
// the same line every time: the test surfer's steering (angle down the line, climb when low, drop when high)
const line = () => { const b = brain({ style: 0.5, pumpOn: false }); return (r) => b(r).steer; };

export async function pump(mode = 'medium', seed = 7, secs = 8) {
  const out = {};
  const plans = {
    none: () => false,
    hold: () => true,
    downhill: (r) => r.gAlong < -0.05,                              // only while the board points down the face
    tap14: (r, t) => (t * 1.4) % 1 < 0.5,                          // rhythm, 1.4 a second, blind to the face
    tap2: (r, t) => (t * 2) % 1 < 0.5,                              // quicker rhythm, 2 a second
    mash5: (r, t) => (t * 5) % 1 < 0.5,                             // mashing the button 5 a second
    uphillOnly: (r) => r.gAlong > 0.05,                             // the wrong way round
  };
  for (const [k, p] of Object.entries(plans)) {
    const m = await moment(mode, 'trim', seed); if (!m.includes(': ok')) return m;
    const st = line();
    out[k] = drive((r, t) => ({ steer: st(r), pump: p(r, t) }), secs);
  }
  return out;
}

export async function stall(mode = 'medium', seed = 7) {
  const out = {};
  // 1) straight-line brake: trim, then hold stall 1.5 s with the same steering
  for (const k of ['free', 'stall']) {
    const m = await moment(mode, 'trim', seed); if (!m.includes(': ok')) return m;
    const st = line();
    out['brake_' + k] = drive((r, t) => ({ steer: st(r), stall: k === 'stall' && t < 1.5 }), 3);
  }
  // 2) in the barrel: covered, then hold stall 2 s (does it move you deeper, or does the tube's hold cancel it?)
  for (const k of ['free', 'stall', 'pump']) {
    const m = await moment(mode, 'barrel', seed); if (!m.includes(': ok')) { out['tube_' + k] = m; continue; }
    const g = G(), s0 = g.rider.s;
    const st = line();
    const d = drive((r, t) => ({ steer: st(r), stall: k === 'stall', pump: k === 'pump' }), 2);
    d.depthChange = +(g.rider.s - s0).toFixed(2);   // + = further from the curl (toward the exit), - = deeper
    out['tube_' + k] = d;
  }
  return out;
}

export async function carve(mode = 'medium', seed = 7) {
  const out = {};
  // full-lock turns of different lengths from the same trim moment: speed kept, heading change, time
  for (const [k, lock, secs] of [['half', 0.5, 0.8], ['full_short', 1, 0.5], ['full_long', 1, 1.0], ['full_hold', 1, 2.0]]) {
    for (const dir of [1, -1]) {
      const m = await moment(mode, 'trim', seed); if (!m.includes(': ok')) return m;
      const g = G(), r = g.rider, th0 = r.th, v0 = r.v; let dth = 0, prev = r.th, maxTurn = 0, maxSkid = 0;
      const d = drive((rr, t) => { dth += wrap(rr.th - prev); prev = rr.th; maxTurn = Math.max(maxTurn, Math.abs(rr.turn)); maxSkid = Math.max(maxSkid, rr.skid); return { steer: t < secs ? lock * dir : 0 }; }, secs + 0.5);
      out[`${k}_${dir > 0 ? 'R' : 'L'}`] = { v0: +v0.toFixed(1), vEnd: d.vEnd, lost: +(v0 - d.vEnd).toFixed(2), turnedDeg: Math.round(dth * 57.3), peakDegS: Math.round(maxTurn * 57.3), skid: +maxSkid.toFixed(2), end: d.end };
    }
  }
  return out;
}

// in the barrel: trim, stall until covered, then 2 s of free / stall / pump from that same moment
export async function tube(mode = 'easy', seed = 7) {
  const out = {};
  for (const k of ['free', 'stall', 'pump', 'tap']) {
    const m = await moment(mode, 'trim', seed); if (!m.includes(': ok')) return m;
    const g = G(), st = line();
    const pre = drive((r) => ({ steer: st(r), stall: true }), 12, true, (r) => r.inBarrel);
    if (!g.rider.inBarrel || g.rider.state !== 'RIDE') { out[k] = 'never covered: ' + pre.end + ' after ' + pre.lasted + 's'; continue; }
    const s0 = g.rider.s, v0 = g.rider.v;
    const d = drive((r, t) => ({ steer: st(r), stall: k === 'stall', pump: k === 'pump' || (k === 'tap' && (t * 1.6) % 1 < 0.5) }), 2.5);
    out[k] = { coveredAfter: pre.lasted, v0: +v0.toFixed(1), vEnd: d.vEnd, tube: d.tube, end: d.end, depth: +(g.rider.s - s0).toFixed(2), speeds: d.speeds };
  }
  return out;
}
