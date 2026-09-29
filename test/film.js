// Filming the trailer: drives the game frame by frame (paused, fixed steps, so it's perfectly smooth), frames each
// shot with its own camera at 1080x1920 (vertical, for phones), and posts every frame to the local receiver
// (scratchpad trailer/recv.py on :8799). Each take is resumable across calls (the browser tool gives ~40 s a call).
//   const f = await import('./test/film.js'); f.setup(); await f.run('ride')  (repeat until it says done)
import * as THREE from 'three';
import { brain, carveBrain } from './sim2.js';
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const G = () => window.__g;
const NATIVE_RANDOM = window.__nativeRandom || (window.__nativeRandom = Math.random);   // (the browser's own, kept the first time this loads: a take seeds Math.random and must hand the real one back)
let W = 1080, H = 1920; const FPS = 30;
const NOHINT = { on: false }; export const setHints = (on) => { NOHINT.on = !on; };   // (a trailer can leave the warning line out)
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
let saved = null;
export function setup(w = 1080, h = 1920) {
  const g = G(), r = g.renderer; g.paused = true; W = w; H = h; cv.width = W; cv.height = H;
  if (!saved) saved = { pr: r.getPixelRatio() };
  r.setPixelRatio(1); r.setSize(W, H, false);
  document.getElementById('hint') && (document.getElementById('hint').style.visibility = 'hidden');
}
export function teardown() { const g = G(), r = g.renderer; r.setPixelRatio(saved ? saved.pr : devicePixelRatio); r.setSize(innerWidth, innerHeight, false); g.paused = false; saved = null; }
// draw the world through the camera (and your own arms and board through their own lens, like the game does)
function draw(fov, body, crop, chase) {
  const g = G(), r = g.renderer, c = g.camera, a = g.armCam;
  if (chase) {   // (from outside: the surfer drawn whole on the main camera, legs and all, no first-person cut)
    if (r.domElement.width !== W || r.domElement.height !== H) { r.setPixelRatio(1); r.setSize(W, H, false); }
    c.aspect = W / H; c.fov = fov; c.updateProjectionMatrix(); c.updateMatrixWorld(); c.layers.enable(1); const hl = g.HIDELEGS.value, wy = g.WATERY.value, ac = g.ARMCUT.value, cut = g.CUT.value;
    g.HIDELEGS.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.CUT.value = 0;
    let head = null; const hair = []; g.surfer.traverse((o) => { if (o.isBone && o.name === 'head') head = o; if (o.isMesh && o.material.name === 'hair') { hair.push(o); o.visible = true; } }); const hs = head && head.scale.x; if (head) { head.scale.setScalar(1); head.updateMatrixWorld(true); }   // (your own head, shrunk away for first person, back on)
    const mir = g.mirror; if (mir) g.flipProj(c); r.render(g.scene, c); if (mir) g.flipProj(c);
    if (head) { head.scale.setScalar(hs); head.updateMatrixWorld(true); } for (const o of hair) o.visible = false;
    g.HIDELEGS.value = hl; g.WATERY.value = wy; g.ARMCUT.value = ac; g.CUT.value = cut; c.layers.disable(1);
    if (Array.isArray(chase)) { c.position.copy(chase[0]); c.quaternion.copy(chase[1]); c.updateMatrixWorld(); }
    cx.drawImage(r.domElement, 0, 0, W, H); return; }
  if (r.domElement.width !== W || r.domElement.height !== H) { r.setPixelRatio(1); r.setSize(W, H, false); }   // (the page may have resized it under us)
  // crop: a vertical slice of the game's own landscape view (a phone on its side, 2.16:1), the slice centred at crop
  // (0..1 across it). The camera and its lens are exactly the game's; only the window onto them is tall
  if (crop !== undefined) { const fw = H * 2.16, x0 = Math.max(0, Math.min(fw - W, crop * fw - W / 2)); c.aspect = fw / H; c.fov = fov; c.setViewOffset(fw, H, x0, 0, W, H); c.updateProjectionMatrix();
    if (body) { a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = fw / H; a.fov = body; a.setViewOffset(fw, H, x0, 0, W, H); a.updateProjectionMatrix(); } }
  else { c.aspect = W / H; c.fov = fov; c.updateProjectionMatrix(); if (body) { a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = W / H; a.fov = typeof body === 'number' ? body : fov; a.updateProjectionMatrix(); } }
  c.updateMatrixWorld();
  const mir = g.mirror; if (mir) { g.flipProj(c); if (body) g.flipProj(a); }   // (a right-hand spot: the picture flipped, as the game draws it)
  r.autoClear = false; r.clear(); r.render(g.scene, c);
  if (body) { r.clearDepth(); r.render(g.scene, a); }
  r.autoClear = true;
  if (mir) { g.flipProj(c); if (body) g.flipProj(a); }
  if (crop !== undefined) { c.clearViewOffset(); a.clearViewOffset(); }
  cx.drawImage(r.domElement, 0, 0, W, H);   // (copied in the same task, before the browser clears the drawing buffer)
  if (CALL.text && CALL.a > 0.01) {   // the game's own callout (#tube in index.html: 22% down, bold condensed, wide letter spacing)
    const fs = Math.round(H * 0.056); cx.save(); cx.globalAlpha = CALL.a; cx.font = `700 ${fs}px "Barlow Condensed", "Helvetica Neue", sans-serif`; cx.letterSpacing = `${(fs * 0.3).toFixed(1)}px`;
    const fit = Math.min(1, W * 0.9 / cx.measureText(CALL.text).width); if (fit < 1) { cx.font = `700 ${Math.round(fs * fit)}px "Barlow Condensed", "Helvetica Neue", sans-serif`; cx.letterSpacing = `${(fs * fit * 0.3).toFixed(1)}px`; }   // (a long pair like BOTTOM TURN + SNAP shrinks to fit)
    cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = fs * 0.25; cx.fillStyle = CALL.warn ? '#ff8e6e' : '#f4efe6'; cx.fillText(CALL.text, W / 2 + fs * 0.15, H * 0.22 + fs * 0.5); cx.restore(); }
  { const br = G().rider;   // the game's balance bar under the hang clock (#tube .cbal): the dot the way the board tips
    if (CALL.a > 0.01 && br && br.state === 'RIDE' && (br.nose || 0) >= 0.74 && br.hangT > 0 && !(CALL.tubeT > 0)) {
      const u = H / 390, bw = 132 * u, bh = 8 * u, cxm = W / 2, cy = H * 0.22 + Math.round(H * 0.056) * 1.25 + 9 * u, k = Math.max(-1, Math.min(1, (br.wob || 0) / 0.3)) * (G().mirror ? -1 : 1);
      cx.save(); cx.fillStyle = 'rgba(21,17,12,.62)'; cx.strokeStyle = 'rgba(246,236,220,.55)'; cx.lineWidth = 1.5 * u; cx.beginPath(); cx.roundRect(cxm - bw / 2, cy, bw, bh, bh / 2); cx.fill(); cx.stroke();
      cx.fillStyle = 'rgba(246,236,220,.7)'; cx.fillRect(cxm - u, cy - 3 * u, 2 * u, 14 * u);
      cx.beginPath(); cx.arc(cxm + k * 60 * u, cy + bh / 2, 7 * u, 0, Math.PI * 2); cx.fillStyle = Math.abs(k) > 0.55 ? '#ff8e6e' : '#f6ecdc'; cx.fill(); cx.lineWidth = 2 * u; cx.strokeStyle = '#15110c'; cx.stroke(); cx.restore(); } }
  const hr = G().rider, ht = !body || !hr || hr.state !== 'RIDE' ? '' : (hr.pearlK || 0) > 0.25 ? (hr.noseHard ? 'Turning too hard on the nose: ease off, walk back' : 'Nose digging in: walk back') : (hr.shoulderK || 0) > 0.4 ? 'Out on the shoulder: walk back, STALL to the curl' : '';
  if (ht && !NOHINT.on) {   // the game's nose-ride warning line (#hint in index.html: top centre, white, semibold), on your view only
    const fs = Math.round(H * 0.036); cx.save(); cx.font = `600 ${fs}px "Barlow", "Helvetica Neue", sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'top';
    cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = fs * 0.3; cx.fillStyle = '#fff'; cx.fillText(ht, W / 2, H * 0.035); cx.restore(); }
}
// frames are encoded on the spot and sent in batches (one request per dozen frames: a hidden tab throttles every
// awaited callback to about one a second, which made one-request-per-frame crawl)
let batch = [], batchShot = null;
async function flush() { if (!batch.length) return; const b = batch; batch = []; await fetch(`http://127.0.0.1:8799/b?shot=${batchShot}`, { method: 'POST', body: JSON.stringify(b) }); }
async function grab(shot, i) {
  if (batchShot !== shot) { await flush(); batchShot = shot; }
  batch.push([i, cv.toDataURL('image/jpeg', 0.92)]); if (batch.length >= 12) await flush();
}
// the callout state, driven like the game's (BARREL held 0.4 s after the tube, else the move just landed; fades .25 s)
const CALL = { text: '', a: 0, tubeT: 0, last: '' };
function callout(r, dt) {
  CALL.tubeT = r.inBarrel ? 0.4 : Math.max(0, CALL.tubeT - dt);
  const hang = r.state === 'RIDE' && (r.nose || 0) >= 0.74 && r.hangT > 0 ? `${r.hang10T > 0 ? 'HANG TEN' : 'HANG FIVE'} ${(r.hang10T > 0 ? r.hang10T : r.hangT).toFixed(1)}s` : '';   // (the game's live hang clock)
  CALL.warn = !!hang && ((r.pearlK || 0) > 0.25 || (r.wobK || 0) > 0.55);
  const t = r.state !== 'RIDE' ? '' : CALL.tubeT > 0 ? ((r.ride.grabT || 0) > 0.3 ? 'GRAB RAIL  BARREL' : 'BARREL') : hang || (r.trick && !r.trick.name.endsWith('TURN') ? r.trick.name + (r.trick.name.startsWith('HANG') && r.ride.moves.length ? `  +${r.ride.moves[r.ride.moves.length - 1].pts.toFixed(1)}` : '') : '');
  if (t) CALL.text = t; CALL.a += ((t ? 1 : 0) - CALL.a) * Math.min(1, dt / 0.12);
}
const seeded = (seed) => { let st = seed >>> 0; return () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---- the takes. Each: init() once, then frame(i) -> { fov, body } after moving the world on one frame; n frames
const T = {};
// the opener: floating deep in a barrel on the menu's wave, drifting toward the light at the end
T.open = { n: 150, init() { const g = G(); document.getElementById('start').style.display = 'none'; g.step(1, 1 / 30, false); },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const c = g.camera; const k = i / 150; c.rotateY(-0.42 + 0.06 * k); c.rotateX(0.1); c.translateZ(-0.8 * k); return { fov: 84 - 6 * k }; } };
// your ride: paddle in, the drop, set up in the pocket, pull in and ride the barrel out (Tanjung Uma); and the giant
function rideTake(mode, seed, n, boardT = 'short', line = false) {
  let br, rnd0; const rs = { w: 0, pan: 0.5, dir: null, k: 0 };
  return { n, init() { const g = G(); rnd0 = Math.random; Math.random = seeded(seed); g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing', 'riding');
      g.useBoard(boardT); g.spawnRider(); br = brain({}); const r = g.rider;   // (wait in the lineup until the wave is 3 s away)
      for (let i = 0; i < 60 * 90; i++) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false); if (r.state === 'LIE' && g.incoming().t < 3.2) break; } },
    frame() { const g = G(), r = g.rider;
      for (let k = 0; k < 2; k++) {
        if (r.state === 'RIDE' && r.stateT > 1.2) {   // on the wave: the barrel line (stall until covered, then hold the pocket)
          const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh, err = yH - 0.35 + (r.stalling ? 0.12 : 0);
          const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn), steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
          const stall = !r.inBarrel && sH > -0.2 && r.stateT < 9; g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
        } else { g.input.stick = null; const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
        g.step(1 / 60, 1 / 60, false);
      }
      // the GoPro framing for a tall screen: once you're up, the camera turns from the game's view (toward the beach)
      // to look down the line: the wall on your left, the lip curling over, the way out ahead
      const c = g.camera, lip = new THREE.Vector3(); if (r.wave && r.state === 'RIDE') { const L = r.wave.lipAt(r.s + 2); lip.set(L[0], L[1] * (r.wave.fade || 1), L[2]); c.updateMatrixWorld();
      const sp = lip.clone().project(c); const fx = 0.5 + sp.x * 0.5 * (1 / 2.16) * 2.16; rs.pan += (Math.max(0.33, Math.min(0.67, 0.5 + (fx - 0.5) * 0.55)) - rs.pan) * 0.05; } else rs.pan += (0.5 - rs.pan) * 0.05;
      if (line) {   // (the reel's POV: once you're up, eyes down the line where you're going, the wall and the lip beside you)
        const up = r.state === 'RIDE' && r.standing; rs.k += ((up ? 1 : 0) - rs.k) * 0.06;
        if (rs.k > 0.01 && r.wave) { const Lh = r.wave.lipAt(r.s + 14), d = new THREE.Vector3(Lh[0] - c.position.x, 0, Lh[2] + 3 - c.position.z); if (d.lengthSq() > 0.04) { d.normalize(); rs.dir = rs.dir ? rs.dir.lerp(d, 0.07).normalize() : d; }   // (at the wave 14 m ahead: the way out of the tube)
          if (rs.dir) { const q0 = c.quaternion.clone(), tg = c.position.clone().addScaledVector(rs.dir, 10); tg.y = c.position.y - 1.9; c.lookAt(tg); c.quaternion.copy(q0.slerp(c.quaternion.clone(), rs.k)); c.updateMatrixWorld(); } }
        return { fov: 74, body: 62, crop: 0.5 }; }
      return { fov: 70, body: 62, crop: rs.pan }; },   // (the game's own camera, untouched)
    done() { const g = G(); if (boardT !== 'short') g.useBoard('short'); Math.random = typeof rnd0 === 'function' ? rnd0 : NATIVE_RANDOM; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; } };
}
T.ride = rideTake('medium', 3, 600);
// the reel: the other breaks, each in the game's own first-person view
T.rHard = rideTake('hard', 11, 300, 'short', true); T.rHiu = rideTake('hiu', 5, 250, 'short', true); T.rKanan = rideTake('kanan', 8, 360, 'short', true); T.rEasy = rideTake('easy', 4, 380, 'fish', true);
T.rUma = rideTake('medium', 3, 480, 'short', true); T.rGiant = rideTake('extreme', 7, 330, 'gun', true);
T.rHard.keep = [[120, 300]]; T.rHiu.keep = [[125, 250]]; T.rKanan.keep = [[150, 360]]; T.rEasy.keep = [[170, 380]]; T.rUma.keep = [[100, 480]]; T.rGiant.keep = [[100, 330]];
T.giant = rideTake('extreme', 7, 300, 'gun'); T.giant.keep = [[110, 300]];
// the landscape trailer: a pro in the game's own first-person view (your arms and board, the game's lens), paddling
// in and riding like a pro: 'carve' (snaps off the top), 'cut' (cutbacks), 'barrel' (sets up and pulls in), 'air'
const LOG = {}; window.__filmLog = LOG; const CH = {};
export function addPro(name, mode, seed, n, boardT, plan, cbo, keep, cam) { T[name] = proTake(name, mode, seed, n, boardT, plan, cbo, cam); if (keep) T[name].keep = keep; return name; }
function proTake(name, mode, seed, n, boardT, plan, cbo, cam) {
  let br, cb, rnd0, armK = 0, cut = 0, lastCut = -9, i0 = 0; const LN = { k: 0, dir: null };
  const gameFov = (asp) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50)) / Math.min(asp, 2)));
  return { n, init() { const g = G(); rnd0 = Math.random; Math.random = seeded(seed); g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
      g.useBoard(boardT); g.spawnRider(); br = brain({}); cb = carveBrain(cbo || (plan === 'air' ? { hi: 0.97, lo: 0.12, gain: 4 } : { hi: 0.8, lo: 0.16, gain: 3.4 })); const r = g.rider; LOG[name] = []; CALL.a = 0; CALL.tubeT = 0; CH.p = CH.l = null;
      for (let i = 0; i < 60 * 90; i++) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false); if (r.state === 'LIE' && g.incoming().t < 3.4) break; } },
    frame(i) { const g = G(), r = g.rider;
      for (let k = 0; k < (cam && cam.sub ? 1 : 2); k++) {   // (sub: one physics step a frame, 60 a second: pairs get blended into one 30 fps frame with motion blur)
        let o = br(r), stick = null;
        if (r.state === 'RIDE' && r.wave && r.stateT > 1.0) {
          const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh;
          const P = typeof plan === 'function' ? plan(r, lastCut) : plan; if (P !== 'snap') r._ph = null;   // (a phased ride: snaps, a cutback, then the barrel)
          if (typeof plan === 'function' && P === 'cut' && !cut) cut = 1;
          if (P === 'barrel' && r.stateT > 2.5) {   // set up in the pocket, stall till it covers you, then hold the line
            // (tube options, cbo: deep = how far back in the tube to sit, in wave heights behind the peel; weave = smooth rail
            // lines up and down the face while inside, as a fraction of the height, one every weaveT seconds)
            const T = cbo || {}, lineY = 0.35 + (r.inBarrel && T.weave ? T.weave * Math.sin(r.stateT * 2 * Math.PI / (T.weaveT || 2.6)) : 0);
            const err = yH - lineY + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
            const deep = T.deep != null ? T.deep : -0.2, stall = !(r.spitOut > 0) && (r.inBarrel ? T.deep != null && sH > deep : sH > -0.2);
            const steer = Math.max(-1, Math.min(1, wrapA(a0 - r.th) * 3));
            o = { steer: stall ? null : steer, pump: !stall && sH < -1.2 }; if (stall) stick = { x: steer, y: 1 };
          } else if (P === 'cut' && (cut || (r.stateT > 4 && r.stateT - lastCut > 4 && sH > 2.0 && r.v > w.cond.speed * 0.85))) {   // (well out on the shoulder, flying: closer in, the curl lands on you as you come round)   // out on the shoulder with speed: swing back round to the curl
            if (!cut) cut = 1;
            if (cut === 1) { o = { steer: 1, pump: false }; if (Math.cos(r.th) < -0.5) cut = 2; }   // (round through the face and back toward the curl...)
            else { o = { steer: -1, pump: false }; if (Math.cos(r.th) > 0.35) { cut = 0; lastCut = r.stateT; } }   // (...then rebound back down the line)
          } else if (P === 'snap') {   // bottom turn, drive hard up to the lip, whip it back down at full lock, again
            const sl = w.prof.slice(r.s), hT = r.y / Math.max(sl.top, 0.3), c = w.cond.speed, relVz = r.vz - c;
            const aim = (vz) => wrapA(Math.asin(Math.max(-0.95, Math.min(0.97, vz / Math.max(r.v, 0.5)))) - r.th);
            if (!r._ph) r._ph = 'up';
            if (r._ph === 'up' && hT > (cbo && cbo.top || 0.74)) r._ph = 'snap'; else if (r._ph === 'snap' && relVz > 1.2) r._ph = 'down'; else if (r._ph === 'down' && hT < 0.22) r._ph = 'up';
            const d = r._ph === 'up' ? aim(c - 0.8 * c) : aim(c + 0.7 * c);
            o = { steer: r._ph === 'snap' ? Math.sign(d) : Math.max(-1, Math.min(1, d * 3)), pump: r._ph !== 'snap' && r.v < c * 0.95 };
          } else { o = cb(r); o.pump = r.v < w.cond.speed * 0.85; }
        }
        g.input.stick = stick; g.input.test = stick ? null : o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle;
        if (cbo && cbo.ranch && r.state === 'LIE') g.ranchSend(cbo.ranch);   // (at the Sumba Ranch: order a wave whenever the pool is ready for one)
        // (cbo.walk = [from, to] seconds into the ride: a longboarder trims in the pocket and holds WALK to go up to the nose; trimAt/trimY2: from then on aims for another height on the face, a mistake on purpose to film the warning)
        if (cbo && cbo.walk && r.state === 'RIDE' && r.wave && r.stateT > cbo.walk[0] - 1.5 && r.stateT < cbo.walk[1] + 2) {
          const w = r.wave, Hh = w.cond.H, err = r.y / Hh - (cbo.trimAt && r.stateT > cbo.trimAt && !(cbo.react && r._warnAt != null) ? cbo.trimY2 : (cbo.trimY || 0.45)) - 0.35 * Math.max(0, r.s / Hh - 0.6), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9));
          const lim = (r.nose || 0) > 0.3 ? 0.75 : 1, st0 = Math.max(-lim, Math.min(lim, wrapA(Math.asin(sn) - r.th) * 2.5)), st = (r.nose || 0) >= 0.74 ? Math.max(-1, Math.min(1, st0 * 0.4 - 3.2 * (r.wob || 0) - 0.5 * (r.wobV || 0))) : st0, ahead = r.s / Hh > 0.8 && !(cbo.trimAt && r.stateT > cbo.trimAt && cbo.noStall);   // (gentle on the nose, as a longboarder is)   // (running ahead of the pocket: stall back into it)
          g.input.stick = ahead ? { x: st, y: 1 } : null; g.input.test = ahead ? null : st; g.input.paddleBtn = r.stateT > cbo.walk[0] && r.stateT < cbo.walk[1];
          if (cbo.react) { if (r.stateT < 0.5) r._warnAt = null; if (r._warnAt == null && ((r.pearlK || 0) > 0.25 || (r.shoulderK || 0) > 0.4)) r._warnAt = r.stateT; if (r._warnAt != null && r.stateT - r._warnAt > cbo.react) g.input.paddleBtn = false; }   // (react: lets go of WALK this long after the warning shows, as a player would)
        }
        g.step(1 / 60, 1 / 60, false);
      }
      callout(r, cam && cam.sub ? 1 / 60 : 1 / FPS);
      LOG[name].push([i, r.state, r.inBarrel ? 1 : 0, r.trick && r.trick.t < 0.05 ? r.trick.name : '', r.air ? 1 : 0, r.why || '', cut]);
      armK += ((r.standing ? 1 : 0) - armK) * Math.min(1, (cam && cam.sub ? 2 : 4) / FPS);
      if (cam && cam.both && r.wave) {   // both at once: your eyes, and the filmer on the ski (the same ride, frame for frame)
        const Hh = r.wave.cond.H, c = g.camera, rp = cam.rel ? g.rig.getWorldPosition(new THREE.Vector3()) : null, want = cam.rel ? new THREE.Vector3(rp.x + cam.ahead, rp.y + cam.up, rp.z + cam.out) : new THREE.Vector3(r.x + cam.ahead * Hh, Math.max(1.2, cam.up * Hh), r.z + cam.out * Hh);   // (rel: metres from the surfer, height above the surfer, so it never dips under the water in front)
        CH.p = CH.p ? CH.p.lerp(want, cam.rel ? 1 : 0.08) : want.clone(); const lk = rp ? rp.clone().setY(rp.y + 1) : new THREE.Vector3(r.x, r.y + 1, r.z); CH.l = CH.l ? CH.l.lerp(lk, rp ? 1 : 0.25) : lk;
        const fov = gameFov(W / H), pov = [c.position.clone(), c.quaternion.clone()];
        return { multi: [{ tag: '', fov, body: fov + (62 - fov) * armK }, { tag: 'X', pre() { c.position.copy(CH.p); c.lookAt(CH.l); c.updateMatrixWorld(); }, fov: cam.fov, chase: pov }] }; }
      if (cam && cam.ahead != null && r.wave) {   // a filmer in the channel on a jet ski: out in front of the wave and ahead on the shoulder, keeping pace, long lens on the surfer
        const Hh = r.wave.cond.H, c = g.camera, want = new THREE.Vector3(r.x + cam.ahead * Hh, Math.max(1.2, cam.up * Hh), r.z + cam.out * Hh);
        CH.p = CH.p ? CH.p.lerp(want, 0.08) : want.clone(); CH.l = CH.l ? CH.l.lerp(new THREE.Vector3(r.x, r.y + 1, r.z), 0.25) : new THREE.Vector3(r.x, r.y + 1, r.z);
        const pov = [c.position.clone(), c.quaternion.clone()];   // (the game lines your body up under its own camera next frame: it gets its camera back after the shot)
        c.position.copy(CH.p); c.lookAt(CH.l); c.updateMatrixWorld(); return { fov: cam.fov, chase: pov }; }
      const fov = gameFov(W / H);
      if (cam && cam.noBody) return { fov, body: 0 };   // (just the board: no hands or legs in shot)
      if (cam && cam.line && r.wave) {   // in the tube, your eyes turn down the line: the lip over your head, the way out ahead (still your own view)
        const c = g.camera, want = r.inBarrel || (r.state === 'RIDE' && r.stateT > cam.line && r.spitOut > 0) ? 1 : 0; LN.k += (want - LN.k) * 0.05;
        if (LN.k > 0.01) { const Lh = r.wave.lipAt(r.s + 14), d = new THREE.Vector3(Lh[0] - c.position.x, 0, Lh[2] + 3 - c.position.z); if (Number.isFinite(d.x + d.z) && d.lengthSq() > 0.04) { d.normalize(); LN.dir = LN.dir ? LN.dir.lerp(d, 0.07).normalize() : d; }   // (the lip ahead can be off the end of the wave: then keep the last way)
          if (LN.dir) { const q0 = c.quaternion.clone(), tg = c.position.clone().addScaledVector(LN.dir, 10); tg.y = c.position.y - (cam.lookDown != null ? cam.lookDown : 1.6); c.lookAt(tg); c.quaternion.copy(q0.slerp(c.quaternion.clone(), LN.k)); c.updateMatrixWorld(); } } }
      return { fov, body: fov + (62 - fov) * armK }; },
    done() { const g = G(); Math.random = typeof rnd0 === 'function' ? rnd0 : NATIVE_RANDOM; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; if (boardT !== 'short') g.useBoard('short'); CALL.a = 0; } };
}
// the pro ride (landscape gameplay video): the drop, snaps off the top, one cutback, then the barrel; filmed from your
// eyes and from the ski in the same pass (frames/NAME and frames/NAMEX)
export const proPlan = (snapTo = 8, cutTo = 11.5) => (r, lastCut) => r.stateT < snapTo ? 'snap' : r.stateT < cutTo && !(lastCut > 0) ? 'cut' : 'barrel';
T.pUma = proTake('pUma', 'medium', 3, 900, 'short', 'barrel'); T.pUmaC = proTake('pUmaC', 'medium', 9, 900, 'short', 'carve');
T.pHard = proTake('pHard', 'hard', 11, 800, 'short', 'carve'); T.pHardB = proTake('pHardB', 'hard', 11, 700, 'short', 'barrel');
T.pKanan = proTake('pKanan', 'kanan', 8, 800, 'short', 'cut'); T.pHiu = proTake('pHiu', 'hiu', 5, 700, 'short', 'barrel');
T.pEasy = proTake('pEasy', 'easy', 4, 900, 'fish', 'air'); T.pCut = proTake('pCut', 'medium', 7, 900, 'short', 'cut'); T.pGiant = proTake('pGiant', 'extreme', 7, 600, 'gun', 'carve');
// the villa and the view from it: free cameras in the villa's world (it keeps living: waves, crew, whale, dolphins)
const V = { ok: false };
function villaInit() { const g = G(); if (!document.body.classList.contains('villa')) { g.startVilla(); } g.step(0.5, 1 / 30, false); V.ok = true; }
const OX = 88, OZ = 31, DZ = 60;   // (the villa's frame: world x = OX - local x, world z = local z + OZ + DZ)
const L = (lx, y, lz) => new THREE.Vector3(OX - lx, y, lz + OZ + DZ);
const Y = 26;
function villaCam(from, to, look, k) { const c = G().camera; c.position.lerpVectors(from, to, k); c.lookAt(look); }
T.deck = { n: 110, init: villaInit, frame(i) { G().step(1 / FPS, 1 / FPS, false); const k = i / 110;   // up the banyan: lanterns, the canopy overhead, the break out past the rail
  villaCam(L(-81.4, Y + 9.5, 48.2), L(-81.0, Y + 9.55, 47.5), L(-20, Y + 16, 5), k); return { fov: 84 }; } };
T.drone = { n: 120, init: villaInit, frame(i) { G().step(1 / FPS, 1 / FPS, false); const k = i / 120, c = G().camera, ctr = L(-92, Y + 2.5, 40), a = Math.PI + 0.75 - 0.45 * k;   // the villa on its point at sunset, circling from the sea
  c.position.set(ctr.x + Math.cos(a) * 42, Y + 11 - 2 * k, ctr.z + Math.sin(a) * 42); c.lookAt(ctr.x, ctr.y + 2, ctr.z); return { fov: 55 }; } };
T.radio = { n: 100, init: villaInit, frame(i) { G().step(1 / FPS, 1 / FPS, false); const k = i / 100;   // the old radio on the balcony table, the song on its dial, the cone pumping
  villaCam(L(-83.9, Y + 0.95, 36.35), L(-84.15, Y + 0.85, 36.6), L(-85.2, Y + 0.62, 37), k); return { fov: 50 }; } };
// the crew from close: a surfer on the face, the camera riding alongside
function crewCam(pick, place, n) { let idx = -1; return { n, init() { villaInit(); const g = G(), S = g.crew.surfers; for (let k = 0; k < 30 * 120; k++) { g.step(1 / 30, 1 / 30, false); idx = S.findIndex(pick); if (idx >= 0) break; } },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const s = g.crew.surfers[idx]; place(g.camera, s, i); return { fov: 60 }; } }; }
T.carve = crewCam((s) => s.st === 'RIDE' && s.tau > 2.5 && s.tau < 4 && !(s.tube < 8), (c, s, i) => { const p = s.p; c.position.set(p.x + 3.5, p.y + 1.6, p.z + 6.5); c.lookAt(p.x, p.y + 0.9, p.z); }, 90);
T.tube = crewCam((s) => s.st === 'RIDE' && s.tubeT > 0.05 && s.tubeT < 0.4, (c, s, i) => { const p = s.p; c.position.set(p.x + 9, p.y + 2.2, p.z + 9); c.lookAt(p.x, p.y + 1, p.z); }, 75);
// the showcase ride: paddle in, the drop, a bottom turn and carves up and down the face, then pull in, get barrelled
// and spat out as the wave backs off at the end (one continuous take; the GoPro turns down the line once you're tubed)
T.ride2 = (() => { let br, cb, rnd0; const rs = { w: 0, pan: 0.5 }; return { n: 830, keep: [[90, 440], [540, 830]],
  init() { const g = G(); rnd0 = Math.random; Math.random = seeded(3); g.setMode('medium'); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing', 'riding');
    g.useBoard('short'); g.spawnRider(); br = brain({}); cb = carveBrain({ hi: 0.72, lo: 0.22 }); const r = g.rider;
    for (let i = 0; i < 60 * 90; i++) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false); if (r.state === 'LIE' && g.incoming().t < 3.0) break; } },
  frame() { const g = G(), r = g.rider;
    for (let k = 0; k < 2; k++) {
      if (r.state === 'RIDE' && r.stateT > 4.2) {   // the barrel
        const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh, err = yH - 0.35 + (r.stalling ? 0.12 : 0);
        const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn), steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
        const stall = !r.inBarrel && sH > -0.2 && !(r.spitOut > 0); g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
      } else if (r.state === 'RIDE' && r.stateT > 1.2) { g.input.stick = null; const o = cb(r); g.input.test = o.steer; g.input.paddleBtn = false; }   // carving
      else if (r.state === 'RIDE' || r.state === 'POP' || r.state === 'LIE') { g.input.stick = null; const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
      g.step(1 / 60, 1 / 60, false);
    }
    const c = g.camera, lip = new THREE.Vector3(); if (r.wave && r.state === 'RIDE') { const L = r.wave.lipAt(r.s + 2); lip.set(L[0], L[1] * (r.wave.fade || 1), L[2]); c.updateMatrixWorld();
      const sp = lip.clone().project(c); const fx = 0.5 + sp.x * 0.5 * (1 / 2.16) * 2.16; rs.pan += (Math.max(0.33, Math.min(0.67, 0.5 + (fx - 0.5) * 0.55)) - rs.pan) * 0.05; } else rs.pan += (0.5 - rs.pan) * 0.05;
    return { fov: 70, body: 62, crop: rs.pan }; },   // (the game's own first-person camera and lenses; the frame is a tall slice of it that leans toward the wave)
  done() { const g = G(); Math.random = typeof rnd0 === 'function' ? rnd0 : NATIVE_RANDOM; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; } }; })();
// in the villa, as you: walking from the board room through the living room, out through the open doors to the balcony
// and the view; and reaching for a board in the rack
function walkTake(n, start, pts, pitch0, pitch1, cropX = 0.5) { let wi = 0; return { n,
  init() { villaInit(); const g = G(), w = g.walker; w.sit = null; w.x = OX - start[0]; w.z = start[1] + OZ; w.y = 27.65; w.yaw = Math.atan2(pts[0][1] + OZ - w.z, OX - pts[0][0] - w.x); wi = 0; g.step(0.3, 1 / 30, false); },
  frame(i) { const g = G(), w = g.walker, k = i / n; const tgt = pts[Math.min(wi, pts.length - 1)], tx = OX - tgt[0], tz = tgt[1] + OZ;
    if (Math.hypot(tx - w.x, tz - w.z) < 0.6 && wi < pts.length - 1) wi++;
    const want = Math.atan2(tz - w.z, tx - w.x); w.yaw += Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)) * 0.08; w.pitch = pitch0 + (pitch1 - pitch0) * k;
    w.mz = wi >= pts.length - 1 && Math.hypot(tx - w.x, tz - w.z) < 0.7 ? 0 : 0.85; g.step(1 / FPS, 1 / FPS, false); return { fov: 61.6, body: 61.6, crop: cropX }; } }; }   // (the villa's own camera and lens, a tall slice of it)
T.walk = walkTake(165, [-97.2, 36.6], [[-94.5, 36.5], [-91, 35.8], [-87.5, 36.6], [-85.9, 37.4], [-83.6, 38.2]], 0.12, -0.08);
T.coach = walkTake(120, [-91.2, 35.2], [[-89.2, 36.4], [-88.4, 36.9]], 0.02, -0.02, 0.5);   // (in the living room, up to Coach Rudi at the open doors)
T.rack = walkTake(85, [-95.6, 38.3], [[-97.9, 38.3], [-98.1, 38.3]], -0.02, -0.14, 0.58);
// a friend at the villa: the camera drifts round them at head height (a0..a1: angles from the way they face)
export function friendTake(name, id, n, { d = 2.2, h = 0.25, a0 = -0.5, a1 = 0.5, fov = 45, ly = -0.1 } = {}) {
  T[name] = { n, init() { villaInit(); G().step(2, 1 / 30, false); },
    frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const F = g.friends.list.find((f) => f.id === id), c = g.camera, k = i / n, p = new THREE.Vector3();
      F.root.getWorldPosition(p); const hd = F.head && F.head.y > 1 ? F.head : p.clone().add(new THREE.Vector3(0, 1.5, 0));
      const yaw = (F.S.yaw || 0) + a0 + (a1 - a0) * k; c.position.set(hd.x + Math.sin(yaw) * d, hd.y + h, hd.z + Math.cos(yaw) * d); c.lookAt(hd.x, hd.y + ly, hd.z); return { fov }; } };
  return name; }
// any free camera move in the villa's world: from -> to, looking at a point (world coordinates)
export function freeTake(name, n, from, to, look, fov = 50, look2) {
  T[name] = { n, init() { villaInit(); G().step(2, 1 / 30, false); },
    frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const k = i / n, e = k * k * (3 - 2 * k), c = g.camera; c.position.set(...from.map((v, j) => v + (to[j] - v) * e)); const L2 = look2 || look; c.lookAt(...look.map((v, j) => v + (L2[j] - v) * e)); return { fov }; } };
  return name; }
// wildlife: set the moment up, then film it low from the water
T.dolphins = { n: 100, init() { villaInit(); const g = G(), P = g.wild.pod; P.on = false; P.next = 0; g.step(1 / 30, 1 / 30, false); g.step(4, 1 / 30, false); },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const P = g.wild.pod, px = P.x0 + P.dx * P.t, pz = P.z0 + P.dz * P.t; const c = g.camera;
    c.position.set(px + Math.sign(P.dx) * 3.5, 0.9, pz + 6.5); c.lookAt(px - Math.sign(P.dx) * 2.5, 0.6, pz); return { fov: 46 }; } };
T.whale = { n: 170, init() { villaInit(); const g = G(), Wh = g.wild.whale; Wh.st = 'away'; Wh.n = 1; Wh.next = 0; g.step(1 / 30, 1 / 30, false); },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const Wh = g.wild.whale, c = g.camera; c.position.set(Wh.x - 26, 2.2, Wh.z + 24); c.lookAt(Wh.x, 5.5, Wh.z); return { fov: 36 }; } };

// run (or carry on) a take; returns progress. Frames land in trailer/frames/<name>/
const S = {};
export async function run(name, budget = 36000) {
  const t = T[name]; if (!t) return 'no take ' + name;
  if (!S[name]) { S[name] = { i: 0 }; t.init(); }
  const s = S[name], t0 = performance.now();
  while (s.i < t.n && performance.now() - t0 < budget) { const o = t.frame(s.i); if (!t.keep || t.keep.some(([a, b]) => s.i >= a && s.i <= b)) { if (o.multi) for (const v of o.multi) { if (v.pre) v.pre(); draw(v.fov, v.body, v.crop, v.chase); await grab(name + v.tag, s.i); } else { draw(o.fov, o.body, o.crop, o.chase); await grab(name, s.i); } } s.i++; }   // (keep: only the stretches the edit uses get drawn)
  await flush();
  if (s.i >= t.n) { if (t.done) t.done(); return `${name}: done (${t.n} frames)`; }
  return `${name}: ${s.i}/${t.n}`;
}
export function reset(name) { delete S[name]; }
// one test frame of a take (after k frames), saved as frames/_peek/<name>.jpg, to judge the framing before filming it all
export async function peek(name, k = 0) { const t = T[name]; delete S[name]; t.init(); let o; for (let i = 0; i <= k; i++) { o = t.frame(i); if (i < k && Array.isArray(o.chase)) { const c = G().camera; c.position.copy(o.chase[0]); c.quaternion.copy(o.chase[1]); } } draw(o.fov, o.body, o.crop, o.chase);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85)); await fetch(`http://127.0.0.1:8799/f?shot=_peek_${name}&i=${k}`, { method: 'POST', body: blob }); return 'peeked ' + name; }
// dry run of a take (no drawing): the rider's line every few frames, to set a take up before filming it
export function sim(name, n, every = 20) { const t = T[name], g = G(); delete S[name]; t.init(); const out = [];
  for (let i = 0; i < n; i++) { const o = t.frame(i); if (o && Array.isArray(o.chase)) { g.camera.position.copy(o.chase[0]); g.camera.quaternion.copy(o.chase[1]); } if (i % every === 0) { const r = g.rider; if (!r) continue; const w = r.wave, H = w ? w.cond.H : 1;
    out.push(`${i} ${r.state} t${r.stateT.toFixed(1)} s${w ? (r.s / H).toFixed(2) : '-'} y${w ? (r.y / H).toFixed(2) : '-'}${r.inBarrel ? ' B' : ''}${w && w.endK < 1 ? ' end' + (w.endK * 100 | 0) : ''}`); } }
  return out.join(' | '); }
// the camera's own motion through a take, frame by frame (no drawing): how far it turns each frame (degrees), the steer
// being given, and the rider's heading; to find jerks
export function trace(name, n, extra) { const t = T[name], g = G(); delete S[name]; t.init(); const out = [], pq = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { t.frame(i); const c = g.camera, r = g.rider; const turn = i ? THREE.MathUtils.radToDeg(pq.angleTo(c.quaternion)) : 0; pq.copy(c.quaternion);
    out.push([i, +turn.toFixed(2), g.input.test == null ? (g.input.stick ? 'stall' : '-') : +(+g.input.test).toFixed(2), +r.th.toFixed(3), r.state, r.trick && r.trick.t < 0.05 ? r.trick.name : '', extra ? extra() : 0]); }
  return out; }
// sitting on your board in the lineup, facing out to sea, watching a set roll in (your view: knees, hands, board); from
// when the next wave is tStart s away, one physics step a frame (60 a second: blended to 30 with motion blur)
export function addSit(name, mode, seed, n, tStart = 12, boardT = 'short', keep) {
  let rnd0; const wrapS = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const gameFov = (asp) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50)) / Math.min(asp, 2)));
  const hold = (r) => { const g = G(); g.input.test = Math.max(-1, Math.min(1, wrapS(-Math.PI / 2 - r.th) * 2)); g.input.paddleBtn = false; g.input.stick = null; };   // (face the sea, sit still)
  T[name] = { n, keep, init() { const g = G(); rnd0 = Math.random; Math.random = seeded(seed); g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
      g.useBoard(boardT); g.spawnRider(); const r = g.rider; CALL.a = 0;
      for (let i = 0; i < 60 * 120; i++) { hold(r); g.step(1 / 60, 1 / 60, false); const inc = g.incoming(); if (r.stateT > 4 && inc.w && inc.t < tStart) break; } },
    frame() { const g = G(), r = g.rider; hold(r); g.step(1 / 60, 1 / 60, false); const fov = gameFov(W / H); return { fov, body: 62 }; },
    done() { const g = G(); Math.random = typeof rnd0 === 'function' ? rnd0 : NATIVE_RANDOM; g.input.test = null; g.input.paddleBtn = false; if (boardT !== 'short') g.useBoard('short'); } };
  return name;
}
// from the villa balcony, zoomed in as the game's ZOOM does (your eyes, binoculars), the humpback breaching (the show
// put on, its five-second note let run, then n frames one physics step each: 60 a second, for motion blur)
export function addWhaleShot(name, n, fov = 10, kind = 'breach') {
  T[name] = { n, init() { const g = G(); g.startVilla(); villaInit(); g.step(1, 1 / 30, false); g.wild.show(kind);   // (always into the villa: after a surf take the page is still at that spot)
     g.step(5.1, 1 / 60, false); },
    frame() { const g = G(); g.step(1 / 60, 1 / 60, false); const Wh = g.wild.whale, c = g.camera;
      if (!this.aim) this.aim = new THREE.Vector3(Wh.x, 3, Wh.z); this.aim.lerp(new THREE.Vector3(Wh.x, 3, Wh.z), 0.05);   // (a steady hand following the whale)
      c.position.set(169, 28.4, 119); c.lookAt(this.aim); return { fov }; } };
  return name;
}
export const takes = T;   // (the takes themselves: test/beauty.js steps one to the moment it wants and renders its own still)
