// Air vet (3 Oct 2026): the test pro rides hunting airs (film's 'air' plan) on a shortboard; in the air a scripted thumb
// does one of: 'none' (hands off, as before), 'grab' (holds STALL), 'r360' (spins all the way), 'rev' (spins about half and
// stops, then on landing: help = thumb with the turn, idle = nothing, wrong = thumb against it).
//   const A = await import('./test/airvet.js?v=' + Date.now()); await A.ride({ mode: 'hard', seed: 6, air: 'rev', out: 'help' })
const G = () => window.__g;
export async function ride({ mode = 'hard', seed = 6, board = 'short', air = 'none', out = 'help', maxS = 40, stance = 'goofy' } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'av' + Math.random(), n = 60 * maxS;
  g.useStance(stance); FM.addPro(nm, mode, seed, n, board, 'air'); const t = FM.takes[nm]; t.init();
  const r = g.rider, res = { airs: 0, revs: 0, landed: [], falls: [] }; let wasAir = false, spinDir = 0;
  const upd = r.update;
  r.update = function (dt, inp, w) {
    const A = r.air;
    if (A) {
      if (!wasAir) { wasAir = true; res.airs++; spinDir = Math.random() < 0.5 ? -1 : 1; }
      if (air === 'grab') inp.stall = 1;
      if (air === 'r360' && A.t > 0.3) inp.steer = spinDir;
      if (air === 'rev' && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? spinDir : 0;
    } else {
      if (wasAir) wasAir = false;
      if (r.rev) { if (!r.rev.counted) { r.rev.counted = true; res.revs++; } inp.steer = out === 'help' ? r.rev.dir : out === 'wrong' ? -r.rev.dir : 0; }
    }
    return upd.call(r, dt, inp, w);
  };
  let lastMoves = 0;
  for (let i = 0; i < n; i++) {
    t.frame(i);
    const ms = r.ride.moves; while (lastMoves < ms.length) { const m = ms[lastMoves++]; if (/AIR/.test(m.name)) res.landed.push(m.name + (m.notes.includes('grab') ? '+grab' : '') + ' ' + m.pts.toFixed(2)); }
    if (r.state === 'WIPE' || r.state === 'OUT') { if (r.state === 'WIPE') res.falls.push(r.why); break; }
  }
  delete r.update; t.done();
  res.score = r.ride.score; res.end = r.state; res.why = r.why || ''; return res;
}
// can an air be launched at all? A simple line: down the face to the bottom, then straight back up it at angle `up` (rad
// above the wave's line) pumping for speed, again and again; counts the airs and how each try ended
export async function launch({ mode = 'medium', seed = 5, board = 'short', up = 1.0, down = 0.6, low = 0.2, maxS = 40, pumpUp = true } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'al' + Math.random(), n = 60 * maxS;
  FM.addPro(nm, mode, seed, n, board, 'carve'); const t = FM.takes[nm]; t.init();
  const r = g.rider, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)); let ph = 'down', airs = 0, wasAir = false, tries = 0, peak = 0, phT = 0, hiR = 0; const probe = [];
  const upd = r.update;
  r.update = function (dt, inp, w) {
    if (r.state === 'RIDE' && r.wave && !r.air && r.stateT > 1) {
      const H = r.wave.cond.H, yH = r.y / H, line = r.wave.cond.peel !== undefined ? Math.PI : Math.PI;
      phT += dt; if (ph === 'down' && yH < low && phT > 0.4) { ph = 'up'; tries++; phT = 0; } else if (ph === 'up' && (yH > 1.0 || phT > 2.5)) { ph = 'down'; phT = 0; }
      hiR = Math.max(hiR, r.y / Math.max(0.3, r.wave.prof.slice(r.s).top));
      const want = ph === 'down' ? down : -up;   // (the wave peels toward +x: along the line is th 0, up the face is toward -z) inp.steer = Math.max(-1, Math.min(1, wrap(want - r.th) * 3)); inp.pump = pumpUp ? true : ph === 'down'; inp.paddle = inp.pump; inp.stall = 0;
      peak = Math.max(peak, r.vyPk || 0);
      const sl = r.wave.prof.slice(r.s), top = Math.max(0.3, sl.top * (r.wave.fade || 1));
      if (ph === 'up' && r.y > 0.7 * top && probe.length < 12 && (!probe.length || probe[probe.length - 1].tr !== tries)) probe.push({ tr: tries, hR: +(r.y / top).toFixed(2), sH: +(r.s / H).toFixed(2), vyPk: +(r.vyPk || 0).toFixed(2), need: +Math.max(2.6, 0.42 * Math.sqrt(9.8 * H)).toFixed(2), hitV: +(r.hitV || 0).toFixed(1), needHit: +(0.8 * r.wave.cond.speed).toFixed(1), upT: +(r.upT || 0).toFixed(2) });
    }
    if (r.air && !wasAir) airs++; wasAir = !!r.air;
    return upd.call(r, dt, inp, w);
  };
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; }
  delete r.update; t.done(); return { up, airs, tries, end: r.state, why: r.why || '', vyPk: +peak.toFixed(2), H: r.wave ? r.wave.cond.H : null, hiR: +hiR.toFixed(2), probe };
}
// the new air tricks, from airs launched the way the game launches them (the bot can't hit the lip like a player): high
// on the face, climbing, the game's own take-off (vy from the face, carried forward with the lip). In the air: air (as in
// ride), then on a reverse's landing: out (help / idle / wrong). n airs on one ride, one at a time
export async function forced({ mode = 'medium', seed = 5, board = 'short', air = 'none', out = 'help', stance = 'goofy', vy = 4.5, tries = 6, spinTo = 1.6 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), res = [];
  for (let k = 0; k < tries; k++) {
    g.useStance(stance); const nm = 'af' + Math.random(), n = 60 * 30; FM.addPro(nm, mode, seed + k, n, board, 'carve'); const t = FM.takes[nm]; t.init();
    const r = g.rider, upd = r.update; let launched = false, spinDir = k % 2 ? 1 : -1, rec = null;
    r.update = function (dt, inp, w) {
      if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s), top = Math.max(0.3, sl.top); if (r.y > 0.7 * top && r.s > -0.2 * r.wave.cond.H) { launched = true; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
      const A = r.air;
      if (A) { if (air === 'grab' || air === 'grabrev' || air === 'grab360') inp.stall = 1; if ((air === 'r360' || air === 'grab360') && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * spinTo ? spinDir : 0; if ((air === 'rev' || air === 'grabrev') && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? spinDir : 0; if (air === 'none') { inp.stall = 0; } }
      else if (r.rev) inp.steer = out === 'help' ? r.rev.dir : out === 'wrong' ? -r.rev.dir : 0;
      return upd.call(r, dt, inp, w);
    };
    let i = 0, m0 = 0, landedAt = -1;
    for (; i < n; i++) { t.frame(i); if (launched && !rec) rec = { airT: 0 }; if (launched && !r.air && landedAt < 0 && r.state === 'RIDE') landedAt = i; if (r.state === 'WIPE' || r.state === 'OUT') break; if (landedAt >= 0 && i - landedAt > 100) break; }
    const ms = r.ride.moves.filter((m) => /AIR/.test(m.name)).map((m) => m.name + (m.notes.includes('grab') ? '+grab' : '') + ' ' + m.pts.toFixed(2));
    res.push({ launched, end: r.state, why: (r.why || '').slice(0, 44), moves: ms.join(','), trick: r.trick ? r.trick.name : '' });
    delete r.update; t.done();
  }
  return res;
}
// pictures and view smoothness: one forced air with air/out as in forced; frames of your view at moments (s after take-off),
// and the biggest turn of the view in one frame (1/60 s) through the air and the ride-out
export async function look({ mode = 'medium', seed = 5, air = 'grabrev', out = 'help', vy = 5.5, stance = 'goofy', at = [0.15, 0.35, 0.55, 0.75, 0.95, 1.2, 1.45, 1.7] } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(); g.useStance(stance);
  const nm = 'lk' + Math.random(), n = 60 * 30; FM.addPro(nm, mode, seed, n, 'short', 'carve', undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update; let launched = false, t0 = 0, k = 0; const shots = [], q0 = g.camera.quaternion.clone(); let maxA = 0, maxAt = 0, normA = 0;
  r.update = function (dt, inp, w) {
    if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s); if (r.y > 0.7 * Math.max(0.3, sl.top) && r.s > -0.2 * r.wave.cond.H) { launched = true; t0 = r.ride.t; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
    const A = r.air;
    if (A) { if (/grab/.test(air)) inp.stall = 1; if (/rev/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? 1 : 0; }
    else if (r.rev) inp.steer = out === 'help' ? r.rev.dir : out === 'wrong' ? -r.rev.dir : 0;
    return upd.call(r, dt, inp, w);
  };
  for (let i = 0; i < n && k < at.length; i++) {
    t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break;
    const a = q0.angleTo(g.camera.quaternion) * 57.3; q0.copy(g.camera.quaternion);
    if (launched) { const tt = r.ride.t - t0; if (tt > 0.02 && a > maxA) { maxA = a; maxAt = +tt.toFixed(2); } if (tt >= at[k]) { N.draw(g); shots.push(g.renderer.domElement.toDataURL('image/jpeg', 0.7)); k++; } }
    else if (r.stateT > 1) normA = Math.max(normA, a);
  }
  delete r.update; t.done(); return { shots, maxTurnDeg: +maxA.toFixed(2), maxAt, normalMaxTurnDeg: +normA.toFixed(2), moves: r.ride.moves.map((m) => m.name).join(','), end: r.state };
}
// dark pixels (sum < 60) in your view every frame from take-off to 1.5 s after, for a forced air; the worst frame's picture
export async function dark({ mode = 'medium', seed = 5, air = 'grab', out = 'help', vy = 6, stance = 'goofy', dir = 1 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(); g.useStance(stance);
  const nm = 'dk' + Math.random(), n = 60 * 30; FM.addPro(nm, mode, seed, n, 'short', 'carve', undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update, cv = g.renderer.domElement, c = document.createElement('canvas'); let launched = false, t0 = 0, worst = 0, img = null; const counts = [];
  const cnt = () => { const w = 160, h = Math.round(160 * cv.height / cv.width); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, w, h); const d = x.getImageData(0, 0, w, Math.round(h * 0.85)).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 60) k++; return k; };
  r.update = function (dt, inp, w) {
    if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s); if (r.y > 0.7 * Math.max(0.3, sl.top) && r.s > -0.2 * r.wave.cond.H) { launched = true; t0 = r.ride.t; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
    const A = r.air;
    if (A) { if (/grab/.test(air)) inp.stall = 1; if (/rev/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? dir : 0; if (/360/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 1.8 ? dir : 0; }
    else if (r.rev) inp.steer = out === 'help' ? r.rev.dir : out === 'wrong' ? -r.rev.dir : 0;
    return upd.call(r, dt, inp, w);
  };
  const boardOff = (on) => { for (const ch of g.rig.children) if (ch !== g.surfer) ch.visible = on; };   // (the board's dark grip pad isn't a glitch: counted without the board)
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (launched) { if (i % 2 === 0) { boardOff(false); N.draw(g); const k = cnt(); boardOff(true); counts.push(k); if (k > worst) { worst = k; img = cv.toDataURL('image/jpeg', 0.7); } } if (r.ride.t - t0 > 2.2) break; } }
  delete r.update; t.done(); return { stance, air, worst, counts: counts.join(','), img, moves: r.ride.moves.map((m) => m.name).join(','), end: r.state };
}
// timeline of one forced air: every 2 frames, time since take-off, in air / riding out, arms-out k, arms hidden, which arm
// points are on screen, dark pixels
export async function timeline({ mode = 'medium', seed = 5, air = 'rev', vy = 5, stance = 'regular', dir = 1 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(); g.useStance(stance);
  const nm = 'tl' + Math.random(), n = 60 * 30; FM.addPro(nm, mode, seed, n, 'short', 'carve', undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update, cv = g.renderer.domElement, c = document.createElement('canvas'), bones = {}; g.surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const v = new (g.camera.position.constructor)(); let launched = false, t0 = 0; const rows = [], imgs = [];
  const cnt = () => { const w = 160, h = Math.round(160 * cv.height / cv.width); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, w, h); const d = x.getImageData(0, 0, w, Math.round(h * 0.85)).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 60) k++; return k; };
  r.update = function (dt, inp, w) {
    if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s); if (r.y > 0.7 * Math.max(0.3, sl.top) && r.s > -0.2 * r.wave.cond.H) { launched = true; t0 = r.ride.t; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
    const A = r.air; if (A) { if (/grab/.test(air)) inp.stall = 1; if (/rev/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? dir : 0; if (/360/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 1.8 ? dir : 0; } else if (r.rev) inp.steer = r.rev.dir;
    return upd.call(r, dt, inp, w);
  };
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (!launched || i % 2) continue; const tt = r.ride.t - t0; if (tt > 1.8) break;
    N.draw(g); const k = cnt(); let on = []; for (const b of ['hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r', 'upperarm_l', 'upperarm_r', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r']) { bones[b].getWorldPosition(v); v.project(g.armCam); if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) on.push(b.replace('arm', '').replace('_', '')); }
    rows.push(`${tt.toFixed(2)} ${r.air ? 'A' : r.rev ? 'R' : '-'} k${g.spinArmK.toFixed(2)} h${g.armHide.toFixed(2)} e${g.spinEndT.toFixed(2)} b${g.bodyHide} d${k} [${on.join(' ')}]`); if (k > 20 && imgs.length < 4) imgs.push(cv.toDataURL('image/jpeg', 0.7)); }
  delete r.update; t.done(); return { rows, imgs };
}
// what's the dark thing? the first frame of a forced air with more than `min` dark pixels: raycast them through both cameras
export async function whatdark({ mode = 'medium', seed = 5, air = 'rev', vy = 5, stance = 'regular', dir = 1, min = 15 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), T = await import('three'), g = G(); g.useStance(stance);
  const nm = 'wd' + Math.random(), n = 60 * 30; FM.addPro(nm, mode, seed, n, 'short', 'carve', undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update, cv = g.renderer.domElement, c = document.createElement('canvas'); let launched = false, t0 = 0, out = null;
  r.update = function (dt, inp, w) {
    if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s); if (r.y > 0.7 * Math.max(0.3, sl.top) && r.s > -0.2 * r.wave.cond.H) { launched = true; t0 = r.ride.t; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
    const A = r.air; if (A) { if (/rev/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? dir : 0; } else if (r.rev) inp.steer = r.rev.dir;
    return upd.call(r, dt, inp, w);
  };
  const boardOff = (on) => { for (const ch of g.rig.children) if (ch !== g.surfer) ch.visible = on; };
  for (let i = 0; i < n && !out; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (!launched || r.ride.t - t0 > 2.2) continue;
    boardOff(false); N.draw(g); boardOff(true); const w = 160, h = Math.round(160 * cv.height / cv.width); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; const pts = [];
    for (let yy = 0; yy < h * 0.85; yy++) for (let xx = 0; xx < w; xx++) { const k = (yy * w + xx) * 4; if (d[k] + d[k + 1] + d[k + 2] < 60) pts.push([xx, yy]); }
    if (pts.length > min) { const rc = new T.Raycaster(); rc.layers.enableAll(); const hits = {}; for (const cam of [g.camera, g.armCam]) for (const [px, py] of pts.slice(0, 40)) { rc.setFromCamera(new T.Vector2(px / w * 2 - 1, -(py / h * 2 - 1)), cam); const q = rc.intersectObjects(g.scene.children, true).filter((o) => o.object.visible && !o.object.isPoints && !o.object.isLine)[0]; const p = []; let o = q && q.object; while (o && p.length < 4) { p.push(o.name || o.type); o = o.parent; } const key = (cam === g.camera ? 'world ' : 'body ') + (q ? p.join('<') + ' [' + ((q.object.material && q.object.material.name) || '') + '] d' + q.distance.toFixed(1) : 'miss'); hits[key] = (hits[key] || 0) + 1; }
      const img = cv.toDataURL('image/jpeg', 0.8); g.surfer.visible = false; boardOff(false); N.draw(g); boardOff(true); g.surfer.visible = true; x.drawImage(cv, 0, 0, w, h); const d2 = x.getImageData(0, 0, w, h).data; let n2 = 0; for (let k = 0; k < d2.length; k += 4) if (d2[k] + d2[k + 1] + d2[k + 2] < 60) n2++;
      const per = {}; g.surfer.traverse((o) => { if (!o.isMesh) return; const was = o.visible; o.visible = false; boardOff(false); N.draw(g); boardOff(true); o.visible = was; x.drawImage(cv, 0, 0, w, h); const d3 = x.getImageData(0, 0, w, h).data; let n3 = 0; for (let k = 0; k < d3.length; k += 4) if (d3[k] + d3[k + 1] + d3[k + 2] < 60) n3++; per[o.name + '/' + o.material.name + (o.visible ? '' : '(hidden)')] = n3; });
      out = { per, t: +(r.ride.t - t0).toFixed(2), n: pts.length, nNoBody: n2, hits, inAir: !!r.air, rev: !!r.rev, spinArmK: g.spinArmK, bodyHide: g.bodyHide, noCap: g.noCap, armHide: g.armHide, img }; } }
  delete r.update; t.done(); return out;
}
// an air hunter: the carve line (down past the curl's speed, back up against it) but the run up is near straight up the
// face (k: how far under the wave's speed in z, in wave speeds), pumping on the way up, near the curl. Logs, at each reach
// of the top 22% of the face, what the take-off rule saw, so the miss can be read
export async function hunt({ mode = 'medium', seed = 5, board = 'short', k = 1.2, lo = 0.2, dv = 0.6, pumpUp = true, maxS = 30, gain = 3 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'hu' + Math.random(), n = 60 * maxS;
  FM.addPro(nm, mode, seed, n, board, 'carve'); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)); let ph = 'down', airs = 0, wasAir = false, reach = 0, lastReach = -9; const why = {}, probe = [];
  r.update = function (dt, inp, w) {
    if (r.state === 'RIDE' && r.wave && !r.air && r.stateT > 0.9) {
      const C = r.wave.cond, H = C.H, c = C.speed, sl = r.wave.prof.slice(r.s), top = Math.max(0.3, sl.top * (r.wave.fade || 1)), hR = r.y / top;
      if (ph === 'down' && hR < lo) ph = 'up'; else if (ph === 'up' && (hR > 1.05 || r.v < 0.55 * c)) ph = 'down';
      const wantVz = ph === 'down' ? c + dv * c : c - k * c; inp.steer = Math.max(-1, Math.min(1, wrap(Math.asin(Math.max(-0.97, Math.min(0.97, wantVz / Math.max(r.v, 0.5)))) - r.th) * gain));
      inp.pump = ph === 'down' || pumpUp; inp.paddle = inp.pump; inp.stall = 0;
      if (hR > 0.78 && r.stateT - lastReach > 1.2) { lastReach = r.stateT; reach++; const need = Math.max(2.6, 0.42 * Math.sqrt(9.8 * H)), m = [];
        if (r.s <= -0.25 * H) m.push('behindCurl'); if ((r.vyPk || 0) <= need) m.push('climb'); if ((r.hitV || 0) <= 0.8 * c) m.push('speed'); if ((r.upT || 0) <= 0.12) m.push('notUp');
        const key = m.join('+') || 'ok'; why[key] = (why[key] || 0) + 1; if (probe.length < 6) probe.push({ sH: +(r.s / H).toFixed(2), vyPk: +(r.vyPk || 0).toFixed(1), need: +need.toFixed(1), hitV: +(r.hitV || 0).toFixed(1), needV: +(0.8 * c).toFixed(1), upT: +(r.upT || 0).toFixed(2), th: +r.th.toFixed(2) }); }
    }
    if (r.air && !wasAir) airs++; wasAir = !!r.air;
    return upd.call(r, dt, inp, w);
  };
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; }
  delete r.update; t.done(); return { k, airs, reach, why, probe, end: r.state, endWhy: (r.why || '').slice(0, 40), moves: r.ride.moves.filter((m) => /AIR/.test(m.name)).map((m) => m.name).join(',') };
}
// the air hunter, by heading: down the face at `dn` rad, bottom turn, then a steady line up at `up` rad (pointing up the
// face, held, pumping), steeper both ways when it's run too far ahead of the curl so it drifts back to the pocket
export async function hunt2({ mode = 'medium', seed = 5, board = 'short', up = 0.7, dn = 0.6, lo = 0.25, maxS = 30, gain = 2.5, wide = 0.45, air = 'none', out = 'help' } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(), nm = 'h2' + Math.random(), n = 60 * maxS;
  FM.addPro(nm, mode, seed, n, board, 'carve'); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)); let ph = 'down', airs = 0, wasAir = false, reach = 0, lastReach = -9, spinDir = 1; const why = {}, probe = [], log = [], trace = [];
  r.update = function (dt, inp, w) {
    const A = r.air;
    if (A) { if (!wasAir) { airs++; spinDir = -spinDir; log.push({ vy0: +A.vy.toFixed(1), H: r.wave ? r.wave.cond.H : 0 }); } wasAir = true; const L = log[log.length - 1]; L.peak = +(A.peak || 0).toFixed(1); L.t = +A.t.toFixed(2); if (/grab/.test(air)) inp.stall = 1; if (/rev/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? spinDir : 0; if (/360/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 1.85 ? spinDir : 0; return upd.call(r, dt, inp, w); }
    if (wasAir && log.length) { const L = log[log.length - 1]; L.landV = +(r.landV || 0).toFixed(1); L.impact = +(r.landImpact || 0).toFixed(1); L.slope = +Math.hypot(r.hx || 0, r.hz || 0).toFixed(2); L.fell = r.state === 'WIPE' ? (r.why || '').slice(0, 20) : ''; }
    wasAir = false;
    if (r.rev) { inp.steer = out === 'help' ? r.rev.dir : out === 'wrong' ? -r.rev.dir : 0; const R2 = r.rev, rx = r.vx, rz = r.vz - 0, vd = Math.atan2(rz, rx); if (trace.length < 60) trace.push(`${R2.t.toFixed(2)} th${r.th.toFixed(2)} vd${vd.toFixed(2)} d${R2.dir} st${inp.steer}`); const res = upd.call(r, dt, inp, w); if (!r.rev && trace.length < 60) trace.push('DONE ' + r.state + ' ' + (r.why || '')); return res; }
    if (r.state === 'RIDE' && r.wave && r.stateT > 0.9) {
      const C = r.wave.cond, H = C.H, c = C.speed, sl = r.wave.prof.slice(r.s), top = Math.max(0.3, sl.top * (r.wave.fade || 1)), hR = r.y / top, sH = r.s / H;
      if (ph === 'down' && hR < lo) ph = 'up'; else if (ph === 'up' && (hR > 1.05 || r.v < 0.5 * c)) ph = 'down';
      const ahead = Math.max(0, Math.min(1, (sH - 0.8) / 1.5)), want = ph === 'down' ? dn + wide * ahead : -(up + wide * ahead);
      inp.steer = Math.max(-1, Math.min(1, wrap(want - r.th) * gain)); inp.pump = true; inp.paddle = true; inp.stall = 0;
      if (hR > 0.78 && r.stateT - lastReach > 1.2) { lastReach = r.stateT; reach++; const need = Math.max(2.6, 0.42 * Math.sqrt(9.8 * H)), m = [];
        if (r.s <= -0.25 * H) m.push('behindCurl'); if ((r.vyPk || 0) <= need) m.push('climb'); if ((r.hitV || 0) <= 0.8 * c) m.push('speed'); if ((r.upT || 0) <= 0.12) m.push('notUp');
        const key = m.join('+') || 'ok'; why[key] = (why[key] || 0) + 1; if (probe.length < 6) probe.push({ sH: +sH.toFixed(2), vyPk: +(r.vyPk || 0).toFixed(1), need: +need.toFixed(1), hitV: +(r.hitV || 0).toFixed(1), upT: +(r.upT || 0).toFixed(2), th: +r.th.toFixed(2), turn: +(r.turn || 0).toFixed(2) }); }
    }
    return upd.call(r, dt, inp, w);
  };
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; }
  if (log.length && log[log.length - 1].landV === undefined) { const Lg = log[log.length - 1]; Lg.landV = +(r.landV || 0).toFixed(1); Lg.impact = +(r.landImpact || 0).toFixed(1); Lg.slope = +Math.hypot(r.hx || 0, r.hz || 0).toFixed(2); Lg.fell = r.state === 'WIPE' ? (r.why || '').slice(0, 20) : ''; }
  delete r.update; t.done(); return { up, airs, reach, why, probe, end: r.state, endWhy: (r.why || '').slice(0, 40), moves: r.ride.moves.filter((m) => /AIR/.test(m.name)).map((m) => m.name + (m.notes.includes('grab') ? '+grab' : '')).join(','), score: r.ride.score, log, trace };
}
// dark pixels in your own view through a normal ride (no airs): the baseline for the same check
export async function darkRide({ mode = 'medium', seed = 5, stance = 'regular', plan = 'carve', board = 'short', maxS = 20 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), g = G(); g.useStance(stance);
  const nm = 'dr' + Math.random(), n = 60 * maxS; FM.addPro(nm, mode, seed, n, board, plan, undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, cv = g.renderer.domElement, c = document.createElement('canvas'), imgs = []; let worst = 0, frames = 0, over = 0;
  const boardOff = (on) => { for (const ch of g.rig.children) if (ch !== g.surfer) ch.visible = on; };
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (r.state !== 'RIDE' || i % 3) continue; boardOff(false); N.draw(g); boardOff(true); const w = 160, h = Math.round(160 * cv.height / cv.width); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, w, h); const d = x.getImageData(0, 0, w, Math.round(h * 0.85)).data; let k = 0; for (let j = 0; j < d.length; j += 4) if (d[j] + d[j + 1] + d[j + 2] < 60) k++; frames++; if (k > 40) { over++; if (imgs.length < 4) imgs.push(cv.toDataURL('image/jpeg', 0.7)); } worst = Math.max(worst, k); }
  t.done(); return { stance, mode, frames, framesOver40: over, worst, imgs };
}
// the dark thing in a normal ride: first frame over `min` dark pixels; which mesh (hide each), which bone the hit skin
// belongs to, front or back face, how far from the eye
export async function whatRide({ mode = 'medium', seed = 7, stance = 'regular', plan = 'snap', min = 100 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), N = await import('./noseshot.js?v=' + Date.now()), T = await import('three'), g = G(); g.useStance(stance);
  const nm = 'wr' + Math.random(), n = 60 * 20; FM.addPro(nm, mode, seed, n, 'short', plan, undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, cv = g.renderer.domElement, c = document.createElement('canvas'), boardOff = (on) => { for (const ch of g.rig.children) if (ch !== g.surfer) ch.visible = on; };
  const grab = () => { boardOff(false); N.draw(g); boardOff(true); const w = 160, h = Math.round(160 * cv.height / cv.width); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, pts = []; for (let yy = 0; yy < h * 0.85; yy++) for (let xx = 0; xx < w; xx++) { const k = (yy * w + xx) * 4; if (d[k] + d[k + 1] + d[k + 2] < 60) pts.push([xx / w * 2 - 1, -(yy / h * 2 - 1)]); } return pts; };
  let out = null;
  for (let i = 0; i < n && !out; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (r.state !== 'RIDE') continue; const pts = grab(); if (pts.length < min) continue;
    const img = cv.toDataURL('image/jpeg', 0.7), per = {}; g.surfer.traverse((o) => { if (!o.isMesh || !o.visible) return; o.visible = false; per[o.name] = grab().length; o.visible = true; });
    let mesh; g.surfer.traverse((o) => { if (o.name === 'base') mesh = o; }); const rc = new T.Raycaster(); rc.layers.enableAll(); const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, bones = {};
    for (const [px, py] of pts.filter((_, j) => j % 4 === 0).slice(0, 40)) { rc.setFromCamera(new T.Vector2(px, py), g.armCam); const hs = rc.intersectObject(mesh, false); for (const q of hs.slice(0, 2)) { const v = q.face.a; let best = 0, bi = 0; for (let kk = 0; kk < 4; kk++) { const wt = sw.getComponent(v, kk); if (wt > best) { best = wt; bi = si.getComponent(v, kk); } } const nrm = q.face.normal.clone().transformDirection(mesh.matrixWorld), front = nrm.dot(rc.ray.direction) < 0; const key = mesh.skeleton.bones[bi].name + (front ? ' F' : ' B') + ' ' + q.distance.toFixed(2); bones[key] = (bones[key] || 0) + 1; } }
    const bn = {}; g.surfer.traverse((o) => { if (o.isBone) bn[o.name] = o; }); const V = g.camera.position.constructor, va = new V(), vb = new V(), dist = {}; for (const sd of ['l', 'r']) { bn['upperarm_' + sd].getWorldPosition(va); bn['lowerarm_' + sd].getWorldPosition(vb); dist['upperMid_' + sd] = +va.clone().lerp(vb, 0.5).distanceTo(g.camera.position).toFixed(2); dist['shoulder_' + sd] = +va.distanceTo(g.camera.position).toFixed(2); bn['clavicle_' + sd].getWorldPosition(va); dist['clav_' + sd] = +va.distanceTo(g.camera.position).toFixed(2); }
    out = { dist, armCut: +g.ARMCUT.value.toFixed(2), cut: +g.CUT.value.toFixed(2), t: +r.stateT.toFixed(2), n: pts.length, per, bones: Object.entries(bones).sort((a, b) => b[1] - a[1]).slice(0, 10), noCap: g.noCap, img }; }
  t.done(); return out;
}
// shaking in the air: the view's turn and tip every 1/60 s from take-off to landing (a forced air), and how often the turn
// flips direction frame to frame (a judder) compared with the riding just before
export async function shake({ mode = 'medium', seed = 5, air = 'none', vy = 6, stance = 'goofy' } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(); g.useStance(stance);
  const nm = 'sk' + Math.random(), n = 60 * 30; FM.addPro(nm, mode, seed, n, 'short', 'carve', undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update, cam = g.camera; let launched = false; const yaws = [], pre = [], eye = [];
  r.update = function (dt, inp, w) {
    if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s); if (r.y > 0.7 * Math.max(0.3, sl.top) && r.s > -0.2 * r.wave.cond.H) { launched = true; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
    if (r.air && /grab/.test(air)) inp.stall = 1;
    return upd.call(r, dt, inp, w);
  };
  const V = cam.position.constructor, f = new V(); let pv = null;
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; cam.getWorldDirection(f); const yaw = Math.atan2(f.z, f.x), pit = Math.asin(Math.max(-1, Math.min(1, f.y)));
    const rec = [yaw, pit, cam.position.clone().sub(g.rig.position)]; if (!launched) { pre.push(rec); if (pre.length > 60) pre.shift(); } else if (r.air) { yaws.push(rec); } else if (yaws.length) break; }
  delete r.update; t.done();
  const stat = (A) => { let flips = 0, maxd = 0, maxp = 0, maxe = 0, last = 0; for (let i = 1; i < A.length; i++) { const d = Math.atan2(Math.sin(A[i][0] - A[i - 1][0]), Math.cos(A[i][0] - A[i - 1][0])); if (i > 1 && Math.sign(d) !== Math.sign(last) && Math.abs(d) > 0.004 && Math.abs(last) > 0.004) flips++; last = d; maxd = Math.max(maxd, Math.abs(d)); maxp = Math.max(maxp, Math.abs(A[i][1] - A[i - 1][1])); maxe = Math.max(maxe, A[i][2].distanceTo(A[i - 1][2])); } return { frames: A.length, flips, maxTurnDeg: +(maxd * 57.3).toFixed(2), maxTipDeg: +(maxp * 57.3).toFixed(2), maxEyeCm: +(maxe * 100).toFixed(1) }; };
  const series = yaws.slice(1).map((v, i) => +(Math.atan2(Math.sin(v[0] - yaws[i][0]), Math.cos(v[0] - yaws[i][0])) * 57.3).toFixed(1));
  return { air: air, inAir: stat(yaws), riding: stat(pre), series };
}
// stop a forced air at a moment and leave it frozen for the game's own frame loop to draw (a real screenshot, words and all):
// air as in forced ('grab', 'r360', 'grab360', 'rev'...), stopped `at` s after take-off
export async function freezeAir({ mode = 'medium', seed = 5, air = 'grab', vy = 6.5, stance = 'goofy', at = 0.5, dir = 1, spinTo = 1.85 } = {}) {
  const FM = await import('./film.js?v=' + Date.now()), g = G(); g.useStance(stance);
  const nm = 'fz' + Math.random(), n = 60 * 30; FM.addPro(nm, mode, seed, n, 'short', 'carve', undefined, undefined, { sub: true }); const t = FM.takes[nm]; t.init();
  const r = g.rider, upd = r.update; let launched = false, t0 = 0;
  r.update = function (dt, inp, w) {
    if (!launched && r.state === 'RIDE' && r.wave && r.stateT > 2.5) { const sl = r.wave.prof.slice(r.s); if (r.y > 0.7 * Math.max(0.3, sl.top) && r.s > -0.2 * r.wave.cond.H) { launched = true; t0 = r.ride.t; r.air = { t: 0, vy, spin: 0, peak: 0 }; r.vz = Math.max(r.vz, r.wave.cond.speed * 1.02); } }
    const A = r.air; if (A) { inp.steer = 0; if (/grab/.test(air)) inp.stall = 1; if (/360/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * spinTo ? dir : 0; if (/rev/.test(air) && A.t > 0.3) inp.steer = Math.abs(A.spin) < Math.PI * 0.95 ? dir : 0; } else if (r.rev) inp.steer = r.rev.dir;
    return upd.call(r, dt, inp, w);
  };
  for (let i = 0; i < n; i++) { t.frame(i); if (r.state === 'WIPE' || r.state === 'OUT') break; if (launched && r.ride.t - t0 >= at) break; }
  delete r.update; g.paused = true; g.input.test = null; g.input.stick = null;
  return { inAir: !!r.air, spinDeg: r.air ? Math.round(Math.abs(r.air.spin) * 57.3) : null, grabT: r.air ? r.air.grabT : null, word: document.querySelector('#tube .cword') && document.querySelector('#tube .cword').textContent };
}
