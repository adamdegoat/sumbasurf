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

// catching: sit in the lineup, turn for the beach when a wave is 6 s out, start paddling `lead` seconds before it
// arrives; what happens? (POP = caught, missed = it went under you, or the wipe's reason)
export function catchWindow(mode = 'medium', board = 'short', leads = [-0.6, -0.3, 0, 0.3, 0.6, 1, 1.5, 2, 3, 4], seed = 7, tries = 3, dx = 0, dz = 0) {
  const g = G(), out = {}; const rnd0 = Math.random;
  g.useBoard(board);
  try {
    for (const lead of leads) {
      const res = [];
      for (let k = 0; k < tries; k++) {
        let st = (seed + k * 101) >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
        g.paused = true; g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); g.spawnRider();
        const r = g.rider; r.x += dx; r.z += dz; let got = null, target = null, t = 0, popV = 0, goT = -1;   // (dx along the reef, dz toward the beach: sitting off the spot)
        for (let i = 0; i < 60 * 60 && !got; i++) {
          const inc = g.incoming();
          if (!target && inc.w && inc.t < 6.5) target = inc.w;
          let steer = 0, paddle = false;
          if (!r.standing) {
            const wantTh = target ? Math.PI / 2 : -Math.PI / 2, d = wrap(wantTh - r.th); steer = Math.max(-1, Math.min(1, d * 2));
            if (goT < 0 && target && inc.w === target && inc.t < lead) goT = t;   // start paddling `lead` s before it arrives (negative: after)
            paddle = goT >= 0 && t - goT < 5 && Math.abs(d) < 0.5;                 // then keep paddling (up to 5 s) until it has you or it's gone
          }
          g.input.test = steer; g.input.paddleBtn = paddle; g.step(1 / 60, 1 / 60, false); t += 1 / 60;
          if (r.state === 'POP') { got = 'CAUGHT'; popV = r.v; }
          else if (r.state === 'WIPE') got = r.why;
          else if (target && inc.w !== target && !r.onFace) got = 'missed';
        }
        res.push(got || 'timeout');
      }
      out[lead] = res.join(', ');
    }
  } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; g.useBoard('short'); }
  return out;
}

// steering response: from a trim, the thumb goes to `x` and stays; how fast the board answers and how hard it turns
export async function steer(mode = 'medium', seed = 7, board = 'short', xs = [1, 0.5, 0.25]) {
  const out = {}; G().useBoard(board);
  for (const x of xs) {
    G().useBoard(board); await moment(mode, 'trim', seed); const g = G(), r = g.rider; const tr = [];
    for (let i = 0; i < 60; i++) { g.input.test = null; g.input.stick = { x, y: 0 }; g.step(1 / 60, 1 / 60, false); tr.push(Math.abs(r.turn)); if (r.state !== 'RIDE') break; }
    g.input.stick = null;
    const pk = Math.max(...tr), t50 = tr.findIndex((v) => v >= 0.5 * pk), t90 = tr.findIndex((v) => v >= 0.9 * pk);
    out['thumb ' + x] = { peakDegS: Math.round(pk * 57.3), msTo50: Math.round(t50 * 1000 / 60), msTo90: Math.round(t90 * 1000 / 60), degAfter05s: Math.round(tr.slice(0, 30).reduce((a, v) => a + v / 60, 0) * 57.3) };
  }
  // rail to rail: full one way for 0.6 s, then full the other: time until the turn has reversed
  G().useBoard(board); await moment(mode, 'trim', seed); { const g = G(), r = g.rider; let flip = -1, rev = -1;
    for (let i = 0; i < 90; i++) { const x = i < 36 ? 1 : -1; if (i === 36) { flip = i; out._sg = Math.sign(r.turn); } g.input.test = null; g.input.stick = { x, y: 0 }; g.step(1 / 60, 1 / 60, false); if (flip >= 0 && rev < 0 && r.turn * out._sg < -0.3) rev = i; }
    g.input.stick = null; delete out._sg; out.railToRailMs = rev > 0 ? Math.round((rev - flip) * 1000 / 60) : 'n/a'; }
  // the touch pad's curve: how much lean a thumb at a given share of the pad asks for
  const shape = (v) => { const a = Math.abs(v); return a < 0.08 ? 0 : Math.sign(v) * Math.pow((a - 0.08) / 0.92, window.__curve || 1.15); };
  G().useBoard('short');
  out.touchCurve = [0.25, 0.5, 0.75, 1].map((v) => `${Math.round(v * 100)}% pad -> ${Math.round(shape(v) * 100)}% lean`).join(', ');
  return out;
}

// airs: a surfer who drives hard up at the lip (the film tool's air line); how often it launches and how it lands
export function airs(mode = 'medium', seeds = [3, 7, 11, 13, 17], board = 'short') {
  const g = G(), out = { rides: 0, launches: 0, landed: 0, wipes: {} }; g.useBoard(board);
  for (const seed of seeds) {
    const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
    try {
      g.paused = true; g.setMode(mode); document.getElementById('start').style.display = 'none'; g.spawnRider();
      const b = brain({}), r = g.rider; let cb = null, inAir = false, moves0 = 0;
      for (let i = 0; i < 60 * 90; i++) {
        if (r.state === 'WIPE' || r.state === 'OUT') break;
        let o; if (!r.standing) o = b(r); else { if (!cb) { cb = carveBrainAir(); out.rides++; } o = cb(r); }
        g.input.test = o.steer; g.input.paddleBtn = r.standing ? r.v < r.wave.cond.speed * 0.85 : !!o.paddle; g.step(1 / 60, 1 / 60, false);
        if (r.air && !inAir) { inAir = true; out.launches++; moves0 = r.ride.moves.length; }
        if (!r.air && inAir) { inAir = false; if (r.state === 'WIPE') out.wipes[r.why] = (out.wipes[r.why] || 0) + 1; else if (r.ride.moves.length > moves0) out.landed++; }
      }
    } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; }
  }
  g.useBoard('short'); return out;
}
import { carveBrain } from './sim2.js';
const carveBrainAir = () => carveBrain({ hi: 0.97, lo: 0.12, gain: 4 });

// scoring: the same waves ridden by different kinds of surfer; does the better ride score more, can a lazy one farm?
export function scoring(mode = 'medium', seeds = [7, 11, 13]) {
  const g = G(), out = {};
  const riders = {
    trim: () => { const b = brain({ style: 0, pumpOn: false }); return (r) => ({ steer: b(r).steer }); },
    wiggle: () => { let t = 0; return (r) => { t += 1 / 60; return { steer: Math.sin(t * Math.PI / 0.6) > 0 ? 1 : -1 }; }; },   // thumb flicked side to side, no plan
    weave: () => { const b = brain({ style: 0, pumpOn: false }); let t = 0; return (r) => { t += 1 / 60; return { steer: Math.max(-1, Math.min(1, b(r).steer + 0.9 * Math.sin(t * Math.PI / 0.7))) }; }; },   // S-turns down the line
    carver: () => { const c = carveBrain({ hi: 0.8, lo: 0.18, gain: 3.4 }); return (r) => ({ steer: c(r).steer, pump: r.v < r.wave.cond.speed * 0.85 }); },
  };
  for (const [name, mk] of Object.entries(riders)) {
    const sc = [], why = [];
    for (const seed of seeds) {
      const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
      try {
        g.paused = true; g.setMode(mode); document.getElementById('start').style.display = 'none'; g.spawnRider();
        const b = brain({}), r = g.rider; let ctl = null;
        for (let i = 0; i < 60 * 120; i++) {
          if (r.state === 'WIPE' || r.state === 'OUT') break;
          let o; if (!r.standing) o = b(r); else { if (!ctl) ctl = mk(); o = ctl(r); }
          g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false);
        }
        sc.push(r.ride.score); why.push((r.why || '').split(':')[0] + ' ' + r.ride.t.toFixed(0) + 's');
      } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; }
    }
    out[name] = sc.map((v) => v.toFixed(1)).join(' ') + '  | ' + why.join(', ');
  }
  return out;
}

// sitting in the wrong place: the same timing (paddle 1.5 s before), moved along the reef or in/out
export function catchSpot(mode = 'medium', board = 'short') {
  const out = {};
  for (const [dx, dz] of [[-20, 0], [-10, 0], [10, 0], [20, 0], [0, -10], [0, 8]]) out[`along ${dx} in ${dz}`] = catchWindow(mode, board, [1.5], 7, 3, dx, dz)[1.5];
  return out;
}

// a deliberate air: from a trim, drop to the bottom, then turn straight up the face at the lip with speed (pumping on
// the way down), thumb back to the middle once airborne (the body lines the board up for the landing)
export async function airTry(mode = 'medium', seed = 7, upAngle = 0.35, board = 'short') {
  const g = G(); g.useBoard(board); const m = await moment(mode, 'trim', seed); if (!m.includes(': ok')) { g.useBoard('short'); return m; }
  const r = g.rider; let phase = 'drop', launched = false, res = 'no launch', peakVy = 0, peakV = 0, topFrac = 0; const fails = { frames: 0 };
  const along = Math.sign(Math.cos(r.th)) || 1;   // which way down the line
  try {
    for (let i = 0; i < 60 * 12; i++) {
      if (r.state !== 'RIDE') { res = launched ? r.why : 'wiped before launch: ' + r.why; break; }
      const sl = r.wave.prof.slice(r.s), top = Math.max(sl.top, 0.3), hTop = r.y / top;
      let want;
      if (r.air) { g.input.test = 0; g.input.paddleBtn = false; g.step(1 / 60, 1 / 60, false); if (!launched) launched = true; if (!r.air && r.state === 'RIDE') { res = 'LANDED'; break; } continue; }
      if (phase === 'drop') { want = Math.atan2(0.85, along * 0.5); if (hTop < 0.22) phase = 'up'; }   // down the face toward the beach, a bit along
      else want = Math.atan2(-1, along * upAngle);                                                     // up the face at the lip
      const d = wrap(want - r.th); g.input.test = Math.max(-1, Math.min(1, d * 3)); g.input.paddleBtn = phase === 'drop';
      g.step(1 / 60, 1 / 60, false);
      if (phase === 'up') { peakVy = Math.max(peakVy, r.vyS || 0); peakV = Math.max(peakV, r.v); topFrac = Math.max(topFrac, hTop);
        // which launch rule fails while you're up at the lip (surf.js judge: the air test)
        const C = r.wave.cond, H = C.H, sl2 = r.wave.prof.slice(r.s), onFront = r.zl > sl2.topZ - 0.3;
        if (r.y / (r.wave.fade || 1) > 0.7 * sl2.top) { fails.frames++;
          const need = { onFront, notInTube: r.s > -0.25 * H, high: r.y / (r.wave.fade || 1) > 0.78 * sl2.top, climbing: r.vyS > Math.max(2.6, 0.42 * Math.sqrt(9.8 * H)), fast: r.v > 0.8 * C.speed, pointedUp: r.upT > 0.12, settled: r.stateT > 0.8 };
          for (const [k, v] of Object.entries(need)) if (!v) fails[k] = (fails[k] || 0) + 1; } }
      if (r.air && !launched) launched = true;
    }
  } finally { g.input.test = null; g.input.paddleBtn = false; g.useBoard('short'); }
  const C = r.wave ? r.wave.cond : { H: 1, speed: 1 };
  return { res, fails: JSON.stringify(fails), climbSpeedUp: +peakVy.toFixed(1), needUp: +Math.max(2.6, 0.42 * Math.sqrt(9.8 * C.H)).toFixed(1), speed: +peakV.toFixed(1), needSpeed: +(0.8 * C.speed).toFixed(1), highestShareOfFace: +topFrac.toFixed(2), needHeight: 0.78 };
}

// the four boards on the same wave: how they catch, turn, hold speed and pump
export async function boards(mode = 'medium', seed = 7) {
  const g = G(), out = {};
  for (const b of ['short', 'fish', 'long', 'gun']) {
    const cw = catchWindow(mode, b, [-0.6, 0, 1, 3, 4, 5], seed, 1);
    g.useBoard(b); await moment(mode, 'trim', seed); const r = g.rider; let pk = 0;
    for (let i = 0; i < 60; i++) { g.input.test = null; g.input.stick = { x: 1, y: 0 }; g.step(1 / 60, 1 / 60, false); pk = Math.max(pk, Math.abs(r.turn)); if (r.state !== 'RIDE') break; }
    g.input.stick = null;
    const pm = {}; for (const k of ['none', 'hold']) { g.useBoard(b); await moment(mode, 'trim', seed); const st = line(); pm[k] = drive((rr) => ({ steer: st(rr), pump: k === 'hold' }), 6).along; }
    g.useBoard('short');
    out[b] = { catches: Object.entries(cw).filter(([, v]) => v.startsWith('CAUGHT')).map(([k]) => k).join(' '), fullThumbDegS: Math.round(pk * 57.3), pumpGain: Math.round(100 * (pm.hold / pm.none - 1)) + '%' };
  }
  return out;
}

// how smooth your view is: camera turn speed (deg/s) and how suddenly it changes (deg/s per frame, a jolt), and the
// board's roll the same way, through a scripted thumb plan and a carving ride
export async function smoothness(mode = 'medium', seed = 7) {
  const g = G(), out = {}; const q0 = new (g.camera.quaternion.constructor)();
  const measure = (ctl, frames) => {
    const r = g.rider; let prevYaw = null, prevRate = 0, maxRate = 0, maxJolt = 0, sumJolt = 0, n = 0, prevRoll = null, maxRoll = 0, prevRollRate = 0, maxRollJolt = 0;
    const e = new (g.camera.rotation.constructor)(0, 0, 0, 'YXZ');
    for (let i = 0; i < frames && r.state === 'RIDE'; i++) {
      ctl(r, i); g.step(1 / 60, 1 / 60, false);
      e.setFromQuaternion(g.camera.quaternion, 'YXZ'); const yaw = e.y;
      const rq = g.rig.quaternion, re = new (g.camera.rotation.constructor)().setFromQuaternion(rq, 'YXZ'); const roll = re.z;
      if (prevYaw !== null) {
        const rate = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw)) * 60 * 57.3, jolt = Math.abs(rate - prevRate);
        maxRate = Math.max(maxRate, Math.abs(rate)); if (i > 2) { maxJolt = Math.max(maxJolt, jolt); sumJolt += jolt; n++; } prevRate = rate;
        const rr = (roll - prevRoll) * 60 * 57.3; maxRoll = Math.max(maxRoll, Math.abs(rr)); if (i > 2) maxRollJolt = Math.max(maxRollJolt, Math.abs(rr - prevRollRate)); prevRollRate = rr;
      }
      prevYaw = yaw; prevRoll = roll;
    }
    g.input.test = null; g.input.stick = null;
    return { viewTurnMaxDegS: Math.round(maxRate), viewJoltMax: Math.round(maxJolt), viewJoltAvg: +(sumJolt / Math.max(1, n)).toFixed(1), boardRollMaxDegS: Math.round(maxRoll), boardRollJoltMax: Math.round(maxRollJolt) };
  };
  const PLAN = [[0.8, 0], [0.7, -1], [0.6, 0.75], [0.9, 0], [0.9, -0.5], [0.6, 0.5], [0.8, 0]];
  const pad = (t) => { let a = 0; for (const [d, x] of PLAN) { if (t < a + d) return x; a += d; } return 0; };
  const curve = window.__curve || 1.15, shp = (p) => { const a = Math.abs(p); return a < 0.08 ? 0 : Math.sign(p) * Math.pow((a - 0.08) / 0.92, curve); };
  await moment(mode, 'trim', seed); out.scripted = measure((r, i) => { g.input.test = shp(pad(i / 60)); }, 320);
  await moment(mode, 'trim', seed); { const c = carveBrain({ hi: 0.8, lo: 0.18, gain: 3.4 }); out.carving = measure((r) => { const o = c(r); g.input.test = o.steer; g.input.paddleBtn = r.v < r.wave.cond.speed * 0.85; }, 900); }
  await moment(mode, 'trim', seed); { let t = 0; out.flicks = measure(() => { t += 1 / 60; g.input.test = Math.sin(t * Math.PI / 0.5) > 0 ? 1 : -1; }, 240); }   // worst case: full thumb flicked side to side
  return out;
}

// airs, many tries: the deliberate air line on each spot at several climb angles and seeds; plus whether ordinary
// carving and barrel rides now launch by accident (the challenge bots)
export async function airSurvey() {
  const out = {};
  for (const m of ['easy', 'medium', 'hard']) { let n = 0, launched = 0, landed = 0; const why = {};
    for (const seed of [7, 11, 13]) for (const a of [0.2, 0.5, 1.0]) { const o = await airTry(m, seed, a); if (typeof o === 'string') continue; n++;
      if (!o.res.startsWith('wiped before launch') && o.res !== 'no launch') launched++; if (o.res === 'LANDED') landed++; else why[o.res.split(':')[0]] = (why[o.res.split(':')[0]] || 0) + 1; }
    out['try_' + m] = `${launched}/${n} launched, ${landed} landed | ${JSON.stringify(why)}`; }
  const C = await import('./chalsim.js');
  for (const m of ['easy', 'medium', 'hard', 'kanan', 'hiu']) for (const k of ['carve', 'barrel']) { const s = await C.ride(m, k, 7); out[`bot_${m}_${k}`] = s.replace(/^.*?: /, '').slice(0, 140); }
  return out;
}

// position when catching: a surfer who waits where it spawned (no repositioning) or one who paddles along the reef to
// sit just down the line of each incoming wave's peak; how many waves each catches, and where along the wave it caught
export function lineup(mode = 'medium', board = 'short', move = false, waves = 8, seed = 7) {
  const g = G(), rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = { caught: 0, tries: 0, at: [], why: {} }; g.useBoard(board);
  try {
    g.paused = true; g.setMode(mode); document.getElementById('start').style.display = 'none'; g.spawnRider();
    let target = null, t = 0, goT = -1, guard = 0;
    while (out.tries < waves && guard++ < 60 * 60 * 10) {
      const r = g.rider, inc = g.incoming();
      if (r.state === 'POP') { out.caught++; out.tries++; out.at.push(+(r.s / r.wave.cond.H).toFixed(2)); g.spawnRider(); target = null; goT = -1; continue; }
      if (r.state === 'WIPE' || r.state === 'OUT') { out.tries++; out.why[r.why.split(':')[0]] = (out.why[r.why.split(':')[0]] || 0) + 1; g.spawnRider(); target = null; goT = -1; continue; }
      if (target && inc.w !== target && !r.onFace && t - goT > 3) { out.tries++; out.why.missed = (out.why.missed || 0) + 1; target = null; goT = -1; }
      if (!target && inc.w && inc.t < 9) target = inc.w;
      let steer = 0, paddle = false;
      if (target) {
        const peakX = target.pkX + (target.px || 0) + 3, dx = peakX - r.x;   // a little down the line of where it will break
        if (move && inc.t > 3 && Math.abs(dx) > 1.5) { const want = dx > 0 ? 0 : Math.PI, d = wrap(want - r.th); steer = Math.max(-1, Math.min(1, d * 2)); paddle = Math.abs(d) < 0.6; }
        else { const d = wrap(Math.PI / 2 - r.th); steer = Math.max(-1, Math.min(1, d * 2)); if (goT < 0 && inc.t < 2.5) goT = t; paddle = goT >= 0 && Math.abs(d) < 0.5; }
      } else { const d = wrap(-Math.PI / 2 - r.th); steer = Math.max(-1, Math.min(1, d * 2)); }
      g.input.test = steer; g.input.paddleBtn = paddle; g.step(1 / 60, 1 / 60, false); t += 1 / 60;
    }
  } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; g.useBoard('short'); }
  return `${out.caught}/${out.tries} caught | s/H at catch ${out.at.join(' ')} | ${JSON.stringify(out.why)}`;
}

// catching with the PADDLE button tapped (how people press it) as well as held, starting at the game's own tips
export function tapCatch(mode = 'medium', board = 'short', seeds = [7, 11, 13]) {
  const g = G(), out = {}; g.useBoard(board);
  for (const press of ['hold', 'tap']) for (const start of ['paddleHard', 'paddleNow']) {
    let ok = 0, n = 0; const why = {};
    for (const seed of seeds) {
      const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
      try {
        g.paused = true; g.setMode(mode); document.getElementById('start').style.display = 'none'; g.spawnRider();
        const r = g.rider; let target = null, go = false, t = 0, t0 = 0, res = 'timeout';
        for (let i = 0; i < 60 * 40; i++) {
          const inc = g.incoming(); if (!target && inc.w && inc.t < 9) target = inc.w;
          let steer, paddle = false;
          // move along to where it breaks first (following the tip), then turn and paddle
          const dxT = target ? target.peelX + target.cond.peel * inc.t + 0.3 * target.cond.H - r.x : 0;
          if (target && inc.t > 3 && Math.abs(dxT) > 2.5) { const d = wrap((dxT > 0 ? 0 : Math.PI) - r.th); steer = Math.max(-1, Math.min(1, d * 2)); paddle = Math.abs(d) < 0.6; }
          else { const d = wrap((target ? Math.PI / 2 : -Math.PI / 2) - r.th); steer = Math.max(-1, Math.min(1, d * 2));
            if (!go && target && (start === 'paddleNow' ? (r.onFace && r.y > 0.3) : inc.t < 2.5)) { go = true; t0 = t; }
            paddle = go && Math.abs(d) < 0.5 && (press === 'hold' || ((t - t0) * 2.5) % 1 < 0.5); }
          g.input.test = steer; g.input.paddleBtn = paddle && !r.standing; g.step(1 / 60, 1 / 60, false); t += 1 / 60;
          if (r.state === 'POP') { res = 'CAUGHT'; break; } if (r.state === 'WIPE' || r.state === 'OUT') { res = r.why.split(':')[0]; break; }
          if (target && inc.w !== target && !r.onFace && go) { res = 'missed'; break; }
        }
        n++; if (res === 'CAUGHT') ok++; else why[res] = (why[res] || 0) + 1;
      } finally { Math.random = rnd0; g.input.test = null; g.input.paddleBtn = false; }
    }
    out[`${press} from ${start}`] = `${ok}/${n} ${Object.keys(why).length ? JSON.stringify(why) : ''}`;
  }
  g.useBoard('short'); return out;
}
