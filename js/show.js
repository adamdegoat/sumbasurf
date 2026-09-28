// The drone light show at the villa (his brief 28 Sep 2026: animals of the sea and of Sumba, smooth and professional).
// About a minute and three quarters over the open sea: night falls, 400 drones lift off the water as a line, then a sea
// turtle, a manta ray, a pod of dolphins, a humpback whale, a galloping Sumba horse and a sea eagle, SUMBA in lights,
// and back down to the sea.
// How it stays smooth, the way real shows are flown: every formation is alive (flippers stroke, wings flap, legs
// gallop) but never jumps; between formations each drone flies a straight, eased line to its new place (5 s, no start
// or stop jolt), the lights dim a little while they travel, and who goes where is worked out once at the start so that
// no two paths cross (a swap that shortens the total is always made, and crossing paths can always be shortened).
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
  // sea turtle, from above, head to the right: shell outline and plates, head, two big front flippers and two small back ones
  const TW = 110;
  s.shellEdge = shape((x) => { x.lineWidth = 5; x.beginPath(); x.ellipse(190, 125, 80, 58, 0, 0, TAU); x.stroke(); }, 84, 0, TW);
  yield;
  s.scutes = shape((x) => { x.lineWidth = 4; x.beginPath(); x.ellipse(192, 125, 46, 30, 0, 0, TAU); x.stroke();
    for (const a of [0.55, 1.35, 1.8, 2.6, 3.7, 4.5, 4.95, 5.75]) { x.beginPath(); x.moveTo(192 + 46 * Math.cos(a), 125 + 30 * Math.sin(a)); x.lineTo(190 + 76 * Math.cos(a), 125 + 55 * Math.sin(a)); x.stroke(); }
    x.beginPath(); x.moveTo(170, 97); x.lineTo(170, 153); x.moveTo(214, 97); x.lineTo(214, 153); x.stroke(); }, 72, 0, TW);
  yield;
  s.head = shape((x) => { x.beginPath(); x.ellipse(292, 125, 25, 17, 0, 0, TAU); x.fill(); x.fillRect(262, 116, 20, 18); }, 26, 12, TW);
  yield;
  s.fFlip = shape((x) => { x.beginPath(); x.moveTo(200, 125); x.quadraticCurveTo(236, 80, 214, 28); x.quadraticCurveTo(206, 20, 198, 30); x.quadraticCurveTo(186, 80, 182, 125); x.closePath(); x.fill(); }, 40, 16, TW, 200, 125);   // (root at 0,0, pointing up)
  yield;
  s.rFlip = shape((x) => { x.beginPath(); x.moveTo(200, 125); x.quadraticCurveTo(206, 96, 186, 86); x.quadraticCurveTo(172, 84, 172, 100); x.quadraticCurveTo(178, 118, 194, 128); x.closePath(); x.fill(); }, 18, 6, TW, 200, 125);
  yield;
  s.tail = along([[112, 125], [96, 125]], 6, TW);
  // manta ray, from above, head up
  const MW = 120;
  const manta = (x) => { x.beginPath(); x.moveTo(200, 62); x.bezierCurveTo(262, 50, 340, 76, 390, 118); x.bezierCurveTo(330, 138, 258, 150, 214, 182); x.lineTo(200, 190); x.lineTo(186, 182);
    x.bezierCurveTo(142, 150, 70, 138, 10, 118); x.bezierCurveTo(60, 76, 138, 50, 200, 62); x.closePath(); x.fill(); };
  yield;
  s.manta = shape(manta, 176, 150, MW);
  yield;
  s.horns = shape((x) => { x.lineWidth = 7; x.beginPath(); x.moveTo(188, 64); x.quadraticCurveTo(176, 50, 182, 36); x.moveTo(212, 64); x.quadraticCurveTo(224, 50, 218, 36); x.stroke(); }, 24, 0, MW);
  yield;
  s.mantaTail = along([[200, 190], [200, 248]], 30, MW);   // (swayed as it's drawn)
  // dolphin, side on, head to the right
  const DW = 36;
  yield;
  s.dolphin = shape((x) => { x.beginPath(); x.moveTo(44, 128); x.bezierCurveTo(120, 76, 270, 72, 352, 112); x.lineTo(392, 122); x.lineTo(354, 130); x.bezierCurveTo(280, 168, 130, 164, 44, 136); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(190, 84); x.quadraticCurveTo(170, 58, 162, 36); x.quadraticCurveTo(206, 54, 232, 82); x.fill();
    x.beginPath(); x.moveTo(270, 142); x.quadraticCurveTo(250, 170, 236, 184); x.quadraticCurveTo(272, 170, 296, 144); x.fill();
    x.beginPath(); x.moveTo(52, 132); x.lineTo(8, 100); x.quadraticCurveTo(22, 132, 8, 164); x.closePath(); x.fill(); }, 64, 36, DW);
  // humpback whale, side on, head to the right, with its long pectoral fin
  const HW = 96;
  yield;
  s.whale = shape((x) => { x.beginPath(); x.moveTo(36, 112); x.bezierCurveTo(90, 96, 190, 64, 300, 72); x.bezierCurveTo(350, 76, 388, 96, 394, 118); x.bezierCurveTo(390, 136, 360, 150, 300, 154);
    x.bezierCurveTo(200, 160, 110, 138, 36, 122); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(40, 116); x.bezierCurveTo(24, 96, 10, 84, 2, 80); x.bezierCurveTo(14, 104, 14, 128, 2, 150); x.bezierCurveTo(12, 146, 26, 136, 40, 118); x.fill(); }, 130, 104, HW);
  yield;
  s.fin = shape((x) => { x.beginPath(); x.moveTo(200, 125); x.bezierCurveTo(184, 140, 162, 160, 142, 172); x.bezierCurveTo(168, 176, 196, 158, 222, 134); x.closePath(); x.fill(); }, 30, 12, HW, 200, 125);
  yield;
  s.grooves = shape((x) => { x.lineWidth = 3; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(372 - k * 6, 132 + k * 5); x.quadraticCurveTo(320, 146 + k * 4, 250, 146 + k * 3); x.stroke(); } }, 34, 0, HW);
  // Sumba horse, side on, head to the right: the body drawn, legs, mane and tail worked out as it gallops
  const QW = 92;
  yield;
  s.horse = shape((x) => { x.beginPath(); x.moveTo(95, 110); x.bezierCurveTo(95, 80, 140, 75, 190, 85); x.bezierCurveTo(230, 90, 255, 80, 270, 60); x.bezierCurveTo(285, 40, 300, 20, 325, 18);
    x.bezierCurveTo(345, 18, 375, 40, 388, 58); x.bezierCurveTo(392, 66, 385, 74, 372, 72); x.bezierCurveTo(350, 66, 335, 62, 322, 66); x.bezierCurveTo(305, 72, 300, 95, 296, 115);
    x.bezierCurveTo(292, 140, 262, 150, 232, 148); x.bezierCurveTo(190, 150, 150, 150, 125, 145); x.bezierCurveTo(105, 140, 92, 128, 95, 110); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(318, 20); x.lineTo(314, 2); x.lineTo(330, 17); x.fill(); }, 136, 90, QW);
  // sea eagle, facing you, wings out: body, head, tail fan (the wings are worked out as they flap)
  const EW = 100;
  const wing = (x) => {   // (the right wing: broad from the shoulder, and five long primaries fanned out at the tip)
    x.beginPath(); x.moveTo(212, 100); x.bezierCurveTo(238, 86, 268, 72, 300, 70); x.bezierCurveTo(314, 70, 324, 74, 330, 80); x.lineTo(332, 118);
    x.quadraticCurveTo(318, 114, 310, 126); x.quadraticCurveTo(298, 118, 288, 130); x.quadraticCurveTo(276, 122, 264, 134); x.quadraticCurveTo(250, 126, 238, 138); x.lineTo(212, 142); x.closePath(); x.fill();
    x.lineWidth = 8; for (let f = 0; f < 5; f++) { const a = -0.38 + f * 0.24, bx = 326, by = 82 + f * 8.5, L = 58 - f * 6; x.beginPath(); x.moveTo(bx - 6, by); x.lineTo(bx + Math.cos(a) * L, by + Math.sin(a) * L); x.stroke(); } };
  yield;
  s.eWing = shape((x) => wing(x), 86, 60, EW);   // (the right wing; the left is its mirror)
  yield;
  s.eBody = shape((x) => { x.beginPath(); x.ellipse(200, 122, 18, 42, 0, 0, TAU); x.fill(); }, 26, 18, EW);   // (44)
  yield;
  s.eHead = shape((x) => { x.beginPath(); x.arc(200, 76, 14, 0, TAU); x.fill(); }, 18, 8, EW);
  yield;
  s.eTail = shape((x) => { x.beginPath(); x.moveTo(188, 158); x.lineTo(168, 210); x.quadraticCurveTo(200, 220, 232, 210); x.lineTo(212, 158); x.closePath(); x.fill(); }, 24, 10, EW);
  SH_DONE = true;
}
function* allGen() { yield* shapeGen(); text(); yield; yield* planGen(); READY = true; }
let MAXSTEP = 0; const step = () => { if (!GEN) GEN = allGen(); const t0 = performance.now(); if (GEN.next().done) READY = SH_DONE = true; MAXSTEP = Math.max(MAXSTEP, performance.now() - t0); };
function work(ms) { const t0 = performance.now(); while (!READY && performance.now() - t0 < ms) step(); }
function shapes() { while (!SH_DONE) step(); return S_; }
let TEXT = null;
function text() {   // (made when a show starts: by then the game's own font is in)
  if (!TEXT) TEXT = shape((x) => { x.font = '800 150px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SUMBA', 200, 132); }, 330, 70, 118);
  return TEXT;
}

// ---------- the formations. f(i, t, p, c): where drone slot i is at t seconds into the formation (metres: p[0] left to
// right, p[1] up from the water, p[2] away from you) and its colour. Every one keeps moving and never jumps.
const line = (i) => (i / (N - 1) - 0.5) * 150;
const SCENES = [
  { name: 'rise', hold: 9, f(i, t, p, c) {   // off the water as one long line, lifting into a slow swell
    const u = line(i), k = ease(t / 7), v = 0.5 + k * (36 + 5 * Math.sin(u * 0.05 + t * 0.7)), g = 0.5 + 0.5 * Math.sin(u * 0.04 - t * 0.8);
    set(p, c, u, v, Math.sin(u * 0.03 + t * 0.4) * 4 * k, 1, 0.82 + 0.15 * g, 0.62 + 0.38 * g); } },
  { name: 'turtle', hold: 13, f(i, t, p, c) {   // a sea turtle swimming, its big front flippers sweeping together, bubbles behind
    const s = shapes(), cu = -10 + 1.6 * t, cv = 45 + 2 * Math.sin(t * 0.8), tilt = 0.05 * Math.sin(t * 0.8), st = Math.sin(t * TAU / 3.4);
    let x, y, r, g, b;
    if (i < 84) { [x, y] = s.shellEdge[i]; [r, g, b] = [0.3, 1, 0.62]; }
    else if (i < 156) { [x, y] = s.scutes[i - 84]; [r, g, b] = [1, 0.8, 0.35]; }
    else if (i < 194) { [x, y] = s.head[i - 156]; [r, g, b] = [0.6, 1, 0.7]; }
    else if (i < 306) { const j = i - 194, top = j < 56, q = s.fFlip[j % 56], a = 0.25 + 0.55 * st;   // (the stroke: reaching forward, then swept right back)
      const [qx, qy] = rot(q[0], q[1], top ? a : -a); x = 11 + qx; y = top ? 10 + qy : -10 - qy; [r, g, b] = [0.5, 1, 0.66]; }
    else if (i < 354) { const j = i - 306, top = j < 24, q = s.rFlip[j % 24], a = 0.25 * Math.sin(t * TAU / 3.4 + 1.6);
      const [qx, qy] = rot(q[0], q[1], top ? a : -a); x = -22 + qx; y = top ? 12 + qy : -12 - qy; [r, g, b] = [0.5, 1, 0.66]; }
    else if (i < 360) { [x, y] = s.tail[i - 354]; [r, g, b] = [0.5, 1, 0.66]; }
    else { const j = i - 360, [a, fade] = loop((t * 0.45 + j / 40) % 1);   // (bubbles: rising and drifting back, fading in and out)
      x = -34 - a * 26 + Math.sin(a * 6 + j) * 2.5; y = (R1[i] - 0.5) * 14 + a * 18; [r, g, b] = [0.55 * fade, 0.85 * fade, fade]; }
    const [px, py] = rot(x, y, tilt); set(p, c, cu + px, cv + py, 0, r, g, b); } },
  { name: 'manta', hold: 13, f(i, t, p, c) {   // a manta ray gliding up, its wings rippling from the body out to the tips
    const s = shapes(), cu = 2 * Math.sin(t * 0.35), cv = 38 + 0.9 * t, bank = 0.06 * Math.sin(t * 0.5), span = 58;
    let x, y, r = 0.3, g = 0.5, b = 1;
    if (i < 326) { [x, y] = s.manta[i]; if (i < 176) { r = 0.55; g = 0.85; b = 1; } if (Math.abs(x) > 8 && Math.abs(x) < 20 && y > -4 && y < 10) { r = g = b = 0.95; } }
    else if (i < 350) { [x, y] = s.horns[i - 326]; r = 0.55; g = 0.85; b = 1; }
    else { const j = i - 350; [x, y] = s.mantaTail[j % 30]; x += Math.sin(t * 1.3 - j * 0.25) * j * 0.08; r = 0.4; g = 0.6; b = 1; }
    const d = Math.abs(x) / span; y += Math.sin(t * TAU / 4 - d * 2.6) * 11 * Math.pow(d, 1.6); x *= 1 - 0.05 * (1 - Math.cos(t * TAU / 4 - d * 2.6)) * d;   // (the ripple)
    const [px, py] = rot(x, y, bank); set(p, c, cu + px, cv + py, 0, r, g, b); } },
  { name: 'dolphins', hold: 13, f(i, t, p, c) {   // a pod of three dolphins leaping, each round and round its own wheel: over the top in the air, back under the sea in the dark
    const s = shapes(), W = TAU / 4.4, XC = [-46, 0, 46], OFF = [0.6, 2.7, 4.8], R = 19, RZ = 25, SEA = 24;
    if (i < 300) {
      const k = Math.floor(i / 100), q = s.dolphin[i % 100], th = OFF[k] - W * t, X = XC[k] + R * Math.cos(th), Y = SEA + RZ * Math.sin(th);
      const ang = Math.atan2(-RZ * Math.cos(th), R * Math.sin(th)), [qx, qy] = rot(q[0], q[1], ang), vis = 0.08 + 0.92 * smooth((Y + qy - SEA + 3) / 6);
      set(p, c, X + qx, Y + qy, k * 3 - 3, 0.6 * vis, 0.88 * vis, vis); return;
    }
    if (i < 370) { const u = line((i - 300) * N / 70); set(p, c, u, SEA + 0.9 * Math.sin(u * 0.12 - t * 1.4), 0, 0.12, 0.35, 0.9); return; }   // (the sea they leap from)
    const j = i - 370, k = j % 3, th = OFF[k] - W * t, age = (((-th) % TAU) + TAU) % TAU / TAU, [sA, fade] = loop(age);   // (a splash where each one goes back in)
    const e = sA * 0.32 * TAU / W, a = (R1[i] - 0.5) * 2.4, v0 = 7 + R2[i] * 7, EX = XC[k] + R, f2 = fade * (1 - sA * 0.6);
    set(p, c, EX + Math.sin(a) * v0 * e * 0.6, SEA + Math.max(0, Math.cos(a) * v0 * e - 4.9 * e * e), 0, 0.8 * f2, 0.95 * f2, f2); } },
  { name: 'whale', hold: 13, f(i, t, p, c) {   // a humpback swimming by, its tail beating slowly, blowing a spout now and then
    const s = shapes(), cu = -6 + 1.1 * t, cv = 40 + 1.5 * Math.sin(t * 0.5), pitch = 0.04 * Math.sin(t * 0.5);
    let x, y, r = 0.3, g = 0.52, b = 1;
    if (i < 234) { [x, y] = s.whale[i]; if (i < 130) { r = 0.62; g = 0.86; b = 1; } }
    else if (i < 276) { const q = s.fin[i - 234], [fx, fy] = rot(q[0], q[1], 0.12 * Math.sin(t * 1.1)); x = 24 + fx; y = -6 + fy; r = 0.55; g = 0.8; b = 1; }
    else if (i < 310) { [x, y] = s.grooves[i - 276]; r = 0.85; g = 0.95; b = 1; }
    else if (i < 360) { const j = i - 310, [sA, lit] = loop((t / 5.5 + 0.1) % 1), lift = smooth(sA / 0.35), fall = smooth((sA - 0.4) / 0.6), fan = (j / 49 - 0.5) * 0.9;   // (the blow: up in a V, then drifting down and out)
      const h = 18 * lift * (0.55 + 0.45 * R1[i]), fade = lit * (1 - 0.8 * fall); x = 30 + Math.sin(fan) * h * 0.7 + fall * 6; y = 17 + Math.cos(fan) * h - fall * 6; r = g = b = 0.95 * fade; }
    else { const u = line((i - 360) * N / 40); x = u - cu; y = -cv + 12 + 0.8 * Math.sin(u * 0.1 - t); r = 0.12; g = 0.35; b = 0.9; }
    if (i < 310) { const tl = clamp((-x - 12) / 34, 0, 1); y += Math.sin(t * TAU / 3.2 + x * 0.05) * 7 * tl * tl; }   // (the tail's slow up and down stroke, from the middle back)
    const [px, py] = i >= 360 ? [x, y] : rot(x, y, pitch); set(p, c, cu + px, cv + py, 0, r, g, b); } },
  { name: 'horse', hold: 13, f(i, t, p, c) {   // a Sumba horse at the gallop, mane and tail flying, the beach running by beneath
    const s = shapes(), W = 92, k = W / 400, cyc = t / 2, bob = 1.4 * Math.sin(cyc * TAU * 2), cu = -4, cv = 44 + bob, pitch = 0.03 * Math.sin(cyc * TAU);
    let x, y, z = 0, r = 1, g = 0.84, b = 0.56;
    if (i < 226) { [x, y] = s.horse[i]; }
    else if (i < 306) {   // four legs, thigh and cannon, in the gallop's order (hind left, hind right, fore left, fore right)
      const j = i - 226, L = j / 20 | 0, q = j % 20, fore = L >= 2, near = L % 2 === 0, ph = TAU * (cyc + [0, 0.12, 0.42, 0.54][L]);
      const hip = fore ? [270, 125] : [128, 122], up = 46, lo = 48, a1 = (fore ? 0.55 : 0.5) * Math.sin(ph), kn = Math.max(0, Math.sin(ph + (fore ? 1.2 : -0.6))), a2 = a1 + (fore ? -1.35 : 1.2) * kn * kn;   // (the knee folds on the swing forward: squared, so it eases in and out rather than snapping)
      const kx = hip[0] + Math.sin(a1) * up, ky = hip[1] + Math.cos(a1) * up, fx = kx + Math.sin(a2) * lo, fy = ky + Math.cos(a2) * lo;
      const f = (q >> 1) / 9, lower = f > 0.5, ax = lower ? kx : hip[0], ay = lower ? ky : hip[1], bx = lower ? fx : kx, by = lower ? fy : ky, ff = lower ? (f - 0.5) * 2 : f * 2;
      const ll = Math.hypot(bx - ax, by - ay) || 1, off = (q & 1 ? 1 : -1) * (lower ? 2.2 : 3.6) * (1 - 0.3 * ff);   // (two rows of lights: a leg with some thickness, thinner to the hoof)
      const cx = ax + (bx - ax) * ff + (by - ay) / ll * off, cy = ay + (by - ay) * ff - (bx - ax) / ll * off;
      x = (cx - 200) * k; y = (125 - cy) * k; z = near ? -2 : 2; const dim = near ? 1 : 0.62; r *= dim; g *= dim; b *= dim; }
    else if (i < 330) { const j = i - 306, f = j / 23, bx = 262 + 58 * f, by = 64 - 48 * f, fl = Math.sin(cyc * TAU * 2 - f * 3) * 4 * (0.4 + f);   // (the mane along the neck, streaming back)
      x = (bx - 200 - 10 - fl * 0.6) * k; y = (125 - by + 8 + fl) * k; r = 1; g = 0.66; b = 0.3; }
    else if (i < 360) { const j = i - 330, f = j / 29, sw = Math.sin(cyc * TAU - f * 2.4) * 10 * f;   // (the tail flying out behind)
      x = (96 - 200 - f * 70) * k; y = (125 - 108 - f * 26 + sw + f * f * 20) * k; r = 1; g = 0.66; b = 0.3; }
    else { const u = -75 + (i - 360) * 150 / 39, e = smooth((75 - Math.abs(u)) / 20) * (0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(u * 0.35 + t * 7), 3));   // (the beach running by beneath: the lights run, the drones stay)
      set(p, c, u, 44 - (222 - 125) * k, 0, 0.65 * e, 0.48 * e, 0.28 * e); return; }
    const [px, py] = rot(x, y, pitch); set(p, c, cu + px, cv + py, z, r, g, b); } },
  { name: 'eagle', hold: 13, f(i, t, p, c) {   // a sea eagle coming towards you, wings beating slowly, banking a little
    const s = shapes(), W = 100, k = W / 400, cu = 0, cv = 46, bank = 0.1 * Math.sin(t * 0.45), fl = Math.sin(t * TAU / 2.6);
    let x, y, r, g, b;
    if (i < 292) {   // the wings: up and down from the shoulder, the outer half bending a little behind at the wrist
      const j = i % 146, side = i < 146 ? -1 : 1, q = s.eWing[j], a1 = 0.3 * fl, a2 = 0.28 * Math.sin(t * TAU / 2.6 - 0.9), sh = 2.5, wr = 25;
      let wx = q[0] - sh, wy = q[1] - 4; if (wx > wr) { const [bx, by] = rot(wx - wr, wy, a2); wx = wr + bx; wy = by; }
      const [ax, ay] = rot(wx, wy, a1); x = side * (sh + ax); y = 4 + ay;
      const tip = q[0] > 36, lead = q[1] > 4 + (q[0] - 3) * 0.25 - 2.5; r = 0.95; g = 0.64; b = 0.36; if (lead) { r = 1; g = 0.86; b = 0.62; } if (tip) { r = 1; g = 0.78; b = 0.48; } }
    else if (i < 336) { [x, y] = s.eBody[i - 292]; r = g = 0.9; b = 1; }
    else if (i < 362) { [x, y] = s.eHead[i - 336]; r = g = b = 1; }
    else if (i < 396) { [x, y] = s.eTail[i - 362]; r = g = b = 1; }
    else { x = 0; y = 9.5 - (i - 396) * 0.6; r = 1; g = 0.8; b = 0.2; }   // (the hooked yellow beak)
    y -= fl * 1.2;   // (the body lifts a touch on each downstroke)
    const [px, py] = rot(x, y, bank); set(p, c, cu + px, cv + py, 0, r, g, b); } },
  { name: 'sumba', hold: 12, f(i, t, p, c) {   // SUMBA in warm light, a slow shimmer running through the letters
    const q = text()[i], sh = 0.5 + 0.5 * Math.sin(q[0] * 0.12 - t * 2.2), wv = Math.sin(q[0] * 0.05 + t * 0.9) * 1.2;
    set(p, c, q[0], 46 + q[1] + wv, 0, 1, 0.72 + 0.2 * sh, 0.38 + 0.4 * sh); } },
  { name: 'down', hold: 7, f(i, t, p, c) {   // back down to the sea as one line, the lights going out along it
    const u = line(i), k = 1 - smooth((t - 1 - (u + 75) / 150 * 3) / 1.5); set(p, c, u, 4 + 0.6 * Math.sin(u * 0.1 + t), 0, k, 0.85 * k, 0.65 * k); } },
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
  const bg = () => { work(5); if (!READY) setTimeout(bg, 40); }; setTimeout(bg, 0);
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
      if (T < 0) { x = line(d); y = 0.5; z = 0; r = 1; gg = 0.9; b = 0.8; }   // (waiting on the water, before they lift)
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
