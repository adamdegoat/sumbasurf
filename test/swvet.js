// Stance switch vet (3 Oct 2026): longboard rides by the test pro, with SWITCH pressed on a plan, to check the switch
// never drops you on a clean face, wobbles you in a risky spot, and doesn't make scores easy.
//   const V = await import('./test/swvet.js?v=' + Date.now()); await V.ride({ mode: 'easy', seed: 4, plan: 'clean' })
const G = () => window.__g;
// plan: 'none' (never), 'clean' (twice, mid ride on the face), 'spam' (every time it can), 'drop' (right off the pop),
//       'turn' (in the middle of a hard carve), 'nose' (out on the nose), [t1, t2...] (at these ride times)
export async function ride({ mode = 'easy', seed = 4, plan = 'clean', walk = null, maxS = 40, counter = false } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'sw' + Math.random(), n = 60 * maxS;
  FM.addPro(nm, mode, seed, n, 'long', 'carve', walk ? { walk } : undefined); const t = FM.takes[nm]; t.init();
  const r = g.rider, out = { presses: 0, switches: 0, risks: [], wobMax: 0, flips: 0, swEnd: null };
  const upd = r.update; if (counter) r.update = function (dt, inp, w) { if (r.swT >= 0 && r.swRisk > 0.3) inp.steer = Math.max(-1, Math.min(1, -(counter * (r.wob || 0) / 0.3 + 0.3 * (r.wobV || 0)))); return upd.call(r, dt, inp, w); };   // (a player steering against the rock: counter = how hard)
  let lastBs = r.backside, at = Array.isArray(plan) ? [...plan] : null, done = 0;
  for (let i = 0; i < n; i++) {
    if (r.state === 'RIDE' && r.wave && r.swT < 0) {
      const tt = r.stateT, leanK = Math.abs(r.lean) / 0.85;
      let go = false;
      if (at) { if (at.length && tt >= at[0]) { at.shift(); go = true; } }
      else if (plan === 'clean') go = done < 2 && tt > 3 + done * 4 && leanK < 0.25 && !r.inBarrel && r.s / r.wave.cond.H > -0.4 && (r.nose || 0) < 0.3;
      else if (plan === 'spam') go = tt > 0.2;
      else if (plan === 'cleanspam') go = tt > 2 && leanK < 0.25 && !r.inBarrel && r.s / r.wave.cond.H > -0.4 && (r.nose || 0) < 0.3;
      else if (plan === 'drop') go = done < 1 && tt > 0.15;
      else if (plan === 'turn') go = done < 2 && tt > 2 && leanK > 0.6;
      else if (plan === 'nose') go = done < 1 && (r.nose || 0) >= 0.9;
      if (go) { g.sw(); out.presses++; done++; }
    }
    t.frame(i);
    if (r.swT >= 0 && r.swT < 0.05 && !out.risks.length || (r.swT >= 0 && r.swT < 0.04 && out.risks[out.risks.length - 1] !== +r.swRisk.toFixed(2))) out.risks.push(+r.swRisk.toFixed(2));
    if (r.backside !== lastBs) { out.flips++; lastBs = r.backside; }
    out.wobMax = Math.max(out.wobMax, Math.abs(r.wob || 0));
    if (r.state === 'WIPE' || r.state === 'OUT') break;
  }
  out.switches = r.ride.moves.filter((m) => m.name === 'SWITCH').length;
  out.end = r.state; out.why = r.why || ''; out.score = r.ride.score; out.rideS = +r.ride.t.toFixed(1); out.sw = r.sw; out.wobMax = +out.wobMax.toFixed(2);
  out.moves = r.ride.moves.map((m) => m.name + ' ' + m.pts.toFixed(2)).join(', ');
  if (counter) delete r.update; t.done(); return out;
}
// how smooth the view is through a switch: biggest turn and eye move a frame, and how far the eye dips and lifts
export async function view({ mode = 'easy', seed = 4, at = 4 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'sv' + Math.random(), n = 60 * 20;
  FM.addPro(nm, mode, seed, n, 'long', 'carve'); const t = FM.takes[nm]; t.init();
  const r = g.rider, c = g.camera, q0 = c.quaternion.clone(), p0 = c.position.clone().sub(g.rig.position); let pressed = false, base = null, maxA = 0, maxP = 0, dipMin = 0, liftMax = 0, n2 = 0, aBefore = 0, frames = [], pBefore = 0;
  for (let i = 0; i < n; i++) {
    if (!pressed && r.state === 'RIDE' && r.stateT >= at) { g.sw(); pressed = true; }
    t.frame(i); if (r.state !== 'RIDE') { if (pressed || r.state === 'WIPE' || r.state === 'OUT') break; continue; }
    const rel = c.position.clone().sub(g.rig.position), a = q0.angleTo(c.quaternion) * 57.3, dp = rel.distanceTo(p0);
    if (pressed && r.swT >= 0 && r.swT < 0.7) { maxA = Math.max(maxA, a); maxP = Math.max(maxP, dp); if (base === null) base = rel.y; dipMin = Math.min(dipMin, rel.y - base); liftMax = Math.max(liftMax, rel.y - base); frames.push(+(dp * 100).toFixed(1)); }
    else if (!pressed && r.stateT > 1.5) { aBefore = Math.max(aBefore, a); pBefore = Math.max(pBefore, dp); }
    q0.copy(c.quaternion); p0.copy(rel); if (pressed && r.swT < 0 && ++n2 > 30) break;
  }
  t.done(); return { maxTurnDegPerFrameInSwitch: +maxA.toFixed(2), maxTurnDegPerFrameBefore: +aBefore.toFixed(2), maxEyeMoveCmPerFrame: +(maxP * 100).toFixed(1), eyeMoveBefore: +(pBefore * 100).toFixed(1), path: frames, dipCm: +(dipMin * 100).toFixed(1), liftCm: +(liftMax * 100).toFixed(1), end: r.state, sw: r.sw };
}
// pictures through a switch: your own view (the game's two passes) and from outside beside you, at moments of the hop
export async function shots({ mode = 'easy', seed = 4, at = 4, when = [0, 0.12, 0.25, 0.38, 0.5, 1.0] } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(), nm = 'ss' + Math.random(), n = 60 * 20;
  FM.addPro(nm, mode, seed, n, 'long', 'carve', undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, out = []; let pressed = false, k = 0, t0 = 0;
  for (let i = 0; i < n && k < when.length; i++) {
    if (!pressed && r.state === 'RIDE' && r.stateT >= at) { g.sw(); pressed = true; t0 = r.stateT; }
    t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break;
    if (pressed && r.stateT - t0 >= when[k]) {
      N.draw(g); const pov = g.renderer.domElement.toDataURL('image/jpeg', 0.7);
      const oc = g.camera.clone(), th = r.th, sx = -Math.sin(th), sz = Math.cos(th); oc.position.set(g.rig.position.x + sx * 2.6 + Math.cos(th) * 0.6, g.rig.position.y + 1.3, g.rig.position.z + sz * 2.6 + Math.sin(th) * 0.6); oc.fov = 45; oc.updateProjectionMatrix(); oc.lookAt(g.rig.position.x, g.rig.position.y + 0.7, g.rig.position.z);
      oc.layers.enableAll(); const hv = g.HIDELEGS.value; g.HIDELEGS.value = 0; g.renderer.render(g.scene, oc); g.HIDELEGS.value = hv; const side = g.renderer.domElement.toDataURL('image/jpeg', 0.7);
      out.push({ t: when[k], swT: +r.swT.toFixed(2), sw: r.sw, pov, side }); k++;
    }
  }
  t.done(); return out;
}
// what a friend sees: on the free surf beach, your own surfer fed back as a friend 5 m to the side (the way the network
// delivers it), pictures of that friend's body through your switch
export async function friend({ when = [0, 0.15, 0.25, 0.35, 0.5, 1.0], maxS = 120 } = {}) {
  const g = G(); if (g.mode !== 'free') { g.useBoard('long'); await g.freeStart(false, 'bay'); }
  for (let i = 0; i < 40 && !(g.strand && g.strand.deck); i++) await new Promise((res) => setTimeout(res, 250));   // (arriving: on the boat's deck)
  if (g.strand && g.strand.deck) { g.strand.lx = 99; g.strand.yaw = 0; }   // (stood at the side rail facing out: where Jump in works)
  g.hutJump(); for (let i = 0; i < 40 && !g.rider; i++) await new Promise((res) => setTimeout(res, 250));   // (jump in, played by the game's own loop)
  if (!g.rider) return [{ err: 'never got in the water', strand: !!g.strand }];
  g.paused = true; g.rider.x = -158; g.rider.z = -8; g.rider.th = -Math.PI / 2;   // (out at the main peak's lineup)
  const { brain } = await import('./sim2.js'); const br = brain({}); const r = g.rider, out = [];
  let pressed = false, t0 = 0, k = 0, tm = 0;
  for (let i = 0; i < 60 * maxS && k < when.length; i++) {
    const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle;
    if (!pressed && r.state === 'RIDE' && r.stateT > 3) { g.sw(); pressed = true; t0 = r.stateT; g.input.paddleBtn = false; }
    g.step(1 / 60, 1 / 60, false); tm += 1000 / 60;
    const a = g.freeSnap(); if (a && typeof a[1] === 'number') { const b = a.slice(); b[1] += 5; b[21] = (b[21] || 0) + 5; g.freePeer('f0', b, 'Kai', performance.now() - 200 + tm * 0); }
    g.peersTick(1 / 60);
    if (r.state === 'WIPE' || r.state === 'OUT') { if (pressed) break; }
    if (pressed && r.stateT - t0 >= when[k]) {
      await new Promise((res) => setTimeout(res, 160)); g.peersTick(1 / 60);
      const P = g.peers.get('f0'); if (!P || !P.os) { out.push({ t: when[k], none: true }); k++; continue; }
      const p = P.os.group.position.clone ? P.os.group.position : null, fp = new (g.camera.position.constructor)(); P.os.group.getWorldPosition(fp);
      const oc = g.camera.clone(), th = r.th; oc.layers.enableAll(); oc.position.set(fp.x - Math.sin(th) * 3 + Math.cos(th) * 0.5, fp.y + 1.4, fp.z + Math.cos(th) * 3 + Math.sin(th) * 0.5); oc.fov = 45; oc.updateProjectionMatrix(); oc.lookAt(fp.x, fp.y + 0.8, fp.z);
      g.renderer.render(g.scene, oc); out.push({ t: when[k], sw: P.S && P.S.sw, img: g.renderer.domElement.toDataURL('image/jpeg', 0.7) }); k++;
    }
  }
  g.input.test = null; g.input.paddleBtn = false; g.paused = false; return out;
}
// dark blobs in your own view through a switch: dark pixels (sum of RGB < 60) in the picture every 1/30 s from the press
// to 1.2 s after, in a stance; returns the counts and the worst frame's picture
export async function dark({ mode = 'easy', seed = 4, stance = 'regular', at = 4, nose = false } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(), nm = 'sd' + Math.random(), n = 60 * 20;
  g.useStance(stance); FM.addPro(nm, mode, seed, n, 'long', 'carve', nose ? { walk: [2, 99] } : undefined); const t = FM.takes[nm]; t.init();
  const r = g.rider, cv = g.renderer.domElement, c = document.createElement('canvas'), counts = []; let pressed = false, t0 = 0, worst = -1, worstImg = null;
  const cnt = () => { const w = 160, h = Math.round(160 * cv.height / cv.width); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, w, h); const d = x.getImageData(0, 0, w, Math.round(h * 0.85)).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 60) k++; return k; };
  for (let i = 0; i < n; i++) {
    if (!pressed && r.state === 'RIDE' && r.stateT >= at && (!nose || (r.nose || 0) >= 0.95)) { g.sw(); pressed = true; t0 = r.stateT; }
    t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break;
    if (pressed) { N.draw(g); const k = cnt(); counts.push(k); if (k > worst) { worst = k; worstImg = cv.toDataURL('image/jpeg', 0.7); } if (r.stateT - t0 > 1.2) break; }
  }
  t.done(); return { stance, counts: counts.join(','), worst, worstImg, sw: r.sw, end: r.state };
}
// walking to the nose: is any of your arm on screen while the view is leaving it out? Each frame: walk (noseV), how far the
// arms are left out (hide, as game.js works it out), and whether a hand, wrist or elbow is inside the picture
export async function armwalk({ mode = 'medium', seed = 5, stance = 'regular', frames = 60 * 14 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(), nm = 'aw' + Math.random();
  g.useStance(stance); FM.addPro(nm, mode, seed, frames, 'long', 'carve', { walk: [3, 10] }); const t = FM.takes[nm]; t.init();
  const r = g.rider, AP = g.ARMPOSE, bones = {}; g.surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const V3 = g.camera.position.constructor, v = new V3(), rows = []; let bad = 0, badAt = [];
  for (let i = 0; i < frames; i++) {
    t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (r.state !== 'RIDE') continue;
    N.draw(g); const cam = g.armCam, nv = g.noseV, hide = Math.min(1, Math.max(0, (nv - AP.hideAt) / 0.15)), hs = hide * hide * (3 - 2 * hide);
    let on = 0; for (const b of ['hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r']) { bones[b].getWorldPosition(v); v.project(cam); if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) on++; }
    if (hs > 0.02 && hs < 0.98 && on) { bad++; if (badAt.length < 6) badAt.push(+nv.toFixed(2)); }
    if (i % 10 === 0) rows.push(`${nv.toFixed(2)}/${hs.toFixed(2)}/${on}`);
  }
  t.done(); return { stance, fadingWhileOnScreen: bad, badAt, rows: rows.slice(0, 40).join(' ') };
}
// through a switch: is any of your arm on screen while the view is leaving it out? (as armwalk, for the hop)
export async function armswitch({ mode = 'medium', seed = 5, stance = 'regular', at = 4 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(), nm = 'as' + Math.random(), n = 60 * 20;
  g.useStance(stance); FM.addPro(nm, mode, seed, n, 'long', 'carve'); const t = FM.takes[nm]; t.init();
  const r = g.rider, AP = g.ARMPOSE, bones = {}; g.surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }, v = new (g.camera.position.constructor)(), rows = []; let bad = 0, pressed = false, t0 = 0;
  for (let i = 0; i < n; i++) {
    if (!pressed && r.state === 'RIDE' && r.stateT >= at) { g.sw(); pressed = true; t0 = r.stateT; }
    t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (!pressed) continue;
    N.draw(g); const hide = r.swT >= 0 ? Math.min(sm((r.swT - AP.swHide[0]) / 0.06), 1 - sm((r.swT - AP.swHide[1]) / 0.06)) : 0;
    let on = 0; for (const b of ['hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r']) { bones[b].getWorldPosition(v); v.project(g.armCam); if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) on++; }
    if (hide > 0.02 && hide < 0.98 && on) bad++;
    rows.push(`${r.swT.toFixed(2)}/${hide.toFixed(2)}/${on}`); if (r.stateT - t0 > 1.3) break;
  }
  t.done(); return { stance, fadingWhileOnScreen: bad, rows: rows.join(' ') };
}
// the hop in your view: eye height above the board (cm) every 1/60 s through a switch, its biggest step a frame, the
// biggest turn of the view a frame, and the same two numbers over the second before the press (normal riding)
export async function hoptrace({ mode = 'easy', seed = 4, stance = 'regular', at = 4, nose = false, local = false } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'ht' + Math.random(), n = 60 * 20;
  g.useStance(stance); FM.addPro(nm, mode, seed, n, 'long', 'carve', nose ? { walk: [2, 99] } : undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, c = g.camera, q0 = c.quaternion.clone(); let pressed = false, t0 = 0, prevY = null; const ys = [], pre = { dy: 0, da: 0 }, hop = { dy: 0, da: 0 }; const hist = [];
  for (let i = 0; i < n; i++) {
    if (!pressed && r.state === 'RIDE' && r.stateT >= at && (!nose || (r.nose || 0) >= 0.95)) { g.sw(); pressed = true; t0 = r.stateT; }
    t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (r.state !== 'RIDE') { prevY = null; continue; }
    const y = (local ? g.rig.worldToLocal(c.position.clone()).y : c.position.y - g.rig.position.y) * 100, da = q0.angleTo(c.quaternion) * 57.3; q0.copy(c.quaternion);
    const dy = prevY === null ? 0 : Math.abs(y - prevY); prevY = y;
    if (!pressed) { hist.push([dy, da]); if (hist.length > 60) hist.shift(); }
    else { if (!ys.length) for (const [a, b] of hist) { pre.dy = Math.max(pre.dy, a); pre.da = Math.max(pre.da, b); } ys.push(+y.toFixed(1)); hop.dy = Math.max(hop.dy, dy); hop.da = Math.max(hop.da, da); if (r.stateT - t0 > 1.0) break; }
  }
  t.done(); const base = ys[0]; return { stance, lowCm: +(Math.min(...ys) - base).toFixed(1), highCm: +(Math.max(...ys) - base).toFixed(1), hopStepCm: +hop.dy.toFixed(2), hopTurnDeg: +hop.da.toFixed(2), normalStepCm: +pre.dy.toFixed(2), normalTurnDeg: +pre.da.toFixed(2), path: ys.filter((_, i) => i % 3 === 0).map((v) => +(v - base).toFixed(1)).join(' ') };
}
