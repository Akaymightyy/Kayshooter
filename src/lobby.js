// Lobby: profile/rewards (saved on the phone), mode cards, nav buttons, toasts.
const KEY = 'ks_profile_v1';
const DEFAULTS = { credits: 1200, gold: 25, xp: 0 };

export function getProfile() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
export const levelOf = (xp) => Math.floor(xp / 500) + 1;

export function addReward(won) {
  const p = getProfile();
  const credits = won ? 250 : 60, xp = won ? 300 : 100;
  p.credits += credits; p.xp += xp;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  return { credits, xp };
}

export function toast(msg) {
  let t = document.getElementById('ksToast');
  if (!t) { t = document.createElement('div'); t.id = 'ksToast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 1800);
}

export function renderProfile() {
  const p = getProfile();
  const $ = (id) => document.getElementById(id);
  $('lvl').textContent = levelOf(p.xp);
  $('xpFill').style.width = ((p.xp % 500) / 500 * 100) + '%';
  $('credits').textContent = p.credits.toLocaleString();
  $('gold').textContent = p.gold.toLocaleString();
}

const MODES = [
  { id: 'tdm', name: 'Team Elimination', desc: '5v5 · wipe the enemy squad', ready: true },
  { id: 'ffa', name: 'Free For All', desc: 'Every operator for themselves' },
  { id: 'br', name: 'Battle Royale', desc: 'Last squad standing' },
  { id: 'dom', name: 'Domination', desc: 'Capture and hold zones' },
  { id: 'zom', name: 'Zombie Survival', desc: 'Hold out against the horde' },
  { id: 'train', name: 'Training Ground', desc: 'Range, bots, no pressure' },
];

export function initLobby(settings, missions) {
  renderProfile();
  const wrap = document.getElementById('modes');
  wrap.innerHTML = MODES.map((m, i) => `
    <button class="mode${m.ready ? ' sel' : ''}" data-i="${i}">
      <span class="mode-name">${m.name}</span>
      <span class="mode-desc">${m.desc}</span>
      <span class="mode-tag ${m.ready ? 'ready' : ''}">${m.ready ? 'Ready' : 'Soon'}</span>
    </button>`).join('');
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('.mode'); if (!b) return;
    const m = MODES[+b.dataset.i];
    if (!m.ready) return toast(m.name + ' — coming soon');
    wrap.querySelectorAll('.mode').forEach((x) => x.classList.toggle('sel', x === b));
  });
  document.getElementById('lobbyNav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]'); if (!b) return;
    if (b.dataset.nav === 'settings') settings.open();
    else if (b.dataset.nav === 'missions' && missions) {
      import('./missions.js').then((mod) => mod.openMissionsPanel(missions));
    }
    else toast(b.textContent.trim() + ' — coming soon');
  });
}
