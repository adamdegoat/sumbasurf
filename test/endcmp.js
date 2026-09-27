// Ride length and score at the end of the wave, for comparing two versions (runs skill.js riders at every beach spot)
//   const C = await import('./test/endcmp.js'); await C.run('new')
import { run as ride } from './skill.js';
export async function run(tag, spots = ['easy', 'medium', 'hard', 'kanan', 'hiu']) {
  const out = {};
  for (const m of spots) for (const lv of ['decent', 'carver', 'good']) {
    const r = ride(m, lv, 6, 7);
    out[m + '/' + lv] = { caught: r.caught, made: r.madeIt, avgRide: r.avgRide, avgScore: r.avgScore, avgBarrel: r.avgBarrel, whys: r.whys };
  }
  await fetch(`http://127.0.0.1:8799/f?shot=endcmp_${tag}&i=0`, { method: 'POST', body: JSON.stringify(out) });
  return 'done';
}
