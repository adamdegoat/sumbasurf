// free surf lobby check (3 Oct 2026, his ask: the room list shows only one or two rooms): fills the list with n fake rooms in
// freeroom.js's own markup, then counts how many are fully in view, and checks the panel's parts stay inside it and on screen
export function fill(n = 12) {
  const box = document.getElementById('fsRooms'), names = ['Ayu', 'Budi', 'Kadek', 'Made', 'Wayan', 'Nyoman', 'Ketut', 'Putu', 'Komang', 'Gede', 'Dewi', 'Sari', 'Rizal', 'Tomas'];
  box.innerHTML = Array.from({ length: n }, (_, i) => `<div class="fsRoom"><b>${names[i % names.length]}'s beach</b><i>${i % 2 ? 'Party Point' : 'The Bay'}  ${1 + (i % 5)}/6</i><em${i % 3 === 0 ? ' class="x"' : ''}>${i % 3 === 0 ? 'EXTREME' : 'NORMAL'}</em><button type="button">Join</button></div>`).join('');
}
export function check() {
  const P = document.getElementById('fsPanel'), pr = P.getBoundingClientRect(), box = document.getElementById('fsRooms'), br = box.getBoundingClientRect();
  if (!pr.height) return { vw: innerWidth + 'x' + innerHeight, err: 'HIDDEN' };
  const rooms = [...box.querySelectorAll('.fsRoom')], full = rooms.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= br.top - 1 && b.bottom <= br.bottom + 1; }).length;
  const bad = [], R = (id) => { const e = document.getElementById(id); return e && e.offsetParent ? e.getBoundingClientRect() : null; };
  const ov = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const open = R('fsOpenBtn'), code = R('fsCodeIn'), join = R('fsCodeGo'), help = R('fsHelpBtn');
  for (const [n, r] of [['open', open], ['code', code], ['join', join], ['help', help]]) { if (!r) { bad.push(n + ' missing'); continue; } if (r.bottom > pr.bottom + 1 || r.right > Math.min(pr.right, innerWidth) + 1 || r.top < pr.top - 1) bad.push(n + ' outside'); if (ov(r, br)) bad.push(n + ' on rooms'); }
  if (pr.right > innerWidth + 1) bad.push('panel off screen');
  for (const id of ['pnBtn', 'fbBtn', 'abBtn']) { const b = R(id); if (ov(b, pr)) bad.push('panel under ' + id); }
  for (const r of rooms.slice(0, full)) for (const e of r.children) { const b = e.getBoundingClientRect(); if (e.offsetParent && b.right > r.getBoundingClientRect().right + 1) bad.push('room cut'); if (e.offsetParent && e.scrollWidth > e.clientWidth + 1 && e.tagName !== 'B') bad.push('room text cut ' + e.tagName); }
  return { vw: innerWidth + 'x' + innerHeight, roomsInView: full, listH: Math.round(br.height), bad: [...new Set(bad)] };
}
