// End-to-end numbers for a whole session, measured while skill.js riders surf (it wraps the game's step and samples the
// rider every step): paddling, catching, the pop-up, the drop, riding speed, turns, pumping, barrels, airs, wipeouts.
//   const E = await import('./test/e2e.js'); await E.run(['medium'], ['good'])
import { run as ride } from './skill.js';
const G = () => window.__g;
const pct = (a, p) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2); };
const mean = (a) => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null);
export async function run(spots = ['easy', 'medium', 'hard', 'kanan', 'hiu', 'extreme'], levels = ['decent', 'good'], tag = 'e2e', waves = 8) {
  const g = G(), step0 = g.step, res = {};
  for (const m of spots) for (const lv of levels) {
    const S = { paddle: [], sprint: [], popDur: [], catchPaddle: [], drop: [], v: [], gLat: [], turnRate: [], railT: [], pumpHz: [], pumpGain: [], barrel: [], airH: [], airT: [], wipe: [], rideT: [], lipHit: 0 };
    let last = null, stT = 0, padT = 0, lastSign = 0, lastFlip = 0, t = 0, air = null, tube = 0, pumpStart = null;
    g.step = function (sec, dt, draw) {
      step0.call(this, sec, dt, draw); t += sec; const r = g.rider; if (!r) return;
      const st = r.state;
      if (st !== last) {
        if (last === 'POP') S.popDur.push(stT);
        if (last === 'WIPE') S.wipe.push(stT);
        if (last === 'RIDE') S.rideT.push(stT);
        if (st === 'POP') { S.catchPaddle.push(padT); }
        last = st; stT = 0;
      }
      stT += sec;
      if (st === 'LIE' && r.paddling) { (r.onFace ? S.sprint : S.paddle).push(r.v); padT += sec; } else if (st !== 'LIE') padT = 0;
      if (st === 'RIDE') {
        const v = r.v; S.v.push(v * 3.6);
        if (stT < 2.5) S.drop.push(v * 3.6);
        if (!r.air) { S.gLat.push(Math.abs(r.turn) * v / 9.8); S.turnRate.push(Math.abs(r.turn) * 57.3); }
        const sg = Math.abs(r.lean) > 0.35 ? Math.sign(r.lean) : 0;
        if (sg && sg !== lastSign) { if (lastSign && t - lastFlip < 3) S.railT.push(t - lastFlip); lastSign = sg; lastFlip = t; }
        if (r.pumping) { if (!pumpStart) pumpStart = { t, n: r.pumpN, v }; }
        else if (pumpStart) { const d = t - pumpStart.t; if (d > 1.5) { S.pumpHz.push((r.pumpN - pumpStart.n) / d); S.pumpGain.push((v - pumpStart.v) * 3.6 / d); } pumpStart = null; }
        if (r.inBarrel) tube += sec; else if (tube > 0) { if (tube > 0.3) S.barrel.push(tube); tube = 0; }
        if (r.air && !air) air = { y0: r.y, top: r.y, t: 0 };
        if (r.air && air) { air.top = Math.max(air.top, r.y); air.t += sec; }
        if (!r.air && air) { S.airH.push(air.top - air.y0); S.airT.push(air.t); air = null; }
      }
    };
    let out;
    try { out = ride(m, lv, waves, 7); } finally { g.step = step0; }
    res[m + '/' + lv] = {
      caught: out.caught, made: out.madeIt, minutes: out.minutes,
      paddle_ms: mean(S.paddle), sprint_ms: pct(S.sprint, 0.9), paddleToCatch_s: mean(S.catchPaddle), popUp_s: mean(S.popDur),
      dropMax_kmh: pct(S.drop, 0.95), v_mean_kmh: mean(S.v), v_p90_kmh: pct(S.v, 0.9), v_max_kmh: pct(S.v, 1),
      gLat_p90: pct(S.gLat, 0.9), gLat_max: pct(S.gLat, 1), turn_p95_dps: pct(S.turnRate, 0.95), railToRail_s: pct(S.railT, 0.5),
      pump_hz: mean(S.pumpHz), pumpGain_kmh_per_s: mean(S.pumpGain), barrel_s: mean(S.barrel), barrel_max_s: pct(S.barrel, 1), barrels: S.barrel.length,
      air_h_m: mean(S.airH), air_hang_s: mean(S.airT), airs: S.airH.length, wipe_s: mean(S.wipe), ride_s: mean(S.rideT), why: out.whys,
    };
  }
  await fetch(`http://127.0.0.1:8799/f?shot=${tag}&i=0`, { method: 'POST', body: JSON.stringify(res) });
  return 'done';
}
