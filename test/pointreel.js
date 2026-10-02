// Party Point reel (2 Oct 2026, his ask: 25 s, the new free surf map, pro and smooth, from your own eyes). Vertical
// 1080x1920: each shot is a tall window onto the game's own landscape lens (film.js crop), filmed at 60 a second on
// a virtual clock (the game smooths friends on performance.now()) and blended to 30 with motion blur (tools/video/blend.py).
// Friends are you, replayed a moment behind and further down the line (as test/trailer2.js does for The Bay).
//   const FM = await import('./test/film.js'); const PR = await import('./test/pointreel.js'); FM.setup(1080, 1920); await PR.prep(); PR.add(FM); await FM.run('rHut')
import * as THREE from 'three';
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
let VT = 0, vOn = false; performance.now = () => (vOn ? VT : realNow());
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const LINEUP = { x: -231, z: -8.5 };
const HUTF = {};   // friends standing on the hut: id -> { name, dx, dz, yaw }
const MIRS = [];   // you, replayed as friends: { id, name, delay, dx, dz, board, stance, buf }
function clear() { const g = G(); for (const k of Object.keys(HUTF)) delete HUTF[k]; MIRS.length = 0; for (const id of [...g.peers.keys()]) g.freePeerGone(id); }
function feed() {
  const g = G(), s = g.strand;
  if (s && s.hut) for (const [id, f] of Object.entries(HUTF)) g.freePeer(id, ['HUT', s.x - s.lx + f.dx, s.y - 1.65, s.z - s.lz + f.dz, f.yaw], f.name, VT);
  if (MIRS.length) { const a = g.freeSnap(); if (a && a[0] !== 'HUT' && a[0] !== 'DECK' && a[0] !== 'FOOT') for (const M of MIRS) { M.buf.push(a); const b = M.buf.length > M.delay ? M.buf.shift() : null;
    if (b) { const c = b.slice(); c[1] += M.dx; c[3] += M.dz; if (c[19]) { c[21] += M.dx; c[22] += M.dz; } c[17] = M.board; c[18] = M.stance; c[23] = M.design || 0; g.freePeer(M.id, c, M.name, VT); } } }
}
function step(input) { const g = G(); if (input) input(); g.step(1 / 60, 1 / 60, false); VT += 1000 / 60; feed(); if (g.peers.size) g.peersTick(1 / 60); }
// ---- drawn over the picture: friends' name tags (the game's pill), the game's big banner, the photographer's postcard, titles
const U = (W) => W / 420;
function tags(cx, cam, W, H) {
  const g = G(), u = U(W); cam.updateMatrixWorld();
  for (const P of g.peers.values()) { if (!P.S || !P.name || !P.os || !P.os.group.visible) continue; const d = cam.position.distanceTo(P.S.pos); if (d < 2.5) continue;
    const st = P.S.state, hy = st === 'DECK' ? 1.95 : st === 'RIDE' || st === 'POP' ? 2.3 : P.S.paddling ? 0.75 : 1.4, v = P.S.pos.clone().add(V(0, hy, 0)).project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, fs = 12.5 * u, pad = 7 * u, txt = P.name;
    cx.save(); cx.font = `700 ${fs}px "Barlow Condensed", sans-serif`; const w = cx.measureText(txt).width + pad * 2, h = fs + 6 * u;
    cx.fillStyle = 'rgba(24,18,13,.45)'; cx.beginPath(); cx.roundRect(x - w / 2, y - h, w, h, h / 2); cx.fill();
    cx.fillStyle = '#fff3df'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, x, y - h / 2 + u * 0.5); cx.restore(); }
}
const BAN = { big: '', small: '', t: -1, dur: 3.6 };   // (the game's #pwBan: dark box, big white words, amber line, a bounce in)
export function banner(big, small) { Object.assign(BAN, { big, small, t: 0 }); }
function drawBanner(cx, W, H, dt) {
  if (BAN.t < 0) return; BAN.t += dt; const k = BAN.t / BAN.dur; if (k >= 1) { BAN.t = -1; return; }
  const sc = k < 0.12 ? 0.55 + (1.12 - 0.55) * (k / 0.12) : k < 0.2 ? 1.12 - 0.16 * ((k - 0.12) / 0.08) : k < 0.28 ? 0.96 + 0.06 * ((k - 0.2) / 0.08) : 1;
  const al = k < 0.12 ? k / 0.12 : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1, u = U(W);
  cx.save(); cx.globalAlpha = al; cx.translate(W / 2, H * 0.2); cx.scale(sc, sc); cx.font = `900 ${34 * u}px "Barlow Condensed", sans-serif`; const bw = cx.measureText(BAN.big).width;
  cx.font = `800 ${11 * u}px "Barlow Condensed", sans-serif`; const sw = cx.measureText(BAN.small).width; const w = Math.max(bw, sw) + 40 * u, h = 64 * u;
  cx.fillStyle = 'rgba(12,16,20,.78)'; cx.strokeStyle = 'rgba(255,201,120,.45)'; cx.lineWidth = u; cx.beginPath(); cx.roundRect(-w / 2, -h / 2, w, h, 14 * u); cx.fill(); cx.stroke();
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#fff'; cx.font = `900 ${34 * u}px "Barlow Condensed", sans-serif`; cx.fillText(BAN.big, 0, -8 * u);
  cx.fillStyle = '#ffd34d'; cx.font = `800 ${11 * u}px "Barlow Condensed", sans-serif`; cx.fillText(BAN.small, 0, 19 * u); cx.restore();
}
const PC = { img: null, t: -1 };   // the photographer's postcard, popping up after the barrel
function drawPostcard(cx, W, H, dt) {
  if (PC.t < 0 || !PC.img) return; PC.t += dt; const k = PC.t; const u = U(W); const pw = W * 0.82, ph = pw * 9 / 16, m = 7 * u, cap = 26 * u;
  const e = Math.min(1, k / 0.35), sc = 0.7 + 0.3 * (1 - Math.pow(1 - e, 3)), al = Math.min(1, k / 0.2);
  cx.save(); cx.globalAlpha = al; cx.translate(W / 2, H * 0.62); cx.rotate(-0.05); cx.scale(sc, sc);
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(-pw / 2 - m + 8 * u, -ph / 2 - m + 10 * u, pw + 2 * m, ph + 2 * m + cap);
  cx.fillStyle = '#fbf6ec'; cx.fillRect(-pw / 2 - m, -ph / 2 - m, pw + 2 * m, ph + 2 * m + cap); cx.drawImage(PC.img, -pw / 2, -ph / 2, pw, ph);
  cx.fillStyle = '#1d2a33'; cx.font = `800 ${13 * u}px "Barlow Condensed", sans-serif`; cx.textBaseline = 'middle'; cx.fillText('PARTY POINT', -pw / 2, ph / 2 + cap / 2 + 2 * u);
  cx.textAlign = 'right'; cx.font = `700 ${10 * u}px "Barlow Condensed", sans-serif`; cx.fillText('You  ·  Kai  ·  Belle', pw / 2, ph / 2 + cap / 2 + 2 * u); cx.restore();
}
const TT = { lines: null, t: -1, out: 99 };   // a title: big condensed words low on the frame, sliding up
export function title(lines, out = 99) { Object.assign(TT, { lines, t: 0, out }); }
function drawTitle(cx, W, H, dt) {
  if (TT.t < 0 || !TT.lines) return; TT.t += dt; const u = U(W), e = Math.min(1, TT.t / 0.35), ease = 1 - Math.pow(1 - e, 3), al = TT.t > TT.out ? Math.max(0, 1 - (TT.t - TT.out) / 0.25) : e;
  cx.save(); cx.globalAlpha = al; let y = H * 0.72 + (1 - ease) * 40 * u, first = true;
  for (const [txt, size, col] of TT.lines) { if (!first) y += size * u * 0.92; first = false; cx.font = `900 ${size * u}px "Barlow Condensed", sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    cx.lineWidth = size * u * 0.12; cx.strokeStyle = 'rgba(10,14,18,.55)'; cx.lineJoin = 'round'; cx.strokeText(txt, W / 2, y); cx.fillStyle = col || '#fff'; cx.fillText(txt, W / 2, y); y += size * u * 0.12; }
  cx.restore();
}
const overlay = (cx, cam, W, H) => { tags(cx, cam, W, H); drawBanner(cx, W, H, 1 / 60); drawPostcard(cx, W, H, 1 / 60); drawTitle(cx, W, H, 1 / 60); };
export async function prep() {
  const g = G(); vOn = true; VT = realNow(); g.paused = true;
  if (g.mode !== 'free') await g.freeStart(false, 'point');
  for (let i = 0; i < 20; i++) step();
  if (!g.strand) g.hut();
  HUTF.tmp = { name: 'x', dx: 2, dz: 0, yaw: 0 }; for (let t = 0; t < 40 && ![...g.peers.values()].some((P) => P.os); t++) { step(); await new Promise((r) => setTimeout(r, 150)); }   // (friend models load the first time one appears)
  clear(); await document.fonts.load('900 30px "Barlow Condensed"'); await document.fonts.load('700 30px "Barlow Condensed"');
  return { mode: g.mode, hut: !!(g.strand && g.strand.hut) };
}
const gameFov = (asp) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50)) / Math.min(asp, 2)));
export function add(FM) {
  const T = FM.takes, fov = gameFov(2.16);
  const bot = { br: brain({}), cb: carveBrain({ hi: 0.74, lo: 0.2, gain: 2.0 }) };
  let armK = 0, sm = null;
  // the rider's hands, a pro's line: draw the bottom turn, the barrel in The Bowl, then snaps off the top all the way down
  // the wall (drive up the face, whip it round at the lip, back down, again). plan(r) picks 'carve' | 'barrel' | 'snap'
  const hands = (plan, cbo) => { const cb = carveBrain(cbo || { hi: 0.8, lo: 0.16, gain: 3.4 }); let br = brain({}), sm = null;
    return () => { const g = G(), r = g.rider; if (!r) return; let o = br(r), stick = null;
      if (r.state === 'RIDE' && r.wave && r.stateT > 1) {
        const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh, P = plan(r), c = w.cond.speed;
        if (P === 'barrel') { const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, c / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
          const stall = !(r.spitOut > 0) && (r.inBarrel ? sH > -0.35 : sH > -0.2), st = Math.max(-1, Math.min(1, wrap(a0 - r.th) * 3)); o = { steer: stall ? null : st, pump: !stall && sH < -1.2 }; if (stall) stick = { x: st, y: 1 }; }
        else if (P === 'snap') { const sl = w.prof.slice(r.s), hT = r.y / Math.max(sl.top, 0.3), relVz = r.vz - c;
          const aim = (vz) => wrap(Math.asin(Math.max(-0.95, Math.min(0.97, vz / Math.max(r.v, 0.5)))) - r.th);
          if (!r._ph) r._ph = 'up'; if (r._ph === 'up' && hT > (cbo && cbo.top || 0.74)) r._ph = 'snap'; else if (r._ph === 'snap' && relVz > 1.2) r._ph = 'down'; else if (r._ph === 'down' && hT < 0.22) r._ph = 'up';
          const d = r._ph === 'up' ? aim(c - 0.8 * c) : aim(c + 0.7 * c); o = { steer: r._ph === 'snap' ? Math.sign(d) : Math.max(-1, Math.min(1, d * 3)), pump: r._ph !== 'snap' && r.v < c * 0.95 }; }
        else { o = cb(r); o.pump = r.v < c * 0.85; } }
      const want = stick ? stick.x : o.steer == null ? 0 : o.steer; sm = sm == null ? want : sm + (want - sm) * 0.35;   // (eased a little: a person's hands, not a twitch)
      g.input.stick = stick ? { x: sm, y: stick.y } : null; g.input.test = stick ? null : sm; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }; };
  const proPlan = (r) => r.stateT < 2.4 ? 'carve' : r.stateT < 7.2 ? 'barrel' : r.stateT < 11 ? 'carve' : 'snap';   // (tested 4/4 full rides, ~5 s of barrel, 60+ turns; snapping straight out of the tube threw it over the falls 2/3)
  const PRO = { hi: 0.86, lo: 0.14, gain: 3.6, top: 0.66 };
  // a friend's ride: a whole wave of their own, surfed with their own plan, kept as the messages a friend would send
  // (where they are on the wave, measured from its peel and crest, so it can be put on yours)
  function record(plan, cbo) {
    const g = G(), inp = hands(plan, cbo), out = []; g.rider.reset(LINEUP.x, LINEUP.z, -Math.PI / 2);
    for (let i = 0; i < 60 * 200; i++) { step(inp); const r = g.rider; if (r.state === 'WIPE' || r.state === 'OUT') { if (out.length > 60 * 12) break; out.length = 0; r.reset(LINEUP.x, LINEUP.z, -Math.PI / 2); continue; }
      if (r.standing && r.wave) { const a = g.freeSnap(); if (a && (a[0] === 'RIDE' || a[0] === 'POP')) out.push([r.stateT, a]); } }
    return out;
  }
  // 1: on the lookout hut, friends at the rail, eyes turning slowly from the lineup down the whole wave
  T.rHut = { n: 300, init() { const g = G(); clear(); FM.OVER.fn = overlay; if (!(g.strand && g.strand.hut)) g.hut(); const s = g.strand; s.lx = 1.9; s.lz = 0.6; s.pitch = -0.26;
      // (wait for a wave just starting to peel off the lineup: the eyes follow it down the line)
      for (let i = 0; i < 60 * 60; i++) { step(); const w = g.waves.find((v) => v.sid && v.x0 !== undefined && v.peelX - v.x0 > 2 && v.peelX - v.x0 < 12); if (w) { this.w = w; break; } }
      this.yaw = null; title([['NEW FREE SURF BEACH', 22, '#ffd34d'], ['PARTY POINT', 58]]); },
    frame(i) { const g = G(), s = g.strand, w = this.w; s.mx = s.mz = 0;
      const want = w ? Math.atan2(w.zW + 6 - s.z, w.peelX + 12 - s.x) : -0.4; this.yaw = this.yaw == null ? want : this.yaw + wrap(want - this.yaw) * 0.04;
      s.yaw = this.yaw; s.pitch = -0.26 + 0.04 * Math.min(1, i / this.n); step(); return { fov, body: 0, crop: 0.5 }; },
    done() { TT.t = -1; } };
  // 2: the cliff jump, off the deck and down into the water
  T.rJump = { n: 130, init() { const g = G(); FM.OVER.fn = overlay; if (!(g.strand && g.strand.hut)) g.hut(); const s = g.strand; s.lx = 2.0; s.lz = 0; s.yaw = 0.05; s.pitch = -0.25; for (let i = 0; i < 6; i++) step(); g.hutJump(); },
    frame() { step(); return { fov, body: 0, crop: 0.5 }; }, done() { clear(); } };
  // 3: the party wave: you, Kai and Belle on the same wave, each on their own line (their own whole rides, recorded first,
  // put on your wave ahead of you down the line), the barrel at The Bowl, the postcard, snaps down the wall
  T.rRide = { n: 1500, init() { const g = G(); clear(); FM.OVER.fn = overlay; armK = 0; PC.t = -1; BAN.t = -1; this.ban = false; this.snap = false; this.pcDone = false; this.lk = 0; this.dir = null;
      if (g.strand && g.strand.hut) { g.hutJump(); for (let i = 0; i < 140 && g.strand; i++) step(); }
      this.fr = [{ id: 'kai', name: 'Kai', dx: 9, lead: 0.8, board: 'fish', stance: 'goofy', design: 1, rec: record((r) => 'snap', { hi: 0.8, lo: 0.16, gain: 3.4, top: 0.7 }) },
                 { id: 'belle', name: 'Belle', dx: 17, lead: 1.6, board: 'short', stance: 'regular', design: 2, rec: record((r) => 'carve', { hi: 0.86, lo: 0.12, gain: 3.8 }) }];
      this.inp = hands(proPlan, PRO); g.rider.reset(LINEUP.x, LINEUP.z, -Math.PI / 2);
      for (let i = 0; i < 60 * 150; i++) { step(this.inp); const rr = g.rider; if (rr.state === 'LIE' && g.incoming().t < 3.2 && g.incoming().t > 0) break; if (rr.state === 'WIPE' || rr.state === 'OUT') rr.reset(LINEUP.x, LINEUP.z, -Math.PI / 2); } },
    feedFriends() { const g = G(), r = g.rider, w = r && r.wave; if (!w || !r.standing) return;
      for (const f of this.fr) { const R = f.rec; if (!R.length) continue; const t = r.stateT + f.lead; let k = f.k || 0; while (k < R.length - 1 && R[k + 1][0] <= t) k++; f.k = k; if (t > R[R.length - 1][0]) continue;
        const c = R[k][1].slice(); c[19] = w.sid; c[21] = R[k][1][21] + f.dx; c[22] = R[k][1][22]; c[1] = w.peelX + c[21]; c[3] = w.zW + c[22]; c[17] = f.board; c[18] = f.stance; c[23] = f.design; g.freePeer(f.id, c, f.name, VT); } },
    frame() { const g = G(), r = g.rider; step(this.inp); this.feedFriends(); armK += ((r.standing ? 1 : 0) - armK) * Math.min(1, 2 / 60);
      if (!this.ban && r.standing && r.stateT > 1.6 && [...g.peers.values()].filter((P) => P.S && P.S.state === 'RIDE').length >= 2) { this.ban = true; banner('PARTY WAVE x3', '+30% on this ride'); }
      if (!this.snap && r.inBarrel && (r.ride.tubeT || 0) > 1.0) { this.snap = true; g.snapTest(); }
      if (this.snap && !this.pcDone && PC.t < 0 && !r.inBarrel && g.photoCanvas()) { PC.img = g.photoCanvas(); PC.t = 0; this.pcDone = true; }
      if (PC.t > 2.4) PC.t = -1;
      // (a pro POV: a wider lens than the game's own; inside the barrel the eyes turn down the line to the way out, eased in and out)
      const c = g.camera, want = r.inBarrel ? 1 : 0; this.lk += (want - this.lk) * 0.04;
      if (this.lk > 0.01 && r.wave) { const Lh = r.wave.lipAt(r.s + 16), d = V(Lh[0] - c.position.x, 0, Lh[2] + 3 - c.position.z);
        if (Number.isFinite(d.x + d.z) && d.lengthSq() > 0.04) { d.normalize(); this.dir = this.dir ? this.dir.lerp(d, 0.05).normalize() : d; }
        if (this.dir) { const q0 = c.quaternion.clone(), tg = c.position.clone().addScaledVector(this.dir, 10); tg.y = c.position.y - 1.4; c.lookAt(tg); c.quaternion.copy(q0.slerp(c.quaternion.clone(), this.lk)); c.updateMatrixWorld(); } }
      const F2 = 78; return { fov: F2, body: F2 + (86 - F2) * armK }; },
    done() { FM.OVER.fn = null; const g = G(); g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; } };
  // 4: the end: up and away over the bay, the long wave peeling below, the name
  T.rEnd = { n: 330, init() { const g = G(); clear(); FM.OVER.fn = overlay; PC.t = -1; BAN.t = -1; title([['PARTY POINT', 62], ['FREE ON WAVEDASH', 22, '#ffd34d']]); this.p0 = V(-150, 8, 40); this.p1 = V(-210, 70, -70); },
    frame(i) { const g = G(), k = i / this.n, e = 1 - Math.pow(1 - k, 2); step(); const c = g.camera; c.position.lerpVectors(this.p0, this.p1, e); c.lookAt(V(-40 + 30 * e, 0, 170)); c.updateMatrixWorld(); g.rig.visible = false; return { fov: 55, body: 0 }; },
    done() { FM.OVER.fn = null; TT.t = -1; G().rig.visible = true; } };
}
export function stop() { vOn = false; }
