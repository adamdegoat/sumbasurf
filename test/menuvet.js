// Menu layout check (3 Oct 2026, his ask: the right panel on every device): for the spot panel, are any of its parts
// on top of each other, outside the panel, cut off, or under About us / Feedback / Patch notes? Plus how much of the
// panel's width the picks use (his 'wasted empty space').
export function check() {
  const P = document.querySelector('#start .mmPanel:not(.fsPanel)'); if (!P) return { err: 'no panel' };
  const R = (el) => el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
  const pr = R(P), parts = { top: R(P.querySelector('.mmTop')), txt: R(P.querySelector('.mmTxt')), bb: R(document.getElementById('mmBB')), lvl: R(document.getElementById('mmLvl')), desc: R(document.getElementById('mmDesc')), go: R(document.getElementById('goSurf')), picks: R(P.querySelector('.mmPicks')), boards: R(document.getElementById('boards')), stances: R(document.getElementById('stances')) };
  const bad = [], ov = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const textEls = ['bb', 'lvl', 'desc'].filter((k) => parts[k]);
  for (const k of textEls) { if (ov(parts[k], parts.go)) bad.push(k + ' under START'); if (ov(parts[k], parts.picks)) bad.push(k + ' under picks'); }
  if (ov(parts.go, parts.picks)) bad.push('START on picks');
  for (const k of ['go', 'picks', 'txt']) if (parts[k] && (parts[k].bottom > pr.bottom + 1 || parts[k].right > pr.right + 1)) bad.push(k + ' outside panel');
  for (const id of ['pnBtn', 'fbBtn', 'abBtn']) { const b = R(document.getElementById(id)); if (b && ov(b, pr)) bad.push('panel under ' + id); }
  const chips = [...P.querySelectorAll('.mmPicks button')].filter((b) => b.offsetParent !== null);
  for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) if (ov(chips[i].getBoundingClientRect(), chips[j].getBoundingClientRect())) bad.push('chips overlap ' + chips[i].textContent.trim() + '/' + chips[j].textContent.trim());
  for (const c of chips) { if (c.scrollWidth > c.clientWidth + 1) bad.push('chip cut ' + c.textContent.trim()); }
  const best = [...P.querySelectorAll('.mmPicks button.best')].filter((b) => b.offsetParent !== null);
  const used = parts.picks && pr ? Math.round(100 * Math.max(parts.boards ? parts.boards.width : 0, parts.stances ? parts.stances.width : 0) / (pr.width - 2)) : null;
  return { vw: innerWidth, vh: innerHeight, bad, panelH: pr && Math.round(pr.height), picksWidthPct: used, docScroll: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1 };
}
