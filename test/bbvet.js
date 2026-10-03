// Bodyboard vet (3 Oct 2026, BODYBOARD_PLAN.md stage 2): the test pro rides a wave lying on the bodyboard with one of film.js's
// plans ('carve', 'barrel', 'snap', 'cut') and logs every half second what happened: state, speed, in the barrel, where your
// eyes are (height over the board and over the water) and whether the water ever covers the lens. stopAt: seconds into the
// ride to stop (the game left paused there, for a screenshot of what you see).
//   const B = await import('./test/bbvet.js?v=' + Date.now()); await B.ride({ mode: 'kanan', seed: 5, plan: 'barrel' })
const G = () => window.__g;
export async function ride({ mode = 'medium', seed = 5, plan = 'carve', stance = 'goofy', board = 'body', maxS = 30, stopAt = null, stopTube = null, stall = null, trick = null, stopSpin = null, hold = false, spinH = [0.3, 0.7], spinV = [0.6, 9], gap = 2.5, cbo } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), SU = await import('../js/surf.js?v=235'), g = G(), nm = 'bb' + Math.random(), n = 30 * maxS;
  g.useStance(stance); FM.addPro(nm, mode, seed, n, board, plan, cbo); const t = FM.takes[nm]; t.init();
  const r = g.rider, c = g.camera, log = [], V = c.position.constructor, lc = new V();
  // stall: [from, to] s into the ride, STALL held. trick: 'spinner' (every 2.5 s on the face: one STALL press, thumb hard over),
  // 'roll' / 'ars' / 'r360' in the air (a STALL press just after take-off; ars and r360 also spin the thumb over)
  const upd = r.update, tr = { tries: 0, spinners: 0, airs: 0, lastTry: -9, dir: 1, press: 0 };
  r.update = function (dt, inp, w) {
    if (stall && r.state === 'RIDE' && r.stateT > stall[0] && r.stateT < stall[1]) inp.stall = 1;
    if (trick === 'spinner' && r.state === 'RIDE' && !r.air && !r.spin && r.stateT > 2 && r.ride.t - tr.lastTry > gap && r.wave) { const sl = r.wave.prof.slice(r.s), hR = r.y / Math.max(0.3, sl.top), vk = r.v / r.wave.cond.speed; if (hR > spinH[0] && hR < spinH[1] && vk > spinV[0] && vk < spinV[1] && !r.inBarrel) {   /* (spinH, spinV: where on the face and how fast the test pro tries it: sloppy on purpose to check the skill) */ tr.lastTry = r.ride.t; tr.tries++; tr.dir = Math.random() < 0.5 ? -1 : 1; tr.press = hold ? 90 : 18; } }
    if (tr.press > 0) { inp.stall = 1; inp.steer = tr.dir; tr.press--; if (r.spin && !tr.counted) { tr.counted = true; tr.spinners++; } if (tr.press === 0) tr.counted = false; }   // (spinner: STALL and the thumb hard over held together, as a player does: hold: true keeps holding through the spin)
    if (trick && trick !== 'spinner' && r.air) { const A = r.air; if (!A.counted) { A.counted = true; tr.airs++; tr.dir = Math.random() < 0.5 ? -1 : 1; }
      if (trick === 'roll' || trick === 'ars') inp.stall = A.t > 0.05 && A.t < 0.1 ? 1 : 0;
      if ((trick === 'ars' || trick === 'r360') && A.t > 0.3) inp.steer = Math.abs(A.spin) < 2 * Math.PI ? tr.dir : 0; }
    return upd.call(r, dt, inp, w); };
  let rideT = 0, maxV = 0, tube = 0, under = 0, minEye = 9, maxEye = -9, popAt = null; const lp = c.position.clone(), lq = c.quaternion.clone(), jerks = [];   // (the camera's move each frame, relative to the board: a jump or a snap shows as a spike)
  const lrel = new V(); let lrelOk = false;
  for (let i = 0; i < n; i++) {
    t.frame(i);
    if (popAt === null && r.standing) popAt = i;
    if (r.state === 'RIDE') { rideT += 1 / 30; maxV = Math.max(maxV, r.v); if (r.inBarrel) tube += 1 / 30; }
    lc.copy(c.position); g.rig.worldToLocal(lc);
    { const ang = lq.angleTo(c.quaternion) * 57.3, jump = lrelOk ? lrel.distanceTo(lc) : 0; lq.copy(c.quaternion); lrel.copy(lc); lrelOk = true; if (r.state !== 'WIPE') jerks.push([i, ang, jump, r.state]); }
    const overW = c.position.y - SU.heightAt(g.waves, c.position.x, c.position.z);   // (how far the lens is above the water right there: below 0 it's under)
    if (r.standing) { minEye = Math.min(minEye, lc.y); maxEye = Math.max(maxEye, lc.y); if (overW < 0.02) under++; }
    if (i % 15 === 0) log.push([+(i / 30).toFixed(1), r.state, +r.v.toFixed(1), r.inBarrel ? 'TUBE' : '', +lc.y.toFixed(2), +overW.toFixed(2)]);
    if (stopSpin != null && r.spin && r.spin.t >= stopSpin) { delete r.update; return { spinT: r.spin.t, th: r.th }; }
    if ((stopAt != null && rideT >= stopAt) || (stopTube != null && tube >= stopTube)) { delete r.update; } if ((stopAt != null && rideT >= stopAt) || (stopTube != null && tube >= stopTube)) return { stopped: +rideT.toFixed(2), state: r.state, v: +r.v.toFixed(1), eye: +lc.y.toFixed(2), overW: +overW.toFixed(2) };
    if (r.state === 'WIPE' || r.state === 'OUT') break;
  }
  delete r.update; t.done && t.done(); if (board !== 'short') g.useBoard(board);   // (film's done() puts the shortboard back: keep ours, the ride may still be wiping out)
  const win = popAt === null ? [] : jerks.filter((j) => j[0] >= popAt - 15 && j[0] <= popAt + 45), mx = (a, k) => a.reduce((m, j) => Math.max(m, j[k]), 0);
  const catchCam = { maxTurnDegPerFrame: +mx(win, 1).toFixed(1), maxEyeJumpCmPerFrame: +(100 * mx(win, 2)).toFixed(1) }, rideCam = { maxTurnDegPerFrame: +mx(jerks.filter((j) => j[3] === 'RIDE'), 1).toFixed(1), maxEyeJumpCmPerFrame: +(100 * mx(jerks.filter((j) => j[3] === 'RIDE'), 2)).toFixed(1) };
  return { moves: r.ride.moves.map((m) => m.name + (m.notes && m.notes.length ? '(' + m.notes.join(',') + ')' : '') + ' ' + m.pts.toFixed(1)), tr, catchCam, rideCam, mode, plan, stance, caught: popAt !== null, rideS: +rideT.toFixed(1), maxV: +maxV.toFixed(1), tubeS: +tube.toFixed(1), score: r.ride.score, end: r.state, why: r.why || '', eyeOverBoard: [+minEye.toFixed(2), +maxEye.toFixed(2)], lensUnderFrames: under, log };
}
// the air tricks on their own, whatever the take-off (as airvet.forced): high on the face the test pro is thrown up at vy (m/s)
// and in the air does trick: 'none', 'roll' (a STALL press), 'ars' (the press and the thumb spinning right round), 'r360'
export async function forcedAir({ mode = 'medium', seed = 5, trick = 'roll', vy = 5, stance = 'goofy', tries = 4, stopAt = null, spinTo = 1.8 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), res = [];
  for (let k = 0; k < tries; k++) {
    g.useStance(stance); const nm = 'bf' + Math.random(), n = 30 * 25; FM.addPro(nm, mode, seed + k, n, 'body', 'carve'); const t = FM.takes[nm]; t.init();
    const r = g.rider, upd = r.update, c = g.camera; let launched = false, dir = k % 2 ? 1 : -1, airT = 0, maxTurn = 0, maxRollSeen = 0; const lq = c.quaternion.clone();
    r.update = function (dt, inp, w) {
      if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s), top = Math.max(0.3, sl.top); if (r.y > 0.7 * top && r.s > -0.2 * r.wave.cond.H) { launched = true; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
      const A = r.air;
      if (A) { inp.stall = (trick === 'roll' || trick === 'ars') && A.t > 0.05 && A.t < 0.1 ? 1 : 0; if ((trick === 'ars' || trick === 'r360') && A.t > 0.3) inp.steer = Math.abs(A.spin) < spinTo * Math.PI ? dir : 0; }   // (let go near the end, the instinct brings it the rest of the way; a 360 counts from 315 deg of your own spin)
      return upd.call(r, dt, inp, w); };
    let i = 0, landedAt = -1;
    for (; i < n; i++) { t.frame(i); if (r.air) { airT += 1 / 30; maxRollSeen = Math.max(maxRollSeen, Math.abs(r.air.rollA || 0)); }
      const ang = lq.angleTo(c.quaternion) * 57.3; lq.copy(c.quaternion); if (launched && landedAt < 0) maxTurn = Math.max(maxTurn, ang);
      if (stopAt != null && r.air && r.air.t >= stopAt) { delete r.update; return { stoppedAt: r.air.t, rollA: r.air.rollA, spin: r.air.spin }; }
      if (launched && !r.air && landedAt < 0 && r.state === 'RIDE') landedAt = i; if (r.state === 'WIPE' || r.state === 'OUT') break; if (landedAt >= 0 && i - landedAt > 45) break; }
    const ms = r.ride.moves.filter((m) => /AIR|ROLLO|ARS/.test(m.name)).map((m) => m.name + ' ' + m.pts.toFixed(2));
    res.push({ launched, airT: +airT.toFixed(2), end: r.state, why: (r.why || '').slice(0, 44), moves: ms.join(','), trick: r.trick ? r.trick.name : '', maxViewTurnDegPerFrame30: +maxTurn.toFixed(1) });
    delete r.update; t.done(); g.useBoard('body');
  }
  return res;
}
// a person's spinner, through the game's own controls (3 Oct 2026, after 'now cannot even spin': the test pro pressed both in the
// same frame and passed, a person never does). The pro rides to the middle of a face with speed, then hands over: 'keys' (arrow +
// Shift, the arrow building up as it does) or 'thumb' (thumb hard over at once + the STALL button). order: 'steer' (thumb/arrow
// first, STALL after delay s), 'stall' (STALL first), 'carve' (steering 1 s first: must NOT spin), 'brake' (STALL 1 s first: must NOT spin)
export async function humanSpin({ mode = 'medium', seed = 5, device = 'keys', order = 'steer', delay = 0.15, dir = 1, holdS = 1.6 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'hs' + Math.random(); FM.addPro(nm, mode, seed, 900, 'body', 'carve'); const t = FM.takes[nm]; t.init();
  const r = g.rider; let i = 0;
  for (; i < 900; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (r.state === 'RIDE' && r.ride.t > 3 && r.wave && Math.abs(r.turn) < 0.3) { const sl = r.wave.prof.slice(r.s), hR = r.y / Math.max(0.3, sl.top); if (hR > 0.35 && hR < 0.65 && r.v > 0.75 * r.wave.cond.speed) break; } }
  if (r.state !== 'RIDE') { t.done(); g.useBoard('body'); return { order, device, setup: 'never got set up: ' + r.state }; }
  const inp = g.input, K = g.keys; inp.test = null; inp.stick = null; inp.paddleBtn = false;
  const arrow = dir > 0 ? 'ArrowRight' : 'ArrowLeft', T = (s) => Math.round(s * 60);
  const steerAt = order === 'steer' ? 0 : order === 'stall' ? delay : order === 'carve' ? 0 : order === 'brake' ? 1.0 : 0, stallAt = order === 'steer' ? delay : order === 'stall' ? 0 : order === 'carve' ? 1.0 : order === 'brake' ? 0 : 0;
  let spun = false, at = null; const n = T(Math.max(steerAt, stallAt) + holdS);
  for (let k = 0; k < n; k++) { const s = k / 60;
    if (s >= steerAt) { if (device === 'keys') K.add(arrow); else inp.stick = { x: dir, y: 0 }; }
    if (s >= stallAt) { if (device === 'keys') K.add('ShiftLeft'); else inp.stallBtn = true; }
    g.step(1 / 60, 1 / 60, false);
    if (r.spin && !spun) { spun = true; at = +s.toFixed(2); }
    if (r.state === 'WIPE') break; }
  K.delete(arrow); K.delete('ShiftLeft'); inp.stick = null; inp.stallBtn = false;
  for (let k = 0; k < 90 && r.state === 'RIDE'; k++) g.step(1 / 60, 1 / 60, false);
  const res = { device, order, delay, spun, startedAt: at, landed: r.ride.moves.some((m) => m.name === 'SPINNER'), end: r.state === 'WIPE' ? r.why : r.state };
  t.done(); g.useBoard('body'); return res;
}
