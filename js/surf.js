// Surf physics: a board on the real water surface.
// World: x runs along the reef (the break peels toward +x: facing the beach that is to your LEFT, a left-hander like Uluwatu), z points to the beach, y is up.
// Waves roll in along +z at their speed c and break along the reef at the peel rate. The board moves freely in x/z;
// its height is the water surface under it. Forces: gravity down whatever slope you're on, the water moving with the
// wave, drag (low along the board, very high sideways once you're standing: that's the fins), paddling, pumping.
// Catching, stalling, barrels, kick-outs and wipeouts all come out of that, not out of scripts.

export const RIDE = {
  g: 9.8,
  // lying on the board
  paddleThrust: 2.6, paddleMax: 2.4,   // arms: thrust (m/s^2) fading to nothing at paddleMax (m/s); a good paddler holds ~1.8 m/s
  lieDrag: 0.25, lieDrag2: 0.3, lieLat: 2.2,   // a lying board sits in the water: the moving water grabs it
  lieTurn: 1.5, paddleTurn: 1.1,       // rad/s turning while sitting / paddling
  lieGravity: 0.9,                     // a lying board is half in the water: less of the slope turns into speed
  // standing
  drag: 0.09, drag2: 0.013,            // planing drag along the board
  // carving works like a skier or a leaning bike: you tip the board onto its rail and the lean makes the turn,
  // turn rate = g * tan(lean) / speed. The fins hold up to gripMax sideways; lean past that and the tail drifts out.
  leanMax: 1.25, leanRate: 9.0, leanEase: 14, yawLag: 0.08, railBite: 0.3, tailLet: 0.35, tailBack: 0.3,        // full thumb = ~66 deg on the rail (a ~2.3 g carve); how fast you can roll the board over (rad/s)   (answers like a real shortboard: turning within ~0.2 s, a full turn in under half a second; the long boards keep their slow, heavy response)
  snap: 1,   // how freely the tail lets go in a snap at the top of the face (a shortboard's full; big boards less)
  finGrip: 4.2, gripMax: 24, relFrom: 0.45,            // sideways: fins kill sliding at this rate, up to this much force (m/s^2): a buried rail holds ~2 g
  skidLoss: 0.16,                      // share of the excess sideways force lost as speed while the tail drifts
  glide: 0.7,                          // share of the fins' braking given back in a carve (0 = raw physics, 1 = no loss)
  stallDrag: 3.0,                      // full brake (back foot + hand drag) slows you by this (m/s^2)
  stallBite: 1.1,                      // ...and more at first: the tail digs in hard, then the brake eases to the steady drag above (x (1 + this), fading over ~0.5 s)
  planeV: 3.6,                         // below this speed through the water a stalled board stops planing: the tail sinks (hold on and you fall)
  pump: 0.5,                           // how hard a pump stroke drives the board (see the stroke in step: 4 x this at its peak, m/s^2)
  popTime: 0.6,                        // seconds from lying to standing (real surfers take about 0.6-1.2 s; it was 0.35)
  waterPush: 1.0,                      // how much the wave's moving water carries you
  catchK: 1,                           // how much speed and slope a board needs to catch a wave (bigger boards: less)
  catchPaddle: 0.9,                    // seconds you must already be paddling when the wave lifts you (bigger boards: less)
  catchReach: 1.0,                     // how far ahead of the breaking part (in wave heights) you can still catch it (bigger boards: further)
  catchLate: 1.7,                      // seconds after the wave first lifts you that it can still take you (bigger boards: longer)
  turnMin: 1,                          // share of the shortboard's turn rate that counts as a real turn
  air: true,                           // can this board launch an air
};

// The boards. Each changes the physics the way the real thing does (relative to the 6'2" shortboard above):
//   fish      5'8" wide twin fin: paddles and planes easily and holds speed with little pumping; loose, skatey turns that
//             (a touch more turn at full thumb than the shortboard, and the tail lets go from a gentler lean: relFrom)
//             drift early; less grip on steep heavy waves
//   longboard 9'2": paddles fast and catches waves early; very stable and glides; slow, wide turns; no snaps or airs
//   gun       9'6" big-wave board: paddles into huge waves early; holds a line at high speed with lots of grip; stiff turns
const BASE = { ...RIDE, walk: false };   // (walk: false here, or a longboard picked earlier left every board walking to the nose on PUMP, found 29 Sep 2026)
const BOG_FALL = 1.1;
const NOSE_STEP = 0.38, NOSE_BACK = 0.24, PEARL_T = 0.8, WOB_MAX = 0.3, WOB_STEER = 3.2;   // (the rock at the nose: how far it can tip before you fall, rad; how hard your thumb pushes it back)   // (one cross-step up or down the longboard, s; how long the nose can be out of the pocket before it digs in)   // seconds a board can sit below planing speed in a stall before the tail sinks and you fall
export const BOARDS = {
  short: {},
  fish: { planeV: 3.0, snap: 0.85, paddleThrust: 3.0, paddleMax: 2.7, drag: 0.07, drag2: 0.011, leanMax: 1.3, relFrom: 0.3, leanRate: 10.0, yawLag: 0.06, railBite: 0.25, gripMax: 18, tailLet: 0.25, skidLoss: 0.12, glide: 0.78, pump: 0.62, catchK: 0.85, catchPaddle: 0.6, catchLate: 1.9, catchReach: 1.4 },
  long: { planeV: 2.3, walk: true, snap: 0.3, paddleThrust: 3.4, paddleMax: 3.1, lieDrag: 0.18, drag: 0.075, drag2: 0.009, leanMax: 0.85, leanRate: 4.0, leanEase: 7, yawLag: 0.35, railBite: 0.42, gripMax: 20, glide: 0.82, pump: 0.3, popTime: 0.85, catchK: 0.65, catchPaddle: 0.35, catchLate: 2.5, catchReach: 3.0, air: false, turnMin: 0.55 },
  gun: { planeV: 3.0, snap: 0.45, paddleThrust: 3.2, paddleMax: 3.0, lieDrag: 0.2, drag: 0.08, drag2: 0.009, leanMax: 1.0, leanRate: 5.0, leanEase: 7, yawLag: 0.25, railBite: 0.35, finGrip: 5.0, gripMax: 30, glide: 0.75, pump: 0.4, popTime: 0.72, catchK: 0.75, catchPaddle: 0.5, catchLate: 2.0, catchReach: 1.8, turnMin: 0.75 },
};
export function setBoard(name) { Object.assign(RIDE, BASE, BOARDS[name] || {}); }

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The surface of one wave, slice by slice (cached per 20 cm of s): the front (flat water in front, up the face to the top)
// and the back (from behind the wave up to the crest). Heights in the wave's own frame: zl = z - wave.zW.
// what each move is worth before how well and where you did it (28 Sep 2026: turns, snaps and cutbacks raised so a
// wave of hard, committed turns in the pocket can score like a barrel, as real judges score it)
const LINK_TOP = new Set(['SNAP', 'CUTBACK', 'FLOATER', 'AIR', 'AIR 360']);   // (the moves a bottom turn sets up)
export const MOVE_BASE = { TURN: 1.0, CARVE: 3.8, SNAP: 4.4, CUTBACK: 4.6, FLOATER: 3.9, AIR: 5.6, 'AIR 360': 7.0, 'HANG FIVE': 3.6, 'HANG TEN': 5.2, ROUNDHOUSE: 5.8, 'LATE DROP': 4.0 };   // (airs kept above the turns: the hardest move scores most)
export const MOVE_BASE_OLD = { TURN: 0.9, SNAP: 2.2, CUTBACK: 2.4, FLOATER: 2.0, AIR: 3.0, 'AIR 360': 4.2 };
const JUDGE_K = 6;   // (28 Sep 2026: with quality over quantity below, 3 to 5 great moves reach the 8s; was 8)   // how hard the top of the scale is (calibrated with test riders: see HANDOVER)

export class Profile {
  constructor(wave) { this.w = wave; this.cache = new Map(); this.buf = new Float32Array(256); }
  slice(s) {
    const key = Math.round(s * 5);
    let c = this.cache.get(key);
    if (c) return c;
    const w = this.w, o = this.buf, H = w.cond.H, sk = key / 5; w.section(sk, o);
    const F = [[o[0], o[1]]];
    let j = 1;
    for (; j < 64; j++) { const z = o[j * 4], y = o[j * 4 + 1], p = F[F.length - 1]; if (z >= p[0] - 1e-4 || y < p[1] - 1e-3) break; F.push([z, y]); }
    const B = [[o[63 * 4], o[63 * 4 + 1]]];
    for (let k = 62; k > j; k--) { const z = o[k * 4], y = o[k * 4 + 1], p = B[B.length - 1]; if (z <= p[0] + 1e-4 || y < p[1] - 1e-3) break; B.push([z, y]); }
    // the underside of the lip, where the wave overhangs the face: from the top of the face out along the tube's
    // ceiling to the lip's tip (z increasing). Nothing to ride on, but it's the roof of the barrel
    const U = [F[F.length - 1]];
    for (let k = j; k < 64; k++) { const z = o[k * 4], y = o[k * 4 + 1]; if (z <= U[U.length - 1][0] + 1e-4) break; U.push([z, y]); }
    const sh = w.shapeAt(sk), amp = w.amp(sk);
    c = { F, B, U, top: Math.max(F[F.length - 1][1], B[B.length - 1][1]), topZ: F[F.length - 1][0], broken: sh.broken, curl: sh.curl,
      lipY: sh.P[7][1] * H * amp, lipZ: sh.P[7][0] * H * (w.cond.width || 1) };
    if (this.cache.size > 6000) this.cache.clear();
    this.cache.set(key, c);
    return c;
  }
  // work out the shape a little at a time in quiet frames, so the first time a wave reaches you there's no hitch
  warm(n) {
    const L = this.w.cond.len || 1;
    if (this.warmK === undefined) this.warmK = Math.round(-50 * L * 5);
    for (let i = 0; i < n && this.warmK <= 66 * L * 5; i++, this.warmK++) this.slice(this.warmK / 5);
  }
  // height blended between the two nearest slices, so the surface is continuous along the wave (no 20 cm steps)
  height(s, zl) {
    const k = s * 5, k0 = Math.floor(k), t = k - k0;
    const h0 = this.heightSlice(this.slice(k0 / 5), zl);
    return t < 1e-3 ? h0 : h0 + (this.heightSlice(this.slice((k0 + 1) / 5), zl) - h0) * t;
  }
  heightSlice(c, zl) {
    const F = c.F, B = c.B;
    if (zl >= F[0][0]) return 0;
    if (zl >= F[F.length - 1][0]) {
      for (let i = 1; i < F.length; i++) if (zl >= F[i][0]) { const t = (zl - F[i][0]) / (F[i - 1][0] - F[i][0] || 1e-6); return F[i][1] + (F[i - 1][1] - F[i][1]) * t; }
    }
    // under an overhanging lip the face ends at the tube's roof: past the top of that wall there's no riding surface up at
    // the crest (a jump up to it popped you onto the back of the wave), so the height stays at the wall's top
    // (under an overhanging lip, anywhere behind the top of the face is capped at that top: the back of the wave there is
    // on the far side of the tube's roof, not a surface you can step up onto)
    const cap = c.U && c.U.length >= 3 && c.curl > 0.3 ? F[F.length - 1][1] : Infinity;   // (only where the lip is actually throwing)
    if (zl <= B[0][0]) return 0;
    if (zl <= B[B.length - 1][0]) {
      for (let i = 1; i < B.length; i++) if (zl <= B[i][0]) { const t = (zl - B[i][0]) / (B[i - 1][0] - B[i][0] || 1e-6); return Math.min(cap, B[i][1] + (B[i - 1][1] - B[i][1]) * t); }
    }
    return Math.min(cap, c.top);                      // over the crest
  }
  // the height of the tube's roof above a point (in the wave's own frame), or Infinity where nothing hangs overhead
  ceiling(s, zl) {
    const c = this.slice(s), U = c.U;
    if (c.curl <= 0.3 || U.length < 3 || zl <= U[0][0] || zl >= U[U.length - 1][0]) return Infinity;
    for (let i = 1; i < U.length; i++) if (zl <= U[i][0]) { const t = (zl - U[i - 1][0]) / Math.max(1e-6, U[i][0] - U[i - 1][0]); return U[i - 1][1] + (U[i][1] - U[i - 1][1]) * t; }
    return Infinity;
  }
  // how far toward the beach the falling lip hangs at height y (the curtain in front of you in the barrel): the inside of
  // the tube is between the face and this. Infinity where no lip hangs at that height
  curtainZ(s, y) {
    const c = this.slice(s), U = c.U;
    if (c.curl <= 0.3 || U.length < 3) return Infinity;
    let k = 0; for (let i = 1; i < U.length; i++) if (U[i][1] > U[k][1]) k = i;   // the top of the roof; the curtain falls from here to the lip's tip
    if (y >= U[k][1] || y <= U[U.length - 1][1]) return Infinity;
    for (let i = k + 1; i < U.length; i++) if (U[i][1] <= y) { const t = (U[i - 1][1] - y) / Math.max(1e-6, U[i - 1][1] - U[i][1]); return U[i - 1][0] + (U[i][0] - U[i - 1][0]) * t; }
    return Infinity;
  }
  // how far toward the beach the face reaches at height y (anything shoreward of this is open air in front of the wave)
  frontZAt(s, y) {
    const F = this.slice(s).F;
    for (let i = 1; i < F.length; i++) if (F[i][1] >= y) { const t = (y - F[i - 1][1]) / Math.max(1e-6, F[i][1] - F[i - 1][1]); return F[i - 1][0] + (F[i][0] - F[i - 1][0]) * t; }
    return F[F.length - 1][0];
  }
}

// Everything the rider needs to know about the water at a point: which wave, where on it, how high
export function waterAt(waves, x, z, out) {
  out.y = 0; out.w = null;
  for (const w of waves) {
    const sp = w.span(), s = x - w.peelX; if (s < sp.sLo || s > sp.sHi) continue;
    const zl = z - w.zW - w.bend(s); if (zl > sp.zHi || zl < sp.zLo) continue;   // same curved crest line as the drawn wave
    let y = w.prof.height(s, zl);
    if (w.closing && w.profW) { const m = w.closeMask(s); if (m > 0) y += (w.profW.height(s, zl) - y) * m; }   // (closing out: the same blend into whitewater as the drawn wave)
    y *= w.fade;
    if (y > out.y || !out.w) { out.y = y; out.w = w; out.s = s; out.zl = zl; }
  }
  return out;
}
export const PUMP_STROKE = 0.75, PUMP_PERIOD = 0.75;   // (a stroke fills the whole period: one pump flows into the next, never a pause between)   // seconds one pump stroke lasts; seconds between strokes while PUMP is held
const _q = {}, _c = {}, IDLE = { paddle: false, pump: false, steer: 0 };
export function heightAt(waves, x, z) { return waterAt(waves, x, z, _q).y; }

// The wave's score, out of 10 like a contest judge: the best moves count most (each one after counts less), doing the
// same move again is worth less and less, different kinds of big move earn a variety bonus, speed and a clean finish a
// little. A move you fall on doesn't count. And the judges' rule for the excellent range (8 and up): it takes more than
// one thing. Without two different strong moves (or three strong ones), a wave tops out just under 8, however long
// the barrel. detail = the judges' sheet: what counted, each line's share of the score (they add up to it).
// old = the scoring before 28 Sep 2026 (for comparing in tests only)
export function scoreRide(r, fell = false, detail = false, old = false) {
  const ms = (fell ? r.moves.filter((m) => m.t < r.t - 0.8) : r.moves).map((m) => (old && MOVE_BASE_OLD[m.name] && m.base ? { ...m, pts: m.pts * (m.base - MOVE_BASE[m.name] + MOVE_BASE_OLD[m.name]) / m.base } : m));
  const hasBig = ms.some((m) => m.name !== 'TURN');   // (a hard carve is the wave's main move only on a wave of carves: next to barrels and snaps it's a linking turn again)
  const seen = {}, items = [...ms].sort((a, b) => b.pts - a.pts).map((m) => { const n = (seen[m.name] = (seen[m.name] || 0) + 1), pts = hasBig && m.name === 'TURN' && m.base === MOVE_BASE.CARVE ? m.pts * MOVE_BASE.TURN / MOVE_BASE.CARVE : m.pts; return { m, n, v: pts * Math.pow(m.name === 'TURN' ? 0.7 : 0.5, n - 1) }; }).sort((a, b) => b.v - a.v);   // (your best one of each move counts in full, the others less)
  const W = [1, 0.85, 0.65, 0.1, 0.06, 0.035, 0.02, 0.01];   // (quality over quantity, like the judges: your best three moves decide the wave)
  items.forEach((it, i) => (it.w = it.v * (W[i] || 0.005)));
  let raw = items.reduce((a, it) => a + it.w, 0);
  const kinds = new Set(ms.filter((m) => m.name !== 'TURN').map((m) => m.name.replace('AIR 360', 'AIR'))).size, variety = 0.4 * Math.max(0, kinds - 1);
  const flow = Math.min(0.4, r.speed * 0.015), finish = r.end && !fell ? 0.4 : 0;
  raw += variety + flow + finish;
  if (fell) raw *= 0.85;
  raw *= r.judge ?? 1;   // (29 Sep 2026, his call: the harder the wave, the more the same ride is worth, like real judging: see CONDITIONS judge)
  let score = 10 * (1 - Math.exp(-raw / JUDGE_K));
  const strong = ms.filter((m) => m.strong && m.name !== 'TURN'), strongKinds = new Set(strong.map((m) => m.name.replace('AIR 360', 'AIR'))).size;
  const excellentOk = old || strongKinds >= 2 || strong.length >= 3;
  if (!excellentOk && score > 7.5) score = 7.5 + 0.4 * (1 - Math.exp(-(score - 7.5) / 0.4));   // (one thing alone: very good, never excellent)
  score = Math.round(10 * score) / 10;
  if (!detail) return score;
  const share = (x) => (raw > 0 ? score * x * (fell ? 0.85 : 1) / raw : 0);
  const lines = items.filter((it) => it.w > 0.05).slice(0, 6).map((it) => ({ name: it.m.name, dur: it.m.dur, notes: it.n > 1 ? [...it.m.notes, 'repeated'] : it.m.notes, pts: share(it.w) }));
  if (variety) lines.push({ name: 'VARIETY', notes: [], pts: share(variety) });
  if (flow + finish > 0.05) lines.push({ name: finish ? 'SPEED + CLEAN FINISH' : 'SPEED', notes: [], pts: share(flow + finish) });
  return { score, lines, fell, excellentOk };
}
export class Rider {
  constructor() { this.reset(0, -6, -Math.PI / 2); }
  reset(x, z, th) {
    this.x = x; this.z = z; this.y = 0; this.vx = 0; this.vz = 0; this.th = th;
    this.state = 'LIE'; this.stateT = 0; this.why = ''; this.washed = false;
    this.paddling = false; this.paddleT = 0; this.padUp = 0; this.liftT = 0; this.catchT = 0;
    this.turn = 0; this.lean = 0; this.skid = 0; this.relS = 1; this.v = 0; this.hx = 0; this.hz = 0; this.gAlong = 0;
    this.wave = null; this.s = 99; this.zl = 99; this.inBarrel = false; this.onFace = false; this.lowT = 0;
    this.air = null; this.vyS = 0; this.hitV = 0; this.vyPk = 0; this.prevY = undefined;
    this.pumpWas = false; this.pumpN = 0; this.pumpGap = 9; this.pumpT = 9; this.pumpQ = 0; this.weave = 0; this.pumping = false; this.foamT = 0; this.backT = 0; this.wwFloatT = 0; this.tubeOut = 0; this.turnHold = 0; this.recentPaddle = 0; this.slide = 0; this.stalling = 0;
    this.ride = { t: 0, top: 0, barrel: 0, pocket: 0, turns: 0, cutbacks: 0, snaps: 0, speed: 0, end: 0, score: 0, moves: [], tubeT: 0, leanPk: 0, gPk: 0, tubeDeep: 0, combo: 0, lastMoveT: -9 }; this.turnSign = 0; this.tyMin = this.tyMax = undefined; this.cbArmed = false; this.snapArm = 0; this.snapK = 0; this.snapPk = 0; this.lipPush = 0; this.lipHit = false; this.trick = null;
  }
  set(state) { this.state = state; this.stateT = 0; }
  get standing() { return this.state === 'POP' || this.state === 'RIDE'; }
  get active() { return this.state !== 'OUT' && this.state !== 'WIPE'; }

  update(dt, inp, waves) {
    this.stateT += dt;
    if (this.state === 'WIPE') return;
    // after a ride ends you sit on your board and the wave rolls on under you: keep the water physics going, no control
    const idle = this.state === 'OUT', use = idle ? IDLE : inp;
    const n = dt > 0.02 ? 3 : 2, h = dt / n;
    for (let i = 0; i < n && this.state !== 'WIPE' && (idle || this.state !== 'OUT'); i++) this.step(h, use, waves);
  }

  step(h, inp, waves) {
    if (this.air) return this.airStep(h, inp, waves);
    const P = RIDE, g = P.g;
    // the water here: height, slope (finite differences), which wave
    const q = waterAt(waves, this.x, this.z, _c), e = 0.15;
    const hx = (heightAt(waves, this.x + e, this.z) - heightAt(waves, this.x - e, this.z)) / (2 * e);
    const hz = (heightAt(waves, this.x, this.z + e) - heightAt(waves, this.x, this.z - e)) / (2 * e);
    this.y = q.y; this.hx = hx; this.hz = hz; this.wave = q.w; this.s = q.w ? q.s : 99; this.zl = q.w ? q.zl : 99;
    const w = q.w, C = w ? w.cond : null, H = C ? C.H : 1, cw = C ? C.speed : 0;
    // how fast the board is rising: climbing the slope as you move, plus the face lifting as the wave runs in under you
    // (smooth, from the slope; the height itself can step between the face and the crest), eased like a real body would
    this.vyS += (Math.max(-12, Math.min(12, hx * this.vx + hz * (this.vz - cw))) - this.vyS) * Math.min(1, h * 12);
    // pointing straight up the face without carving (the run at the lip that makes an air, not the swing of a turn)
    this.upT = this.standing && Math.sin(this.th) < -0.2 && Math.abs(this.turn) < 1.7 ? (this.upT || 0) + h : 0;
    // what you carry into the lip: the speed and climb of your run at it over the last moment, not what's left the
    // instant you touch it (the climb itself scrubs speed, so judging the very top left airs almost impossible)
    this.hitV = Math.max(this.v, (this.hitV || 0) - 2.5 * h); this.vyPk = Math.max(this.vyS, (this.vyPk || 0) - 8 * h);
    const dx = Math.cos(this.th), dz = Math.sin(this.th);
    const slope2 = hx * hx + hz * hz;
    this.gAlong = hx * dx + hz * dz;                                   // rise per metre in the direction the board points
    // the water itself moves with the wave (shoreward, strongest under the crest), and the whitewater is a moving bore
    // (shallow-water flow c*y/(d+y) on a gentle swell; on a steep face near breaking the water at the crest moves at nearly c,
    //  which is exactly why it breaks: that's what picks a paddling surfer up)
    const sl = w ? w.prof.slice(q.s) : null;
    const d = H / 0.78, slopeNow = Math.sqrt(hx * hx + hz * hz);
    const steep = smooth(0.35, 1.2, slopeNow), hRel = sl ? Math.min(1, q.y / Math.max(0.3, sl.top * (w.fade || 1))) : 0;
    let uz = w ? cw * Math.max(q.y / (d + q.y), Math.pow(hRel, 1.3) * (0.35 + 0.55 * steep)) * P.waterPush : 0;
    if (sl && sl.broken > 0.3 && q.zl > sl.topZ - 1.5 && q.y > 0.05) uz = Math.max(uz, cw * 0.85 * sl.broken);
    // Gravity along the surface, plus the push of the face itself. Work in the wave's own frame (moving along with the
    // peel and in toward the beach), where its shape stands still: a board sliding over a curved surface is pressed
    // against it by the curvature (the w.Hess.w term), so a face rising under you shoves you forward and down it.
    let curv = 0;
    if (w) {
      const wx = this.vx - (w.peelRate || C.peel), wz = this.vz - cw, ws = Math.hypot(wx, wz);
      if (ws > 0.05) {
        const ux = wx / ws, uz2 = wz / ws, ee = 0.3;
        const d2 = (heightAt(waves, this.x + ux * ee, this.z + uz2 * ee) - 2 * q.y + heightAt(waves, this.x - ux * ee, this.z - uz2 * ee)) / (ee * ee);
        curv = Math.max(-30, Math.min(30, ws * ws * d2));
      }
    }
    const gs = (this.standing ? 1 : P.lieGravity) * Math.max(0, g + curv) / (1 + slope2);
    let ax = -gs * hx, az = -gs * hz;
    // the roof of the barrel: under an overhanging lip the face ends at the ceiling. Riding up toward it, the curtain
    // pouring over pushes you back down the face (harder on a forgiving wave); right up into it and the lip takes you
    if (this.standing && sl && sl.U.length >= 3 && sl.curl > 0.3 && sl.lipY < 0.62 * H && q.s < -0.3 * H && q.zl < sl.lipZ) {
      const roof = sl.F[sl.F.length - 1][1] * (w.fade || 1), k = smooth(0.5 * roof, 0.88 * roof, q.y);
      if (k > 0) { az += 15 * k / (C.forgive || 1); const up = -(this.vz - cw); if (up > 0) az += up * 4 * k; }   // (and it takes the climb out of you)
    }
    // board velocity relative to the water: along the board and sideways
    const rx = this.vx, rz = this.vz - uz;
    const along = rx * dx + rz * dz, lx = rx - along * dx, lz = rz - along * dz;
    if (!this.standing) {
      // lying: slow hull, sitting up is a brake, arms push you along
      this.paddling = inp.paddle;
      this.paddleT = inp.paddle ? this.paddleT + h : 0;
      this.padUp = inp.paddle ? Math.min(2, (this.padUp || 0) + h) : Math.max(0, (this.padUp || 0) - 2 * h);   // how long you've been stroking (lets go fast when you stop)
      this.recentPaddle = inp.paddle ? 0.6 : Math.max(0, (this.recentPaddle || 0) - h);   // you only get into a wave by paddling for it
      const k = (P.lieDrag + P.lieDrag2 * Math.abs(along)) * (inp.paddle ? 1 : 1.8);
      ax += -k * along * dx - P.lieLat * lx; az += -k * along * dz - P.lieLat * lz;
      if (inp.paddle) { const f = P.paddleThrust * Math.max(0, 1 - (along / P.paddleMax) ** 2); ax += f * dx; az += f * dz; }
      this.th += inp.steer * (inp.paddle ? P.paddleTurn : P.lieTurn) * h;
      this.turn = 0; this.lean = 0; this.skid = 0; this.pearlT = 0; this.pearlK = 0; this.shoulderK = 0; this.wob = 0; this.wobV = 0; this.wobK = 0;   // (lying down, no nose-ride warning can linger)
    } else {
      // standing: planing drag along the board, fins stop it sliding sideways (up to their grip), carving turns the board
      const pop = this.state === 'POP' ? 0.4 : 1;
      const speed = Math.hypot(this.vx, this.vz);
      // roll the board toward the lean your thumb asks for (weight shifts take a moment), then the lean carves the turn
      // your thumb asks for a share of the full turn, not of the full lean: the lean a turn needs grows steeply (tan), so a
      // straight thumb-to-lean map left half a thumb turning a quarter as hard. Half the thumb now leans the board over
      // as far as half the turn really takes (the physics of the carve itself is unchanged)
      // nose riding (29 Sep 2026, his call; the longboard only: P.walk): the PUMP button walks you up the board a cross-step
      // at a time (4 steps, each ~0.38 s, eased: never a slide or a jump) and back when you let go. Up there you only steer
      // gently; you need the pocket (close to the curl, the wave holding the tail down) or the nose digs in and you fall
      let steer = inp.steer;
      if (P.walk && this.state === 'RIDE') {
        const held = !!inp.pump;
        if (!this.stepDir) { if (held && (this.noseStep || 0) < 4) { this.stepDir = 1; this.stepT = 0; } else if (!held && (this.noseStep || 0) > 0) { this.stepDir = -1; this.stepT = 0; } }
        else if (this.stepDir > 0 && !held) { const u = Math.min(1, this.stepT / NOSE_STEP); this.noseStep = (this.noseStep || 0) + 1; this.stepDir = -1; this.stepT = (1 - u) * NOSE_BACK; }   // (let go mid-step and your weight comes straight back: the step reverses from where your foot is, no finishing it first)
        if (this.stepDir) { this.stepT += h; const u = Math.min(1, this.stepT / (this.stepDir < 0 ? NOSE_BACK : NOSE_STEP)); this.stepU = u;   // (stepping back is quicker: a couple of fast steps off the nose, as a real longboarder bails back)
          this.nose = ((this.noseStep || 0) + this.stepDir * u * u * (3 - 2 * u)) / 4;
          if (u >= 1) { this.noseStep = (this.noseStep || 0) + this.stepDir; this.stepDir = 0; this.stepU = 0; this.nose = this.noseStep / 4; } }
        const Hh = w ? C.H : 1, sH = (this.s || 0) / Hh, yH = this.y / Hh, pocket = w && sH > -0.8 && sH < 1.4 && yH > 0.15 && yH < 0.8;   // (the curl itself included: tip time right in it is the classic nose ride)
        steer *= 1 - 0.55 * this.nose;   // (from the nose you steer gently: most of the board is behind you)
        const hardTurn = Math.abs(inp.steer) > 0.88;   // (a firm thumb is fine up there; only a full-lock turn buries the nose)
        // how you come unstuck depends on where you are, like a real nose ride. Run out onto the shoulder ahead of the
        // pocket and nothing holds the tail down: the board just slows (it can't pearl on a slope that gentle), and if
        // you stay up front the wave leaves you. Under the lip, too low on the steep part, too high by the lip, or a
        // full-lock turn from the tip: the nose digs in and you pearl. Soft waves forgive you longer than heavy ones
        const shoulder = w && this.nose > 0.55 && !pocket && sH >= 1.4 && yH > 0.15 && yH < 0.8 && !hardTurn;
        this.shoulderK = shoulder ? Math.min(1, (this.shoulderK || 0) + h * 1.5) : Math.max(0, (this.shoulderK || 0) - h * 3);
        if (this.shoulderK > 0 && speed > 0.5) { const f = 1.6 * this.nose * this.shoulderK / speed; ax -= f * this.vx; az -= f * this.vz; }   // (up to 1.6 m/s every second of drag)
        this.noseHard = hardTurn && this.nose > 0.55 && !pocket;   // (the game says so: it's the turn burying the nose, not only where you are)
        const front = this.nose >= 0.74 ? 0.5 + 0.5 * Math.min(1, (this.nose - 0.74) / 0.25) : 0, over = Math.max(0, (this.hangT || 0) - 1.5);
        const pearlLim = PEARL_T * (C.nose ?? 1);
        if (this.nose > 0.55 && !shoulder && (!pocket || hardTurn)) this.pearlT = (this.pearlT || 0) + h * (hardTurn && !pocket ? 2 : 1) * (this.stepDir < 0 ? 0.5 : 1); else if (front > 0 && over > 0 && !this.stepDir) this.pearlT = (this.pearlT || 0) + h * 0.45 * Math.min(1, over / 1.5); else this.pearlT = Math.max(0, (this.pearlT || 0) - 1.5 * h);   // (already stepping back: the weight is coming off the nose, half rate)
        this.pearlK = Math.min(1, this.pearlT / pearlLim);   // (how close the nose is to going under: the game shows it)
        // up front the board rocks rail to rail and you hold it with small opposite steers (tipping right, thumb left);
        // more on a heavy wave, and the longer you stay up there the livelier it gets and the heavier the nose. Past
        // about 1.5 s on the front the nose starts to dig in slowly even in the pocket: bank the hang or push your luck
        if (front > 0) {
          const inst = (3.2 + 3 * over) * front, kick = (0.9 + 0.8 * over) * front / (C.nose ?? 1);   // (left alone it tips over in about a second)
          this.wobV = (this.wobV || 0) + (inst * (this.wob || 0) + WOB_STEER * inp.steer + kick * (Math.random() * 2 - 1) * 3) * h;
          this.wobV *= 1 - 2.2 * h; this.wob = (this.wob || 0) + this.wobV * h;
          if (Math.abs(this.wob) > WOB_MAX) return this.wipe('Lost your balance on the nose');
        } else { this.wobV = (this.wobV || 0) * (1 - 8 * h); this.wob = (this.wob || 0) * (1 - 6 * h); }
        this.wobK = Math.min(1, Math.abs(this.wob || 0) / WOB_MAX);   // (how close to toppling: the game shows it)
        this.pearlK = Math.min(1, this.pearlT / pearlLim);
        if (this.pearlT > pearlLim) return this.wipe('Pearled: the nose went under');
        if (pocket && this.nose > 0.5) { const f = 0.7 * this.nose; ax += f * dx; az += f * dz; }   // (trimming on the nose in the pocket is fast)
        // the hang: timed at the nose, scored when you step back off it (or the ride ends)
        if (this.nose >= 0.74) { this.hangT = (this.hangT || 0) + h; if (this.nose >= 0.99) this.hang10T = (this.hang10T || 0) + h; this.hangPocket = (this.hangPocket || 0) + (pocket ? h : 0); }
        else if (this.hangT > 0) this.scoreHang();
      } else if (P.walk) { if (this.hangT > 0) this.scoreHang(); this.nose = 0; this.noseStep = 0; this.stepDir = 0; this.pearlT = 0; this.pearlK = 0; this.shoulderK = 0; this.wob = 0; this.wobV = 0; this.wobK = 0; }
      const wantLean = Math.sign(steer) * Math.atan(Math.abs(steer) * Math.tan(P.leanMax)) * pop, dl = wantLean - this.lean;
      // backside (your back to the wave), rolling onto the heel rail to turn up into it is slower and blinder than
      // frontside's toe rail: the board answers a little later (the wave is on your right when you head toward -x)
      const intoWave = Math.cos(this.th) < 0 ? 1 : -1, maxRoll = P.leanRate * h * (this.backside && Math.sign(dl) === intoWave ? 0.82 : 1);
      this.lean += Math.max(-maxRoll, Math.min(maxRoll, dl * Math.min(1, h * P.leanEase)));
      // the board has momentum: its turning builds up and flows out over a fraction of a second, it doesn't switch on and off
      // the rail has to bite before the board turns: a flat board glides straight, a small lean barely turns,
      // a deep lean carves hard (not a steering wheel)
      const bite = smooth(0.06, P.railBite, Math.abs(this.lean));
      // (measured on real surfers: rail to rail in ~0.3 s, carves at ~2 g, cutbacks peaking ~300 deg/s. Below ~5 m/s a
      // rail can't hold a hard lean: the board bogs and turns lazily instead of spinning, so make speed before you turn)
      const railHold = 0.3 + 0.7 * smooth(2.5, 5.5, speed);
      // (and never harder than ~2.3 g sideways: measured carves are ~1.8-2 g; at full lean it went to 3 g, whipping round
      // tighter than any real surfer on the slower waves)
      // the snap (his brief 28 Sep 2026: like the pros, and it has to feel natural): race up into the top of the face and
      // turn hard back down, and up there the tail lets go: the board pivots much faster than any carve, throws its spray,
      // loses some speed, then the fins bite again on the way down. Only high on the face, climbing, with speed, leaning
      // hard back down the wave, so everywhere else the board rides exactly as before
      const climb = sl ? -(this.vz - cw) : 0, backDown = Math.sign(this.lean) * Math.cos(this.th) > 0;
      const zone = this.state === 'RIDE' && sl && backDown ? smooth(0.5, 0.72, hRel) * smooth(0.3, 1.6, climb) * smooth(0.55, 0.85, Math.abs(this.lean) / P.leanMax) * smooth(0.45 * C.speed, 0.8 * C.speed, speed) : 0;
      this.snapK = zone > (this.snapK || 0) ? this.snapK + (zone - this.snapK) * Math.min(1, h * 14) : Math.max(0, (this.snapK || 0) - h * 3.2);   // (in quickly, out over about a third of a second)
      const sk = this.snapK * (P.snap ?? 1);
      if (sk > (this.snapPk || 0)) this.snapPk = sk;
      if (this.lipPush > 0) { this.lipPush -= h; az += 14 * this.lipPush / 0.35; }   // (met the lip as it threw: it shoves you back down the face)
      const turnCap = Math.min(5.2, 2.3 * P.g / Math.max(speed, 3.2)) * (1 + 1.7 * sk);
      const pivot = Math.sign(this.lean) * sk * 5.5 * Math.min(1, Math.abs(this.lean) / P.leanMax);   // (the back foot swinging the tail round: up to ~300 deg/s on top of the carve)
      const wantTurn = Math.max(-turnCap, Math.min(turnCap, bite * railHold * P.g * Math.tan(this.lean) / Math.max(speed, 3.2) + pivot));
      this.turn += (wantTurn - this.turn) * Math.min(1, h / (P.yawLag * (1 - 0.45 * sk)));
      this.th += this.turn * h;
      // the tail can swing out, but the fins drag the nose back toward where the board is going through the water:
      // slip past ~17 deg is resisted, and it never passes ~35 deg (a drift, not a spin-out)
      this.slide = 0;
      if (Math.hypot(rx, rz) > 1.5) {
        // measured against the water the board is sliding on, not the ground
        const vd = Math.atan2(rz, rx); let slip = this.th - vd; slip = Math.atan2(Math.sin(slip), Math.cos(slip));
        const a = Math.abs(slip), soft = 0.3 + 0.5 * sk, hard = 0.62 + 0.7 * sk;   // (in a snap the tail swings right out)
        this.slide = a;   // how far the tail is hanging out (rad): drives the spray fan and the hiss
        if (a > soft) { const na = a > hard ? hard : a - (a - soft) * Math.min(1, h * 6); this.th = vd + Math.sign(slip) * na; }
      }
      const dr = P.drag * along + P.drag2 * along * Math.abs(along) + 1.6 * sk * (this.slide || 0) * Math.sign(along);   // (a snap scrubs speed: the tail sliding across the water)
      ax += -dr * dx; az += -dr * dz;
      // stalling: weight on the tail and the trailing hand dragged in the face, a strong brake (you let the wave catch you)
      // (his call 29 Sep 2026: more like the real thing) it bites hard the moment you sit back, then eases; and hold it
      // once you've slowed right down and the board stops planing: the tail sinks under you (a wobble first, then you fall)
      this.stalling = inp.stall || 0;
      this.stallT = this.stalling ? (this.stallT || 0) + h : 0;
      if (this.spitOut > 0 && this.inBarrel) this.stalling = 0;   // (the spit blows you out: no braking against it)
      if (this.stalling) { const bite = 1 + (P.stallBite ?? 1.1) * Math.exp(-this.stallT / 0.45), sd = P.stallDrag * bite * this.stalling * Math.min(1, Math.abs(along) / 2) * Math.sign(along); ax -= sd * dx; az -= sd * dz; }
      { const vr = Math.hypot(rx, rz); if (this.stalling && vr < (P.planeV ?? 3.6)) this.bogT = (this.bogT || 0) + h; else this.bogT = Math.max(0, (this.bogT || 0) - 2.5 * h);
        this.bogK = Math.min(1, this.bogT / BOG_FALL);
        if (this.bogT > BOG_FALL) return this.wipe('Stalled too long: the tail sank'); }
      // inside the tube the wave's own flow helps you hold your spot (the tiny foot adjustments a real surfer makes that a
      // thumb can't): a small friendly tube holds you in well, a heavy one hardly at all. Pump or stall still override it.
      if (this.inBarrel && w && C.tube && !w.closing) {   // (not while it closes out: the collapsing tube carries no one)
        // the speed that keeps you at your spot in the tube: the curl's speed along the reef (a little more if you've
        // drifted deep, less if you're near the mouth) combined with the wave's own run at the beach
        const want = (-1.3 * C.H - this.s) * 0.6, vT = Math.hypot((w.peelRate || C.peel) + want, cw);
        // (for the first few seconds only: a real tube doesn't hold anyone forever. It fades out from 3 s to 6 s in there,
        //  then staying in is all your own pumping and stalling: with it for good, barrels lasted 20-35 s)
        const hold = C.tube * Math.max(0, 1 - Math.max(0, (this.ride.tubeT || 0) - 2) / 2.5) * (1 - 0.85 * (this.stalling || 0));   // (29 Sep 2026: fades from 2 s to 4.5 s, was 3 to 6: shorter, truer barrels)   // (a stall overrides the tube's hold: you really do drop back deeper)
        const sp = Math.hypot(this.vx, this.vz) || 1, push = Math.max(-5, Math.min(5, 2 * hold * (vT - sp)));
        ax += push * this.vx / sp; az += push * this.vz / sp;   // along your line, like the push of a pump (a sideways shove, the fins would just cancel)
      }
      // the harder you lay the rail over, the more the tail lets go: a little slide in an easy turn, a full drift at full thumb
      // the harder you lay it over, the more the tail lets go, but not at once: in a hard turn the tail holds for a moment,
      // then slides out; straighten up and it eases back in (a drift that builds, not a switch)
      const relT = 1 - 0.3 * smooth((P.relFrom || 0.45) * P.leanMax, P.leanMax, Math.abs(this.lean));   // fins hold a carve (~2 g); only the deepest lean lets the tail slide
      this.relS += (relT - this.relS) * Math.min(1, h / (relT < this.relS ? P.tailLet : P.tailBack));
      const release = this.relS;
      const latA = P.finGrip * Math.hypot(lx, lz), lim = P.gripMax * pop * release;
      this.skid = latA > lim ? Math.min(1, latA / lim - 1) : 0;
      const sc = latA > lim ? lim / latA : 1;
      // the fins mostly bend your path rather than brake you: the part of their push that works against your motion is
      // largely given back (a carving board keeps its glide; the wave's push refunds what a real rail would scrub)
      let gx = -P.finGrip * lx * sc, gz = -P.finGrip * lz * sc;
      const rs = Math.hypot(rx, rz);
      if (rs > 0.5) { const ux = rx / rs, uz_ = rz / rs, gt = gx * ux + gz * uz_; if (gt < 0) { gx -= gt * P.glide * ux; gz -= gt * P.glide * uz_; } }
      ax += gx; az += gz;
      if (this.skid) { const loss = P.skidLoss * (1 - 0.5 * P.glide) * (latA - lim) * Math.sign(along); ax += -loss * dx; az += -loss * dz; }
      // pumping, like a real surfer: a rhythm of strokes (compress onto the board, spring up light), one flowing into the next, about 1.3 a second (real surfers pump ~1-1.5 a second). Hold
      // PUMP and the surfer keeps the rhythm himself (a stroke every PUMP_PERIOD); a press starts one at once, and mashing
      // faster than your legs can go gives weak strokes. Strongest weaving up and down the face and
      // heading down it, weaker on a dead straight line or climbing. Works anywhere, the barrel included (pump out of it).
      const pumpIn = inp.pump && !P.walk;   // (the longboard's button walks you to the nose instead)
      const press = pumpIn && !this.pumpWas; this.pumpWas = !!pumpIn; this.pumpGap += h;
      const auto = pumpIn && this.pumpGap >= PUMP_PERIOD;   // held down, your legs keep the rhythm going by themselves
      if (press || auto) { this.pumpQ = press ? smooth(0.22, 0.42, this.pumpGap) : 1; this.pumpT = 0; this.pumpGap = 0; this.pumpN++; }
      this.weave += (Math.abs(this.turn) - this.weave) * Math.min(1, h / 0.7);   // how much you've been turning lately (rad/s)
      this.pumping = this.pumpT < PUMP_STROKE;
      if (this.pumping) {
        const env = Math.sin(Math.PI * this.pumpT / PUMP_STROKE), weave = 0.5 + 0.5 * smooth(0.1, 0.6, this.weave);
        const terr = 1 + Math.max(-0.4, Math.min(0.6, -2 * this.gAlong));   // down the face up to 1.6x, climbing down to 0.6x
        const f = 4.0 * P.pump * env * this.pumpQ * weave * terr;            // (shortboard: 2 m/s^2 at the top of a stroke, spread over the whole stroke)
        ax += f * dx; az += f * dz; this.pumpT += h;
      }
      // popping up, the surfer throws their weight over the nose and drives the board down the face (the drop)
      if (this.state === 'POP') { const gl = Math.hypot(hx, hz) || 1, push = 3.2 * Math.min(1, gl); ax += -hx / gl * push; az += -hz / gl * push; }
    }
    this.vx += ax * h; this.vz += az * h;
    this.x += this.vx * h; this.z += this.vz * h;
    this.v = Math.hypot(this.vx, this.vz);
    this.judge(h, w, sl, q);
  }

  // what the wave does to you from here: catching, the barrel, the lip, the whitewater, kicking out, losing it
  judge(h, w, sl, q) {
    const P = RIDE;
    if (this.state === 'OUT') { this.inBarrel = false; this.onFace = false; return; }
    this.inBarrel = false; this.washed = false;
    if (!w) { this.onFace = false; this.wwFloatT = 0; if (this.standing) this.lostSpeed(h); return; }
    // (heights in the wave's own shape: the drawn wave is the profile scaled by the set's size, so the rules compare
    // against the same scaled lip, top and barrel the player sees)
    const C = w.cond, H = C.H, s = q.s, zl = q.zl, y = q.y / (w.fade || 1), slope = Math.hypot(this.hx, this.hz);
    const lipDown = C.hollow > 0.5 && sl.lipY < 0.45 * H;
    const onFront = zl > sl.topZ - 0.3;                               // on the face side of the wave, not behind it
    this.onFace = onFront && slope > 0.22 && this.hz < -0.1;          // downhill is toward the beach
    // the lip lands on anyone under it
    const fgL = C.forgive || 1;   // (a forgiving wave: the lip's landing zone is narrower and it throws you a little later)
    if (lipDown && s < -0.3 * H && s > -4.5 * H && zl > sl.lipZ - 0.3 && zl - sl.lipZ < (0.45 + 0.1 * H) * fgL && y < 0.55 * H) return this.wipe(this.standing && this.ride.t < 3 ? 'The lip landed on you: angle along the wave as you stand up, not straight down' : 'The lip landed on you');   // (only where it lands and just outside: tucked inside under it you're in the barrel, not under the hammer)
    if (!this.standing) {
      // caught inside: the whitewater rolls you toward the beach (you hang on to the board)
      if (sl.broken > 0.35 && onFront && y > 0.1 * H) this.washed = true;
      // pulled over the falls: lying at the top of a wave that's pitching
      if (onFront && y > 0.8 * sl.top && s < 0.6 * H && s > -2 * H && zl < sl.topZ + 0.4) return this.wipe(this.paddleT > 2 ? 'Too far in: the peak pitched right over you' : 'Too late: it pulled you over the falls');
      // the catch: on the face, heading for the beach, and going as fast as the wave
      // (once you're sliding down a steep enough face at a good share of its speed, it has you: you pop up and gravity does the rest)
      // (on a huge wave you get in earlier, lower on the face, like a big-wave gun: the speed you need is capped)
      // how long the wave has been lifting you: it only carries you for a moment, then passes under you
      this.liftT = this.onFace ? (this.liftT || 0) + h : Math.max(0, (this.liftT || 0) - 3 * h);
      // you have to be near where it's breaking: out on the shoulder (more than catchReach wave heights ahead of the break) a
      // shortboard can't get in; a longboard can, further out
      // (tried 27 Sep and taken back out the same day: requiring you to be paddling before the wave lifts you, and a short
      // window after it lifts you, made the game's own "Paddle now!" tip too late; padUp and liftT are still tracked)
      const catchV = Math.min(C.speed * 0.5, 3.2 + 0.1 * C.speed) * P.catchK;   // (a longer, floatier board gets in with less)
      if (this.onFace && this.recentPaddle > 0 && s < P.catchReach * H && Math.sin(this.th) > 0.2 && this.vz > catchV && slope > 0.4 * P.catchK) { this.catchT += h; if (this.catchT > 0.1) { this.set('POP'); this.catchT = 0; this.lateK = smooth(0.05, 0.35, sl.curl || 0) * smooth(0.3, -0.3, s / H) * smooth(0.2, 0.3, y / H); this.lateDone = false; } }   // (how late you took off: under the peak as it's already pitching, up on the face)
      else this.catchT = 0;
      return;
    }
    if (this.state === 'POP' && this.stateT >= P.popTime) this.set('RIDE');
    const riding = this.state === 'RIDE';
    if (riding) this.ride.t += h;
    // a late drop made: you took off high under the pitching part and got down to the bottom still on your feet
    if (riding && !this.lateDone && (this.lateK || 0) > 0.3 && this.stateT > 0.6 && y < 0.4 * Math.max(sl.top, 0.3)) { this.lateDone = true; this.move('LATE DROP', this.lateK, 0, 0.6 + 0.8 * this.lateK); }
    if (riding && this.stateT > 4) this.lateDone = true;
    // falling out of the whitewater
    // (a soft wave is forgiving: its whitewater is a gentle push you can ride, like beginners do; hollow waves knock you off)
    const fg = C.forgive || 1;
    // a floater: meet the breaking section high on the face, with speed, heading down the line, and you ride up over
    // the top of the foam and drop back onto the clean face. The foam drags at you: too slow, too low, or on it too long
    // and it takes you. Otherwise the whitewater knocks you off as before.
    const inFoam = sl.broken > 0.4 / fg && onFront && y > 0.12 * H / fg;
    if (inFoam && riding) {
      const hTopF = y / Math.max(sl.top, 0.3), along = Math.cos(this.th);
      if (this.wwFloatT > 0 || (hTopF > 0.55 && along > 0.35 && this.v > 0.85 * C.speed)) {
        this.wwFloatT = (this.wwFloatT || 0) + h;
        const sp = Math.hypot(this.vx, this.vz); if (sp > 0.1) { const k = Math.max(0, 1 - 1.6 * h / sp); this.vx *= k; this.vz *= k; }   // foam drag ~1.6 m/s^2
        if (this.wwFloatT > 1.5 || this.v < 0.55 * C.speed || hTopF < 0.35) return this.wipe('The whitewater caught you on the floater');
      } else return this.wipe(C.hollow > 0.5 ? 'The whitewater caught you' : 'The whitewater knocked you off');
    } else if (inFoam) return this.wipe(C.hollow > 0.5 ? 'The whitewater caught you' : 'The whitewater knocked you off');
    else if (this.wwFloatT > 0) { if (this.wwFloatT > 0.35) this.move('FLOATER', Math.min(1, this.wwFloatT / 1.2)); this.wwFloatT = 0; }   // made it back onto the clean face
    // an air: come up the face fast and hit the lip, and it throws you into the sky with it (going up slowly, it just
    // takes you over the falls, below). Needs speed and a steep, rising face; not from inside the tube
    if (P.air && this.state === 'RIDE' && this.stateT > 0.8 && onFront && s > -0.25 * H && y > 0.78 * sl.top && this.vyPk > Math.max(2.6, 0.42 * Math.sqrt(9.8 * H)) && this.hitV > 0.8 * C.speed && this.upT > 0.12) {   // (a deliberate hit: fast, and pointing up at the lip, not a top turn that happens to rise)
      this.air = { t: 0, vy: Math.min(0.9 * Math.sqrt(9.8 * H), this.vyPk * 1.1 + 1.2), spin: 0, peak: 0 };   // (capped: you fly about as high as the wave is steep, not further)
      this.vz = Math.max(this.vz, C.speed * 1.02);   // the throwing lip carries you forward with it
      this.inBarrel = false; this.onFace = false; return;
    }
    // too high while it's throwing
    // (only a wave that pitches can throw you; a soft, crumbly one just breaks around you and the whitewater rule decides)
    if (C.hollow > 0.5 && onFront && y > Math.min(0.97, 0.86 / Math.sqrt(C.forgive || 1)) * sl.top && s < 0.6 * H && s > -2.2 * H && zl < sl.topZ + 0.35 && this.hz > -0.05) {
      if (this.snapK * (P.snap ?? 1) > 0.35 && Math.sign(this.turn) * Math.cos(this.th) > 0) { if (!(this.lipPush > 0)) { this.lipPush = 0.35; this.lipHit = true; } }   // (snapping off it, already turning back down: the lip hits you and sends you down with it)
      else return this.wipe('Too high: the lip threw you over the falls');
    }
    // ...and you can't get out through the roof: the only way out of a barrel is the open end
    const roofY = sl.U.length >= 3 && sl.curl > 0.3 && sl.lipY < 0.62 * H ? sl.F[sl.F.length - 1][1] : Infinity;
    if (C.hollow > 0.5 && onFront && s < -0.3 * H && s > -4.5 * H && zl < sl.lipZ && y > 0.97 * roofY) return this.wipe('Too high in the tube: the lip took you over the falls');
    // covered: the lip is out in front of you and over your head (on a small wave that's while it's still coming down, at
    // about half the wave's height: the landing rules above keep the stricter 'lip is down' test)
    this.inBarrel = C.hollow > 0.5 && sl.lipY < 0.62 * H && s < -0.4 * H && s > -4.5 * H && zl < sl.lipZ - 0.25 && y < 0.62 * H && onFront;
    // too deep: fall behind the curl and the foam ball (the broken wave churning inside the tube) catches you. You have
    // to keep your speed matched to the peel to stay in (pump, or come off the stall in time)
    const deepAt = (this.backside ? -1.9 : -2.0) * (C.deep || 1), foamMax = (this.backside ? 2.0 : 2.5) * (C.foamK || 1);   // (a spot can keep its foam ball closer and less patient: C.deep, C.foamK)   // (backside you can't see the curl behind you: the foam ball catches you a little sooner)
    if (this.inBarrel && s < deepAt * H) { this.foamT = (this.foamT || 0) + h; if (this.foamT > foamMax || s < -3.6 * H) return this.wipe('Too deep: the foam ball swallowed you'); }   // (the instant line is well behind: a section surge alone can't drop you past it without warning) }
    else this.foamT = Math.max(0, (this.foamT || 0) - h);
    // turning round inside the tube heads you back into the foam ball (why nobody does a cutback in a barrel): pointed back
    // toward the curl for more than half a second in there and it catches you
    if (this.inBarrel && Math.cos(this.th) < -0.2) { this.backT = (this.backT || 0) + h; if (this.backT > 0.6) return this.wipe('Too deep: you turned back into the foam ball'); }
    else this.backT = Math.max(0, (this.backT || 0) - 2 * h);
    // over the back
    if (!onFront && y < 0.4 * Math.max(sl.top, 0.3)) { if (w.closing && this.state === 'RIDE') { this.ride.end = 1; return this.out('Kicked out as it closed out'); } return this.out('Kicked out over the back'); }
    const kmh = this.v * 3.6; this.ride.top = Math.max(this.ride.top, kmh);
    if (riding) {
      if (this.inBarrel) this.ride.barrel += h;
      if (onFront && s > -0.5 * H && s < 3 * H && y > 0.2 * H) this.ride.pocket += h;
      this.ride.speed += Math.max(0, this.v - C.peel) * h;
      this.ride.leanPk = Math.max(Math.abs(this.lean) / P.leanMax, this.ride.leanPk - h * 0.8);
      const crit = Math.max(0, 1 - Math.abs(s + 0.5 * H) / (3 * H)) * 0.6 + 0.4 * Math.min(1, y / Math.max(0.3, sl.top));   // near the curl and high on the face = critical
      // a barrel counts once you come out of it (make it out, or it doesn't count)
      if (this.inBarrel) { this.ride.tubeT += h; this.ride.tubeDeep += Math.max(0, -s / H) * h; }   // (how deep you sat, for the judge)
      else if (this.ride.tubeT > 0) { this.tubeOut = (this.tubeOut || 0) + h;   // out for a moment (a wobble at the edge) is still the same barrel
        if (this.tubeOut > 0.4) { if (this.ride.tubeT > 0.5) this.move('BARREL', 0.6 + 0.4 * crit, this.ride.tubeT); this.ride.tubeT = 0; this.ride.tubeDeep = 0; } }
      if (this.inBarrel) this.tubeOut = 0;
      this.grabbing = this.inBarrel && this.backside && (C.nose ?? 1) <= 0.8;   // (backside in a heavy barrel you grab the outside rail and tuck in tight)
      if (this.grabbing) this.ride.grabT = (this.ride.grabT || 0) + h;
      // a turn counts when the carve swings hard one way and then hard the other at speed
      // (and only a real carve: the last one held for at least 0.35 s, so thumb wiggles don't count)
      this.ride.gPk = Math.max(this.ride.gPk, Math.abs(this.turn) * this.v / P.g);   // (the hardest the rail has loaded since the last turn)
      const hFace = y / Math.max(sl.top, 0.3); this.tyMin = Math.min(this.tyMin ?? hFace, hFace); this.tyMax = Math.max(this.tyMax ?? hFace, hFace);   // how far up and down the face you've been since the last turn
      if (Math.abs(this.turn) > 0.9 * P.turnMin && this.v > C.peel * 0.8) {   // (a longboard's flowing turns count at its own, gentler rate)
        const sg = Math.sign(this.turn);
        if (sg !== this.turnSign) { if (this.turnSign !== 0 && this.turnHold > 0.35 && this.ride.gPk > 0.9 && onFront && hFace > 0.15 && s < 4 * H) { this.ride.turns++; if (this.tyMin < 0.4) this.ride.botT = this.ride.t;   // (a turn that came through the bottom 40% of the face: a bottom turn)
          this.move('TURN', crit, 0, 0.35 + 0.65 * smooth(0.15, 0.45, this.tyMax - this.tyMin)); }   // (a real carve on the face near the wave's power: a wiggle out on the flats isn't a turn)
          this.ride.gPk = 0; this.turnSign = sg; this.turnHold = 0; this.tyMin = this.tyMax = hFace; }   // (a turn is judged on how much of the face it used: flat S-bends in the middle score a third)
        else this.turnHold = (this.turnHold || 0) + h;
      }
      // a cutback: from running down the line, turn right round to face the breaking part, still with speed
      const hd = Math.cos(this.th);
      if (hd > 0.5) this.cbArmed = true;
      else if (this.cbArmed && hd < -0.4 && this.v > 0.45 * C.speed) { this.cbArmed = false; this.ride.cutbacks++; this.move('CUTBACK', crit); }
      // a roundhouse: the cutback carried right round into a figure eight, rebounding off the breaking part and back down
      // the line with speed. The cutback you just did becomes the roundhouse (one move, scored as the bigger one)
      if (this.trick && this.trick.name.endsWith('CUTBACK') && this.trick.t < 0.05) this.rhT = this.ride.t;
      if (this.rhT != null && (this.ride.t - this.rhT > 2.2 || this.ride.t < this.rhT)) this.rhT = null;
      if (this.rhT != null && hd > 0.5 && s / H < 0.8 && this.v > 0.45 * C.speed) { this.rhT = null; this.roundhouse(crit); }
      // a snap (top turn): climb hard up to the lip, then whip the board back down the face from up there
      const relVz = this.vz - C.speed, hTop = y / Math.max(sl.top, 0.3);
      if (relVz < -1.2 && hTop > 0.6) this.snapArm = 1.2; else this.snapArm = Math.max(0, this.snapArm - h);
      if (!(this.snapArm > 0) && !(this.snapK > 0)) { this.snapPk = 0; this.lipHit = false; }   // (a snap that never came round to a scored one leaves nothing behind)
      if (this.snapArm > 0 && relVz > 0.8 && hTop > 0.5 && Math.abs(this.turn) > 1.3 && !(this.trick && this.trick.name.endsWith('SNAP'))) {
        this.snapArm = 0; this.ride.snaps++; this.move('SNAP', crit, 0, 1, { pivot: this.snapPk || 0, lip: !!this.lipHit }); this.snapPk = 0; this.lipHit = false;
      }
      if (this.trick) { this.trick.t += h; if (this.trick.t > 1.4) this.trick = null; }
      // the end of the wave: it backs off and the barrel breathes out (the spit), shooting whoever's inside out onto the shoulder
      if (this.spitOut > 0) { this.spitOut -= h; if (this.inBarrel && this.v < 2.1 * C.speed) { const k = 1 + 2.4 * h; this.vx *= k; this.vz *= k; } }   // (29 Sep 2026: a stronger blow, and a stall can't hold you in against it: see the stall above)
      // the close-out reaches you: the lip comes down on the section you're riding and it all turns to whitewater. The
      // ride's over (you rode it right to the end: full credit)
      if (w.closing && w.closeMask && w.closeMask(s) > 0.5) { this.ride.end = 1; return this.out('Closed out: you rode it right to the end'); }
      // the wave has backed off to a shoulder (the end of the reef, or the sand): the ride winds down, full credit
      if ((w.endK === undefined ? 1 : w.endK) < 0.4) { this.ride.end = 1; return this.out(w.closing ? 'It closed out behind you: you rode it to the end' : w.endBy === 'beach' ? 'Rode it all the way in' : 'Rode it to the end of the reef'); }
      if (w.endK === undefined && (w.peelX > w.xEnd || this.z > w.zBeach)) { this.ride.end = 1; return this.out('Rode it to the end'); }   // (a wave with no ending set up: the old hard stop)
    }
    this.lostSpeed(h);
  }
  lostSpeed(h) {
    this.lowT = (this.v < 2.2 || (!this.onFace && this.v < 3.2)) ? this.lowT + h : 0;
    if (this.lowT > 0.6) { if (this.ride.t > 0 && this.wave && (this.wave.closing || (this.wave.endBy === 'beach' && this.wave.endK < 0.8))) { this.ride.end = 1; return this.out('It closed out behind you: you rode it to the end'); }   // (out ahead of it on the flats in the last stretch before the sand, as it closes out: you did ride it to the end)
      if (this.ride.t >= 12) { this.ride.end = 1; return this.out('The wave backed off: you rode it out'); }   // (29 Sep 2026: after a long ride, the wave leaving you is the end of the line, not a miss)
      this.out(this.ride.t > 0 ? (this.nose > 0.5 ? 'Stayed on the nose out on the shoulder: the wave left you' : 'Lost speed: the wave left you') : 'Missed it'); }
  }

  // like a contest judge: turns, speed, time in the barrel and in the pocket; just riding along earns little
  // a judged move: worth more done fast, laid over hard, and close to the breaking part (critical)
  // in the air: you fly on your own momentum and gravity; your thumb spins the board. Land lined up with where you're
  // going and you ride away; land sideways, too hard from too high, or spun wrong, and it's a wipeout
  airStep(h, inp, waves) {
    const P = RIDE, A = this.air; A.t += h;
    A.vy -= P.g * h; this.y += A.vy * h;
    this.x += this.vx * h; this.z += this.vz * h; this.v = Math.hypot(this.vx, this.vz);
    // with your thumb near the middle your body does what a surfer's does by instinct: swings the board round under you to
    // face where you're flying, ready to land. Push the thumb over and you spin it yourself (a 360 needs a full turn)
    const travel = Math.atan2(this.vz, this.vx), off = Math.atan2(Math.sin(travel - this.th), Math.cos(travel - this.th));
    const mine = A.t > 0.3 && Math.abs(inp.steer) > 0.5;   // (the thumb you were carving with doesn't spin you as you take off: a spin is a fresh push)
    const spin = mine ? inp.steer * 5.2 : Math.max(-2.8, Math.min(2.8, off * 5));
    this.th += spin * h; A.spin += mine ? spin * h : 0; this.turn = spin * 0.5;
    this.lean += (inp.steer * 0.3 - this.lean) * Math.min(1, h * 6);
    this.skid = 0; this.slide = 0; this.stalling = 0; this.stallT = 0; this.bogT = 0; this.bogK = 0; this.nose = 0; this.noseStep = 0; this.stepDir = 0; this.stepU = 0; this.pearlT = 0; this.pearlK = 0; this.shoulderK = 0; this.wob = 0; this.wobV = 0; this.wobK = 0; this.rhT = null; this.lateK = 0; this.lateDone = true; this.grabbing = false; this.hangT = 0; this.hang10T = 0; this.hangPocket = 0; this.pumping = false; this.inBarrel = false; this.onFace = false;
    this.ride.t += h;
    const q = waterAt(waves, this.x, this.z, _c), e = 0.15;
    if (q.w) { this.wave = q.w; this.s = q.s; this.zl = q.zl; }
    A.peak = Math.max(A.peak, this.y - q.y);
    if (A.t > 0.12 && this.y <= q.y) {
      const hx = (heightAt(waves, this.x + e, this.z) - heightAt(waves, this.x - e, this.z)) / (2 * e);
      const hz = (heightAt(waves, this.x, this.z + e) - heightAt(waves, this.x, this.z - e)) / (2 * e);
      this.land(q, hx, hz);
    }
  }
  land(q, hx, hz) {
    const A = this.air; this.air = null; this.y = q.y; this.prevY = q.y; this.hx = hx; this.hz = hz;
    const w = q.w || this.wave, C = w.cond, H = C.H, travel = Math.atan2(this.vz, this.vx);
    const off = Math.abs(Math.atan2(Math.sin(this.th - travel), Math.cos(this.th - travel))), rot = Math.abs(A.spin);
    if (off > 0.65) return this.wipe(rot > 2 ? 'Over-rotated: you landed sideways' : 'Landed sideways off the air');
    if (-A.vy > 11) return this.wipe('Too high: the landing buckled your legs');
    const crit = Math.min(1, 0.35 + 0.5 * Math.min(1, A.peak / (0.5 * H)) + 0.3 * Math.min(1, rot / (2 * Math.PI)));
    this.move(rot > 5.5 ? 'AIR 360' : 'AIR', crit, A.peak);
    const sl = q.w ? q.w.prof.slice(q.s) : null;
    if (!sl || q.zl < sl.topZ - 0.3) return this.out('Landed the air out the back');   // (the air still counts)
    this.vx *= 0.85; this.vz *= 0.85; this.v = Math.hypot(this.vx, this.vz);   // your legs soak up the landing
  }
  // Every move is judged like a contest judge would: how fast (speed), how hard on the rail (power), and where (critical:
  // close to the breaking part and high on the face). The same move out on the flat shoulder is worth a fraction of it
  // done in the pocket. Moves linked with no dead time between them build a combo. A barrel is worth more the longer
  // and the deeper you sat in it, and only counts once you're out.
  scoreHang() {   // a hang counts from ~0.6 s at the nose (five) or ~0.8 s with both feet on it (ten); longer is worth more
    const t = this.hangT || 0, t10 = this.hang10T || 0, inPocket = t > 0 ? (this.hangPocket || 0) / t : 0;
    if (this.wave && (t10 >= 0.8 || t >= 0.6)) this.move(t10 >= 0.8 ? 'HANG TEN' : 'HANG FIVE', 0.4 + 0.6 * inPocket, t10 >= 0.8 ? t10 : t, 1 + 0.25 * Math.min(2, t - 0.6));
    this.hangT = 0; this.hang10T = 0; this.hangPocket = 0;
  }
  roundhouse(crit) {
    const R = this.ride, m = [...R.moves].reverse().find((x) => x.name === 'CUTBACK' && R.t - x.t < 2.4); if (!m) return;
    m.pts *= MOVE_BASE.ROUNDHOUSE / MOVE_BASE.CUTBACK; m.base = MOVE_BASE.ROUNDHOUSE; m.name = 'ROUNDHOUSE'; if (crit > 0.6) m.notes.push('off the whitewater');
    this.trick = { name: (m.strong ? 'BIG ' : '') + 'ROUNDHOUSE', t: 0 };
  }
  move(name, crit, dur = 0, k = 1, snap = null) {
    const C = this.wave.cond, R = this.ride, spd = Math.min(1, this.v / (C.speed * 1.15));
    const pow = name === 'TURN' ? Math.min(1, R.gPk / 2.1) : name.startsWith('HANG') ? 0.85 : R.leanPk;   // (a hang is poise, not power)
    let q = Math.min(1, 0.35 * spd + 0.35 * pow + 0.3 * crit), base = MOVE_BASE[name] || 0;
    if (name === 'TURN' && q >= 0.65 && crit >= 0.55) base = MOVE_BASE.CARVE;   // (a powerful carve close to the curl is a real move to a judge, not a linking turn)
    let posK = 0.25 + 0.75 * crit;   // (where you did it: the pocket counts, the flats barely)
    const notes = [];
    if (name === 'BARREL') {
      const deep = R.tubeT > 0 ? R.tubeDeep / R.tubeT : 0.5, deepK = smooth(0.4, 1.6, deep);
      base = (1.2 + 0.9 * Math.min(dur, 6)) * (0.8 + 0.5 * deepK); q = crit; posK = 1;
      if (deepK > 0.6) notes.push('deep');
      if ((R.grabT || 0) > 0.5 * dur) { base *= 1.12; notes.push('grab rail'); } R.grabT = 0;   // (a heavy backside barrel ridden on the rail: a little extra)
    } else { if (snap) { base += 0.9 * smooth(0.3, 0.9, snap.pivot) + (snap.lip ? 0.8 : 0); if (snap.lip) notes.push('off the lip'); }   // (a real pivot at the top, and one that met the lip, is a bigger turn)
      if (crit > 0.7) notes.push('close to the curl'); if (pow > 0.8) notes.push('hard carve'); if (crit < 0.3) notes.push('far from the curl'); }
    // linked moves: a different move within 1.6 s of the last one (a barrel links from its exit). The same move again
    // straight after isn't a combination (judges reward combining different manoeuvres), it just keeps the chain alive
    // a bottom turn linked straight into a move up top (the classic surf line: down, round, and hit the lip): the top
    // move scores a quarter more and is called as the pair. The bottom turn has to be the last thing you did
    const offBottom = LINK_TOP.has(name) && R.lastMove === 'TURN' && R.t - (R.botT ?? -9) < 2.2; if (offBottom) { R.botT = -9; notes.push('off a bottom turn'); }
    const linked = R.t - R.lastMoveT < 1.6; R.combo = !linked ? 1 : name !== R.lastMove ? Math.min(5, R.combo + 1) : R.combo; R.lastMoveT = R.t; R.lastMove = name;
    const comboK = 1 + 0.1 * Math.min(R.combo - 1, 4); if (R.combo > 1) notes.push(`combo x${R.combo}`);
    const pts = k * base * posK * (0.2 + 0.8 * Math.pow(q, 1.3)) * comboK * (offBottom ? 1.25 : 1) * (0.8 + 0.2 * Math.min(1.5, C.H / 3));   // bigger surf, bigger scores
    this.ride.moves.push({ name, pts, t: this.ride.t, notes, dur, base, strong: name === 'BARREL' ? dur >= 1.5 : q >= 0.65 && crit >= 0.55 });   // (strong: a big, committed one: see the excellent rule in scoreRide)
    const big = q > 0.75 ? (name === 'BARREL' ? 'DEEP ' : 'BIG ') : '';
    this.trick = { name: big + (offBottom ? 'BOTTOM TURN + ' : '') + name + (name === 'BARREL' || name.startsWith('HANG') ? ` ${dur.toFixed(1)}s` : name.startsWith('AIR') ? ` ${dur.toFixed(1)}m` : ''), t: 0 };
  }
  // like a contest judge, out of 10: the best moves count most (diminishing after that), variety earns a bonus,
  // flow (speed kept up along the wave) a little; riding along without doing anything earns almost nothing.
  // A move you fall on doesn't count (judges score completed manoeuvres).
  // The wave's score, out of 10 like a contest: the best moves count most (each one after counts less), doing the same
  // move again is worth less and less (the third turn of a kind is worth a quarter of the first), different kinds of
  // big move earn a variety bonus, a clean finish a little. 9s are rare, a 10 needs everything. detail = the judges'
  // sheet: what counted, each line's share of the score (they add up to it).
  liveScore(fell = false, detail = false) { if (this.wave && this.ride.judge === undefined) this.ride.judge = this.wave.cond.judge ?? 1; return scoreRide(this.ride, fell, detail); }
  wipe(why) {
    this.hangT = 0; this.hang10T = 0; this.hangPocket = 0;   // (a hang you fall off doesn't count, and never carries into the next ride)
    // taken by the closeout at the very end, still on your feet: that's riding the wave to its end, not a fall
    if (this.state === 'RIDE' && this.wave && this.wave.closing && /whitewater|foam ball|lip|tube/.test(why)) { this.ride.end = 1; return this.out('Closed out: you rode it right to the end'); }   // (once it closes out the whole section throws at once: whatever it does to you then is the wave ending, not a mistake)
    this.why = why; this.set('WIPE'); this.ride.score = this.ride.t > 0 ? this.liveScore(true) : 0;
  }
  out(why) {
    this.why = why; if (this.hangT > 0 && this.state === 'RIDE') this.scoreHang();
    if (this.ride.tubeT > 0.5 && this.wave) this.move('BARREL', 0.8, this.ride.tubeT);   // the ride ended cleanly with you in (or just out of) the barrel, riding it into the sand included: that counts
    this.ride.tubeT = 0; this.set('OUT'); this.ride.score = this.ride.t > 0 ? this.liveScore() : 0;
  }

  // world pose of the board: position, forward along the board, up out of the deck
  pose(out) {
    const dx = Math.cos(this.th), dz = Math.sin(this.th);
    out.pos.set(this.x, this.y + (this.standing ? 0.04 : 0.02), this.z);
    // a board never pitches past ~50 deg standing (nose and rail bite the water); lying or sitting it floats flatter, ~25 deg
    const lim = this.standing ? 1.25 : this.onFace ? 0.85 : 0.47;   // catching, it follows the face more
    out.fwd.set(dx, Math.max(-lim, Math.min(lim, this.gAlong)), dz).normalize();
    const k = Math.min(1, (this.standing ? 2.2 : 0.8) / Math.max(0.01, Math.hypot(this.hx, this.hz)));   // same limit for how far the deck tips
    out.up.set(-this.hx * k, 1, -this.hz * k).normalize();
    if (this.air) { out.fwd.set(dx, Math.max(-0.6, Math.min(0.6, this.air.vy * 0.06)), dz).normalize(); out.up.set(0, 1, 0).addScaledVector(out.fwd, -out.fwd.y).normalize(); }   // flying: the board level under your feet, nose following your arc
    return out;
  }
}
