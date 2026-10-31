// Contract-style missions: per-round objectives, persisted completion, rewards.
import { getProfile, toast } from './lobby.js';

const KEY = 'ks_missions_v1';

export const MISSIONS = [
  { id: 'firstblood', name: 'First Blood',    desc: 'Eliminate 3 hostiles in one round',      target: 3, reward: { credits: 150 }, prog: (r) => r.kills },
  { id: 'demolition', name: 'Demolition Run', desc: 'Blow up 2 fuel canisters in one round',  target: 2, reward: { credits: 200 }, prog: (r) => r.cans },
  { id: 'gatecrasher', name: 'Gatecrasher',   desc: 'Step inside the hangar bay',             target: 1, reward: { credits: 150 }, prog: (r) => r.hangar },
  { id: 'skyline',    name: 'Skyline Sprint', desc: 'Cross the glass sky bridge end to end',  target: 1, reward: { credits: 200 }, prog: (r) => (r.bridgeW && r.bridgeE) ? 1 : 0 },
  { id: 'ace',        name: 'Squad Wipe Ace', desc: 'Win a round with 4+ eliminations',       target: 4, reward: { gold: 5 },      prog: (r) => Math.min(r.kills, 4) },
];

export class Missions {
  constructor() {
    this.done = {};
    try { this.done = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* ignore */ }
    this.resetRound();
  }

  resetRound() {
    this.round = { kills: 0, cans: 0, hangar: 0, bridgeW: 0, bridgeE: 0 };
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.done)); } catch (e) { /* ignore */ } }

  onKill(byPlayer) {
    if (!byPlayer) return;
    this.round.kills++;
    this._check('firstblood');
  }

  onCanister() {
    this.round.cans++;
    this._check('demolition');
  }

  onHangar() {
    if (this.round.hangar) return;
    this.round.hangar = 1;
    this._check('gatecrasher');
  }

  onBridgeSide(side) {
    if (side === 'w') this.round.bridgeW = 1;
    else this.round.bridgeE = 1;
    this._check('skyline');
  }

  onRoundEnd(won, kills) {
    if (won && kills >= 4) this._check('ace', true);
  }

  _check(id, force) {
    if (this.done[id]) return;
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return;
    if (!force && def.prog(this.round) < def.target) return;
    this.done[id] = true;
    this.save();
    const p = getProfile();
    let txt = '';
    if (def.reward.credits) { p.credits += def.reward.credits; txt = `+${def.reward.credits} CREDITS`; }
    if (def.reward.gold) { p.gold += def.reward.gold; txt = `+${def.reward.gold} GOLD`; }
    try { localStorage.setItem('ks_profile_v1', JSON.stringify(p)); } catch (e) { /* ignore */ }
    toast(`MISSION COMPLETE · ${def.name} · ${txt}`);
  }
}

/** Lobby modal listing all contracts and their status. */
export function openMissionsPanel(missions) {
  let m = document.getElementById('missionsModal');
  if (!m) {
    m = document.createElement('div');
    m.className = 'ks-modal'; m.id = 'missionsModal';
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('#mClose')) m.classList.remove('open'); });
  }
  const rows = MISSIONS.map((def) => {
    const done = !!missions.done[def.id];
    const cur = Math.min(def.prog(missions.round), def.target);
    const reward = def.reward.credits ? `+${def.reward.credits} CR` : `+${def.reward.gold} GOLD`;
    return `<div class="mrow ${done ? 'done' : ''}">
      <div class="mt"><span>${def.name}</span><b>${reward}</b></div>
      <div class="md">${def.desc}</div>
      <div class="mp">${done ? 'COMPLETE ✓' : `${cur} / ${def.target}`}</div>
    </div>`;
  }).join('');
  m.innerHTML = `<div class="ks-card"><h2>Missions</h2><div class="mlist">${rows}</div>
    <button class="btn-main" id="mClose">Done</button></div>`;
  m.classList.add('open');
}
