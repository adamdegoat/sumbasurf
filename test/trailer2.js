// Landscape trailer, 30 Sep 2026 (his ask: every shot from your own eyes, smooth gradual turns, text selling
// multiplayer and leaderboards). The free surf takes, added to test/film.js's takes: friends are fed in as friend
// messages on a clock that only moves with the filmed frames (the game smooths friends on performance.now()), and
// their name tags are drawn over the picture like the game's.
//   const FM = await import('./test/film.js'); const T2 = await import('./test/trailer2.js'); await T2.prep(); T2.add(FM); await FM.run('fPad')
import * as THREE from 'three';
import { brain, carveBrain } from './sim2.js';
import { heightAt } from '../js/surf.js?v=234';
const G = () => window.__g;
const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
let VT = 0, vOn = false; performance.now = () => (vOn ? VT : realNow());
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const qYaw = (th) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2 - th);
const PEAK = { x: -161, z: -8.5 };
const F = {};   // friends: id -> { name, kind: 'pad'|'deck', x, z, th, v, lx, lz, yaw, board }
const MIR = { on: false, id: 'kai', name: 'Kai', delay: 0, dx: 0, buf: [] }; const MIRS = [];   // (MIRS: more of you, other names, other delays: a wave shared three ways)   // you, fed back in as a friend (delayed, shifted)
function clear() { const g = G(); for (const k of Object.keys(F)) delete F[k]; for (const id of [...g.peers.keys()]) g.freePeerGone(id); MIR.on = false; MIRS.length = 0; MIR.buf = []; }
function feed() {
  const g = G();
  for (const [id, f] of Object.entries(F)) {
    if (f.kind === 'deck') { g.freePeer(id, ['DECK', +f.lx.toFixed(2), 0, +f.lz.toFixed(2), +f.yaw.toFixed(3)], f.name, VT); continue; }
    const q = qYaw(f.th), y = heightAt(g.waves, f.x, f.z);
    g.freePeer(id, ['LIE', f.x, y, f.z, q.x, q.y, q.z, q.w, 5, f.v, 0, 0, 0, 0, 0, 0, 0, f.board || 'short', f.stance || 'regular', 0, f.v > 0.1 ? 1 : 0, 0, 0], f.name, VT);
  }
  if (MIR.on || MIRS.length) { const a = g.freeSnap(); if (a && a[0] !== 'DECK' && a[0] !== 'FOOT') for (const M of MIR.on ? [MIR, ...MIRS] : MIRS) { M.buf.push(a); const b = M.buf.length > M.delay ? M.buf.shift() : null;
    if (b) { const c = b.slice(); c[1] += M.dx; c[3] += M.dz || 0; if (c[21] !== undefined && c[19]) { c[21] += M.dx; c[22] += M.dz || 0; } c[17] = M.board || c[17]; c[18] = M.stance || c[18]; g.freePeer(M.id, c, M.name, VT); } } }
}
// one physics step (1/60 s) with the friends moved and fed
function step(input) {
  const g = G();
  for (const f of Object.values(F)) if (f.kind === 'pad' && f.v) { f.x += Math.cos(f.th) * f.v / 60; f.z += Math.sin(f.th) * f.v / 60; }
  if (input) input(); g.step(1 / 60, 1 / 60, false); VT += 1000 / 60; feed(); if (g.peers.size) g.peersTick(1 / 60);
}
// name tags (the game's .fsTag: a small dark pill, warm white condensed type), drawn over each friend's head
function tags(cx, cam, W, H) {
  const g = G(); cam.updateMatrixWorld();
  for (const P of g.peers.values()) { if (!P.S || !P.name || !P.os || !P.os.group.visible) continue; const d = cam.position.distanceTo(P.S.pos); if (d < 3) continue;
    const st = P.S.state, hy = st === 'DECK' ? 1.95 : st === 'RIDE' || st === 'POP' ? 2.3 : P.S.paddling ? 0.75 : 1.4, v = P.S.pos.clone().add(V(0, hy, 0)).project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, u = H / 390, fs = 12.5 * u, pad = 7 * u, txt = P.name + (d > 40 ? `  ${Math.round(d / 10) * 10} M` : '');
    cx.save(); cx.font = `700 ${fs}px "Barlow Condensed", sans-serif`; cx.letterSpacing = `${(0.6 * u).toFixed(1)}px`; const w = cx.measureText(txt).width + pad * 2, h = fs + 6 * u;
    cx.globalAlpha = d < 60 ? 1 : 0.8; cx.fillStyle = 'rgba(24,18,13,.45)'; cx.beginPath(); cx.roundRect(x - w / 2, y - h, w, h, h / 2); cx.fill();
    cx.fillStyle = '#fff3df'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 2 * u; cx.fillText(txt, x, y - h / 2 + u * 0.5); cx.restore(); }
}
export const CHAT = { name: '', text: '', a: 0, want: 0 };
function chat(cx, W, H) {
  CHAT.a += (CHAT.want - CHAT.a) * 0.12; if (CHAT.a < 0.02 || !CHAT.text) return; const u = H / 390, w = Math.min(300, 0.46 * (W / u)) * u, h = 28 * u, x = (W - w) / 2, y = H - Math.max(10, 10) * u - h;
  cx.save(); cx.globalAlpha = CHAT.a; cx.fillStyle = 'rgba(12,10,8,.42)'; cx.strokeStyle = 'rgba(246,236,220,.16)'; cx.lineWidth = u; cx.beginPath(); cx.roundRect(x, y, w, h, 14 * u); cx.fill(); cx.stroke();
  cx.strokeStyle = '#ffc978'; cx.lineWidth = 1.5 * u; const ix = x + 11 * u, iy = y + h / 2; cx.beginPath(); cx.roundRect(ix, iy - 5 * u, 13 * u, 9 * u, 2 * u); cx.moveTo(ix + 3 * u, iy + 4 * u); cx.lineTo(ix + 2 * u, iy + 7 * u); cx.lineTo(ix + 6 * u, iy + 4 * u); cx.stroke();
  cx.textBaseline = 'middle'; cx.font = `700 ${12 * u}px "Barlow", sans-serif`; cx.fillStyle = '#ffc978'; cx.fillText(CHAT.name, ix + 20 * u, iy + u * 0.5); const nw = cx.measureText(CHAT.name).width;
  cx.font = `500 ${12 * u}px "Barlow", sans-serif`; cx.fillStyle = 'rgba(255,243,223,.85)'; cx.fillText(CHAT.text, ix + 24 * u + nw, iy + u * 0.5); cx.restore();
}
const overlay = (cx, cam, W, H) => { tags(cx, cam, W, H); chat(cx, W, H); };
export async function prep() {
  const g = G(); vOn = true; VT = realNow(); g.paused = true;
  if (g.mode !== 'free') await g.freeStart(false);
  for (let i = 0; i < 20; i++) step();
  const fo = document.getElementById('freeOut'); if (g.strand && fo) { fo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); fo.click(); await new Promise((r) => setTimeout(r, 900)); }
  for (let i = 0; i < 10; i++) step();
  F.tmp = { name: 'x', kind: 'pad', x: -120, z: 40, th: 0, v: 0 }; for (let t = 0; t < 40 && ![...g.peers.values()].some((P) => P.os); t++) { step(); await new Promise((r) => setTimeout(r, 150)); }   // (friend models load the first time one appears)
  clear(); await document.fonts.load('700 30px "Barlow Condensed"');
  return { mode: g.mode, strand: !!g.strand, rider: g.rider && g.rider.state };
}
const gameFov = (asp) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50)) / Math.min(asp, 2)));
export function add(FM) {
  const T = FM.takes, W = 1920, H = 1080, fov = gameFov(W / H);
  const bot = { br: brain({}), cb: carveBrain({ hi: 0.72, lo: 0.22, gain: 2.2 }) };
  const botIn = () => { const g = G(), r = g.rider; if (!r) return; let o = bot.br(r); if (r.state === 'RIDE' && r.stateT > 1) { o = bot.cb(r); o.pump = r.v < r.wave.cond.speed * 0.85; } g.input.stick = null; g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; };
  let armK = 0;
  // 1: paddling out to the big waves with your friends beside you and just ahead (your arms, their name tags)
  T.fPad = { n: 420, init() { const g = G(); clear(); FM.OVER.fn = overlay; armK = 0; g.rider.reset(-118, 60, Math.atan2(PEAK.z - 60, PEAK.x + 118)); this.th = g.rider.th;
      const th = this.th, fx = Math.cos(th), fz = Math.sin(th), sx = -fz, sz = fx;
      const at = (a, s) => ({ x: -118 + fx * a + sx * s, z: 60 + fz * a + sz * s });
      F.mei = { name: 'Mei', kind: 'pad', ...at(5, -3.2), th, v: 1.75, board: 'short' }; F.arif = { name: 'Arif', kind: 'pad', ...at(8.5, 2.6), th: th + 0.03, v: 1.75, board: 'fish' };
      F.jess = { name: 'Jess', kind: 'pad', ...at(13, -0.8), th: th - 0.02, v: 1.72, board: 'long' }; for (let i = 0; i < 30; i++) step(this.inp.bind(this)); },
    inp() { const g = G(), r = g.rider; g.input.stick = null; g.input.test = Math.max(-1, Math.min(1, wrap(this.th - r.th) * 2)); g.input.paddleBtn = true; },
    frame() { step(this.inp.bind(this)); return { fov, body: 62 }; }, done() { FM.OVER.fn = null; const g = G(); g.input.test = null; g.input.paddleBtn = false; } };
  // 2: a party wave: you and Kai on the same big wave, Kai a little ahead down the line (your ride, a moment behind)
  T.fParty = { n: 900, init() { const g = G(); clear(); FM.OVER.fn = overlay; armK = 0; bot.br = brain({}); bot.cb = carveBrain({ hi: 0.72, lo: 0.22, gain: 2.2 });
      Object.assign(MIR, { on: true, id: 'kai', name: 'Kai', delay: 50, dx: 9, dz: 0, board: 'fish', stance: 'goofy', buf: [] });
      g.rider.reset(PEAK.x, PEAK.z, -Math.PI / 2);
      for (let i = 0; i < 60 * 150; i++) { step(botIn); const r = g.rider; if (r.state === 'LIE' && g.incoming().t < 3.4 && g.incoming().t > 0) break; if (r.state === 'WIPE' || r.state === 'OUT') r.reset(PEAK.x, PEAK.z, -Math.PI / 2); } },
    frame() { const g = G(), r = g.rider; step(botIn); armK += ((r.standing ? 1 : 0) - armK) * Math.min(1, 2 / 30); return { fov, body: fov + (62 - fov) * armK }; },
    done() { FM.OVER.fn = null; MIR.on = false; const g = G(); g.input.test = null; g.input.paddleBtn = false; } };
  // 0: sitting on your board in the lineup with your friends, all looking out to sea as a set comes in
  T.fSit = { n: 420, init() { const g = G(); clear(); FM.OVER.fn = overlay; CHAT.want = 0; CHAT.a = 0; const x0 = PEAK.x + 22, z0 = PEAK.z - 18; g.rider.reset(x0, z0, -Math.PI / 2);
      F.mei = { name: 'Mei', kind: 'pad', x: x0 + 4.5, z: z0 - 3.5, th: -Math.PI / 2 - 0.15, v: 0, board: 'alaia' }; F.arif = { name: 'Arif', kind: 'pad', x: x0 - 5.5, z: z0 - 5, th: -Math.PI / 2 + 0.1, v: 0, board: 'short' };
      F.jess = { name: 'Jess', kind: 'pad', x: x0 + 1.5, z: z0 - 11, th: -Math.PI / 2, v: 0, board: 'long' };
      for (let i = 0; i < 60 * 150; i++) { step(this.inp.bind(this)); const inc = g.incoming(); if (g.rider.stateT > 4 && inc.w && inc.t < 13) break; } },
    inp() { const g = G(), r = g.rider; g.input.stick = null; g.input.test = Math.max(-1, Math.min(1, wrap(-Math.PI / 2 - r.th) * 2)); g.input.paddleBtn = false; },
    frame() { const g = G(), r = g.rider; if (!this.off) this.off = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, [f.x - r.x, f.z - r.z]]));
      for (const [k, f] of Object.entries(F)) { const o = this.off[k]; if (o) { f.x = r.x + o[0]; f.z = r.z + o[1]; } }   // (the group rises and drifts together on the swell, as friends sitting side by side do)
      step(this.inp.bind(this)); return { fov, body: 62 }; }, done() { FM.OVER.fn = null; this.off = null; const g = G(); g.input.test = null; } };
  // 2b: a wave shared three ways: Kai (fish) a little ahead down the line, Mei (alaia) further along
  T.fParty3 = { n: 900, init() { const g = G(); clear(); FM.OVER.fn = overlay; CHAT.want = 0; CHAT.a = 0; armK = 0; bot.br = brain({}); bot.cb = carveBrain({ hi: 0.72, lo: 0.22, gain: 2.2 });
      Object.assign(MIR, { on: true, id: 'kai', name: 'Kai', delay: 45, dx: 9, dz: 0, board: 'fish', stance: 'goofy', buf: [] });
      MIRS.push({ id: 'mei', name: 'Mei', delay: 80, dx: 15, dz: 2.6, board: 'alaia', stance: 'regular', buf: [] });
      g.rider.reset(PEAK.x, PEAK.z, -Math.PI / 2);
      for (let i = 0; i < 60 * 150; i++) { step(botIn); const r = g.rider; if (r.state === 'LIE' && g.incoming().t < 3.4 && g.incoming().t > 0) break; if (r.state === 'WIPE' || r.state === 'OUT') r.reset(PEAK.x, PEAK.z, -Math.PI / 2); } },
    frame() { const g = G(), r = g.rider; step(botIn); armK += ((r.standing ? 1 : 0) - armK) * Math.min(1, 2 / 30); return { fov, body: fov + (62 - fov) * armK }; },
    done() { FM.OVER.fn = null; MIR.on = false; MIRS.length = 0; const g = G(); g.input.test = null; g.input.paddleBtn = false; } };
  // 3: on the boat, standing at the rail with Mei and Arif, Kai riding the wave toward you (a person's eyes on deck:
  // your own ride is filmed as Kai, the camera stands on the boat)
  T.fBoat = { n: 600, init() { const g = G(); clear(); FM.OVER.fn = overlay; bot.br = brain({}); bot.cb = carveBrain({ hi: 0.72, lo: 0.22, gain: 2.2 });
      F.mei = { name: 'Mei', kind: 'deck', lx: -2.2, lz: -3.6, yaw: -2.4 }; F.arif = { name: 'Arif', kind: 'deck', lx: 1.9, lz: -4.6, yaw: -2.2 };
      Object.assign(MIR, { on: true, id: 'kai', name: 'Kai', delay: 0, dx: 0, dz: 0, board: null, stance: null, buf: [] });
      g.rider.reset(PEAK.x, PEAK.z, -Math.PI / 2); this.l = null;
      for (let i = 0; i < 60 * 180; i++) { step(botIn); const r = g.rider; if (r.state === 'RIDE' && Math.hypot(r.x + 52, r.z - 92) < 78) break; if (r.state === 'WIPE' || r.state === 'OUT') r.reset(PEAK.x, PEAK.z, -Math.PI / 2); } },
    frame(i) { const g = G(); step(botIn); const bt = g.scene.children.find((o) => o.isGroup && o.userData.flag), P = g.peers.get('kai'), S = P && P.S;
      for (const f of [F.mei, F.arif]) if (S) { const p = bt.localToWorld(V(f.lx, 0, f.lz)); f.yaw = Math.atan2(S.pos.z - p.z, S.pos.x - p.x); }
      const k = Math.min(1, i / this.n), c = g.camera, eye = bt.localToWorld(V(0.2 - 0.4 * k, 1.05 + 1.62 + 0.012 * Math.sin(i / 60 * 1.7), -1.0 - 1.0 * k));   // (stood a step back from the rail, easing forward; a breath of sway)
      const look = S ? S.pos.clone().add(V(0, 0.6, 0)) : V(PEAK.x, 1, PEAK.z); if (!this.l) this.l = look.clone(); if (!(this.lockAt && i > this.lockAt)) this.l.lerp(look, 0.035 * (this.lockAt && i > this.lockAt - 60 ? Math.max(0, (this.lockAt - i) / 60) : 1));   // (eyes following the rider, slowly; lockAt: easing to a stop, then held)
      c.position.copy(eye); c.lookAt(this.l); c.updateMatrixWorld(); g.rig.visible = false; return { fov: 58, body: 0 }; },
    done() { FM.OVER.fn = null; MIR.on = false; const g = G(); g.rig.visible = true; g.input.test = null; g.input.paddleBtn = false; } };
}
export function stop() { vOn = false; }
export { F, MIR, MIRS };
