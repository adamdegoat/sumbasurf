// Nose-ride check: can a person-like player walk a longboard to the nose and hang ten? Stands a test surfer up, rides
// into the pocket, then walks up with human flaws (a reaction delay, a shaky thumb) and lets go of WALK when the game's
// warning shows (after the same delay). Three players:
//   naive  holds WALK and keeps carving as usual (no idea about the pocket)
//   trim   steers to stay mid-face in the pocket, gently, and walks back when warned
//   stall  as trim, and also holds STALL when running ahead of the pocket (how a real longboarder stays in it)
//   const N = await import('./test/nose.js?v=' + Date.now()); N.run('easy', 'trim', 10)
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
let HOLD = 2, WARN = 0.25; export const setHold = (v) => { HOLD = v; }; export const setWarn = (v) => { WARN = v; };   // (WARN: how close to pearling a player lets it get before walking back: 0.25 = at the first warning)   // (how long the player tries to stay on the tip before walking back, s)
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function standUp(mode, seed) {
  const g = G(); g.paused = true; g.setMode(mode); g.useBoard('long'); g.spawnRider(); g.keys.clear();
  const br = brain({}), cb = carveBrain({ hi: 0.7, lo: 0.25, gain: 3.4 }); let guard = 0;
  while (!(g.rider.standing && g.rider.state === 'RIDE' && g.rider.stateT > 1.8) && guard++ < 60 * 120) {
    const r = g.rider; if (r.state === 'WIPE' || r.state === 'OUT') { g.spawnRider(); continue; }
    let o = br(r); if (r.state === 'RIDE' && r.stateT > 1) o = cb(r);
    g.input.test = o.steer; g.input.paddleBtn = r.standing ? false : !!o.paddle; g.step(1 / 60, 1 / 60, false);
  }
  return guard < 60 * 120;
}
export function one(mode, who, seed, delay = 0.25, shake = 0.15) {
  const g = G(); if (!standUp(mode, seed)) return null; const r = g.rider, cb = carveBrain({ hi: 0.7, lo: 0.25, gain: 3.4 });
  const q = []; let rnd = seed * 9301 + 49297, t = 0, walking = true, warnedAt = -1, holdTip = 0, maxNose = 0, warned = false, hang10 = 0, noise = 0, shK = 0, lastS = 0, lastY = 0;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  const moves0 = r.ride.moves.length;
  for (; t < 14; t += 1 / 60) {
    if (r.state !== 'RIDE') break;
    const w = r.wave, Hh = w.cond.H; let steer, stall = false;
    if (who === 'naive') steer = cb(r).steer;
    else { const err = r.y / Hh - 0.45 - 0.35 * Math.max(0, r.s / Hh - 0.6), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9));
      const lim = (r.nose || 0) > 0.3 ? 0.75 : 1; steer = Math.max(-lim, Math.min(lim, wrapA(Math.asin(sn) - r.th) * 2.5)); stall = (who === 'stall' || who === 'nobal') && r.s / Hh > 0.8; }
    if ((r.nose || 0) >= 0.74 && who !== 'nobal') steer = steer * 0.4 - 3.2 * (r.wob || 0) - 0.5 * (r.wobV || 0);   // (up front: small balance corrections against the rock, most of the thumb on that)
    if (warnedAt >= 0 && t - warnedAt < 1.5) steer = Math.max(-0.6, Math.min(0.6, steer));   // (reads the hint: eases off the turn too)
    noise += ((rand() - 0.5) * 2 * shake - noise) * 0.08; steer += noise;
    // what the player sees now reaches their thumbs `delay` later
    q.push({ steer, stall, warn: (r.pearlK || 0) > WARN || (r.shoulderK || 0) > 0.4 }); const d = q.length > delay * 60 ? q.shift() : { steer: 0, stall: false, warn: false };
    if (d.warn) { warned = true; if (walking) { walking = false; warnedAt = t; } }
    if (walking && r.nose >= 0.99) { holdTip += 1 / 60; if (holdTip > HOLD) walking = false; }
    if (!walking && !d.warn && r.nose < 0.3 && t - warnedAt > 1.5 && holdTip <= HOLD) walking = true;   // (warned and safe again: have another go)
    g.input.stick = d.stall ? { x: d.steer, y: 1 } : null; g.input.test = d.stall ? null : d.steer; g.input.paddleBtn = walking;
    g.step(1 / 60, 1 / 60, false); maxNose = Math.max(maxNose, r.nose || 0); hang10 = Math.max(hang10, r.hang10T || 0); shK = Math.max(shK, r.shoulderK || 0); if (r.wave) { lastS = r.s / r.wave.cond.H; lastY = r.y / r.wave.cond.H; }
  }
  g.input.stick = null; g.input.test = null; g.input.paddleBtn = false;
  const hangs = r.ride ? r.ride.moves.slice(moves0).filter((m) => m.name.startsWith('HANG')).map((m) => `${m.name} ${m.dur.toFixed(1)}`) : [];
  return { end: r.state === 'RIDE' ? 'riding' : r.why, maxNose: +maxNose.toFixed(2), hangs, warned, shK: +shK.toFixed(2), sH: +lastS.toFixed(2), yH: +lastY.toFixed(2), nose: +(r.nose || 0).toFixed(2) };
}
export function run(mode = 'easy', who = 'trim', n = 10, delay = 0.25) {
  const rnd0 = Math.random, out = []; let st = 7;   // (the waves' randomness seeded, so every player gets the same waves)
  Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  try { for (let i = 0; i < n; i++) { const o = one(mode, who, 11 + i * 7, delay); if (o) out.push(o); } } finally { Math.random = rnd0; }
  const balance = out.filter((o) => /balance/.test(o.end)).length, tip = out.filter((o) => o.maxNose >= 0.99).length, ten = out.filter((o) => o.hangs.some((h) => h.startsWith('HANG TEN'))).length,
    five = out.filter((o) => o.hangs.length).length, pearl = out.filter((o) => /Pearled/.test(o.end)).length, shoulder = out.filter((o) => /shoulder/.test(o.end)).length,
    pearlWarned = out.filter((o) => /Pearled/.test(o.end) && o.warned).length;
  return { mode, who, rides: out.length, reachedTip: tip, hangTen: ten, anyHang: five, pearled: pearl, pearledAfterWarning: pearlWarned, leftOnShoulder: shoulder, lostBalance: balance, hangTimes: out.map((o) => o.hangs.join('/')).filter(Boolean), ends: out.map((o) => o.end.replace(/:.*/, '')) };
}
