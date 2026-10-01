// The drone light show at the villa: a story now, his call 1 Oct 2026 ("one heartwarming, to welcome and thank people
// for the support"; it replaced the 28 Sep animal show, kept in backup_show_1001_animals.js): stars wake over the sea,
// a boat sails in, a surfer catches a wave, friends gather, the SumbaSurf wave glows, SUMBASURF, THANK YOU, and the
// letters fall as stars into the sea. It plays over whatever song the radio has on (it used to start its own song;
// changing the music made it glitch, his call 1 Oct 2026).
// How it stays smooth, the way real shows are flown: every formation is alive but never jumps; between formations each
// drone flies a straight, eased line to its new place (5 s, no start or stop jolt), the lights dim a little while they
// travel, and who goes where is worked out once so that no two paths cross.
// Still one set of 400 glowing points: nothing for a phone to draw.
import * as THREE from 'three';

const N = 400;
const TAU = Math.PI * 2;
const TR = 5;          // (seconds of each change-over)
const SC = 1.4;        // (everything a size bigger: at 130 m out it read small from the balcony)
const PRE = 2.5;       // (a moment dark and quiet before they lift)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ease = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (6 * x - 15) + 10); };   // (smootherstep: no jolt at either end)
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R1 = Float32Array.from({ length: N }, rnd), R2 = Float32Array.from({ length: N }, rnd);

// ---------- shapes: drawn on a 400 x 250 canvas, then n points spread evenly over it (fill) or along its outline (edge),
// returned in metres (w wide, centred, y up)
let CV = null;   // (one canvas for all the drawing, kept in memory for fast reading back)
function pixels(draw) {   // lit pixels as numbers (j * 400 + i): every one (fill) and the ones on the outline (edge)
  const W = 400, H = 250; if (!CV) { CV = document.createElement('canvas'); CV.width = W; CV.height = H; }
  const x = CV.getContext('2d', { willReadFrequently: true }); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  x.fillStyle = x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; x.lineWidth = 1; x.save(); draw(x); x.restore();
  const d = x.getImageData(0, 0, W, H).data, on = new Uint8Array(W * H); for (let q = 0; q < W * H; q++) on[q] = d[q * 4 + 3] > 128 ? 1 : 0;
  const fill = [], edge = [];
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { const q = j * W + i; if (!on[q]) continue; fill.push(q); if (!on[q - 1] || !on[q + 1] || !on[q - W] || !on[q + W]) edge.push(q); }
  return { fill, edge };
}
function spread(lit, n, edge = false) {   // (as evenly as it goes: a point is kept only if no kept point is nearer than r, r shrinking till n fit)
  lit = lit.slice(); for (let k = lit.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); const t = lit[k]; lit[k] = lit[r]; lit[r] = t; }
  let rad = (edge ? lit.length / n / 1.2 : 1.25 * Math.sqrt(lit.length / n)) * 1.15, out = [];   // (a first guess near the answer: an outline is about 1.2 px thick, a fill packs about 1.07 sqrt(area/n) apart)
  while (rad > 0.4) {
    out = []; const r2 = rad * rad, grid = new Map();   // (a grid of cells r wide: only the 9 round a point need looking at)
    for (const v of lit) {
      const px = v % 400, py = (v / 400) | 0, gx = Math.floor(px / rad), gy = Math.floor(py / rad); let ok = true;
      for (let ax = -1; ax <= 1 && ok; ax++) for (let ay = -1; ay <= 1 && ok; ay++) { const cell = grid.get((gx + ax) * 4096 + gy + ay); if (cell) for (let m = 0; m < cell.length; m += 2) { const dx = px - cell[m], dy = py - cell[m + 1]; if (dx * dx + dy * dy < r2) { ok = false; break; } } }
      if (ok) { out.push([px, py]); const kk = gx * 4096 + gy, cell = grid.get(kk); if (cell) cell.push(px, py); else grid.set(kk, [px, py]); if (out.length >= n) break; }
    }
    if (out.length >= n) break; rad *= 0.94;
  }
  while (out.length < n) { const v = lit[Math.floor(rnd() * lit.length)]; out.push(v === undefined ? [200, 125] : [v % 400, (v / 400) | 0]); }
  return out;
}
const toM = (pts, w, ox = 200, oy = 125) => pts.map(([i, j]) => [(i - ox) * w / 400, (oy - j) * w / 400]);
function shape(draw, nEdge, nFill, w, ox, oy) { const px = pixels(draw); return toM(spread(px.edge, nEdge, true).concat(nFill ? spread(px.fill, nFill) : []), w, ox, oy); }
// points evenly along a polyline (canvas units in, metres out)
function along(pts, n, w, ox = 200, oy = 125) {
  const seg = []; let L = 0; for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(l); L += l; }
  const out = []; for (let q = 0; q < n; q++) { let s = (n === 1 ? 0.5 : q / (n - 1)) * L, k = 0; while (k < seg.length - 1 && s > seg[k]) { s -= seg[k]; k++; } const f = seg[k] ? s / seg[k] : 0; out.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]); }
  return toM(out, w, ox, oy);
}
// a recycling effect (a bubble, a drop of spray) that never jumps: out along its path while lit (0 -> 1), then quietly
// back to where it started while dark, so a change-over blending it never shows a jump or a jolt
const loop = (age) => [0.5 - 0.5 * Math.cos(TAU * age), Math.max(0, Math.sin(TAU * age))];   // (out and back on a smooth swing: lit on the way out only)
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const set = (p, c, u, v, w, r, g, b) => { p[0] = u; p[1] = v; p[2] = w; c[0] = r; c[1] = g; c[2] = b; };

// (the shapes and the flight plan are made a slice at a time in the background once the villa is up, so a phone never
// stalls: see work(); anything asked for before it's ready is finished on the spot)
let S_ = {}, SH_DONE = false, READY = false, GEN = null;
function* shapeGen() {
  const s = S_;
  // a sailing boat side on, heading right: hull, mast, a mainsail and a jib
  const BW = 104;
  s.hullE = shape((x) => { x.beginPath(); x.moveTo(84, 158); x.lineTo(318, 158); x.quadraticCurveTo(300, 196, 250, 200); x.lineTo(130, 200); x.quadraticCurveTo(96, 190, 84, 158); x.closePath(); x.fill(); }, 70, 40, BW);
  yield;
  s.main = shape((x) => { x.beginPath(); x.moveTo(206, 34); x.lineTo(206, 150); x.lineTo(292, 150); x.quadraticCurveTo(258, 96, 206, 34); x.fill(); }, 70, 56, BW);
  yield;
  s.jib = shape((x) => { x.beginPath(); x.moveTo(198, 52); x.lineTo(198, 150); x.lineTo(118, 150); x.quadraticCurveTo(150, 104, 198, 52); x.fill(); }, 50, 30, BW);
  yield;
  s.mast = along([[202, 30], [202, 158]], 16, BW);
  // a big wave from the side, curling to the right, and a surfer on its face, crouched, arms out
  const WW = 120;
  yield;
  s.waveE = shape((x) => { x.beginPath(); x.moveTo(8, 232); x.bezierCurveTo(120, 228, 200, 170, 236, 70); x.bezierCurveTo(250, 34, 300, 22, 336, 46); x.bezierCurveTo(360, 64, 356, 98, 330, 104);
    x.bezierCurveTo(318, 84, 296, 82, 290, 104); x.bezierCurveTo(286, 140, 330, 200, 392, 232); x.closePath(); x.fill(); }, 150, 90, WW);
  yield;
  // (on the face under the curl, where a surfer rides it: they were on its back, his eye 1 Oct 2026)
  s.surfer = shape((x) => { x.translate(116, 36); x.lineWidth = 7; x.beginPath(); x.moveTo(196, 140); x.lineTo(206, 112); x.lineTo(218, 140); x.moveTo(206, 112); x.lineTo(204, 88); x.moveTo(182, 92); x.lineTo(226, 84); x.stroke();
    x.beginPath(); x.arc(204, 78, 8, 0, TAU); x.fill(); }, 30, 40, WW);
  yield;
  s.board = shape((x) => { x.beginPath(); x.ellipse(322, 182, 34, 5, 0.55, 0, TAU); x.fill(); }, 22, 8, WW);   // (along the face, nose down the line)
  // three friends standing on the sand, each holding a board upright beside them
  const FW = 132;
  yield;
  s.friend = shape((x) => { x.lineWidth = 8; x.beginPath(); x.moveTo(186, 210); x.lineTo(200, 160); x.lineTo(214, 210); x.moveTo(200, 160); x.lineTo(200, 112); x.moveTo(200, 124); x.lineTo(222, 150); x.stroke();
    x.beginPath(); x.arc(200, 98, 12, 0, TAU); x.fill(); }, 26, 30, FW, 200, 125);   // (no left arm: it waves, worked out as it moves)
  yield;
  s.fBoard = shape((x) => { x.lineWidth = 4; x.beginPath(); x.ellipse(236, 140, 13, 70, 0, 0, TAU); x.stroke(); }, 34, 0, FW, 200, 125);
  // the SumbaSurf wave (the game's icon, as on the shortboard's deck) and the sand-gold line under it
  const LW = 96, logo = (x) => { x.translate(200, 128); x.scale(0.56, 0.56); x.translate(-256, -265); x.beginPath(); x.moveTo(70, 390); x.bezierCurveTo(150, 390, 190, 300, 250, 190); x.bezierCurveTo(300, 110, 420, 110, 440, 200);
    x.bezierCurveTo(450, 250, 420, 300, 370, 300); x.bezierCurveTo(400, 260, 390, 210, 350, 205); x.bezierCurveTo(300, 200, 280, 260, 290, 330); x.bezierCurveTo(296, 370, 330, 390, 380, 390); x.closePath(); x.fill(); };
  yield;
  s.logo = shape(logo, 200, 130, LW);
  yield;
  s.logoBar = shape((x) => { x.translate(200, 128); x.scale(0.56, 0.56); x.translate(-256, -265); x.fillRect(60, 405, 392, 16); }, 50, 20, LW);
  SH_DONE = true;
}
function* allGen() { yield* shapeGen(); text(); yield; yield* planGen(); READY = true; }
let MAXSTEP = 0; const step = () => { if (!GEN) GEN = allGen(); const t0 = performance.now(); if (GEN.next().done) READY = SH_DONE = true; MAXSTEP = Math.max(MAXSTEP, performance.now() - t0); };
function work(ms) { const t0 = performance.now(); while (!READY && performance.now() - t0 < ms) step(); }
function shapes() { while (!SH_DONE) step(); return S_; }
let TEXT = null;
function text() {   // (made when a show starts: by then the game's own font is in)
  if (!TEXT) TEXT = {
    sumba: shape((x) => { x.font = '800 86px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SUMBASURF', 200, 130); }, 370, 30, 150),
    thanks: shape((x) => { x.font = '800 90px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('THANK YOU', 200, 130); }, 320, 80, 130) };
  return TEXT;
}

// ---------- the scenes. f(i, t, p, c): where drone slot i is at t seconds into the scene (metres: p[0] left to right,
// p[1] up from the water, p[2] away from you) and its colour. Every one keeps moving and never jumps.
const line = (i) => (i / (N - 1) - 0.5) * 150;
const sea = (i, n, t, y = 6) => { const u = (i / (n - 1) - 0.5) * 150; return [u, y + 0.9 * Math.sin(u * 0.12 - t * 1.2)]; };   // (a line of sea under a scene)
const scat = (i) => [(R1[i] - 0.5) * 180, 0.5, (R2[i] - 0.5) * 40];   // (waiting on the water before they lift: scattered, not a line)
const SCENES = [
  { name: 'stars', hold: 8, f(i, t, p, c) {   // they wake one by one off the water and climb into a field of stars, twinkling
    const [x0, , z0] = scat(i), k = ease((t - R2[i] * 3.2) / 3.8), x = x0 * (0.9 + 0.1 * k), y = 0.5 + k * (18 + Math.pow(R1[(i * 7) % N], 0.8) * 78), tw = 0.55 + 0.45 * Math.sin(t * (1.3 + R1[i] * 2.2) + i);
    set(p, c, x, y, z0, (0.75 + 0.25 * tw) * (0.4 + 0.6 * k), (0.82 + 0.18 * tw) * (0.4 + 0.6 * k), 1 * (0.4 + 0.6 * k)); } },
  { name: 'boat', hold: 9.5, f(i, t, p, c) {   // a little boat sails in across the dark sea, rocking on the swell, a wake behind
    const s = shapes(), cu = -24 + 2.2 * t, roll = 0.045 * Math.sin(t * 1.1), bob = 0.8 * Math.sin(t * 1.1 + 0.6);
    let x, y, r = 1, g = 0.9, b = 0.75;
    if (i < 110) { [x, y] = s.hullE[i]; r = 0.95; g = 0.72; b = 0.45; }
    else if (i < 236) { [x, y] = s.main[i - 110]; y += 0.6 * Math.sin(t * 2 + x * 0.2) * (x / 12); r = g = 1; b = 0.9; }
    else if (i < 316) { [x, y] = s.jib[i - 236]; r = 1; g = 0.95; b = 0.82; }
    else if (i < 332) { [x, y] = s.mast[i - 316]; r = 0.9; g = 0.75; b = 0.55; }
    else if (i < 382) { const [u, v] = sea(i - 332, 50, t, 22.5); set(p, c, u, v, 0, 0.12, 0.38, 0.95); return; }   // (the sea it sails on: the hull's keel is at ~20.5 m)
    else { const j = i - 382, [a, fade] = loop((t * 0.5 + j / 18) % 1); set(p, c, cu - 26 - a * 30, 23 + 0.6 * Math.sin(a * 9 + j), 0, 0.5 * fade, 0.8 * fade, fade); return; }   // (the wake)
    const [px, py] = rot(x, y, roll); set(p, c, cu + px, 40 + py + bob, 0, r, g, b); } },
  { name: 'wave', hold: 15, f(i, t, p, c) {   // the big chorus: a wave rears up and a surfer rides it down the line, spray off the top
    const s = shapes(), surge = 1 + 0.03 * Math.sin(t * 0.9);
    if (i < 240) { let [x, y] = s.waveE[i]; const lip = smooth((x - 20) / 30) * smooth((y - 10) / 30);   // (the lip pitches forward and back a little)
      x += lip * 2.2 * Math.sin(t * 1.4); const blue = i < 150 ? [0.35, 0.85, 1] : [0.08, 0.42, 0.9]; set(p, c, x * surge, 44 + y * surge, 0, ...blue); return; }
    const ride = Math.sin(t * 0.55), sx = 4 * ride, sy = -4 * ride;   // (the surfer carves down and back up the face, along it)
    if (i < 310) { const [x, y] = s.surfer[i - 240]; set(p, c, x + sx, 44 + y + sy, -1, 1, 0.82, 0.5); return; }
    if (i < 340) { const [x, y] = s.board[i - 310]; set(p, c, x + sx, 44 + y + sy, -1, 1, 0.55, 0.3); return; }
    if (i < 380) { const j = i - 340, [a, fade] = loop((t * 0.6 + j / 40) % 1); set(p, c, 32 + a * 20 + (R1[i] - 0.5) * 8, 70 + a * 12 - a * a * 18, 0, 0.8 * fade, 0.95 * fade, fade); return; }
    const [u, v] = sea(i - 380, 20, t, 12); set(p, c, u, v, 0, 0.1, 0.32, 0.85); } },   // (the sea in front of it: the wave's foot is at ~12 m)
  { name: 'friends', hold: 11, f(i, t, p, c) {   // one surfer becomes three friends on the sand, boards beside them; the middle one waves
    const s = shapes(), XC = [-50, 0, 50], COL = [[1, 0.55, 0.42], [1, 0.82, 0.5], [0.45, 0.9, 0.85]];
    if (i < 168) { const k = Math.floor(i / 56), q = s.friend[i % 56]; set(p, c, XC[k] + q[0], 42 + q[1] + 0.3 * Math.sin(t * 2 + k), 0, ...COL[k]); return; }
    if (i < 270) { const k = Math.floor((i - 168) / 34), q = s.fBoard[(i - 168) % 34]; set(p, c, XC[k] + q[0], 42 + q[1], 0.5, COL[k][0] * 0.8, COL[k][1] * 0.8, COL[k][2] * 0.8); return; }
    if (i < 330) { const j = i - 270, k = Math.floor(j / 20), f = (j % 20) / 19;   // (the left arms, from the shoulder: the middle friend waving overhead, the others hanging easy)
      const a = k === 1 ? 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 5)) : 2.75 + 0.08 * Math.sin(t * 1.5 + k), L = 11 * f;   // (a: angle from straight up)
      set(p, c, XC[k] - Math.sin(a) * L, 42 + 0.33 + Math.cos(a) * L, 0, ...COL[k]); return; }
    const [u, v] = sea(i - 330, 70, t, 0); set(p, c, u, 42 - 28.5 + v * 0.3, 0, 0.75, 0.6, 0.38); } },   // (the sand they stand on)
  { name: 'logo', hold: 11, f(i, t, p, c) {   // the SumbaSurf wave, glowing sea green, a slow light running over it, the sand-gold line under it
    const s = shapes(), br = 1 + 0.025 * Math.sin(t * 1.4);
    if (i < 330) { const [x, y] = s.logo[i], sh = 0.5 + 0.5 * Math.sin(x * 0.12 - t * 1.8), edge = i < 200; set(p, c, x * br, 44 + y * br, 0, (edge ? 0.7 : 0.5) + 0.3 * sh, 0.95, edge ? 0.88 : 0.8); return; }
    const [x, y] = s.logoBar[i - 330]; set(p, c, x * br, 44 + y * br, 0, 1, 0.78, 0.45); } },
  { name: 'sumba', hold: 14, f(i, t, p, c) {   // SUMBASURF in the quiet of the song (WELCOME taken out, his call 1 Oct 2026: SUMBASURF has its time)
    const q = text().sumba[i], sh = 0.5 + 0.5 * Math.sin(q[0] * 0.12 - t * 2), wv = Math.sin(q[0] * 0.05 + t * 0.9) * 1.1;
    set(p, c, q[0], 46 + q[1] + wv, 0, 0.5 + 0.5 * sh, 0.93 + 0.07 * sh, 0.82 + 0.18 * sh); } },   // (sea green, a white light running through)
  { name: 'thanks', hold: 16, f(i, t, p, c) {   // THANK YOU on the last chorus, brighter, the shimmer running faster
    const q = text().thanks[i], sh = 0.5 + 0.5 * Math.sin(q[0] * 0.14 - t * 2.6), wv = Math.sin(q[0] * 0.06 + t * 1.1) * 1.2;
    set(p, c, q[0], 46 + q[1] + wv, 0, 1, 0.85 + 0.15 * sh, 0.6 + 0.4 * sh); } },
  { name: 'fall', hold: 12, f(i, t, p, c) {   // the letters let go one by one and fall as shooting stars into the sea, and the lights go out
    const q = text().thanks[i], d = (q[0] + 65) / 130 * 3.5 + R1[i] * 1.5, k = Math.max(0, t - d), y = 46 + q[1] - k * k * 3;   // (left to right they let go, then fall ever faster)
    const vis = smooth((y - 0.5) / 4) * (0.45 + 0.55 * Math.max(0, 1 - k / 3)); set(p, c, q[0] + k * 2.5 * (R2[i] - 0.5), Math.max(0.5, y), 0, vis, 0.85 * vis, 0.55 * vis); } },   // (dimming as they fall, out as they reach the water)
];
const START = []; { let a = 0; for (const s of SCENES) { START.push(a); a += s.hold; } }
const END = START[START.length - 1] + SCENES[SCENES.length - 1].hold;

// who flies where: each change-over pairs every drone with a place in the next formation so that the paths are short
// and none cross (seen from the balcony). Rank by a Hilbert curve for a good start, then swap any two whose paths
// together get shorter, until no swap helps
function hilbert(x, y) { let d = 0; for (let s = 512; s > 0; s >>= 1) { const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0; d += s * s * ((3 * rx) ^ ry); if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const t = x; x = y; y = t; } } return d; }
function* pairGen(A, B) {   // A: where each drone is, B: the places; returns place index for each drone
  const key = (p) => hilbert(clamp(Math.round((p[0] + 80) * 6), 0, 1023), clamp(Math.round((p[1] + 10) * 8), 0, 1023));
  const ia = [...A.keys()].sort((a, b) => key(A[a]) - key(A[b])), ib = [...B.keys()].sort((a, b) => key(B[a]) - key(B[b])), to = new Int32Array(N);
  ia.forEach((d, r) => (to[d] = ib[r]));
  const M = new Float32Array(N * N); for (let d = 0; d < N; d++) for (let j = 0; j < N; j++) M[d * N + j] = Math.hypot(A[d][0] - B[j][0], A[d][1] - B[j][1]);
  const dist = (d, j) => M[d * N + j];
  yield;
  let pass0 = 0;
  for (let pass = 0; pass < 80; pass++) { pass0 = pass;
    let changed = false;
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
      const ja = to[a], jb = to[b];
      if (dist(a, jb) + dist(b, ja) < dist(a, ja) + dist(b, jb) - 1e-6) { to[a] = jb; to[b] = ja; changed = true; }
    }
    if (!changed) break;
    yield;
  }
  PASSES.push(pass0);
  return to;
}
const PASSES = []; export const _debug = () => { const P = plan(), p = [0, 0, 0], c = [0, 0, 0], out = [];   // (for checking: crossings left in each change-over, as planned)
  for (let s = 0; s + 1 < SCENES.length; s++) { const A = [], B = []; for (let d = 0; d < N; d++) { SCENES[s].f(P[s][d], SCENES[s].hold, p, c); A.push([p[0], p[1]]); SCENES[s + 1].f(P[s + 1][d], TR, p, c); B.push([p[0], p[1]]); }
    const o = (a, b, q) => Math.sign((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])); let n = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (o(A[i], B[i], A[j]) * o(A[i], B[i], B[j]) < 0 && o(A[j], B[j], A[i]) * o(A[j], B[j], B[i]) < 0) n++; out.push(n); }
  return { passes: PASSES, crossings: out, maxStepMs: +MAXSTEP.toFixed(1) }; };
let PLAN = null, PLAN_P = null;   // PLAN[s][d]: drone d's slot in formation s
// the shapes and the plan come ready-made in show-data.json (made once from this file with _export, 28 Sep 2026), so a
// phone does no preparing at all and the show looks the same on every device. Change a formation and bump DATA_V: an
// old file is then ignored and everything is worked out on the phone as before
const DATA_V = 'story-5';
export function _export() { plan(); const r = (a) => a.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]); return { v: DATA_V, shapes: Object.fromEntries(Object.entries(S_).map(([k, a]) => [k, r(a)])), text: r(TEXT), plan: PLAN.map((a) => Array.from(a)) }; }
function load(d) {
  if (!d || d.v !== DATA_V || !Array.isArray(d.plan) || d.plan.length !== SCENES.length || d.plan.some((a) => a.length !== N) || !d.text || d.text.length !== N || READY || GEN) return false;
  S_ = d.shapes; TEXT = d.text; PLAN = d.plan.map((a) => Int32Array.from(a)); SH_DONE = READY = true; return true;
}
function* planGen() {
  const p = [0, 0, 0], c = [0, 0, 0], P = [Int32Array.from({ length: N }, (_, i) => i)];
  for (let s = 0; s + 1 < SCENES.length; s++) {
    const A = [], B = [];
    for (let d = 0; d < N; d++) { SCENES[s].f(P[s][d], SCENES[s].hold, p, c); A.push([p[0], p[1]]); }
    for (let j = 0; j < N; j++) { SCENES[s + 1].f(j, TR, p, c); B.push([p[0], p[1]]); }
    yield;
    P.push(yield* pairGen(A, B));
  }
  PLAN = P;
}
function plan() { while (!READY) step(); return PLAN; }

export function droneShow(scene) {
  const bg = () => { work(5); if (!READY) setTimeout(bg, 40); };
  fetch(new URL('./story-data.json?v=' + DATA_V, import.meta.url)).then((r) => (r.ok ? r.json() : null)).then((d) => { if (!load(d)) setTimeout(bg, 0); }).catch(() => setTimeout(bg, 0));   // (no file, or an old one: prepare here, a slice at a time)
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tw = new Float32Array(N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 600 }, uFade: { value: 0 } },
    vertexShader: 'attribute vec3 color; attribute float aTw; varying vec3 vC; varying float vT; uniform float uScale; void main(){ vC = color; vT = aTw; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = clamp(3.4 * uScale / -mv.z, 2.5, 30.); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; varying float vT; uniform float uFade; void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; float core = smoothstep(.42, .0, d), halo = exp(-d * d * 5.) * .5; gl_FragColor = vec4(vC * (core * 1.5 + halo) * vT * uFade, 1.); }',
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5; scene.add(pts);
  const S = { on: false, t: 0, night: 0, done: false, C: new THREE.Vector3(), R: new THREE.Vector3(), D: new THREE.Vector3(), scene: -1 };
  const pa = [0, 0, 0], ca = [0, 0, 0], pb = [0, 0, 0], cb = [0, 0, 0];
  function place(beat) {
    const T = S.t - PRE;
    let s = 0; while (s + 1 < SCENES.length && T >= START[s + 1]) s++;
    const P = s === 0 ? null : plan();   // (the first formation needs no plan: every drone is still where it started)
    S.scene = s;
    const inT = s > 0 && T < START[s] + TR, k = inT ? (T - START[s]) / TR : 1, e = ease(k), dim = inT ? 1 - 0.4 * Math.sin(Math.PI * k) : 1;   // (in a change-over the lights dim a little on the way)
    const pulse = 1 + 0.12 * beat;
    for (let d = 0; d < N; d++) {
      SCENES[s].f(P ? P[s][d] : d, Math.max(0, T - START[s]), pb, cb);
      let x = pb[0], y = pb[1], z = pb[2], r = cb[0], gg = cb[1], b = cb[2];
      if (inT) { SCENES[s - 1].f(P[s - 1][d], T - START[s - 1], pa, ca); x = pa[0] + (x - pa[0]) * e; y = pa[1] + (y - pa[1]) * e; z = pa[2] + (z - pa[2]) * e; r = ca[0] + (r - ca[0]) * e; gg = ca[1] + (gg - ca[1]) * e; b = ca[2] + (b - ca[2]) * e; }
      if (T < 0) { [x, y, z] = scat(d); r = 0.4; gg = 0.42; b = 0.5; }   // (waiting on the water, scattered and dim, before they lift)
      y += Math.sin(S.t * 1.3 + d * 0.7) * 0.08;   // (hovering: never dead still)
      const i3 = d * 3;
      x *= SC; y *= SC; z *= SC;
      pos[i3] = S.C.x + S.R.x * x + S.D.x * z; pos[i3 + 1] = S.C.y + y; pos[i3 + 2] = S.C.z + S.R.z * x + S.D.z * z;
      col[i3] = r * dim; col[i3 + 1] = gg * dim; col[i3 + 2] = b * dim;
      tw[d] = (0.88 + 0.12 * Math.sin(S.t * 2.3 + d * 1.7)) * pulse;
    }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.aTw.needsUpdate = true;
  }
  return {
    get on() { return S.on; }, get night() { return S.night; }, get done() { return S.done; },
    get state() { return { t: S.t, scene: S.scene >= 0 ? SCENES[S.scene].name : '-', on: S.on, length: PRE + END }; },
    // centre: the middle of the show at the water's height; right: its left-to-right direction (flat)
    start(center, right) {
      S.C.copy(center); S.R.copy(right).setY(0).normalize(); S.D.set(-S.R.z, 0, S.R.x); S.on = true; S.t = 0; S.done = false; pts.visible = true; place(0);
    },
    seek(t) { S.t = t; if (S.t >= PRE + END) { S.on = false; S.done = true; } else place(0); },   // (joining a show a friend started; also for checking)
    stop() { S.on = false; S.done = true; },
    update(dt, pxPerRad, beat = 0) {
      mat.uniforms.uScale.value = pxPerRad;
      S.night += ((S.on ? 1 : 0) - S.night) * Math.min(1, dt * 0.9);   // the sky goes to night over a few seconds (and back after)
      mat.uniforms.uFade.value = S.on ? Math.min(1, S.t / 1.5) : Math.max(0, mat.uniforms.uFade.value - dt * 0.8);
      if (!S.on) { if (mat.uniforms.uFade.value <= 0) pts.visible = false; return; }
      work(4); S.t += dt;   // (any preparing left, a little each frame)
      if (S.t >= PRE + END) { S.on = false; S.done = true; return; }
      place(beat);
    },
  };
}
